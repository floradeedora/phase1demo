let cam;
let showVideo = true;
let cameraButton;
let cameraSwitching = false;
let lastCameraButtonPress = 0;

let recorder = null;
let recordChunks = [];
let recordButton;
let isRecording = false;
let playBack = false;
let recordedURL = null;
let playbackVideo = null;
let recordStopTimer = null;

let gifImage = null;
let gifURL = null;
let isConverting = false;
let gifWorkerURLCache = null;


const VIEWER_ID = 'phase1demo-gif';                       // the fixed "mailbox" both devices agree on
const ROLE = new URLSearchParams(window.location.search).get('mode')
  || (window.isMobile ? 'view' : 'record');               // phone = viewer, laptop = sender

let peer = null;
let statusDiv = null;
let knockTimer = null;
let viewerStatus = 'Waiting for a recording…';
let gifParts = [];


function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();

  if (ROLE === 'view'){
    setupViewer();
    return;
  }

  cam = createPhoneCamera('user', true, 'fitHeight');
  createCameraButton();
  createRecordButton();
  createStatusDiv();

  enableCameraTap();

  setMl5Loading('Waiting for camera');
  cam.onReady(async () => {
    setMl5Loading('Loading Camera');
    let options = {
      runtime: 'mediapipe',
      flipped: false
    };

    clearMl5Loading();
  });
}

function loadMl5Model(createModel) {
  return new Promise((resolve) => {
    let model = createModel(() => resolve(model));
  });
}

function createCameraButton() {
  cameraButton = createButton('Back camera');
  cameraButton.position(14, 14);
  cameraButton.style('position', 'fixed');
  cameraButton.style('z-index', '20');
  cameraButton.style('padding', '12px 14px');
  cameraButton.style('font-size', '15px');
  cameraButton.style('font-weight', '700');
  cameraButton.style('border', '0');
  cameraButton.style('border-radius', '8px');
  cameraButton.style('background', '#ffffff');
  cameraButton.style('color', '#111111');
  cameraButton.style('box-shadow', '0 4px 14px rgba(0, 0, 0, 0.25)');
  cameraButton.mousePressed(switchCameraView);
}

function createRecordButton(){
  recordButton = createButton('Record');
  recordButton.style('position', 'fixed');
  recordButton.style('right', '14px');       // opposite the Back-camera button
  recordButton.style('top', '14px');
  recordButton.style('z-index', '20');
  recordButton.style('padding', '12px 14px');
  recordButton.style('font-size', '15px');
  recordButton.style('font-weight', '700');
  recordButton.style('border', '0');
  recordButton.style('border-radius', '8px');
  recordButton.style('background', '#e11d1d');
  recordButton.style('color', '#ffffff');
  recordButton.style('box-shadow', '0 4px 14px rgba(0, 0, 0, 0.25)');
  recordButton.mousePressed(() => {
    lastCameraButtonPress = Date.now();      // keeps the tap-to-toggle guard happy
    if (isRecording) stopRecording(); else startRecording();
    return false;
  });
}

function startRecording() {
  if (!cam || !cam.ready || isRecording || playBack || isConverting) return false;
  const stream = cam.videoElement.srcObject;
  if (!stream) return false;

  // iOS Safari wants mp4; Chrome/Android want webm — pick the first supported
  const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t));

  recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  recordChunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordChunks.push(e.data); };
  recorder.onstop = onRecordingStopped;

  recorder.start();
  isRecording = true;
  recordButton.html('Stop');

  clearTimeout(recordStopTimer);
  recordStopTimer = setTimeout(stopRecording, 5000);   // the "small bit" — auto-stop
  return false;
}

function stopRecording() {
  clearTimeout(recordStopTimer);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

function onRecordingStopped() {
  isRecording = false;
  recordButton.html('Record');

  const blob = new Blob(recordChunks, { type: recorder.mimeType || 'video/webm' });
  recordChunks = [];
  recorder = null;

  if (recordedURL) URL.revokeObjectURL(recordedURL);   // don't leak old blobs
  recordedURL = URL.createObjectURL(blob);

  convertToGif(recordedURL).catch((err) => {
    console.error('GIF conversion failed', err);
    clearMl5Loading();
    isConverting = false;
    showPlayback();
  });
}

async function getGifWorkerUrl() {
  if (gifWorkerURLCache) return gifWorkerURLCache;
  // gif.js workers must be same-origin — fetch the CDN file and wrap it in a blob URL
  const src = await fetch('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js')
    .then((r) => r.text());
  gifWorkerURLCache = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
  return gifWorkerURLCache;
}

async function convertToGif(sourceUrl) {
  isConverting = true;
  setMl5Loading('Making GIF… 0%');

  // hidden video element plays the recorded blob
  const video = document.createElement('video');
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;                 // required on iOS
  await new Promise((resolve, reject) => { 
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(Error('Could not read recorded clip'));
    setTimeout(() => reject(new Error('Timed out reading the recorded clip')), 10000);
  });

  // small capture canvas — 320px wide keeps the GIF a few MB; mirror baked in
  const w = 320;
  const h = Math.round((video.videoHeight * (w / video.videoWidth)) / 2) * 2;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (cam.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: w,
    height: h,
    workerScript: await getGifWorkerUrl(),
  });
  gif.on('progress', (p) => setMl5Loading('Making GIF… ' + Math.round(p * 100) + '%'));

  // play the clip once, grabbing ~10 frames per second
  video.currentTime = 0;
  await video.play();
  const capture = setInterval(() => {
    ctx.drawImage(video, 0, 0, w, h);
    gif.addFrame(ctx, { copy: true, delay: 100 });
  }, 100);
  await new Promise((res) => { video.onended = res; });
  clearInterval(capture);
  video.remove();

  // encode → object URL → show
  const gifBlob = await new Promise((resolve) => {
    gif.on('finished', resolve);
    gif.render();
  });

  if (gifURL) URL.revokeObjectURL(gifURL);
  gifURL = URL.createObjectURL(gifBlob);
  clearMl5Loading();
  isConverting = false;
  showGifPlayback(gifURL);
  deliverGifToViewer(gifBlob);  
}

