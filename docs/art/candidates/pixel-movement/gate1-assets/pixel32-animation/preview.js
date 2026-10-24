import { candidateFrameAt, candidateToolFeedback, candidateToolImpactCrossed } from '../../../../../../src/presentation/candidate-sprite-animator.ts';

const SHEET_URL = './player-4dir.png';
const TOOL_ATLAS_URL = '../16bit.png';
const canvas = document.querySelector('#preview-canvas');
const context = canvas?.getContext('2d');
const errorMessage = document.querySelector('#error-message');
const frameReadout = document.querySelector('#frame-readout');
const impactReadout = document.querySelector('#impact-readout');
const frameImage = new Image();
const toolAtlas = new Image();
const reducedMotionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotionToggle = document.querySelector('#reduced-motion');
const state = { direction: 'down', motion: 'idle', reducedMotion: reducedMotionPreference.matches, actionStartedAt: null, previousProgress: 0, impactSeen: false };
const CYCLE_MS = 220;
const TOOL_DURATION_MS = 420;
let motionStartedAt = performance.now();

function syncPreviewState(frame = null) {
  if (!canvas) return;
  canvas.dataset.direction = state.direction;
  canvas.dataset.motion = state.motion;
  if (frame) canvas.dataset.frame = frame;
  canvas.dataset.impact = String(state.impactSeen);
  canvas.dataset.reducedMotion = String(state.reducedMotion);
}

function fail(error) {
  if (errorMessage) {
    errorMessage.hidden = false;
    errorMessage.textContent = error instanceof Error ? error.message : String(error);
  }
}

function pressed(container, attribute, value) {
  for (const button of container.querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset[attribute] === value));
}

function startMotion(motion) {
  state.motion = motion;
  state.actionStartedAt = motion === 'tool' ? performance.now() : null;
  state.previousProgress = 0;
  state.impactSeen = false;
  motionStartedAt = performance.now();
  pressed(document.querySelector('#motions'), 'motion', motion);
  if (impactReadout) impactReadout.textContent = motion === 'tool' ? '工具命中：等待中' : '工具命中：尚未觸發';
  syncPreviewState();
}

function draw(time) {
  if (!context || !frameImage.complete || !frameImage.naturalWidth) return;
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#dfe9d1'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#c7d7b6'; context.fillRect(0, 192, canvas.width, 128);
  context.fillStyle = '#b4c99f'; context.fillRect(0, 192, canvas.width, 2);
  for (let x = 0; x <= canvas.width; x += 64) {
    context.fillStyle = '#bdcfae'; context.fillRect(x, 192, 1, 128);
  }
  context.fillStyle = '#647e5e'; context.fillRect(126, 187, 4, 4);

  const elapsed = time - motionStartedAt;
  const moving = state.motion === 'walk' || state.motion === 'tool';
  const walkMotion = moving && !(state.reducedMotion && state.motion === 'walk');
  const frame = candidateFrameAt(state.direction, walkMotion ? 'walk' : 'idle', walkMotion ? elapsed % CYCLE_MS : 0);
  const match = frame.frame.match(/^(down|up|left|right)-(.+)$/);
  const row = ['down', 'up', 'left', 'right'].indexOf(match?.[1] ?? 'down');
  const column = ['idle', 'contact-a', 'passing', 'contact-b'].indexOf(match?.[2] ?? 'idle');
  const drawX = 96;
  const drawY = 98;
  context.drawImage(frameImage, column * 32, row * 48, 32, 48, drawX, drawY, 64, 96);

  let progress = null;
  if (state.motion === 'tool' && state.actionStartedAt !== null) {
    progress = Math.min(1, (time - state.actionStartedAt) / TOOL_DURATION_MS);
    const feedback = candidateToolFeedback(progress, state.direction, state.reducedMotion);
    if (candidateToolImpactCrossed(state.previousProgress, progress)) {
      state.impactSeen = true;
      if (impactReadout) impactReadout.textContent = '工具命中：已觸發候選回饋';
    }
    state.previousProgress = progress;
    if (feedback.visible && toolAtlas.complete && toolAtlas.naturalWidth) {
      context.save();
      context.translate(drawX + 42 + feedback.x, drawY + 45 + feedback.y);
      context.rotate(feedback.rotation);
      context.drawImage(toolAtlas, 32, 144, 32, 32, -14, -22, 32, 32);
      context.restore();
    }
    if (state.impactSeen) {
      context.strokeStyle = '#e8b653'; context.lineWidth = 2;
      context.strokeRect(116, 175, 52, 18);
    }
    if (progress >= 1) {
      state.motion = 'idle'; state.actionStartedAt = null; motionStartedAt = time;
      pressed(document.querySelector('#motions'), 'motion', 'idle');
    }
  }

  if (frameReadout) frameReadout.textContent = `方向：${{ down: '下', up: '上', left: '左', right: '右' }[state.direction]} · 狀態：${state.motion === 'walk' ? (state.reducedMotion ? '走路（靜止預覽）' : '走路') : state.motion === 'tool' ? '工具動作' : '站立'} · 幀：${state.motion === 'tool' && state.impactSeen ? `${frame.frame} · 命中` : frame.frame}`;
  syncPreviewState(frame.frame);
  requestAnimationFrame(draw);
}

for (const button of document.querySelectorAll('#directions button[data-direction]')) {
  button.addEventListener('click', () => {
    state.direction = button.dataset.direction;
    pressed(document.querySelector('#directions'), 'direction', state.direction);
    syncPreviewState();
  });
}
for (const button of document.querySelectorAll('#motions button[data-motion]')) {
  button.addEventListener('click', () => startMotion(button.dataset.motion));
}
if (reducedMotionToggle) reducedMotionToggle.checked = state.reducedMotion;
reducedMotionPreference.addEventListener('change', (event) => {
  state.reducedMotion = event.matches;
  if (reducedMotionToggle) reducedMotionToggle.checked = state.reducedMotion;
});
reducedMotionToggle?.addEventListener('change', (event) => {
  state.reducedMotion = event.target.checked;
});

Promise.all([
  new Promise((resolve, reject) => { frameImage.onload = resolve; frameImage.onerror = () => reject(new Error('無法載入候選角色圖集')); frameImage.src = SHEET_URL; }),
  new Promise((resolve, reject) => { toolAtlas.onload = resolve; toolAtlas.onerror = () => reject(new Error('無法載入候選工具圖集')); toolAtlas.src = TOOL_ATLAS_URL; }),
]).then(() => requestAnimationFrame(draw)).catch(fail);
