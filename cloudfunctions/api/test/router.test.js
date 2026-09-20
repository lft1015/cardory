const test = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../src/router');
const { AppError } = require('../src/errors');

test('unknown action returns ACTION_NOT_FOUND', async () => {
  const route = createRouter({});
  const result = await route({ action: 'missing' }, {});
  assert.deepEqual(result, {
    ok: false,
    error: { code: 'ACTION_NOT_FOUND', message: '不支持的操作' },
    requestId: null
  });
});

test('known AppError returns its code and message', async () => {
  const route = createRouter({
    fail: () => {
      throw new AppError('FORBIDDEN', '无权限访问');
    }
  });
  const result = await route({ action: 'fail' }, {});
  assert.deepEqual(result, {
    ok: false,
    error: { code: 'FORBIDDEN', message: '无权限访问' },
    requestId: null
  });
});

test('unknown error returns INTERNAL_ERROR without stack', async () => {
  const route = createRouter({
    boom: () => {
      throw new Error('secret details');
    }
  });
  const result = await route({ action: 'boom' }, {});
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INTERNAL_ERROR');
  assert.equal(result.error.message, '内部错误');
  assert.equal(result.error.stack, undefined);
});

test('router echoes requestId and rate limits repeated writes', async () => {
  const route = createRouter({ draw: async () => ({ saved: true }) });
  const event = { action: 'draw', payload: { requestId: 'request-000000001' } };
  const first = await route(event, { openid: 'u1' });
  assert.equal(first.requestId, 'request-000000001');
  const retry = await route(event, { openid: 'u1' });
  assert.equal(retry.ok, true);
  const second = await route({ action: 'draw', payload: { requestId: 'request-000000002' } }, { openid: 'u1' });
  assert.equal(second.error.code, 'RATE_LIMITED');
  assert.equal(second.requestId, 'request-000000002');
});
