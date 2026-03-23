// selection.js — Multi-select, group/ungroup, alignment tools, z-order

export class SelectionManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this._clipboard = null;
  }

  init() {
    // Wire align buttons in top bar
    document.querySelectorAll('.align-btn').forEach(btn => {
      btn.addEventListener('click', () => this.align(btn.dataset.align));
    });

    // Show/hide align tools based on selection
    this.canvas.on('selection:created', (e) => this._onSelectionChange(e));
    this.canvas.on('selection:updated', (e) => this._onSelectionChange(e));
    this.canvas.on('selection:cleared', () => this._onSelectionCleared());
  }

  _onSelectionChange(e) {
    const selected = this.canvas.getActiveObjects();
    const alignTools = document.getElementById('align-tools');
    if (selected.length > 1) {
      alignTools.classList.remove('hidden');
    } else {
      alignTools.classList.add('hidden');
    }
  }

  _onSelectionCleared() {
    document.getElementById('align-tools').classList.add('hidden');
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  selectAll() {
    const objects = this.canvas.getObjects().filter(o => !o.locked);
    if (objects.length === 0) return;
    const selection = new fabric.ActiveSelection(objects, { canvas: this.canvas });
    this.canvas.setActiveObject(selection);
    this.canvas.renderAll();
  }

  deselect() {
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
  }

  // ─── Copy / Paste ──────────────────────────────────────────────────────────

  copy() {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    active.clone(clone => {
      this._clipboard = clone;
    }, ['data', 'locked', 'subTargetCheck']);
  }

  paste() {
    if (!this._clipboard) return;
    this._clipboard.clone(clone => {
      clone.set({
        left: (clone.left || 0) + 20,
        top: (clone.top || 0) + 20,
        evented: true,
      });

      if (clone.type === 'activeSelection') {
        clone.canvas = this.canvas;
        clone.forEachObject(obj => {
          obj.data = JSON.parse(JSON.stringify(obj.data || {}));
          this.canvas.add(obj);
        });
        clone.setCoords();
      } else {
        clone.data = JSON.parse(JSON.stringify(clone.data || {}));
        this.canvas.add(clone);
      }

      this.canvas.setActiveObject(clone);
      this.canvas.renderAll();
      this.app.history.saveState();

      // Update clipboard offset for repeat pastes
      this._clipboard.set({
        left: (this._clipboard.left || 0) + 20,
        top: (this._clipboard.top || 0) + 20,
      });
    }, ['data', 'locked', 'subTargetCheck']);
  }

  duplicate() {
    const active = this.canvas.getActiveObject();
    if (!active) return;

    active.clone(clone => {
      clone.set({
        left: active.left + 20,
        top: active.top + 20,
      });

      if (clone.type === 'activeSelection') {
        clone.canvas = this.canvas;
        clone.forEachObject(obj => this.canvas.add(obj));
        clone.setCoords();
      } else {
        this.canvas.add(clone);
      }

      this.canvas.setActiveObject(clone);
      this.canvas.renderAll();
      this.app.history.saveState();
    }, ['data', 'locked', 'subTargetCheck']);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  deleteSelected() {
    const active = this.canvas.getActiveObjects();
    if (active.length === 0) return;
    active.forEach(obj => {
      if (!obj.locked) this.canvas.remove(obj);
    });
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  // ─── Group / Ungroup ───────────────────────────────────────────────────────

  group() {
    const selected = this.canvas.getActiveObjects();
    if (selected.length < 2) return;

    this.canvas.discardActiveObject();
    const group = new fabric.Group(selected, {
      data: { type: 'group' },
    });

    selected.forEach(obj => this.canvas.remove(obj));
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  ungroup() {
    const active = this.canvas.getActiveObject();
    if (!active || active.type !== 'group') return;

    // Don't ungroup shape groups (rect, circle, diamond, triangle, sticky)
    if (active.data && ['rect', 'circle', 'diamond', 'triangle', 'sticky'].includes(active.data.type)) return;

    const items = active.getObjects();
    this.canvas.remove(active);

    const matrix = active.calcTransformMatrix();
    items.forEach(obj => {
      const newTransform = fabric.util.multiplyTransformMatrices(
        matrix, obj.calcTransformMatrix()
      );
      const decomposed = fabric.util.qrDecompose(newTransform);
      obj.set({
        scaleX: decomposed.scaleX,
        scaleY: decomposed.scaleY,
        angle: decomposed.angle,
        left: decomposed.translateX,
        top: decomposed.translateY,
        originX: 'left',
        originY: 'top',
      });
      this.canvas.add(obj);
    });

    const selection = new fabric.ActiveSelection(items, { canvas: this.canvas });
    this.canvas.setActiveObject(selection);
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  // ─── Z-Order ───────────────────────────────────────────────────────────────

  bringToFront() {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.bringToFront(obj); this._afterZOrder(); }
  }

  sendToBack() {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.sendToBack(obj); this._afterZOrder(); }
  }

  bringForward() {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.bringForward(obj); this._afterZOrder(); }
  }

  sendBackward() {
    const obj = this.canvas.getActiveObject();
    if (obj) { this.canvas.sendBackwards(obj); this._afterZOrder(); }
  }

  _afterZOrder() {
    this.canvas.renderAll();
    this.app.history.saveState();
  }

  // ─── Alignment ─────────────────────────────────────────────────────────────

  align(type) {
    const objects = this.canvas.getActiveObjects();
    if (objects.length < 2) return;

    const bounds = objects.map(o => o.getBoundingRect(true, true));

    switch (type) {
      case 'left': {
        const minX = Math.min(...bounds.map(b => b.left));
        objects.forEach((o, i) => {
          o.set({ left: minX + (o.left - bounds[i].left) });
        });
        break;
      }
      case 'right': {
        const maxX = Math.max(...bounds.map(b => b.left + b.width));
        objects.forEach((o, i) => {
          o.set({ left: maxX - bounds[i].width + (o.left - bounds[i].left) });
        });
        break;
      }
      case 'centerH': {
        const avgCX = bounds.reduce((s, b) => s + b.left + b.width / 2, 0) / bounds.length;
        objects.forEach((o, i) => {
          o.set({ left: avgCX - bounds[i].width / 2 + (o.left - bounds[i].left) });
        });
        break;
      }
      case 'top': {
        const minY = Math.min(...bounds.map(b => b.top));
        objects.forEach((o, i) => {
          o.set({ top: minY + (o.top - bounds[i].top) });
        });
        break;
      }
      case 'bottom': {
        const maxY = Math.max(...bounds.map(b => b.top + b.height));
        objects.forEach((o, i) => {
          o.set({ top: maxY - bounds[i].height + (o.top - bounds[i].top) });
        });
        break;
      }
      case 'centerV': {
        const avgCY = bounds.reduce((s, b) => s + b.top + b.height / 2, 0) / bounds.length;
        objects.forEach((o, i) => {
          o.set({ top: avgCY - bounds[i].height / 2 + (o.top - bounds[i].top) });
        });
        break;
      }
      case 'distributeH': {
        const sorted = objects.slice().sort((a, b) => a.left - b.left);
        const sortedBounds = sorted.map(o => o.getBoundingRect(true, true));
        const leftmost = sortedBounds[0].left;
        const rightmost = sortedBounds[sortedBounds.length - 1].left + sortedBounds[sortedBounds.length - 1].width;
        const totalW = sorted.reduce((s, o, i) => s + sortedBounds[i].width, 0);
        const gap = (rightmost - leftmost - totalW) / (sorted.length - 1);
        let curX = leftmost;
        sorted.forEach((o, i) => {
          const b = sortedBounds[i];
          o.set({ left: curX + (o.left - b.left) });
          curX += b.width + gap;
        });
        break;
      }
      case 'distributeV': {
        const sorted = objects.slice().sort((a, b) => a.top - b.top);
        const sortedBounds = sorted.map(o => o.getBoundingRect(true, true));
        const topmost = sortedBounds[0].top;
        const bottommost = sortedBounds[sortedBounds.length - 1].top + sortedBounds[sortedBounds.length - 1].height;
        const totalH = sorted.reduce((s, o, i) => s + sortedBounds[i].height, 0);
        const gap = (bottommost - topmost - totalH) / (sorted.length - 1);
        let curY = topmost;
        sorted.forEach((o, i) => {
          const b = sortedBounds[i];
          o.set({ top: curY + (o.top - b.top) });
          curY += b.height + gap;
        });
        break;
      }
    }

    objects.forEach(o => o.setCoords());
    this.canvas.renderAll();
    this.app.history.saveState();
  }
}
