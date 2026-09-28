const { beijingDateKey } = require('../domain/time');

function createBootstrapService({ repo, now, onTiming }) {
  return {
    async execute({ openid }) {
      const startedAt = Date.now();
      const lookupsStartedAt = Date.now();
      const [isAdmin, existingUser] = await Promise.all([
        repo.isAdminOpenid(openid),
        repo.findUserByOpenid(openid)
      ]);
      const lookupsMs = Date.now() - lookupsStartedAt;

      let user = existingUser;
      let createUserMs = 0;
      if (!user) {
        const createStartedAt = Date.now();
        user = await repo.createUser(openid);
        createUserMs = Date.now() - createStartedAt;
      }

      const result = {
        userId: user._id,
        drawCredits: user.drawCredits,
        signedToday: user.lastSignInDate === beijingDateKey(now()),
        isAdmin
      };
      if (onTiming) {
        onTiming({ lookupsMs, createUserMs, totalMs: Date.now() - startedAt });
      }
      return result;
    }
  };
}

module.exports = { createBootstrapService };
