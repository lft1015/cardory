const test = require('node:test');
const assert = require('node:assert/strict');
const { createCloudRepository } = require('../src/repositories/cloud-repository');

function fakeDb() {
  const writes = [];
  return {
    writes,
    db: {
      collection(name) {
        return {
          doc(id) {
            return {
              async set({ data }) {
                writes.push({ name, id, data });
              }
            };
          }
        };
      }
    }
  };
}

test('cloud document IDs stay within the 32-character limit', async () => {
  const { db, writes } = fakeDb();
  const repo = createCloudRepository(db);
  const requestHash = 'a'.repeat(64);

  await repo.saveOperationRecord(requestHash, 'signIn', 'user-1', { signed: true });
  await repo.saveDrawRecord(requestHash, 'user-1', [], { results: [] });

  assert.deepEqual(writes.map((write) => write.id), ['a'.repeat(32), 'a'.repeat(32)]);
  assert.equal(writes[0].data.requestHash, requestHash);
  assert.equal(writes[1].data.drawId, requestHash);
  assert.equal('_id' in writes[0].data, false);
  assert.equal('_id' in writes[1].data, false);
});

test('saveCard does not write the reserved _id field into document data', async () => {
  const { db, writes } = fakeDb();
  const repo = createCloudRepository(db);
  const card = { _id: 'card-1', name: 'Test card', status: 'PUBLISHED' };

  await repo.saveCard(card);

  assert.equal(writes[0].id, card._id);
  assert.deepEqual(writes[0].data, { name: card.name, status: card.status });
  assert.equal('_id' in writes[0].data, false);
});

test('upsertCollection increments an existing record without relying on transaction command helpers', async () => {
  const updates = [];
  const db = {
    collection(name) {
      assert.equal(name, 'collections');
      return {
        where() {
          return {
            async get() {
              return { data: [{ _id: 'collection-1', count: 2 }] };
            }
          };
        },
        doc(id) {
          return {
            async update({ data }) {
              updates.push({ id, data });
            }
          };
        }
      };
    }
  };
  const repo = createCloudRepository(db);

  const result = await repo.upsertCollection('user-1', 'card-1');

  assert.deepEqual(result, { isNew: false, ownedCount: 3 });
  assert.deepEqual(updates, [{ id: 'collection-1', data: { count: 3 } }]);
});