function showGifPlayback(url) {
  playBack = true;
  showVideo = false;                        // draw() stops painting the live feed

  gifImage = createImg(url);                // <img> loops automatically — GIF behaviour
  gifImage.style('position', 'fixed');
  gifImage.style('inset', '0');
  gifImage.style('width', '100%');
  gifImage.style('height', '100%');
  gifImage.style('object-fit', 'contain');
  gifImage.style('background', '#000');
  gifImage.style('z-index', '40');

  recordButton.hide();
  setStatus('Waiting for phone…'); 

  if (cam) cam.remove();   // release the camera — light off, battery saved
  noLoop();  //stops drawing
}

//New: status pill (sender)
function createStatusDiv() {
  statusDiv = createDiv('');
  statusDiv.style('position', 'fixed');
  statusDiv.style('left', '50%');
  statusDiv.style('transform', 'translateX(-50%)');
  statusDiv.style('bottom', '24px');
  statusDiv.style('z-index', '50');
  statusDiv.style('padding', '12px 18px');
  statusDiv.style('font-size', '15px');
  statusDiv.style('font-weight', '700');
  statusDiv.style('font-family', 'Arial, sans-serif');
  statusDiv.style('border-radius', '8px');
  statusDiv.style('background', '#ffffff');
  statusDiv.style('color', '#111111');
  statusDiv.style('box-shadow', '0 4px 14px rgba(0, 0, 0, 0.25)');
  statusDiv.hide();
}

function setStatus(message, color) {
  if (!statusDiv) return;
  statusDiv.html(message);
  statusDiv.style('background', color || '#ffffff');
  statusDiv.show();
}

// ── New: sender — knock until the phone answers, then send ─────────
function deliverGifToViewer(blob) {
  if (!peer) peer = new Peer();            // sender needs no fixed ID

  const knock = () => {
    const conn = peer.connect(VIEWER_ID, { reliable: true });
    conn.on('open', async () => {
      conn.send({ type: 'gif-meta', size: blob.size });
      const CHUNK = 64 * 1024;
      for (let i = 0; i < blob.size; i += CHUNK) {
        conn.send(await blob.slice(i, i + CHUNK).arrayBuffer());
      }
      conn.send({ type: 'gif-done' });
      setStatus('Sent to phone ✓', '#b8f5c0');
    });
    conn.on('close', () => setTimeout(knock, 3000));   // phone left → keep knocking
  };

    peer.on('error', (err) => {
    if (err.type === 'peer-unavailable' && !knockTimer) {             // phone not on the page yet
      setStatus('Waiting for phone… (open the page on your phone)');
      knockTimer = setTimeout(() => { knockTimer = null; knock(); }, 3000);
    }
  });

    if (peer.open) knock();              // peer already online → knock right now
    else peer.once('open', knock); 
}

function setupViewer() {
  peer = new Peer(VIEWER_ID);              // claim the fixed mailbox
  peer.on('open', () => { viewerStatus = 'Waiting for a recording…'; });
  peer.on('connection', (conn) => {
    conn.on('data', handleGifChunk);
  });
  peer.on('error', () => {                 // slot held by another viewer, or broker hiccup
    try { peer.destroy(); } catch (e) {}
    peer = null;
    viewerStatus = 'Waiting…';
    setTimeout(setupViewer, 3000);
  });
}

function handleGifChunk(data) {
  if (data && data.type === 'gif-meta') {
    gifParts = [];
    viewerStatus = 'Receiving…';
  }
  else if (data && data.type === 'gif-done') {
    const blob = new Blob(gifParts, { type: 'image/gif' });
    gifParts = [];
    showReceivedGif(URL.createObjectURL(blob));
  }
  else if (data) {
    gifParts.push(data);                   // ArrayBuffer chunk
  }
}

