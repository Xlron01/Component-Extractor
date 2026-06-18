# Smart UI Decompiler — Chrome Extension

A professional Chrome extension designed for engineering and harvesting visual UI components from any website, compiling them into clean, standalone HTML documents that are Tailwind CSS-compatible and run 100% offline.

---

## 🎯 Core Features

The extension supports extraction through three primary modes:

### 1. Standalone Extraction Mode (Mode B)
* **Precise Component Isolation**: When you click an element, the picker isolates only the targeted element and its child elements, completely avoiding fetching adjacent elements or sidebars (No Sibling Fetching).
* **Outer Layout & Sizing Freezing**: Reads the dimensions of the live container (`getBoundingClientRect` in pixels), locks its `max-width` to `100%` for responsiveness, preserves original center margins (`margin-left`/`margin-right`), and enforces `box-sizing: border-box !important` and original `display` styles to prevent structural collapses.
* **Style Flattening**: Automatically converts dynamic layouts and absolute positions (such as Framer Motion elements) into static, inline style properties in pixels.
* **Environmental Shock Protection**: Automatically extracts custom CSS variables (`--custom-variables`), root classes, and inline styles from the source `<html>` and `<body>` tags and applies them to the compiled local document to preserve dark mode, typography, and theme styling.
* **3D & Interactive Background Recovery**:
  - **Unicorn Studio Support**: Automatically intercepts WebGL scene JSON configurations and packages them into the HTML document to render scenes locally and completely offline.
  - **Spline 3D Support**: Detects parent layout containers containing hidden absolute background iframes (with negative `z-index`), clones them, overrides their styling to `z-index: 0`, and raises the foreground element to `z-index: 1` relative stack.

### 2. Full-Document Sandbox Extraction (Mode A)
* Automatically triggered inside sandboxed environments or iframes (e.g., Webflow and Framer canvas screens) to capture the full document context, avoiding losing nested styles or scripts.

### 3. Full-Page Downloader (Download Page)
* A dedicated button in the extension popup that downloads the entire document structure (`document.documentElement.outerHTML` prepended with `<!DOCTYPE html>`) with a single click, matching the exact code copying experience in the elements panel of browser DevTools.

---

## 🏗️ Processor Pipeline Architecture

The extraction engine in `extractor.js` sequences operations through independent asynchronous modules using a shared `context` object:

1. **`SplineProcessor`**: Captures and restores negative `z-index` background 3D iframe wrappers.
2. **`RelativePathProcessor`**: Resolves relative asset paths (`src`/`href`) to fully absolute URLs based on `document.baseURI`.
3. **`TailwindProcessor`**: Detects if Tailwind is used on the page and automatically bundles the Tailwind CSS CDN script.
4. **`UnicornProcessor`**: Intercepts project IDs, fetches source scene JSON data, and bundles it into adjacent inline scripts.
5. **`StyleFlatteningProcessor`**: Loops through the elements tree, reads computed values from the live DOM, and writes frozen style properties on the cloned element.

---

## ⚙️ Installation & Usage

1. Clone or download the repository locally.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the `extension` subdirectory within the project folder.
5. Navigate to any website, open the extension popup, and click:
   - **Inspect Element**: To highlight and extract specific components.
   - **Download Page**: To download the entire active page structure.

---

## 🔮 Future Vision & Roadmap

We plan to expand the capabilities of this tool in upcoming versions:
* **UI Frameworks Code Exporter**: Support exporting the final compiled HTML directly into React (JSX), Vue, or Svelte component files.
* **Local Asset Bundler & Zipper**: Download all source images, assets, and custom fonts into a single structured ZIP file alongside the HTML code.
* **DOM Breadcrumbs Selector**: Display a breadcrumb navigation bar at the bottom during element hovering, allowing developers to target the exact parent or child node before extraction.
* **Expanded 3D/Canvas Engine Autodetect**: Extend autodetect support to other WebGL-based engines like Three.js, React Three Fiber (R3F), and custom Canvas frameworks.
