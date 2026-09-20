const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRarityConfig } = require('../src/domain/config');
const { AppError } = require('../src/errors');

test('rarity config must have exactly four tiers N/R/SR/SSR in order', () => {
  assert.throws(
    () => validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' }
    ]),
    AppError,
    '缺少档位应抛出 AppError'
  );

  assert.throws(
    () => validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 200, displayName: '最高稀有' },
      { id: 'UR', probabilityBps: 0, displayName: '额外' }
    ]),
    AppError,
    '多余的档位应抛出 AppError'
  );

  assert.throws(
    () => validateRarityConfig([
      { id: 'R', probabilityBps: 7000, displayName: '普通' },
      { id: 'N', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 200, displayName: '最高稀有' }
    ]),
    AppError,
    '顺序错误应抛出 AppError'
  );
});

test('probabilityBps must be non-negative integers summing to 10000', () => {
  assert.doesNotThrow(() =>
    validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 200, displayName: '最高稀有' }
    ])
  );

  assert.throws(
    () => validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 199, displayName: '最高稀有' }
    ]),
    AppError,
    '合计不为 10000 应抛出 AppError'
  );

  assert.throws(
    () => validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: -1, displayName: '最高稀有' }
    ]),
    AppError,
    '负数概率应抛出 AppError'
  );
});

test('pityLimit must be a positive integer', () => {
  assert.throws(
    () => validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 200, displayName: '最高稀有' }
    ], { pityLimit: 0 }),
    AppError,
    'pityLimit 为 0 应抛出 AppError'
  );

  assert.throws(
    () => validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 200, displayName: '最高稀有' }
    ], { pityLimit: -1 }),
    AppError,
    'pityLimit 为负数应抛出 AppError'
  );

  assert.doesNotThrow(() =>
    validateRarityConfig([
      { id: 'N', probabilityBps: 7000, displayName: '普通' },
      { id: 'R', probabilityBps: 2000, displayName: '稀有' },
      { id: 'SR', probabilityBps: 800, displayName: '超稀有' },
      { id: 'SSR', probabilityBps: 200, displayName: '最高稀有' }
    ], { pityLimit: 90 })
  );
});