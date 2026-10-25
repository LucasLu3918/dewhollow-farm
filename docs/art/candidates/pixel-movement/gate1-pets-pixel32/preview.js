import manifest from './manifest.json';

const atlas = await (async () => {
  const image = document.querySelector('.atlas');
  if (!(image instanceof HTMLImageElement)) throw new Error('找不到候選圖集元素');
  if (!image.complete) await new Promise((resolve, reject) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', () => reject(new Error('無法載入候選圖集')), { once: true });
  });
  if (image.naturalWidth === 0) throw new Error('無法載入候選圖集');
  return image;
})();
const speciesInput = document.querySelector('#species');
const directionInput = document.querySelector('#direction');
const poseInput = document.querySelector('#pose');
const playButton = document.querySelector('#play');
const canvas = document.querySelector('#sprite');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
let timer;
let animationIndex = 0;

function paint() {
  const species = speciesInput.value;
  const direction = directionInput.value;
  const pose = poseInput.value;
  const frame = manifest.frames[`${species}-${direction}-${pose}`];
  if (!frame) throw new Error('候選畫格不在 manifest 中');
  context.clearRect(0, 0, 32, 32);
  context.drawImage(atlas, frame.x, frame.y, 32, 32, 0, 0, 32, 32);
  const names = { cat: '黑貓', quokka: '矮袋鼠', down: '面向前', up: '背向', left: '面向左', right: '面向右', idle: '站立', 'hop-a': '跳步 A', 'hop-b': '跳步 B', land: '落地' };
  document.querySelector('#readout').textContent = `${names[species]} · ${names[direction]} · ${names[pose]} · 32×32 原生格 · footAnchor (${frame.footAnchor.x},${frame.footAnchor.y}) · ${manifest.status} / approved=${manifest.approved}`;
}

function stop() {
  if (timer) clearInterval(timer);
  timer = undefined;
  playButton.setAttribute('aria-pressed', 'false');
  playButton.textContent = '播放跳步';
}

for (const input of [speciesInput, directionInput, poseInput]) input.addEventListener('change', () => { stop(); paint(); });
playButton.addEventListener('click', () => {
  if (timer) { stop(); return; }
  const animation = manifest.animations[speciesInput.value][directionInput.value];
  const hop = animation.hop;
  animationIndex = 0;
  poseInput.value = manifest.frames[hop.frames[0]].pose;
  paint();
  playButton.setAttribute('aria-pressed', 'true');
  playButton.textContent = '停止';
  timer = setInterval(() => {
    animationIndex += 1;
    if (animationIndex >= hop.frames.length) {
      poseInput.value = manifest.frames[animation.returnTo === 'idle' ? animation.idle.frames[0] : animation.hop.frames.at(-1)].pose;
      stop();
      paint();
      return;
    }
    poseInput.value = manifest.frames[hop.frames[animationIndex]].pose;
    paint();
  }, hop.frameDurationMs);
});
paint();
