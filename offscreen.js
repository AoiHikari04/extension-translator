// offscreen.js - Handles audio capture and transcription
console.log('[Offscreen] ====== OFFSCREEN SCRIPT LOADING ======');

// Load Transformers.js dynamically
async function loadTransformersJS() {
  console.log('[Offscreen] Loading Transformers.js module...');
  updateStatus('Loading Transformers.js library...');
  
  try {
    // Try dynamic import first
    const { pipeline } = await import('./assets/transformers.min.js');
    window.transformersPipeline = pipeline;
    window.Transformers = { pipeline };
    console.log('[Offscreen] Transformers.js loaded successfully via import');
    updateStatus('Transformers.js loaded successfully!');
    return true;
  } catch (error) {
    console.error('[Offscreen] Failed to load local Transformers.js via import:', error);
    
    // Fallback: Try loading as regular script
    try {
      console.log('[Offscreen] Trying fallback script loading...');
      const script = document.createElement('script');
      script.src = './assets/transformers.min.js';
      
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('[Offscreen] Transformers.js script loaded');
          updateStatus('Transformers.js script loaded');
          resolve(true);
        };
        script.onerror = (err) => {
          console.error('[Offscreen] Script loading failed:', err);
          reject(err);
        };
      });
      
      document.head.appendChild(script);
      await loadPromise;
      
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
      
    } catch (scriptError) {
      console.error('[Offscreen] Fallback script loading failed:', scriptError);
      updateStatus('❌ Error loading Transformers.js');
      return false;
    }
  }
}

// Wait for Transformers.js to load from script tag
function waitForTransformers() {
  return new Promise((resolve) => {
    console.log('[Offscreen] Waiting for Transformers.js to load...');
    updateStatus('Waiting for Transformers.js library...');
    
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds max wait
    
    const checkTransformers = () => {
      attempts++;
      console.log(`[Offscreen] Checking attempt ${attempts}/${maxAttempts}`);
      
      // Debug: Log all available globals
      if (attempts === 1) {
        console.log('[Offscreen] Available window properties:', Object.keys(window).filter(key => key.includes('transform') || key.includes('Transform') || key.includes('pipeline')));
        console.log('[Offscreen] Window.Transformers:', typeof window.Transformers);
        console.log('[Offscreen] Global pipeline:', typeof pipeline);
        console.log('[Offscreen] Window.pipeline:', typeof window.pipeline);
      }
      
      // Check multiple possible ways Transformers.js might be exposed
      if (window.Transformers && window.Transformers.pipeline) {
        console.log('[Offscreen] Found window.Transformers.pipeline!');
        window.transformersPipeline = window.Transformers.pipeline;
        updateStatus('Transformers.js loaded successfully!');
        resolve(true);
      } else if (typeof pipeline !== 'undefined') {
        console.log('[Offscreen] Found global pipeline function!');
        window.transformersPipeline = pipeline;
        updateStatus('Transformers.js loaded successfully!');
        resolve(true);
      } else if (window.pipeline) {
        console.log('[Offscreen] Found window.pipeline function!');
        window.transformersPipeline = window.pipeline;
        updateStatus('Transformers.js loaded successfully!');
        resolve(true);
      } else if (attempts >= maxAttempts) {
        console.error('[Offscreen] Timeout waiting for Transformers.js');
        updateStatus('❌ Transformers.js failed to load - using fallback');
        resolve(false);
      } else {
        console.log('[Offscreen] Still waiting for Transformers.js...');
        setTimeout(checkTransformers, 100);
      }
    };
    
    checkTransformers();
  });
}

// Variables for audio processing and AI model
let transcriber = null;
let mediaStream = null;
let audioContext = null;
let processor = null;
let isRecording = false;
let audioBuffer = [];

const SAMPLE_RATE = 16000;
const BUFFER_DURATION = 3;
const BUFFER_SIZE = SAMPLE_RATE * BUFFER_DURATION;

console.log('[Offscreen] Variables initialized');

// Update status display
function updateStatus(message) {
  console.log('[Offscreen] Status:', message);
  if (document.getElementById('status')) {
    document.getElementById('status').textContent = message;
  }
  // Send status to background
  chrome.runtime.sendMessage({
    action: 'statusUpdate',
    status: message
  }).catch(err => console.log('[Offscreen] Status message failed:', err.message));
}

