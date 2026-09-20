Page({
  data: {
    name: '',
    rarity: '',
    imageUrl: '',
    count: 0
  },

  onLoad(options) {
    this.setData({
      name: decodeURIComponent(options.name || ''),
      rarity: options.rarity || '',
      imageUrl: decodeURIComponent(options.imageUrl || ''),
      count: Number(options.count) || 0
    });
  },

  onImageError() {
    this.setData({ imageUrl: '' });
  }
});
