const test = require('node:test');
const assert = require('node:assert/strict');
const { beijingDateKey } = require('../src/domain/time');

test('beijingDateKey returns YYYY-MM-DD in UTC+8', () => {
  assert.equal(beijingDateKey(new Date('2026-09-15T15:59:59Z')), '2026-09-15');
  assert.equal(beijingDateKey(new Date('2026-09-15T16:00:00Z')), '2026-09-16');
});