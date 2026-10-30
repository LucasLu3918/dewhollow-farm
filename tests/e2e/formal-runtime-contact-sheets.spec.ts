import { expect, test, type Page } from '@playwright/test';

const evidenceDirectory = 'docs/art/audit/vf15-runtime-contact-sheets';
const saveEvidence = (globalThis as typeof globalThis & {
  process?: { cwd(): string; env?: Record<string, string | undefined> };
}).process?.env?.SAVE_VF15_CONTACT_SHEETS === '1';

interface ContactSheetCapture {
  dataUrl: string;
  cells: Array<{ label: string; pose?: { y: number; legA: number; legB: number; stretch: number } }>;
  dimensions: { width: number; height: number };
}

async function waitForGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
}

async function waitForCameraToSettle(page: Page): Promise<void> {
  const settled = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const debug = window.__dewhollow;
    if (!debug) return resolve(false);
    let previous = debug.cameraScroll();
    let stableFrames = 0;
    const deadline = performance.now() + 5_000;
    const sample = (): void => {
      const current = debug.cameraScroll();
      stableFrames = current.x === previous.x && current.y === previous.y ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 5) resolve(true);
      else if (performance.now() >= deadline) resolve(false);
      else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  expect(settled, 'camera scroll settles before each contact sheet capture').toBe(true);
}

async function capturePlayerSheet(page: Page): Promise<ContactSheetCapture> {
  return page.evaluate(async () => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少正式 runtime 的 window.__dewhollow');
    debug.setOthersHidden(true);
    await debug.pauseScene();

    const views = ['down', 'up', 'left', 'right'] as const;
    const phases = [
      { label: 'rest', step: 0, u: 0 },
      { label: 'step-A lift', step: 0, u: 0.25 },
      { label: 'step-B lift', step: 1, u: 0.25 },
      { label: 'passing', step: 0, u: 0.5 },
    ] as const;
    const columns = phases.length;
    const cellWidth = 192;
    const cellHeight = 150;
    const cropWidth = 128;
    const cropHeight = 116;
    const sheet = document.createElement('canvas');
    sheet.width = columns * cellWidth;
    sheet.height = views.length * cellHeight;
    const sheetContext = sheet.getContext('2d');
    if (!sheetContext) throw new Error('無法建立玩家接觸表 canvas');
    sheetContext.fillStyle = '#17231c';
    sheetContext.fillRect(0, 0, sheet.width, sheet.height);
    sheetContext.imageSmoothingEnabled = false;

    const cells: ContactSheetCapture['cells'] = [];
    for (const [row, view] of views.entries()) {
      for (const [column, phase] of phases.entries()) {
        debug.setPose(view, phase.step, phase.u);
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const image = new Image();
        image.src = await debug.snapshot();
        await image.decode();
        const player = debug.actors().find((actor) => actor.id === 'player');
        if (!player) throw new Error('找不到正式玩家角色');
        const camera = debug.cameraView();
        const scroll = debug.cameraScroll();
        const footX = camera.x + (player.footX - scroll.x) * camera.zoom;
        const footY = camera.y + (player.footY - scroll.y) * camera.zoom;
        const sourceX = Math.round(footX - cropWidth / 2);
        const sourceY = Math.round(footY - 108);
        if (sourceX < 0 || sourceY < 0 || sourceX + cropWidth > image.width || sourceY + cropHeight > image.height) {
          throw new Error(`玩家截圖裁切超出 canvas：${JSON.stringify({ sourceX, sourceY, width: image.width, height: image.height })}`);
        }
        const x = column * cellWidth;
        const y = row * cellHeight;
        sheetContext.fillStyle = '#25362b';
        sheetContext.fillRect(x + 6, y + 6, cellWidth - 12, cellHeight - 12);
        sheetContext.fillStyle = '#f0e2bd';
        sheetContext.font = '12px monospace';
        sheetContext.fillText(`${view} · ${phase.label}`, x + 10, y + 22);
        sheetContext.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x + 24, y + 27, cropWidth, cropHeight);
        cells.push({ label: `${view}/${phase.label}`, pose: debug.pose() });
      }
    }
    return { dataUrl: sheet.toDataURL('image/png'), cells, dimensions: { width: sheet.width, height: sheet.height } };
  });
}

