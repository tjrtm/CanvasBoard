// canvas.js — Fabric.js canvas setup: infinite pan/zoom, grid background
export class CanvasManager {
  constructor(canvasId) {
    this.canvasId = canvasId;
    this.isDark = true;
    this.gridVisible = true;
    this.snapToGrid = false;
    this.gridSize = 40;
    this.minZoom = 0.1;
    this.maxZoom = 4.0;

    this._isPanning = false;
    this._isSpaceDown = false;
    this._lastPanPoint = null;
    this._panButton = -1;

    this.canvas = null;
    this.gridCanvas = null;
    this.gridCtx = null;

    this._init();
  }

  _init() {
    const area = document.getElementById('canvas-area');
    const w = area.clientWidth;
    const h = area.clientHeight;

    // Set up grid canvas
    this.gridCanvas = document.getElementById('grid-canvas');
    this.gridCanvas.width = w;
    this.gridCanvas.height = h;
    this.gridCtx = this.gridCanvas.getContext('2d');

    // Initialize Fabric.js canvas (transparent so grid shows through)
    this.canvas = new fabric.Canvas(this.canvasId, {
      width: w,
      height: h,
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      enableRetinaScaling: true,
      stopContextMenu: true,
      fireRightClick: true,
    });

    // After fabric wraps the canvas, position canvas-container above grid
    const container = area.querySelector('.canvas-container');
    if (container) {
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '1';
    }

    // Initial grid draw
    this.drawGrid();

    // Redraw grid whenever viewport or objects change
    this.canvas.on('after:render', () => this.drawGrid());

    this._setupPan();
    this._setupZoom();
    this._setupResize();
    this._setupSnap();
    this._setupRightClick();

    this.updateZoomDisplay();
  }

  // ─── Grid ──────────────────────────────────────────────────────────────────

  drawGrid() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const vt = this.canvas.viewportTransform;
    const zoom = this.canvas.getZoom();
    const panX = vt[4];
    const panY = vt[5];

    const ctx = this.gridCtx;
    ctx.clearRect(0, 0, w, h);

    // Background fill
    ctx.fillStyle = this.isDark ? '#1a1a2e' : '#f0f2f5';
    ctx.fillRect(0, 0, w, h);

    if (!this.gridVisible) return;

    // Adaptive dot spacing: base 40px, adjust for zoom
    let spacing = this.gridSize * zoom;
    while (spacing < 14) spacing *= 2;
    while (spacing > 80) spacing /= 2;

    const dotRadius = Math.max(0.8, Math.min(1.8, zoom * 1.2));
    const dotAlpha = this.isDark ? 0.45 : 0.35;
    ctx.fillStyle = this.isDark
      ? `rgba(120,130,160,${dotAlpha})`
      : `rgba(140,140,160,${dotAlpha})`;

    // Offset so dots stay in place when panning
    const startX = ((panX % spacing) + spacing) % spacing;
    const startY = ((panY % spacing) + spacing) % spacing;

    for (let x = startX; x < w; x += spacing) {
      for (let y = startY; y < h; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ─── Pan ───────────────────────────────────────────────────────────────────

  _setupPan() {
    const canvas = this.canvas;
    const area = document.getElementById('canvas-area');

    // Track spacebar globally
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !_isTyping(e)) {
        if (!this._isSpaceDown) {
          this._isSpaceDown = true;
          if (!this._isPanning) {
            area.style.cursor = 'grab';
            canvas.defaultCursor = 'grab';
            canvas.hoverCursor = 'grab';
          }
        }
        // Prevent page scroll
        e.preventDefault();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._isSpaceDown = false;
        if (!this._isPanning) {
          this._resetCursor();
        }
      }
    });

