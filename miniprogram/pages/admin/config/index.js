const { callApi } = require('../../../utils/api');
const app = getApp();

Page({
  data: {
    pityLimit: '20',
    tiers: [
      { id: 'N', probabilityBps: '6000' },
      { id: 'R', probabilityBps: '3000' },
      { id: 'SR', probabilityBps: '900' },
      { id: 'SSR', probabilityBps: '100' }
    ],
    saving: false,
    authorized: false
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
  },

  onSessionReady() {
    this.ensureAdmin();
  },

  onInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    if (field === 'pityLimit') return this.setData({ pityLimit: e.detail.value });
    const tiers = this.data.tiers.slice();
    tiers[index] = { ...tiers[index], probabilityBps: e.detail.value };
    this.setData({ tiers });
  },

  onPublish() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    callApi('adminPublishConfig', {
      pityLimit: Number(this.data.pityLimit),
      rarities: this.data.tiers.map(t => ({ id: t.id, probabilityBps: Number(t.probabilityBps) }))
    }).then(data => {
      wx.showToast({ title: `已发布 ${data.version}`, icon: 'success' });
    }).catch(err => wx.showToast({ title: err.message || '发布失败', icon: 'none' }))
      .finally(() => this.setData({ saving: false }));
  }
});
