const { AppError } = require('../errors');

const FORCED_REMOVED = 'FORCE_REMOVED';

function createCatalogService({ repo, onTiming }) {
  return {
    async listAlbum({ openid, rarityId }) {
      const startedAt = Date.now();
      const lookupsStartedAt = Date.now();
      const [user, allCards] = await Promise.all([
        repo.findUserByOpenid(openid),
        repo.findAllCards()
      ]);
      const userAndCardsMs = Date.now() - lookupsStartedAt;
      if (!user) {
        throw new AppError('SESSION_NOT_READY', '会话尚未初始化');
      }
      const collectionStartedAt = Date.now();
      const userCollection = await repo.findUserCollection(user._id);
      const collectionMs = Date.now() - collectionStartedAt;
      const ownedMap = new Map();
      for (const entry of userCollection) {
        ownedMap.set(entry.cardId, entry.count);
      }

      const items = [];

      for (const card of allCards) {
        if (card.status === FORCED_REMOVED) {
          continue;
        }

        const owned = ownedMap.has(card._id);
        const isOffline = card.status === 'OFFLINE';

        if (isOffline && !owned) {
          continue;
        }

        if (rarityId && card.rarity !== rarityId) {
          continue;
        }

        if (owned) {
          items.push({
            cardId: card._id,
            name: card.name,
            rarity: card.rarity,
            imageUrl: card.imageUrl || null,
            owned: true,
            count: ownedMap.get(card._id)
          });
        } else {
          items.push({
            cardId: card._id,
            name: '???',
            rarity: card.rarity,
            imageUrl: null,
            owned: false,
            count: 0
          });
        }
      }

      const collectibleCards = allCards.filter(
        (c) => c.status === 'PUBLISHED'
      );
      const totalCollectible = rarityId
        ? collectibleCards.filter((c) => c.rarity === rarityId).length
        : collectibleCards.length;

      let collectedUnique = 0;
      for (const card of collectibleCards) {
        if (rarityId && card.rarity !== rarityId) {
          continue;
        }
        if (ownedMap.has(card._id)) {
          collectedUnique++;
        }
      }

      if (onTiming) {
        onTiming({ userAndCardsMs, collectionMs, totalMs: Date.now() - startedAt });
      }
      return { items, collectedUnique, totalCollectible };
    }
  };
}

module.exports = { createCatalogService };
