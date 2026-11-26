const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

global.window = global;
require('../js/data.js');
const D = global.TamaData;

function localPath(reference) {
  return reference.split('?')[0].replace(/^\.\//, '');
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('✓ ' + name);
}

test('cache da PWA acompanha a versão do catálogo', () => {
  const worker = read('service-worker.js');
  const cacheName = worker.match(/const CACHE_NAME = '([^']+)'/)[1];
  assert.equal(cacheName, 'tamavida-' + D.VERSION);
  assert.match(worker, /const CACHE_VERSION = CACHE_NAME\.slice\(CACHE_PREFIX\.length\)\.replace\('v', ''\);/);
  const suffix = D.VERSION.replace('v', '');
  const htmlVersions = Array.from(read('index.html').matchAll(/\?v=(\d+)/g), (match) => match[1]);
  const workerVersions = Array.from(worker.matchAll(/\?v=(\d+)/g), (match) => match[1]);
  assert.ok(htmlVersions.length > 0);
  assert.ok(workerVersions.length > 0);
  assert.ok(htmlVersions.every((value) => value === suffix));
  assert.ok(workerVersions.every((value) => value === suffix));
});

test('todos os assets locais do HTML estão no app shell', () => {
  const html = read('index.html');
  const worker = read('service-worker.js');
  const shell = worker.match(/const APP_SHELL = \[([\s\S]*?)\];/)[1];
  const shellPaths = Array.from(shell.matchAll(/'([^']+)'/g), (match) => localPath(match[1]));
  const localRefs = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g), (match) => match[1])
    .filter((reference) => /^(?:\.\/)?(?:js\/|styles\.css|manifest\.json)/.test(reference))
    .map(localPath);
  assert.ok(localRefs.length > 0);
  localRefs.forEach((reference) => assert.ok(shellPaths.includes(reference), reference + ' ausente no APP_SHELL'));
});

test('contador inicial da coleção acompanha o catálogo', () => {
  const html = read('index.html');
  assert.ok(html.includes('id="collectionCount" class="muted">0/' + D.SPECIES.length + '<'));
});

test('APIs de UI usadas pelo app estão exportadas', () => {
  const app = read('js/app.js');
  const ui = read('js/ui.js');
  const exportBlock = ui.slice(ui.indexOf('global.TamaUI = {'));
  const used = Array.from(new Set(Array.from(app.matchAll(/UI\.([A-Za-z0-9_]+)/g), (match) => match[1])));
  assert.ok(used.length > 0);
  used.forEach((name) => assert.ok(new RegExp('\\b' + name + ':').test(exportBlock), 'UI.' + name + ' não exportada'));
});

console.log(passed + ' testes de PWA passaram.');
