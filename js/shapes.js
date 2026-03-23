// shapes.js — Shape creation: rect, circle, diamond, triangle, sticky, frame
// All shapes (except frame) are Groups: [backgroundShape, textbox]
// Double-click to edit text; text auto-fits within the shape.

const DEFAULT_FILL_DARK  = '#4a90e2';
const DEFAULT_FILL_LIGHT = '#2196f3';
const DEFAULT_STROKE     = 'transparent';
const DEFAULT_STROKE_W   = 0;
const TEXT_PADDING        = 12;
const DEFAULT_FONT_SIZE   = 16;
const MIN_FONT_SIZE       = 8;

const STICKY_COLORS = {
  yellow: '#fff9b1',
  green:  '#d5f692',
  blue:   '#d0e7ff',
  pink:   '#f9c7cf',
  orange: '#ffd699',
  purple: '#d8c5f0',
};

export class ShapeManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
  }

  get isDark() { return this.app.canvasManager.isDark; }

  get defaultFill() {
    return this.isDark ? DEFAULT_FILL_DARK : DEFAULT_FILL_LIGHT;
  }

  get textColor() {
    return this.isDark ? '#ffffff' : '#ffffff';
  }

  // ─── Generic shape dispatcher ───────────────────────────────────────────────

  createShape(type, x, y, w, h) {
    switch (type) {
      case 'rect':     return this._createShapeGroup('rect', x, y, w, h);
      case 'circle':   return this._createShapeGroup('circle', x, y, w, h);
      case 'diamond':  return this._createShapeGroup('diamond', x, y, w, h);
      case 'triangle': return this._createShapeGroup('triangle', x, y, w, h);
      case 'frame':    return this.createFrame(x, y, w, h);
      default:         return this._createShapeGroup('rect', x, y, w, h);
    }
  }

  // ─── Unified shape+text group builder ───────────────────────────────────────

  _createShapeGroup(type, x, y, w, h) {
    const bg = this._createBackground(type, w, h);
    const textWidth = this._getTextWidth(type, w, h);

    const txt = new fabric.Textbox('', {
      width: textWidth,
      fontSize: DEFAULT_FONT_SIZE,
      fill: this.textColor,
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      editable: true,
      splitByGrapheme: false,
    });

    const group = new fabric.Group([bg, txt], {
      left: x,
      top: y,
      subTargetCheck: true,
      data: { type: type, text: '' },
    });

    return group;
  }

  _createBackground(type, w, h) {
    const fill = this.defaultFill;

    switch (type) {
      case 'rect':
        return new fabric.Rect({
          width: w,
          height: h,
          fill: fill,
          stroke: DEFAULT_STROKE,
          strokeWidth: DEFAULT_STROKE_W,
          rx: 4,
          ry: 4,
          originX: 'center',
          originY: 'center',
        });

      case 'circle':
        return new fabric.Ellipse({
          rx: w / 2,
          ry: h / 2,
          fill: fill,
          stroke: DEFAULT_STROKE,
          strokeWidth: DEFAULT_STROKE_W,
          originX: 'center',
          originY: 'center',
        });

      case 'diamond': {
        const hw = w / 2, hh = h / 2;
        const points = [
          { x: 0, y: -hh },
          { x: hw, y: 0 },
          { x: 0, y: hh },
          { x: -hw, y: 0 },
        ];
        return new fabric.Polygon(points, {
          fill: fill,
          stroke: DEFAULT_STROKE,
          strokeWidth: DEFAULT_STROKE_W,
          originX: 'center',
          originY: 'center',
        });
      }

      case 'triangle': {
        const hw = w / 2, hh = h / 2;
        const points = [
          { x: 0, y: -hh },
          { x: hw, y: hh },
          { x: -hw, y: hh },
        ];
        return new fabric.Polygon(points, {
          fill: fill,
          stroke: DEFAULT_STROKE,
          strokeWidth: DEFAULT_STROKE_W,
          originX: 'center',
          originY: 'center',
        });
      }

      default:
        return new fabric.Rect({
          width: w,
          height: h,
          fill: fill,
          stroke: DEFAULT_STROKE,
          strokeWidth: DEFAULT_STROKE_W,
          rx: 4,
          ry: 4,
          originX: 'center',
          originY: 'center',
        });
    }
  }

  /**
   * Get available text width for a shape type.
   * Diamonds/triangles have less usable area.
   */
  _getTextWidth(type, w, h) {
    const pad = TEXT_PADDING * 2;
    switch (type) {
      case 'diamond':  return Math.max(20, w * 0.55 - pad);
      case 'triangle': return Math.max(20, w * 0.6 - pad);
      case 'circle':   return Math.max(20, w * 0.7 - pad);
      default:         return Math.max(20, w - pad);
    }
  }

  // ─── Text editing (called from tools.js on double-click) ───────────────────

  editShapeText(group) {
    if (!group || group.type !== 'group') return;
    const shapeType = group.data && group.data.type;
    if (!shapeType || shapeType === 'frame') return;

    const txtObj = group.getObjects().find(
      o => o.type === 'textbox' || o.type === 'i-text'
    );
    if (!txtObj) return;

    // Remove any existing overlay
    const existing = document.querySelector('.shape-text-overlay');
    if (existing) existing.remove();

    const canvas = this.canvas;
    const zoom = canvas.getZoom();
    const vt = canvas.viewportTransform;
    const area = document.getElementById('canvas-area');
    const areaRect = area.getBoundingClientRect();

    // Get group center in world coords, then to screen coords
    const groupCenter = group.getCenterPoint();
    const screenX = groupCenter.x * zoom + vt[4];
    const screenY = groupCenter.y * zoom + vt[5];

    // Get group dimensions on screen
    const bounds = group.getBoundingRect();
    const textAreaW = Math.max(100, bounds.width * 0.85);
    const textAreaH = Math.max(40, bounds.height * 0.6);

    // Create overlay textarea — positioned inside canvas-area
    const overlay = document.createElement('div');
    overlay.className = 'shape-text-overlay';
    overlay.style.cssText = [
      'position: absolute',
      'left: ' + (screenX - textAreaW / 2) + 'px',
      'top: ' + (screenY - textAreaH / 2) + 'px',
      'width: ' + textAreaW + 'px',
      'min-height: ' + textAreaH + 'px',
      'z-index: 500',
      'display: flex',
      'align-items: center',
      'justify-content: center',
    ].join(';');

    const textarea = document.createElement('textarea');
    textarea.className = 'shape-text-input';
    textarea.value = txtObj.text || '';
    textarea.placeholder = 'Type here...';
    const fontSize = Math.max(12, Math.min(20, DEFAULT_FONT_SIZE * zoom));
    textarea.style.cssText = [
      'width: 100%',
      'min-height: ' + Math.max(36, textAreaH) + 'px',
      'background: rgba(0,0,0,0.8)',
      'border: 2px solid #4a90e2',
      'border-radius: 6px',
      'color: #fff',
      'font-family: Inter, system-ui, sans-serif',
      'font-size: ' + fontSize + 'px',
      'text-align: center',
      'padding: 8px 12px',
      'resize: none',
      'outline: none',
      'overflow: hidden',
      'line-height: 1.4',
    ].join(';');

    overlay.appendChild(textarea);
    area.appendChild(overlay);

    // Keep the group selected but stop canvas from intercepting keys
    canvas.discardActiveObject();
    canvas.renderAll();

    // Focus with a small delay to ensure DOM is ready
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.select();
    });

    // Auto-grow textarea height
    const autoGrow = () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };
    textarea.addEventListener('input', autoGrow);
    requestAnimationFrame(autoGrow);

    // Finish editing
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;

      const newText = textarea.value.trim();
      txtObj.set('text', newText);
      if (group.data) group.data.text = newText;

      // Auto-fit font size
      this._autoFitText(group);

      overlay.remove();
      canvas.setActiveObject(group);
      canvas.renderAll();
      this.app.history.saveState();
    };

    textarea.addEventListener('blur', () => {
      // Small delay so click-away doesn't race with keydown handlers
      setTimeout(() => { if (!finished) finish(); }, 50);
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finished = true;
        overlay.remove();
        canvas.setActiveObject(group);
        canvas.renderAll();
        return;
      }
      // Enter without Shift finishes (Shift+Enter = newline)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finish();
        return;
      }
      e.stopPropagation(); // prevent keyboard shortcuts from firing
    });
  }

  /**
   * Auto-fit: shrink font size until text fits within the shape,
   * or use default size if it already fits.
   */
  _autoFitText(group) {
    const objects = group.getObjects();
    const bg = objects[0];
    const txt = objects.find(o => o.type === 'textbox' || o.type === 'i-text');
    if (!txt || !txt.text) return;

    const shapeType = group.data && group.data.type;
    const groupW = group.width;
    const groupH = group.height;
    const availW = this._getTextWidth(shapeType, groupW, groupH);
    const availH = groupH - TEXT_PADDING * 2;

    txt.set('width', availW);

    // Start from default and shrink if needed
    let fontSize = DEFAULT_FONT_SIZE;
    txt.set('fontSize', fontSize);

    // Measure and shrink until it fits (or hit minimum)
    let safety = 0;
    while (fontSize > MIN_FONT_SIZE && safety < 50) {
      txt.set('fontSize', fontSize);
      // Force text layout recalculation
      txt.initDimensions();
      const textH = txt.calcTextHeight();
      if (textH <= availH) break;
      fontSize -= 1;
      safety++;
    }

    txt.set('fontSize', fontSize);
    txt.setCoords();
  }

  // ─── Sticky Note ────────────────────────────────────────────────────────────

  createSticky(x, y, text = 'Double-click to edit', color = STICKY_COLORS.yellow) {
    const w = 200, h = 200;
    const padding = 14;

    const bg = new fabric.Rect({
      width: w,
      height: h,
      fill: color,
      stroke: 'rgba(0,0,0,0.08)',
      strokeWidth: 1,
      rx: 6,
      ry: 6,
      originX: 'center',
      originY: 'center',
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.2)',
        blur: 10,
        offsetX: 2,
        offsetY: 4,
      }),
    });

    const txt = new fabric.Textbox(text, {
      width: w - padding * 2,
      fontSize: 15,
      fill: '#333333',
      fontFamily: 'Inter, system-ui, sans-serif',
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      editable: true,
      splitByGrapheme: false,
    });

    const group = new fabric.Group([bg, txt], {
      left: x,
      top: y,
      subTargetCheck: true,
      data: { type: 'sticky', color, text: text },
    });

    return group;
  }

  // ─── Frame ──────────────────────────────────────────────────────────────────

  createFrame(x, y, w, h) {
    const rect = new fabric.Rect({
      left: x,
      top: y,
      width: w,
      height: h,
      fill: 'rgba(255,255,255,0.03)',
      stroke: '#4a90e2',
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      rx: 4,
      ry: 4,
      originX: 'left',
      originY: 'top',
      data: { type: 'frame' },
    });
    return rect;
  }

  // ─── Sticky color presets ────────────────────────────────────────────────────

  get stickyColors() { return STICKY_COLORS; }

  setStickyColor(group, color) {
    if (!group || group.type !== 'group') return;
    const bg = group.getObjects().find(o =>
      o.type === 'rect' || o.type === 'ellipse' || o.type === 'polygon'
    );
    if (bg) {
      bg.set('fill', color);
      if (group.data) group.data.color = color;
      this.canvas.renderAll();
    }
  }

  /**
   * Set fill color on a shape group's background.
   */
  setShapeFill(group, color) {
    if (!group || group.type !== 'group') return;
    const bg = group.getObjects().find(o =>
      o.type === 'rect' || o.type === 'ellipse' || o.type === 'polygon'
    );
    if (bg) {
      bg.set('fill', color);
      this.canvas.renderAll();
    }
  }

  /**
   * Get fill color from a shape group's background.
   */
  getShapeFill(group) {
    if (!group || group.type !== 'group') return null;
    const bg = group.getObjects().find(o =>
      o.type === 'rect' || o.type === 'ellipse' || o.type === 'polygon'
    );
    return bg ? bg.fill : null;
  }

  // ─── Duplicate object ────────────────────────────────────────────────────────

  duplicateObject(obj) {
    return new Promise(resolve => {
      obj.clone(clone => {
        clone.set({
          left: obj.left + 20,
          top: obj.top + 20,
          data: JSON.parse(JSON.stringify(obj.data || {})),
        });
        resolve(clone);
      }, ['data', 'locked', 'subTargetCheck']);
    });
  }
}
