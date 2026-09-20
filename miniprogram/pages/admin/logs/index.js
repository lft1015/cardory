const { callApi } = require('../../../utils/api');
const { statusLabel, formatDate } = require('../../../utils/format');
const app = getApp();

Page({
  data: {
    authorized: false,
    loading: true,
    logs: [],
    message: ''
  },

  onLoad() {
    if (!app.globalData.bootstrapReady) return;
    this.ensureAdmin();
  },

  ensureAdmin() {
    if (this._loaded) return;
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '无权限访问', icon: 'none' });
      wx.navigateBack({ delta: 1 });
      return;
    }
    this._loaded = true;
    this.setData({ authorized: true });
    this.fetchLogs();
  },

  onSessionReady() {
    this.ensureAdmin();
  },

  fetchLogs() {
    this.setData({ loading: true });
    callApi('adminListLogs', {})
      .then(data => {
        const logs = (data || []).map(log => ({
          action: log.action || 'UNKNOWN',
          actionLabel: this.actionLabel(log.action),
          cardId: log.cardId || '',
          detail: log.detail ? (typeof log.detail === 'string' ? log.detail : JSON.stringify(log.detail)) : '',
          time: formatDate(log.createdAt) || formatDate(log._createTime)
        }));
        this.setData({ logs, message: logs.length ? `${logs.length} 条记录` : '暂无操作日志' });
      })
      .catch(err => this.setData({ message: err.message || '加载失败' }))
      .finally(() => this.setData({ loading: false }));
  },

  onPullDownRefresh() {
    this.fetchLogs().then(() => wx.stopPullDownRefresh());
  },

  actionLabel(action) {
    const map = {
      CREATE_CARD: '创建卡牌',
      UPDATE_CARD: '修改卡牌',
      CHECK_IMAGE: '图片检测',
      CONFIRM_AUTHORIZATION: '确认授权',
      PUBLISH_CARD: '发布卡牌',
      PUBLISH_CONFIG: '发布配置',
      OFFLINE: '下架',
      FORCE_REMOVED: '强制移除'
    };
    return map[action] || action;
  }
});