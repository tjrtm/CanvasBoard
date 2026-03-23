// app.js — Main entry point, initializes all modules

import { CanvasManager }    from './canvas.js';
import { ToolManager }      from './tools.js';
import { ShapeManager }     from './shapes.js';
import { ConnectorManager } from './connectors.js';
import { FreehandManager }  from './freehand.js';
import { SelectionManager } from './selection.js';
import { PropertiesPanel }  from './properties.js';
import { HistoryManager }   from './history.js';
import { PersistenceManager } from './persistence.js';
import { ShortcutsManager } from './shortcuts.js';
import { MinimapManager }   from './minimap.js';
import { FrameManager }     from './frames.js';
import { UIManager }        from './ui.js';

// Global App object (also accessible on window for debugging)
const App = {};
window.App = App;

async function init() {
  // ── 1. Canvas setup ────────────────────────────────────────────────────────
  App.canvasManager = new CanvasManager('main-canvas');
  App.canvas        = App.canvasManager.canvas;

  // ── 2. Core services (no cross-dependencies) ───────────────────────────────
  App.history     = new HistoryManager(App.canvas);
  App.shapes      = new ShapeManager(App);
  App.connectors  = new ConnectorManager(App);
  App.freehand    = new FreehandManager(App);
  App.selection   = new SelectionManager(App);
  App.properties  = new PropertiesPanel(App);
  App.persistence = new PersistenceManager(App);
  App.minimap     = new MinimapManager(App);
  App.frames      = new FrameManager(App);

  // ── 3. Tools (depends on shapes/connectors/freehand) ──────────────────────
  App.tools = new ToolManager(App);

  // ── 4. UI wiring ──────────────────────────────────────────────────────────
  App.ui        = new UIManager(App);
  App.shortcuts = new ShortcutsManager(App);

  // ── 5. Init all modules ───────────────────────────────────────────────────
  App.history.init();
  App.selection.init();
  App.properties.init();
  App.tools.init();
  App.ui.init();
  App.shortcuts.init();
  App.minimap.init();
  App.frames.init();
  App.connectors.init();

  // ── 6. Persistence: init then load saved state ────────────────────────────
  App.persistence.init();
  await App.persistence.loadFromLocalStorage();

  // ── 7. Wire freehand path:created through tools ────────────────────────────
  App.canvas.on('path:created', (opt) => {
    const path = opt.path;
    App.freehand.onPathCreated(path);
    App.history.saveState();
    App.tools.setTool('select');
  });

  console.log('CanvasBoard ready');
}

// Wait for Fabric.js to load
if (typeof fabric !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  window.addEventListener('load', init);
}
