const { callApi } = require('../../../utils/api');
const { statusLabel, statusColor } = require('../../../utils/format');

const app = getApp();

Page({
  data: { items: [], loading: false, authorized: false, statusLabel, statusColor },

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
    this.fetchCards();
  },

  onSessionReady() {
    this.ensureAdmin();
  },

  fetchCards() {
    this.setData({ loading: true });
    return callApi('adminListCards', {})
      .then(data => this.setData({ items: data || [] }))
      .catch(err => wx.showToast({ title: err.message || '加载失败', icon: 'none' }))
      .finally(() => this.setData({ loading: false }));
  },

  onPullDownRefresh() {
    this.fetchCards().then(() => wx.stopPullDownRefresh());
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/admin/card-edit/index' });
  },

  onEdit(e) {
    const cardId = e.currentTarget.dataset.cardId;
    wx.navigateTo({ url: `/pages/admin/card-edit/index?cardId=${cardId}` });
  },

  onConfig() {
    wx.navigateTo({ url: '/pages/admin/config/index' });
  },

  onLogs() {
    wx.navigateTo({ url: '/pages/admin/logs/index' });
  },

  onPublish(e) {
    const cardId = e.currentTarget.dataset.cardId;
    callApi('adminPublishCard', { cardId })
      .then(() => this.fetchCards())
      .catch(err => wx.showToast({ title: err.message || '发布失败', icon: 'none' }));
  },

  onOffline(e) {
    const cardId = e.currentTarget.dataset.cardId;
    wx.showModal({
      title: '下架确认',
      content: '确定下架此卡牌？',
      success: (res) => {
        if (!res.confirm) return;
        callApi('adminChangeCardStatus', { cardId, action: 'OFFLINE' })
          .then(() => this.fetchCards())
          .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
      }
    });
  },

  onForceRemove(e) {
    const cardId = e.currentTarget.dataset.cardId;
    wx.showModal({
      title: '强制移除',
      content: '将向所有用户隐藏此卡牌',
      editable: true,
      placeholderText: '必须填写移除原因',
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) {
          if (res.confirm) wx.showToast({ title: '必须填写原因', icon: 'none' });
          return;
        }
        wx.showModal({
          title: '二次确认',
          content: '强制移除不可撤回，确定继续？',
          success: (res2) => {
            if (!res2.confirm) return;
            callApi('adminChangeCardStatus', { cardId, action: 'FORCE_REMOVED', reason: res.content.trim() })
              .then(() => this.fetchCards())
              .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
          }
        });
      }
    });
  }
});