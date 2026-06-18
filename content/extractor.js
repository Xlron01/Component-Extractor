if (typeof window.suidExtractorInitialized === 'undefined') {
window.suidExtractorInitialized = true;

// ═══════════════════════════════════════════════════════════════════════════════
//  Smart UI Decompiler — Hybrid Extraction Engine
//
//  Mode A │ Iframe / Sandbox context  → extract full document (safest, lossless)
//  Mode B │ Regular website top-frame → isolate element + inline computed styles
// ═══════════════════════════════════════════════════════════════════════════════

// ── Comprehensive style property allowlist for Mode B ─────────────────────────
const STYLE_PROPS = [
  // Layout & Box Model
  'display','position','top','right','bottom','left','z-index','float','clear',
  'box-sizing','overflow','overflow-x','overflow-y',
  // Dimensions
  'width','height','min-width','max-width','min-height','max-height',
  // Spacing
  'padding','padding-top','padding-right','padding-bottom','padding-left',
  'margin','margin-top','margin-right','margin-bottom','margin-left',
  // Flexbox
  'flex','flex-direction','flex-wrap','flex-flow',
  'justify-content','align-items','align-self','align-content',
  'flex-grow','flex-shrink','flex-basis','gap','row-gap','column-gap',
  'order',
  // Grid
  'grid-template-columns','grid-template-rows','grid-template-areas',
  'grid-column','grid-row','grid-area','grid-gap',
  // Background
  'background','background-color','background-image','background-position',
  'background-size','background-repeat','background-attachment','background-clip',
  'background-origin',
  // Typography
  'color','font','font-family','font-size','font-weight','font-style',
  'font-variant','line-height','letter-spacing','word-spacing',
  'text-align','text-decoration','text-transform','text-shadow',
  'text-overflow','white-space','word-break','word-wrap',
  'vertical-align',
  // Border
  'border','border-top','border-right','border-bottom','border-left',
  'border-width','border-style','border-color',
  'border-top-width','border-right-width','border-bottom-width','border-left-width',
  'border-top-style','border-right-style','border-bottom-style','border-left-style',
  'border-top-color','border-right-color','border-bottom-color','border-left-color',
  'border-radius',
  'border-top-left-radius','border-top-right-radius',
  'border-bottom-left-radius','border-bottom-right-radius',
  // Effects
  'box-shadow','opacity','visibility','filter','backdrop-filter',
  // Transform & Animation
  'transform','transform-origin','transform-style','perspective',
  'transition','animation',
  // Misc
  'cursor','pointer-events','user-select','content',
  'outline','outline-width','outline-style','outline-color',
  'object-fit','object-position',
  'list-style','list-style-type','list-style-position',
];

// Values that carry zero visual information — safe to skip
const SKIP_VALUES = new Set([
  'none','normal','auto','0px','0%','initial','unset','inherit',
  'rgba(0, 0, 0, 0)','transparent','repeat','100%','start','left',
  'disc','outside','visible','static','inline','content-box','separate',
  'baseline','row','nowrap','0px 0px','top left',
]);

// ── MODE A: Full-document capture (iframes / sandboxes) ──────────────────────
function extractFullDocument(element) {
  const doc = element.ownerDocument;
  return {
    html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML,
    css: '',
    mode: 'full-document',
  };
}

// ── MODE B: Standalone element with inlined computed styles ───────────────────
function extractStandaloneElement(element) {
  const elWindow = element.ownerDocument.defaultView || window;

  // ── Helper to inline styles for a cloned tree ─────────────────────────────
  let pseudoCSS = '';
  function inlineElementStyles(origEl, cloneEl) {
    const originals = [origEl, ...origEl.querySelectorAll('*')];
    const clones    = [cloneEl,   ...cloneEl.querySelectorAll('*')];

    originals.forEach((orig, i) => {
      const cl = clones[i];
      if (!cl || orig.nodeType !== Node.ELEMENT_NODE) return;

      const computed = elWindow.getComputedStyle(orig);
      let inlineStyle = '';

      STYLE_PROPS.forEach(prop => {
        const val = computed.getPropertyValue(prop);
        if (val && !SKIP_VALUES.has(val.trim())) {
          inlineStyle += `${prop}:${val};`;
        }
      });

      for (let j = 0; j < computed.length; j++) {
        const p = computed[j];
        if (p.startsWith('--')) {
          const v = computed.getPropertyValue(p).trim();
          if (v) inlineStyle += `${p}:${v};`;
        }
      }

      cl.setAttribute('style', inlineStyle);

      const uid = `suid-${Math.random().toString(36).substr(2, 9)}`;
      cl.setAttribute('data-suid', uid);

      ['::before', '::after'].forEach(pseudo => {
        const ps      = elWindow.getComputedStyle(orig, pseudo);
        const content = ps.getPropertyValue('content');
        if (!content || content === 'none' || content === 'normal' || content === '""' || content === "''") return;

        let rules = `content:${content};`;
        STYLE_PROPS.forEach(prop => {
          const val = ps.getPropertyValue(prop);
          if (val && !SKIP_VALUES.has(val.trim())) rules += `${prop}:${val};`;
        });
        pseudoCSS += `[data-suid="${uid}"]${pseudo}{${rules}}\n`;
      });
    });
  }

  // ── 1. Find a containing parent wrapper to scan for background iframes ──────
  let parent = element.parentElement;
  let wrapper = null;
  while (parent && parent.tagName !== 'BODY' && parent.tagName !== 'HTML') {
    const className = parent.className || '';
    if (
      className.includes('wrapper') ||
      className.includes('container') ||
      className.includes('section') ||
      ['SECTION', 'HEADER', 'FOOTER', 'MAIN', 'ARTICLE'].includes(parent.tagName)
    ) {
      wrapper = parent;
      break;
    }
    parent = parent.parentElement;
  }
  if (!wrapper && element.parentElement && element.parentElement.tagName !== 'BODY') {
    wrapper = element.parentElement;
  }

  // ── 2. Scan wrapper for background iframe with negative z-index ───────────
  let bgContainer = null;
  if (wrapper) {
    const iframes = wrapper.querySelectorAll('iframe');
    for (const iframe of iframes) {
      // Don't detect if the iframe is a child of the clicked element itself
      if (element.contains(iframe)) continue;

      let curr = iframe;
      while (curr && curr !== wrapper) {
        const computed = elWindow.getComputedStyle(curr);
        const zIndex = computed.getPropertyValue('z-index');
        if (zIndex && !isNaN(parseInt(zIndex)) && parseInt(zIndex) < 0) {
          bgContainer = curr;
          break;
        }
        curr = curr.parentElement;
      }
      if (bgContainer) break;
    }
  }

  // ── 3. Clone and process foreground element ───────────────────────────────
  const clone = element.cloneNode(true);
  inlineElementStyles(element, clone);

  // ── 4. Clone and process background iframe container if found ──────────────
  let bgClone = null;
  if (bgContainer) {
    bgClone = bgContainer.cloneNode(true);
    inlineElementStyles(bgContainer, bgClone);

    // Override background z-index to 0 so it becomes visible on local preview
    bgClone.style.setProperty('z-index', '0', 'important');

    // Ensure the foreground component clone stacks on top of the background iframe
    const computedPosition = elWindow.getComputedStyle(element).position;
    if (computedPosition === 'static') {
      clone.style.setProperty('position', 'relative');
      clone.style.setProperty('z-index', '1');
    } else {
      const computedZIndex = elWindow.getComputedStyle(element).zIndex;
      if (computedZIndex === 'auto' || parseInt(computedZIndex) <= 0) {
        clone.style.setProperty('z-index', '1');
      }
    }
  }

  // ── 5. Generate font faces ────────────────────────────────────────────────
  let fontCSS = '';
  try {
    Array.from(element.ownerDocument.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule.type === CSSRule.FONT_FACE_RULE) fontCSS += rule.cssText + '\n';
        });
      } catch { /* cross-origin sheet — skip */ }
    });
  } catch { /* no access */ }

  const bodyPadding = bgClone ? '0' : '16px';
  const styleBlock = [
    '*, *::before, *::after { box-sizing: border-box; }',
    `body { margin: 0; padding: ${bodyPadding}; }`,
    fontCSS    ? `/* ── Web Fonts ── */\n${fontCSS}`       : '',
    pseudoCSS  ? `/* ── Pseudo-elements ── */\n${pseudoCSS}` : '',
  ].filter(Boolean).join('\n');

  // If we have a background clone, wrap it with foreground clone in a relative wrapper
  let bodyContent = clone.outerHTML;
  if (bgClone) {
    bodyContent = `
  <div style="position: relative; width: 100%; min-height: 100vh;">
    ${bgClone.outerHTML}
    ${clone.outerHTML}
  </div>`;
  }

  const fullHtml =
