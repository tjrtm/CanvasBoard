// minimap.js — Mini-map widget showing all objects and viewport indicator

export class MinimapManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this.visible = true;
    this._rafId = null;
    this._dirty = true;
    this._mmCanvas = null;
    this._mmCtx = null;
    this._dragging = false;
    this._dragStart = null;
    this._vpStart = null;
  }

  init() {
    this._mmCanvas = document.getElementById('minimap-canvas');
    this._mmCtx = this._mmCanvas.getContext('2d');

    // Mark dirty on canvas changes
    const dirty = () => { this._dirty = true; };
    this.canvas.on('object:added',    dirty);
    this.canvas.on('object:removed',  dirty);
    this.canvas.on('object:modified', dirty);
    this.canvas.on('after:render',    dirty);

    document.addEventListener('canvas:viewport-changed', () => { this._dirty = true; });

    // Click and drag on minimap to navigate
    this._mmCanvas.addEventListener('mousedown', (e) => this._onMinimapMouseDown(e));
    this._mmCanvas.addEventListener('mousemove', (e) => this._onMinimapMouseMove(e));
    this._mmCanvas.addEventListener('mouseup',   ()  => this._onMinimapMouseUp());
    this._mmCanvas.addEventListener('mouseleave', () => this._dragging = false);

    // Start render loop
    this._renderLoop();
  }

  toggle() {
    this.visible = !this.visible;
    const container = document.getElementById('minimap-container');
    if (container) container.classList.toggle('hidden', !this.visible);
  }

  // ─── Render loop ───────────────────────────────────────────────────────────

  _renderLoop() {
    this._rafId = requestAnimationFrame(() => this._renderLoop());
    if (!this._dirty || !this.visible) return;
    this._dirty = false;
    this._render();
  }

  _render() {
    const mc = this._mmCanvas;
    const ctx = this._mmCtx;
    const mw = mc.width;
    const mh = mc.height;
    const isDark = this.app.canvasManager.isDark;

    ctx.clearRect(0, 0, mw, mh);

    // Background
    ctx.fillStyle = isDark ? '#0d1520' : '#e8eaed';
    ctx.fillRect(0, 0, mw, mh);

    const objects = this.canvas.getObjects();
    if (objects.length === 0) {
      this._drawViewportIndicator(ctx, mw, mh, 0, 0, 1);
      return;
    }

    // Find world bounding box of all objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      const b = obj.getBoundingRect(true, true);
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    });

    // Expand with viewport area
    const vt = this.canvas.viewportTransform;
    const zoom = this.canvas.getZoom();
    const vpL = -vt[4] / zoom;
    const vpT = -vt[5] / zoom;
    const vpR = vpL + this.canvas.width / zoom;
    const vpB = vpT + this.canvas.height / zoom;

    const worldMinX = Math.min(minX, vpL);
    const worldMinY = Math.min(minY, vpT);
    const worldMaxX = Math.max(maxX, vpR);
    const worldMaxY = Math.max(maxY, vpB);

    const worldW = worldMaxX - worldMinX;
    const worldH = worldMaxY - worldMinY;
    if (worldW <= 0 || worldH <= 0) return;

    const pad = 6;
    const scaleX = (mw - pad * 2) / worldW;
    const scaleY = (mh - pad * 2) / worldH;
    const scale = Math.min(scaleX, scaleY);

    // Store for click-to-navigate
    this._worldBounds = { minX: worldMinX, minY: worldMinY, scale, offsetX: pad, offsetY: pad };

    const toMM = (wx, wy) => ({
      x: (wx - worldMinX) * scale + pad,
      y: (wy - worldMinY) * scale + pad,
    });

    // Draw objects as small rects
    objects.forEach(obj => {
      const b = obj.getBoundingRect(true, true);
      const p = toMM(b.left, b.top);
      const pw = b.width * scale;
      const ph = b.height * scale;

      let fillColor = isDark ? 'rgba(100,150,220,0.7)' : 'rgba(60,120,200,0.7)';

      // Try to get object color
      if (obj.fill && obj.fill !== 'transparent') {
        fillColor = obj.fill;
      }
      if (obj.type === 'group' && obj.data && obj.data.color) {
        fillColor = obj.data.color;
      }
      if (obj.type === 'i-text' || obj.type === 'textbox') {
        fillColor = isDark ? 'rgba(200,200,220,0.8)' : 'rgba(80,80,100,0.8)';
      }
      if (obj.type === 'path') {
        fillColor = obj.stroke || (isDark ? '#aaa' : '#555');
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(p.x, p.y, Math.max(2, pw), Math.max(2, ph));
    });

    // Draw viewport indicator
    const vpP = toMM(vpL, vpT);
    const vpW = (vpR - vpL) * scale;
    const vpH = (vpB - vpT) * scale;

    ctx.strokeStyle = isDark ? '#4a90e2' : '#1976d2';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpP.x, vpP.y, vpW, vpH);

    ctx.fillStyle = isDark ? 'rgba(74,144,226,0.08)' : 'rgba(33,150,243,0.08)';
    ctx.fillRect(vpP.x, vpP.y, vpW, vpH);
  }

  _drawViewportIndicator(ctx, mw, mh, x, y, scale) {
    ctx.strokeStyle = 'rgba(74,144,226,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(2, 2, mw - 4, mh - 4);
  }

  // ─── Navigation by clicking on minimap ─────────────────────────────────────

  _onMinimapMouseDown(e) {
    this._dragging = true;
    this._dragStart = { x: e.offsetX, y: e.offsetY };
    const vt = this.canvas.viewportTransform;
    this._vpStart = { x: vt[4], y: vt[5] };
    this._navigateTo(e.offsetX, e.offsetY);
  }

  _onMinimapMouseMove(e) {
    if (!this._dragging) return;
    this._navigateTo(e.offsetX, e.offsetY);
  }

  _onMinimapMouseUp() {
    this._dragging = false;
    this._dragStart = null;
    this._vpStart = null;
  }

  _navigateTo(mx, my) {
    if (!this._worldBounds) return;
    const { minX, minY, scale, offsetX, offsetY } = this._worldBounds;

    // Convert minimap coords to world coords
    const wx = (mx - offsetX) / scale + minX;
    const wy = (my - offsetY) / scale + minY;

    // Center viewport on that world point
    const zoom = this.canvas.getZoom();
    const panX = -(wx * zoom) + this.canvas.width / 2;
    const panY = -(wy * zoom) + this.canvas.height / 2;

    this.canvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
    this.app.canvasManager.updateZoomDisplay();
  }
}
