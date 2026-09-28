Component({
  properties: {
    card: {
      type: Object,
      value: { cardId: '', name: '', rarity: 'N', imageUrl: '', owned: false, count: 0 }
    },
    size: {
      type: String,
      value: 'normal'
    },
    framed: {
      type: Boolean,
      value: false
    }
  },

  data: {
    imgFailed: false
  },

  observers: {
    'card.imageUrl': function (url) {
      this.setData({ imgFailed: false });
    }
  },

  methods: {
    onImageError() {
      this.setData({ imgFailed: true });
      this.triggerEvent('imageerror', { cardId: this.data.card.cardId });
    },

    onTap() {
      this.triggerEvent('tap', { card: this.data.card });
    }
  }
});
