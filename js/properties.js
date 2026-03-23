// properties.js — Right sidebar property panel

const COLOR_PRESETS = [
  '#fff9b1', '#d5f692', '#d0e7ff', '#f9c7cf',
  '#ffd699', '#d8c5f0', '#ff7b7b', '#7ecfc0',
  '#ffffff', '#e6e6e6', '#414141', '#1a1a1a',
];

const STICKY_PRESET_COLORS = [
  { label: 'Yellow', value: '#fff9b1' },
  { label: 'Green',  value: '#d5f692' },
  { label: 'Blue',   value: '#d0e7ff' },
  { label: 'Pink',   value: '#f9c7cf' },
  { label: 'Orange', value: '#ffd699' },
  { label: 'Purple', value: '#d8c5f0' },
];

export class PropertiesPanel {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this._updating = false;
  }

  init() {
    this._buildPresets();
    this._wireInputs();
    this._wireCanvasEvents();
    this._wireActionButtons();
  }

  // ─── Build color preset swatches ───────────────────────────────────────────

  _buildPresets() {
    const fillPresets = document.getElementById('fill-presets');
    if (fillPresets) {
      COLOR_PRESETS.forEach(color => {
        const swatch = this._makeSwatch(color, () => {
          this._setFill(color);
          fillPresets.querySelectorAll('.color-swatch').forEach(s =>
            s.classList.toggle('active', s.dataset.color === color));
        });
        fillPresets.appendChild(swatch);
      });
    }

    const stickyPresets = document.getElementById('sticky-color-presets');
    if (stickyPresets) {
      STICKY_PRESET_COLORS.forEach(({ label, value }) => {
        const swatch = this._makeSwatch(value, () => {
          const obj = this.canvas.getActiveObject();
          if (obj) {
            this.app.shapes.setStickyColor(obj, value);
            this.app.history.saveState();
          }
        }, label);
        stickyPresets.appendChild(swatch);
      });
    }
  }

  _makeSwatch(color, onClick, title) {
    const el = document.createElement('div');
    el.className = 'color-swatch';
    el.style.backgroundColor = color;
    el.dataset.color = color;
    if (title) el.title = title;
    el.addEventListener('click', onClick);
    return el;
  }

  // ─── Canvas event wiring ────────────────────────────────────────────────────

  _wireCanvasEvents() {
    this.canvas.on('selection:created', (e) => this.update(e.selected[0] || e.target));
    this.canvas.on('selection:updated', (e) => this.update(e.selected[0] || e.target));
    this.canvas.on('selection:cleared', () => this.hide());
    this.canvas.on('object:modified', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) this.update(obj);
    });
    this.canvas.on('object:scaling', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) this._updateTransformFields(obj);
    });
    this.canvas.on('object:moving', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) this._updateTransformFields(obj);
    });
    this.canvas.on('object:rotating', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) this._updateTransformFields(obj);
    });
  }

  // ─── Input wiring ───────────────────────────────────────────────────────────

  _wireInputs() {
    const on = (id, event, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    };

    // Position
    on('prop-x', 'change', () => this._applyTransform('x'));
    on('prop-y', 'change', () => this._applyTransform('y'));
    on('prop-w', 'change', () => this._applyTransform('w'));
    on('prop-h', 'change', () => this._applyTransform('h'));
    on('prop-angle', 'change', () => this._applyTransform('angle'));

    // Opacity
    on('prop-opacity', 'input', () => {
      const val = +document.getElementById('prop-opacity').value;
      document.getElementById('prop-opacity-val').textContent = val + '%';
      this._applyStyle('opacity', val / 100);
    });

    // Fill / Stroke
    on('prop-fill', 'input', (e) => this._setFill(e.target.value));
    on('prop-stroke', 'input', (e) => this._applyStyle('stroke', e.target.value));
    on('prop-fill-none', 'click', () => this._setFill('transparent'));
    on('prop-stroke-none', 'click', () => this._applyStyle('stroke', 'transparent'));

    on('prop-stroke-width', 'input', () => {
      const val = +document.getElementById('prop-stroke-width').value;
      document.getElementById('prop-stroke-width-val').textContent = val;
      this._applyStyle('strokeWidth', val);
    });

    on('prop-radius', 'input', () => {
      const val = +document.getElementById('prop-radius').value;
      document.getElementById('prop-radius-val').textContent = val;
      const obj = this.canvas.getActiveObject();
      if (obj && obj.type === 'rect') {
        obj.set({ rx: val, ry: val });
        this.canvas.renderAll();
      }
    });
    on('prop-radius', 'change', () => this.app.history.saveState());

    // Text
    on('prop-text-color', 'input', (e) => this._applyStyle('fill', e.target.value));
    on('prop-font-size', 'change', () => {
      const val = +document.getElementById('prop-font-size').value;
      this._applyStyle('fontSize', val);
    });
    on('prop-bold', 'click', () => {
      const obj = this.canvas.getActiveObject();
      if (!obj) return;
      const isBold = obj.fontWeight === 'bold';
      this._applyStyle('fontWeight', isBold ? 'normal' : 'bold');
      document.getElementById('prop-bold').dataset.active = String(!isBold);
    });
    on('prop-italic', 'click', () => {
      const obj = this.canvas.getActiveObject();
      if (!obj) return;
      const isItalic = obj.fontStyle === 'italic';
      this._applyStyle('fontStyle', isItalic ? 'normal' : 'italic');
      document.getElementById('prop-italic').dataset.active = String(!isItalic);
    });

    document.querySelectorAll('.text-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._applyStyle('textAlign', btn.dataset.align);
        document.querySelectorAll('.text-align-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.align === btn.dataset.align));
      });
    });

    // Shape text color
    on('prop-shape-text-color', 'input', (e) => {
      const obj = this.canvas.getActiveObject();
      if (!obj || obj.type !== 'group') return;
      const txtObj = obj.getObjects().find(o => o.type === 'textbox' || o.type === 'i-text');
      if (txtObj) {
        txtObj.set('fill', e.target.value);
        this.canvas.renderAll();
      }
    });
    on('prop-shape-text-color', 'change', () => {
      this.app.history.saveState();
    });

    // Line props
    on('prop-line-style', 'change', () => {
      const val = document.getElementById('prop-line-style').value;
      const obj = this.canvas.getActiveObject();
      if (obj) this.app.connectors.setLineStyle(obj, val);
    });
    on('prop-arrow-end', 'change', () => {
      const obj = this.canvas.getActiveObject();
      if (obj) this.app.connectors.toggleArrow(obj);
    });
    on('prop-route-mode', 'change', () => {
      const obj = this.canvas.getActiveObject();
      if (obj && obj.data && obj.data.connId) {
        const rec = this.app.connectors.connections.get(obj.data.connId);
        if (rec) {
          rec.mode = document.getElementById('prop-route-mode').value;
          this.app.connectors._rebuildLine(rec);
          this.canvas.renderAll();
          this.app.history.saveState();
        }
      }
    });
  }

  // ─── Action buttons (arrange etc.) ─────────────────────────────────────────

  _wireActionButtons() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    on('btn-to-front', () => this.app.selection.bringToFront());
    on('btn-to-back', () => this.app.selection.sendToBack());
    on('btn-fwd', () => this.app.selection.bringForward());
    on('btn-bwd', () => this.app.selection.sendBackward());
    on('btn-group', () => this.app.selection.group());
    on('btn-ungroup', () => this.app.selection.ungroup());
    on('btn-delete', () => this.app.selection.deleteSelected());
    on('btn-duplicate', () => this.app.selection.duplicate());
  }

  // ─── Style helpers ──────────────────────────────────────────────────────────

  _setFill(color) {
    const obj = this.canvas.getActiveObject();
    if (!obj) return;

    if (obj.type === 'group' && obj.data) {
      const type = obj.data.type;
      if (type === 'sticky') {
        this.app.shapes.setStickyColor(obj, color);
      } else if (['rect', 'circle', 'diamond', 'triangle'].includes(type)) {
        this.app.shapes.setShapeFill(obj, color);
      }
    } else if (obj.type === 'activeSelection') {
      obj.getObjects().forEach(o => {
        if (o.type === 'group' && o.data &&
            ['rect', 'circle', 'diamond', 'triangle', 'sticky'].includes(o.data.type)) {
          this.app.shapes.setShapeFill(o, color);
        } else {
          o.set('fill', color);
        }
      });
    } else {
      obj.set('fill', color);
    }
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  _applyStyle(prop, value) {
    if (this._updating) return;
    const obj = this.canvas.getActiveObject();
    if (!obj) return;

    if (obj.type === 'activeSelection') {
      obj.getObjects().forEach(o => o.set(prop, value));
    } else {
      obj.set(prop, value);
    }
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  _applyTransform(type) {
    if (this._updating) return;
    const obj = this.canvas.getActiveObject();
    if (!obj) return;

    const x = parseFloat(document.getElementById('prop-x').value);
    const y = parseFloat(document.getElementById('prop-y').value);
    const w = parseFloat(document.getElementById('prop-w').value);
    const h = parseFloat(document.getElementById('prop-h').value);
    const angle = parseFloat(document.getElementById('prop-angle').value);

    if (type === 'x' || type === 'y') {
      obj.set({ left: x, top: y });
    } else if (type === 'w' || type === 'h') {
      const scaleX = w / (obj.width || 1);
      const scaleY = h / (obj.height || 1);
      obj.set({ scaleX, scaleY });
    } else if (type === 'angle') {
      obj.set('angle', angle);
    }

    obj.setCoords();
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  // ─── Show / Hide / Update ──────────────────────────────────────────────────

  hide() {
    document.getElementById('props-placeholder').classList.remove('hidden');
    document.getElementById('props-content').classList.add('hidden');
  }

  update(obj) {
    if (!obj) { this.hide(); return; }

    this._updating = true;
    document.getElementById('props-placeholder').classList.add('hidden');
    document.getElementById('props-content').classList.remove('hidden');

    this._updateTransformFields(obj);
    this._updateStyleFields(obj);
    this._updateTypeSpecificFields(obj);

    this._updating = false;
  }

  _updateTransformFields(obj) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = Math.round(val * 10) / 10;
    };

    const b = obj.getBoundingRect(true, true);
    setVal('prop-x', obj.left || 0);
    setVal('prop-y', obj.top || 0);
    setVal('prop-w', b.width);
    setVal('prop-h', b.height);
    setVal('prop-angle', Math.round(obj.angle || 0));

    const opacityEl = document.getElementById('prop-opacity');
    const opacityVal = document.getElementById('prop-opacity-val');
    const op = Math.round((obj.opacity !== undefined ? obj.opacity : 1) * 100);
    if (opacityEl) opacityEl.value = op;
    if (opacityVal) opacityVal.textContent = op + '%';
  }

  _updateStyleFields(obj) {
    const setColor = (id, val) => {
      const el = document.getElementById(id);
      if (el && val && val !== 'transparent') {
        try { el.value = this._toHexColor(val); } catch {}
      }
    };

    // Fill: for shape groups, read from the background sub-object
    if (obj.type === 'group' && obj.data &&
        ['rect', 'circle', 'diamond', 'triangle', 'sticky'].includes(obj.data.type)) {
      const bgFill = this.app.shapes.getShapeFill(obj);
      if (bgFill) setColor('prop-fill', bgFill);
    } else {
      setColor('prop-fill', obj.fill);
    }
    setColor('prop-stroke', obj.stroke);

    const sw = document.getElementById('prop-stroke-width');
    const swv = document.getElementById('prop-stroke-width-val');
    if (sw) { sw.value = obj.strokeWidth || 0; }
    if (swv) swv.textContent = obj.strokeWidth || 0;

    const rx = document.getElementById('prop-radius');
    const rxv = document.getElementById('prop-radius-val');
    const borderRadiusRow = document.getElementById('border-radius-row');
    if (obj.type === 'rect' && borderRadiusRow) {
      borderRadiusRow.classList.remove('hidden');
      if (rx) rx.value = obj.rx || 0;
      if (rxv) rxv.textContent = obj.rx || 0;
    } else if (borderRadiusRow) {
      borderRadiusRow.classList.add('hidden');
    }
  }

  _updateTypeSpecificFields(obj) {
    const textProps = document.getElementById('text-props');
    const stickyProps = document.getElementById('sticky-props');
    const shapeTextProps = document.getElementById('shape-text-props');
    const lineProps = document.getElementById('line-props');
    const styleProps = document.getElementById('style-props');

    // Hide all type-specific by default
    [textProps, stickyProps, shapeTextProps, lineProps].forEach(el => {
      if (el) el.classList.add('hidden');
    });

    const isText = obj.type === 'i-text' || obj.type === 'textbox';
    const isShapeGroup = obj.type === 'group' && obj.data &&
        ['rect', 'circle', 'diamond', 'triangle', 'sticky'].includes(obj.data.type);
    const isSticky = obj.type === 'group' && obj.data && obj.data.type === 'sticky';
    const isLine = (obj.type === 'line' || obj.type === 'path') &&
                   obj.data && (obj.data.type === 'line' || obj.data.type === 'connection');

    // Standalone text objects
    if (isText && textProps) {
      textProps.classList.remove('hidden');
      const fsEl = document.getElementById('prop-font-size');
      if (fsEl) fsEl.value = obj.fontSize || 18;
      const boldBtn = document.getElementById('prop-bold');
      if (boldBtn) boldBtn.dataset.active = String(obj.fontWeight === 'bold');
      const italicBtn = document.getElementById('prop-italic');
      if (italicBtn) italicBtn.dataset.active = String(obj.fontStyle === 'italic');
      const textColorEl = document.getElementById('prop-text-color');
      if (textColorEl && obj.fill) {
        try { textColorEl.value = this._toHexColor(obj.fill); } catch {}
      }
      document.querySelectorAll('.text-align-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.align === (obj.textAlign || 'left')));
    }

    // Shape groups (rect, circle, diamond, triangle, sticky) — show text color picker
    if (isShapeGroup && shapeTextProps) {
      shapeTextProps.classList.remove('hidden');
      const txtObj = obj.getObjects().find(o => o.type === 'textbox' || o.type === 'i-text');
      const colorEl = document.getElementById('prop-shape-text-color');
      if (txtObj && colorEl && txtObj.fill) {
        try { colorEl.value = this._toHexColor(txtObj.fill); } catch {}
      }
    }

    // Sticky note color presets
    if (isSticky && stickyProps) {
      stickyProps.classList.remove('hidden');
    }

    if (isLine && lineProps) {
      lineProps.classList.remove('hidden');
      const lsEl = document.getElementById('prop-line-style');
      if (lsEl) lsEl.value = (obj.data && obj.data.style) || 'solid';
      const arrowEl = document.getElementById('prop-arrow-end');
      if (arrowEl) arrowEl.checked = !!(obj.data && obj.data.arrow);

      // Show routing mode only for connections
      const routeRow = document.getElementById('routing-mode-row');
      const routeEl = document.getElementById('prop-route-mode');
      if (obj.data && obj.data.connId && routeRow) {
        routeRow.classList.remove('hidden');
        const rec = this.app.connectors.connections.get(obj.data.connId);
        if (rec && routeEl) routeEl.value = rec.mode || 'straight';
      } else if (routeRow) {
        routeRow.classList.add('hidden');
      }
    }
  }

  _toHexColor(color) {
    if (!color || color === 'transparent') return '#000000';
    if (color.startsWith('#')) return color.length === 4
      ? '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3]
      : color;
    // Handle rgb(...)
    const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      return '#' + [m[1], m[2], m[3]]
        .map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
    }
    return '#000000';
  }
}