    canvas.on('mouse:down', (opt) => {
      const e = opt.e;
      const isMiddle = e.button === 1;
      const isSpace = this._isSpaceDown && e.button === 0;

      if (isMiddle || isSpace) {
        this._isPanning = true;
        this._panButton = e.button;
        this._lastPanPoint = { x: e.clientX, y: e.clientY };
        canvas.selection = false;
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        area.style.cursor = 'grabbing';
        if (isMiddle) e.preventDefault();
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (!this._isPanning || !this._lastPanPoint) return;
      const e = opt.e;
      const dx = e.clientX - this._lastPanPoint.x;
      const dy = e.clientY - this._lastPanPoint.y;
      canvas.relativePan(new fabric.Point(dx, dy));
      this._lastPanPoint = { x: e.clientX, y: e.clientY };
      this.updateZoomDisplay();
    });

    canvas.on('mouse:up', (opt) => {
      if (this._isPanning) {
        this._isPanning = false;
        this._lastPanPoint = null;
        this._panButton = -1;
        canvas.selection = true;
        if (!this._isSpaceDown) this._resetCursor();
        else {
          canvas.defaultCursor = 'grab';
          canvas.hoverCursor = 'grab';
          document.getElementById('canvas-area').style.cursor = 'grab';
        }
      }
    });

    // Handle middle-mouse on the canvas element directly to prevent default scroll
    canvas.upperCanvasEl.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });
  }

  _resetCursor() {
    this.canvas.defaultCursor = 'default';
    this.canvas.hoverCursor = 'move';
    document.getElementById('canvas-area').style.cursor = '';
  }

  // ─── Zoom ──────────────────────────────────────────────────────────────────

  _setupZoom() {
    const canvas = this.canvas;

    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e;
      e.preventDefault();
      e.stopPropagation();

      let zoom = canvas.getZoom();
      let delta = e.deltaY;

      if (e.ctrlKey) {
        // Pinch gesture / Ctrl+scroll (fine)
        zoom *= 0.98 ** delta;
      } else {
        // Regular scroll
        zoom *= 0.999 ** delta;
      }

      zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), zoom);
      this.updateZoomDisplay();
    });
  }

  // ─── Resize ────────────────────────────────────────────────────────────────

  _setupResize() {
    const resize = this._debounce(() => {
      const area = document.getElementById('canvas-area');
      const w = area.clientWidth;
      const h = area.clientHeight;
      this.canvas.setWidth(w);
      this.canvas.setHeight(h);
      this.gridCanvas.width = w;
      this.gridCanvas.height = h;
      this.canvas.renderAll();
    }, 100);

    window.addEventListener('resize', resize);
  }

  // ─── Grid snapping ─────────────────────────────────────────────────────────

  _setupSnap() {
    this.canvas.on('object:moving', (opt) => {
      if (!this.snapToGrid) return;
      const obj = opt.target;
      const snap = this.gridSize;
      obj.set({
        left: Math.round(obj.left / snap) * snap,
        top: Math.round(obj.top / snap) * snap,
      });
    });
  }

  // ─── Right click → context menu ────────────────────────────────────────────

  _setupRightClick() {
    this.canvas.on('mouse:down', (opt) => {
      if (opt.e.button === 2) {
        document.dispatchEvent(new CustomEvent('canvas:contextmenu', {
          detail: { e: opt.e, target: opt.target }
        }));
      }
    });
  }

  // ─── Zoom helpers ──────────────────────────────────────────────────────────

  updateZoomDisplay() {
    const zoom = this.canvas.getZoom();
    const el = document.getElementById('zoom-display');
    if (el) el.textContent = Math.round(zoom * 100) + '%';

    // Notify minimap
    document.dispatchEvent(new CustomEvent('canvas:viewport-changed'));
  }

  zoomTo(zoom) {
    zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height / 2;
    this.canvas.zoomToPoint(new fabric.Point(cx, cy), zoom);
    this.updateZoomDisplay();
  }

  zoomIn() { this.zoomTo(this.canvas.getZoom() * 1.2); }
  zoomOut() { this.zoomTo(this.canvas.getZoom() / 1.2); }

  resetZoom() {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.updateZoomDisplay();
  }

  fitToContent() {
    const objects = this.canvas.getObjects().filter(o => o.type !== 'grid');
    if (objects.length === 0) { this.resetZoom(); return; }

    this.canvas.discardActiveObject();
    this.canvas.renderAll();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      const b = obj.getBoundingRect(true, true);
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    });

    const pad = 60;
    const cw = this.canvas.width, ch = this.canvas.height;
    const contentW = maxX - minX + pad * 2;
    const contentH = maxY - minY + pad * 2;
    const zoom = Math.max(this.minZoom, Math.min(this.maxZoom,
      Math.min(cw / contentW, ch / contentH)));

    this.canvas.setZoom(zoom);
    const panX = -(minX - pad) * zoom + (cw - (maxX - minX) * zoom) / 2;
    const panY = -(minY - pad) * zoom + (ch - (maxY - minY) * zoom) / 2;
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, panX, panY]);
    this.updateZoomDisplay();
  }

  // ─── Theme ─────────────────────────────────────────────────────────────────

  toggleTheme() {
    this.isDark = !this.isDark;
    document.body.classList.toggle('light-theme', !this.isDark);
    this.canvas.renderAll(); // triggers after:render → drawGrid
  }

  setGridSnap(on) { this.snapToGrid = on; }
  toggleGrid() {
    this.gridVisible = !this.gridVisible;
    this.canvas.renderAll();
  }

  // ─── Canvas coord helpers ──────────────────────────────────────────────────

  screenToCanvas(x, y) {
    const vt = this.canvas.viewportTransform;
    return {
      x: (x - vt[4]) / vt[0],
      y: (y - vt[5]) / vt[3],
    };
  }

  // ─── Utilities ─────────────────────────────────────────────────────────────

  _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
}

// Helper: is a typing element focused?
function _isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
}
