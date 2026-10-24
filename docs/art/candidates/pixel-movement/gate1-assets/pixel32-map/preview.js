const canvas = document.querySelector('#map-preview');
const context = canvas.getContext('2d', { alpha: false });
const readout = document.querySelector('#readout');
const manifest = await fetch('./manifest.json').then((response) => response.json());
const atlas = new Image();
await new Promise((resolve, reject) => {
  atlas.addEventListener('load', resolve, { once: true });
  atlas.addEventListener('error', () => reject(new Error(`無法載入候選圖集：${atlas.currentSrc || atlas.src}`)), { once: true });
  atlas.src = './map-atlas.png';
});
context.imageSmoothingEnabled = false;

const TILE = manifest.pixelContract.nativeTileSize;
const MAP = [
  'ggggggggggggggg', 'ggggggggggggggg', 'ppppppggggggggg', 'ggggppggggggggg',
  'ggffffgggwwgggg', 'ggffffgggwwgggg', 'ggffffgggwwgggg', 'ggggggggggggggg', 'ggggggggggggggg',
];
const seasonButtons = [...document.querySelectorAll('[data-season]')];
let season = 'spring';

function fieldMask(x, y) {
  const at = (nx, ny) => MAP[ny]?.[nx] === 'f';
  let mask = 0;
  if (!at(x, y - 1)) mask |= 1;
  if (!at(x + 1, y)) mask |= 2;
  if (!at(x, y + 1)) mask |= 4;
  if (!at(x - 1, y)) mask |= 8;
  return mask;
}

function drawFrame(name, x, y) {
  const frame = manifest.frames[name];
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height, x, y, frame.width, frame.height);
}

function render() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < MAP.length; y++) for (let x = 0; x < MAP[y].length; x++) {
    const kind = MAP[y][x] === 'p' ? 'path' : MAP[y][x] === 'w' ? 'water' : MAP[y][x] === 'f' ? 'field' : 'grass';
    const frame = kind === 'field' ? `${season}-field-edge-${fieldMask(x, y).toString(16)}` : `${season}-${kind}`;
    drawFrame(frame, x * TILE, y * TILE);
  }

  // The house is three tiles wide and two tall. Its wall/base is behind actors.
  drawFrame('house-back', 7 * TILE, 1 * TILE);
  const behindCanopy = document.querySelector('#behind-canopy').checked;
  const actorX = (behindCanopy ? 11.5 : 9.4) * TILE;
  const actorY = 4 * TILE;
  context.fillStyle = '#493d3c'; context.fillRect(actorX - 8, actorY - 25, 16, 25);
  context.fillStyle = '#d98579'; context.fillRect(actorX - 7, actorY - 21, 14, 12);
  context.fillStyle = '#67432f'; context.fillRect(actorX - 6, actorY - 25, 12, 6);
  context.fillStyle = '#654537'; context.fillRect(actorX - 8, actorY - 4, 7, 4); context.fillRect(actorX + 1, actorY - 4, 7, 4);
  // Both the house eave and tree crown demonstrate a separate foreground layer.
  drawFrame('house-front', 7 * TILE, 1 * TILE);
  drawFrame('tree-canopy', 11 * TILE, 2 * TILE);

  const mask = fieldMask(3, 4);
  canvas.dataset.season = season;
  canvas.dataset.autotileMask = String(mask);
  canvas.dataset.occlusion = behindCanopy ? 'behind-canopy' : 'in-front';
  canvas.dataset.approved = String(manifest.approved);
  readout.textContent = `${seasonButtons.find((button) => button.dataset.season === season)?.textContent}色樣 · 田地邊界遮罩 ${mask.toString(16)} · 角色${behindCanopy ? '在樹冠後' : '在樹冠前'} · approved=${manifest.approved}`;
}

seasonButtons.forEach((button) => button.addEventListener('click', () => {
  season = button.dataset.season;
  seasonButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
  render();
}));
document.querySelector('#behind-canopy').addEventListener('change', render);
render();
