const crypto = require('node:crypto');
const { AppError } = require('../errors');
const { validateRarityConfig } = require('../domain/config');
const { isCardDrawable } = require('../domain/card-state');

const RARITIES = new Set(['N', 'R', 'SR', 'SSR']);
// Base64 adds about one third to the callFunction payload; keep headroom below its request limit.
const MAX_UPLOAD_BYTES = 500 * 1024;

function decodeImage(base64) {
  if (typeof base64 !== 'string' || !base64.length || base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new AppError('INVALID_IMAGE', '图片数据无效');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > MAX_UPLOAD_BYTES) throw new AppError('IMAGE_TOO_LARGE', '压缩后的图片不能超过500KB');
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { buffer, extension: 'png' };
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return { buffer, extension: 'jpg' };
  if (buffer.subarray(0, 4).toString('ascii') === 'GIF8') return { buffer, extension: 'gif' };
  throw new AppError('INVALID_IMAGE', '仅支持PNG、JPG或GIF图片');
}

function createAdminService({ repo, securityClient = null, imageUploader = null, now = () => new Date() }) {
  async function requireAdmin(openid) {
    if (!(await repo.isAdminOpenid(openid))) {
      throw new AppError('FORBIDDEN', '无权限访问');
    }
  }

  async function getCard(cardId) {
    const card = await repo.findCardById(cardId);
    if (!card) throw new AppError('CARD_NOT_FOUND', '卡牌不存在');
    return card;
  }

  async function log(openid, action, targetId, detail = null) {
    await repo.saveAdminLog({ adminOpenid: openid, action, targetId, detail });
  }

  function validateCard(card) {
    if (!card || typeof card.name !== 'string' || !card.name.trim() || card.name.trim().length > 64) {
      throw new AppError('INVALID_CARD', '卡牌名称无效');
    }
    if (!RARITIES.has(card.rarity) || !['PERMANENT', 'LIMITED'].includes(card.type)) {
      throw new AppError('INVALID_CARD', '卡牌稀有度或类型无效');
    }
    if (!Number.isInteger(card.weight) || card.weight <= 0) {
      throw new AppError('INVALID_CARD', '卡牌权重必须为正整数');
    }
    if (!card.imageFileId && !card.imageUrl) {
      throw new AppError('INVALID_CARD', '卡牌图片不能为空');
    }
    if (card.type === 'LIMITED') {
      const startsAt = new Date(card.startsAt);
      const endsAt = new Date(card.endsAt);
      if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) {
        throw new AppError('INVALID_CARD', '限定时间无效');
      }
    }
  }

  async function createCard({ openid, card }) {
    await requireAdmin(openid);
    card = card || {};
    const created = {
      ...card,
      _id: card._id || crypto.randomUUID(),
      status: 'DRAFT',
      securityPassed: false,
      authorizationConfirmed: false,
      createdAt: now(),
      updatedAt: now()
    };
    await repo.saveCard(created);
    await log(openid, 'CREATE_CARD', created._id);
    return created;
  }

  async function uploadImage({ openid, base64 }) {
    await requireAdmin(openid);
    if (typeof imageUploader !== 'function') throw new AppError('STORAGE_UNAVAILABLE', '图片存储服务不可用');
    const { buffer, extension } = decodeImage(base64);
    const ym = now().toISOString().slice(0, 7).replace('-', '');
    const cloudPath = `card-drafts/${ym}/card-${crypto.randomUUID()}.${extension}`;
    const result = await imageUploader({ cloudPath, fileContent: buffer });
    if (!result?.fileID) throw new AppError('UPLOAD_FAILED', '图片上传失败');
    await log(openid, 'UPLOAD_IMAGE', result.fileID);
    return { fileId: result.fileID };
  }

  async function updateCard({ openid, cardId, patch }) {
    await requireAdmin(openid);
    const card = await getCard(cardId);
    const allowed = ['name', 'rarity', 'type', 'weight', 'startsAt', 'endsAt', 'imageUrl', 'imageFileId'];
    const changes = Object.fromEntries(Object.entries(patch || {}).filter(([key]) => allowed.includes(key)));
    const imageChanged = ['imageUrl', 'imageFileId'].some((key) => Object.prototype.hasOwnProperty.call(changes, key) && changes[key] !== card[key]);
    const metadataChanged = Object.keys(changes).length > 0;
    if (imageChanged) {
      changes.status = 'DRAFT';
      changes.securityPassed = false;
      changes.authorizationConfirmed = false;
      changes.securityTraceId = null;
      changes.securityReason = null;
    } else if (metadataChanged && card.securityPassed && card.authorizationConfirmed) {
      changes.status = 'PUBLISHABLE';
    }
    const updated = await repo.updateCard(cardId, { ...changes,
      updatedAt: now()
    });
    await log(openid, 'UPDATE_CARD', cardId, { changed: Object.keys(changes), imageChanged });
    return updated;
  }

  async function checkCardImage({ openid, cardId }) {
    await requireAdmin(openid);
    const card = await getCard(cardId);
    if (!card.imageFileId && !card.imageUrl) throw new AppError('INVALID_CARD', '卡牌图片不能为空');
    if (!securityClient || typeof securityClient.checkImage !== 'function') {
      throw new AppError('SECURITY_UNAVAILABLE', '图片检测服务不可用');
    }
    await repo.updateCard(cardId, { status: 'CHECKING', updatedAt: now() });
    const result = await securityClient.checkImage({ fileId: card.imageFileId || card.imageUrl, openid });
    const patch = {
      status: result.passed ? 'PENDING_CONFIRMATION' : 'DRAFT',
      securityPassed: Boolean(result.passed),
      securityTraceId: result.traceId || null,
      securityReason: result.reason || null,
      updatedAt: now()
    };
    const updated = await repo.updateCard(cardId, patch);
    await log(openid, 'CHECK_IMAGE', cardId, patch);
    return updated;
  }

  async function confirmAuthorization({ openid, cardId, confirmed }) {
    await requireAdmin(openid);
    const card = await getCard(cardId);
    if (!card.securityPassed) throw new AppError('SECURITY_REQUIRED', '图片检测未通过');
    const updated = await repo.updateCard(cardId, {
      authorizationConfirmed: Boolean(confirmed),
      status: confirmed ? 'PUBLISHABLE' : 'PENDING_CONFIRMATION',
      updatedAt: now()
    });
    await log(openid, 'CONFIRM_AUTHORIZATION', cardId, { confirmed: Boolean(confirmed) });
    return updated;
  }

  async function publishCard({ openid, cardId }) {
    await requireAdmin(openid);
    const card = await getCard(cardId);
    validateCard(card);
    if (!card.securityPassed || !card.authorizationConfirmed) {
      throw new AppError('MODERATION_REQUIRED', '图片检测和肖像授权确认未完成');
    }
    if (card.status !== 'PUBLISHABLE') throw new AppError('INVALID_CARD_STATUS', '卡牌当前不可发布');
    const updated = await repo.updateCard(cardId, { status: 'PUBLISHED', updatedAt: now() });
    await log(openid, 'PUBLISH_CARD', cardId);
    return updated;
  }

  async function publishRarityConfig({ openid, rarities, pityLimit }) {
    await requireAdmin(openid);
    validateRarityConfig(rarities, { pityLimit });
    const cards = await repo.findAllCards();
    for (const tier of rarities) {
      if (tier.probabilityBps > 0 && !cards.some((card) => card.rarity === tier.id && isCardDrawable(card, now()))) {
        throw new AppError('POOL_MAINTENANCE', '正概率档位没有可用卡牌');
      }
    }
    const version = 'v' + Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 8);
    // Cloud runtime may be Node 12/14 and does not provide structuredClone.
    // Rarity tiers are flat records, so a shallow copy is sufficient here.
    const config = { version, tiers: rarities.map((tier) => ({ ...tier })), pityLimit, publishedAt: now() };
    await repo.saveRarityConfig(config);
    await log(openid, 'PUBLISH_CONFIG', version);
    return config;
  }

  async function changeCardStatus({ openid, cardId, action, reason }) {
    await requireAdmin(openid);
    await getCard(cardId);
    if (action === 'FORCE_REMOVED' && (!reason || !String(reason).trim())) {
      throw new AppError('REASON_REQUIRED', '强制移除必须填写原因');
    }
    if (!['OFFLINE', 'FORCE_REMOVED', 'PUBLISHED'].includes(action)) {
      throw new AppError('INVALID_CARD_ACTION', '不支持的卡牌操作');
    }
    const updated = await repo.updateCard(cardId, { status: action, ...(action === 'FORCE_REMOVED' ? { removalReason: reason } : {}), updatedAt: now() });
    if (action === 'FORCE_REMOVED') await repo.markCollectionsInvisible(cardId);
    await log(openid, action, cardId, { reason: reason || null });
    return updated;
  }

  async function listCards({ openid }) {
    await requireAdmin(openid);
    return repo.findAllCards();
  }

  async function listAdminLogs({ openid }) {
    await requireAdmin(openid);
    return repo.findAdminLogs ? repo.findAdminLogs() : [];
  }

  return { requireAdmin, uploadImage, createCard, updateCard, checkCardImage, confirmAuthorization, publishCard, publishRarityConfig, changeCardStatus, listCards, listAdminLogs };
}

module.exports = { createAdminService };
