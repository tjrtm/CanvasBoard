# CanvasBoard

A professional infinite canvas application — draw shapes, connect ideas, organize visually.

## Features

- **Infinite canvas** — pan, zoom, navigate freely
- **Shape tools** — rectangle, circle, diamond, triangle with inline text editing
- **Sticky notes** — color-coded notes with editable text
- **Frames** — group objects visually; contents move with the frame
- **Drawing tools** — freehand pen, lines, arrows
- **Text tool** — standalone text objects
- **Properties panel** — fill, stroke, opacity, text color, z-order
- **Alignment tools** — align and distribute multiple objects
- **Minimap** — overview navigation
- **Undo/Redo** — full history stack
- **Auto-save** — localStorage persistence
- **Save/Load** — export and import `.canvasboard.json` files
- **Export** — PNG and SVG
- **Dark/Light theme** — toggle with one click
- **Keyboard shortcuts** — full shortcut support

## Tech Stack

Pure static web app — no build step, no server-side dependencies.

- HTML + CSS + vanilla JavaScript (ES modules)
- [Fabric.js](http://fabricjs.com/) v5.3.1 (self-hosted, patched)

## Deploy

Upload the files to any web server or static hosting:

```
index.html
favicon.ico
css/style.css
lib/fabric.min.js
js/*.js
```

Works with Apache, nginx, GitHub Pages, Netlify, Vercel, cPanel shared hosting — anything that serves static files.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select |
| R | Rectangle |
| C | Circle |
| D | Diamond |
| T | Text |
| S | Sticky Note |
| P | Pen |
| L | Line |
| E | Eraser |
| F | Frame |
| M | Toggle minimap |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+C / Ctrl+V | Copy / Paste |
| Ctrl+D | Duplicate |
| Ctrl+A | Select all |
| Ctrl+G / Ctrl+Shift+G | Group / Ungroup |
| Delete | Delete selected |
| Space + drag | Pan |
| Scroll | Zoom |
| Double-click shape | Edit text |

## License

MIT
