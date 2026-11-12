import {
  FilesetResolver,
  FaceLandmarker,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export class Tracker {
  constructor() {
    this.faceLandmarker = null;
    this.handLandmarker = null;
    this.lastFaceResult = null;
    this.lastHandResult = null;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

    this.faceLandmarker = await this._createFace(vision);
    this.handLandmarker = await this._createHand(vision);
  }

  async _createFace(vision) {
    const base = {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
      outputFaceBlendshapes: false,
    };
    try {
      return await FaceLandmarker.createFromOptions(vision, base);
    } catch (e) {
      console.warn("Face GPU delegate failed, falling back to CPU", e);
      base.baseOptions.delegate = "CPU";
      return await FaceLandmarker.createFromOptions(vision, base);
    }
  }

  async _createHand(vision) {
    const base = {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    };
    try {
      return await HandLandmarker.createFromOptions(vision, base);
    } catch (e) {
      console.warn("Hand GPU delegate failed, falling back to CPU", e);
      base.baseOptions.delegate = "CPU";
      return await HandLandmarker.createFromOptions(vision, base);
    }
  }

  detect(video, timestampMs) {
    if (this.faceLandmarker) {
      this.lastFaceResult = this.faceLandmarker.detectForVideo(video, timestampMs);
    }
    if (this.handLandmarker) {
      this.lastHandResult = this.handLandmarker.detectForVideo(video, timestampMs);
    }
    return { face: this.lastFaceResult, hand: this.lastHandResult };
  }
}

/** One-Euro-ish smoother for small vectors/arrays of numbers. */
export class Smoother {
  constructor(size, alpha = 0.35) {
    this.alpha = alpha;
    this.state = null;
    this.size = size;
  }

  reset() {
    this.state = null;
  }

  apply(values) {
    if (!this.state) {
      this.state = values.slice();
      return this.state;
    }
    for (let i = 0; i < this.size; i++) {
      this.state[i] = this.state[i] + this.alpha * (values[i] - this.state[i]);
    }
    return this.state;
  }
}
