let cam;
let showVideo = true;
let cameraButton;
let cameraSwitching = false;
let lastCameraButtonPress = 0;


let recorder = null;
let recordChunks = [];
let recordButton;
let backButton;
let isRecording = false;
let playBack = false;
let recordedURL = null;
let playbackVideo = null;
let recordStopTimer = null;


function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();

  cam = createPhoneCamera('user', true, 'fitHeight');
  createCameraButton();
  createRecordButton();
  createBackButton();

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

function createBackButton() {
  backButton = createButton('Back to camera');
  backButton.style('position', 'fixed');
  backButton.style('left', '50%');
  backButton.style('transform', 'translateX(-50%)');
  backButton.style('bottom', '24px');
  backButton.style('z-index', '50');
  backButton.style('padding', '12px 18px');
  backButton.style('font-size', '15px');
  backButton.style('font-weight', '700');
  backButton.style('border', '0');
  backButton.style('border-radius', '8px');
  backButton.hide();
  backButton.mousePressed(() => {
    lastCameraButtonPress = Date.now();
    closePlayback();
    return false;
  });
}

function startRecording() {
  if (!cam || !cam.ready || isRecording || playBack) return false;
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
  showPlayback();
}

// ── New: playback replaces the feed ────────────────────────────────
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
  backButton.show();
}

function closePlayback() {
  playBack = false;
  if (playbackVideo) { playbackVideo.remove(); playbackVideo = null; }
  backButton.hide();
  recordButton.show();
  showVideo = true;                         // live feed returns
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
