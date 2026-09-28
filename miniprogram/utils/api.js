function callApi(action, payload = {}) {
  const startedAt = Date.now();
  return wx.cloud.callFunction({ name: 'api', data: { action, payload } })
    .then(res => {
      const result = res && res.result;
      if (!result || !result.ok) {
        const error = result && result.error;
        const err = new Error((error && error.message) || '请求失败');
        err.code = (error && error.code) || 'UNKNOWN';
        throw err;
      }
      return result.data;
    })
    .finally(() => {
      if ((action === 'bootstrap' || action === 'catalog') && typeof console !== 'undefined' && console.info) {
        console.info('[perf] api', { action, durationMs: Date.now() - startedAt });
      }
    });
}

module.exports = { callApi };
