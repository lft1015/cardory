const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../src/repositories/memory-repository');
const { createAdminService } = require('../src/services/admin-service');
const { AppError } = require('../src/errors');

function setup(options = {}) {
  const repo = createMemoryRepository();
  repo.addAdmin({ openid: 'admin' });
  repo.seedCards([]);
  const securityClient = { checkImage: async () => ({ passed: true, traceId: 'trace-1', reason: null }) };
  return { repo, service: createAdminService({ repo, securityClient, ...options }) };
}

test('non-admin cannot create or publish cards', async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.createCard({ openid: 'user', card: { name: 'A' } }),
    (err) => err instanceof AppError && err.code === 'FORBIDDEN'
  );
});

test('admin image upload validates and stores the image on the server', async () => {
  const image = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('card-image')
  ]);
  const { repo, service } = setup({
    imageUploader: async ({ cloudPath, fileContent }) => {
      assert.match(cloudPath, /^card-drafts\/\d{6}\/card-[a-f0-9-]+\.png$/);
      assert.deepEqual(fileContent, image);
      return { fileID: 'cloud://env/card-drafts/card.png' };
    }
  });

  const result = await service.uploadImage({ openid: 'admin', base64: image.toString('base64') });

  assert.deepEqual(result, { fileId: 'cloud://env/card-drafts/card.png' });
  assert.equal(repo.snapshot().adminLogs.at(-1).action, 'UPLOAD_IMAGE');
});

test('non-admin cannot upload an image', async () => {
  const { service } = setup({
    imageUploader: async () => assert.fail('unauthorized upload reached cloud storage')
  });

  await assert.rejects(
    () => service.uploadImage({ openid: 'user', base64: 'iVBORw0KGgo=' }),
    (err) => err instanceof AppError && err.code === 'FORBIDDEN'
  );
});

test('image upload rejects unsupported content', async () => {
  const { service } = setup({ imageUploader: async () => assert.fail('invalid image reached cloud storage') });

  await assert.rejects(
    () => service.uploadImage({ openid: 'admin', base64: Buffer.from('not-an-image').toString('base64') }),
    (err) => err instanceof AppError && err.code === 'INVALID_IMAGE'
  );
});

test('image upload rejects files larger than 500KB', async () => {
  const image = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.alloc(500 * 1024 - 2)
  ]);
  const { service } = setup({ imageUploader: async () => assert.fail('oversized image reached cloud storage') });

  await assert.rejects(
    () => service.uploadImage({ openid: 'admin', base64: image.toString('base64') }),
    (err) => err instanceof AppError && err.code === 'IMAGE_TOO_LARGE'
  );
});

test('image check then authorization confirmation makes card publishable', async () => {
  const { repo, service } = setup();
  const draft = await service.createCard({
    openid: 'admin',
    card: { name: 'A', rarity: 'N', type: 'PERMANENT', weight: 1, imageFileId: 'cloud://a' }
  });
  assert.equal(draft.status, 'DRAFT');
  const checked = await service.checkCardImage({ openid: 'admin', cardId: draft._id });
  assert.equal(checked.status, 'PENDING_CONFIRMATION');
  const confirmed = await service.confirmAuthorization({ openid: 'admin', cardId: draft._id, confirmed: true });
  assert.equal(confirmed.status, 'PUBLISHABLE');
  const published = await service.publishCard({ openid: 'admin', cardId: draft._id });
  assert.equal(published.status, 'PUBLISHED');
  assert.equal(repo.snapshot().adminLogs.length, 4);
});

test('publish validates name, rarity, weight and moderation state', async () => {
  const { service } = setup();
  const draft = await service.createCard({ openid: 'admin', card: { name: '', rarity: 'BAD', weight: 0 } });
  await assert.rejects(
    () => service.publishCard({ openid: 'admin', cardId: draft._id }),
    (err) => err instanceof AppError && err.code === 'INVALID_CARD'
  );
});

