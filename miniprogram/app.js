const { callApi } = require('./utils/api');

App({
  globalData: {
    userId: null,
    drawCredits: 0,
    signedToday: false,
    isAdmin: false,
    bootstrapReady: false,
    bootstrapError: null
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-d8gxdl1st912fed13',
      traceUser: true
    });

    this.showPrivacyNotice();
    this.bootstrapSession().catch(() => {});
  },

  showPrivacyNotice() {
    if (typeof wx.getStorageSync !== 'function' || typeof wx.showModal !== 'function') return;
    if (wx.getStorageSync('privacyAccepted')) return;
    wx.showModal({
      title: '隐私说明',
      content: 'Cardory 仅处理微信身份标识、签到、抽卡和收藏所需数据，不采集昵称、头像、手机号或位置。',
      confirmText: '同意并继续',
      cancelText: '查看详情',
      success: ({ confirm }) => {
        if (confirm) {
          wx.setStorageSync('privacyAccepted', true);
        } else {
          wx.navigateTo({ url: '/pages/privacy/index' });
        }
      }
    });
  },

  bootstrapSession() {
    if (this._bootstrapPromise) return this._bootstrapPromise;

    this._bootstrapPromise = callApi('bootstrap', {})
      .then(data => {
        this.globalData.userId = data.userId;
        this.globalData.drawCredits = data.drawCredits;
        this.globalData.signedToday = data.signedToday;
        this.globalData.isAdmin = data.isAdmin;
        this.globalData.bootstrapReady = true;
        this.globalData.bootstrapError = null;

        getCurrentPages().forEach(page => {
          if (page.onSessionReady) page.onSessionReady();
        });
        return data;
      })
      .catch(err => {
        this.globalData.bootstrapReady = false;
        this.globalData.bootstrapError = err;
        console.error('bootstrap failed', err);
        getCurrentPages().forEach(page => {
          if (page.onSessionError) page.onSessionError(err);
        });
        throw err;
      })
      .finally(() => {
        this._bootstrapPromise = null;
      });

    return this._bootstrapPromise;
  }
});
