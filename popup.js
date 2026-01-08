const toggle = document.getElementById('toggleOverlay');
const statusText = document.getElementById('statusText');

// Load saved state when popup opens
chrome.storage.local.get(['overlayEnabled'], (result) => {
  const isEnabled = result.overlayEnabled !== false; // Default to true
  toggle.checked = isEnabled;
  updateStatus(isEnabled);
});

// Handle toggle change
toggle.addEventListener('change', () => {
  const isEnabled = toggle.checked;
  
  // Save state
  chrome.storage.local.set({ overlayEnabled: isEnabled });
  
  // Update status text
  updateStatus(isEnabled);
  
  // Send message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'toggleOverlay', 
        enabled: isEnabled 
      });
    }
  });
});

function updateStatus(isEnabled) {
  statusText.textContent = isEnabled ? 'Overlay is ON' : 'Overlay is OFF';
  statusText.classList.toggle('active', isEnabled);
}