`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extracted Component</title>
  <style>
${styleBlock.split('\n').map(l => '    ' + l).join('\n')}
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  return { html: fullHtml, css: '', mode: 'standalone' };
}

// ── Offline Unicorn Studio Scene Processor ────────────────────────────────────
async function processUnicornStudioScenes(htmlString, isStandaloneMode) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const elements = doc.querySelectorAll('[data-us-project]');
  if (elements.length === 0) return htmlString;

  let hasUnicornStudio = false;

  for (const el of elements) {
    const projectId = el.getAttribute('data-us-project');
    if (!projectId) continue;

    try {
      const sceneData = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'fetchUnicornScene', projectId }, (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (res && res.success) {
            resolve(res.data);
          } else {
            reject(new Error(res ? res.error : 'Unknown background error'));
          }
        });
      });

      if (sceneData) {
        hasUnicornStudio = true;
        const scriptId = `us-scene-${projectId}`;

        // Modify container attributes to point to offline script element
        el.removeAttribute('data-us-project');
        el.setAttribute('data-us-project-src', scriptId);
        el.removeAttribute('data-us-initialized');
        el.removeAttribute('data-scene-id');

        // Remove any already-rendered canvas elements so library recreates it
        el.querySelectorAll('canvas').forEach(canvas => canvas.remove());

        // Create script tag containing scene JSON
        const script = doc.createElement('script');
        script.type = 'application/json';
        script.id = scriptId;
        script.textContent = JSON.stringify(sceneData);

        // Insert adjacent to container
        el.parentNode.insertBefore(script, el.nextSibling);
      }
    } catch (err) {
      console.warn(`[SUID] Failed to process UnicornStudio project ${projectId}:`, err);
    }
  }

  if (hasUnicornStudio) {
    const head = doc.head;
    if (head) {
      // 1. Inject DOMContentLoaded listener to bootstrap Unicorn Studio offline
      const initScript = doc.createElement('script');
      initScript.textContent = `
        document.addEventListener('DOMContentLoaded', function () {
          if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
            UnicornStudio.init();
            window.UnicornStudio.isInitialized = true;
          }
        });
      `;
      head.appendChild(initScript);

      // 2. In Mode B (standalone), also ensure library script is loaded
      if (isStandaloneMode) {
        let scriptExists = false;
        doc.querySelectorAll('script').forEach(s => {
          if (s.src && s.src.includes('unicornStudio.umd.js')) {
            scriptExists = true;
          }
        });
        if (!scriptExists) {
          const libScript = doc.createElement('script');
          libScript.src = 'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js';
          head.insertBefore(libScript, initScript);
        }
      }
    }
  }

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

// ── Master extractor — decides Mode A vs Mode B (Asynchronous) ────────────────
async function extractElementData(element) {
  const ownerDoc  = element.ownerDocument;
  const ownerWin  = ownerDoc.defaultView;

  // Mode A: element lives in a sub-frame (iframe) or the extractor itself
  // was called from inside a sandboxed temp-iframe context
  const isInsideFrame =
    ownerWin &&
    ownerWin.self !== ownerWin.top; // true when inside any iframe

  let rawResult;
  let isStandaloneMode = false;

  if (isInsideFrame) {
    rawResult = extractFullDocument(element);
  } else {
    rawResult = extractStandaloneElement(element);
    isStandaloneMode = true;
  }

  // Process any embedded WebGL Unicorn Studio animations to bundle them offline
  try {
    const processedHtml = await processUnicornStudioScenes(rawResult.html, isStandaloneMode);
    rawResult.html = processedHtml;
  } catch (err) {
    console.error('[SUID] Error processing Unicorn Studio scenes:', err);
  }

  return rawResult;
}

window.extractElementData = extractElementData;

} // End of initialization guard

