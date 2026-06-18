if (typeof window.suidExtractorInitialized === 'undefined') {
window.suidExtractorInitialized = true;

// ═══════════════════════════════════════════════════════════════════════════════
//  Smart UI Decompiler — Modular Extraction Engine (Processor Pipeline)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Comprehensive style property allowlist ─────────────────────────────────────
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
  'none','normal','initial','unset','inherit',
  'rgba(0, 0, 0, 0)','transparent','repeat',
]);

// ── Stop climbing when hitting editor wrappers / preview shells ───────────────
function findLogicalComponent(element) {
  let curr = element;
  let lastValid = element;

  while (curr && curr.tagName !== 'BODY' && curr.tagName !== 'HTML') {
    const className = (curr.className || '').toString().toLowerCase();
    const id = (curr.id || '').toString().toLowerCase();

    // Stop-words representing editor layouts or sandboxes
    if (
      className.includes('w-designer') ||
      className.includes('w-renderer') ||
      className.includes('designer-shell') ||
      className.includes('preview-shell') ||
      className.includes('editor-wrapper') ||
      className.includes('framer-preview') ||
      className.includes('sandbox-wrapper') ||
      id.includes('designer') ||
      id.includes('editor')
    ) {
      break;
    }

    const isLogicalWrapper =
      className.includes('wrapper') ||
      className.includes('container') ||
      className.includes('component') ||
      className.includes('section') ||
      className.includes('hero') ||
      ['SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'NAV'].includes(curr.tagName);

    if (isLogicalWrapper) {
      lastValid = curr;
      // If we hit a core structural tag, stop climbing immediately
      if (['SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN'].includes(curr.tagName)) {
        break;
      }
    }

    curr = curr.parentElement;
  }

  return lastValid;
}

// ── PROCESSOR 1: Relative Path Processor ──────────────────────────────────────
const RelativePathProcessor = {
  name: 'RelativePathProcessor',
  async process(context) {
    const baseURI = context.ownerDocument.baseURI;
    const resolveURL = (url) => {
      try {
        return new URL(url, baseURI).href;
      } catch {
        return url;
      }
    };

    const processElement = (el) => {
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
      if (el.hasAttribute('src')) {
        const src = el.getAttribute('src');
        if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
          el.setAttribute('src', resolveURL(src));
        }
      }
      if (el.hasAttribute('href')) {
        const href = el.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          el.setAttribute('href', resolveURL(href));
        }
      }
    };

    processElement(context.clonedElement);
    context.clonedElement.querySelectorAll('[src], [href]').forEach(processElement);

    if (context.iframeBackground) {
      processElement(context.iframeBackground);
      context.iframeBackground.querySelectorAll('[src], [href]').forEach(processElement);
    }
  }
};

// ── PROCESSOR 2: Tailwind CSS Autodetect & Inject ─────────────────────────────
const TailwindProcessor = {
  name: 'TailwindProcessor',
  async process(context) {
    let hasTailwind = false;

    // Check script tags for Tailwind CDN
    const scripts = context.ownerDocument.querySelectorAll('script');
    for (const script of scripts) {
      if (script.src && script.src.includes('tailwindcss')) {
        hasTailwind = true;
        break;
      }
    }

    // Check stylesheets for Tailwind-specific rules
    if (!hasTailwind) {
      try {
        Array.from(context.ownerDocument.styleSheets).forEach(sheet => {
          try {
            Array.from(sheet.cssRules || []).forEach(rule => {
              if (rule.cssText && rule.cssText.includes('--tw-')) {
                hasTailwind = true;
              }
            });
          } catch {}
        });
      } catch {}
    }

    if (hasTailwind) {
      context.extraScripts.push('https://cdn.tailwindcss.com');
    }
  }
};

