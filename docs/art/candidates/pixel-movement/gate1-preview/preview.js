const root = new URL('/docs/art/candidates/pixel-movement/gate1-assets/', window.location.origin);
const canvas = document.querySelector('#farm-preview');
const context = canvas.getContext('2d', { alpha: false });
const buttons = [...document.querySelectorAll('[data-candidate]')];
const scaleSelect = document.querySelector('#display-scale');
const errorMessage = document.querySelector('#error-message');
const info = {
  kicker: document.querySelector('#candidate-kicker'),
  title: document.querySelector('#candidate-title'),
  badge: document.querySelector('#grid-badge'),
  caption: document.querySelector('#candidate-caption'),
  provenance: document.querySelector('#provenance'),
};
const scene = {
  width: 12,
  height: 10,
  placements: [
    { key: 'houseEdge', x: 0, y: 0 }, { key: 'houseEdge', x: 1, y: 0 }, { key: 'houseEdge', x: 2, y: 0 },
    { key: 'houseEdge', x: 0, y: 1 }, { key: 'houseEdge', x: 1, y: 1 }, { key: 'houseEdge', x: 2, y: 1 },
    ...Array.from({ length: 6 }, (_, i) => ({ key: 'fence', x: 5 + i, y: 1 })),
    { key: 'tree', x: 9, y: 1 }, { key: 'tree', x: 10, y: 1 }, { key: 'tree', x: 9, y: 2 }, { key: 'tree', x: 10, y: 2 },
    ...Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => ({ key: 'tilled', x: 1 + x, y: 3 + y }))).flat(),
    { key: 'cropSeed', x: 1, y: 3 }, { key: 'cropSprout', x: 2, y: 3 }, { key: 'cropMature', x: 3, y: 3 },
    { key: 'cropSeed', x: 1, y: 4 }, { key: 'cropSprout', x: 2, y: 4 }, { key: 'cropMature', x: 3, y: 4 },
    ...Array.from({ length: 12 }, (_, x) => ({ key: 'road', x, y: 8 })),
  ],
  actors: [
    { key: 'cat', x: 6, y: 6 }, { key: 'quokka', x: 7, y: 6 }, { key: 'playerIdle', x: 5, y: 6 },
  ],
};
let manifest;
let active = 'legacy';
const loadedAtlases = new Map();
const legacyReference = new Image();
legacyReference.src = '../legacy-390x844.png';

function frameFor(candidate, key) {
  return candidate.frames?.[key] ?? null;
}

function imageFor(candidate) {
  const src = new URL(candidate.atlas, root).href;
  if (!loadedAtlases.has(src)) {
    const image = new Image();
    image.src = src;
    loadedAtlases.set(src, image);
  }
  return loadedAtlases.get(src);
}

function drawFrame(candidate, key, x, y, options = {}) {
  const frame = frameFor(candidate, key);
  const image = imageFor(candidate);
  if (!frame || !image.complete || image.naturalWidth === 0) return false;
  const tile = candidate.tileSize;
  const scale = 32 / tile;
  const width = frame.width ?? tile;
  const height = frame.height ?? tile;
  const foot = frame.footAnchor ?? { x: width / 2, y: height };
  const isTile = frame.kind === 'tile' || frame.kind === 'tileOverlay';
  const dx = isTile || options.centerX === false ? x * 32 : x * 32 + 16 - foot.x * scale;
  const dy = isTile || options.bottomY === false ? y * 32 : (y + 1) * 32 - foot.y * scale;
  context.drawImage(image, frame.x, frame.y, width, height, Math.round(dx), Math.round(dy), width * scale, height * scale);
  return true;
}

