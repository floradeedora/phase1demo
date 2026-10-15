let cam;
let showVideo = true;
let cameraButton;
let cameraSwitching = false;
let lastCameraButtonPress = 0;


function setup() {
  createCanvas(windowWidth, windowHeight);
  lockGestures();

  cam = createPhoneCamera('user', true, 'fitHeight');
  createCameraButton();

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

async function switchCameraView() {
  lastCameraButtonPress = Date.now();

  if (!cam || cameraSwitching) {
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

    if (showVideo && cam.ready) {
      drawPhoneCamera(cam);
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
  if (Date.now() - lastCameraButtonPress < 400) {
    return false;
  }

  showVideo = !showVideo;
  return false;
}

//used AI to assess why the camera wasn't turning on/recording
//all the code was taken from p5.js example code: PHONE HandPose Two Points 