// ── PROCESSOR 3: Unicorn Studio Animations Bundle ─────────────────────────────
const UnicornProcessor = {
  name: 'UnicornProcessor',
  async process(context) {
    const queryEl = (el) => {
      if (!el) return [];
      const res = [];
      if (el.hasAttribute && el.hasAttribute('data-us-project')) res.push(el);
      return res.concat(Array.from(el.querySelectorAll('[data-us-project]')));
    };

    const elements = queryEl(context.clonedElement);
    if (context.iframeBackground) {
      elements.push(...queryEl(context.iframeBackground));
    }

    if (elements.length === 0) return;

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

          el.removeAttribute('data-us-project');
          el.setAttribute('data-us-project-src', scriptId);
          el.removeAttribute('data-us-initialized');
          el.removeAttribute('data-scene-id');
          el.querySelectorAll('canvas').forEach(canvas => canvas.remove());

          const script = context.ownerDocument.createElement('script');
          script.type = 'application/json';
          script.id = scriptId;
          script.textContent = JSON.stringify(sceneData);

          el.parentNode.insertBefore(script, el.nextSibling);
        }
      } catch (err) {
        console.warn(`[SUID] UnicornProcessor failed for project ${projectId}:`, err);
      }
    }

    if (hasUnicornStudio) {
      context.extraScripts.push('https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js');
      context.extraStyles.push(`
        /* Bootstrap Unicorn Studio offline initialization */
        document.addEventListener('DOMContentLoaded', function () {
          if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
            UnicornStudio.init();
            window.UnicornStudio.isInitialized = true;
          }
        });
      `);
    }
  }
};

// ── PROCESSOR 4: Spline 3D & Hidden Background Iframe Recovery ───────────────
const SplineProcessor = {
  name: 'SplineProcessor',
  async process(context) {
    const element = context.originalElement;
    const elWindow = context.ownerWindow;

    // Use findLogicalComponent here to bound the climbing brake for Spline backgrounds
    const wrapper = findLogicalComponent(element);
    if (!wrapper || wrapper === element) return;

    let bgContainer = null;
    const iframes = wrapper.querySelectorAll('iframe');
    for (const iframe of iframes) {
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

    if (bgContainer) {
      const bgClone = bgContainer.cloneNode(true);
      context.iframeBackground = bgClone;
      context.originalIframeBackground = bgContainer;

      // Override negative z-index so background iframe becomes visible
      bgClone.style.setProperty('z-index', '0', 'important');

      // Promote foreground elements on top of the iframe background
      const clone = context.clonedElement;
      const computedPosition = elWindow.getComputedStyle(element).position;
      if (computedPosition === 'static') {
        clone.style.setProperty('position', 'relative', 'important');
        clone.style.setProperty('z-index', '1', 'important');
      } else {
        const computedZIndex = elWindow.getComputedStyle(element).zIndex;
        if (computedZIndex === 'auto' || parseInt(computedZIndex) <= 0) {
          clone.style.setProperty('z-index', '1', 'important');
        }
      }
    }
  }
};

// ── PROCESSOR 5: Absolute Positioning Styles & Dimensional Flattening ─────────
const StyleFlatteningProcessor = {
  name: 'StyleFlatteningProcessor',
  async process(context) {
    const elWindow = context.ownerWindow;

    const inlineStylesForTree = (origEl, cloneEl) => {
      const originals = [origEl, ...origEl.querySelectorAll('*')];
      const clones    = [cloneEl,   ...cloneEl.querySelectorAll('*')];

      originals.forEach((orig, i) => {
        const cl = clones[i];
        if (!cl || orig.nodeType !== Node.ELEMENT_NODE) return;

        const computed = elWindow.getComputedStyle(orig);
        const position = computed.getPropertyValue('position');

        let inlineStyle = '';

        STYLE_PROPS.forEach(prop => {
          const val = computed.getPropertyValue(prop);
          if (val && !SKIP_VALUES.has(val.trim())) {
            inlineStyle += `${prop}:${val};`;
          }
        });

        // Inline CSS custom properties
        for (let j = 0; j < computed.length; j++) {
          const p = computed[j];
          if (p.startsWith('--')) {
            const v = computed.getPropertyValue(p).trim();
            if (v) inlineStyle += `${p}:${v};`;
          }
        }

        cl.setAttribute('style', inlineStyle);

        // Tech Lead Check: Read live layout from originalElement, apply to clonedElement
        if (position === 'absolute' || position === 'fixed') {
          const rect = orig.getBoundingClientRect();
          cl.style.setProperty('position', position, 'important');
          cl.style.setProperty('width', `${rect.width}px`, 'important');
          cl.style.setProperty('height', `${rect.height}px`, 'important');

          ['top', 'left', 'right', 'bottom'].forEach(prop => {
            const val = computed.getPropertyValue(prop);
            if (val && val !== 'auto') {
              cl.style.setProperty(prop, val, 'important');
            }
          });
        }

        // Pseudo-elements handling
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
          context.pseudoCSS += `[data-suid="${uid}"]${pseudo}{${rules}}\n`;
        });
      });
    };

    const rootOrig = context.originalElement;
    const rootClone = context.clonedElement;
    const rootComputed = elWindow.getComputedStyle(rootOrig);
    const rootRect = rootOrig.getBoundingClientRect();

    // 1. Flatten all child elements inside the tree first
    inlineStylesForTree(rootOrig, rootClone);

    // 2. Freeze the outer Layout structure of the main Root Container
    rootClone.style.setProperty('width', `${rootRect.width}px`, 'important');
    rootClone.style.setProperty('max-width', '100%', 'important');
    rootClone.style.setProperty('box-sizing', 'border-box', 'important');

    const ml = rootComputed.getPropertyValue('margin-left');
    const mr = rootComputed.getPropertyValue('margin-right');
    if (ml && mr) {
      rootClone.style.setProperty('margin-left', ml, 'important');
      rootClone.style.setProperty('margin-right', mr, 'important');
    }

    const display = rootComputed.getPropertyValue('display');
    if (display) {
      rootClone.style.setProperty('display', display, 'important');
    }

    // Flatten style of background element if present
    if (context.iframeBackground && context.originalIframeBackground) {
      inlineStylesForTree(context.originalIframeBackground, context.iframeBackground);
    }
  }
};

