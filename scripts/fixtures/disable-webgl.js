// A browser-only fixture for verifying the readable fallback, never shipped by Vite.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (type, ...args) {
  if (/^(webgl2?|experimental-webgl)$/.test(type)) return null;
  return originalGetContext.call(this, type, ...args);
};
