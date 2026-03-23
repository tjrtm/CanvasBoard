// connectors.js — Smart connections: lines/arrows that stay attached to shapes

const PORT_RADIUS = 6;
const SNAP_DISTANCE = 20;
const ARROW_HEAD_LEN = 14;
const ARROW_ANGLE = Math.PI / 6;

// Port positions relative to object center (normalized -0.5 to 0.5)
const PORT_DEFS = {
  top:    { nx:  0,    ny: -0.5 },
  right:  { nx:  0.5,  ny:  0   },
  bottom: { nx:  0,    ny:  0.5 },
  left:   { nx: -0.5,  ny:  0   },
};

let _nextConnId = 1;

export class ConnectorManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;

    // All live connections: Map<connId, { line, sourceId, targetId, sourcePort, targetPort, arrow, style }>
    this.connections = new Map();

    // Port highlight circles (reused)
    this._portCircles = [];
    this._hoveredPort = null;
    this._sourcePort = null;
    this._sourceObj = null;
  }

  init() {
    // Update connections when objects move, scale, or rotate
    this.canvas.on('object:moving',   () => this._updateAllConnections());
    this.canvas.on('object:scaling',  () => this._updateAllConnections());
    this.canvas.on('object:rotating', () => this._updateAllConnections());
    this.canvas.on('object:modified', () => this._updateAllConnections());

    // When objects are removed, remove their connections
    this.canvas.on('object:removed', (opt) => {
      if (opt.target) this._onObjectRemoved(opt.target);
    });
  }

  // ─── Object ID management ──────────────────────────────────────────────────

  _ensureId(obj) {
    if (!obj.data) obj.data = {};
    if (!obj.data.id) obj.data.id = 'obj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    return obj.data.id;
  }

  _findById(id) {
    return this.canvas.getObjects().find(o => o.data && o.data.id === id) || null;
  }

  // ─── Port positions ────────────────────────────────────────────────────────

  /**
   * Get port world position for an object.
   */
  getPortPosition(obj, portName) {
    const center = obj.getCenterPoint();
    const b = obj.getBoundingRect(false, true);
    const w = b.width;
    const h = b.height;
    const def = PORT_DEFS[portName];
    if (!def) return center;

    return {
      x: center.x + def.nx * w,
      y: center.y + def.ny * h,
    };
  }

  /**
   * Get all port positions for an object.
   */
  getAllPorts(obj) {
    const ports = {};
    for (const name of Object.keys(PORT_DEFS)) {
      ports[name] = this.getPortPosition(obj, name);
    }
    return ports;
  }

  /**
   * Find the closest port on any connectable object to the given point.
   * Returns { obj, portName, pos, dist } or null.
   */
  findNearestPort(x, y, excludeObj) {
    let best = null;
    let bestDist = SNAP_DISTANCE;

    this.canvas.getObjects().forEach(obj => {
      if (obj === excludeObj) return;
      if (!this._isConnectable(obj)) return;

      const ports = this.getAllPorts(obj);
      for (const [name, pos] of Object.entries(ports)) {
        const d = Math.hypot(pos.x - x, pos.y - y);
        if (d < bestDist) {
          bestDist = d;
          best = { obj, portName: name, pos, dist: d };
        }
      }
    });

    return best;
  }

  _isConnectable(obj) {
    if (!obj.data) return false;
    const type = obj.data.type;
    // Shapes, stickies, and frames are connectable
    return ['rect', 'circle', 'diamond', 'triangle', 'sticky', 'frame'].includes(type);
  }

  // ─── Port visualization ────────────────────────────────────────────────────

  /**
   * Show port dots on an object (called during line tool hover).
   */
  showPorts(obj) {
    this.hidePorts();
    if (!obj || !this._isConnectable(obj)) return;

    const ports = this.getAllPorts(obj);
    const isDark = this.app.canvasManager.isDark;

    for (const [name, pos] of Object.entries(ports)) {
      const circle = new fabric.Circle({
        left: pos.x - PORT_RADIUS,
        top: pos.y - PORT_RADIUS,
        radius: PORT_RADIUS,
        fill: isDark ? '#5ba3f5' : '#1976d2',
        stroke: '#fff',
        strokeWidth: 2,
        selectable: false,
        evented: false,
        originX: 'left',
        originY: 'top',
        data: { _portIndicator: true },
      });
      this.canvas.add(circle);
      this._portCircles.push(circle);
    }
    this.canvas.renderAll();
  }

  /**
   * Highlight a specific port.
   */
  highlightPort(obj, portName) {
    this.hidePorts();
    if (!obj || !portName) return;

    const pos = this.getPortPosition(obj, portName);
    const circle = new fabric.Circle({
      left: pos.x - PORT_RADIUS * 1.3,
      top: pos.y - PORT_RADIUS * 1.3,
      radius: PORT_RADIUS * 1.3,
      fill: '#4caf50',
      stroke: '#fff',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      originX: 'left',
      originY: 'top',
      data: { _portIndicator: true },
    });
    this.canvas.add(circle);
    this._portCircles.push(circle);
    this.canvas.renderAll();
  }

  hidePorts() {
    this._portCircles.forEach(c => this.canvas.remove(c));
    this._portCircles = [];
  }

  // ─── Connection creation ───────────────────────────────────────────────────

  /**
   * Create a connection between two objects.
   * Returns the connection id.
   */
  connect(sourceObj, sourcePort, targetObj, targetPort, options = {}) {
    const sourceId = this._ensureId(sourceObj);
    const targetId = this._ensureId(targetObj);
    const connId = 'conn_' + (_nextConnId++);

    const isDark = this.app.canvasManager.isDark;
    const arrow = options.arrow !== undefined ? options.arrow : true;
    const style = options.style || 'solid';
    const color = options.color || (isDark ? '#e0e0e0' : '#555555');
    const width = options.strokeWidth || 2;

    // Create the visual line
    const line = this._buildLine(sourceObj, sourcePort, targetObj, targetPort, {
      color, width, arrow, style, connId,
    });

    this.canvas.add(line);
    // Connections render behind shapes
    this.canvas.sendToBack(line);

    const conn = {
      id: connId,
      line,
      sourceId,
      targetId,
      sourcePort,
      targetPort,
      arrow,
      style,
      color,
      width,
    };

    this.connections.set(connId, conn);

    // Tag the line so we know it's a connection
    line.data = {
      type: 'connection',
      connId,
      sourceId,
      targetId,
      sourcePort,
      targetPort,
      arrow,
      style,
    };

    return connId;
  }

  /**
   * Build or rebuild a line/arrow Path between two ports.
   */
  _buildLine(sourceObj, sourcePort, targetObj, targetPort, opts) {
    const p1 = this.getPortPosition(sourceObj, sourcePort);
    const p2 = this.getPortPosition(targetObj, targetPort);

    let strokeDash = null;
    if (opts.style === 'dashed') strokeDash = [10, 6];
    if (opts.style === 'dotted') strokeDash = [3, 5];

    // Build path data
    let pathStr;
    if (opts.arrow) {
      pathStr = this._arrowPathData(p1.x, p1.y, p2.x, p2.y);
    } else {
      pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
    }

    const line = new fabric.Path(pathStr, {
      stroke: opts.color,
      strokeWidth: opts.width,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      strokeDashArray: strokeDash,
      fill: 'transparent',
      selectable: true,
      evented: true,
      hasBorders: true,
      hasControls: false,
      perPixelTargetFind: true,
      lockMovementX: true,
      lockMovementY: true,
    });

    return line;
  }

  _arrowPathData(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx);

    const ax1 = x2 - ARROW_HEAD_LEN * Math.cos(angle - ARROW_ANGLE);
    const ay1 = y2 - ARROW_HEAD_LEN * Math.sin(angle - ARROW_ANGLE);
    const ax2 = x2 - ARROW_HEAD_LEN * Math.cos(angle + ARROW_ANGLE);
    const ay2 = y2 - ARROW_HEAD_LEN * Math.sin(angle + ARROW_ANGLE);

    return [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `M ${ax1} ${ay1}`,
      `L ${x2} ${y2}`,
      `L ${ax2} ${ay2}`,
    ].join(' ');
  }

  // ─── Update connections on move ────────────────────────────────────────────

  _updateAllConnections() {
    for (const [connId, conn] of this.connections) {
      const sourceObj = this._findById(conn.sourceId);
      const targetObj = this._findById(conn.targetId);

      if (!sourceObj || !targetObj) continue;

      const p1 = this.getPortPosition(sourceObj, conn.sourcePort);
      const p2 = this.getPortPosition(targetObj, conn.targetPort);

      let pathStr;
      if (conn.arrow) {
        pathStr = this._arrowPathData(p1.x, p1.y, p2.x, p2.y);
      } else {
        pathStr = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      }

      // Replace the path on the existing line object
      const oldLine = conn.line;
      this.canvas.remove(oldLine);

      const newLine = this._buildLine(sourceObj, conn.sourcePort, targetObj, conn.targetPort, {
        color: conn.color,
        width: conn.width,
        arrow: conn.arrow,
        style: conn.style,
        connId: conn.id,
      });

      newLine.data = oldLine.data;
      conn.line = newLine;
      this.canvas.add(newLine);
      this.canvas.sendToBack(newLine);
    }
    this.canvas.renderAll();
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  _onObjectRemoved(obj) {
    if (!obj.data) return;

    // If a connection line was removed, clean up
    if (obj.data.type === 'connection' && obj.data.connId) {
      this.connections.delete(obj.data.connId);
      return;
    }

    // If a shape was removed, remove its connections
    const objId = obj.data.id;
    if (!objId) return;

    const toRemove = [];
    for (const [connId, conn] of this.connections) {
      if (conn.sourceId === objId || conn.targetId === objId) {
        toRemove.push(connId);
      }
    }
    toRemove.forEach(connId => {
      const conn = this.connections.get(connId);
      if (conn && conn.line) {
        this.canvas.remove(conn.line);
      }
      this.connections.delete(connId);
    });
  }

  /**
   * Remove a specific connection by its line object.
   */
  removeConnection(lineObj) {
    if (!lineObj.data || lineObj.data.type !== 'connection') return;
    const connId = lineObj.data.connId;
    this.connections.delete(connId);
    this.canvas.remove(lineObj);
  }

  // ─── Legacy support: standalone lines (non-connected) ─────────────────────

  createLine(x1, y1, x2, y2, options = {}) {
    const isDark = this.app.canvasManager.isDark;
    const color = options.color || (isDark ? '#e0e0e0' : '#333333');
    const width = options.strokeWidth || 2;
    const hasArrow = options.arrow !== undefined ? options.arrow : false;
    const style = options.style || 'solid';

    let strokeDash = null;
    if (style === 'dashed') strokeDash = [10, 6];
    if (style === 'dotted') strokeDash = [3, 5];

    let pathStr;
    if (hasArrow) {
      pathStr = this._arrowPathData(x1, y1, x2, y2);
    } else {
      pathStr = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

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
      data: {
        type: 'line',
        style: style,
        arrow: hasArrow,
      },
    });
  }

  // Line style and arrow toggle for both connections and standalone lines
  setLineStyle(obj, style) {
    let strokeDash = null;
    if (style === 'dashed') strokeDash = [10, 6];
    if (style === 'dotted') strokeDash = [3, 5];
    obj.set('strokeDashArray', strokeDash);
    if (obj.data) obj.data.style = style;

    // Update connection record
    if (obj.data && obj.data.connId) {
      const conn = this.connections.get(obj.data.connId);
      if (conn) conn.style = style;
    }

    this.canvas.renderAll();
  }

  toggleArrow(obj) {
    if (!obj || !obj.data) return;

    if (obj.data.type === 'connection' && obj.data.connId) {
      // Toggle arrow on a connection
      const conn = this.connections.get(obj.data.connId);
      if (!conn) return;
      conn.arrow = !conn.arrow;
      obj.data.arrow = conn.arrow;
      this._updateAllConnections();
    } else if (obj.data.type === 'line') {
      // Standalone line toggle
      obj.data.arrow = !obj.data.arrow;
      // Rebuild would be complex; just update record
      this.canvas.renderAll();
    }
    this.app.history.saveState();
  }

  // ─── Serialization helpers ─────────────────────────────────────────────────

  /**
   * Get connection data for persistence.
   */
  serializeConnections() {
    const result = [];
    for (const [connId, conn] of this.connections) {
      result.push({
        id: conn.id,
        sourceId: conn.sourceId,
        targetId: conn.targetId,
        sourcePort: conn.sourcePort,
        targetPort: conn.targetPort,
        arrow: conn.arrow,
        style: conn.style,
        color: conn.color,
        width: conn.width,
      });
    }
    return result;
  }

  /**
   * Restore connections from serialized data.
   */
  restoreConnections(data) {
    if (!Array.isArray(data)) return;
    data.forEach(c => {
      const sourceObj = this._findById(c.sourceId);
      const targetObj = this._findById(c.targetId);
      if (sourceObj && targetObj) {
        this.connect(sourceObj, c.sourcePort, targetObj, c.targetPort, {
          arrow: c.arrow,
          style: c.style,
          color: c.color,
          strokeWidth: c.width,
        });
      }
    });
  }
}
