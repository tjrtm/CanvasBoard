// ui.js — Theme toggle, zoom controls, toolbar wiring, context menu

export class UIManager {
  constructor(app) {
    this.app = app;
  }

  init() {
    this._wireZoomControls();
    this._wireThemeToggle();
    this._wireContextMenu();
    this._addToolKeyHints();
  }

  // ─── Zoom controls ─────────────────────────────────────────────────────────

  _wireZoomControls() {
    document.getElementById('zoom-in-btn').addEventListener('click', () =>
      this.app.canvasManager.zoomIn());
    document.getElementById('zoom-out-btn').addEventListener('click', () =>
      this.app.canvasManager.zoomOut());
    document.getElementById('zoom-display').addEventListener('click', () =>
      this.app.canvasManager.resetZoom());
    document.getElementById('zoom-fit-btn').addEventListener('click', () =>
      this.app.canvasManager.fitToContent());
  }

  // ─── Theme toggle ──────────────────────────────────────────────────────────

  _wireThemeToggle() {
    document.getElementById('theme-btn').addEventListener('click', () => {
      this.app.canvasManager.toggleTheme();
    });
  }

  // ─── Context Menu ──────────────────────────────────────────────────────────

  _wireContextMenu() {
    const menu = document.getElementById('context-menu');

    document.addEventListener('canvas:contextmenu', (e) => {
      const { e: mouseEvent, target } = e.detail;
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();

      if (target) {
        if (!this.app.canvas.getActiveObjects().includes(target)) {
          this.app.canvas.setActiveObject(target);
          this.app.canvas.renderAll();
        }
      } else {
        this.app.canvas.discardActiveObject();
        this.app.canvas.renderAll();
      }

      this._showContextMenu(mouseEvent.clientX, mouseEvent.clientY, target);
    });

    // Hide on click elsewhere
    document.addEventListener('click', () => menu.classList.add('hidden'));
    document.addEventListener('contextmenu', () => menu.classList.add('hidden'));

    // Wire context menu actions
    menu.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._handleContextAction(btn.dataset.action);
        menu.classList.add('hidden');
      });
    });
  }

  _showContextMenu(x, y, target) {
    const menu = document.getElementById('context-menu');
    menu.classList.remove('hidden');

    // Position
    const mw = 170, mh = 250;
    const wx = window.innerWidth, wy = window.innerHeight;
    let left = x, top = y;
    if (left + mw > wx) left = wx - mw - 8;
    if (top + mh > wy) top = wy - mh - 8;

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // Show/hide ungroup based on target type
    const ungroupBtn = menu.querySelector('[data-action="ungroup"]');
    const groupBtn = menu.querySelector('[data-action="group"]');
    const hasMulti = this.app.canvas.getActiveObjects().length > 1;
    const isGroup = target && target.type === 'group' &&
                    !(target.data && target.data.type === 'sticky');

    if (groupBtn) groupBtn.style.display = hasMulti ? '' : 'none';
    if (ungroupBtn) ungroupBtn.style.display = isGroup ? '' : 'none';
  }

  _handleContextAction(action) {
    const sel = this.app.selection;
    switch (action) {
      case 'bring-front':   sel.bringToFront(); break;
      case 'send-back':     sel.sendToBack(); break;
      case 'bring-forward': sel.bringForward(); break;
      case 'send-backward': sel.sendBackward(); break;
      case 'group':         sel.group(); break;
      case 'ungroup':       sel.ungroup(); break;
      case 'duplicate':     sel.duplicate(); break;
      case 'copy':          sel.copy(); break;
      case 'paste':         sel.paste(); break;
      case 'delete':        sel.deleteSelected(); break;
    }
  }

  // ─── Tool key hints (tiny letters on toolbar buttons) ──────────────────────

  _addToolKeyHints() {
    const hints = {
      select: 'V', sticky: 'S', rect: 'R', circle: 'C',
      diamond: 'D', text: 'T', pen: 'P', line: 'L', eraser: 'E', frame: 'F'
    };
    document.querySelectorAll('.tool-btn').forEach(btn => {
      const key = hints[btn.dataset.tool];
      if (key) btn.dataset.key = key;
    });
  }
}
