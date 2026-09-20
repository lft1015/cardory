const { callApi } = require('../../utils/api');

Page({
  data: {
    items: [],
    collectedUnique: 0,
    totalCollectible: 0,
    collectionPercent: 0,
    activeFilter: '',
    selectedCard: null,
    filters: [
      { label: '全部', value: '' },
      { label: 'N', value: 'N' },
      { label: 'R', value: 'R' },
      { label: 'SR', value: 'SR' },
      { label: 'SSR', value: 'SSR' }
    ]
  },

  onLoad() {
    this.tryFetchAlbum();
  },

  onShow() {
    this.tryFetchAlbum();
  },

  onSessionReady() {
    this.tryFetchAlbum();
  },

  tryFetchAlbum() {
    if (!getApp().globalData.bootstrapReady || this._albumLoaded) return;
    this._albumLoaded = true;
    this.fetchAlbum();
  },

  onPullDownRefresh() {
    this.fetchAlbum().then(() => wx.stopPullDownRefresh());
  },

  fetchAlbum() {
    if (!getApp().globalData.bootstrapReady) return Promise.resolve();
    const { activeFilter: rarityId } = this.data;
    // API action is named `catalog`; the service method remains `listAlbum`.
    return callApi('catalog', { rarityId: rarityId || undefined })
      .then(data => {
        const collectionPercent = data.totalCollectible
          ? Math.round(data.collectedUnique / data.totalCollectible * 100)
          : 0;
        this.setData({
          items: data.items,
          collectedUnique: data.collectedUnique,
          totalCollectible: data.totalCollectible,
          collectionPercent
        });
      })
      .catch(err => {
        this._albumLoaded = false;
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },

  onFilterTap(e) {
    const value = e.currentTarget.dataset.value;
    if (value === this.data.activeFilter) return;
    this.setData({ activeFilter: value }, () => this.fetchAlbum());
  },

  onCardTap(e) {
    const card = e.detail && e.detail.card ? e.detail.card : null;
    if (!card || !card.owned) return;
    this.setData({ selectedCard: card });
  },

  closeCardDetail() {
    this.setData({ selectedCard: null });
  },

  noop() {},

  onDetailImageError() {
    const card = this.data.selectedCard;
    if (card) this.setData({ selectedCard: { ...card, imageUrl: '' } });
  },

  onImageError(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.items[index]) return;
    const items = this.data.items.slice();
    items[index] = { ...items[index], imageUrl: '' };
    this.setData({ items });
  }
});
