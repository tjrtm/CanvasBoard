// freehand.js — Freehand pen drawing management

export class FreehandManager {
  constructor(app) {
    this.app = app;
    this.canvas = app.canvas;
    this.color = '#ffffff';
    this.width = 3;
    this.smoothing = true;
  }

  // Called when pen tool is activated
  activate() {
    const canvas = this.canvas;
    canvas.isDrawingMode = true;

    if (!canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    }

    this.color = this.app.canvasManager.isDark ? '#ffffff' : '#1a1a1a';
    canvas.freeDrawingBrush.color = this.color;
    canvas.freeDrawingBrush.width = this.width;
    canvas.freeDrawingBrush.decimate = this.smoothing ? 4 : 1;
  }

  deactivate() {
    this.canvas.isDrawingMode = false;
  }

  setColor(color) {
    this.color = color;
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color;
    }
  }

  setWidth(width) {
    this.width = width;
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.width = width;
    }
  }

  // After a path is created, tag it and add to history
  onPathCreated(path) {
    if (!path.data) path.data = {};
    path.data.type = 'pen';
  }
}
