const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../src/repositories/memory-repository');
const { createDrawService } = require('../src/services/draw-service');
const { AppError } = require('../src/errors');

function setupRepo() {
  const repo = createMemoryRepository();
  repo.seedRarityConfig({
    tiers: [
      { id: 'N', probabilityBps: 6000, displayName: '普通' },
      { id: 'R', probabilityBps: 3000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 900, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 100, displayName: '最高稀有' }
    ],
    pityLimit: 20
  });
  repo.seedCards([
    { _id: 'n1', name: 'N1', rarity: 'N', weight: 1, status: 'PUBLISHED', type: 'PERMANENT' },
    { _id: 'r1', name: 'R1', rarity: 'R', weight: 1, status: 'PUBLISHED', type: 'PERMANENT' },
    { _id: 'sr1', name: 'SR1', rarity: 'SR', weight: 1, status: 'PUBLISHED', type: 'PERMANENT' },
    { _id: 'ssr1', name: 'SSR1', rarity: 'SSR', weight: 1, status: 'PUBLISHED', type: 'PERMANENT' }
  ]);
  return repo;
}

test('insufficient credits throws INSUFFICIENT_CREDITS', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const service = createDrawService({ repo, randomInt: () => 0 });

  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 }),
    (err) => err instanceof AppError && err.code === 'INSUFFICIENT_CREDITS'
  );
});

test('unsupported count throws INVALID_DRAW_COUNT', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const service = createDrawService({ repo, randomInt: () => 0 });

  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'request-000000001', count: 5 }),
    (err) => err instanceof AppError && err.code === 'INVALID_DRAW_COUNT'
  );
});

test('empty card pool throws POOL_MAINTENANCE', async () => {
  const repo = createMemoryRepository();
  repo.seedRarityConfig({
    tiers: [
      { id: 'N', probabilityBps: 6000, displayName: '普通' },
      { id: 'R', probabilityBps: 3000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 900, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 100, displayName: '最高稀有' }
    ],
    pityLimit: 20
  });
  repo.seedCards([]);
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 10;

  const service = createDrawService({ repo, randomInt: () => 0 });
  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 }),
    (err) => err instanceof AppError && err.code === 'POOL_MAINTENANCE'
  );
});

test('same requestId returns first result without double consumption', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 10;

  const service = createDrawService({ repo, randomInt: () => 0 });

  const first = await service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 });
  const retry = await service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 });

  assert.deepEqual(retry, first);
  assert.equal(retry.remainingCredits, 9);
});

test('single draw costs 1 credit and creates collection record', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 1;

  const service = createDrawService({ repo, randomInt: () => 5000 });

  const result = await service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 });

  assert.equal(result.remainingCredits, 0);
  assert.equal(result.results.length, 1);
  assert.equal(typeof result.results[0].cardId, 'string');
  assert.equal(typeof result.results[0].rarity, 'string');
  assert.equal(result.results[0].type, 'PERMANENT');
  assert.equal(typeof result.results[0].isNew, 'boolean');
  assert.equal(typeof result.results[0].ownedCount, 'number');

  const snapshot = repo.snapshot();
  assert.equal(snapshot.drawRecords.length, 1);
  assert.equal(snapshot.collections.length, 1);
});

test('duplicate card increases ownedCount', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 2;

  const alwaysN = () => 5000;
  const service = createDrawService({ repo, randomInt: alwaysN });

  const r1 = await service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 });
  const r2 = await service.execute({ openid: 'u1', requestId: 'request-000000002', count: 1 });

  assert.equal(r2.results[0].isNew, false);
  assert.equal(r2.results[0].ownedCount, 2);
  assert.equal(r1.results[0].cardId, r2.results[0].cardId);
});

test('10-draw costs 10 credits with 10 results in order', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 10;

  const service = createDrawService({ repo, randomInt: () => 0 });

  const result = await service.execute({ openid: 'u1', requestId: 'request-000000001', count: 10 });

  assert.equal(result.remainingCredits, 0);
  assert.equal(result.results.length, 10);
  assert.equal(result.results[9].ownedCount, 10);
  assert.equal(repo.snapshot().drawRecords.length, 1);
});

test('transaction rollback on error keeps state unchanged', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 10;
  user.pityCount = 5;

  let callCount = 0;
  const failingRandom = () => {
    callCount++;
    if (callCount === 8) {
      return 9999;
    }
    return 0;
  };

  repo.setFailOnUpsert(true);
  const service = createDrawService({ repo, randomInt: failingRandom });

  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'request-000000001', count: 10 }),
    AppError
  );

  const userAfter = await repo.findUserByOpenid('u1');
  assert.equal(userAfter.drawCredits, 10);
  assert.equal(userAfter.pityCount, 5);
  assert.equal(repo.snapshot().collections.length, 0);
  assert.equal(repo.snapshot().drawRecords.length, 0);
});

test('invalid requestId is rejected before drawing', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 1;
  const service = createDrawService({ repo, randomInt: () => 0 });
  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'short', count: 1 }),
    (err) => err instanceof AppError && err.code === 'INVALID_REQUEST_ID'
  );
});

test('missing bootstrapped user throws SESSION_NOT_READY', async () => {
  const service = createDrawService({
    repo: setupRepo(),
    randomInt: () => 0
  });

  await assert.rejects(
    () => service.execute({ openid: 'missing-user', requestId: 'request-000000001', count: 1 }),
    (err) => err instanceof AppError && err.code === 'SESSION_NOT_READY'
  );
});

test('concurrent draws cannot overspend credits', async () => {
  const repo = setupRepo();
  await repo.createUser('u1');
  const user = await repo.findUserByOpenid('u1');
  user.drawCredits = 1;
  const service = createDrawService({ repo, randomInt: () => 0 });
  const results = await Promise.allSettled([
    service.execute({ openid: 'u1', requestId: 'request-000000001', count: 1 }),
    service.execute({ openid: 'u1', requestId: 'request-000000002', count: 1 })
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'INSUFFICIENT_CREDITS');
  assert.equal((await repo.findUserByOpenid('u1')).drawCredits, 0);
});
