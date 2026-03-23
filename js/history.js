// history.js — Undo/Redo stack (JSON snapshot based)
export class HistoryManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.stack = [];
    this.index = -1;
    this.maxSize = 100;
    this._saving = false;
    this._ignoreNext = false;
  }

  init() {
    // Capture state after significant changes
    const save = this._debounce(() => this.saveState(), 250);

    this.canvas.on('object:added', () => { if (!this._ignoreNext) save(); });
    this.canvas.on('object:removed', () => { if (!this._ignoreNext) save(); });
    this.canvas.on('object:modified', () => { if (!this._ignoreNext) save(); });

    // Save initial (empty) state
    this.saveState();
  }

  saveState() {
    if (this._saving) return;
    this._saving = true;

    try {
      const json = JSON.stringify(this.canvas.toJSON(['subtype', 'data', 'locked']));

      // Trim future states if we branched
      if (this.index < this.stack.length - 1) {
        this.stack = this.stack.slice(0, this.index + 1);
      }

      // Avoid duplicate saves
      if (this.stack.length > 0 && this.stack[this.stack.length - 1] === json) {
        this._saving = false;
        return;
      }

      this.stack.push(json);

      // Trim to max size
      if (this.stack.length > this.maxSize) {
        this.stack.shift();
      }

      this.index = this.stack.length - 1;
      this._updateUndoRedoBtns();
    } finally {
      this._saving = false;
    }
  }

  undo() {
    if (this.index <= 0) return;
    this.index--;
    this._restore(this.stack[this.index]);
    this._updateUndoRedoBtns();
  }

  redo() {
    if (this.index >= this.stack.length - 1) return;
    this.index++;
    this._restore(this.stack[this.index]);
    this._updateUndoRedoBtns();
  }

  _restore(json) {
    this._ignoreNext = true;
    const parsed = JSON.parse(json);
    this.canvas.loadFromJSON(parsed, () => {
      this.canvas.discardActiveObject();
      this.canvas.renderAll();
      this._ignoreNext = false;
    });
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  _updateUndoRedoBtns() {
    // Dispatch custom event so ui.js can update button states
    document.dispatchEvent(new CustomEvent('history:change', {
      detail: { canUndo: this.canUndo(), canRedo: this.canRedo() }
    }));
  }

  _debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }
}
