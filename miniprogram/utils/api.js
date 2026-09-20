function callApi(action, payload = {}) {
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
    });
}

module.exports = { callApi };