// Initialize the Whisper model using local files
async function initializeModel() {
  console.log('[Offscreen] Initializing local Whisper model...');
  updateStatus('Loading local AI model...');
  
  try {
    // Load Transformers.js first if not already loaded
    if (!window.transformersPipeline) {
      console.log('[Offscreen] Transformers.js not ready, loading now...');
      const loaded = await loadTransformersJS();
      if (!loaded) {
        throw new Error('Failed to load Transformers.js library');
      }
      
      // Wait for it to be available
      await waitForTransformers();
    }
    
    if (!window.transformersPipeline) {
      throw new Error('Transformers.js pipeline not available');
    }

    console.log('[Offscreen] Creating Whisper pipeline with local model...');
    updateStatus('Loading local model files...');
    
    // Use the local model path - Chrome extension can access files in the extension directory
    const modelPath = './assets/model/whisper-tiny/';
    
    // Create the Whisper transcription pipeline with local model
    transcriber = await window.transformersPipeline(
      'automatic-speech-recognition',
      modelPath,
      {
        local_files_only: true, // Use only local files, don't download
        progress_callback: (progress) => {
          console.log('[Offscreen] Model loading progress:', progress);
          if (progress.status === 'loading') {
            updateStatus('Loading model from local files...');
          } else if (progress.status === 'ready') {
            updateStatus('Local model loaded successfully!');
          }
        }
      }
    );
    
    updateStatus('🤖 Local AI model ready! Toggle to start listening.');
    console.log('[Offscreen] Local Whisper model loaded successfully');
    return true;
  } catch (error) {
    console.error('[Offscreen] Error loading local model:', error);
    console.log('[Offscreen] Falling back to remote model...');
    
    // Fallback to remote model if local fails
    try {
      updateStatus('Local model failed, downloading remote model...');
      transcriber = await window.transformersPipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        {
          progress_callback: (progress) => {
            console.log('[Offscreen] Remote model progress:', progress);
            if (progress.status === 'downloading') {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              updateStatus(`Downloading model: ${percent}%`);
            } else if (progress.status === 'loading') {
              updateStatus('Loading model into memory...');
            }
          }
        }
      );
      
      updateStatus('🤖 Remote AI model ready! Toggle to start listening.');
      console.log('[Offscreen] Remote Whisper model loaded successfully');
      return true;
      
    } catch (remoteError) {
      console.error('[Offscreen] Both local and remote model loading failed:', remoteError);
      updateStatus('❌ Error loading model: ' + remoteError.message);
      return false;
    }
  }
}