async function captureActorCell(page: Page, actorId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少正式 runtime 的 window.__dewhollow');
    debug.setPlayerHidden(id !== 'player');
    const image = new Image();
    image.src = await debug.snapshot();
    await image.decode();
    const actor = debug.actors().find((candidate) => candidate.id === id);
    if (!actor) throw new Error(`找不到角色 ${id}`);
    const camera = debug.cameraView();
    const scroll = debug.cameraScroll();
    const cropWidth = id === 'player' ? 128 : 72;
    const cropHeight = id === 'player' ? 116 : 72;
    const footX = camera.x + (actor.footX - scroll.x) * camera.zoom;
    const footY = camera.y + (actor.footY - scroll.y) * camera.zoom;
    const sourceX = Math.round(footX - cropWidth / 2);
    const sourceY = Math.round(footY - (id === 'player' ? 108 : 68));
    if (sourceX < 0 || sourceY < 0 || sourceX + cropWidth > image.width || sourceY + cropHeight > image.height) {
      throw new Error(`角色 ${id} 截圖裁切超出 canvas`);
    }
    const crop = document.createElement('canvas');
    crop.width = cropWidth;
    crop.height = cropHeight;
    const context = crop.getContext('2d');
    if (!context) throw new Error('無法建立角色裁切 canvas');
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return crop.toDataURL('image/png');
  }, actorId);
}

async function composePetSheet(page: Page, captures: Array<{ label: string; dataUrl: string }>): Promise<ContactSheetCapture> {
  return page.evaluate(async (items) => {
    const cellWidth = 176;
    const cellHeight = 106;
    const cropWidth = 72;
    const cropHeight = 72;
    const sheet = document.createElement('canvas');
    sheet.width = items.length * cellWidth;
    sheet.height = cellHeight;
    const context = sheet.getContext('2d');
    if (!context) throw new Error('無法建立寵物接觸表 canvas');
    context.fillStyle = '#17231c';
    context.fillRect(0, 0, sheet.width, sheet.height);
    context.imageSmoothingEnabled = false;
    for (const [index, item] of items.entries()) {
      const image = new Image();
      image.src = item.dataUrl;
      await image.decode();
      const x = index * cellWidth;
      context.fillStyle = '#25362b';
      context.fillRect(x + 6, 6, cellWidth - 12, cellHeight - 12);
      context.fillStyle = '#f0e2bd';
      context.font = '12px monospace';
      context.fillText(item.label, x + 10, 22);
      context.drawImage(image, x + 52, 27, cropWidth, cropHeight);
    }
    return {
      dataUrl: sheet.toDataURL('image/png'),
      cells: items.map(({ label }) => ({ label })),
      dimensions: { width: sheet.width, height: sheet.height },
    };
  }, captures);
}