// ── MODE A: Full-document capture (iframes / sandboxes) ──────────────────────
function extractFullDocument(element) {
  const doc = element.ownerDocument;
  return {
    html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML,
    css: '',
    mode: 'full-document',
  };
}

// ── MODE B: Pipeline-based standalone element extraction ─────────────────────
async function extractStandaloneElement(element) {
  const elWindow = element.ownerDocument.defaultView || window;
  const clone = element.cloneNode(true);

  // Initialize modular processing context
  const context = {
    originalElement: element,
    clonedElement: clone,
    ownerDocument: element.ownerDocument,
    ownerWindow: elWindow,
    iframeBackground: null,
    originalIframeBackground: null,
    pseudoCSS: '',
    extraStyles: [],
    extraScripts: []
  };

  // Run processor pipeline sequentially
  const pipeline = [
    SplineProcessor,
    RelativePathProcessor,
    TailwindProcessor,
    UnicornProcessor,
    StyleFlatteningProcessor
  ];

  for (const processor of pipeline) {
    try {
      await processor.process(context);
    } catch (err) {
      console.error(`[SUID] Error in processor ${processor.name}:`, err);
    }
  }

  // ── Harvest custom @font-face rules ─────────────────────────────────────────
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

  // ── Extract global variables from document root & body to prevent shock ───
  const htmlComputed = elWindow.getComputedStyle(element.ownerDocument.documentElement);
  const bodyComputed = elWindow.getComputedStyle(element.ownerDocument.body || element.ownerDocument.documentElement);
  let globalVars = '';

  [htmlComputed, bodyComputed].forEach(computed => {
    for (let i = 0; i < computed.length; i++) {
      const prop = computed[i];
      if (prop.startsWith('--')) {
        const val = computed.getPropertyValue(prop).trim();
        if (val) {
          globalVars += `  ${prop}: ${val};\n`;
        }
      }
    }
  });

  const rootVarsCSS = globalVars ? `:root {\n${globalVars}}\n` : '';

  // Extract body/html original attributes
  const htmlClasses = element.ownerDocument.documentElement.className || '';
  const bodyClasses = (element.ownerDocument.body && element.ownerDocument.body.className) || '';
  const htmlStyle = element.ownerDocument.documentElement.getAttribute('style') || '';
  const bodyStyle = (element.ownerDocument.body && element.ownerDocument.body.getAttribute('style')) || '';

  const bodyPadding = context.iframeBackground ? '0' : '16px';
  const styleBlock = [
    '*, *::before, *::after { box-sizing: border-box; }',
    `body { margin: 0; padding: ${bodyPadding}; }`,
    rootVarsCSS,
    fontCSS             ? `/* ── Web Fonts ── */\n${fontCSS}` : '',
    context.pseudoCSS   ? `/* ── Pseudo-elements ── */\n${context.pseudoCSS}` : '',
    ...context.extraStyles
  ].filter(Boolean).join('\n');

  // Embed extra scripts
  const scriptTags = context.extraScripts
    .map(src => `<script src="${src}"></script>`)
    .join('\n  ');

  // If we have background recovery, bundle background clone and main clone in relative wrapper
  let bodyContent = clone.outerHTML;
  if (context.iframeBackground) {
    bodyContent = `
  <div style="position: relative; width: 100%; min-height: 100vh;">
    ${context.iframeBackground.outerHTML}
    ${clone.outerHTML}
  </div>`;
  }

  const fullHtml =
`<!DOCTYPE html>
<html class="${htmlClasses}" style="${htmlStyle}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extracted Component</title>
  <style>
${styleBlock.split('\n').map(l => '    ' + l).join('\n')}
  </style>
  ${scriptTags}
</head>
<body class="${bodyClasses}" style="${bodyStyle}">
  ${bodyContent}
</body>
</html>`;

  return { html: fullHtml, css: '', mode: 'standalone' };
}

