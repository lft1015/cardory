const { callApi } = require('../../../utils/api');
const { statusLabel, statusColor } = require('../../../utils/format');
const app = getApp();

Page({
  data: {
    editMode: false,
    statusLabel,
    statusColor,
    cardId: '',
    name: '',
    rarity: 'N',
    rarities: ['N', 'R', 'SR', 'SSR'],
    weight: '1',
    type: 'PERMANENT',
    startsAt: '',
    endsAt: '',
    imageUrl: '',
    imageFileId: '',
    status: '',
    securityPassed: false,
    authorizationConfirmed: false,
    saving: false,
    uploading: false,
    checking: false,
    authorized: false
  },

  onLoad(options) {
    if (!app.globalData.bootstrapReady) return;
    if (options.cardId) {
      this.loadCard(options.cardId);
    }
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

  loadCard(cardId) {
    callApi('adminListCards', {}).then(data => {
      const cards = data || [];
      const card = cards.find(c => c._id === cardId || c.cardId === cardId);
      if (!card) return;
      this.setData({
        editMode: true,
        cardId: card._id || card.cardId,
        name: card.name || '',
        rarity: card.rarity || 'N',
        weight: String(card.weight || 1),
        type: card.type || 'PERMANENT',
        startsAt: card.startsAt ? card.startsAt.slice(0, 16) : '',
        endsAt: card.endsAt ? card.endsAt.slice(0, 16) : '',
        imageUrl: card.imageUrl || '',
        imageFileId: card.imageFileId || '',
        status: card.status || '',
        securityPassed: card.securityPassed || false,
        authorizationConfirmed: card.authorizationConfirmed || false
      });
    }).catch(() => {});
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },

  onRarityChange(e) {
    this.setData({ rarity: ['N', 'R', 'SR', 'SSR'][Number(e.detail.value)] || 'N' });
  },

  onTypeChange(e) {
    this.setData({ type: Number(e.detail.value) === 1 ? 'LIMITED' : 'PERMANENT' });
  },

  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        this.uploadImage(tempPath);
      }
    });
  },

  uploadImage(tempPath) {
    this.setData({ uploading: true });
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: tempPath,
        quality: 70,
        success: ({ tempFilePath }) => wx.getFileSystemManager().readFile({
          filePath: tempFilePath,
          encoding: 'base64',
          success: ({ data }) => resolve(data),
          fail: reject
        }),
        fail: reject
      });
    }).then(base64 => callApi('adminUploadImage', { base64 }))
      .then(({ fileId }) => {
        this.setData({
          imageFileId: fileId,
          imageUrl: '',
          uploading: false
        });
        wx.showToast({ title: '上传成功', icon: 'success' });
      })
      .catch(err => {
        console.error('upload failed', err);
        this.setData({ uploading: false });
        wx.showToast({ title: err.message || '上传失败', icon: 'none' });
      });
  },

  onCheckImage() {
    if (this.data.checking) return;
    this.setData({ checking: true });
    callApi('adminCheckImage', { cardId: this.data.cardId })
      .then(card => {
        this.setData({
          status: card.status,
          securityPassed: card.securityPassed,
          authorizationConfirmed: card.authorizationConfirmed
        });
        wx.showToast({ title: card.securityPassed ? '检测通过' : '检测未通过', icon: card.securityPassed ? 'success' : 'none' });
      })
      .catch(err => wx.showToast({ title: err.message || '检测失败', icon: 'none' }))
      .finally(() => this.setData({ checking: false }));
  },

  onConfirmAuthorization() {
    wx.showModal({
      title: '肖像授权确认',
      content: '请确认已取得卡牌图片中人物的肖像授权。',
      success: (res) => {
        if (!res.confirm) return;
        callApi('adminConfirmAuthorization', { cardId: this.data.cardId, confirmed: true })
          .then(card => {
            this.setData({ authorizationConfirmed: card.authorizationConfirmed, status: card.status });
            wx.showToast({ title: '授权已确认', icon: 'success' });
          })
          .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
      }
    });
  },

  onSave() {
    if (this.data.saving) return;
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请填写卡牌名称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });

    const cardPayload = {
      name: this.data.name.trim(),
      rarity: this.data.rarity,
      weight: Number(this.data.weight) || 1,
      type: this.data.type,
      startsAt: this.data.type === 'LIMITED' ? (this.data.startsAt || null) : null,
      endsAt: this.data.type === 'LIMITED' ? (this.data.endsAt || null) : null
    };

    if (this.data.imageFileId) {
      cardPayload.imageFileId = this.data.imageFileId;
      cardPayload.imageUrl = this.data.imageFileId;
    } else if (this.data.imageUrl) {
      cardPayload.imageUrl = this.data.imageUrl;
    }

    let apiCall;
    if (this.data.editMode) {
      apiCall = callApi('adminUpdateCard', { cardId: this.data.cardId, patch: cardPayload });
    } else {
      apiCall = callApi('adminCreateCard', { card: cardPayload });
    }

    apiCall.then(card => {
      this.setData({
        editMode: true,
        cardId: card._id || card.cardId,
        status: card.status,
        securityPassed: card.securityPassed,
        authorizationConfirmed: card.authorizationConfirmed,
        imageUrl: card.imageUrl || this.data.imageUrl
      });
      wx.showToast({ title: '已保存', icon: 'success' });
    }).catch(err => wx.showToast({ title: err.message || '保存失败', icon: 'none' }))
      .finally(() => this.setData({ saving: false }));
  },

  onPublish() {
    callApi('adminPublishCard', { cardId: this.data.cardId })
      .then(card => {
        this.setData({ status: card.status });
        wx.showToast({ title: '已发布上架', icon: 'success' });
        setTimeout(() => wx.navigateBack({ delta: 1 }), 600);
      })
      .catch(err => wx.showToast({ title: err.message || '发布失败', icon: 'none' }));
  },

  onOffline() {
    wx.showModal({
      title: '下架确认',
      content: '确定下架此卡牌？已拥有用户不受影响。',
      success: (res) => {
        if (!res.confirm) return;
        callApi('adminChangeCardStatus', { cardId: this.data.cardId, action: 'OFFLINE' })
          .then(card => {
            this.setData({ status: card.status });
            wx.showToast({ title: '已下架', icon: 'success' });
          })
          .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
      }
    });
  },

  onForceRemove() {
    wx.showModal({
      title: '强制移除',
      content: '此操作将向所有用户隐藏此卡牌。',
      editable: true,
      placeholderText: '请输入移除原因（必填）',
      success: (res) => {
        if (!res.confirm || !res.content || !res.content.trim()) {
          if (res.confirm) wx.showToast({ title: '必须填写原因', icon: 'none' });
          return;
        }
        wx.showModal({
          title: '二次确认',
          content: '强制移除后不可撤回，确定继续？',
          success: (res2) => {
            if (!res2.confirm) return;
            callApi('adminChangeCardStatus', { cardId: this.data.cardId, action: 'FORCE_REMOVED', reason: res.content.trim() })
              .then(card => {
                this.setData({ status: card.status });
                wx.showToast({ title: '已强制移除', icon: 'success' });
                setTimeout(() => wx.navigateBack({ delta: 1 }), 600);
              })
              .catch(err => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
          }
        });
      }
    });
  }
});
