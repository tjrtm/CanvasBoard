// connectors.js — Professional connector system
//
// Design based on how Miro/draw.io/Excalidraw handle connections:
//
// 1. CONNECTIONS are separate from LINES. A connection is metadata binding
//    two shapes; the visual line is derived from the connection data.
//
// 2. ENDPOINT HANDLES: Selecting a connection shows two draggable endpoint
//    circles. Dragging an endpoint to another shape re-connects it.
//    Dragging to empty space disconnects that end (becomes a free point).
//
// 3. ROUTING MODES:
//    - "straight" — direct line between ports
//    - "curved"   — smooth cubic bezier
//    - "elbow"    — orthogonal (right-angle) path with auto-routing
//
// 4. PORT DETECTION: When drawing or dragging an endpoint, nearby shape
//    ports light up. Closest port snaps. Ports: top, right, bottom, left + auto.
//
// 5. "Auto" port: the system picks the port that gives the shortest/cleanest
//    route based on relative positions of source and target.

const PORT_RADIUS = 5;
const PORT_HOVER_RADIUS = 7;
const SNAP_DISTANCE = 40;
const HANDLE_RADIUS = 6;
const ARROW_HEAD_LEN = 12;
const ARROW_ANGLE = Math.PI / 6;
const ELBOW_MIN_OFFSET = 30;

const PORT_DEFS = {
  top:    { nx:  0,   ny: -0.5 },
  right:  { nx:  0.5, ny:  0   },
  bottom: { nx:  0,   ny:  0.5 },
  left:   { nx: -0.5, ny:  0   },
};

let _nextId = 1;
function uid() { return 'c' + (_nextId++) + '_' + Math.random().toString(36).slice(2, 6); }

