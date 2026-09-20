const { AppError } = require('./errors');

function createRouter(handlers) {
  const lastCalls = new Map();
  const limitedActions = new Set(['signIn', 'draw']);

  return async function route(event = {}, context = {}) {
    const action = event.action;
    const payload = event.payload || {};
    const requestId = payload.requestId || null;
    const response = (body) => ({ ...body, requestId });
    const handler = handlers[action];
    if (typeof handler !== 'function') {
      return response({
        ok: false,
        error: { code: 'ACTION_NOT_FOUND', message: '不支持的操作' }
      });
    }

    if (limitedActions.has(action) || action.startsWith('admin')) {
      const key = `${context.openid || 'anonymous'}:${action}`;
      const now = Date.now();
      const previous = lastCalls.get(key);
      if (previous && previous.requestId !== requestId && now - previous.at < 1000) {
        return response({ ok: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁' } });
      }
      lastCalls.set(key, { at: now, requestId });
    }

    try {
      const data = await handler(payload, context, event);
      return response({ ok: true, data });
    } catch (error) {
      if (error instanceof AppError) {
        return response({ ok: false, error: { code: error.code, message: error.message } });
      }
      console.error('Unhandled cloud function error', error);
      return response({ ok: false, error: { code: 'INTERNAL_ERROR', message: '内部错误' } });
    }
  };
}

module.exports = { createRouter };
