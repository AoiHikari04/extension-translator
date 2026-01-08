// Wait for DOM to be ready
(function() {
  let overlay = null;

  // Create the overlay element
  function createOverlay() {
    if (document.getElementById('hello-world-overlay')) {
      return document.getElementById('hello-world-overlay');
    }

    const el = document.createElement('div');
    el.id = 'hello-world-overlay';
    el.innerText = "Hello World (Drag Me)";

    el.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #202124;
      color: white;
      padding: 15px 25px;
      font-size: 18px;
      border-radius: 12px;
      z-index: 2147483647;
      cursor: move;
      user-select: none;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      font-family: sans-serif;
    `;

    return el;
  }

  // Append overlay to body
  function appendOverlay() {
    if (document.body && overlay) {
      document.body.appendChild(overlay);
      setupDragging();
    } else if (!document.body) {
      setTimeout(appendOverlay, 10);
    }
  }

  // Show overlay
  function showOverlay() {
    if (!overlay) {
      overlay = createOverlay();
    }
    appendOverlay();
  }

  // Hide overlay
  function hideOverlay() {
    const el = document.getElementById('hello-world-overlay');
    if (el) {
      el.remove();
    }
  }

  // Dragging Logic
  function setupDragging() {
    if (!overlay) return;

    let isDragging = false;
    let offsetX, offsetY;

    overlay.addEventListener('mousedown', (e) => {
      isDragging = true;
      overlay.style.transform = 'none';
      offsetX = e.clientX - overlay.getBoundingClientRect().left;
      offsetY = e.clientY - overlay.getBoundingClientRect().top;
      overlay.style.opacity = "0.8";
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      overlay.style.left = `${x}px`;
      overlay.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        overlay.style.opacity = "1";
      }
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleOverlay') {
      if (message.enabled) {
        showOverlay();
      } else {
        hideOverlay();
      }
    }
  });

  // Check initial state from storage
  chrome.storage.local.get(['overlayEnabled'], (result) => {
    const isEnabled = result.overlayEnabled !== false; // Default to true
    if (isEnabled) {
      overlay = createOverlay();
      appendOverlay();
    }
  });
})();