const { AppError } = require('../errors');

const FORCED_REMOVED = 'FORCE_REMOVED';

function createCatalogService({ repo }) {
  return {
    async listAlbum({ openid, rarityId }) {
      const user = await repo.findUserByOpenid(openid);
      if (!user) {
        throw new AppError('SESSION_NOT_READY', '会话尚未初始化');
      }
      const allCards = await repo.findAllCards();
      const userCollection = await repo.findUserCollection(user._id);
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
            imageUrl: repo.getPublicImageUrl ? await repo.getPublicImageUrl(card.imageUrl) : (card.imageUrl || null),
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

      return { items, collectedUnique, totalCollectible };
    }
  };
}

module.exports = { createCatalogService };
