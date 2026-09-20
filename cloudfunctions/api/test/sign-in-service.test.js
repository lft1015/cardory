const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../src/repositories/memory-repository');
const { createSignInService, validateRequestId } = require('../src/services/sign-in-service');
const { AppError } = require('../src/errors');

test('first sign-in gives 1 credit', async () => {
  const repo = createMemoryRepository();
  await repo.createUser('u1');
  const service = createSignInService({
    repo,
    now: () => new Date('2026-09-16T02:00:00Z')
  });

  const result = await service.execute({ openid: 'u1', requestId: 'request-000000001' });
  assert.deepEqual(result, {
    signed: true,
    drawCredits: 1,
    dateKey: '2026-09-16'
  });
});

test('second sign-in on same day does not increase credits', async () => {
  const repo = createMemoryRepository();
  await repo.createUser('u1');
  const service = createSignInService({
    repo,
    now: () => new Date('2026-09-16T02:00:00Z')
  });

  await service.execute({ openid: 'u1', requestId: 'request-000000001' });
  const result = await service.execute({ openid: 'u1', requestId: 'request-000000002' });

  assert.equal(result.signed, false);
  assert.equal(result.drawCredits, 1);
  assert.equal(result.dateKey, '2026-09-16');
});

test('cross-day sign-in adds another credit', async () => {
  const repo = createMemoryRepository();
  await repo.createUser('u1');
  const day1 = createSignInService({
    repo,
    now: () => new Date('2026-09-16T02:00:00Z')
  });
  const day2 = createSignInService({
    repo,
    now: () => new Date('2026-09-17T02:00:00Z')
  });

  const r1 = await day1.execute({ openid: 'u1', requestId: 'request-000000001' });
  assert.equal(r1.signed, true);
  assert.equal(r1.drawCredits, 1);

  const r2 = await day2.execute({ openid: 'u1', requestId: 'request-000000002' });
  assert.equal(r2.signed, true);
  assert.equal(r2.drawCredits, 2);
  assert.equal(r2.dateKey, '2026-09-17');
});

test('same requestId retry returns first result without double credit', async () => {
  const repo = createMemoryRepository();
  await repo.createUser('u1');
  const service = createSignInService({
    repo,
    now: () => new Date('2026-09-16T02:00:00Z')
  });

  const first = await service.execute({ openid: 'u1', requestId: 'request-000000001' });
  const retry = await service.execute({ openid: 'u1', requestId: 'request-000000001' });

  assert.deepEqual(retry, first);
  assert.equal(retry.drawCredits, 1);
});

test('invalid requestId throws INVALID_REQUEST_ID', async () => {
  const repo = createMemoryRepository();
  await repo.createUser('u1');
  const service = createSignInService({
    repo,
    now: () => new Date('2026-09-16T02:00:00Z')
  });

  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'short' }),
    (err) => err instanceof AppError && err.code === 'INVALID_REQUEST_ID'
  );

  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'invalid@#$request-id-with-special-chars' }),
    (err) => err instanceof AppError && err.code === 'INVALID_REQUEST_ID'
  );
});

test('missing bootstrapped user throws SESSION_NOT_READY', async () => {
  const service = createSignInService({
    repo: createMemoryRepository(),
    now: () => new Date('2026-09-16T02:00:00Z')
  });

  await assert.rejects(
    () => service.execute({ openid: 'u1', requestId: 'request-000000001' }),
    (err) => err instanceof AppError && err.code === 'SESSION_NOT_READY'
  );
});

test('concurrent same requestId returns one identical idempotent result', async () => {
  const repo = createMemoryRepository();
  await repo.createUser('u1');
  const service = createSignInService({
    repo,
    now: () => new Date('2026-09-16T02:00:00Z')
  });

  const results = await Promise.all([
    service.execute({ openid: 'u1', requestId: 'request-000000001' }),
    service.execute({ openid: 'u1', requestId: 'request-000000001' })
  ]);

  assert.deepEqual(results[1], results[0]);
  assert.equal(repo.snapshot().operationRecords.length, 1);
  assert.equal((await repo.findUserByOpenid('u1')).drawCredits, 1);
});
