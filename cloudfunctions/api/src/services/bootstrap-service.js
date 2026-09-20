const { beijingDateKey } = require('../domain/time');

function createBootstrapService({ repo, now }) {
  return {
    async execute({ openid }) {
      const isAdmin = await repo.isAdminOpenid(openid);

      let user = await repo.findUserByOpenid(openid);
      if (!user) {
        user = await repo.createUser(openid);
      }

      return {
        userId: user._id,
        drawCredits: user.drawCredits,
        signedToday: user.lastSignInDate === beijingDateKey(now()),
        isAdmin
      };
    }
  };
}

module.exports = { createBootstrapService };
