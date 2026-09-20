const test = require('node:test');
const assert = require('node:assert/strict');
const { drawOne, drawMany } = require('../src/domain/draw-engine');

const TEST_CONFIG = {
  tiers: [
    { id: 'N', probabilityBps: 6000, displayName: '普通' },
    { id: 'R', probabilityBps: 3000, displayName: '稀有' },
    { id: 'SR', probabilityBps: 900, displayName: '超稀有' },
    { id: 'SSR', probabilityBps: 100, displayName: '最高稀有' }
  ],
  pityLimit: 20
};

function makeCards(...specs) {
  return specs.map((s, i) => ({
    _id: 'card-' + (i + 1),
    name: 'Card ' + (i + 1),
    rarity: s.rarity,
    weight: s.weight || 1,
    status: 'PUBLISHED',
    type: 'PERMANENT'
  }));
}

const ALL_CARDS = makeCards(
  { rarity: 'N', weight: 1 },
  { rarity: 'N', weight: 3 },
  { rarity: 'N', weight: 6 },
  { rarity: 'R', weight: 1 },
  { rarity: 'R', weight: 1 },
  { rarity: 'SR', weight: 1 },
  { rarity: 'SSR', weight: 1 },
  { rarity: 'SSR', weight: 1 }
);

function fixedRandom(values) {
  let i = 0;
  return function (max) {
    const val = values[i];
    i = (i + 1) % values.length;
    return val % max;
  };
}

test('rarity probability boundaries map to correct tiers', () => {
  const config = TEST_CONFIG;
  const cards = ALL_CARDS;

  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 0 }).rarity, 'N');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 5999 }).rarity, 'N');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 6000 }).rarity, 'R');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 8999 }).rarity, 'R');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 9000 }).rarity, 'SR');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 9899 }).rarity, 'SR');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 9900 }).rarity, 'SSR');
  assert.equal(drawOne({ cards, config, pityCount: 0, randomInt: () => 9999 }).rarity, 'SSR');
});

test('weight-based card selection within same rarity', () => {
  const config = TEST_CONFIG;
  const nCards = makeCards(
    { rarity: 'N', weight: 1 },
    { rarity: 'N', weight: 3 },
    { rarity: 'N', weight: 6 }
  );

  const rng0 = () => 0;
  assert.equal(drawOne({ cards: nCards, config, pityCount: 0, randomInt: rng0 }).cardId, 'card-1');

  const rng1 = () => 1;
  assert.equal(drawOne({ cards: nCards, config, pityCount: 0, randomInt: rng1 }).cardId, 'card-2');

  const rng3 = () => 3;
  assert.equal(drawOne({ cards: nCards, config, pityCount: 0, randomInt: rng3 }).cardId, 'card-2');

  const rng4 = () => 4;
  assert.equal(drawOne({ cards: nCards, config, pityCount: 0, randomInt: rng4 }).cardId, 'card-3');

  const rng9 = () => 9;
  assert.equal(drawOne({ cards: nCards, config, pityCount: 0, randomInt: rng9 }).cardId, 'card-3');
});

test('pity count 19 with pityLimit 20 forces SSR', () => {
  const config = TEST_CONFIG;
  const cards = ALL_CARDS;

  const outcome = drawOne({
    cards,
    config,
    pityCount: 19,
    randomInt: () => 0
  });

  assert.equal(outcome.rarity, 'SSR');
  assert.equal(outcome.isPity, true);
});

test('natural SSR pull resets pity count to 0', () => {
  const config = TEST_CONFIG;
  const cards = ALL_CARDS;

  const outcome = drawOne({
    cards,
    config,
    pityCount: 5,
    randomInt: () => 9999
  });

  assert.equal(outcome.rarity, 'SSR');
  assert.equal(outcome.isPity, false);
  assert.equal(outcome.newPityCount, 0);
});

test('limited card outcome preserves its type', () => {
  const now = Date.now();
  const cards = [{
    _id: 'limited-ssr',
    name: 'Limited SSR',
    rarity: 'SSR',
    weight: 1,
    status: 'PUBLISHED',
    type: 'LIMITED',
    startsAt: new Date(now - 1000),
    endsAt: new Date(now + 1000)
  }];

  const outcome = drawOne({ cards, config: TEST_CONFIG, pityCount: 0, randomInt: () => 9999 });

  assert.equal(outcome.type, 'LIMITED');
});

test('non-SSR pull increments pity count by 1', () => {
  const config = TEST_CONFIG;
  const cards = ALL_CARDS;

  const outcome = drawOne({
    cards,
    config,
    pityCount: 5,
    randomInt: () => 0
  });

  assert.equal(outcome.rarity, 'N');
  assert.equal(outcome.newPityCount, 6);
});

test('10-draw pity triggers at 3rd pull and resets for 4th', () => {
  const config = { ...TEST_CONFIG, pityLimit: 3 };
  const cards = ALL_CARDS;

  const randomValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const rng = fixedRandom(randomValues);

  const { outcomes, finalPityCount } = drawMany({
    count: 10,
    cards,
    config,
    pityCount: 0,
    randomInt: rng
  });

  assert.equal(outcomes.length, 10);
  assert.equal(outcomes[0].rarity, 'N');
  assert.equal(outcomes[1].rarity, 'N');
  assert.equal(outcomes[2].rarity, 'SSR');
  assert.equal(outcomes[2].isPity, true);
  assert.equal(outcomes[3].rarity, 'N');
  assert.ok(finalPityCount >= 0);
});

test('10-draw pity count carries over correctly', () => {
  const config = TEST_CONFIG;
  const cards = ALL_CARDS;

  const randomValues = new Array(10).fill(0);
  const rng = fixedRandom(randomValues);

  const { finalPityCount } = drawMany({
    count: 10,
    cards,
    config,
    pityCount: 0,
    randomInt: rng
  });

  assert.equal(finalPityCount, 10);
});

test('only available cards participate in same-rarity weight selection', () => {
  const config = TEST_CONFIG;
  const cards = [
    { _id: 'n1', name: 'N1', rarity: 'N', weight: 1, status: 'PUBLISHED', type: 'PERMANENT' },
    { _id: 'n2', name: 'N2', rarity: 'N', weight: 10, status: 'DRAFT', type: 'PERMANENT' },
    { _id: 'n3', name: 'N3', rarity: 'N', weight: 1, status: 'PUBLISHED', type: 'PERMANENT' }
  ];

  const outcome = drawOne({
    cards,
    config,
    pityCount: 0,
    randomInt: () => 1
  });

  assert.equal(outcome.rarity, 'N');
  assert.equal(outcome.cardId, 'n3');
});

test('POOL_MAINTENANCE error when no cards of rolled rarity are available', () => {
  const config = TEST_CONFIG;
  const cards = makeCards(
    { rarity: 'N', weight: 1 },
    { rarity: 'R', weight: 1 },
    { rarity: 'SR', weight: 1 }
  );

  const { AppError } = require('../src/errors');

  assert.throws(
    () => drawOne({
      cards,
      config,
      pityCount: 19,
      randomInt: () => 0
    }),
    (err) => err instanceof AppError && err.code === 'POOL_MAINTENANCE'
  );
});
