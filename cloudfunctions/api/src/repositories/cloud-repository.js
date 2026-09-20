const { AsyncLocalStorage } = require('node:async_hooks');

const transactionStorage = new AsyncLocalStorage();
const MAX_DOCUMENT_ID_LENGTH = 32;

function documentId(value) {
  return String(value).slice(0, MAX_DOCUMENT_ID_LENGTH);
}

function createCloudRepository(db, cloud) {
  const activeDb = () => transactionStorage.getStore() || db;
  const collection = (name) => activeDb().collection(name);

  return {
    async findUserByOpenid(openid) {
      const result = await collection('users').where({ openid }).get();
      return result.data.length > 0 ? result.data[0] : null;
    },

    async createUser(openid) {
      const { randomUUID } = require('node:crypto');
      const user = {
        _id: randomUUID(),
        openid,
        drawCredits: 0,
        pityCount: 0,
        lastSignInDate: null,
        createdAt: new Date()
      };
      await collection('users').add({ data: user });
      return user;
    },

    async isAdminOpenid(openid) {
      const result = await collection('admins').where({ openid }).get();
      return result.data.length > 0;
    },

    async runUserTransaction(openid, callback) {
      return db.runTransaction(async (transaction) => {
        const userResult = await transaction.collection('users').where({ openid }).get();
        const user = userResult.data && userResult.data[0];
        if (!user) throw new Error('User not found');

        return transactionStorage.run(transaction, async () => {
          const result = await callback(user);
          await transaction.collection('users').doc(user._id).update({
            data: {
              drawCredits: user.drawCredits,
              pityCount: user.pityCount,
              lastSignInDate: user.lastSignInDate
            }
          });
          return result;
        });
      });
    },

    async findOperationRecord(requestHash) {
      try {
        const result = await collection('operation_records').doc(documentId(requestHash)).get();
        return result.data || null;
      } catch (error) {
        if (/does not exist|not found/i.test(String(error))) return null;
        throw error;
      }
    },

    async saveOperationRecord(requestHash, action, userId, result) {
      const id = documentId(requestHash);
      await collection('operation_records').doc(id).set({
        data: { requestHash, action, userId, result, createdAt: new Date() }
      });
    },

    async findDrawableCards() {
      const result = await collection('cards').where({ status: 'PUBLISHED' }).get();
      return result.data;
    },

    async findAllCards() {
      const result = await collection('cards').get();
      return result.data;
    },

    async findCardById(cardId) {
      const result = await collection('cards').doc(cardId).get();
      return result.data || null;
    },

    async saveCard(card) {
      const { _id, ...data } = card;
      await collection('cards').doc(_id).set({ data });
      return card;
    },

    async updateCard(cardId, patch) {
      await collection('cards').doc(cardId).update({ data: patch });
      return this.findCardById(cardId);
    },

    async saveAdminLog(log) {
      await collection('admin_logs').add({ data: { ...log, createdAt: new Date() } });
    },

    async saveRarityConfig(config) {
      await collection('rarity_config').doc(config.version).set({ data: config });
      return config;
    },

    async markCollectionsInvisible(cardId) {
      const result = await collection('collections').where({ cardId }).get();
      await Promise.all(result.data.map((entry) => collection('collections').doc(entry._id).update({ data: { visible: false } })));
    },

    async findUserCollection(userId) {
      const result = await collection('collections').where({ userId }).get();
      return result.data;
    },

    async findRarityConfig() {
      const result = await collection('rarity_config').orderBy('publishedAt', 'desc').limit(1).get();
      return result.data.length > 0 ? result.data[0] : null;
    },

    async upsertCollection(userId, cardId) {
      const collectionsCol = collection('collections');
      const existing = await collectionsCol.where({ userId, cardId }).get();
      if (existing.data.length > 0) {
        const doc = existing.data[0];
        await collectionsCol.doc(doc._id).update({
          data: { count: Number(doc.count || 0) + 1 }
        });
        return { isNew: false, ownedCount: doc.count + 1 };
      }
      await collectionsCol.add({
        data: { userId, cardId, count: 1, firstObtainedAt: new Date() }
      });
      return { isNew: true, ownedCount: 1 };
    },

    async findDrawRecord(drawId) {
      try {
        const result = await collection('draw_records').doc(documentId(drawId)).get();
        return result.data || null;
      } catch (error) {
        if (/does not exist/i.test(String(error))) return null;
        throw error;
      }
    },

    async saveDrawRecord(drawId, userId, outcomes, drawResult) {
      const id = documentId(drawId);
      await collection('draw_records').doc(id).set({
        data: {
          drawId,
          userId,
          outcomes,
          result: drawResult,
          createdAt: new Date()
        }
      });
    },

    async getPublicImageUrl(fileId) {
      if (!fileId) return null;
      if (!cloud || typeof cloud.getTempFileURL !== 'function') return fileId;
      try {
        const result = await cloud.getTempFileURL({ fileList: [fileId] });
        const item = result.fileList && result.fileList[0];
        return item && item.tempFileURL ? item.tempFileURL : null;
      } catch (error) {
        return null;
      }
    },

    async findAdminLogs() {
      const result = await collection('admin_logs').orderBy('createdAt', 'desc').limit(100).get();
      return result.data;
    }
  };
}

module.exports = { createCloudRepository };
