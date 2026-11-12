# X-Ray Mirror

A full-screen webcam "X-ray mirror": a 3D anatomy model (skull, brain, head
muscles, eyes, head outline) locks onto your head in real time, and stylized
bones are drawn over your hands. It's an **art / education toy**, not a
medical device — it shows where structures typically sit on one adult
reference dataset, not a scan of you.

Everything runs locally in your browser. No build step, no server-side code,
no uploads: the webcam video never leaves your device.

## Live demo

https://hhanng.github.io/xray-mirror/

## Controls

| Key | Action |
| --- | --- |
| `1`–`6` | Toggle layer (skull, brain, muscles, eyes, head outline, hand bones) |
| `X` | Switch look: X-ray ↔ Solid |
| `L` | Toggle the X-ray lens (follows your index fingertip) |
| `C` | Open/close the calibration panel |
| `H` | Hide/show the UI panel |

Everything is also available from the on-screen panel (collapsible, top
right): layer toggles, look switch, camera blend slider, lens radius,
cutaway view (full / left half / right half / front cut / top cut), and a
calibration panel (scale, X/Y/Z offset, pitch — saved to `localStorage`).

Works on desktop and mobile (front camera, touch-friendly controls).

## How it works

- **Face tracking**: MediaPipe `FaceLandmarker` outputs a facial
  transformation matrix each frame, which is used directly as the 3D head
  anchor's transform (smoothed to reduce jitter).
- **Hand tracking**: MediaPipe `HandLandmarker` outputs 21 landmarks per
  hand; procedural tapered bone segments and joint spheres are drawn between
  them every frame.
- **Rendering**: three.js renders the anatomy on a transparent canvas layered
  over the `<video>` element. Both are mirrored with the same CSS transform
  so the overlay stays aligned with the video.
- **Looks**: "Solid" uses lit `MeshStandardMaterial`; "X-ray" uses a custom
  fresnel-rim shader with additive blending and a scanline/noise overlay.
- **Lens & cutaway**: the X-ray lens is a screen-space circular mask (shader
  uniform for center + radius); cutaway views use three.js clipping planes
  defined in head-local space.

## Run it locally

No build step — just serve the static files:

```bash
npx serve .
```

Then open the printed `localhost` URL and click "Start camera". (Camera
access requires `localhost` or HTTPS.)

## Asset pipeline

The anatomy models are derived from BodyParts3D OBJ data. `scripts/` contains
the pipeline used to go from raw BodyParts3D meshes to the final compressed
`.glb` files in `models/`:

1. Download the official BodyParts3D OBJ archives (not included in this
   repo — see Credits below).
2. `scripts/merge_obj_group.py` merges the OBJ files for one anatomical
   group, applies a single shared transform (mm → cm, BodyParts3D axes →
   MediaPipe canonical face space: +Y up, +Z toward the camera, recentered
   on the skull), and optionally crops to the head region.
3. `obj2gltf` converts each merged OBJ to `.glb`.
4. `@gltf-transform/cli` (`weld` → `simplify` → `dedup` → `prune` →
   `meshopt`) simplifies and compresses each `.glb`.

Total model size is ~2.2 MB, loaded with `GLTFLoader` + `MeshoptDecoder`.

## Credits

Anatomy models: **BodyParts3D**, © The Database Center for Life Science,
licensed under [CC BY-SA 2.1 Japan](http://creativecommons.org/licenses/by-sa/2.1/jp/)
(simplified and re-aligned for this project).

Built with [three.js](https://threejs.org/) and
[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker).

## License

Code is MIT licensed — see [LICENSE](LICENSE). The models in `/models` are
adapted from BodyParts3D and remain under CC BY-SA 2.1 Japan.
