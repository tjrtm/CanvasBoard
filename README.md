# CanvasBoard

An infinite canvas web application for drawing, designing, and organizing visual content—similar to Figma, Excalidraw, or Miro. Create beautiful diagrams, sketches, and designs on an unbounded canvas with unlimited pan and zoom.

## Features

### 🎨 Drawing & Shapes
- **Multiple drawing tools**: Selection, Pen (freehand), Text, Lines/Arrows
- **Shape tools**: Rectangle, Circle, Diamond, Triangle
- **Sticky notes**: Create colorful notes (yellow, green, blue, pink, orange, purple)
- **Eraser**: Remove content from the canvas
- **Connectors**: Draw connecting lines and arrows with customizable styles (solid, dashed, dotted)

### 🗺️ Canvas Capabilities
- **Infinite pan & zoom**: Navigate smoothly with zoom levels from 0.1x to 4.0x
- **Snap-to-grid**: Align objects precisely with optional grid snapping
- **Grid background**: Visual 40px grid for layout guidance
- **Frames**: Container objects that move child elements together
- **Minimap**: Bird's-eye view of your entire canvas for easy navigation

### ✏️ Organization & Editing
- **Multi-select & alignment**: Select multiple objects and align horizontally or vertically
- **Distribution**: Evenly space objects on the canvas
- **Grouping**: Combine objects into groups
- **Properties panel**: Edit object properties (fill color, stroke, text, etc.)
- **Copy/Paste**: Duplicate selected objects
- **Lock objects**: Prevent accidental modification of important elements

### 💾 History & Persistence
- **Undo/Redo**: Full state history (up to 100 states)
- **Auto-save**: Automatically saves your work to browser LocalStorage every 5 seconds
- **Save/Load**: Export and import your canvases as JSON files
- **Export**: Download your work as PNG or SVG images

### 🎯 User Experience
- **Dark/Light theme**: Toggle between themes to suit your preference
- **Keyboard shortcuts**: Quick access to tools and commands
  - `V`: Selection tool
  - `S`: Sticky note
  - `R`: Rectangle
  - `C`: Circle
  - `D`: Diamond
  - `T`: Triangle
  - `P`: Pen (freehand)
  - `L`: Line/Arrow
  - `E`: Eraser
  - `Ctrl/Cmd + Z`: Undo
  - `Ctrl/Cmd + Shift + Z`: Redo
  - `Ctrl/Cmd + C`: Copy
  - `Ctrl/Cmd + V`: Paste
  - `Delete`: Remove selected objects
- **Context menus**: Right-click for quick actions
- **Responsive toolbar**: Easy access to all drawing tools

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- No installation required—works entirely in the browser

### Installation

1. **Clone or download** the repository
2. **Open `index.html`** in your web browser
3. **Start drawing!**

```bash
# If you want to serve it locally:
cd /path/to/canvasboard
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## Technology Stack

- **Canvas Library**: [Fabric.js](http://fabricjs.com/) v5 (local minified version)
- **Language**: Vanilla JavaScript (ES6 modules)
- **Styling**: CSS3 with CSS custom properties for theme support
- **Storage**: Browser LocalStorage for auto-save and persistence
- **DOM**: HTML5 with semantic structure
- **Icons**: Inline SVG sprites

## Project Structure

```
canvasboard/
├── index.html              # Main HTML file
├── css/
│   └── style.css          # Application styles and theme
├── js/
│   ├── app.js             # Application entry point
│   ├── canvas.js          # Canvas manager (pan, zoom, grid)
│   ├── tools.js           # Tool manager and switching
│   ├── shapes.js          # Shape creation and styling
│   ├── connectors.js      # Line and arrow drawing
│   ├── freehand.js        # Pen/drawing path handling
│   ├── selection.js       # Multi-select and alignment
│   ├── properties.js      # Object property editing
│   ├── history.js         # Undo/redo functionality
│   ├── persistence.js     # Save/load and auto-save
│   ├── shortcuts.js       # Keyboard shortcuts
│   ├── minimap.js         # Canvas overview navigation
│   ├── frames.js          # Frame container logic
│   └── ui.js              # UI management and theme
└── lib/
    └── fabric.min.js      # Fabric.js library
```

## Architecture

The application follows a modular architecture with clear separation of concerns:

- **CanvasManager**: Handles canvas setup, panning, zooming, and grid rendering
- **ToolManager**: Manages active tool state and tool switching
- **ShapeManager**: Handles creation and styling of basic shapes
- **ConnectorManager**: Manages line and arrow drawing with styling options
- **FreehandManager**: Handles freehand drawing/pen tool
- **SelectionManager**: Manages multi-select, alignment, distribution, and grouping
- **PropertiesPanel**: Provides UI for editing object properties
- **HistoryManager**: Maintains undo/redo state stack
- **PersistenceManager**: Handles auto-save, JSON import/export, and file management
- **ShortcutsManager**: Maps keyboard shortcuts to actions
- **MinimapManager**: Renders canvas overview for navigation
- **FrameManager**: Handles frame container logic
- **UIManager**: Manages theme switching, zoom controls, and context menus

## Usage Tips

### Drawing
1. Select a tool from the toolbar
2. Click or drag on the canvas to create objects
3. Use the properties panel to customize colors, styles, and text

### Organization
1. Use **frames** to group related objects together
2. **Align and distribute** multiple objects for neat layouts
3. **Lock** important objects to prevent accidental changes

### Saving Your Work
- Your work is **automatically saved** to browser LocalStorage every 5 seconds
- Use **File → Save** to download as JSON for backup
- Use **File → Load** to restore from a saved JSON file
- Use **File → Export as PNG** or **SVG** to share your work as images

### Navigation
- **Pan**: Click and drag with middle mouse button or Space+drag
- **Zoom**: Scroll wheel or zoom controls in the toolbar
- **Minimap**: Click on the minimap to jump to that area of the canvas

## Keyboard Shortcuts Reference

| Action | Shortcut |
|--------|----------|
| Selection tool | V |
| Sticky note | S |
| Rectangle | R |
| Circle | C |
| Diamond | D |
| Triangle | T |
| Pen (freehand) | P |
| Line/Arrow | L |
| Eraser | E |
| Undo | Ctrl/Cmd + Z |
| Redo | Ctrl/Cmd + Shift + Z |
| Copy | Ctrl/Cmd + C |
| Paste | Ctrl/Cmd + V |
| Delete | Delete or Backspace |
| Duplicate | Ctrl/Cmd + D |
| Group | Ctrl/Cmd + G |
| Ungroup | Ctrl/Cmd + Shift + G |
| Zoom in | Ctrl/Cmd + + |
| Zoom out | Ctrl/Cmd + - |
| Fit to screen | Ctrl/Cmd + 0 |

## Browser Compatibility

CanvasBoard works on all modern browsers:
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

## Performance

- **Auto-save**: Runs every 5 seconds using debouncing to avoid excessive writes
- **Efficient rendering**: Uses Fabric.js for optimized canvas rendering
- **State management**: Maintains up to 100 undo/redo states in memory
- **LocalStorage**: Saves ~500KB of data for typical canvases

## Future Enhancements

Potential features for future versions:
- Collaborative editing
- Cloud sync
- Custom colors and themes
- Shape libraries and templates
- Advanced text formatting (bold, italic, fonts)
- Layer management panel
- Comment/annotation system
- Mobile touch support improvements

## Contributing

This is a personal project. Feel free to fork and customize it for your needs!

## License

Feel free to use this project for personal or educational purposes.

## Support

For issues or feature requests, please open an issue or contact the project maintainer.

---

**Happy drawing!** 🎨