export class ConnectorManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;

    // Map<connId, ConnRecord>
    this.connections = new Map();

    // Temp visual objects (port dots, handles)
    this._portDots = [];
    this._handles = [];
    this._activeConn = null;   // currently selected connection
    this._draggingEnd = null;  // 'source' | 'target' while dragging handle
    this._dragTempLine = null;
    this._rebuilding = false;  // guard: true during line rebuild to suppress removal handler
  }

  init() {
    const c = this.canvas;

    // Redraw connections when any object moves
    c.on('object:moving',   () => this._updateAll());
    c.on('object:scaling',  () => this._updateAll());
    c.on('object:rotating', () => this._updateAll());

    // Remove connections when a shape is deleted
    c.on('object:removed', (opt) => {
      if (opt.target) this._onObjectRemoved(opt.target);
    });

    // Show handles when a connection line is selected
    c.on('selection:created', (e) => this._onSelect(e));
    c.on('selection:updated', (e) => this._onSelect(e));
    c.on('selection:cleared', ()  => this._clearHandles());
  }

  // ─── Object IDs ────────────────────────────────────────────────────────────

  _ensureId(obj) {
    if (!obj.data) obj.data = {};
    if (!obj.data.id) obj.data.id = uid();
    return obj.data.id;
  }

  _findById(id) {
    return this.canvas.getObjects().find(o => o.data && o.data.id === id) || null;
  }

  _isConnectable(obj) {
    if (!obj || !obj.data) return false;
    return ['rect', 'circle', 'diamond', 'triangle', 'sticky', 'frame'].includes(obj.data.type);
  }

  // ─── Port geometry ─────────────────────────────────────────────────────────

  getPortPos(obj, portName) {
    if (portName === 'auto' || !PORT_DEFS[portName]) {
      return obj.getCenterPoint();
    }
    const center = obj.getCenterPoint();
    const b = obj.getBoundingRect(false, true);
    const def = PORT_DEFS[portName];
    return { x: center.x + def.nx * b.width, y: center.y + def.ny * b.height };
  }

  /**
   * Pick the best port on `obj` facing toward point (tx, ty).
   */
  autoPick(obj, tx, ty) {
    const center = obj.getCenterPoint();
    const dx = tx - center.x;
    const dy = ty - center.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'bottom' : 'top';
  }

  /**
   * Find nearest port within snap distance.
   */
  findSnapPort(x, y, excludeObj) {
    let best = null, bestD = SNAP_DISTANCE;
    this.canvas.getObjects().forEach(obj => {
      if (obj === excludeObj || !this._isConnectable(obj)) return;
      for (const pn of Object.keys(PORT_DEFS)) {
        const pos = this.getPortPos(obj, pn);
        const d = Math.hypot(pos.x - x, pos.y - y);
        if (d < bestD) { bestD = d; best = { obj, port: pn, pos, dist: d }; }
      }
    });
    return best;
  }

  // ─── Port visualisation ────────────────────────────────────────────────────

  showPortsOn(obj) {
    this._clearPortDots();
    if (!obj || !this._isConnectable(obj)) return;
    const isDark = this.app.canvasManager.isDark;
    for (const pn of Object.keys(PORT_DEFS)) {
      const pos = this.getPortPos(obj, pn);
      const dot = new fabric.Circle({
        left: pos.x, top: pos.y,
        radius: PORT_RADIUS,
        originX: 'center', originY: 'center',
        fill: isDark ? '#5ba3f5' : '#1976d2',
        stroke: '#fff', strokeWidth: 1.5,
        selectable: false, evented: false,
        data: { _port: true },
      });
      this.canvas.add(dot);
      this._portDots.push(dot);
    }
    this.canvas.renderAll();
  }

  highlightPort(obj, portName) {
    this._clearPortDots();
    if (!obj) return;
    const pos = this.getPortPos(obj, portName);
    const dot = new fabric.Circle({
      left: pos.x, top: pos.y,
      radius: PORT_HOVER_RADIUS,
      originX: 'center', originY: 'center',
      fill: '#4caf50', stroke: '#fff', strokeWidth: 2,
      selectable: false, evented: false,
      data: { _port: true },
    });
    this.canvas.add(dot);
    this._portDots.push(dot);
    this.canvas.renderAll();
  }

  _clearPortDots() {
    this._portDots.forEach(d => this.canvas.remove(d));
    this._portDots = [];
  }

  // ─── Path generation ───────────────────────────────────────────────────────

  /**
   * Generate SVG path data between two points with the given routing mode.
   */
  _pathData(x1, y1, x2, y2, mode, arrow, sourcePort, targetPort) {
    let d;
    switch (mode) {
      case 'curved':
        d = this._curvedPath(x1, y1, x2, y2);
        break;
      case 'elbow':
        d = this._elbowPath(x1, y1, x2, y2, sourcePort, targetPort);
        break;
      default: // straight
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
    }
    if (arrow) d += this._arrowHead(x1, y1, x2, y2, mode);
    return d;
  }

  _curvedPath(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const off = Math.min(dist * 0.4, 120);
    // Control points offset perpendicular-ish for a nice S-curve
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const cx1 = x1 + off, cy1 = y1;
    const cx2 = x2 - off, cy2 = y2;
    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
  }

  _elbowPath(x1, y1, x2, y2, sourcePort, targetPort) {
    // Orthogonal (right-angle) routing
    const off = ELBOW_MIN_OFFSET;

    // Determine exit/entry direction from port names
    const exitDir = this._portDirection(sourcePort);
    const entryDir = this._portDirection(targetPort);

    // Generate waypoints based on exit/entry
    let points = this._routeElbow(x1, y1, x2, y2, exitDir, entryDir, off);

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  }

  _portDirection(port) {
    const dirs = { top: 'up', bottom: 'down', left: 'left', right: 'right' };
    return dirs[port] || 'right';
  }

  _routeElbow(x1, y1, x2, y2, exitDir, entryDir, off) {
    // Simple elbow routing: exit in direction, then turn to reach target
    let mx, my;

    if (exitDir === 'right' || exitDir === 'left') {
      const exitX = exitDir === 'right' ? x1 + off : x1 - off;
      if (entryDir === 'left' || entryDir === 'right') {
        const entryX = entryDir === 'left' ? x2 - off : x2 + off;
        mx = (exitX + entryX) / 2;
        return [
          { x: x1, y: y1 }, { x: exitX, y: y1 },
          { x: mx, y: y1 }, { x: mx, y: y2 },
          { x: entryX, y: y2 }, { x: x2, y: y2 },
        ];
      } else {
        // exit horizontal, entry vertical
        return [
          { x: x1, y: y1 }, { x: exitX, y: y1 },
          { x: exitX, y: y2 }, { x: x2, y: y2 },
        ];
      }
    } else {
      // exit vertical (up/down)
      const exitY = exitDir === 'down' ? y1 + off : y1 - off;
      if (entryDir === 'top' || entryDir === 'bottom') {
        const entryY = entryDir === 'top' ? y2 - off : y2 + off;
        my = (exitY + entryY) / 2;
        return [
          { x: x1, y: y1 }, { x: x1, y: exitY },
          { x: x1, y: my }, { x: x2, y: my },
          { x: x2, y: entryY }, { x: x2, y: y2 },
        ];
      } else {
        return [
          { x: x1, y: y1 }, { x: x1, y: exitY },
          { x: x2, y: exitY }, { x: x2, y: y2 },
        ];
      }
    }
  }

  _arrowHead(x1, y1, x2, y2, mode) {
    // For curved/elbow, arrow points toward x2,y2 from the approach direction
    let angle;
    if (mode === 'elbow') {
      // Last segment direction — approximate
      const dx = x2 - x1, dy = y2 - y1;
      angle = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? 0 : Math.PI)
        : (dy > 0 ? Math.PI / 2 : -Math.PI / 2);
    } else {
      angle = Math.atan2(y2 - y1, x2 - x1);
    }

    const ax1 = x2 - ARROW_HEAD_LEN * Math.cos(angle - ARROW_ANGLE);
    const ay1 = y2 - ARROW_HEAD_LEN * Math.sin(angle - ARROW_ANGLE);
    const ax2 = x2 - ARROW_HEAD_LEN * Math.cos(angle + ARROW_ANGLE);
    const ay2 = y2 - ARROW_HEAD_LEN * Math.sin(angle + ARROW_ANGLE);
    return ` M ${ax1} ${ay1} L ${x2} ${y2} L ${ax2} ${ay2}`;
  }

  // ─── Connection CRUD ───────────────────────────────────────────────────────

  /**
   * Create a connection.
   * Either end can be { obj, port } (attached) or { x, y } (free point).
   */
  connect(source, target, options = {}) {
    console.log('[CONN] connect', source, target, options);
    const connId = uid();
    const isDark = this.app.canvasManager.isDark;
    const mode = options.mode || 'straight';
    const arrow = options.arrow !== undefined ? options.arrow : true;
    const style = options.style || 'solid';
    const color = options.color || (isDark ? '#b0b8c8' : '#555555');
    const width = options.strokeWidth || 2;

    const rec = {
      id: connId,
      // Source: either { objId, port } or { x, y }
      source: source.obj
        ? { objId: this._ensureId(source.obj), port: source.port || 'auto' }
        : { x: source.x, y: source.y },
      target: target.obj
        ? { objId: this._ensureId(target.obj), port: target.port || 'auto' }
        : { x: target.x, y: target.y },
      mode, arrow, style, color, width,
      line: null,
    };

    // Build the visual line
    rec.line = this._buildLine(rec);
    this.canvas.add(rec.line);
    this.canvas.sendToBack(rec.line);
    this.connections.set(connId, rec);

    return connId;
  }

  _resolveEndpoint(end) {
    if (end.objId) {
      const obj = this._findById(end.objId);
      if (!obj) return null;
      const port = end.port || 'auto';
      return { obj, port, pos: this.getPortPos(obj, port) };
    }
    return { obj: null, port: null, pos: { x: end.x, y: end.y } };
  }

  _buildLine(rec) {
    const src = this._resolveEndpoint(rec.source);
    const tgt = this._resolveEndpoint(rec.target);
    if (!src || !tgt) return null;

    // Auto-pick ports if 'auto'
    let sp = src.port, tp = tgt.port;
    if (src.obj && sp === 'auto') sp = this.autoPick(src.obj, tgt.pos.x, tgt.pos.y);
    if (tgt.obj && tp === 'auto') tp = this.autoPick(tgt.obj, src.pos.x, src.pos.y);

    const p1 = src.obj ? this.getPortPos(src.obj, sp) : src.pos;
    const p2 = tgt.obj ? this.getPortPos(tgt.obj, tp) : tgt.pos;

    const pathStr = this._pathData(p1.x, p1.y, p2.x, p2.y, rec.mode, rec.arrow, sp, tp);

    let strokeDash = null;
    if (rec.style === 'dashed') strokeDash = [10, 6];
    if (rec.style === 'dotted') strokeDash = [3, 5];

    const line = new fabric.Path(pathStr, {
      stroke: rec.color,
      strokeWidth: rec.width,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      strokeDashArray: strokeDash,
      fill: 'transparent',
      selectable: true,
      evented: true,
      hasBorders: false,
      hasControls: false,
      perPixelTargetFind: true,
      lockMovementX: true,
      lockMovementY: true,
      data: { type: 'connection', connId: rec.id },
    });

    return line;
  }

  // ─── Update all connections ────────────────────────────────────────────────

  _updateAll() {
    for (const [, rec] of this.connections) {
      this._rebuildLine(rec);
    }
    // Also update handles if visible
    if (this._activeConn) this._positionHandles(this._activeConn);
  }

  _rebuildLine(rec) {
    this._rebuilding = true;
    if (rec.line) this.canvas.remove(rec.line);
    rec.line = this._buildLine(rec);
    if (rec.line) {
      this.canvas.add(rec.line);
      this.canvas.sendToBack(rec.line);
    }
    this._rebuilding = false;
  }

  // ─── Selection & endpoint handles ──────────────────────────────────────────

  _onSelect(e) {
    this._clearHandles();
    const obj = this.canvas.getActiveObject();
    if (!obj || !obj.data || obj.data.type !== 'connection') return;

    const rec = this.connections.get(obj.data.connId);
    if (!rec) return;

    this._activeConn = rec;
    this._showHandles(rec);
  }

  _showHandles(rec) {
    const src = this._resolveEndpoint(rec.source);
    const tgt = this._resolveEndpoint(rec.target);
    if (!src || !tgt) return;

    let sp = src.port, tp = tgt.port;
    if (src.obj && sp === 'auto') sp = this.autoPick(src.obj, tgt.pos.x, tgt.pos.y);
    if (tgt.obj && tp === 'auto') tp = this.autoPick(tgt.obj, src.pos.x, src.pos.y);

    const p1 = src.obj ? this.getPortPos(src.obj, sp) : src.pos;
    const p2 = tgt.obj ? this.getPortPos(tgt.obj, tp) : tgt.pos;

    const makeHandle = (pos, which) => {
      const h = new fabric.Circle({
        left: pos.x, top: pos.y,
        radius: HANDLE_RADIUS,
        originX: 'center', originY: 'center',
        fill: '#4a90e2', stroke: '#fff', strokeWidth: 2,
        selectable: true, evented: true,
        hasBorders: false, hasControls: false,
        hoverCursor: 'grab',
        data: { _handle: true, connId: rec.id, which },
      });

      // Drag handling
      h.on('moving', () => this._onHandleDrag(h, which, rec));
      h.on('modified', () => this._onHandleDrop(h, which, rec));

      this.canvas.add(h);
      this._handles.push(h);
      return h;
    };

    makeHandle(p1, 'source');
    makeHandle(p2, 'target');
    this.canvas.renderAll();
  }

  _positionHandles(rec) {
    if (this._handles.length !== 2) return;
    const src = this._resolveEndpoint(rec.source);
    const tgt = this._resolveEndpoint(rec.target);
    if (!src || !tgt) return;

    let sp = src.port, tp = tgt.port;
    if (src.obj && sp === 'auto') sp = this.autoPick(src.obj, tgt.pos.x, tgt.pos.y);
    if (tgt.obj && tp === 'auto') tp = this.autoPick(tgt.obj, src.pos.x, src.pos.y);

    const p1 = src.obj ? this.getPortPos(src.obj, sp) : src.pos;
    const p2 = tgt.obj ? this.getPortPos(tgt.obj, tp) : tgt.pos;

    this._handles[0].set({ left: p1.x, top: p1.y }).setCoords();
    this._handles[1].set({ left: p2.x, top: p2.y }).setCoords();
  }

  _onHandleDrag(handle, which, rec) {
    const x = handle.left, y = handle.top;
    const otherObj = which === 'source'
      ? (rec.target.objId ? this._findById(rec.target.objId) : null)
      : (rec.source.objId ? this._findById(rec.source.objId) : null);

    // Show port snap indicators
    const snap = this.findSnapPort(x, y, otherObj);
    if (snap) {
      this.highlightPort(snap.obj, snap.port);
    } else {
      this._clearPortDots();
    }

    // Temporarily update the endpoint to follow the drag
    if (which === 'source') {
      rec.source = snap
        ? { objId: this._ensureId(snap.obj), port: snap.port }
        : { x, y };
    } else {
      rec.target = snap
        ? { objId: this._ensureId(snap.obj), port: snap.port }
        : { x, y };
    }

    this._rebuildLine(rec);
  }

  _onHandleDrop(handle, which, rec) {
    this._clearPortDots();
    this._rebuildLine(rec);
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  _clearHandles() {
    this._handles.forEach(h => {
      h.off('moving');
      h.off('modified');
      this.canvas.remove(h);
    });
    this._handles = [];
    this._activeConn = null;
    this._clearPortDots();
  }

  // ─── Removal ───────────────────────────────────────────────────────────────

  _onObjectRemoved(obj) {
    if (!obj.data) return;
    if (this._rebuilding) return; // skip during line rebuild

    // Connection line removed → delete the record
    if (obj.data.type === 'connection' && obj.data.connId) {
      this.connections.delete(obj.data.connId);
      return;
    }

    // Shape removed → remove its connections
    const objId = obj.data.id;
    if (!objId) return;
    const toRemove = [];
    for (const [connId, rec] of this.connections) {
      if ((rec.source.objId === objId) || (rec.target.objId === objId)) {
        toRemove.push(connId);
      }
    }
    toRemove.forEach(id => {
      const rec = this.connections.get(id);
      if (rec && rec.line) this.canvas.remove(rec.line);
      this.connections.delete(id);
    });
  }

  removeConnection(lineObj) {
    if (!lineObj.data || lineObj.data.type !== 'connection') return;
    this.connections.delete(lineObj.data.connId);
    this.canvas.remove(lineObj);
  }

  // ─── Routing mode toggle (cycle: straight → curved → elbow) ───────────────

  cycleMode(connId) {
    const rec = this.connections.get(connId);
    if (!rec) return;
    const modes = ['straight', 'curved', 'elbow'];
    const idx = modes.indexOf(rec.mode);
    rec.mode = modes[(idx + 1) % modes.length];
    if (rec.line && rec.line.data) rec.line.data.mode = rec.mode;
    this._rebuildLine(rec);
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  // ─── Style / arrow updates ─────────────────────────────────────────────────

  setLineStyle(obj, style) {
    let strokeDash = null;
    if (style === 'dashed') strokeDash = [10, 6];
    if (style === 'dotted') strokeDash = [3, 5];
    obj.set('strokeDashArray', strokeDash);
    if (obj.data) obj.data.style = style;

    if (obj.data && obj.data.connId) {
      const rec = this.connections.get(obj.data.connId);
      if (rec) rec.style = style;
    }
    this.canvas.renderAll();
  }

  toggleArrow(obj) {
    if (!obj || !obj.data) return;
    if (obj.data.connId) {
      const rec = this.connections.get(obj.data.connId);
      if (!rec) return;
      rec.arrow = !rec.arrow;
      this._rebuildLine(rec);
    }
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  // ─── Standalone lines (non-connected) ─────────────────────────────────────

  createLine(x1, y1, x2, y2, options = {}) {
    const isDark = this.app.canvasManager.isDark;
    const color = options.color || (isDark ? '#e0e0e0' : '#333333');
    const width = options.strokeWidth || 2;
    const hasArrow = options.arrow !== undefined ? options.arrow : false;
    const style = options.style || 'solid';

    let strokeDash = null;
    if (style === 'dashed') strokeDash = [10, 6];
    if (style === 'dotted') strokeDash = [3, 5];

    let pathStr = `M ${x1} ${y1} L ${x2} ${y2}`;
    if (hasArrow) pathStr += this._arrowHead(x1, y1, x2, y2, 'straight');

    return new fabric.Path(pathStr, {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      strokeDashArray: strokeDash,
      fill: 'transparent',
      selectable: true,
      evented: true,
      hasBorders: true,
      hasControls: false,
      perPixelTargetFind: true,
      data: { type: 'line', style, arrow: hasArrow },
    });
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  serializeConnections() {
    const result = [];
    for (const [, rec] of this.connections) {
      result.push({
        id: rec.id,
        source: rec.source,
        target: rec.target,
        mode: rec.mode,
        arrow: rec.arrow,
        style: rec.style,
        color: rec.color,
        width: rec.width,
      });
    }
    return result;
  }

  restoreConnections(data) {
    if (!Array.isArray(data)) return;
    data.forEach(c => {
      const rec = {
        id: c.id || uid(),
        source: c.source,
        target: c.target,
        mode: c.mode || 'straight',
        arrow: c.arrow !== undefined ? c.arrow : true,
        style: c.style || 'solid',
        color: c.color || '#b0b8c8',
        width: c.width || 2,
        line: null,
      };

      rec.line = this._buildLine(rec);
      if (rec.line) {
        this.canvas.add(rec.line);
        this.canvas.sendToBack(rec.line);
        this.connections.set(rec.id, rec);
      }
    });
  }
}
