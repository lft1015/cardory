const { callApi } = require('../../utils/api');

function cacheKey(userId, rarityId) {
  return `album:v1:${userId}:${rarityId || 'all'}`;
}

function displayItems(items) {
  return items.map((item) => {
    const imageFileId = item.imageFileId || (typeof item.imageUrl === 'string' && item.imageUrl.startsWith('cloud://') ? item.imageUrl : '');
    return {
      ...item,
      imageFileId,
      imageUrl: item.imageUrl === imageFileId ? '' : (item.imageUrl || '')
    };
  });
}

function sameAlbumItems(left, right) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return other
      && item.cardId === other.cardId
      && item.name === other.name
      && item.rarity === other.rarity
      && item.imageFileId === other.imageFileId
      && item.imageUrl === other.imageUrl
      && item.owned === other.owned
      && item.count === other.count;
  });
}

function logAlbumPerformance(stage, durationMs) {
  if (typeof console !== 'undefined' && console.info) {
    console.info('[perf] album', { stage, durationMs });
  }
}

Page({
  data: {
    items: [],
    collectedUnique: 0,
    totalCollectible: 0,
    collectionPercent: 0,
    activeFilter: '',
    albumLoading: true,
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
    this._albumPageStartedAt = Date.now();
    this.tryFetchAlbum();
  },

  onShow() {
    if (this._albumLoaded) this.fetchAlbum();
    else this.tryFetchAlbum();
  },

  onSessionReady() {
    this.tryFetchAlbum();
  },

  onSessionError(err) {
    this._albumLoaded = false;
    this.setData({ albumLoading: false });
    wx.showToast({ title: err.message || '加载失败', icon: 'none' });
  },

  tryFetchAlbum() {
    if (!getApp().globalData.bootstrapReady || this._albumLoaded) return;
    this._albumLoaded = true;
    this.restoreAlbumCache(this.data.activeFilter);
    this.fetchAlbum();
  },

  onPullDownRefresh() {
    this.fetchAlbum().then(() => wx.stopPullDownRefresh());
  },

  fetchAlbum() {
    if (!getApp().globalData.bootstrapReady) return Promise.resolve();
    const { activeFilter: rarityId } = this.data;
    const requests = this._albumRequests || (this._albumRequests = new Map());
    if (requests.has(rarityId)) return requests.get(rarityId);
    if (!this._albumHasSnapshot) this.setData({ albumLoading: true });
    const startedAt = Date.now();
    // API action is named `catalog`; the service method remains `listAlbum`.
    const request = callApi('catalog', { rarityId: rarityId || undefined })
      .then(data => {
        this.saveAlbumCache(rarityId, data);
        if (this.data.activeFilter !== rarityId) return;

        const collectionPercent = data.totalCollectible
          ? Math.round(data.collectedUnique / data.totalCollectible * 100)
          : 0;
        const previousItems = new Map((this.data.items || []).map((item) => [item.cardId, item]));
        const items = displayItems(data.items).map((item) => {
          const previous = previousItems.get(item.cardId);
          return previous && previous.imageFileId === item.imageFileId && previous.imageUrl
            ? { ...item, imageUrl: previous.imageUrl }
            : item;
        });
        this._albumHasSnapshot = true;
        const unchanged = !this.data.albumLoading
          && sameAlbumItems(this.data.items || [], items)
          && this.data.collectedUnique === data.collectedUnique
          && this.data.totalCollectible === data.totalCollectible
          && this.data.collectionPercent === collectionPercent;
        if (!unchanged) {
          this.setData({
            items,
            collectedUnique: data.collectedUnique,
            totalCollectible: data.totalCollectible,
            collectionPercent
          }, () => {
            if (!this._albumFirstPaintLogged) {
              this._albumFirstPaintLogged = true;
              logAlbumPerformance('first-paint', Date.now() - this._albumPageStartedAt);
            }
          });
        }
        this._albumImageRequest = this.resolveAlbumImages(rarityId, items);
      })
      .catch(err => {
        if (this.data.activeFilter === rarityId) {
          this._albumLoaded = false;
          if (!this._albumHasSnapshot) wx.showToast({ title: err.message || '加载失败', icon: 'none' });
        }
      })
      .finally(() => {
        requests.delete(rarityId);
        if (this.data.activeFilter === rarityId && this.data.albumLoading) {
          this.setData({ albumLoading: false });
        }
      });
    requests.set(rarityId, request);
    return request;
  },

  restoreAlbumCache(rarityId) {
    const { userId } = getApp().globalData;
    if (!userId || typeof wx.getStorageSync !== 'function') return false;

    let cached;
    try {
      cached = wx.getStorageSync(cacheKey(userId, rarityId));
    } catch (error) {
      return false;
    }
    if (!cached || !Array.isArray(cached.items)) return false;

    const items = displayItems(cached.items);
    this._albumHasSnapshot = true;
    this.setData({
      items,
      collectedUnique: cached.collectedUnique,
      totalCollectible: cached.totalCollectible,
      collectionPercent: cached.totalCollectible
        ? Math.round(cached.collectedUnique / cached.totalCollectible * 100)
        : 0,
      albumLoading: false
    }, () => {
      if (!this._albumFirstPaintLogged) {
        this._albumFirstPaintLogged = true;
        logAlbumPerformance('cache-first-paint', Date.now() - this._albumPageStartedAt);
      }
    });
    this._albumImageRequest = this.resolveAlbumImages(rarityId, items);
    return true;
  },

  saveAlbumCache(rarityId, data) {
    const { userId } = getApp().globalData;
    if (!userId || typeof wx.setStorageSync !== 'function') return;
    try {
      wx.setStorageSync(cacheKey(userId, rarityId), data);
    } catch (error) {
      // A full local cache must not block the fresh catalog response.
    }
  },

  saveResolvedImages(rarityId, urls) {
    const { userId } = getApp().globalData;
    if (!userId || typeof wx.getStorageSync !== 'function' || typeof wx.setStorageSync !== 'function') return;
    try {
      const key = cacheKey(userId, rarityId);
      const cached = wx.getStorageSync(key);
      if (!cached || !Array.isArray(cached.items)) return;
      cached.items = displayItems(cached.items).map((item) => urls.has(item.imageFileId)
        ? { ...item, imageUrl: urls.get(item.imageFileId) }
        : item);
      wx.setStorageSync(key, cached);
    } catch (error) {
      // Keep rendering even if local persistence fails.
    }
  },

  resolveAlbumImages(rarityId, items, refresh = false) {
    if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return Promise.resolve();
    const fileIds = [...new Set(items
      .filter((item) => item.imageFileId && (refresh || !item.imageUrl))
      .map((item) => item.imageFileId))];
    if (!fileIds.length) return Promise.resolve();

    const requestKey = `${rarityId || 'all'}:${fileIds.slice().sort().join('|')}`;
    const requests = this._albumImageRequests || (this._albumImageRequests = new Map());
    if (requests.has(requestKey)) return requests.get(requestKey);

    const startedAt = Date.now();
    const batches = Array.from({ length: Math.ceil(fileIds.length / 50) }, (_, index) =>
      fileIds.slice(index * 50, index * 50 + 50)
    );
    const request = Promise.all(batches.map((fileList) => wx.cloud.getTempFileURL({ fileList })))
      .then((results) => {
        const urls = new Map(results.flatMap((result) =>
          (result.fileList || []).map((item) => [item.fileID, item.tempFileURL || ''])
        ));
        if (this.data.activeFilter === rarityId) {
          this.setData({ items: this.data.items.map((item) => urls.has(item.imageFileId)
            ? { ...item, imageUrl: urls.get(item.imageFileId) }
            : item) });
        }
        this.saveResolvedImages(rarityId, urls);
      })
      .catch(() => {})
      .finally(() => {
        requests.delete(requestKey);
        logAlbumPerformance('image-urls', Date.now() - startedAt);
      });
    requests.set(requestKey, request);
    return request;
  },

  onFilterTap(e) {
    const value = e.currentTarget.dataset.value;
    if (value === this.data.activeFilter) return;
    this.setData({ activeFilter: value }, () => {
      this._albumHasSnapshot = this.restoreAlbumCache(value);
      if (!this._albumHasSnapshot) {
        this.setData({ items: [], collectedUnique: 0, totalCollectible: 0, collectionPercent: 0 });
      }
      this.fetchAlbum();
    });
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

  onCardImageError(e) {
    const cardId = e.detail && e.detail.cardId;
    const index = cardId
      ? this.data.items.findIndex((item) => item.cardId === cardId)
      : Number(e.currentTarget && e.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.items[index]) return;
    const items = this.data.items.slice();
    items[index] = { ...items[index], imageUrl: '' };
    this.setData({ items }, () => {
      const item = this.data.items[index];
      if (item && item.imageFileId) {
        this._albumImageRequest = this.resolveAlbumImages(this.data.activeFilter, [item]);
      }
    });
  },

  onImageError(e) {
    this.onCardImageError(e);
  }
});
