const { AppError } = require('../errors');

const EXPECTED_IDS = ['N', 'R', 'SR', 'SSR'];

function validateRarityConfig(tiers, options = {}) {
  const { pityLimit } = options;

  if (!Array.isArray(tiers) || tiers.length !== 4) {
    throw new AppError('INVALID_RARITY_CONFIG', '稀有度配置必须包含恰好四个档位');
  }

  for (let i = 0; i < EXPECTED_IDS.length; i++) {
    if (tiers[i].id !== EXPECTED_IDS[i]) {
      throw new AppError('INVALID_RARITY_CONFIG', '稀有度档位ID必须按 N/R/SR/SSR 顺序出现');
    }
  }

  let totalBps = 0;
  for (const tier of tiers) {
    if (!Number.isInteger(tier.probabilityBps) || tier.probabilityBps < 0) {
      throw new AppError('INVALID_RARITY_CONFIG', 'probabilityBps 必须是非负整数');
    }
    totalBps += tier.probabilityBps;
  }

  if (totalBps !== 10000) {
    throw new AppError('INVALID_RARITY_CONFIG', 'probabilityBps 合计必须为 10000');
  }

  if (pityLimit !== undefined) {
    if (!Number.isInteger(pityLimit) || pityLimit <= 0) {
      throw new AppError('INVALID_RARITY_CONFIG', 'pityLimit 必须是正整数');
    }
  }
}

module.exports = { validateRarityConfig };