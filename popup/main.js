document.addEventListener('DOMContentLoaded', () => {
  const inspectBtn  = document.getElementById('inspectBtn');
  const resultContainer = document.getElementById('resultContainer');
  const htmlCode    = document.getElementById('htmlCode');
  const copyBtn     = document.getElementById('copyBtn');
  const downloadBtn = document.getElementById('downloadBtn');

  let isInspecting = false;
  let currentHtml  = '';

  // ── Helper: display raw HTML text in the code panel ──────────────────────
  function displayResult(data) {
    currentHtml = data.html || '';
    htmlCode.textContent = currentHtml;
    resultContainer.style.display = 'block';
  }

  // ── Load previously extracted data on popup open ──────────────────────────
  chrome.storage.local.get('extractedData', (result) => {
    if (result.extractedData) {
      displayResult(result.extractedData);
    }
  });

  // ── Copy Full HTML ────────────────────────────────────────────────────────
  copyBtn.addEventListener('click', () => {
    if (!currentHtml) return;
    navigator.clipboard.writeText(currentHtml).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy HTML', 2000);
    });
  });

  // ── Download as .html file ────────────────────────────────────────────────
  downloadBtn.addEventListener('click', () => {
    if (!currentHtml) return;
    const blob = new Blob([currentHtml], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'component.html';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ── Download Full Page HTML ───────────────────────────────────────────────
  const downloadPageBtn = document.getElementById('downloadPageBtn');
  downloadPageBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
        }
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          alert('Cannot download this page. Try refreshing the tab.');
          return;
        }

        const pageHtml = results[0].result;
        const blob = new Blob([pageHtml], { type: 'text/html' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        
        // Clean up file name from special characters
        const safeName = (tab.title || 'page').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${safeName}.html`;
        a.click();
        URL.revokeObjectURL(url);
      });
    } catch (err) {
      console.error('Failed to download full page:', err);
      alert('Failed to download page HTML.');
    }
  });

  // ── Inspect Button toggle ─────────────────────────────────────────────────
  inspectBtn.addEventListener('click', async () => {
    isInspecting = !isInspecting;

    if (isInspecting) {
      inspectBtn.textContent = 'Stop Inspecting';
      inspectBtn.classList.replace('primary', 'danger');
    } else {
      inspectBtn.textContent = 'Inspect Element';
      inspectBtn.classList.replace('danger', 'primary');
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.runtime.sendMessage(
      { action: 'injectAndToggle', tabId: tab.id, isActive: isInspecting },
      (response) => {
        if (chrome.runtime.lastError) {
          alert('Cannot inspect this page. Try refreshing the tab.');
          isInspecting = false;
          inspectBtn.textContent = 'Inspect Element';
          inspectBtn.classList.replace('danger', 'primary');
        }
      }
    );
  });

  // ── Listen for live extraction from content script ────────────────────────
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'elementExtracted') {
      // Reset button state (popup stays open for srcdoc/async cases)
      isInspecting = false;
      inspectBtn.textContent = 'Inspect Element';
      inspectBtn.classList.replace('danger', 'primary');

      displayResult(request.data);
    }
  });
});
