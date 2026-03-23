// tools.js — Tool state management and switching
export class ToolManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this.current = 'select';
    this._drawStart = null;
    this._drawRect = null;
    this._lineStart = null;
    this._lineTempObj = null;
  }

  init() {
    this.setTool('select');
    this._wireToolButtons();
    this._wireCanvasEvents();
  }

  setTool(name) {
    const prev = this.current;
    this.current = name;

    // Cleanup previous tool mode
    this._exitTool(prev);

    // Update toolbar UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === name);
    });

    // Configure canvas
    this._enterTool(name);
  }

  _exitTool(name) {
    const canvas = this.canvas;

    if (name === 'pen') {
      canvas.isDrawingMode = false;
    }

    // Clean up port indicators when leaving line tool
    if (name === 'line' && this.app.connectors) {
      this.app.connectors._clearPortDots();
      this._lineSourceSnap = null;
      this._lineTargetSnap = null;
    }

    // Remove temp drawing object
    if (this._drawRect) {
      canvas.remove(this._drawRect);
      this._drawRect = null;
    }
    if (this._lineTempObj) {
      canvas.remove(this._lineTempObj);
      this._lineTempObj = null;
    }
    this._drawStart = null;
    this._lineStart = null;

    // Remove body cursor classes
    document.body.classList.remove(
      'tool-text', 'tool-pen', 'tool-eraser', 'tool-crosshair', 'tool-grab'
    );
  }

  _enterTool(name) {
    const canvas = this.canvas;

    // Reset fabric defaults
    canvas.selection = true;
    canvas.isDrawingMode = false;
    canvas.defaultCursor = 'default';
    canvas.hoverCursor = 'move';

    switch (name) {
      case 'select':
        canvas.selection = true;
        canvas.defaultCursor = 'default';
        canvas.forEachObject(o => {
          if (!o.locked) { o.selectable = true; o.evented = true; }
        });
        break;

      case 'pen':
        canvas.isDrawingMode = true;
        canvas.selection = false;
        if (!canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        }
        canvas.freeDrawingBrush.color = this._getPenColor();
        canvas.freeDrawingBrush.width = 3;
        document.body.classList.add('tool-pen');
        break;

      case 'text':
        canvas.selection = false;
        canvas.defaultCursor = 'text';
        document.body.classList.add('tool-text');
        break;

      case 'eraser':
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        document.body.classList.add('tool-eraser');
        // Make objects react to hover
        canvas.forEachObject(o => { o.hoverCursor = 'not-allowed'; });
        break;

      case 'line':
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        // Disable all object interaction so clicks go to line drawing, not shape dragging
        canvas.forEachObject(o => {
          if (o.data && (o.data._port || o.data._handle)) return;
          o.selectable = false;
          o.evented = false;
        });
        document.body.classList.add('tool-crosshair');
        break;

      default:
        // rect, circle, diamond, triangle, sticky, frame — all draw on drag
        canvas.selection = false;
        canvas.defaultCursor = 'crosshair';
        document.body.classList.add('tool-crosshair');
        break;
    }
  }

  _wireToolButtons() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTool(btn.dataset.tool);
      });
    });
  }

  _wireCanvasEvents() {
    const canvas = this.canvas;

    canvas.on('mouse:down', (opt) => this._onMouseDown(opt));
    canvas.on('mouse:move', (opt) => this._onMouseMove(opt));
    canvas.on('mouse:up',   (opt) => this._onMouseUp(opt));
    canvas.on('mouse:dblclick', (opt) => this._onDblClick(opt));

    // After pen drawing completes
    canvas.on('path:created', (opt) => {
      const path = opt.path;
      path.data = { type: 'pen' };
      this.app.history.saveState();
      this.setTool('select');
    });
  }

  // ─── Mouse events ──────────────────────────────────────────────────────────

  _onMouseDown(opt) {
    if (opt.e.button !== 0) return; // left button only
    const pointer = canvas_getPointer(this.canvas, opt.e);
    const tool = this.current;

    if (tool === 'eraser') {
      if (opt.target && !opt.target.locked) {
        this.canvas.remove(opt.target);
        this.canvas.renderAll();
        this.app.history.saveState();
      }
      return;
    }

    if (tool === 'text') {
      this._placeText(pointer.x, pointer.y);
      return;
    }

    if (tool === 'sticky') {
      this._placeSticky(pointer.x, pointer.y);
      return;
    }

    if (tool === 'line') {
      this._startLine(pointer.x, pointer.y);
      return;
    }

    // Shape tools: start drag
    if (['rect', 'circle', 'diamond', 'triangle', 'frame'].includes(tool)) {
      this._drawStart = { x: pointer.x, y: pointer.y };
      this._drawRect = null;
    }
  }

  _onMouseMove(opt) {
    const tool = this.current;
    const pointer = canvas_getPointer(this.canvas, opt.e);

    // Line tool: show port hints on hover even when not drawing
    if (tool === 'line') {
      this._handleLineHover(pointer.x, pointer.y);
    }

    if (!this._drawStart && !this._lineStart) return;

    if (this._lineStart && tool === 'line') {
      this._updateTempLine(pointer.x, pointer.y);
      return;
    }

    if (this._drawStart) {
      this._updateDrawShape(pointer.x, pointer.y, opt.e.shiftKey);
    }
  }

  _onMouseUp(opt) {
    if (opt.e.button !== 0) return;
    const tool = this.current;
    const pointer = canvas_getPointer(this.canvas, opt.e);

    if (this._lineStart && tool === 'line') {
      this._finishLine(pointer.x, pointer.y);
      return;
    }

    if (this._drawStart) {
      this._finishDrawShape(pointer.x, pointer.y, opt.e.shiftKey);
    }
  }

  _onDblClick(opt) {
    if (!opt.target) return;
    let target = opt.target;

    // If subTargetCheck gave us a sub-object, find the parent group
    if (target.group && target.group.type === 'group') {
      target = target.group;
    }

    const type = target.data && target.data.type;

    // Double-click on any shape group (rect, circle, diamond, triangle, sticky) → edit text
    if (target.type === 'group' && type &&
        ['rect', 'circle', 'diamond', 'triangle', 'sticky'].includes(type)) {
      this.app.shapes.editShapeText(target);
      return;
    }

    // Double-click on standalone IText/Textbox enters edit mode automatically via Fabric
  }

  // ─── Shape drawing ─────────────────────────────────────────────────────────

  _updateDrawShape(ex, ey, shift) {
    const sx = this._drawStart.x, sy = this._drawStart.y;
    let w = ex - sx, h = ey - sy;

    if (shift) {
      const side = Math.max(Math.abs(w), Math.abs(h));
      w = w < 0 ? -side : side;
      h = h < 0 ? -side : side;
    }

    const x = w < 0 ? sx + w : sx;
    const y = h < 0 ? sy + h : sy;
    const absW = Math.abs(w);
    const absH = Math.abs(h);

    if (this._drawRect) {
      this.canvas.remove(this._drawRect);
    }

    this._drawRect = this._makeTempShape(this.current, x, y, absW || 4, absH || 4);
    if (this._drawRect) {
      this._drawRect.data = { temp: true };
      this.canvas.add(this._drawRect);
      this.canvas.renderAll();
    }
  }

  _finishDrawShape(ex, ey, shift) {
    if (!this._drawStart) return;

    let w = ex - this._drawStart.x;
    let h = ey - this._drawStart.y;
    const minSize = 10;

    if (shift) {
      const side = Math.max(Math.abs(w), Math.abs(h));
      w = w < 0 ? -side : side;
      h = h < 0 ? -side : side;
    }

    const sx = this._drawStart.x;
    const sy = this._drawStart.y;
    const x = w < 0 ? sx + w : sx;
    const y = h < 0 ? sy + h : sy;
    const absW = Math.max(minSize, Math.abs(w));
    const absH = Math.max(minSize, Math.abs(h));

    // Remove temp
    if (this._drawRect) {
      this.canvas.remove(this._drawRect);
      this._drawRect = null;
    }

    // Check for click without drag → use default size
    const isDrag = Math.abs(w) > minSize || Math.abs(h) > minSize;
    let obj;
    if (isDrag) {
      obj = this.app.shapes.createShape(this.current, x, y, absW, absH);
    } else {
      // Click → place default size centered on click
      const dw = 120, dh = 80;
      obj = this.app.shapes.createShape(this.current, sx - dw / 2, sy - dh / 2, dw, dh);
    }

    this._drawStart = null;

    if (obj) {
      this.canvas.add(obj);
      // Frames always render behind other objects
      if (obj.data && obj.data.type === 'frame') {
        this.canvas.sendToBack(obj);
      }
      this.canvas.setActiveObject(obj);
      this.canvas.renderAll();
      this.app.history.saveState();
      this.setTool('select');
    }
  }

  _makeTempShape(tool, x, y, w, h) {
    const style = {
      left: x, top: y,
      width: w, height: h,
      fill: 'rgba(74,144,226,0.15)',
      stroke: '#4a90e2',
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      originX: 'left',
      originY: 'top',
    };
    if (tool === 'circle') return new fabric.Ellipse({ ...style, rx: w / 2, ry: h / 2 });
    return new fabric.Rect(style);
  }

  // ─── Text ──────────────────────────────────────────────────────────────────

  _placeText(x, y) {
    const text = new fabric.IText('Text', {
      left: x,
      top: y,
      fontSize: 20,
      fill: this.app.canvasManager.isDark ? '#e0e0e0' : '#333333',
      fontFamily: 'Inter, system-ui, sans-serif',
      editable: true,
      data: { type: 'text' },
    });
    this.canvas.add(text);
    this.canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    this.canvas.renderAll();
    this.app.history.saveState();

    text.on('editing:exited', () => {
      if (text.text.trim() === '') {
        this.canvas.remove(text);
        this.canvas.renderAll();
      }
      this.app.history.saveState();
      this.setTool('select');
    });

    this.setTool('select'); // allow moving text after placing
  }

  // ─── Sticky ────────────────────────────────────────────────────────────────

  _placeSticky(x, y) {
    const sticky = this.app.shapes.createSticky(x - 100, y - 100);
    this.canvas.add(sticky);
    this.canvas.setActiveObject(sticky);
    this.canvas.renderAll();
    this.app.history.saveState();
    this.setTool('select');
  }

  // Text editing for shape groups is handled by ShapeManager.editShapeText()

  // ─── Line / Arrow (connection-aware) ───────────────────────────────────────

  _handleLineHover(x, y) {
    if (this._lineStart) return;
    const conn = this.app.connectors;

    // Find object under cursor
    const target = this.canvas.findTarget({ clientX: 0, clientY: 0 }, false);
    // Use port detection instead
    const snap = conn.findSnapPort(x, y, null);
    if (snap) {
      conn.showPortsOn(snap.obj);
    } else {
      conn._clearPortDots();
    }
  }

  _startLine(x, y) {
    const conn = this.app.connectors;
    const snap = conn.findSnapPort(x, y, null);

    if (snap) {
      this._lineSourceSnap = { obj: snap.obj, port: snap.port };
      this._lineStart = { x: snap.pos.x, y: snap.pos.y };
      conn.highlightPort(snap.obj, snap.port);
    } else {
      this._lineSourceSnap = null;
      this._lineStart = { x, y };
    }

    this._lineTempObj = new fabric.Line(
      [this._lineStart.x, this._lineStart.y, this._lineStart.x, this._lineStart.y],
      {
        stroke: this.app.canvasManager.isDark ? '#b0b8c8' : '#555',
        strokeWidth: 2,
        strokeDashArray: [6, 4],
        selectable: false, evented: false,
        data: { temp: true },
      }
    );
    this.canvas.add(this._lineTempObj);
  }

  _updateTempLine(x, y) {
    if (!this._lineTempObj) return;
    const conn = this.app.connectors;
    const sourceObj = this._lineSourceSnap ? this._lineSourceSnap.obj : null;
    const snap = conn.findSnapPort(x, y, sourceObj);

    if (snap) {
      this._lineTempObj.set({ x2: snap.pos.x, y2: snap.pos.y });
      conn.highlightPort(snap.obj, snap.port);
      this._lineTargetSnap = snap;
    } else {
      this._lineTempObj.set({ x2: x, y2: y });
      conn._clearPortDots();
      if (this._lineSourceSnap) {
        conn.highlightPort(this._lineSourceSnap.obj, this._lineSourceSnap.port);
      }
      this._lineTargetSnap = null;
    }
    this.canvas.renderAll();
  }

  _finishLine(x, y) {
    if (!this._lineStart) return;
    const conn = this.app.connectors;

    if (this._lineTempObj) {
      this.canvas.remove(this._lineTempObj);
      this._lineTempObj = null;
    }
    conn._clearPortDots();

    const sourceObj = this._lineSourceSnap ? this._lineSourceSnap.obj : null;
    const finalSnap = conn.findSnapPort(x, y, sourceObj) || this._lineTargetSnap;

    const hasSource = !!this._lineSourceSnap;
    const hasTarget = !!finalSnap;

    if (hasSource && hasTarget && this._lineSourceSnap.obj !== finalSnap.obj) {
      // Connected line
      conn.connect(
        { obj: this._lineSourceSnap.obj, port: this._lineSourceSnap.port },
        { obj: finalSnap.obj, port: finalSnap.port },
        { arrow: true }
      );
    } else if (hasSource && !hasTarget) {
      // Source attached, target free
      conn.connect(
        { obj: this._lineSourceSnap.obj, port: this._lineSourceSnap.port },
        { x, y },
        { arrow: true }
      );
    } else if (!hasSource && hasTarget) {
      // Source free, target attached
      conn.connect(
        { x: this._lineStart.x, y: this._lineStart.y },
        { obj: finalSnap.obj, port: finalSnap.port },
        { arrow: true }
      );
    } else {
      // Both free — standalone line
      const line = conn.createLine(
        this._lineStart.x, this._lineStart.y, x, y, { arrow: true }
      );
      this.canvas.add(line);
      this.canvas.setActiveObject(line);
    }

    this._lineStart = null;
    this._lineSourceSnap = null;
    this._lineTargetSnap = null;
    this.canvas.renderAll();
    this.app.history.saveState();
    this.setTool('select');
  }

  _getPenColor() {
    return this.app.canvasManager.isDark ? '#ffffff' : '#1a1a1a';
  }
}

// Helper to get canvas pointer, normalizing event
function canvas_getPointer(canvas, e) {
  return canvas.getPointer(e);
}