function showReceivedGif(url) {
  playBack = true;

  if (gifImage) gifImage.remove();
  gifImage = createImg(url);
  gifImage.style('position', 'fixed');
  gifImage.style('inset', '0');
  gifImage.style('width', '100%');
  gifImage.style('height', '100%');
  gifImage.style('object-fit', 'contain');
  gifImage.style('background', '#000');
  gifImage.style('z-index', '40');
  // the p5 loop can keep running — it just paints black behind the GIF
}


function showPlayback() {
  playBack = true;
  showVideo = false;                        // draw() stops painting the live feed

  playbackVideo = createElement('video');
  playbackVideo.attribute('controls', '');
  playbackVideo.attribute('playsinline', '');   // required on iOS
  playbackVideo.attribute('src', recordedURL);
  playbackVideo.style('position', 'fixed');
  playbackVideo.style('inset', '0');
  playbackVideo.style('width', '100%');
  playbackVideo.style('height', '100%');
  playbackVideo.style('object-fit', 'contain');
  playbackVideo.style('background', '#000');
  playbackVideo.style('z-index', '40');
  if (cam.mirror) playbackVideo.style('transform', 'scaleX(-1)');  // match the mirrored live view

  playbackVideo.elt.play().catch(() => {}); // controls are there if autoplay is blocked
  recordButton.hide();
}

async function switchCameraView() {
  lastCameraButtonPress = Date.now();

  if (!cam || cameraSwitching || isRecording) {
    return false;
  }

  cameraSwitching = true;
  setMl5Loading('Switching camera');
  

  let useBackCamera = cam.active !== 'environment';
  cam.mirror = !useBackCamera;
  cam.active = useBackCamera ? 'environment' : 'user';
  cameraButton.html(useBackCamera ? 'Front camera' : 'Back camera');

  await waitForCameraReady();

  cameraSwitching = false;
  clearMl5Loading();
  return false;
}

function waitForCameraReady() {
  return new Promise((resolve) => {
    let attempts = 0;
    let checkReady = () => {
      if (cam && cam.ready && cam.videoElement && cam.videoElement.readyState >= 2) {
        resolve();
      }
      else if (attempts > 100) {
        resolve();
      }
      else {
        attempts = attempts + 1;
        setTimeout(checkReady, 100);
      }
    };

    checkReady();
  });
}

function draw() {
  background(220);

  if (ROLE === 'view') { drawViewer(); return; }

  if (playBack) return;

  if (showVideo && cam.ready) drawPhoneCamera(cam);
  drawUI();
  
  if (isRecording) {                        // red REC dot, bottom-right
  push();
  noStroke();
  fill(255, 0, 0);
  circle(width - 26, height - 40, 18);
  fill(255);
  textAlign(RIGHT, BOTTOM);
  textSize(15);
  text('REC', width - 44, height - 30);
  pop();
  }

  if (isMl5Loading()) drawMl5LoadingGraphic();   // new: shows "Making GIF… 42%" spinner

}

function drawViewer() {
  push();
  background(0);
  if (!playBack) {                          // before the GIF arrives, show status text
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(18);
    text(viewerStatus, width / 2, height / 2);
  }
  pop();
}

function drawPhoneCamera(phoneCamera) {
  const videoElement = phoneCamera.videoElement;
  if (!phoneCamera.ready || !videoElement || videoElement.readyState < 2) return;

  const dims = phoneCamera.getDimensions();
  push();
  if (phoneCamera.mirror) {
    translate(width, 0);
    scale(-1, 1);
  }
  drawingContext.drawImage(videoElement, dims.x, dims.y, dims.width, dims.height);
  pop();
}

function drawUI() {
  push();
  fill(255);
  stroke(0);
  strokeWeight(3);
  textAlign(CENTER, TOP);
  textSize(16);
  
  // Show status at top of screen
  if (cameraSwitching) {
    text('Switching camera...', width/2, 20);
  } else if (!cam.ready) {
    text('Starting camera...', width/2, 20);
  }
  
  // Instructions at bottom
  textSize(14);
  text('Tap screen to toggle video', width/2, height - 40);
  pop();
}

function mousePressed() {
  if (playBack) return false;
  if (ROLE === 'view') return false; 
  if (Date.now() - lastCameraButtonPress < 400) {
    return false;
  }

  showVideo = !showVideo;
  return false;
}

//notes:
//used AI to assess why the camera wasn't turning on/recording
//all the code was taken from p5.js example code: PHONE HandPose Two Points 

//<----camera recording----->
//used AI to generate the code needed to create a recording, and also used AI to review any mistakes made in the process

//<----gif maker---->
//used AI to convert the recordings into a gif so that it can be transfered and altered on another device
//deleted the back button after gif has been made
//removed closeplayback since back button is gone

//<----gif transfer to different devices---->
//used AI to help find a way to "less manually" transfer the gif recording from one device to another (currently can be done between a laptop and phone)