function drawCandidate(candidate) {
  const tile = candidate.tileSize;
  canvas.width = scene.width * 32;
  canvas.height = scene.height * 32;
  context.imageSmoothingEnabled = false;
  context.fillStyle = candidate.background ?? '#78975d';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let renderedFrames = 0;
  for (let y = 0; y < scene.height; y += 1) {
    for (let x = 0; x < scene.width; x += 1) if (drawFrame(candidate, 'grass', x, y)) renderedFrames += 1;
  }
  for (const item of scene.placements) if (drawFrame(candidate, item.key, item.x, item.y)) renderedFrames += 1;
  for (const actor of scene.actors) if (drawFrame(candidate, 'shadow', actor.x, actor.y)) renderedFrames += 1;
  for (const actor of scene.actors) if (drawFrame(candidate, actor.key, actor.x, actor.y)) renderedFrames += 1;
  if (drawFrame(candidate, 'tool', 5, 5)) renderedFrames += 1;
  canvas.dataset.candidate = candidate.id;
  canvas.dataset.nativeTileSize = String(tile);
  canvas.dataset.sceneWidth = String(scene.width);
  canvas.dataset.sceneHeight = String(scene.height);
  canvas.dataset.renderedFrameCount = String(renderedFrames);
}

function drawLegacy() {
  canvas.width = legacyReference.naturalWidth;
  canvas.height = legacyReference.naturalHeight;
  context.imageSmoothingEnabled = false;
  context.drawImage(legacyReference, 0, 0);
  canvas.dataset.candidate = 'legacy';
  canvas.style.width = `${canvas.width * Number(scaleSelect.value)}px`;
}

function render() {
  const scale = Number(scaleSelect.value);
  if (!manifest) return;
  const candidate = manifest?.candidates?.find((entry) => entry.id === active);
  const labels = {
    legacy: { kicker: '現況參考', title: 'Legacy', badge: '390 × 844 截圖', caption: '現行遊戲截圖，供素材比例參考；它與 A/B 樣張不是同一個遊戲場景。' },
    '8bit': { kicker: '候選 A', title: '8-bit 時代風格', badge: '原生 16 × 16', caption: '同一個固定 12 × 10 合成場景，以原生 16 × 16 圖塊製作並等比放大。' },
    '16bit': { kicker: '候選 B', title: '16-bit 時代風格', badge: '原生 32 × 32', caption: '同一個固定 12 × 10 合成場景，以原生 32 × 32 圖塊製作。' },
  };
  const label = labels[active];
  info.kicker.textContent = label.kicker;
  info.title.textContent = label.title;
  info.badge.textContent = label.badge;
  info.caption.textContent = label.caption;
  if (active === 'legacy') drawLegacy();
  else if (candidate) drawCandidate(candidate);
  else showError(`候選素材清單沒有 ${active}。`);
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
}

function showError(message) {
  errorMessage.hidden = false;
  errorMessage.textContent = message;
}

buttons.forEach((button) => button.addEventListener('click', () => {
  active = button.dataset.candidate;
  buttons.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  errorMessage.hidden = true;
  render();
}));
scaleSelect.addEventListener('change', render);

try {
  const response = await fetch(new URL('manifest.json', root));
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  manifest = await response.json();
  if (manifest.status !== 'candidate') throw new Error('候選清單狀態不是 candidate，拒絕載入。');
  info.provenance.textContent = `來源狀態：${manifest.status}。候選僅供審閱；SHA-256／來源記錄見素材清單。`;
  for (const candidate of manifest.candidates ?? []) {
    const image = imageFor(candidate);
    image.addEventListener('error', () => showError(`無法載入 ${candidate.id} atlas。`));
  }
  await Promise.all([
    ...manifest.candidates.map((candidate) => imageFor(candidate).decode()),
    legacyReference.decode(),
  ]);
  render();
} catch (error) {
  const manifestUrl = new URL('manifest.json', root).href;
  showError(`候選載入失敗（${manifestUrl}）：${error instanceof Error ? error.message : String(error)}`);
  info.provenance.textContent = `候選素材尚未就緒：${manifestUrl}`;
}
