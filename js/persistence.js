// persistence.js — Auto-save (localStorage), JSON save/load, PNG/SVG export

const LS_KEY = 'canvasboard_autosave';
const AUTOSAVE_INTERVAL = 5000; // 5 seconds

export class PersistenceManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this._dirty = false;
    this._autoSaveTimer = null;
    this._lastSaveHash = null;
  }

  init() {
    // Mark dirty on any change
    this.canvas.on('object:added',    () => this._setDirty());
    this.canvas.on('object:removed',  () => this._setDirty());
    this.canvas.on('object:modified', () => this._setDirty());

    // Auto-save loop
    this._autoSaveTimer = setInterval(() => this._autoSave(), AUTOSAVE_INTERVAL);

    // Save on page unload
    window.addEventListener('beforeunload', () => this._autoSave(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this._autoSave(true);
    });

    // Wire top bar buttons
    document.getElementById('save-btn').addEventListener('click', () => this.saveToFile());
    document.getElementById('load-btn').addEventListener('click', () =>
      document.getElementById('load-file-input').click());
    document.getElementById('load-file-input').addEventListener('change', (e) =>
      this.loadFromFile(e));

    // Export menu
    document.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('export-menu').classList.add('hidden');
        const format = btn.dataset.export;
        if (format === 'png') this.exportPNG();
        if (format === 'svg') this.exportSVG();
      });
    });

    // Export dropdown toggle
    const exportBtn = document.getElementById('export-btn');
    const exportMenu = document.getElementById('export-menu');
    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
      });
      document.addEventListener('click', () => exportMenu.classList.add('hidden'));
    }
  }

  // ─── Auto-save ─────────────────────────────────────────────────────────────

  _setDirty() { this._dirty = true; }

  _autoSave(force = false) {
    if (!this._dirty && !force) return;
    try {
      const json = this._serialize();
      const hash = this._simpleHash(json);
      if (hash !== this._lastSaveHash) {
        localStorage.setItem(LS_KEY, json);
        this._lastSaveHash = hash;
      }
      this._dirty = false;
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  }

  // ─── Load from localStorage ─────────────────────────────────────────────────

  async loadFromLocalStorage() {
    try {
      const json = localStorage.getItem(LS_KEY);
      if (!json) return;
      await this._deserialize(json);
      console.log('Board restored from auto-save.');
    } catch (e) {
      console.warn('Failed to load auto-save:', e);
    }
  }

  // ─── Save to file ──────────────────────────────────────────────────────────

  saveToFile() {
    const json = this._serialize();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'board.canvasboard.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Load from file ────────────────────────────────────────────────────────

  async loadFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // reset input
    try {
      const text = await file.text();
      await this._deserialize(text);
      this.app.history.saveState();
    } catch (err) {
      alert('Failed to load file: ' + err.message);
    }
  }

  // ─── Serialize / Deserialize ───────────────────────────────────────────────

  _serialize() {
    const canvasJson = this.canvas.toJSON(['data', 'locked', 'subTargetCheck']);
    const payload = {
      version: 1,
      canvas: canvasJson,
      viewport: this.canvas.viewportTransform.slice(),
      theme: this.app.canvasManager.isDark ? 'dark' : 'light',
    };
    return JSON.stringify(payload);
  }

  _deserialize(text) {
    return new Promise((resolve, reject) => {
      try {
        const payload = JSON.parse(text);
        const canvasData = payload.canvas || payload; // support legacy format

        this.canvas.loadFromJSON(canvasData, () => {
          if (payload.viewport) {
            this.canvas.setViewportTransform(payload.viewport);
          }

          this.canvas.renderAll();
          this.app.canvasManager.updateZoomDisplay();

          if (payload.theme === 'light' && this.app.canvasManager.isDark) {
            this.app.canvasManager.toggleTheme();
          }
          resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // ─── PNG Export ────────────────────────────────────────────────────────────

  exportPNG() {
    // Temporarily reset viewport for full export
    const vt = this.canvas.viewportTransform.slice();
    const objects = this.canvas.getObjects();
    if (objects.length === 0) {
      alert('Nothing to export.');
      return;
    }

    // Find bounding box of all objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    objects.forEach(obj => {
      const b = obj.getBoundingRect(true, true);
      minX = Math.min(minX, b.left);
      minY = Math.min(minY, b.top);
      maxX = Math.max(maxX, b.left + b.width);
      maxY = Math.max(maxY, b.top + b.height);
    });

    const pad = 40;
    const dataUrl = this.canvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2,
      left: minX - pad,
      top: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    });

    this._download(dataUrl, 'board.png');
  }

  // ─── SVG Export ────────────────────────────────────────────────────────────

  exportSVG() {
    const svg = this.canvas.toSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    this._download(url, 'board.svg');
    URL.revokeObjectURL(url);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  _download(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  destroy() {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
  }
}
