const root = new URL('/docs/art/candidates/pixel-movement/gate1-assets/', window.location.origin);
const canvas = document.querySelector('#farm-preview');
const context = canvas.getContext('2d', { alpha: false });
const buttons = [...document.querySelectorAll('[data-candidate]')];
const scaleSelect = document.querySelector('#display-scale');
const errorMessage = document.querySelector('#error-message');
const info = {
  pageTitle: document.querySelector('#page-title'),
  pageLede: document.querySelector('#page-lede'),
  kicker: document.querySelector('#candidate-kicker'),
  title: document.querySelector('#candidate-title'),
  badge: document.querySelector('#grid-badge'),
  caption: document.querySelector('#candidate-caption'),
  provenance: document.querySelector('#provenance'),
};
const sceneNotes = {
  kicker: document.querySelector('#scene-notes-kicker'),
  title: document.querySelector('#scene-notes-title'),
  list: document.querySelector('#scene-notes-list'),
  comparisonHeading: document.querySelector('#comparison-heading'),
  comparisonCopy: document.querySelector('#comparison-copy'),
  limitationHeading: document.querySelector('#limitation-heading'),
  limitationCopy: document.querySelector('#limitation-copy'),
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
let pixel32MapManifest;
let pixel32MapAtlas;
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

function drawPixel32OverlayScene() {
  const tileSize = 32;
  canvas.width = scene.width * tileSize;
  canvas.height = scene.height * tileSize;
  context.imageSmoothingEnabled = false;
  const frames = pixel32MapManifest.frames;
  const drawTile = (key, x, y) => {
    const frame = frames[key];
    if (!frame) throw new Error(`pixel32 map 缺少影格 ${key}`);
    context.drawImage(pixel32MapAtlas, frame.x, frame.y, frame.width, frame.height, x * tileSize, y * tileSize, frame.width, frame.height);
  };
  const drawAnchored = (key, tileX, tileY) => {
    const frame = frames[key];
    if (!frame) throw new Error(`pixel32 map 缺少影格 ${key}`);
    const anchor = frame.footAnchor ?? { x: frame.width / 2, y: frame.height };
    const x = tileX * tileSize + frame.width / 2 - anchor.x;
    const y = (tileY + frame.heightTiles) * tileSize - anchor.y;
    context.drawImage(pixel32MapAtlas, frame.x, frame.y, frame.width, frame.height, x, y, frame.width, frame.height);
  };
  for (let y = 0; y < scene.height; y += 1) {
    for (let x = 0; x < scene.width; x += 1) drawTile('spring-grass', x, y);
  }
  for (let x = 0; x < scene.width; x += 1) drawTile('spring-path', x, 8);
  drawAnchored('house-back', 3, 3);
  drawAnchored('tree-canopy', 8, 3);
  drawAnchored('house-front', 3, 3);
  canvas.dataset.candidate = 'pixel32-overlays';
  canvas.dataset.nativeTileSize = String(tileSize);
  canvas.dataset.sceneWidth = String(scene.width);
  canvas.dataset.sceneHeight = String(scene.height);
  canvas.dataset.renderedFrameCount = String(scene.width * scene.height + scene.width + 3);
  canvas.dataset.overlayOrder = 'house-back,tree-canopy,house-front';
  canvas.dataset.overlayBounds = JSON.stringify(Object.fromEntries([
    ['house-back', 3, 3],
    ['tree-canopy', 8, 3],
    ['house-front', 3, 3],
  ].map(([key, tileX, tileY]) => {
    const frame = frames[key];
    const anchor = frame.footAnchor ?? { x: frame.width / 2, y: frame.height };
    return [key, {
      x: tileX * tileSize + frame.width / 2 - anchor.x,
      y: (tileY + frame.heightTiles) * tileSize - anchor.y,
      width: frame.width,
      height: frame.height,
    }];
  })));
  canvas.dataset.approved = String(pixel32MapManifest.approved);
}

function render() {
  const scale = Number(scaleSelect.value);
  if (!manifest) return;
  const candidate = manifest?.candidates?.find((entry) => entry.id === active);
  const labels = {
    legacy: { kicker: '現況參考', title: 'Legacy', badge: '390 × 844 截圖', caption: '現行遊戲截圖，供素材比例參考；它與 A/B 樣張不是同一個遊戲場景。' },
    '8bit': { kicker: '候選 A', title: '8-bit 時代風格', badge: '原生 16 × 16', caption: '同一個固定 12 × 10 合成場景，以原生 16 × 16 圖塊製作並等比放大。' },
    '16bit': { kicker: '候選 B', title: '16-bit 時代風格', badge: '原生 32 × 32', caption: '同一個固定 12 × 10 合成場景，以原生 32 × 32 圖塊製作。' },
    'pixel32-overlays': { kicker: '候選 B · 圖層檢視', title: 'pixel32 地圖圖層', badge: '12 × 10 · 原生 32 × 32', caption: '未核准 pixel32 地圖 atlas 的隔離圖層構圖：房屋底層、樹冠、房屋前景。僅供圖層審閱，不代表正式地圖或素材驗收。' },
  };
  const label = labels[active];
  info.kicker.textContent = label.kicker;
  info.title.textContent = label.title;
  info.badge.textContent = label.badge;
  info.caption.textContent = label.caption;
  if (active === 'pixel32-overlays') {
    info.pageTitle.textContent = 'pixel32 地圖圖層候選';
    info.pageLede.textContent = '以固定 12 × 10 格檢視未核准地圖 atlas 的房屋底層、樹冠與房屋前景。這是隔離圖層樣張，沒有改動正式地圖或玩法。';
    sceneNotes.kicker.textContent = '圖層樣張內容';
    sceneNotes.title.textContent = '12 × 10 隔離構圖';
    sceneNotes.list.replaceChildren(...[
      'pixel32 春季草地與道路',
      '房屋底層與同錨點前景片',
      '樹冠、樹幹與前景深度',
    ].map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    sceneNotes.comparisonHeading.textContent = '本頁能比較';
    sceneNotes.comparisonCopy.textContent = '候選圖層順序、房屋共用錨點、原生像素輪廓與色塊密度。';
    sceneNotes.limitationHeading.textContent = '仍待補齊';
    sceneNotes.limitationCopy.textContent = '像素級角色遮擋品質、移動互動、碰撞與存檔行為，以及確切素材核准。';
  } else {
    info.pageTitle.textContent = '同一塊農場，三種像素尺度';
    info.pageLede.textContent = '用固定的 12 × 10 場景比較原生候選素材。這是美術樣張，尚未接入遊戲玩法，也未獲核准。';
    sceneNotes.kicker.textContent = 'A／B 固定場景內容';
    sceneNotes.title.textContent = '同座標、同構圖';
    sceneNotes.list.replaceChildren(...[
      '草地、耕地、道路與樹',
      '種子、幼苗、成熟作物',
      '屋緣與柵欄',
      '主角、黑貓、矮袋鼠',
      '工具與腳底陰影',
    ].map((text) => Object.assign(document.createElement('li'), { textContent: text })));
    sceneNotes.comparisonHeading.textContent = '本頁能比較';
    sceneNotes.comparisonCopy.textContent = '原生像素輪廓、色塊密度、角色與物件相對比例。';
    sceneNotes.limitationHeading.textContent = '仍待補齊';
    sceneNotes.limitationCopy.textContent = '遊戲內移動、互動、遮擋、存檔一致性、完整 viewport／DPR 矩陣與實機效能。';
  }
  if (active === 'legacy') drawLegacy();
  else if (candidate) drawCandidate(candidate);
  else if (active === 'pixel32-overlays' && pixel32MapManifest && pixel32MapAtlas?.complete) drawPixel32OverlayScene();
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
  const mapResponse = await fetch(new URL('pixel32-map/manifest.json', root));
  if (!mapResponse.ok) throw new Error(`pixel32 map manifest HTTP ${mapResponse.status}`);
  pixel32MapManifest = await mapResponse.json();
  if (pixel32MapManifest.status !== 'candidate' || pixel32MapManifest.approved !== false) {
    throw new Error('pixel32 map 素材不是未核准候選，拒絕載入。');
  }
  pixel32MapAtlas = new Image();
  pixel32MapAtlas.src = new URL(`pixel32-map/${pixel32MapManifest.atlas.file}`, root).href;
  pixel32MapAtlas.addEventListener('error', () => showError('無法載入 pixel32 map atlas。'));
  await Promise.all([
    ...manifest.candidates.map((candidate) => imageFor(candidate).decode()),
    pixel32MapAtlas.decode(),
    legacyReference.decode(),
  ]);
  render();
} catch (error) {
  const manifestUrl = new URL('manifest.json', root).href;
  showError(`候選載入失敗（${manifestUrl}）：${error instanceof Error ? error.message : String(error)}`);
  info.provenance.textContent = `候選素材尚未就緒：${manifestUrl}`;
}
