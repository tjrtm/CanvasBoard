// shortcuts.js — Keyboard shortcut handler

export class ShortcutsManager {
  constructor(app) {
    this.app = app;
  }

  init() {
    document.addEventListener('keydown', (e) => this._handle(e));
  }

  _handle(e) {
    // Don't intercept when typing in an input/textarea/contenteditable
    if (_isTyping(e)) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key;
    const code = e.code;

    // ─── Tool shortcuts ────────────────────────────────────────────────────
    if (!ctrl && !shift) {
      switch (key.toLowerCase()) {
        case 'v': this.app.tools.setTool('select'); return;
        case 's': this.app.tools.setTool('sticky'); return;
        case 'r': this.app.tools.setTool('rect'); return;
        case 'c': if (!ctrl) { this.app.tools.setTool('circle'); return; } break;
        case 'd': if (!ctrl) { this.app.tools.setTool('diamond'); return; } break;
        case 't': this.app.tools.setTool('text'); return;
        case 'p': this.app.tools.setTool('pen'); return;
        case 'l': this.app.tools.setTool('line'); return;
        case 'e': this.app.tools.setTool('eraser'); return;
        case 'f': this.app.tools.setTool('frame'); return;
        case 'm': this.app.minimap.toggle(); return;
        case 'escape':
          this.app.tools.setTool('select');
          this.app.selection.deselect();
          return;
        case 'delete':
        case 'backspace':
          // Only delete if not editing text
          if (!_isEditingText(this.app.canvas)) {
            this.app.selection.deleteSelected();
            e.preventDefault();
          }
          return;
        case ']':
          this.app.selection.bringForward();
          e.preventDefault();
          return;
        case '[':
          this.app.selection.sendBackward();
          e.preventDefault();
          return;
      }
    }

    // ─── Ctrl shortcuts ────────────────────────────────────────────────────
    if (ctrl && !shift) {
      switch (key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          this.app.history.undo();
          return;
        case 'y':
          e.preventDefault();
          this.app.history.redo();
          return;
        case 'c':
          this.app.selection.copy();
          e.preventDefault();
          return;
        case 'v':
          this.app.selection.paste();
          e.preventDefault();
          return;
        case 'd':
          this.app.selection.duplicate();
          e.preventDefault();
          return;
        case 'a':
          this.app.selection.selectAll();
          e.preventDefault();
          return;
        case 'g':
          this.app.selection.group();
          e.preventDefault();
          return;
        case '0':
          this.app.canvasManager.resetZoom();
          e.preventDefault();
          return;
        case '1':
          this.app.canvasManager.fitToContent();
          e.preventDefault();
          return;
        case "'":
          this.app.canvasManager.setGridSnap(!this.app.canvasManager.snapToGrid);
          e.preventDefault();
          return;
        case ']':
          this.app.selection.bringToFront();
          e.preventDefault();
          return;
        case '[':
          this.app.selection.sendToBack();
          e.preventDefault();
          return;
      }
    }

    // ─── Ctrl+Shift shortcuts ──────────────────────────────────────────────
    if (ctrl && shift) {
      switch (key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          this.app.history.redo();
          return;
        case 'g':
          this.app.selection.ungroup();
          e.preventDefault();
          return;
      }
    }
  }
}

function _isTyping(e) {
  const t = e.target;
  if (!t) return false;
  return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable;
}

function _isEditingText(canvas) {
  const obj = canvas.getActiveObject();
  return obj && (obj.type === 'i-text' || obj.type === 'textbox') && obj.isEditing;
}
