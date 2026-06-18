chrome.runtime.onInstalled.addListener(() => {
  console.log('[SUID] Smart UI Decompiler installed.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // ── Toggle inspector: inject scripts & CSS into all frames, then activate ───
  if (request.action === 'injectAndToggle') {
    const tabId = request.tabId;

    chrome.scripting.insertCSS({
      target: { tabId, allFrames: true },
      files: ['content/inspector.css'],
    }).catch(err => console.log('[SUID] CSS inject (may already exist):', err));

    chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content/extractor.js', 'content/inspector.js'],
    }).then(() => {
      // Send toggle only to the MAIN frame — iframes are passive (Mode A handled
      // by the main frame's srcdoc bypass, never need their own active inspector)
      chrome.tabs.sendMessage(tabId, {
        action: 'toggleInspector',
        isActive: request.isActive,
      });
    }).catch(err => console.error('[SUID] JS inject error:', err));

    sendResponse({ success: true });
    return true;
  }

  // ── Broadcast stop to ALL frames via a MAIN-world CustomEvent ───────────────
  // CustomEvents dispatched from MAIN world are visible to ISOLATED world
  // content scripts — this is the only reliable cross-frame stop mechanism in MV3
  if (request.action === 'stopAllInspectors') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) { sendResponse({ success: false }); return true; }

    chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',                       // runs in page's JS world
      func: () => {
        // This CustomEvent crosses the MAIN↔ISOLATED boundary and triggers
        // the `document.addEventListener('__suid_deactivate__', ...)` in inspector.js
        document.dispatchEvent(new CustomEvent('__suid_deactivate__'));
      },
    }).catch(err => console.warn('[SUID] Stop broadcast error:', err));

    sendResponse({ success: true });
    return true;
  }

  // ── Fetch Unicorn Studio Scene JSON ─────────────────────────────────────────
  if (request.action === 'fetchUnicornScene') {
    const projectId = request.projectId;
    fetchUnicornSceneData(projectId)
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // asynchronous response
  }
});

// Helper to fetch project data from official Unicorn Studio hosts
async function fetchUnicornSceneData(projectId) {
  try {
    const response = await fetch(`https://assets.unicorn.studio/embeds/${projectId}`);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn(`[SUID] assets.unicorn.studio fetch failed:`, err);
  }

  // Fallback to storage.googleapis.com
  const response = await fetch(`https://storage.googleapis.com/unicornstudio-production/embeds/${projectId}`);
  if (response.ok) {
    return await response.json();
  }
  throw new Error(`Failed to fetch scene data for project: ${projectId}`);
}

