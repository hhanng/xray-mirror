// All 3D-side color/style constants. Restyle here; CSS vars cover the UI chrome.

export const LAYER_COLORS = {
  skull: 0xd8e4ea,
  brain: 0xff8fb0,
  muscles: 0xe2555a,
  eyes: 0x6fd3ff,
  outline: 0x7fb8c9,
  hands: 0xeaf4f8,
};

export const XRAY = {
  glowColor: 0x26e3ff,
  rimPower: 2.2,
  scanlineSpeed: 0.6,
  scanlineIntensity: 0.06,
  noiseIntensity: 0.03,
  opacity: 0.85,
};

export const SOLID = {
  roughness: 0.55,
  metalness: 0.05,
  opacity: 1.0,
};

export const LENS = {
  ringColor: 0x26e3ff,
  ringWidth: 0.015, // fraction of radius
  edgeSoftness: 0.12, // fraction of radius
};

export const HAND_BONE = {
  color: 0xeaf4f8,
  jointColor: 0x26e3ff,
  radiusScale: 0.085, // fraction of bone length
  jointRadiusScale: 0.11,
};

export const CAMERA_BLEND = {
  dimAtFull: 0.25, // video brightness multiplier when anatomy blend = 1
  desaturateAtFull: 0.15, // video saturation multiplier when anatomy blend = 1
};