// ── Offline Unicorn Studio Scene Processor (For Mode A / Iframes) ──────────────
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

        el.removeAttribute('data-us-project');
        el.setAttribute('data-us-project-src', scriptId);
        el.removeAttribute('data-us-initialized');
        el.removeAttribute('data-scene-id');
        el.querySelectorAll('canvas').forEach(canvas => canvas.remove());

        const script = doc.createElement('script');
        script.type = 'application/json';
        script.id = scriptId;
        script.textContent = JSON.stringify(sceneData);

        el.parentNode.insertBefore(script, el.nextSibling);
      }
    } catch (err) {
      console.warn(`[SUID] Failed to process UnicornStudio project ${projectId}:`, err);
    }
  }

  if (hasUnicornStudio) {
    const head = doc.head;
    if (head) {
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

// ── Master extractor — decides Mode A vs Mode B ──────────────────────────────
async function extractElementData(element) {
  // Use the exact element clicked by the user to ensure precise isolation & avoid overfetching siblings
  const targetElement = element;

  const ownerDoc  = targetElement.ownerDocument;
  const ownerWin  = ownerDoc.defaultView;

  const isInsideFrame =
    ownerWin &&
    ownerWin.self !== ownerWin.top;

  let rawResult;
  let isStandaloneMode = false;

  if (isInsideFrame) {
    rawResult = extractFullDocument(targetElement);
  } else {
    rawResult = await extractStandaloneElement(targetElement);
    isStandaloneMode = true;
  }

  // Fallback scenes conversion for Mode A
  if (isInsideFrame) {
    try {
      const processedHtml = await processUnicornStudioScenes(rawResult.html, isStandaloneMode);
      rawResult.html = processedHtml;
    } catch (err) {
      console.error('[SUID] Error processing Unicorn Studio scenes:', err);
    }
  }

  return rawResult;
}

window.extractElementData = extractElementData;

} // End of initialization guard
