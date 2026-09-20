const RARITY_SPECS = Object.freeze({
  N: { className: 'effect-n', duration: 1760 },
  R: { className: 'effect-r', duration: 1920 },
  SR: { className: 'effect-sr', duration: 2160 },
  SSR: { className: 'effect-ssr', duration: 2480 },
  限定: { className: 'effect-limited', duration: 2880 }
});

const RARITY_CLASSES = Object.freeze({
  N: 'N',
  R: 'R',
  SR: 'SR',
  SSR: 'SSR',
  限定: 'limited'
});

Component({
  properties: {
    results: {
      type: Array,
      value: []
    }
  },

  data: {
    phase: 'idle',
    currentCard: null,
    currentRarityClass: '',
    activeEffectClass: '',
    flipping: false
  },

  observers: {
    results(results) {
      if (results && results.length) this.startReveal(results);
    }
  },

  methods: {
    getRarityClassName(rarity) {
      return RARITY_CLASSES[rarity] || 'N';
    },

    getCardRarity(card) {
      return card.type === 'LIMITED' ? '限定' : card.rarity;
    },

    getRevealSpec(rarity) {
      return RARITY_SPECS[rarity] || RARITY_SPECS.N;
    },

    startReveal(results) {
      this.clearTimers();
      const card = results && results[0];
      if (!card) return;
      const rarity = this.getCardRarity(card);
      const rarityClass = this.getRarityClassName(rarity);
      const spec = this.getRevealSpec(rarity);

      this.setData({
        phase: 'revealing',
        currentCard: rarity === card.rarity ? card : { ...card, rarity },
        currentRarityClass: rarityClass,
        activeEffectClass: spec.className,
        flipping: true
      });

      this.schedule(() => this.finishReveal(), spec.duration);
    },

    finishReveal() {
      if (this.data.phase !== 'revealing') return;
      this.setData({ phase: 'revealed', flipping: false });
    },

    onSkip() {
      if (this.data.phase !== 'revealing') return;
      this.clearTimers();
      this.setData({
        phase: 'revealed',
        flipping: false
      });
    },

    onOverlayTap() {
      if (this.data.phase === 'revealing') return this.onSkip();
      if (this.data.phase === 'revealed') this.onClose();
    },

    onClose() {
      if (this.data.phase !== 'revealed') return;
      this.clearTimers();
      this.triggerEvent('close');
      this.setData({
        phase: 'idle',
        currentCard: null,
        currentRarityClass: '',
        activeEffectClass: '',
        flipping: false
      });
    },

    onImageError(event) {
      console.warn('图片加载失败:', event.detail);
    },

    schedule(callback, delay) {
      const timer = setTimeout(() => {
        this._timers = (this._timers || []).filter(item => item !== timer);
        callback();
      }, delay);
      this._timers = (this._timers || []).concat(timer);
    },

    clearTimers() {
      (this._timers || []).forEach(timer => clearTimeout(timer));
      this._timers = [];
    }
  },

  lifetimes: {
    detached() {
      this.clearTimers();
    }
  }
});
