import {
  candidateFrameAt,
  candidateToolFeedback,
  candidateToolImpactCrossed,
} from '../../../../../src/presentation/candidate-sprite-animator.ts';

const canvas = document.querySelector('#integrated-preview');
const context = canvas?.getContext('2d');
const sceneReadout = document.querySelector('#scene-readout');
const motionReadout = document.querySelector('#motion-readout');
const errorMessage = document.querySelector('#error-message');
const mapRoot = './pixel32-map/';
const animationRoot = './pixel32-animation/';
const MAP = [
  'ggggggggggggggg', 'ggggggggggggggg', 'ppppppggggggggg', 'ggggppggggggggg',
  'ggffffgggwwgggg', 'ggffffgggwwgggg', 'ggffffgggwwgggg', 'ggggggggggggggg', 'ggggggggggggggg',
];
const TILE = 32;
const WALK_CYCLE_MS = 220;
const TOOL_DURATION_MS = 1000;
const state = {
  direction: 'down', season: 'spring', tileX: 11, tileY: 4,
  walkingUntil: 0, toolStartedAt: null, previousToolProgress: 0, impactSeen: false,
};

async function loadImage(url) {
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error(`無法載入候選圖集：${url}`)), { once: true });
    image.src = url;
  });
  return image;
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`無法載入候選 manifest：${url} (${response.status})`);
  return response.json();
}

const [mapManifest, animationManifest] = await Promise.all([
  loadJson(`${mapRoot}manifest.json`), loadJson(`${animationRoot}manifest.json`),
]);
const [mapAtlas, animationAtlas] = await Promise.all([
  loadImage(`${mapRoot}${mapManifest.atlas.file}`), loadImage(`${animationRoot}${animationManifest.atlas.file}`),
]);

function drawFrame(atlas, frame, x, y) {
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height, x, y, frame.width, frame.height);
}

function fieldMask(x, y) {
  const isField = (nx, ny) => MAP[ny]?.[nx] === 'f';
  let mask = 0;
  if (!isField(x, y - 1)) mask |= 1;
  if (!isField(x + 1, y)) mask |= 2;
  if (!isField(x, y + 1)) mask |= 4;
  if (!isField(x - 1, y)) mask |= 8;
  return mask;
}

function drawMap() {
  for (let y = 0; y < MAP.length; y += 1) for (let x = 0; x < MAP[y].length; x += 1) {
    const tile = MAP[y][x];
    const surface = tile === 'p' ? 'path' : tile === 'w' ? 'water' : tile === 'f' ? 'field' : 'grass';
    const frame = surface === 'field' ? `${state.season}-field-edge-${fieldMask(x, y).toString(16)}` : `${state.season}-${surface}`;
    drawFrame(mapAtlas, mapManifest.frames[frame], x * TILE, y * TILE);
  }
  drawFrame(mapAtlas, mapManifest.frames['house-back'], 7 * TILE, TILE);
}

function drawActor(time) {
  const walking = time < state.walkingUntil;
  const elapsed = walking ? WALK_CYCLE_MS - (state.walkingUntil - time) : 0;
  const frameKey = candidateFrameAt(state.direction, walking ? 'walk' : 'idle', elapsed).frame;
  const frame = animationManifest.frames[frameKey];
  const actorX = state.tileX * TILE + TILE / 2;
  const footY = state.tileY * TILE + TILE - 1;
  drawFrame(animationAtlas, frame, actorX - frame.footAnchor.x, footY - frame.footAnchor.y);

  if (state.toolStartedAt !== null) {
    const progress = Math.max(0, Math.min(1, (time - state.toolStartedAt) / TOOL_DURATION_MS));
    const feedback = candidateToolFeedback(progress, state.direction);
    if (candidateToolImpactCrossed(state.previousToolProgress, progress)) state.impactSeen = true;
    state.previousToolProgress = progress;
    if (feedback.visible) {
      context.save();
      context.translate(actorX + 12 + feedback.x, footY - 29 + feedback.y);
      context.rotate(feedback.rotation);
      context.fillStyle = '#805536'; context.fillRect(-2, -18, 4, 18);
      context.fillStyle = '#c7a265'; context.fillRect(-7, -21, 14, 5);
      context.restore();
    }
    if (state.impactSeen) {
      context.strokeStyle = '#e8b653'; context.lineWidth = 2;
      context.strokeRect(actorX + 2, footY - 19, 22, 18);
    }
    if (progress >= 1) state.toolStartedAt = null;
  }

}

