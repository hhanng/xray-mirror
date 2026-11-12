import * as THREE from "three";
import { Tracker, Smoother } from "./tracking.js";
import { AnatomyScene } from "./anatomy.js";
import { HandRig } from "./hands.js";
import { UI, loadCalibration } from "./ui.js";
import { CAMERA_BLEND } from "./theme.js";

const video = document.getElementById("webcam");
const canvas = document.getElementById("scene");
const startScreen = document.getElementById("start-screen");
const app = document.getElementById("app");
const startBtn = document.getElementById("start-btn");
const startError = document.getElementById("start-error");
const faceLostEl = document.getElementById("face-lost");

let scene, tracker, handRig, ui;
let blend = 0.7;
let cutawayMode = "full";
let calibration = loadCalibration();
let faceVisibleFrames = 0;

const faceMatrixSmoother = new Smoother(16, 0.4);
const handSmoothers = [new Smoother(63, 0.5), new Smoother(63, 0.5)];

startBtn.addEventListener("click", start);

async function start() {
  startBtn.disabled = true;
  startError.hidden = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    startScreen.hidden = true;
    app.hidden = false;

    scene = new AnatomyScene(canvas);
    scene.camera.aspect = video.videoWidth / video.videoHeight || 16 / 9;
    scene.camera.updateProjectionMatrix();

    handRig = new HandRig(scene.scene);

    tracker = new Tracker();
    await tracker.init();

    ui = new UI({
      onLayerToggle: (name, visible) => {
        if (name === "hands") {
          handsEnabled = visible;
        } else {
          scene.setLayerVisible(name, visible);
        }
      },
      onLookChange: (look) => scene.setLook(look),
      onBlendChange: (v) => (blend = v),
      onLensChange: (enabled, radiusPx) => {
        lensEnabled = enabled;
        lensRadiusPx = radiusPx;
      },
      onCutawayChange: (mode) => scene.setCutaway(mode),
      onCalibrationChange: (cal) => (calibration = cal),
    });

    await scene.loadModels();
    // respect initial checkbox state
    document.querySelectorAll("[data-layer]").forEach((el) => {
      if (el.dataset.layer !== "hands") scene.setLayerVisible(el.dataset.layer, el.checked);
    });
    scene.setCutaway(document.getElementById("cutaway-select").value);

    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(onVideoFrame);
    } else {
      requestAnimationFrame(loop);
    }
  } catch (err) {
    console.error(err);
    startError.textContent =
      "Could not access the camera: " + (err && err.message ? err.message : err);
    startError.hidden = false;
    startBtn.disabled = false;
  }
}

let handsEnabled = true;
let lensEnabled = false;
let lensRadiusPx = 150;

function onVideoFrame(now, metadata) {
  processFrame();
  video.requestVideoFrameCallback(onVideoFrame);
}

function loop() {
  processFrame();
  requestAnimationFrame(loop);
}

function unprojectLandmark(camera, nx, ny, relZ, baseDepthCm) {
  const depth = baseDepthCm - relZ * baseDepthCm * 0.6;
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const halfH = Math.tan(vFov / 2) * depth;
  const halfW = halfH * camera.aspect;
  const ndcX = nx * 2 - 1;
  const ndcY = -(ny * 2 - 1);
  return new THREE.Vector3(ndcX * halfW, ndcY * halfH, -depth);
}

function processFrame() {
  const ts = performance.now();
  const { face, hand } = tracker.detect(video, ts);

  applyVideoBlendStyle();

  if (face && face.facialTransformationMatrixes && face.facialTransformationMatrixes.length) {
    faceVisibleFrames = Math.min(faceVisibleFrames + 1, 10);
    const raw = face.facialTransformationMatrixes[0].data;
    const smoothed = faceMatrixSmoother.apply(raw);
    scene.updateHeadMatrix(smoothed, calibration);
    faceLostEl.hidden = true;
  } else {
    faceVisibleFrames = Math.max(faceVisibleFrames - 1, 0);
    if (faceVisibleFrames === 0) {
      scene.hideHead();
      faceLostEl.hidden = false;
    }
  }

  let lensScreenNdc = null;

  if (handRig) {
    const landmarksList = (hand && hand.landmarks) || [];
    for (let i = 0; i < 2; i++) {
      const lm = landmarksList[i];
      if (!lm || !handsEnabled) {
        handRig.update(i, null);
        continue;
      }
      const flat = [];
      lm.forEach((p) => flat.push(p.x, p.y, p.z));
      const smoothed = handSmoothers[i].apply(flat);
      const positions = [];
      for (let j = 0; j < 21; j++) {
        positions.push(
          unprojectLandmark(scene.camera, smoothed[j * 3], smoothed[j * 3 + 1], smoothed[j * 3 + 2], 45)
        );
      }
      handRig.update(i, positions);

      if (i === 0) {
        const tip = lm[8];
        lensScreenNdc = new THREE.Vector2(
          tip.x * canvas.clientWidth,
          tip.y * canvas.clientHeight
        );
      }
    }
  }

  scene.setLens(lensEnabled, lensRadiusPx, lensScreenNdc || scene.lens.screenPos);
  scene.render();
}

function applyVideoBlendStyle() {
  const brightness = 1 - (1 - CAMERA_BLEND.dimAtFull) * blend;
  const saturation = 1 - (1 - CAMERA_BLEND.desaturateAtFull) * blend;
  video.style.filter = `brightness(${brightness}) saturate(${saturation})`;
  canvas.style.opacity = String(Math.max(blend, 0.08));
}
