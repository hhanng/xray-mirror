import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { LAYER_COLORS, XRAY, SOLID, LENS } from "./theme.js";

const MODEL_FILES = {
  skull: "models/skull.glb",
  brain: "models/brain.glb",
  muscles: "models/muscles.glb",
  eyes: "models/eyes.glb",
  outline: "models/outline.glb",
};

const XRAY_VERTEX = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec2 vScreenUv;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  vScreenUv = (gl_Position.xy / gl_Position.w) * 0.5 + 0.5;
}
`;

const XRAY_FRAGMENT = /* glsl */ `
uniform vec3 glowColor;
uniform float rimPower;
uniform float opacity;
uniform float time;
uniform float scanlineSpeed;
uniform float scanlineIntensity;
uniform float noiseIntensity;

uniform bool lensEnabled;
uniform vec2 lensCenterUv;
uniform float lensRadiusUv;
uniform float lensSoftnessUv;
uniform bool lensInsideShowsAnatomy;

varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec2 vScreenUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

void main() {
  float rim = pow(1.0 - clamp(dot(vNormalV, vViewDir), 0.0, 1.0), rimPower);
  float scan = sin(vScreenUv.y * 400.0 + time * scanlineSpeed * 10.0) * scanlineIntensity;
  float noise = (hash(gl_FragCoord.xy + time) - 0.5) * noiseIntensity;
  float alpha = clamp((0.15 + rim) * opacity + scan + noise, 0.0, 1.0);

  if (lensEnabled) {
    float d = distance(vScreenUv, lensCenterUv);
    float inside = 1.0 - smoothstep(lensRadiusUv - lensSoftnessUv, lensRadiusUv, d);
    float mask = lensInsideShowsAnatomy ? inside : (1.0 - inside);
    alpha *= mask;
  }

  gl_FragColor = vec4(glowColor * (0.6 + rim), alpha);
}
`;

function createXrayMaterial(colorHex) {
  const uniforms = {
    glowColor: { value: new THREE.Color(colorHex) },
    rimPower: { value: XRAY.rimPower },
    opacity: { value: XRAY.opacity },
    time: { value: 0 },
    scanlineSpeed: { value: XRAY.scanlineSpeed },
    scanlineIntensity: { value: XRAY.scanlineIntensity },
    noiseIntensity: { value: XRAY.noiseIntensity },
    lensEnabled: { value: false },
    lensCenterUv: { value: new THREE.Vector2(0.5, 0.5) },
    lensRadiusUv: { value: 0.15 },
    lensSoftnessUv: { value: 0.02 },
    lensInsideShowsAnatomy: { value: true },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: XRAY_VERTEX,
    fragmentShader: XRAY_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return mat;
}

function injectLensIntoStandard(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.lensEnabled = material.userData.lensUniforms.lensEnabled;
    shader.uniforms.lensCenterUv = material.userData.lensUniforms.lensCenterUv;
    shader.uniforms.lensRadiusUv = material.userData.lensUniforms.lensRadiusUv;
    shader.uniforms.lensSoftnessUv = material.userData.lensUniforms.lensSoftnessUv;
    shader.uniforms.lensInsideShowsAnatomy =
      material.userData.lensUniforms.lensInsideShowsAnatomy;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform bool lensEnabled;
         uniform vec2 lensCenterUv;
         uniform float lensRadiusUv;
         uniform float lensSoftnessUv;
         uniform bool lensInsideShowsAnatomy;
         varying vec2 vXrayScreenUv;`
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
         if (lensEnabled) {
           float d = distance(vXrayScreenUv, lensCenterUv);
           float inside = 1.0 - smoothstep(lensRadiusUv - lensSoftnessUv, lensRadiusUv, d);
           float mask = lensInsideShowsAnatomy ? inside : (1.0 - inside);
           gl_FragColor.a *= mask;
         }`
      );

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec2 vXrayScreenUv;`
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
         vXrayScreenUv = (gl_Position.xy / gl_Position.w) * 0.5 + 0.5;`
      );
  };
  material.needsUpdate = true;
}

function createSolidMaterial(colorHex) {
  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: SOLID.roughness,
    metalness: SOLID.metalness,
    transparent: true,
    opacity: SOLID.opacity,
    side: THREE.DoubleSide,
  });
  mat.userData.lensUniforms = {
    lensEnabled: { value: false },
    lensCenterUv: { value: new THREE.Vector2(0.5, 0.5) },
    lensRadiusUv: { value: 0.15 },
    lensSoftnessUv: { value: 0.02 },
    lensInsideShowsAnatomy: { value: true },
  };
  injectLensIntoStandard(mat);
  return mat;
}

export class AnatomyScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(63, 16 / 9, 0.1, 1000);
    this.camera.position.set(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(0.5, 1, 1);
    this.scene.add(dir);

    this.headAnchor = new THREE.Group();
    this.headAnchor.matrixAutoUpdate = false;
    this.headAnchor.visible = false;
    this.scene.add(this.headAnchor);

    this.handRoot = new THREE.Group();
    this.scene.add(this.handRoot);

    this.layers = {}; // name -> THREE.Group
    this.materials = { solid: {}, xray: {} };
    this.look = "xray";
    this.clock = new THREE.Clock();

    this.clipPlanesLocal = {
      full: [],
      left: [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0)],
      right: [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
      front: [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)],
      top: [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)],
    };
    this.cutaway = "full";
    this._worldPlane = new THREE.Plane();

    this.lens = { enabled: false, radiusPx: 150, screenPos: new THREE.Vector2(0.5, 0.5) };

    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  async loadModels() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    for (const [name, url] of Object.entries(MODEL_FILES)) {
      const gltf = await loader.loadAsync(url);
      const group = gltf.scene;
      group.name = name;

      const solidMat = createSolidMaterial(LAYER_COLORS[name]);
      const xrayMat = createXrayMaterial(LAYER_COLORS[name]);
      this.materials.solid[name] = solidMat;
      this.materials.xray[name] = xrayMat;

      group.traverse((child) => {
        if (child.isMesh) {
          child.material = this.look === "solid" ? solidMat : xrayMat;
        }
      });

      this.layers[name] = group;
      this.headAnchor.add(group);
    }
  }

  setLayerVisible(name, visible) {
    if (this.layers[name]) this.layers[name].visible = visible;
  }

  setLook(look) {
    this.look = look;
    for (const [name, group] of Object.entries(this.layers)) {
      const mat = look === "solid" ? this.materials.solid[name] : this.materials.xray[name];
      group.traverse((child) => {
        if (child.isMesh) child.material = mat;
      });
    }
  }

  setCutaway(mode) {
    this.cutaway = mode;
  }

  setLens(enabled, radiusPx, screenPosNdc) {
    this.lens.enabled = enabled;
    this.lens.radiusPx = radiusPx;
    if (screenPosNdc) this.lens.screenPos.copy(screenPosNdc);
  }

  updateHeadMatrix(matrixArray /* column-major 16 floats, cm */, calibration) {
    const m = new THREE.Matrix4().fromArray(matrixArray);
    if (calibration) {
      const cal = new THREE.Matrix4()
        .makeRotationX(THREE.MathUtils.degToRad(calibration.pitch))
        .scale(new THREE.Vector3(calibration.scale, calibration.scale, calibration.scale));
      cal.setPosition(calibration.x, calibration.y, calibration.z);
      m.multiply(cal);
    }
    this.headAnchor.matrix.copy(m);
    this.headAnchor.visible = true;
  }

  hideHead() {
    this.headAnchor.visible = false;
  }

  _applyClipping() {
    const planes = this.clipPlanesLocal[this.cutaway] || [];
    this.headAnchor.updateMatrixWorld(true);
    const worldPlanes = planes.map((p) =>
      p.clone().applyMatrix4(this.headAnchor.matrixWorld)
    );
    for (const matMap of [this.materials.solid, this.materials.xray]) {
      for (const mat of Object.values(matMap)) {
        mat.clippingPlanes = worldPlanes;
      }
    }
  }

  _applyLens() {
    const canvas = this.canvas;
    const uv = new THREE.Vector2(
      this.lens.screenPos.x / canvas.clientWidth,
      1 - this.lens.screenPos.y / canvas.clientHeight
    );
    const radiusUv = this.lens.radiusPx / Math.max(canvas.clientWidth, canvas.clientHeight);

    for (const mat of Object.values(this.materials.xray)) {
      mat.uniforms.lensEnabled.value = this.lens.enabled;
      mat.uniforms.lensCenterUv.value.copy(uv);
      mat.uniforms.lensRadiusUv.value = radiusUv;
      mat.uniforms.lensSoftnessUv.value = radiusUv * LENS.edgeSoftness;
      mat.uniforms.lensInsideShowsAnatomy.value = true;
    }
    for (const mat of Object.values(this.materials.solid)) {
      const u = mat.userData.lensUniforms;
      u.lensEnabled.value = this.lens.enabled;
      u.lensCenterUv.value.copy(uv);
      u.lensRadiusUv.value = radiusUv;
      u.lensSoftnessUv.value = radiusUv * LENS.edgeSoftness;
      u.lensInsideShowsAnatomy.value = true;
    }
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render() {
    const t = this.clock.getElapsedTime();
    for (const mat of Object.values(this.materials.xray)) {
      mat.uniforms.time.value = t;
    }
    this._applyClipping();
    this._applyLens();
    this.renderer.render(this.scene, this.camera);
  }
}
