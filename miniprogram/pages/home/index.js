const { callApi } = require('../../utils/api');
const { createRequestId } = require('../../utils/request-id');

const app = getApp();

Page({
  data: {
    drawCredits: 0,
    signedToday: false,
    isAdmin: false,
    sessionReady: false,
    sessionError: '',
    signInStatus: 'idle',
    drawLoading: false,
    drawResults: [],
    showResult: false
  },

  onLoad() {
    if (app.globalData.bootstrapReady) {
      this.syncSession();
    } else if (app.globalData.bootstrapError) {
      this.onSessionError(app.globalData.bootstrapError);
    }
  },

  onShow() {
    if (app.globalData.bootstrapReady) {
      this.syncSession();
    } else if (app.globalData.bootstrapError) {
      this.onSessionError(app.globalData.bootstrapError);
    }
  },

  onSessionReady() {
    this.syncSession();
  },

  syncSession() {
    this.setData({
      drawCredits: app.globalData.drawCredits,
      signedToday: app.globalData.signedToday,
      isAdmin: app.globalData.isAdmin,
      sessionReady: app.globalData.bootstrapReady,
      sessionError: ''
    });
  },

  onSessionError(err) {
    this.setData({
      sessionReady: false,
      sessionError: (err && err.message) || '初始化失败，请点击重试'
    });
  },

  onSignIn() {
    if (!app.globalData.bootstrapReady || this.data.signInStatus === 'loading' || this.data.signedToday) {
      if (!app.globalData.bootstrapReady) {
        app.bootstrapSession().catch(() => {});
        wx.showToast({ title: '正在初始化', icon: 'none' });
      }
      return;
    }

    this.setData({ signInStatus: 'loading' });

    const requestId = createRequestId();

    callApi('signIn', { requestId })
      .then(data => {
        app.globalData.drawCredits = data.drawCredits;
        app.globalData.signedToday = data.signed;
        this.setData({
          drawCredits: data.drawCredits,
          signedToday: data.signed,
          signInStatus: 'done'
        });
        if (data.signed) {
          wx.showToast({ title: '+1', icon: 'success', duration: 1200 });
        }
      })
      .catch(err => {
        console.error('signIn failed', err);
        this.setData({ signInStatus: 'error' });
        wx.showToast({ title: err.message || '签到失败', icon: 'none' });
      });
  },

  onDraw() {
    this.startDraw();
  },

  startDraw() {
    if (!app.globalData.bootstrapReady || this.data.drawLoading) {
      if (!app.globalData.bootstrapReady) {
        app.bootstrapSession().catch(() => {});
        wx.showToast({ title: '正在初始化', icon: 'none' });
      }
      return;
    }
    if (this.data.drawCredits < 1) {
      wx.showToast({ title: '抽卡次数不足', icon: 'none' });
      return;
    }

    const requestId = createRequestId();
    this.setData({ drawLoading: true });

    callApi('draw', { requestId, count: 1 })
      .then(data => {
        app.globalData.drawCredits = data.remainingCredits;
        this.setData({
          drawCredits: data.remainingCredits,
          drawLoading: false,
          drawResults: data.results,
          showResult: true
        });
      })
      .catch(err => {
        console.error('draw failed', err);
        this.setData({ drawLoading: false });
        wx.showToast({ title: err.message || '抽卡失败', icon: 'none' });
      });
  },

  onCloseResult() {
    this.setData({ showResult: false, drawResults: [] });
  },

  onGoAlbum() {
    if (!app.globalData.bootstrapReady) {
      app.bootstrapSession().catch(() => {});
      wx.showToast({ title: '正在初始化', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/album/index' });
  },

  onGoPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index' });
  },

  onGoAdmin() {
    if (!this.data.isAdmin) return;
    wx.navigateTo({ url: '/pages/admin/cards/index' });
  }
});
