const { AppError } = require('../errors');
const { isCardDrawable } = require('./card-state');

function pickByWeight(items, weightFn, randomInt) {
  const totalWeight = items.reduce((sum, item) => sum + weightFn(item), 0);
  if (totalWeight === 0) {
    return null;
  }
  let roll = randomInt(totalWeight);
  for (const item of items) {
    const w = weightFn(item);
    if (roll < w) {
      return item;
    }
    roll -= w;
  }
  return items[items.length - 1];
}

function drawOne({ cards, config, pityCount, randomInt }) {
  const now = new Date();
  const drawableCards = cards.filter((c) => isCardDrawable(c, now));
  const pityLimit = config.pityLimit;

  let rarity;
  let isPity = false;

  if (pityLimit && pityCount + 1 >= pityLimit) {
    rarity = 'SSR';
    isPity = true;
  } else {
    const roll = randomInt(10000);
    let cumulative = 0;
    for (const tier of config.tiers) {
      cumulative += tier.probabilityBps;
      if (roll < cumulative) {
        rarity = tier.id;
        break;
      }
    }
  }

  const sameRarityCards = drawableCards.filter((c) => c.rarity === rarity);
  if (sameRarityCards.length === 0) {
    throw new AppError('POOL_MAINTENANCE', '当前稀有度无可用卡牌');
  }

  const picked = pickByWeight(sameRarityCards, (c) => c.weight || 1, randomInt);

  const isSSR = rarity === 'SSR';
  const newPityCount = isSSR ? 0 : pityCount + 1;

  return {
    rarity,
    type: picked.type,
    cardId: picked._id,
    cardName: picked.name,
    imageUrl: picked.imageUrl || '',
    isPity,
    newPityCount
  };
}

function drawMany({ count, cards, config, pityCount, randomInt }) {
  const outcomes = [];
  let currentPity = pityCount;

  for (let i = 0; i < count; i++) {
    const outcome = drawOne({
      cards,
      config,
      pityCount: currentPity,
      randomInt
    });
    outcomes.push(outcome);
    currentPity = outcome.newPityCount;
  }

  return { outcomes, finalPityCount: currentPity };
}

module.exports = { drawOne, drawMany };
