// offscreen.js - Simple test version
console.log('[Offscreen] Document loaded');

// Update status div if it exists
if (document.getElementById('status')) {
  document.getElementById('status').textContent = 'Script loaded';
}

// Basic message listener for testing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] ====== MESSAGE RECEIVED ======');
  console.log('[Offscreen] Message:', message);
  
  if (message.action === 'ping') {
    console.log('[Offscreen] Responding to ping');
    sendResponse({ status: 'offscreen ready' });
    return true;
  }
  
  if (message.action === 'startRecording') {
    console.log('[Offscreen] Got startRecording request with streamId:', message.streamId);
    
    if (document.getElementById('status')) {
      document.getElementById('status').textContent = 'Recording started (mock)';
    }
    
    sendResponse({ received: true, status: 'recording started (mock)' });
    
    // Mock transcription for testing
    setTimeout(() => {
      console.log('[Offscreen] Sending mock transcription');
      chrome.runtime.sendMessage({
        action: 'transcriptionResult',
        text: 'Hello, this is a test transcription!'
      });
    }, 2000);
    
    // Send another one after 5 seconds
    setTimeout(() => {
      console.log('[Offscreen] Sending second mock transcription');
      chrome.runtime.sendMessage({
        action: 'transcriptionResult',
        text: 'This is a second test message.'
      });
    }, 5000);
    
    return true;
  }
  
  if (message.action === 'stopRecording') {
    console.log('[Offscreen] Got stopRecording request');
    if (document.getElementById('status')) {
      document.getElementById('status').textContent = 'Recording stopped';
    }
    sendResponse({ received: true });
    return true;
  }
  
  return true;
});

console.log('[Offscreen] ====== MESSAGE LISTENER REGISTERED ======');

// Update status to show ready
if (document.getElementById('status')) {
  document.getElementById('status').textContent = 'Ready for messages';
}

console.log('[Offscreen] ====== OFFSCREEN SCRIPT READY ======');
