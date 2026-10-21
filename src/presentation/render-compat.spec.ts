import { describe, expect, it } from 'vitest';
import { isSoftwareRenderer, parseCompatOverride, readRendererName, shouldUseTextureWorkaround } from './render-compat';

describe('isSoftwareRenderer', () => {
  it('recognises the software renderers browsers fall back to', () => {
    const software = [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.6, 256 bits)',
      'Mesa Software Rasterizer',
      'Microsoft Basic Render Driver',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)',
      'softpipe',
    ];
    for (const name of software) expect(isSoftwareRenderer(name), name).toBe(true);
  });

  it('does not flag real graphics hardware', () => {
    const hardware = [
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)',
      'Apple GPU',
      'NVIDIA GeForce RTX 4070/PCIe/SSE2',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Intel(R) UHD Graphics 630',
      'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Adreno (TM) 650',
      'Mali-G78',
    ];
    for (const name of hardware) expect(isSoftwareRenderer(name), name).toBe(false);
  });

  it('ignores letter case', () => {
    expect(isSoftwareRenderer('SWIFTSHADER')).toBe(true);
    expect(isSoftwareRenderer('LlvmPipe')).toBe(true);
  });

  it('treats an unknown or hidden renderer as hardware, so most players keep full speed', () => {
    expect(isSoftwareRenderer(null)).toBe(false);
    expect(isSoftwareRenderer(undefined)).toBe(false);
    expect(isSoftwareRenderer('')).toBe(false);
    expect(isSoftwareRenderer('Mozilla')).toBe(false);
  });
});

describe('parseCompatOverride', () => {
  it('turns the workaround on or off from the address bar', () => {
    expect(parseCompatOverride('?compat=1')).toBe('on');
    expect(parseCompatOverride('?compat=0')).toBe('off');
    expect(parseCompatOverride('?debug=1&compat=1')).toBe('on');
  });

  it('ignores anything else, including an empty string', () => {
    expect(parseCompatOverride('')).toBeNull();
    expect(parseCompatOverride('?compat=yes')).toBeNull();
    expect(parseCompatOverride('?compat=')).toBeNull();
    expect(parseCompatOverride('?other=1')).toBeNull();
  });

  it('uses the first value when it appears twice', () => {
    expect(parseCompatOverride('?compat=1&compat=0')).toBe('on');
  });
});

describe('shouldUseTextureWorkaround', () => {
  const software = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)';
  const hardware = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)';

  it('is on for a software renderer and off for hardware, by default', () => {
    expect(shouldUseTextureWorkaround(software, null)).toBe(true);
    expect(shouldUseTextureWorkaround(hardware, null)).toBe(false);
    expect(shouldUseTextureWorkaround(null, null)).toBe(false);
  });

  it('lets the player force it either way, for example when the browser hides the renderer name', () => {
    expect(shouldUseTextureWorkaround(hardware, 'on')).toBe(true);
    expect(shouldUseTextureWorkaround(null, 'on')).toBe(true);
    expect(shouldUseTextureWorkaround(software, 'off')).toBe(false);
  });
});

describe('readRendererName', () => {
  const EXT = { UNMASKED_RENDERER_WEBGL: 0x9246 };

  it('reads the unmasked renderer name when the browser allows it', () => {
    const gl = {
      getExtension: (name: string) => (name === 'WEBGL_debug_renderer_info' ? EXT : null),
      getParameter: (p: number) => (p === 0x9246 ? 'SwiftShader driver' : 'masked'),
    };
    expect(readRendererName(gl)).toBe('SwiftShader driver');
  });

  it('returns null when the extension is missing or reading fails', () => {
    expect(readRendererName({ getExtension: () => null, getParameter: () => 'x' })).toBeNull();
    expect(
      readRendererName({
        getExtension: () => EXT,
        getParameter: () => {
          throw new Error('denied');
        },
      }),
    ).toBeNull();
  });

  it('returns null for a value that is not text', () => {
    expect(readRendererName({ getExtension: () => EXT, getParameter: () => 42 })).toBeNull();
  });
});
