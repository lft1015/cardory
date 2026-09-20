const test = require('node:test');
const assert = require('node:assert/strict');
const { isCardDrawable } = require('../src/domain/card-state');

test('PUBLISHED permanent card is always drawable', () => {
  const card = { status: 'PUBLISHED', type: 'PERMANENT' };
  assert.equal(isCardDrawable(card, new Date('2026-01-01T00:00:00Z')), true);
  assert.equal(isCardDrawable(card, new Date('2099-12-31T23:59:59Z')), true);
});

test('PUBLISHED limited card is drawable only within [startsAt, endsAt)', () => {
  const card = {
    status: 'PUBLISHED',
    type: 'LIMITED',
    startsAt: new Date('2026-09-01T00:00:00Z'),
    endsAt: new Date('2026-09-30T23:59:59Z')
  };

  assert.equal(isCardDrawable(card, new Date('2026-08-31T23:59:59Z')), false, 'before startsAt');
  assert.equal(isCardDrawable(card, new Date('2026-09-01T00:00:00Z')), true, 'at startsAt');
  assert.equal(isCardDrawable(card, new Date('2026-09-15T12:00:00Z')), true, 'during period');
  assert.equal(isCardDrawable(card, new Date('2026-09-30T23:59:58Z')), true, 'just before endsAt');
  assert.equal(isCardDrawable(card, new Date('2026-09-30T23:59:59Z')), false, 'at endsAt');
  assert.equal(isCardDrawable(card, new Date('2026-10-01T00:00:00Z')), false, 'after endsAt');
});

test('FORCE_REMOVED card is never drawable', () => {
  const card = { status: 'FORCE_REMOVED', type: 'PERMANENT' };
  assert.equal(isCardDrawable(card, new Date()), false);
});

test('DRAFT card is never drawable', () => {
  const card = { status: 'DRAFT', type: 'PERMANENT' };
  assert.equal(isCardDrawable(card, new Date()), false);
});

test('OFFLINE card is never drawable', () => {
  const card = { status: 'OFFLINE', type: 'PERMANENT' };
  assert.equal(isCardDrawable(card, new Date()), false);
});