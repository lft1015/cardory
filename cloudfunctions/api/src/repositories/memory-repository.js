const crypto = require('node:crypto');
const { AppError } = require('../errors');

function createMemoryRepository() {
  const users = [];
  const admins = [];
  const operationRecords = [];
  let cards = [];
  let rarityConfig = null;
  const collections = [];
  const drawRecords = [];
  const adminLogs = [];
  const rarityConfigs = [];
  let failOnUpsert = false;

  let transactionLock = Promise.resolve();

  function acquireLock() {
    const prev = transactionLock;
    let release;
    transactionLock = new Promise((resolve) => { release = resolve; });
    return prev.then(() => release);
  }

  return {
    async findUserByOpenid(openid) {
      return users.find((u) => u.openid === openid) || null;
    },

    async createUser(openid) {
      const user = {
        _id: crypto.randomUUID(),
        openid,
        drawCredits: 0,
        pityCount: 0,
        lastSignInDate: null,
        createdAt: new Date()
      };
      users.push(user);
      return user;
    },

    async isAdminOpenid(openid) {
      return admins.some((a) => a.openid === openid);
    },

    async runUserTransaction(openid, callback) {
      const release = await acquireLock();
      const snapUsers = structuredClone(users);
      const snapCollections = structuredClone(collections);
      const snapDrawRecords = structuredClone(drawRecords);
      const snapOperationRecords = structuredClone(operationRecords);
      try {
        const user = users.find((u) => u.openid === openid);
        if (!user) {
          throw new Error('User not found');
        }
        return await callback(user);
      } catch (err) {
        users.splice(0, users.length, ...snapUsers);
        collections.splice(0, collections.length, ...snapCollections);
        drawRecords.splice(0, drawRecords.length, ...snapDrawRecords);
        operationRecords.splice(0, operationRecords.length, ...snapOperationRecords);
        throw err;
      } finally {
        release();
      }
    },

    async findOperationRecord(requestHash) {
      return operationRecords.find((r) => r.requestHash === requestHash) || null;
    },

    async saveOperationRecord(requestHash, action, userId, result) {
      const record = { requestHash, action, userId, result, createdAt: new Date() };
      operationRecords.push(record);
      return record;
    },

    async findDrawableCards() {
      return cards.filter((c) => c.status === 'PUBLISHED');
    },

    async findAllCards() {
      return cards;
    },

    async findCardById(cardId) {
      return cards.find((card) => card._id === cardId) || null;
    },

    async saveCard(card) {
      cards.push(card);
      return card;
    },

    async updateCard(cardId, patch) {
      const card = cards.find((item) => item._id === cardId);
      if (!card) return null;
      Object.assign(card, patch);
      return card;
    },

    async saveAdminLog(log) {
      adminLogs.push({ ...log, createdAt: new Date() });
    },

    async saveRarityConfig(config) {
      rarityConfigs.push(structuredClone(config));
      rarityConfig = config;
      return config;
    },

    async markCollectionsInvisible(cardId) {
      for (const entry of collections) {
        if (entry.cardId === cardId) entry.visible = false;
      }
    },

    async getPublicImageUrl(fileId) {
      return fileId || null;
    },

    async findAdminLogs() {
      return structuredClone(adminLogs).reverse();
    },

    async findUserCollection(userId) {
      return collections.filter((c) => c.userId === userId);
    },

    async findRarityConfig() {
      return rarityConfig;
    },

    async upsertCollection(userId, cardId) {
      if (failOnUpsert) {
        throw new AppError('UPSERT_FAILED', '模拟 upsert 失败');
      }
      const existing = collections.find((c) => c.userId === userId && c.cardId === cardId);
      if (existing) {
        existing.count += 1;
        return { isNew: false, ownedCount: existing.count };
      }
      collections.push({ userId, cardId, count: 1, firstObtainedAt: new Date() });
      return { isNew: true, ownedCount: 1 };
    },

    async findDrawRecord(drawId) {
      return drawRecords.find((r) => r._id === drawId) || null;
    },

    async saveDrawRecord(drawId, userId, outcomes, drawResult) {
      drawRecords.push({
        _id: drawId,
        userId,
        outcomes,
        result: drawResult,
        createdAt: new Date()
      });
    },

    seedCards(cardList) {
      cards = cardList;
    },

    seedRarityConfig(config) {
      rarityConfig = config;
    },

    setFailOnUpsert(value) {
      failOnUpsert = value;
    },

    _addCollection(entry) {
      collections.push({
        userId: entry.userId,
        cardId: entry.cardId,
        count: entry.count,
        firstObtainedAt: entry.firstObtainedAt || new Date()
      });
    },

    addAdmin(admin) {
      admins.push(admin);
    },

    snapshot() {
      return {
        users: structuredClone(users),
        admins: structuredClone(admins),
        operationRecords: structuredClone(operationRecords),
        collections: structuredClone(collections),
        drawRecords: structuredClone(drawRecords),
        adminLogs: structuredClone(adminLogs),
        rarityConfigs: structuredClone(rarityConfigs)
      };
    }
  };
}

module.exports = { createMemoryRepository };