test('captures formal runtime player and pet contact sheets for visual acceptance review', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { Buffer } = await import('node:' + 'buffer');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => {
    let state = 0x15f015;
    Math.random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
  });
  await waitForGame(page);
  await waitForCameraToSettle(page);

  const formalAssets = await page.evaluate(() => {
    const debug = window.__dewhollow;
    if (!debug) throw new Error('缺少正式 runtime debug surface');
    return {
      player: ['player.down', 'player.up', 'player.left'].map((key) => ({ key, size: debug.textureSize(key) })),
      pets: ['pet.cat', 'pet.marsupial'].map((key) => ({ key, size: debug.textureSize(key) })),
      candidateMode: debug.pixel32CandidateRuntime().enabled || debug.candidateArt().candidate !== null,
      renderer: debug.renderCompat(),
      userAgent: navigator.userAgent,
    };
  });
  expect(formalAssets.player.every((asset) => asset.size?.width === 128 && asset.size.height === 160)).toBe(true);
  expect(formalAssets.pets.every((asset) => asset.size?.width === 96 && asset.size.height === 96)).toBe(true);
  expect(formalAssets.candidateMode, 'captures must use formal runtime art only').toBe(false);

  const playerSheet = await capturePlayerSheet(page);
  expect(playerSheet.dimensions).toEqual({ width: 768, height: 600 });
  expect(playerSheet.cells).toHaveLength(16);
  expect(playerSheet.cells.every((cell) => cell.pose !== undefined)).toBe(true);
  const playerPng = Buffer.from(playerSheet.dataUrl.split(',')[1] ?? '', 'base64');
  expect(playerPng.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(playerPng.byteLength).toBeGreaterThan(1_000);
  await testInfo.attach('vf15-player-four-directions.png', { body: playerPng, contentType: 'image/png' });

  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  await waitForCameraToSettle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'cat')?.pose.y ?? 0)).toBe(0);
  const catRest = await captureActorCell(page, 'cat');

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('farm');
  // The redesigned farm's south exit is reached via the west side of the shipping box.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 19, y: 14 });
  for (let step = 0; step < 14; step += 1) {
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 19, y: 15 + step });
  }
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.movement().tile ?? null)).toMatchObject({ x: 20, y: 28 });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.mapId() ?? '')).toBe('village');
  await waitForCameraToSettle(page);
  await expect.poll(() => page.evaluate(() => window.__dewhollow?.actors().find((actor) => actor.id === 'marsupial')?.pose.y ?? 0)).toBe(0);
  await page.evaluate(() => window.__dewhollow?.pauseScene());
  const marsupialRest = await captureActorCell(page, 'marsupial');
  const petSheet = await composePetSheet(page, [
    { label: 'Cat · rest · farm', dataUrl: catRest },
    { label: 'Quokka · village', dataUrl: marsupialRest },
  ]);
  expect(petSheet.dimensions).toEqual({ width: 352, height: 106 });
  expect(petSheet.cells).toHaveLength(2);
  const petPng = Buffer.from(petSheet.dataUrl.split(',')[1] ?? '', 'base64');
  expect(petPng.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(petPng.byteLength).toBeGreaterThan(1_000);
  await testInfo.attach('vf15-pet-silhouettes.png', { body: petPng, contentType: 'image/png' });

  const crypto = await import('node:' + 'crypto');
  const fs = await import('node:' + 'fs/promises');
  const path = await import('node:' + 'path');
  const cwd = (globalThis as typeof globalThis & { process?: { cwd(): string } }).process?.cwd() ?? '.';
  const sourceFiles = {
    'player.down': 'public/assets/characters/xiaohan-2x.png',
    'player.up': 'public/assets/characters/xiaohan-back-2x.png',
    'player.left': 'public/assets/characters/xiaohan-side-2x.png',
    'player.right': 'public/assets/characters/xiaohan-side-2x.png (mirrored from player.left)',
    'pet.cat': 'public/assets/characters/cat-2x.png',
    'pet.marsupial': 'public/assets/characters/marsupial-2x.png',
  };
  const sourceHashes = Object.fromEntries(await Promise.all(
    Object.entries(sourceFiles)
      .filter(([, file]) => !file.includes('mirrored'))
      .map(async ([key, file]) => [key, crypto.createHash('sha256').update(await fs.readFile(path.resolve(cwd, file))).digest('hex')]),
  ));
  const evidence = {
    capture: 'Formal runtime assets only; candidate mode disabled.',
    viewport: { width: 1280, height: 720 },
    formalAssets,
    sourceFiles,
    sourceHashes,
    player: { ...playerSheet, dataUrl: undefined, sha256: crypto.createHash('sha256').update(playerPng).digest('hex') },
    pets: {
      ...petSheet,
      dataUrl: undefined,
      sha256: crypto.createHash('sha256').update(petPng).digest('hex'),
      cellSha256: {
        catRest: crypto.createHash('sha256').update(Buffer.from(catRest.split(',')[1] ?? '', 'base64')).digest('hex'),
        marsupialRest: crypto.createHash('sha256').update(Buffer.from(marsupialRest.split(',')[1] ?? '', 'base64')).digest('hex'),
      },
    },
  };
  await testInfo.attach('vf15-contact-sheets-evidence.json', {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  });

  if (saveEvidence) {
    const directory = path.resolve(cwd, evidenceDirectory);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'player-four-directions.png'), playerPng);
    await fs.writeFile(path.join(directory, 'pet-silhouettes.png'), petPng);
    await fs.writeFile(path.join(directory, 'evidence.json'), JSON.stringify({
      ...evidence,
      player: { ...evidence.player, contactSheet: 'player-four-directions.png' },
      pets: { ...evidence.pets, contactSheet: 'pet-silhouettes.png' },
    }, null, 2) + '\n');
  }
});
