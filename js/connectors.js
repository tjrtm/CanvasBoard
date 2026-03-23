// connectors.js — Line and arrow drawing

export class ConnectorManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this.arrowByDefault = false;
  }

  // Create a line (optionally with arrow)
  createLine(x1, y1, x2, y2, options = {}) {
    const isDark = this.app.canvasManager.isDark;
    const color = options.color || (isDark ? '#e0e0e0' : '#333333');
    const width = options.strokeWidth || 2;
    const hasArrow = options.arrow !== undefined ? options.arrow : this.arrowByDefault;
    const style = options.style || 'solid';

    let strokeDash = null;
    if (style === 'dashed') strokeDash = [10, 6];
    if (style === 'dotted') strokeDash = [3, 5];

    // For arrow lines, use a Path; for simple lines use Line
    if (hasArrow) {
      return this._createArrowLine(x1, y1, x2, y2, color, width, strokeDash);
    }

    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: 'round',
      strokeDashArray: strokeDash,
      selectable: true,
      evented: true,
      hasBorders: true,
      hasControls: true,
      data: {
        type: 'line',
        style: style,
        arrow: false,
      },
    });

    return line;
  }

  _createArrowLine(x1, y1, x2, y2, color, width, strokeDash) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return this.createLine(x1, y1, x2, y2, { color, strokeWidth: width });

    const headLen = Math.max(12, width * 4);
    const angle = Math.atan2(dy, dx);
    const arrowAngle = Math.PI / 6; // 30°

    // Arrow head points
    const ax1 = x2 - headLen * Math.cos(angle - arrowAngle);
    const ay1 = y2 - headLen * Math.sin(angle - arrowAngle);
    const ax2 = x2 - headLen * Math.cos(angle + arrowAngle);
    const ay2 = y2 - headLen * Math.sin(angle + arrowAngle);

    const pathData = [
      `M ${x1} ${y1}`,
      `L ${x2} ${y2}`,
      `M ${ax1} ${ay1}`,
      `L ${x2} ${y2}`,
      `L ${ax2} ${ay2}`,
    ].join(' ');

    const path = new fabric.Path(pathData, {
      stroke: color,
      strokeWidth: width,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      strokeDashArray: strokeDash,
      fill: 'transparent',
      selectable: true,
      evented: true,
      data: {
        type: 'line',
        style: strokeDash ? (strokeDash[0] > 5 ? 'dashed' : 'dotted') : 'solid',
        arrow: true,
      },
    });

    return path;
  }

  // Update line style (solid/dashed/dotted)
  setLineStyle(obj, style) {
    let strokeDash = null;
    if (style === 'dashed') strokeDash = [10, 6];
    if (style === 'dotted') strokeDash = [3, 5];
    obj.set('strokeDashArray', strokeDash);
    if (obj.data) obj.data.style = style;
    this.canvas.renderAll();
  }

  // Toggle arrow on a line object
  toggleArrow(obj) {
    if (!obj || (obj.type !== 'line' && obj.type !== 'path')) return;
    const isArrow = obj.data && obj.data.arrow;
    const newObj = this._rebuildAsArrow(obj, !isArrow);
    if (newObj) {
      const idx = this.canvas.getObjects().indexOf(obj);
      this.canvas.remove(obj);
      this.canvas.add(newObj);
      this.canvas.setActiveObject(newObj);
      this.canvas.renderAll();
    }
  }

  _rebuildAsArrow(obj, wantArrow) {
    let x1, y1, x2, y2;
    if (obj.type === 'line') {
      x1 = obj.x1; y1 = obj.y1; x2 = obj.x2; y2 = obj.y2;
    } else {
      // Approximate from bounding box
      const b = obj.getBoundingRect();
      x1 = b.left; y1 = b.top; x2 = b.left + b.width; y2 = b.top + b.height;
    }
    return this.createLine(x1, y1, x2, y2, {
      color: obj.stroke,
      strokeWidth: obj.strokeWidth,
      arrow: wantArrow,
      style: (obj.data && obj.data.style) || 'solid',
    });
  }
}
