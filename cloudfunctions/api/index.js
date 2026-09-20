const cloud = require('wx-server-sdk');
const crypto = require('node:crypto');
const { createRouter } = require('./src/router');
const { createCloudRepository } = require('./src/repositories/cloud-repository');
const { createSignInService } = require('./src/services/sign-in-service');
const { createDrawService } = require('./src/services/draw-service');
const { createBootstrapService } = require('./src/services/bootstrap-service');
const { createCatalogService } = require('./src/services/catalog-service');
const { createAdminService } = require('./src/services/admin-service');
const { createSecurityClient } = require('./src/services/security-client');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const repo = createCloudRepository(db, cloud);

const signInService = createSignInService({ repo, now: () => new Date() });
const drawService = createDrawService({
  repo,
  randomInt: (maxExclusive) => crypto.randomInt(0, maxExclusive)
});
const bootstrapService = createBootstrapService({ repo, now: () => new Date() });
const catalogService = createCatalogService({ repo });
const adminService = createAdminService({ repo, securityClient: createSecurityClient({ cloud }) });

const route = createRouter({
  signIn: (payload, context) => signInService.execute({
    openid: context.openid,
    requestId: payload.requestId
  }),
  draw: (payload, context) => drawService.execute({
    openid: context.openid,
    requestId: payload.requestId,
    count: payload.count
  }),
  bootstrap: (payload, context) => bootstrapService.execute({
    openid: context.openid
  }),
  catalog: (payload, context) => catalogService.listAlbum({
    openid: context.openid,
    rarityId: payload.rarityId
  }),
  listAlbum: (payload, context) => catalogService.listAlbum({
    openid: context.openid,
    rarityId: payload.rarityId
  }),
  adminCreateCard: (payload, context) => adminService.createCard({ openid: context.openid, card: payload.card }),
  adminUpdateCard: (payload, context) => adminService.updateCard({ openid: context.openid, cardId: payload.cardId, patch: payload.patch }),
  adminListCards: (payload, context) => adminService.listCards({ openid: context.openid }),
  adminListLogs: (payload, context) => adminService.listAdminLogs({ openid: context.openid }),
  adminCheckImage: (payload, context) => adminService.checkCardImage({ openid: context.openid, cardId: payload.cardId }),
  adminConfirmAuthorization: (payload, context) => adminService.confirmAuthorization({ openid: context.openid, cardId: payload.cardId, confirmed: payload.confirmed }),
  adminPublishCard: (payload, context) => adminService.publishCard({ openid: context.openid, cardId: payload.cardId }),
  adminPublishConfig: (payload, context) => adminService.publishRarityConfig({ openid: context.openid, rarities: payload.rarities, pityLimit: payload.pityLimit }),
  adminChangeCardStatus: (payload, context) => adminService.changeCardStatus({ openid: context.openid, cardId: payload.cardId, action: payload.action, reason: payload.reason })
});

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  return route(event, { openid: OPENID });
};
