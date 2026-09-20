const crypto = require('node:crypto');
const { AppError } = require('../errors');
const { beijingDateKey } = require('../domain/time');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{16,64}$/;

function validateRequestId(requestId) {
  if (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId)) {
    throw new AppError('INVALID_REQUEST_ID', '请求编号格式无效');
  }
}

function createSignInService({ repo, now }) {
  function computeRequestHash(userId, requestId) {
    return crypto.createHash('sha256')
      .update(userId + ':signIn:' + requestId)
      .digest('hex');
  }

  return {
    async execute({ openid, requestId }) {
      validateRequestId(requestId);
      const user = await repo.findUserByOpenid(openid);
      if (!user) {
        throw new AppError('SESSION_NOT_READY', '会话尚未初始化');
      }
      const requestHash = computeRequestHash(user._id, requestId);

      const existing = await repo.findOperationRecord(requestHash);
      if (existing) return existing.result;

      return await repo.runUserTransaction(openid, async (currentUser) => {
        // Re-check and persist the idempotency record while holding the user lock.
        const inTransactionExisting = await repo.findOperationRecord(requestHash);
        if (inTransactionExisting) return inTransactionExisting.result;

        const dateKey = beijingDateKey(now());

        if (currentUser.lastSignInDate === dateKey) {
          const result = { signed: false, drawCredits: currentUser.drawCredits, dateKey };
          await repo.saveOperationRecord(requestHash, 'signIn', currentUser._id, result);
          return result;
        }

        currentUser.lastSignInDate = dateKey;
        currentUser.drawCredits += 1;

        const result = { signed: true, drawCredits: currentUser.drawCredits, dateKey };
        await repo.saveOperationRecord(requestHash, 'signIn', currentUser._id, result);
        return result;
      });
    }
  };
}

module.exports = { createSignInService, validateRequestId };
