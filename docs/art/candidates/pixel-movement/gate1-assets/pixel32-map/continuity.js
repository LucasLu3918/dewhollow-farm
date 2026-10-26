const manifestResponse = await fetch('./manifest.json');
if (!manifestResponse.ok) throw new Error(`無法載入候選 manifest (${manifestResponse.status})`);
const manifestBytes = await manifestResponse.arrayBuffer();
const manifest = await JSON.parse(new TextDecoder().decode(manifestBytes));
const manifestSha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', manifestBytes))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
if (manifest.status !== 'candidate' || manifest.approved !== false) throw new Error('地圖素材必須維持未核准候選狀態');

const atlas = new Image();
await new Promise((resolve, reject) => {
  atlas.addEventListener('load', resolve, { once: true });
  atlas.addEventListener('error', () => reject(new Error('無法載入候選 atlas')), { once: true });
  atlas.src = `./${manifest.atlas.file}`;
});
const tile = manifest.pixelContract.nativeTileSize;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlas.naturalWidth;
atlasCanvas.height = atlas.naturalHeight;
const atlasContext = atlasCanvas.getContext('2d', { willReadFrequently: true });
atlasContext.drawImage(atlas, 0, 0);
const atlasPixels = atlasContext.getImageData(0, 0, atlasCanvas.width, atlasCanvas.height).data;
const seasons = manifest.seasons;
const surfaces = ['grass', 'field', 'path', 'water'];
const surfaceNames = { grass: '草地', field: '田地', path: '道路', water: '水面' };
const repeatCanvas = document.querySelector('#repeat-preview');
const repeatContext = repeatCanvas.getContext('2d', { willReadFrequently: true });
const maskCanvas = document.querySelector('#mask-preview');
const maskContext = maskCanvas.getContext('2d');
const mixedCanvas = document.querySelector('#mixed-preview');
const mixedContext = mixedCanvas.getContext('2d');
repeatContext.imageSmoothingEnabled = false;
maskContext.imageSmoothingEnabled = false;
mixedContext.imageSmoothingEnabled = false;
const seasonButtons = [...document.querySelectorAll('[data-season]')];
const loadedFrameIds = [];
let season = seasons[0];

function frameFor(id) {
  const frame = manifest.frames[id];
  if (!frame) throw new Error(`候選 manifest 缺少 frame：${id}`);
  if (frame.approved !== false) throw new Error(`Frame 必須維持未核准：${id}`);
  loadedFrameIds.push(id);
  return frame;
}

function drawFrame(context, id, dx, dy, dw = tile, dh = tile) {
  const frame = frameFor(id);
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height, dx, dy, dw, dh);
}

function seamMetrics(frameId) {
  const frame = frameFor(frameId);
  let sampleCount = 0;
  let exactMatchCount = 0;
  let totalDelta = 0;
  let maxDelta = 0;
  const addPair = (a, b) => {
    const delta = Math.abs(atlasPixels[a] - atlasPixels[b]) + Math.abs(atlasPixels[a + 1] - atlasPixels[b + 1]) + Math.abs(atlasPixels[a + 2] - atlasPixels[b + 2]);
    sampleCount += 1;
    if (delta === 0) exactMatchCount += 1;
    totalDelta += delta;
    maxDelta = Math.max(maxDelta, delta);
  };
  for (let index = 0; index < tile; index += 1) {
    const leftEdge = ((frame.y + index) * atlasCanvas.width + frame.x) * 4;
    const rightEdge = leftEdge + (tile - 1) * 4;
    const topEdge = (frame.y * atlasCanvas.width + frame.x + index) * 4;
    const bottomEdge = ((frame.y + tile - 1) * atlasCanvas.width + frame.x + index) * 4;
    addPair(rightEdge, leftEdge);
    addPair(bottomEdge, topEdge);
  }
  return { exactMatchCount, meanRgbDelta: sampleCount ? Number((totalDelta / sampleCount).toFixed(4)) : 0, maxRgbDelta: maxDelta, sampleCount };
}

