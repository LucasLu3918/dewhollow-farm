/** Pixel-level measurements for isolated RGBA atlas frames. */

export function measureTileWrapSeams(pixels, atlasWidth, frame) {
  let sampleCount = 0;
  let exactMatchCount = 0;
  let maxChannelDelta = 0;
  let totalChannelDelta = 0;

  const comparePixels = (leftIndex, rightIndex) => {
    let pixelDelta = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const delta = Math.abs(pixels[leftIndex + channel] - pixels[rightIndex + channel]);
      pixelDelta = Math.max(pixelDelta, delta);
      totalChannelDelta += delta;
    }
    sampleCount += 4;
    if (pixelDelta === 0) exactMatchCount += 1;
    maxChannelDelta = Math.max(maxChannelDelta, pixelDelta);
  };

  for (let y = 0; y < frame.height; y += 1) {
    const row = (frame.y + y) * atlasWidth;
    const left = (row + frame.x) * 4;
    const right = (row + frame.x + frame.width - 1) * 4;
    comparePixels(left, right);
  }
  for (let x = 0; x < frame.width; x += 1) {
    const column = frame.x + x;
    const top = (frame.y * atlasWidth + column) * 4;
    const bottom = ((frame.y + frame.height - 1) * atlasWidth + column) * 4;
    comparePixels(top, bottom);
  }

  return {
    pixelPairCount: sampleCount / 4,
    channelSampleCount: sampleCount,
    exactMatchCount,
    maxChannelDelta,
    meanChannelDelta: sampleCount ? Number((totalChannelDelta / sampleCount).toFixed(4)) : 0,
  };
}

export function summarizeFrameAlpha(pixels, atlasWidth, frame) {
  let transparentPixels = 0;
  let partialAlphaPixels = 0;
  let opaquePixels = 0;
  let transparentBorderPixels = 0;

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const alpha = pixels[((frame.y + y) * atlasWidth + frame.x + x) * 4 + 3];
      if (alpha === 0) transparentPixels += 1;
      else if (alpha < 255) partialAlphaPixels += 1;
      else opaquePixels += 1;
      if ((x === 0 || x === frame.width - 1 || y === 0 || y === frame.height - 1) && alpha === 0) {
        transparentBorderPixels += 1;
      }
    }
  }

  return { transparentPixels, partialAlphaPixels, opaquePixels, transparentBorderPixels };
}
