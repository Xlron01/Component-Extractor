if (typeof window.suidInspectorInitialized === 'undefined') {
window.suidInspectorInitialized = true;

let isInspectorActive = false;
let hoveredElement = null;

// ── Central deactivation — the ONLY place that kills the inspector ────────────
function deactivateInspector() {
  isInspectorActive = false;
  document.removeEventListener('mouseover', handleMouseOver, true);
  document.removeEventListener('mouseout',  handleMouseOut,  true);
  document.removeEventListener('click',     handleClick,     true);
  document.body.style.removeProperty('cursor');
  clearHover();
}

// ── Listen for MAIN-world CustomEvent broadcast (fired by background.js) ──────
document.addEventListener('__suid_deactivate__', deactivateInspector);

// ── Listen for messages from background / popup ───────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleInspector') {
    if (request.isActive) {
      document.removeEventListener('mouseover', handleMouseOver, true);
      document.removeEventListener('mouseout',  handleMouseOut,  true);
      document.removeEventListener('click',     handleClick,     true);

      isInspectorActive = true;
      document.addEventListener('mouseover', handleMouseOver, true);
      document.addEventListener('mouseout',  handleMouseOut,  true);
      document.addEventListener('click',     handleClick,     true);
      document.body.style.cursor = 'crosshair';
    } else {
      deactivateInspector();
    }
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'stopInspector') {
    deactivateInspector();
    sendResponse({ success: true });
    return true;
  }
});

// ── Precise Element targeting — ignores transparent overlay shells & extensions ──
function getTargetElement(e) {
  const elements = document.elementsFromPoint(e.clientX, e.clientY);
  for (const el of elements) {
    if (el === document.body || el === document.documentElement) return el;
    
    // Ignore Chrome extension elements or inspector overlays
    if (el.id === '__suid_toast__' || el.tagName.toLowerCase().startsWith('plasmo-')) {
      continue;
    }

    const style = (el.ownerDocument.defaultView || window).getComputedStyle(el);
    const isShield =
      style.backgroundColor === 'rgba(0, 0, 0, 0)' &&
      style.backgroundImage === 'none' &&
      el.textContent.trim() === '' &&
      el.children.length === 0;
    
    if (isShield) continue;
    return el;
  }
  return e.target;
}

// ── Hover handlers ────────────────────────────────────────────────────────────
function handleMouseOver(e) {
  if (!isInspectorActive) return;
  e.stopPropagation();
  const target = getTargetElement(e);
  if (hoveredElement === target) return;
  clearHover();
  hoveredElement = target;
  hoveredElement.classList.add('smart-ui-inspector-hover');
}

// ── Hover cleanup ─────────────────────────────────────────────────────────────
function handleMouseOut(e) {
  if (!isInspectorActive) return;
  clearHover();
}

function clearHover() {
  if (hoveredElement) {
    hoveredElement.classList.remove('smart-ui-inspector-hover');
    hoveredElement = null;
  }
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message = '✅ UI Extracted! Open extension to view.') {
  const existing = document.getElementById('__suid_toast__');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = '__suid_toast__';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px;
    background: #1d4ed8; color: #fff;
    padding: 12px 20px; border-radius: 10px;
    z-index: 2147483647; font-family: system-ui, sans-serif;
    font-size: 14px; font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    pointer-events: none; opacity: 1;
    transition: opacity 0.4s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ── Finish extraction: save + notify popup + STOP ALL FRAMES ──────────────────
function finishExtraction(data) {
  chrome.storage.local.set({ extractedData: data }, () => {
    showToast();
    chrome.runtime.sendMessage({ action: 'elementExtracted', data }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'stopAllInspectors' }).catch(() => {});
  });
}

// ── Click handler — quarantines clicked element and isolates it ───────────────
function handleClick(e) {
  if (!isInspectorActive) return;
  e.stopPropagation();
  e.preventDefault();

  const target = getTargetElement(e);
  clearHover();
  deactivateInspector();

  const tag = target.tagName.toLowerCase();

  // ── Case 1: srcdoc iframe (e.g. aura.build, ui.aceternity.com) ─────────────
  if (tag === 'iframe' && target.hasAttribute('srcdoc')) {
    const srcdoc = target.getAttribute('srcdoc');
    const tmpFrame = document.createElement('iframe');
    tmpFrame.style.cssText =
      'position:fixed;width:1280px;height:800px;opacity:0;pointer-events:none;z-index:-9999;top:0;left:0;';
    tmpFrame.srcdoc = srcdoc;
    document.body.appendChild(tmpFrame);

    tmpFrame.addEventListener('load', () => {
      setTimeout(() => {
        const inner = tmpFrame.contentDocument.body;
        const firstReal =
          inner.children.length === 1 && inner.firstElementChild.tagName !== 'SCRIPT'
            ? inner.firstElementChild
            : inner;
        extractElementData(firstReal).then(data => {
          tmpFrame.remove();
          finishExtraction(data);
        }).catch(err => {
          console.error('[SUID] Extraction failed:', err);
          tmpFrame.remove();
        });
      }, 600);
    });
    return;
  }

  // ── Case 2: same-origin live iframe ─────────────────────────────────────────
  if (tag === 'iframe') {
    try {
      const inner = target.contentDocument && target.contentDocument.body;
      if (inner) {
        extractElementData(inner.firstElementChild || inner)
          .then(finishExtraction)
          .catch(err => console.error('[SUID] Extraction failed:', err));
        return;
      }
    } catch {
      console.warn('[SUID] Cross-origin iframe — cannot access.');
    }
  }

  // ── Case 3: normal element on any website (isolates the exact element clicked) ──
  extractElementData(target)
    .then(finishExtraction)
    .catch(err => console.error('[SUID] Extraction failed:', err));
}

} // End of initialization guard
