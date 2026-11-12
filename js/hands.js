import * as THREE from "three";
import { HAND_BONE } from "./theme.js";

// [startIdx, endIdx] pairs covering metacarpals + phalanges + palm connectors.
const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [0, 9], [9, 10], [10, 11], [11, 12], // middle
  [0, 13], [13, 14], [14, 15], [15, 16], // ring
  [0, 17], [17, 18], [18, 19], [19, 20], // pinky
  [5, 9], [9, 13], [13, 17], // palm cross-links
];

const NUM_JOINTS = 21;

function makeBoneMesh(material) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
  geo.rotateX(Math.PI / 2); // cylinder axis -> local Z so lookAt-style orientation works
  return new THREE.Mesh(geo, material);
}

function makeJointMesh(material) {
  const geo = new THREE.SphereGeometry(1, 10, 8);
  return new THREE.Mesh(geo, material);
}

export class HandRig {
  constructor(parent) {
    this.boneMat = new THREE.MeshStandardMaterial({
      color: HAND_BONE.color,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95,
    });
    this.jointMat = new THREE.MeshStandardMaterial({
      color: HAND_BONE.jointColor,
      roughness: 0.3,
      metalness: 0.2,
      emissive: HAND_BONE.jointColor,
      emissiveIntensity: 0.3,
    });

    this.hands = [0, 1].map(() => {
      const group = new THREE.Group();
      group.visible = false;
      const bones = BONES.map(() => makeBoneMesh(this.boneMat));
      const joints = Array.from({ length: NUM_JOINTS }, () => makeJointMesh(this.jointMat));
      bones.forEach((b) => group.add(b));
      joints.forEach((j) => group.add(j));
      parent.add(group);
      return { group, bones, joints };
    });
  }

  setVisible(index, visible) {
    this.hands[index].group.visible = visible;
  }

  /**
   * positions: array of 21 THREE.Vector3 in world/scene space.
   */
  update(index, positions) {
    const hand = this.hands[index];
    if (!positions) {
      hand.group.visible = false;
      return;
    }
    hand.group.visible = true;

    const wrist = positions[0];
    const midMcp = positions[9];
    const handScale = wrist.distanceTo(midMcp) || 1;
    const boneRadius = handScale * HAND_BONE.radiusScale;
    const jointRadius = handScale * HAND_BONE.jointRadiusScale;

    BONES.forEach(([a, b], i) => {
      const pa = positions[a];
      const pb = positions[b];
      const mesh = hand.bones[i];
      const mid = pa.clone().add(pb).multiplyScalar(0.5);
      const length = pa.distanceTo(pb);
      mesh.position.copy(mid);
      mesh.scale.set(boneRadius, boneRadius, Math.max(length, 0.0001));
      mesh.lookAt(pb);
    });

    positions.forEach((p, i) => {
      const mesh = hand.joints[i];
      mesh.position.copy(p);
      const r = i === 0 ? jointRadius * 1.3 : jointRadius;
      mesh.scale.setScalar(r);
    });
  }
}
