const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../src/repositories/memory-repository');
const { createCatalogService } = require('../src/services/catalog-service');
const { AppError } = require('../src/errors');

function setupRepo() {
  const repo = createMemoryRepository();
  repo.seedCards([
    { _id: 'pub-n1', name: '普通卡A', rarity: 'N', weight: 1, status: 'PUBLISHED', type: 'PERMANENT', imageUrl: 'cloud://img/pub-n1.png' },
    { _id: 'pub-r1', name: '稀有卡A', rarity: 'R', weight: 1, status: 'PUBLISHED', type: 'PERMANENT', imageUrl: 'cloud://img/pub-r1.png' },
    { _id: 'off-n1', name: '下架N卡', rarity: 'N', weight: 1, status: 'OFFLINE', type: 'PERMANENT', imageUrl: 'cloud://img/off-n1.png' },
    { _id: 'off-r1', name: '下架R卡', rarity: 'R', weight: 1, status: 'OFFLINE', type: 'PERMANENT', imageUrl: 'cloud://img/off-r1.png' },
    { _id: 'rmv-sr1', name: '移除SR卡', rarity: 'SR', weight: 1, status: 'FORCE_REMOVED', type: 'PERMANENT', imageUrl: 'cloud://img/rmv-sr1.png' },
    { _id: 'dft-ssr1', name: '草稿SSR', rarity: 'SSR', weight: 1, status: 'DRAFT', type: 'PERMANENT', imageUrl: 'cloud://img/dft-ssr1.png' }
  ]);
  return repo;
}

function addCollection(repo, userId, cardId, count) {
  repo._addCollection({ userId, cardId, count, firstObtainedAt: new Date() });
}

test('unobtained PUBLISHED card shows masked name and no image', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1' });

  const pubN = album.items.find((i) => i.cardId === 'pub-n1');
  assert.ok(pubN);
  assert.equal(pubN.name, '???');
  assert.equal(pubN.imageUrl, null);
  assert.equal(pubN.owned, false);
});

test('obtained PUBLISHED card shows real name, image and count', async () => {
  const repo = setupRepo();
  const user = await repo.createUser('u1');
  addCollection(repo, user._id, 'pub-n1', 3);
  addCollection(repo, user._id, 'pub-r1', 1);
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1' });

  const pubN = album.items.find((i) => i.cardId === 'pub-n1');
  assert.equal(pubN.name, '普通卡A');
  assert.equal(pubN.imageUrl, 'cloud://img/pub-n1.png');
  assert.equal(pubN.owned, true);
  assert.equal(pubN.count, 3);
});

test('OFFLINE owned card still shows', async () => {
  const repo = setupRepo();
  const user = await repo.createUser('u1');
  addCollection(repo, user._id, 'off-n1', 1);
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1' });
  const offN = album.items.find((i) => i.cardId === 'off-n1');
  assert.ok(offN);
  assert.equal(offN.name, '下架N卡');
});

test('OFFLINE unobtained card does not show', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1' });
  const offR = album.items.find((i) => i.cardId === 'off-r1');
  assert.equal(offR, undefined);
});

test('FORCE_REMOVED card never shows regardless of ownership', async () => {
  const repo = setupRepo();
  const user = await repo.createUser('u1');
  addCollection(repo, user._id, 'rmv-sr1', 5);
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1' });
  const rmv = album.items.find((i) => i.cardId === 'rmv-sr1');
  assert.equal(rmv, undefined);
});

test('rarity filter returns only matching tier', async () => {
  const repo = setupRepo();
  const user = await repo.createUser('u1');
  addCollection(repo, user._id, 'pub-n1', 1);
  addCollection(repo, user._id, 'pub-r1', 1);
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1', rarityId: 'R' });
  assert.equal(album.items.length, 1);
  assert.equal(album.items[0].rarity, 'R');
  assert.equal(album.items[0].cardId, 'pub-r1');
});

test('collection progress counts are correct', async () => {
  const repo = setupRepo();
  const user = await repo.createUser('u1');
  addCollection(repo, user._id, 'pub-n1', 2);
  addCollection(repo, user._id, 'off-n1', 1);
  const service = createCatalogService({ repo });

  const album = await service.listAlbum({ openid: 'u1' });

  assert.equal(typeof album.totalCollectible, 'number');
  assert.equal(typeof album.collectedUnique, 'number');
  assert.ok(album.collectedUnique > 0);
  assert.ok(album.totalCollectible > album.collectedUnique);
});

test('album resolves OpenID to internal userId before reading collection', async () => {
  const repo = setupRepo();
  const user = await repo.createUser('openid-1');
  addCollection(repo, user._id, 'pub-n1', 2);
  const album = await createCatalogService({ repo }).listAlbum({ openid: 'openid-1' });
  const card = album.items.find((item) => item.cardId === 'pub-n1');
  assert.equal(card.owned, true);
  assert.equal(card.count, 2);
});

test('album requires a bootstrapped user', async () => {
  const repo = setupRepo();

  await assert.rejects(
    () => createCatalogService({ repo }).listAlbum({ openid: 'missing-user' }),
    (err) => err instanceof AppError && err.code === 'SESSION_NOT_READY'
  );
});
