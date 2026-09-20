const NON_DRAWABLE_STATUSES = new Set(['FORCE_REMOVED', 'DRAFT', 'OFFLINE']);

function isCardDrawable(card, now) {
  if (NON_DRAWABLE_STATUSES.has(card.status)) {
    return false;
  }

  if (card.type === 'LIMITED') {
    return now >= card.startsAt && now < card.endsAt;
  }

  return true;
}

module.exports = { isCardDrawable };