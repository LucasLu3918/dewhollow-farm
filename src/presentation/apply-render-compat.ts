import Phaser from 'phaser';
import {
  isSoftwareRenderer,
  parseCompatOverride,
  readRendererName,
  shouldUseTextureWorkaround,
  type RenderCompatInfo,
} from './render-compat';

/** 場景從 `registry` 讀取套用結果時用的鍵。 */
export const RENDER_COMPAT_KEY = 'renderCompat';

/**
 * 遊戲啟動後呼叫一次：偵測軟體繪圖器，必要時把每批貼圖數限制為 1（Phaser 的官方 API
 * `setMaxParallelTextureUnits`），並把結果寫進 `registry`。只有 WebGL 繪圖器需要處理。
 */
export function applyRenderCompat(game: Phaser.Game, search: string = window.location.search): RenderCompatInfo {
  const override = parseCompatOverride(search);
  const base = { override, software: false, workaround: false, renderer: 'canvas', textureUnits: 0, maxTextureUnits: 0 };

  if (game.renderer.type !== Phaser.WEBGL) {
    game.registry.set(RENDER_COMPAT_KEY, base);
    return base;
  }

  const webgl = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  const renderer = readRendererName(webgl.gl) ?? 'unknown';
  const workaround = shouldUseTextureWorkaround(renderer, override);
  if (workaround) webgl.renderNodes.setMaxParallelTextureUnits(1);

  const info: RenderCompatInfo = {
    renderer,
    software: isSoftwareRenderer(renderer),
    workaround,
    override,
    textureUnits: webgl.renderNodes.maxParallelTextureUnits,
    maxTextureUnits: webgl.maxTextures,
  };
  if (workaround) {
    const why = override === 'on' ? '依網址 ?compat=1 強制啟用' : '偵測到軟體繪圖器';
    console.info(`[render] ${why}（${renderer}），每批貼圖數限制為 1 以避免畫面破損`);
  }
  game.registry.set(RENDER_COMPAT_KEY, info);
  return info;
}
