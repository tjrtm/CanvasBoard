// frames.js — Frame containment: objects inside a frame move with it

export class FrameManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    // Track which objects belong to which frame
    // Map<frameObj, Set<obj>>
    this._frameChildren = new Map();
    // Track frame position before move to compute delta
    this._moveStart = null;
  }

  init() {
    const canvas = this.canvas;

    // When a frame starts moving, snapshot its position and find children
    canvas.on('object:moving', (opt) => {
      const obj = opt.target;
      if (!this._isFrame(obj)) return;

      if (!this._moveStart || this._moveStart.frame !== obj) {
        // First move event for this drag — snapshot and find children
        this._moveStart = {
          frame: obj,
          left: obj.left,
          top: obj.top,
          children: this._findChildrenOf(obj),
        };
      }

      // Compute delta from last position
      const dx = obj.left - this._moveStart.left;
      const dy = obj.top - this._moveStart.top;

      if (dx !== 0 || dy !== 0) {
        // Move all children by the same delta
        for (const child of this._moveStart.children) {
          child.set({
            left: child.left + dx,
            top: child.top + dy,
          });
          child.setCoords();
        }
        // Update snapshot
        this._moveStart.left = obj.left;
        this._moveStart.top = obj.top;
      }
    });

    // Clean up on mouse up
    canvas.on('mouse:up', () => {
      this._moveStart = null;
    });

    // When an object is dropped, check if it landed inside a frame
    canvas.on('object:modified', (opt) => {
      const obj = opt.target;
      if (this._isFrame(obj)) return;
      // Visual feedback: highlight frame border when object is inside
      this._updateContainmentVisual(obj);
    });

    // When frame is scaled, update its children mapping
    canvas.on('object:scaling', (opt) => {
      // For frames being scaled, we don't move children (just resize the container)
    });
  }

  _isFrame(obj) {
    return obj && obj.data && obj.data.type === 'frame';
  }

  /**
   * Find all non-frame objects whose center is inside the frame's bounding box.
   */
  _findChildrenOf(frame) {
    const children = [];
    const fb = frame.getBoundingRect(true, true);

    this.canvas.getObjects().forEach(obj => {
      if (obj === frame) return;
      if (this._isFrame(obj)) return; // don't nest frames for now

      const ob = obj.getBoundingRect(true, true);
      const cx = ob.left + ob.width / 2;
      const cy = ob.top + ob.height / 2;

      if (
        cx >= fb.left &&
        cx <= fb.left + fb.width &&
        cy >= fb.top &&
        cy <= fb.top + fb.height
      ) {
        children.push(obj);
      }
    });

    return children;
  }

  /**
   * Get the frame that contains a given object (if any).
   */
  getParentFrame(obj) {
    if (this._isFrame(obj)) return null;

    const ob = obj.getBoundingRect(true, true);
    const cx = ob.left + ob.width / 2;
    const cy = ob.top + ob.height / 2;

    const frames = this.canvas.getObjects().filter(o => this._isFrame(o));

    for (const frame of frames) {
      const fb = frame.getBoundingRect(true, true);
      if (
        cx >= fb.left &&
        cx <= fb.left + fb.width &&
        cy >= fb.top &&
        cy <= fb.top + fb.height
      ) {
        return frame;
      }
    }
    return null;
  }

  /**
   * Optional: subtle visual cue when an object is inside a frame.
   */
  _updateContainmentVisual(obj) {
    // Could add a subtle highlight to the parent frame
    // For now, just ensure frames render behind their children
    const frames = this.canvas.getObjects().filter(o => this._isFrame(o));
    frames.forEach(frame => {
      this.canvas.sendToBack(frame);
    });
    this.canvas.renderAll();
  }

  /**
   * When deleting a frame, optionally delete or release children.
   * Call this before removing the frame from canvas.
   */
  onFrameDelete(frame, deleteChildren = false) {
    if (!this._isFrame(frame)) return;
    if (deleteChildren) {
      const children = this._findChildrenOf(frame);
      children.forEach(c => this.canvas.remove(c));
    }
  }
}