function render() {
  loadedFrameIds.length = 0;
  repeatContext.clearRect(0, 0, repeatCanvas.width, repeatCanvas.height);
  maskContext.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  mixedContext.clearRect(0, 0, mixedCanvas.width, mixedCanvas.height);
  const metrics = [];
  surfaces.forEach((surface, column) => {
    const frameId = `${season}-${surface}`;
    const startX = 52 + column * 200;
    const startY = 8;
    for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) {
      drawFrame(repeatContext, frameId, startX + x * tile, startY + y * tile);
    }
    metrics.push({ surface, label: surfaceNames[surface], ...seamMetrics(frameId) });
  });
  const maskIds = [];
  for (let mask = 0; mask < 16; mask += 1) {
    const id = `${season}-field-edge-${mask.toString(16)}`;
    maskIds.push(id);
    const column = mask % 8;
    const row = Math.floor(mask / 8);
    drawFrame(maskContext, id, 16 + column * 96, 8 + row * 72, 64, 64);
  }
  const maskLabels = document.querySelector('#mask-labels');
  maskLabels.replaceChildren(...Array.from({ length: 16 }, (_, mask) => {
    const item = document.createElement('li');
    item.textContent = mask.toString(16).toUpperCase();
    item.dataset.maskId = `${season}-field-edge-${mask.toString(16)}`;
    return item;
  }));
  const mixedFrames = [];
  const isField = (x, y) => x >= 0 && x < 3 && y >= 1 && y < 3;
  const directions = [
    { dx: 0, dy: -1, bit: 1 },
    { dx: 1, dy: 0, bit: 2 },
    { dx: 0, dy: 1, bit: 4 },
    { dx: -1, dy: 0, bit: 8 },
  ];
  for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) {
    let id = `${season}-grass`;
    if (isField(x, y)) {
      const mask = directions.reduce((value, direction) => value | (isField(x + direction.dx, y + direction.dy) ? 0 : direction.bit), 0);
      id = `${season}-field-edge-${mask.toString(16)}`;
    }
    mixedFrames.push(id);
    drawFrame(mixedContext, id, 352 + x * tile, 8 + y * tile);
  }
  document.querySelector('#mixed-frame-list').textContent = `3×3 格子順序（左至右、上至下）：${mixedFrames.join(' · ')}`;
  document.querySelector('#metrics').innerHTML = metrics.map((item) => `<div class="metric" data-surface="${item.surface}"><strong>${item.label}</strong><span>完全相同 ${item.exactMatchCount}/${item.sampleCount}<br>平均 RGB 差 ${item.meanRgbDelta}<br>最大 RGB 差 ${item.maxRgbDelta}</span></div>`).join('');
  document.querySelector('#readout').textContent = `${season} · 4 種地表，各 3×3 重複 · field mask 0–f 共 16 種 · candidate / approved=false`;
  document.querySelector('#source-hashes').textContent = `manifest ${manifestSha256} · atlas ${manifest.atlas.sha256} · generator ${manifest.source.generatorSha256}`;
  repeatCanvas.dataset.season = season;
  repeatCanvas.dataset.candidateStatus = manifest.status;
  repeatCanvas.dataset.approved = String(manifest.approved);
  repeatCanvas.dataset.loadedFrameIds = loadedFrameIds.join(',');
  repeatCanvas.dataset.maskIds = maskIds.join(',');
  repeatCanvas.dataset.metrics = JSON.stringify(metrics);
  repeatCanvas.dataset.frameCounts = JSON.stringify({
    baseSurfaces: surfaces.map((surface) => ({
      surface,
      sourceFrameCount: Object.values(manifest.frames).filter((frame) => frame.season === season && frame.surface === surface && frame.autotileMask === undefined).length,
      displayedTileCount: 9,
    })),
    fieldEdge: { sourceFrameCount: maskIds.length, displayedTileCount: maskIds.length },
    mixedBoundary: {
      uniqueSourceFrameCount: new Set(mixedFrames).size,
      displayedTileCount: mixedFrames.length,
    },
    uniqueSourceFramesLoaded: new Set(loadedFrameIds).size,
  });
  repeatCanvas.dataset.mixedCellFrames = mixedFrames.join(',');
  repeatCanvas.dataset.mixedMaskIds = mixedFrames.filter((id) => id.includes('-field-edge-')).join(',');
  repeatCanvas.dataset.mixedBoundaryAssumption = 'out-of-grid=grass; bits north=1,east=2,south=4,west=8';
  repeatCanvas.dataset.atlasSha256 = manifest.atlas.sha256;
  repeatCanvas.dataset.generatorSha256 = manifest.source.generatorSha256;
  repeatCanvas.dataset.manifestSha256 = manifestSha256;
  maskCanvas.dataset.season = season;
  maskCanvas.dataset.maskIds = maskIds.join(',');
}

seasonButtons.forEach((button) => button.addEventListener('click', () => {
  season = button.dataset.season;
  seasonButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
  render();
}));
render();