// Start recording from tab audio
async function startRecording(streamId) {
  console.log('[Offscreen] startRecording called with streamId:', streamId);
  
  if (isRecording) {
    console.log('[Offscreen] Already recording, skipping');
    return { success: true, message: 'Already recording' };
  }

  // Initialize model if not already loaded
  if (!transcriber) {
    console.log('[Offscreen] Transcriber not loaded, initializing...');
    const success = await initializeModel();
    if (!success) {
      return { success: false, message: 'Failed to initialize AI model' };
    }
  }

  try {
    console.log('[Offscreen] Getting media stream from tab...');
    updateStatus('🎤 Connecting to audio...');
    
    // Get media stream using the tab capture stream ID
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    console.log('[Offscreen] Got media stream:', mediaStream);
    console.log('[Offscreen] Audio tracks:', mediaStream.getAudioTracks().length);
    
    if (mediaStream.getAudioTracks().length === 0) {
      throw new Error('No audio tracks found in stream');
    }

    // Create AudioContext with 16kHz sample rate (required for Whisper)
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    console.log('[Offscreen] AudioContext created, state:', audioContext.state);
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    
    audioBuffer = [];
    isRecording = true;
    let processCount = 0;

    processor.onaudioprocess = (event) => {
      if (!isRecording) return;

      processCount++;
      const inputData = event.inputBuffer.getChannelData(0);
      const samples = new Float32Array(inputData);
      audioBuffer.push(...samples);

      // Log progress every 50 processes (~3 seconds)
      if (processCount % 50 === 0) {
        console.log('[Offscreen] Audio buffer size:', audioBuffer.length, '/', BUFFER_SIZE);
      }

      // When buffer is full, transcribe it
      if (audioBuffer.length >= BUFFER_SIZE) {
        console.log('[Offscreen] Buffer full, transcribing chunk...');
        const chunk = new Float32Array(audioBuffer.slice(0, BUFFER_SIZE));
        // Keep some overlap for continuity
        audioBuffer = audioBuffer.slice(Math.floor(BUFFER_SIZE / 2));
        transcribeChunk(chunk);
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    updateStatus('🔴 Listening and transcribing...');
    console.log('[Offscreen] Recording started successfully');
    return { success: true, message: 'Recording started' };

  } catch (error) {
    console.error('[Offscreen] Error starting recording:', error);
    updateStatus('❌ Error: ' + error.message);
    return { success: false, message: error.message };
  }
}

// Stop recording
function stopRecording() {
  console.log('[Offscreen] Stopping recording...');
  isRecording = false;

  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (mediaStream) {
    mediaStream.getTracks().forEach(track => {
      console.log('[Offscreen] Stopping track:', track.label);
      track.stop();
    });
    mediaStream = null;
  }

  // Transcribe any remaining audio in buffer (if at least 1 second)
  if (audioBuffer.length > SAMPLE_RATE) {
    console.log('[Offscreen] Transcribing remaining audio buffer...');
    const chunk = new Float32Array(audioBuffer);
    transcribeChunk(chunk);
  }

  audioBuffer = [];
  updateStatus(transcriber ? '⏹️ Stopped - Toggle to start again' : 'Stopped');
  console.log('[Offscreen] Recording stopped');
}

// Transcribe audio chunk using Whisper
async function transcribeChunk(audioData) {
  if (!transcriber) {
    console.error('[Offscreen] Transcriber not initialized');
    return;
  }

  try {
    console.log('[Offscreen] Transcribing chunk of', audioData.length, 'samples');
    
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
      language: 'english',
      task: 'transcribe'
    });

    const text = result.text?.trim();
    
    // Filter out empty results and common Whisper hallucinations
    if (text && 
        text.length > 2 && 
        !text.match(/^\[.*\]$/) && 
        !text.match(/^\(.*\)$/) && 
        !text.toLowerCase().includes('thank you') &&
        !text.toLowerCase().includes('subtitle')) {
      
      console.log('[Offscreen] ✅ Transcription:', text);
      
      // Send transcription result to background script
      chrome.runtime.sendMessage({
        action: 'transcriptionResult',
        text: text
      }).catch(err => console.log('[Offscreen] Failed to send transcription:', err.message));
    } else {
      console.log('[Offscreen] ⏭️ Filtered out:', text);
    }

  } catch (error) {
    console.error('[Offscreen] Transcription error:', error);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Offscreen] ====== MESSAGE RECEIVED ======');
  console.log('[Offscreen] Message:', message);

  try {
    if (message.action === 'ping') {
      console.log('[Offscreen] Responding to ping');
      sendResponse({ status: 'offscreen ready', hasTranscriber: !!transcriber });
      return true;
    }

    if (message.action === 'startRecording' && message.streamId) {
      console.log('[Offscreen] Starting recording with streamId:', message.streamId);
      
      startRecording(message.streamId).then((result) => {
        console.log('[Offscreen] startRecording result:', result);
      }).catch(err => {
        console.error('[Offscreen] startRecording failed:', err);
        updateStatus('❌ Recording failed: ' + err.message);
      });
      
      sendResponse({ received: true });
      return true;
    }

    if (message.action === 'stopRecording') {
      console.log('[Offscreen] Stopping recording');
      stopRecording();
      sendResponse({ received: true });
      return true;
    }

  } catch (error) {
    console.error('[Offscreen] Error in message handler:', error);
    sendResponse({ error: error.message });
  }
  
  return true;
});

console.log('[Offscreen] ====== MESSAGE LISTENER REGISTERED ======');

// Initialize when document loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    updateStatus('Document ready - Loading AI model...');
    // Start loading model automatically
    setTimeout(() => initializeModel(), 1000);
  });
} else {
  updateStatus('Document ready - Loading AI model...');
  setTimeout(() => initializeModel(), 1000);
}

console.log('[Offscreen] ====== OFFSCREEN SCRIPT READY ======');
