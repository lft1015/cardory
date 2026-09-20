const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('../src/repositories/memory-repository');
const { createBootstrapService } = require('../src/services/bootstrap-service');

test('new user starts with zero credits and zero pity', async () => {
  const repo = createMemoryRepository();
  const service = createBootstrapService({ repo, now: () => new Date('2026-09-16T02:00:00Z') });
  const session = await service.execute({ openid: 'user-a' });

  assert.equal(session.drawCredits, 0);
  assert.equal(session.signedToday, false);
  assert.equal(session.isAdmin, false);
  assert.ok(typeof session.userId === 'string');
  assert.ok(session.userId.length > 0);

  const snapshot = repo.snapshot();
  assert.equal(snapshot.users.length, 1);
  assert.equal(snapshot.users[0].openid, 'user-a');
  assert.equal(snapshot.users[0].pityCount, 0);
  assert.equal(snapshot.users[0].drawCredits, 0);
});

test('same OpenID returns existing user without creating duplicate', async () => {
  const repo = createMemoryRepository();
  const service = createBootstrapService({ repo, now: () => new Date('2026-09-16T02:00:00Z') });

  const session1 = await service.execute({ openid: 'user-b' });
  const session2 = await service.execute({ openid: 'user-b' });

  assert.equal(session1.userId, session2.userId);
  assert.equal(repo.snapshot().users.length, 1);
});

test('admin OpenID returns isAdmin true', async () => {
  const repo = createMemoryRepository();
  repo.addAdmin({ openid: 'admin-001' });
  const service = createBootstrapService({ repo, now: () => new Date('2026-09-16T02:00:00Z') });

  const adminSession = await service.execute({ openid: 'admin-001' });
  assert.equal(adminSession.isAdmin, true);

  const normalSession = await service.execute({ openid: 'normal-001' });
  assert.equal(normalSession.isAdmin, false);
});