function drawCanopy() {
  drawFrame(mapAtlas, mapManifest.frames['tree-canopy'], 11 * TILE, 2 * TILE);
}

function drawHouseFront() {
  drawFrame(mapAtlas, mapManifest.frames['house-front'], 7 * TILE, TILE);
}

function render(time = performance.now()) {
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  const behindCanopy = document.querySelector('#behind-canopy').checked;
  if (!behindCanopy) drawCanopy();
  drawActor(time);
  drawHouseFront();
  if (behindCanopy) drawCanopy();
  const labels = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const direction = { down: '下', up: '上', left: '左', right: '右' }[state.direction];
  const motion = time < state.walkingUntil ? 'walk' : state.toolStartedAt !== null ? 'tool' : 'idle';
  sceneReadout.textContent = `${labels[state.season]}色樣 · 田地遮罩 ${fieldMask(3, 4).toString(16)} · 玩家位置 ${state.tileX},${state.tileY} · 兩組素材均未核准`;
  motionReadout.textContent = `方向：${direction} · 動作：${motion === 'walk' ? '走路' : motion === 'tool' ? '工具回饋' : '站立'}`;
  canvas.dataset.direction = state.direction;
  canvas.dataset.season = state.season;
  canvas.dataset.motion = motion;
  canvas.dataset.occlusion = document.querySelector('#behind-canopy').checked ? 'behind-canopy' : 'in-front';
  requestAnimationFrame(render);
}

function setPressed(container, attribute, value) {
  for (const button of container.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset[attribute] === value));
}

function step(direction) {
  const offset = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[direction];
  state.direction = direction;
  state.tileX = Math.max(0, Math.min(14, state.tileX + offset[0]));
  state.tileY = Math.max(0, Math.min(8, state.tileY + offset[1]));
  state.walkingUntil = performance.now() + WALK_CYCLE_MS;
  state.toolStartedAt = null;
  setPressed(document.querySelector('#directions'), 'direction', direction);
}

for (const button of document.querySelectorAll('#directions button[data-direction]')) {
  button.addEventListener('click', () => step(button.dataset.direction));
}
document.querySelector('#walk-step').addEventListener('click', () => step(state.direction));
for (const button of document.querySelectorAll('#seasons button[data-season]')) {
  button.addEventListener('click', () => {
    state.season = button.dataset.season;
    setPressed(document.querySelector('#seasons'), 'season', state.season);
  });
}
document.querySelector('#behind-canopy').addEventListener('change', (event) => {
  canvas.dataset.occlusion = event.currentTarget.checked ? 'behind-canopy' : 'in-front';
});
document.querySelector('#tool-action').addEventListener('click', () => {
  state.walkingUntil = 0; state.toolStartedAt = performance.now(); state.previousToolProgress = 0; state.impactSeen = false;
});
window.addEventListener('keydown', (event) => {
  const direction = { ArrowDown: 'down', ArrowUp: 'up', ArrowLeft: 'left', ArrowRight: 'right' }[event.key];
  if (!direction) return;
  event.preventDefault();
  step(direction);
});

if (mapManifest.status !== 'candidate' || mapManifest.approved !== false
  || animationManifest.status !== 'candidate' || animationManifest.approved !== false) {
  throw new Error('整合預覽只接受尚未核准的候選素材');
}
canvas.dataset.mapCandidate = 'pixel32-map';
canvas.dataset.animationCandidate = 'pixel32-animation';
requestAnimationFrame(render);

window.addEventListener('error', (event) => {
  if (!errorMessage) return;
  errorMessage.hidden = false;
  errorMessage.textContent = event.message || '候選預覽載入失敗';
});
