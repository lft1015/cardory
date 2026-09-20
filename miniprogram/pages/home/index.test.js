const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pageDir = __dirname;

test('home page exposes one centered single-draw action', () => {
  const template = fs.readFileSync(path.join(pageDir, 'index.wxml'), 'utf8');
  const styles = fs.readFileSync(path.join(pageDir, 'index.wxss'), 'utf8');
  const source = fs.readFileSync(path.join(pageDir, 'index.js'), 'utf8');

  assert.match(template, /class="btn-draw btn-primary"[^>]*bindtap="onDraw"/);
  assert.match(template, />\s*抽一张\s*</);
  assert.doesNotMatch(template, /十连|onDrawTen/);
  assert.doesNotMatch(source, /onDrawTen/);
  assert.match(styles, /\.actions\s*\{[\s\S]*justify-content:\s*center/);
  assert.match(styles, /\.btn-draw\s*\{[\s\S]*width:\s*320rpx/);
});
