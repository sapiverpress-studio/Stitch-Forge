/* Verify generated artwork's alpha channel without demanding exact 255-opacity
 * on antialiased or gently translucent painted subjects. This is validation,
 * not background removal: an opaque checkerboard must still be rejected.
 */
(function (root) {
 'use strict';
 const ALMOST_TRANSPARENT = 8;
 const ALMOST_OPAQUE = 245;
 function inspect(rgba, width, height, mode) {
  if (!rgba || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      rgba.length !== width * height * 4 || !['cutout', 'full-design'].includes(mode)) {
   throw Error('Invalid image alpha data');
  }
  const pixels = width * height;
  let transparent = 0, nearlyOpaque = 0, exactlyOpaque = 0;
  for (let i = 3; i < rgba.length; i += 4) {
   const alpha = rgba[i];
   if (alpha <= ALMOST_TRANSPARENT) transparent++;
   if (alpha >= ALMOST_OPAQUE) nearlyOpaque++;
   if (alpha === 255) exactlyOpaque++;
  }
  const corners = [0, width-1, pixels-width, pixels-1];
  const clearCorners = corners.filter(i => rgba[i*4+3] <= ALMOST_TRANSPARENT).length;
  return {
   valid: mode === 'cutout'
    ? transparent > pixels * 0.01 && nearlyOpaque > pixels * 0.01 && clearCorners >= 3
    : exactlyOpaque === pixels,
   transparent, nearlyOpaque, exactlyOpaque, clearCorners, pixels
  };
 }
 const api = Object.freeze({inspect});
 if (typeof module === 'object' && module.exports) module.exports = api;
 else root.StitchForgeAlpha = api;
})(typeof globalThis === 'object' ? globalThis : this);
