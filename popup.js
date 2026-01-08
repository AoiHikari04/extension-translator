const toggle = document.getElementById('toggleTranscription');
const statusEl = document.getElementById('status');
console.log('[Popup] Script loaded');

// Load saved state when popup opens
chrome.storage.local.get(['isRecording'], (result) => {
  console.log('[Popup] Loaded state:', result);
  toggle.checked = result.isRecording || false;
  updateStatus(result.isRecording || false);
});

// Handle toggle change
toggle.addEventListener('change', async () => {
  const isEnabled = toggle.checked;
  toggle.disabled = true;
  console.log('[Popup] Toggle changed:', isEnabled);
  
  if (isEnabled) {
    statusEl.textContent = 'Starting...';
    statusEl.className = 'status';
    console.log('[Popup] Sending startCapture message...');
    
    // Use callback style instead of await to ensure proper handling
    chrome.runtime.sendMessage({ action: 'startCapture' }, (response) => {
      console.log('[Popup] Got response:', response);
      
      if (chrome.runtime.lastError) {
        console.error('[Popup] Runtime error:', chrome.runtime.lastError);
        toggle.checked = false;
        statusEl.textContent = 'Error: ' + chrome.runtime.lastError.message;
        statusEl.className = 'status error';
        toggle.disabled = false;
        return;
      }
      
      if (response && response.success) {
        console.log('[Popup] Start successful');
        updateStatus(true);
      } else {
        console.log('[Popup] Start failed:', response?.error);
        toggle.checked = false;
        statusEl.textContent = response?.error || 'Failed to start';
        statusEl.className = 'status error';
      }
      toggle.disabled = false;
    });
  } else {
    statusEl.textContent = 'Stopping...';
    console.log('[Popup] Sending stopCapture message...');
    
    chrome.runtime.sendMessage({ action: 'stopCapture' }, (response) => {
      console.log('[Popup] Stop response:', response);
      if (chrome.runtime.lastError) {
        console.error('[Popup] Runtime error:', chrome.runtime.lastError);
      }
      updateStatus(false);
      toggle.disabled = false;
    });
  }
});

function updateStatus(isRecording) {
  if (isRecording) {
    statusEl.textContent = '🔴 Recording... Check the page for overlay';
    statusEl.className = 'status active';
  } else {
    statusEl.textContent = 'Click toggle to start';
    statusEl.className = 'status';
  }
}

// Listen for status updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'statusUpdate') {
    statusEl.textContent = message.status;
  }
});