test('publishing config requires valid tiers and creates immutable version', async () => {
  const { repo, service } = setup();
  repo.seedCards([
    { _id: 'n', name: 'N', rarity: 'N', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' },
    { _id: 'r', name: 'R', rarity: 'R', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' },
    { _id: 'sr', name: 'SR', rarity: 'SR', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' },
    { _id: 'ssr', name: 'SSR', rarity: 'SSR', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' }
  ]);
  const result = await service.publishRarityConfig({
    openid: 'admin',
    rarities: [
      { id: 'N', probabilityBps: 7000, displayName: 'N' },
      { id: 'R', probabilityBps: 2000, displayName: 'R' },
      { id: 'SR', probabilityBps: 900, displayName: 'SR' },
      { id: 'SSR', probabilityBps: 100, displayName: 'SSR' }
    ],
    pityLimit: 20
  });
  assert.match(result.version, /^v/);
  assert.equal(repo.snapshot().adminLogs.length, 1);
});

test('publishing config does not require structuredClone in the cloud runtime', async () => {
  const { repo, service } = setup();
  repo.seedCards([
    { _id: 'n', rarity: 'N', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' },
    { _id: 'r', rarity: 'R', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' },
    { _id: 'sr', rarity: 'SR', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' },
    { _id: 'ssr', rarity: 'SSR', type: 'PERMANENT', weight: 1, status: 'PUBLISHED' }
  ]);
  repo.saveRarityConfig = async (config) => config;
  const originalStructuredClone = global.structuredClone;
  global.structuredClone = undefined;
  try {
    const result = await service.publishRarityConfig({
      openid: 'admin',
      rarities: [
        { id: 'N', probabilityBps: 7000 },
        { id: 'R', probabilityBps: 2000 },
        { id: 'SR', probabilityBps: 900 },
        { id: 'SSR', probabilityBps: 100 }
      ],
      pityLimit: 20
    });
    assert.deepEqual(result.tiers, [
      { id: 'N', probabilityBps: 7000 },
      { id: 'R', probabilityBps: 2000 },
      { id: 'SR', probabilityBps: 900 },
      { id: 'SSR', probabilityBps: 100 }
    ]);
  } finally {
    global.structuredClone = originalStructuredClone;
  }
});

test('force removal requires reason and hides card collections', async () => {
  const { repo, service } = setup();
  repo.seedCards([{ _id: 'c', name: 'C', rarity: 'N', status: 'PUBLISHED', type: 'PERMANENT', weight: 1 }]);
  const user = await repo.createUser('u');
  repo._addCollection({ userId: user._id, cardId: 'c', count: 1 });
  await assert.rejects(
    () => service.changeCardStatus({ openid: 'admin', cardId: 'c', action: 'FORCE_REMOVED' }),
    (err) => err instanceof AppError && err.code === 'REASON_REQUIRED'
  );
  await service.changeCardStatus({ openid: 'admin', cardId: 'c', action: 'FORCE_REMOVED', reason: '撤回授权' });
  assert.equal(repo.snapshot().collections[0].visible, false);
});

test('editing image resets moderation while metadata edit preserves it', async () => {
  const { repo, service } = setup();
  const draft = await service.createCard({
    openid: 'admin',
    card: { name: 'A', rarity: 'N', type: 'PERMANENT', weight: 1, imageUrl: 'cloud://a' }
  });
  await service.checkCardImage({ openid: 'admin', cardId: draft._id });
  await service.confirmAuthorization({ openid: 'admin', cardId: draft._id, confirmed: true });
  const metadata = await service.updateCard({ openid: 'admin', cardId: draft._id, patch: { name: 'B', weight: 2 } });
  assert.equal(metadata.securityPassed, true);
  assert.equal(metadata.status, 'PUBLISHABLE');
  const image = await service.updateCard({ openid: 'admin', cardId: draft._id, patch: { imageUrl: 'cloud://b' } });
  assert.equal(image.securityPassed, false);
  assert.equal(image.authorizationConfirmed, false);
  assert.equal(image.status, 'DRAFT');
});

test('listing cards and logs is admin-only', async () => {
  const { service } = setup();
  await assert.rejects(() => service.listCards({ openid: 'user' }), (err) => err.code === 'FORBIDDEN');
  const cards = await service.listCards({ openid: 'admin' });
  assert.deepEqual(cards, []);
  const logs = await service.listAdminLogs({ openid: 'admin' });
  assert.ok(Array.isArray(logs));
});

test('config publishing rejects a positive tier without a currently drawable card', async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.publishRarityConfig({
      openid: 'admin',
      rarities: [
        { id: 'N', probabilityBps: 7000, displayName: 'N' },
        { id: 'R', probabilityBps: 2000, displayName: 'R' },
        { id: 'SR', probabilityBps: 900, displayName: 'SR' },
        { id: 'SSR', probabilityBps: 100, displayName: 'SSR' }
      ],
      pityLimit: 20
    }),
    (err) => err.code === 'POOL_MAINTENANCE'
  );
});
