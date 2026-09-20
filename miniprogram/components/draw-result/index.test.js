const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadMethods() {
  let definition;
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
  vm.runInNewContext(source, {
    Component(config) {
      definition = config;
    },
    clearTimeout,
    console,
    setTimeout
  });
  return definition.methods;
}

test('each rarity maps to a distinct reveal effect and duration', () => {
  const methods = loadMethods();
  const rarities = ['N', 'R', 'SR', 'SSR', '限定'];
  const specs = rarities.map(rarity => methods.getRevealSpec.call({ data: { isSingleDraw: true } }, rarity));

  assert.equal(new Set(specs.map(spec => spec.className)).size, rarities.length);
  assert.deepEqual(specs.map(spec => spec.className), [
    'effect-n',
    'effect-r',
    'effect-sr',
    'effect-ssr',
    'effect-limited'
  ]);
  assert.deepEqual(specs.map(spec => spec.duration), [1760, 1920, 2160, 2480, 2880]);
});

test('each rarity animates the card with a distinct motion', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');
  const rarities = ['n', 'r', 'sr', 'ssr', 'limited'];
  const durations = ['1.76s', '1.92s', '2.16s', '2.48s', '2.88s'];
  const motions = rarities.map((rarity, index) => {
    const rule = styles.match(new RegExp(`\\.effect-${rarity} \\.single-card\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `${rarity} must animate the card itself`);
    assert.match(rule[1], new RegExp(`animation:[^;]*${durations[index]}`));
    return rule[1].match(/animation:\s*([\w-]+)/)?.[1];
  });

  assert.equal(new Set(motions).size, motions.length);
});

test('limited rarity uses a safe CSS class name', () => {
  const methods = loadMethods();
  assert.equal(methods.getRarityClassName.call({}, '限定'), 'limited');
});

test('limited card type selects the limited reveal tier', () => {
  const methods = loadMethods();
  const card = { rarity: 'SSR', type: 'LIMITED' };

  assert.equal(methods.getCardRarity.call({}, card), '限定');
  assert.equal(methods.getCardRarity.call({}, { rarity: 'SSR', type: 'PERMANENT' }), 'SSR');
});

test('result component only renders the single-card flow', () => {
  const template = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

  assert.doesNotMatch(template, /grid-stage|cards-grid|十连/);
  assert.doesNotMatch(source, /revealGridNext|onGridTap/);
});

test('result visuals use the app palette instead of a separate dark theme', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');

  assert.match(styles, /var\(--color-bg\)/);
  assert.match(styles, /var\(--color-primary\)/);
  assert.match(styles, /var\(--color-n\)/);
  assert.doesNotMatch(styles, /#090d18|#070b14|#14192a/);
});

test('rarity backgrounds use distinct halo colors', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');
  const halos = {
    N: '106, 155, 91',
    R: '91, 140, 201',
    SR: '139, 92, 184',
    SSR: '201, 160, 43',
    limited: '109, 184, 125'
  };

  Object.entries(halos).forEach(([rarity, color]) => {
    const rule = styles.match(new RegExp(`\\.draw-result\\.rarity-${rarity}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `${rarity} must define its own background`);
    assert.match(rule[1], /background:\s*radial-gradient/);
    assert.match(rule[1], new RegExp(color));
    assert.ok((rule[1].match(/radial-gradient/g) || []).length >= 2);
  });
});

test('reveal overlay contains only the card and no progress copy', () => {
  const template = fs.readFileSync(path.join(__dirname, 'index.wxml'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');

  assert.doesNotMatch(template, /result-header|result-count|result-footer|1\/1|跳过动画|点击任意位置关闭/);
  assert.match(template, /bindtap="onOverlayTap"/);
  assert.match(source, /onOverlayTap\(\)/);
});

test('card rarity labels have a distinct color for every rarity', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');
  const rarities = ['N', 'R', 'SR', 'SSR', 'limited'];

  rarities.forEach(rarity => {
    assert.match(styles, new RegExp(`\\.card-rarity\\.rarity-${rarity}\\s*\\{[\\s\\S]*?background:`));
  });
});

test('card labels are larger corner badges', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');

  assert.match(styles, /\.card-meta\s*\{[^}]*left:\s*20rpx[^}]*right:\s*20rpx[^}]*top:\s*20rpx/);
  assert.match(styles, /\.card-rarity\s*\{[^}]*padding:\s*10rpx\s+18rpx[^}]*font-size:\s*24rpx[^}]*white-space:\s*nowrap/);
  assert.match(styles, /\.card-badge\s*\{[^}]*padding:\s*9rpx\s+16rpx[^}]*font-size:\s*21rpx[^}]*white-space:\s*nowrap/);
});

test('styles contain no removed reveal state', () => {
  const styles = fs.readFileSync(path.join(__dirname, 'index.wxss'), 'utf8');

  assert.doesNotMatch(styles, /has-premium|--reveal-muted/);
});
