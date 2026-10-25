const labels = {
  'tool-hoe': '鋤頭', 'tool-can': '水壺', 'tool-seedbag': '種子袋', 'tool-axe': '斧頭',
  'tool-pick': '十字鎬', 'tool-rod': '釣竿', 'tool-sickle': '鐮刀',
  'door-closed': '門・關閉', 'door-open': '門・開啟', 'shipbox-closed': '船運箱・關閉', 'shipbox-open': '船運箱・開啟',
};

const grid = document.querySelector('#candidate-grid');
const showAnchor = document.querySelector('#show-anchor');
const showGrip = document.querySelector('#show-grip');

function drawFrame(context, atlas, frame, markers) {
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 32, 32);
  context.drawImage(atlas, frame.x, frame.y, frame.width, frame.height, 0, 0, 32, 32);
  if (markers.anchor) {
    context.fillStyle = '#eb5a4c'; context.fillRect(15, 29, 3, 1); context.fillRect(16, 28, 1, 3);
  }
  if (markers.grip && frame.grip) {
    context.fillStyle = '#367ed0'; context.fillRect(frame.grip.x - 1, frame.grip.y - 1, 3, 3);
    context.fillStyle = '#fff'; context.fillRect(frame.grip.x, frame.grip.y, 1, 1);
  }
}

function render(manifest, atlasImage) {
  grid.replaceChildren();
  for (const [key, frame] of Object.entries(manifest.frames)) {
    const card = document.createElement('article'); card.className = 'card';
    const surface = document.createElement('div'); surface.className = 'sprite';
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; canvas.setAttribute('aria-label', labels[key] ?? key); surface.append(canvas);
    const heading = document.createElement('h2'); heading.textContent = labels[key] ?? key;
    const meta = document.createElement('p'); meta.className = 'meta'; meta.textContent = `${key} · 32×32 · ${frame.category} / ${frame.state}`;
    card.append(surface, heading, meta); grid.append(card);
    drawFrame(canvas.getContext('2d'), atlasImage, frame, { anchor: showAnchor.checked, grip: showGrip.checked });
  }
  document.querySelector('#integrity').textContent = `Atlas SHA-256 ${manifest.atlas.sha256} · ${Object.keys(manifest.frames).length} candidate frames · all approval flags false`;
  grid.setAttribute('aria-busy', 'false');
}

try {
  const response = await fetch('./manifest.json');
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.status !== 'candidate' || manifest.approved !== false) throw new Error('候選核准狀態不正確');
  const atlas = new Image(); atlas.src = `./${manifest.atlas.file}`;
  await atlas.decode();
  render(manifest, atlas);
  const refresh = () => render(manifest, atlas);
  showAnchor.addEventListener('change', refresh); showGrip.addEventListener('change', refresh);
} catch (error) {
  grid.replaceChildren(); grid.setAttribute('aria-busy', 'false');
  const message = document.createElement('p'); message.className = 'error'; message.textContent = `候選預覽無法載入：${error instanceof Error ? error.message : String(error)}`; grid.append(message);
}
