const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPage(result) {
  let definition;
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  vm.runInNewContext(source, {
    Page(config) {
      definition = config;
    },
    require() {
      return { callApi: () => Promise.resolve(result) };
    },
    getApp() {
      return { globalData: { bootstrapReady: true } };
    },
    wx: { showToast() {} }
  });
  return definition;
}

test('album derives a display percentage from collection progress', async () => {
  const page = loadPage({ items: [], collectedUnique: 3, totalCollectible: 4 });
  const context = {
    data: { activeFilter: '' },
    setData(values) {
      Object.assign(this.data, values);
    }
  };

  await page.fetchAlbum.call(context);

  assert.equal(context.data.collectionPercent, 75);
});
