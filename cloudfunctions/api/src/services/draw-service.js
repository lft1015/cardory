const crypto = require('node:crypto');
const { AppError } = require('../errors');
const { validateRarityConfig } = require('../domain/config');
const { drawMany } = require('../domain/draw-engine');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function validateRequestId(requestId) {
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new AppError('INVALID_REQUEST_ID', '请求编号格式无效');
  }
}

function createDrawService({ repo, randomInt }) {
  function computeDrawId(userId, requestId) {
    return crypto.createHash('sha256')
      .update(userId + ':' + requestId)
      .digest('hex');
  }

  return {
    async execute({ openid, requestId, count }) {
      validateRequestId(requestId);
      if (count !== 1 && count !== 10) {
        throw new AppError('INVALID_DRAW_COUNT', '抽取数量仅支持 1 或 10');
      }

      const user = await repo.findUserByOpenid(openid);
      if (!user) {
        throw new AppError('SESSION_NOT_READY', '会话尚未初始化');
      }
      const drawId = computeDrawId(user._id, requestId);

      const existing = await repo.findDrawRecord(drawId);
      if (existing) {
        return existing.result;
      }

      return await repo.runUserTransaction(openid, async (currentUser) => {
        const inTransactionExisting = await repo.findDrawRecord(drawId);
        if (inTransactionExisting) {
          return inTransactionExisting.result;
        }

        const cards = await repo.findDrawableCards();
        const config = await repo.findRarityConfig();
        if (!config || !config.tiers) {
          throw new AppError('CONFIG_MISSING', '稀有度配置缺失');
        }
        validateRarityConfig(config.tiers, { pityLimit: config.pityLimit });
        if (cards.length === 0) {
          throw new AppError('POOL_MAINTENANCE', '卡池暂无可用卡牌');
        }
        if (currentUser.drawCredits < count) {
          throw new AppError('INSUFFICIENT_CREDITS', '抽卡次数不足');
        }

        const { outcomes, finalPityCount } = drawMany({
          count,
          cards,
          config,
          pityCount: currentUser.pityCount,
          randomInt
        });

        currentUser.drawCredits -= count;
        currentUser.pityCount = finalPityCount;

        const results = [];
        for (const outcome of outcomes) {
          const { isNew, ownedCount } = await repo.upsertCollection(currentUser._id, outcome.cardId);
          const imageUrl = await repo.getPublicImageUrl(outcome.imageUrl);
          results.push({
            cardId: outcome.cardId,
            cardName: outcome.cardName,
            rarity: outcome.rarity,
            type: outcome.type,
            imageUrl: imageUrl || '',
            isNew,
            ownedCount
          });
        }

        const drawResult = {
          results,
          remainingCredits: currentUser.drawCredits
        };

        await repo.saveDrawRecord(drawId, currentUser._id, outcomes, drawResult);
        return drawResult;
      });
    }
  };
}

module.exports = { createDrawService };
