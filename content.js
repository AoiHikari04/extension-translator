// content.js - Displays transcription in draggable overlay

(function() {
  if (document.getElementById('transcriber-overlay')) return;

  let overlay = null;
  let textContainer = null;
  let transcriptLines = [];
  const MAX_LINES = 3;
  const CLEAR_DELAY = 10000; // 10 seconds before text clears

  // Create the overlay
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'transcriber-overlay';
    
    overlay.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      min-width: 300px;
      max-width: 500px;
      background: linear-gradient(135deg, rgba(32, 33, 36, 0.95), rgba(45, 45, 48, 0.95));
      color: white;
      padding: 16px 20px;
      font-size: 16px;
      border-radius: 16px;
      z-index: 2147483647;
      cursor: move;
      user-select: none;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      display: none;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-size: 12px;
      color: rgba(255,255,255,0.6);
    `;
    header.innerHTML = `
      <span id="recording-dot" style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; animation: pulse 2s infinite;"></span>
      <span>Live Transcription</span>
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .transcript-line {
        animation: fadeIn 0.3s ease;
        transition: opacity 0.5s ease;
        line-height: 1.5;
        margin: 4px 0;
      }
      .transcript-line.fading {
        opacity: 0.3;
      }
    `;
    document.head.appendChild(style);

    // Text container
    textContainer = document.createElement('div');
    textContainer.style.cssText = `
      min-height: 24px;
      max-height: 120px;
      overflow: hidden;
    `;
    textContainer.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-style: italic;">Waiting for audio...</div>';

    overlay.appendChild(header);
    overlay.appendChild(textContainer);
    document.body.appendChild(overlay);

    setupDragging();
  }

  // Dragging logic
  function setupDragging() {
    let isDragging = false;
    let offsetX, offsetY;

    overlay.addEventListener('mousedown', (e) => {
      isDragging = true;
      overlay.style.transform = 'none';
      offsetX = e.clientX - overlay.getBoundingClientRect().left;
      offsetY = e.clientY - overlay.getBoundingClientRect().top;
      overlay.style.opacity = '0.9';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      overlay.style.left = `${e.clientX - offsetX}px`;
      overlay.style.top = `${e.clientY - offsetY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        overlay.style.opacity = '1';
      }
    });
  }

  // Show overlay
  function showOverlay() {
    if (!overlay) createOverlay();
    overlay.style.display = 'block';
  }

  // Hide overlay
  function hideOverlay() {
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  // Add transcription text
  function addTranscription(text) {
    if (!text || !text.trim()) return;
    if (!overlay) createOverlay();
    
    showOverlay();

    // Create new line element
    const lineEl = document.createElement('div');
    lineEl.className = 'transcript-line';
    lineEl.textContent = text.trim();

    // Add to array and DOM
    transcriptLines.push({
      element: lineEl,
      timestamp: Date.now()
    });

    // Clear placeholder if exists
    if (textContainer.querySelector('[style*="italic"]')) {
      textContainer.innerHTML = '';
    }

    textContainer.appendChild(lineEl);

    // Remove old lines if exceeding max
    while (transcriptLines.length > MAX_LINES) {
      const removed = transcriptLines.shift();
      removed.element.remove();
    }

    // Schedule fade out
    setTimeout(() => {
      lineEl.classList.add('fading');
    }, CLEAR_DELAY - 2000);

    // Schedule removal
    setTimeout(() => {
      const index = transcriptLines.findIndex(l => l.element === lineEl);
      if (index > -1) {
        transcriptLines.splice(index, 1);
        lineEl.remove();
      }

      // Show placeholder if empty
      if (transcriptLines.length === 0 && textContainer) {
        textContainer.innerHTML = '<div style="color: rgba(255,255,255,0.4); font-style: italic;">Waiting for audio...</div>';
      }
    }, CLEAR_DELAY);
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Respond to ping to confirm content script is loaded
    if (message.action === 'ping') {
      sendResponse({ status: 'ok' });
      return true;
    }

    if (message.action === 'showTranscription') {
      addTranscription(message.text);
    }

    if (message.action === 'toggleOverlay') {
      if (message.enabled) {
        showOverlay();
      } else {
        hideOverlay();
      }
    }

    if (message.action === 'startTranscription') {
      showOverlay();
    }

    if (message.action === 'stopTranscription') {
      hideOverlay();
    }
  });

  console.log('[Content] Transcriber overlay script loaded');
})();