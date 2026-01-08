// background.js - Service Worker
console.log('[Background] ====== SERVICE WORKER STARTING ======');

let offscreenDocumentExists = false;
let activeTabId = null;

// Register message listener FIRST before anything else
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message);

  if (message.action === 'startCapture') {
    console.log('[Background] Handling startCapture...');
    handleStartCapture(sendResponse);
    return true; // Keep channel open for async response
  }

  if (message.action === 'stopCapture') {
    console.log('[Background] Handling stopCapture...');
    handleStopCapture(sendResponse);
    return true;
  }

  // Forward transcription to content script
  if (message.action === 'transcriptionResult' && activeTabId) {
    chrome.tabs.sendMessage(activeTabId, {
      action: 'showTranscription',
      text: message.text
    }).catch(() => {
      console.log('[Background] Content script not available');
    });
  }

  // Forward status to popup
  if (message.action === 'statusUpdate') {
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might be closed
    });
  }
});

console.log('[Background] Message listener registered');

async function setupOffscreenDocument() {
  console.log('[Background] setupOffscreenDocument called, exists:', offscreenDocumentExists);
  
  if (offscreenDocumentExists) {
    console.log('[Background] Offscreen already exists, skipping creation');
    return;
  }

  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    console.log('[Background] Existing offscreen contexts:', existingContexts.length);

    if (existingContexts.length > 0) {
      offscreenDocumentExists = true;
      console.log('[Background] Using existing offscreen document');
      return;
    }

    console.log('[Background] Creating new offscreen document...');
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Recording tab audio for transcription'
    });

    offscreenDocumentExists = true;
    console.log('[Background] Offscreen document created successfully');
  } catch (error) {
    console.error('[Background] Error creating offscreen document:', error);
    throw error;
  }
}

// Inject content script if not already present
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    console.log('[Background] Content script already present');
    return true;
  } catch (error) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      console.log('[Background] Content script injected');
      await new Promise(resolve => setTimeout(resolve, 100));
      return true;
    } catch (injectError) {
      console.error('[Background] Cannot inject content script:', injectError);
      return false;
    }
  }
}

async function handleStartCapture(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    console.log('[Background] Active tab:', tab);
    if (!tab) {
      sendResponse({ success: false, error: 'No active tab found' });
      return;
    }

    // Check if we can use this tab (not chrome:// or extension pages)
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      sendResponse({ success: false, error: 'Cannot capture audio from this page' });
      return;
    }

    activeTabId = tab.id;

    // Ensure content script is injected
    const contentReady = await ensureContentScript(tab.id);
    if (!contentReady) {
      sendResponse({ success: false, error: 'Cannot inject content script on this page' });
      return;
    }

    // Get media stream ID for the tab
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });

    console.log('[Background] Got stream ID:', streamId);

    // DEBUG: Log to make sure we get here
    console.log('[Background] ===== ABOUT TO SETUP OFFSCREEN =====');

    // Setup offscreen document and wait for it
    console.log('[Background] Setting up offscreen document...');
    try {
      await setupOffscreenDocument();
      console.log('[Background] Offscreen document ready');
    } catch (offscreenError) {
      console.error('[Background] Offscreen setup failed:', offscreenError);
      sendResponse({ success: false, error: 'Offscreen setup failed: ' + offscreenError.message });
      return;
    }

    // Tell content script to show overlay
    chrome.tabs.sendMessage(tab.id, { action: 'startTranscription' }).catch(() => {});

    // Give offscreen document time to initialize, then send message
    console.log('[Background] Waiting 1.5s for offscreen to initialize...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // First, test if offscreen is responsive with a ping
    console.log('[Background] Testing offscreen responsiveness...');
    try {
      const pingResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
        // Timeout after 2 seconds
        setTimeout(() => reject(new Error('Ping timeout')), 2000);
      });
      console.log('[Background] Offscreen ping response:', pingResponse);
    } catch (pingError) {
      console.error('[Background] Offscreen ping failed:', pingError);
      sendResponse({ success: false, error: 'Offscreen not responsive: ' + pingError.message });
      return;
    }
    
    console.log('[Background] ===== SENDING startRecording MESSAGE =====');
    
    // Send message and log the result
    try {
      const startResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'startRecording',
          streamId: streamId,
          tabId: tab.id
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error('startRecording timeout')), 5000);
      });
      
      console.log('[Background] startRecording response:', startResponse);
    } catch (msgError) {
      console.error('[Background] Error sending startRecording:', msgError);
      sendResponse({ success: false, error: 'Failed to start recording: ' + msgError.message });
      return;
    }

    chrome.storage.local.set({ isRecording: true });
    console.log('[Background] ===== SENDING SUCCESS RESPONSE =====');
    sendResponse({ success: true });

  } catch (error) {
    console.error('[Background] Error starting capture:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleStopCapture(sendResponse) {
  try {
    // Tell offscreen to stop recording
    chrome.runtime.sendMessage({ action: 'stopRecording' }).catch(() => {});

    // Tell content script to hide overlay
    if (activeTabId) {
      chrome.tabs.sendMessage(activeTabId, { action: 'stopTranscription' }).catch(() => {});
    }

    chrome.storage.local.set({ isRecording: false });
    activeTabId = null;
    sendResponse({ success: true });

  } catch (error) {
    console.error('[Background] Error stopping capture:', error);
    sendResponse({ success: false, error: error.message });
  }
}


console.log('[Background] Service worker loaded');
