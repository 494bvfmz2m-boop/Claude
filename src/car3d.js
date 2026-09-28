// 3D-fabrieksscène: een auto wordt op een productielijn opgebouwd.
// Gebundeld door scripts/build.mjs naar js/car3d.js (gewoon script, werkt ook via file://).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// ---------------------------------------------------------------------------
// Tijdlijn (seconden)
// ---------------------------------------------------------------------------

const S = 0.34; // hoogte van de auto op de transportslede

const TL = {
  chassis: 0.0,
  engine: 3.4,
  interior: 7.6,
  body: 10.6,
  weld: 14.2,
  doors: 18.0,
  wheels: 22.4,
  glass: 26.6,
  final: 30.6,
};

const STEPS = [
  { start: TL.chassis, title: "Chassis", caption: "Het chassis komt binnen op de lopende band" },
  { start: TL.engine, title: "Motor", caption: "Een takel laat de motor in de motorruimte zakken" },
  { start: TL.interior, title: "Interieur", caption: "Vloer, dashboard, stuur en stoelen worden geplaatst" },
  { start: TL.body, title: "Carrosserie", caption: "De carrosserie zakt op het chassis en wordt vastgelast" },
  { start: TL.doors, title: "Deuren", caption: "Robots hangen de deuren erin" },
  { start: TL.wheels, title: "Wielen", caption: "Vier robots monteren tegelijk de wielen" },
  { start: TL.glass, title: "Ruiten", caption: "De voorruit wordt geplaatst en de zijruiten gaan omhoog" },
];
const DONE = { start: TL.final + 1.2, title: "Klaar!", caption: "Lichten aan: de auto gaat door naar de eindcontrole" };

// ---------------------------------------------------------------------------
// Hulpfuncties
// ---------------------------------------------------------------------------

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x * x;
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _m1 = new THREE.Matrix4();
const Y_AXIS = V(0, 1, 0);

// Interpoleer vectoren langs [[tijd, vec], ...] met ease-in-out per segment.
function keyed(keys, t, out) {
  if (t <= keys[0][0]) return out.copy(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const k = easeInOut((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
      return out.copy(keys[i - 1][1]).lerp(keys[i][1], k);
    }
  }
  return out.copy(keys[keys.length - 1][1]);
}

function b64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Cilinder tussen twee punten (kabels, kettingen).
function placeCable(mesh, a, b) {
  const len = a.distanceTo(b);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.scale.set(1, Math.max(len, 0.001), 1);
  _v1.subVectors(b, a).normalize();
  mesh.quaternion.setFromUnitVectors(Y_AXIS, _v1);
}

// ---------------------------------------------------------------------------
// Materialen
// ---------------------------------------------------------------------------

function makeMaterials() {
  const std = (color, roughness, metalness, extra) =>
    new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness }, extra || {}));
  return {
    robotOrange: std(0xd9580e, 0.44, 0.22),
    robotGrey: std(0x33383d, 0.5, 0.6),
    robotDark: std(0x1c1f22, 0.55, 0.5),
    steel: std(0x9aa1a7, 0.32, 0.9),
    darkSteel: std(0x4a5056, 0.45, 0.8),
    hose: std(0x0d0d0d, 0.65, 0.1),
    copper: std(0xb8733d, 0.3, 1.0),
    yellow: std(0xf2b705, 0.45, 0.25),
    rubber: std(0x121212, 0.85, 0.0),
    castIron: std(0x3b3e42, 0.72, 0.55),
    alu: std(0xb9bec3, 0.3, 0.92),
    valveCover: std(0x8a1515, 0.5, 0.35),
    blackPlastic: std(0x161616, 0.6, 0.05),
    heatSteel: std(0x6d5a48, 0.42, 0.88),
    columnPaint: std(0x39566e, 0.62, 0.45),
    beam: std(0x2b3238, 0.7, 0.4),
    wall: std(0x1f262c, 0.9, 0.1),
    cable: std(0x222222, 0.6, 0.7),
    cup: std(0x0b0b0b, 0.8, 0.0),
  };
}

// ---------------------------------------------------------------------------
// Industriële robot (6-assig uiterlijk, IK in het verticale armvlak)
// ---------------------------------------------------------------------------

class Robot {
  constructor(parent, M, base, side, tool) {
    this.base = base.clone();
    this.side = side;
    this.L1 = 1.05;
    this.L2 = 0.95;
    this.h1 = 0.8;
    this.a = 0.16;
    this.Lt = tool === "weld" ? 0.42 : 0.3;

    const root = new THREE.Group();
    root.position.copy(base);
    parent.add(root);
    this.root = root;

    const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };

    // voet en draaivoet
    root.add(mesh(new RoundedBoxGeometry(0.95, 0.12, 0.95, 2, 0.03), M.robotDark, 0, 0.06, 0));
    root.add(mesh(new THREE.CylinderGeometry(0.33, 0.36, 0.3, 28), M.robotGrey, 0, 0.27, 0));

    this.j1 = new THREE.Group();
    this.j1.position.y = 0.38;
    root.add(this.j1);
    this.j1.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.14, 28), M.robotOrange, 0, 0.05, 0));
    this.j1.add(mesh(new RoundedBoxGeometry(0.58, 0.42, 0.52, 3, 0.07), M.robotOrange, 0, 0.3, 0.05));

    this.shoulder = new THREE.Group();
    this.shoulder.position.set(0, this.h1 - 0.38, this.a);
    this.j1.add(this.shoulder);
    const shoulderMotor = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.66, 24), M.robotGrey);
    shoulderMotor.rotation.z = Math.PI / 2;
    this.shoulder.add(shoulderMotor);
    this.shoulder.add(mesh(new RoundedBoxGeometry(0.27, this.L1 + 0.12, 0.3, 3, 0.07), M.robotOrange, 0, this.L1 / 2, 0));
    const hoseCurve = new THREE.CatmullRomCurve3([V(0.17, 0.05, -0.08), V(0.25, this.L1 * 0.5, -0.16), V(0.17, this.L1 - 0.05, -0.08)]);
    this.shoulder.add(mesh(new THREE.TubeGeometry(hoseCurve, 20, 0.028, 8), M.hose));

    this.elbow = new THREE.Group();
    this.elbow.position.y = this.L1;
    this.shoulder.add(this.elbow);
    const elbowJoint = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.46, 24), M.robotGrey);
    elbowJoint.rotation.z = Math.PI / 2;
    this.elbow.add(elbowJoint);
    this.elbow.add(mesh(new RoundedBoxGeometry(0.34, 0.34, 0.36, 3, 0.07), M.robotOrange, 0, -0.02, -0.16));
    this.elbow.add(mesh(new RoundedBoxGeometry(0.21, this.L2, 0.23, 3, 0.06), M.robotOrange, 0, this.L2 / 2, 0));
    this.elbow.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 18), M.robotGrey, 0, 0.1, -0.2));

    this.wrist = new THREE.Group();
    this.wrist.position.y = this.L2;
    this.elbow.add(this.wrist);
    const wristJoint = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 20), M.robotGrey);
    wristJoint.rotation.z = Math.PI / 2;
    this.wrist.add(wristJoint);
    this.wrist.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 20), M.robotOrange, 0, 0.08, 0));

    if (tool === "weld") {
      this.wrist.add(mesh(new RoundedBoxGeometry(0.15, 0.2, 0.17, 2, 0.03), M.darkSteel, 0, 0.22, 0));
      this.wrist.add(mesh(new RoundedBoxGeometry(0.17, 0.14, 0.2, 2, 0.03), M.robotDark, 0, 0.2, -0.16));
      const arc = mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 24, Math.PI), M.steel, 0, 0.32, 0.1);
      arc.rotation.y = Math.PI / 2;
      this.wrist.add(arc);
      this.wrist.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.1, 10), M.copper, 0, this.Lt - 0.05, 0));
    } else {
      this.wrist.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 14), M.steel, 0, 0.2, 0));
      this.wrist.add(mesh(new RoundedBoxGeometry(0.38, 0.035, 0.32, 2, 0.012), M.darkSteel, 0, this.Lt - 0.06, 0));
      for (const [cx, cz] of [[0.13, 0.1], [-0.13, 0.1], [0.13, -0.1], [-0.13, -0.1]]) {
        this.wrist.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.05, 14), M.cup, cx, this.Lt - 0.025, cz));
      }
    }

    this.tcpLocal = V(0, this.Lt, 0);
    this.home = { p: V(base.x - side * 0.25, 2.2, base.z), d: V(-side * 0.2, -1, 0).normalize() };
  }

  solve(P, d) {
    const L1 = this.L1;
    const L2 = this.L2;
    const W = _v1.copy(P).addScaledVector(d, -this.Lt);
    const dx = W.x - this.base.x;
    const dz = W.z - this.base.z;
    const yaw = Math.atan2(dx, dz);
    const f = Math.hypot(dx, dz) - this.a;
    const u = W.y - this.h1;
    const D = Math.min(Math.max(Math.hypot(f, u), 0.25), L1 + L2 - 1e-3);
    const beta = Math.atan2(f, u);
    const gamma = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))));
    const a1 = beta - gamma;
    const a2 = Math.atan2(f - L1 * Math.sin(a1), u - L1 * Math.cos(a1));
    const df = d.x * Math.sin(yaw) + d.z * Math.cos(yaw);
    const at = Math.atan2(df, d.y);
    this.j1.rotation.y = yaw;
    this.shoulder.rotation.x = a1;
    this.elbow.rotation.x = a2 - a1;
    this.wrist.rotation.x = at - a2;
  }

  tcpWorld(out) {
    this.wrist.updateWorldMatrix(true, false);
    return out.copy(this.tcpLocal).applyMatrix4(this.wrist.matrixWorld);
  }
}

// ---------------------------------------------------------------------------
// Vonken (lasvonken als lichtgevende strepen met zwaartekracht en stuiteren)
// ---------------------------------------------------------------------------

class Sparks {
  constructor(parent, max = 700) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1);
    this.life = new Float32Array(max).fill(1);
    this.alive = new Uint8Array(max);
    const geo = new THREE.BufferGeometry();
    this.linePos = new Float32Array(max * 6);
    this.lineCol = new Float32Array(max * 6);
    geo.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("color", new THREE.BufferAttribute(this.lineCol, 3).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    this.lines = new THREE.LineSegments(geo, mat);
    this.lines.frustumCulled = false;
    parent.add(this.lines);
  }

  reset() {
    this.alive.fill(0);
    this.lineCol.fill(0);
    this.lines.geometry.attributes.color.needsUpdate = true;
  }

  emit(origin, normal, count) {
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      this.alive[i] = 1;
      this.age[i] = 0;
      this.life[i] = rand(0.35, 1.0);
      this.pos[i * 3] = origin.x + rand(-0.01, 0.01);
      this.pos[i * 3 + 1] = origin.y + rand(-0.01, 0.01);
      this.pos[i * 3 + 2] = origin.z + rand(-0.01, 0.01);
      const sp = rand(1.2, 4.2);
      this.vel[i * 3] = normal.x * rand(0.4, 1.8) + rand(-1, 1) * sp * 0.6;
      this.vel[i * 3 + 1] = normal.y * rand(0.4, 1.8) + rand(0.2, 1.2) * sp * 0.6;
      this.vel[i * 3 + 2] = normal.z * rand(0.4, 1.8) + rand(-1, 1) * sp * 0.6;
    }
  }

  update(dt) {
    const p = this.pos;
    const v = this.vel;
    for (let i = 0; i < this.max; i++) {
      const o = i * 6;
      if (!this.alive[i]) {
        this.lineCol[o] = this.lineCol[o + 1] = this.lineCol[o + 2] = 0;
        this.lineCol[o + 3] = this.lineCol[o + 4] = this.lineCol[o + 5] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      if (k >= 1) {
        this.alive[i] = 0;
        continue;
      }
      const j = i * 3;
      v[j + 1] -= 9.8 * dt;
      p[j] += v[j] * dt;
      p[j + 1] += v[j + 1] * dt;
      p[j + 2] += v[j + 2] * dt;
      if (p[j + 1] < 0.01) {
        p[j + 1] = 0.01;
        v[j + 1] *= -0.32;
        v[j] *= 0.55;
        v[j + 2] *= 0.55;
      }
      this.linePos[o] = p[j];
      this.linePos[o + 1] = p[j + 1];
      this.linePos[o + 2] = p[j + 2];
      this.linePos[o + 3] = p[j] - v[j] * 0.028;
      this.linePos[o + 4] = p[j + 1] - v[j + 1] * 0.028;
      this.linePos[o + 5] = p[j + 2] - v[j + 2] * 0.028;
      const heat = 1 - k;
      const r = 7 * heat + 0.4;
      const g = 5.2 * heat * heat + 0.05;
      const b = 2.6 * heat * heat * heat;
      this.lineCol[o] = r;
      this.lineCol[o + 1] = g;
      this.lineCol[o + 2] = b;
      this.lineCol[o + 3] = r * 0.25;
      this.lineCol[o + 4] = g * 0.15;
      this.lineCol[o + 5] = 0;
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Motorblok (procedureel: 4-cilinder dwarsgeplaatst met versnellingsbak)
// ---------------------------------------------------------------------------

function buildEngine(M) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const rb = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, r);

  add(rb(0.56, 0.1, 0.3), M.darkSteel, 0, 0.05, 0);
  add(rb(0.6, 0.24, 0.34), M.castIron, 0, 0.22, 0);
  add(rb(0.6, 0.1, 0.32), M.alu, 0, 0.39, 0);
  add(new RoundedBoxGeometry(0.56, 0.08, 0.24, 3, 0.03), M.valveCover, 0, 0.475, 0);
  for (let i = 0; i < 4; i++) {
    const x = -0.21 + i * 0.14;
    add(new THREE.CylinderGeometry(0.024, 0.026, 0.08, 14), M.blackPlastic, x, 0.55, 0);
    add(rb(0.05, 0.02, 0.07, 0.006), M.blackPlastic, x, 0.595, 0.02);
    // inlaatspruitstuk
    const runner = new THREE.QuadraticBezierCurve3(V(x, 0.38, 0.15), V(x, 0.4, 0.3), V(x, 0.5, 0.27));
    add(new THREE.TubeGeometry(runner, 12, 0.026, 10), M.alu, 0, 0, 0);
    // uitlaatspruitstuk
    const ex = new THREE.CatmullRomCurve3([V(x, 0.37, -0.16), V(x * 0.8, 0.32, -0.25), V(x * 0.3, 0.2, -0.27), V(0, 0.12, -0.26)]);
    add(new THREE.TubeGeometry(ex, 16, 0.022, 10), M.heatSteel, 0, 0, 0);
  }
  add(new THREE.CylinderGeometry(0.07, 0.07, 0.52, 20), M.alu, 0, 0.5, 0.27, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 20), M.blackPlastic, 0.3, 0.5, 0.27, 0, 0, Math.PI / 2);
  const pipe = new THREE.CatmullRomCurve3([V(0, 0.12, -0.26), V(0, 0.04, -0.33), V(0, 0.03, -0.45)]);
  add(new THREE.TubeGeometry(pipe, 10, 0.035, 12), M.heatSteel, 0, 0, 0);
  // versnellingsbak
  add(new THREE.CylinderGeometry(0.2, 0.24, 0.14, 28), M.alu, -0.37, 0.22, 0, 0, 0, Math.PI / 2);
  add(rb(0.22, 0.27, 0.3, 0.04), M.alu, -0.53, 0.22, 0);
  // distributiekant met poelies en riem
  add(rb(0.04, 0.3, 0.3), M.castIron, 0.32, 0.3, 0);
  const pulleys = [[0.36, 0.14, 0.02, 0.075], [0.36, 0.42, 0.18, 0.05], [0.36, 0.13, 0.2, 0.055]];
  for (const [x, y, z, r] of pulleys) add(new THREE.CylinderGeometry(r, r, 0.035, 26), M.steel, x, y, z, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.065, 0.065, 0.13, 24), M.alu, 0.29, 0.42, 0.18, 0, 0, Math.PI / 2);
  const belt = new THREE.CatmullRomCurve3(
    [V(0.36, 0.215, 0.02), V(0.36, 0.47, 0.13), V(0.36, 0.44, 0.235), V(0.36, 0.12, 0.26), V(0.36, 0.07, 0.03), V(0.36, 0.1, -0.05)],
    true
  );
  add(new THREE.TubeGeometry(belt, 48, 0.008, 6, true), M.rubber, 0, 0, 0);
  // motorsteunen, peilstok, vuldop, hijsogen
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), M.rubber, 0.2, 0.3, -0.2);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), M.rubber, -0.62, 0.3, 0.05);
  add(new THREE.TorusGeometry(0.014, 0.004, 6, 14), M.yellow, 0.12, 0.54, -0.13);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), M.blackPlastic, -0.18, 0.525, -0.06);
  add(new THREE.TorusGeometry(0.025, 0.007, 8, 16), M.steel, 0.22, 0.56, -0.12, 0, Math.PI / 2, 0);
  add(new THREE.TorusGeometry(0.025, 0.007, 8, 16), M.steel, -0.22, 0.56, -0.12, 0, Math.PI / 2, 0);
  return g;
}

// ---------------------------------------------------------------------------
// De fabriekshal
// ---------------------------------------------------------------------------

function buildHall(scene, M, quality) {
  const hall = new THREE.Group();
  scene.add(hall);

  // epoxyvloer met naden en vlekken
  const floorTex = canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = "#5d6468";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = rand(40, 180);
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = Math.random() < 0.5;
      grd.addColorStop(0, dark ? "rgba(30,34,38,0.16)" : "rgba(140,148,152,0.12)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const img = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.strokeStyle = "rgba(25,28,30,0.55)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 1.5);
    ctx.lineTo(w, 1.5);
    ctx.moveTo(1.5, 0);
    ctx.lineTo(1.5, h);
    ctx.stroke();
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(15, 15);

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.42,
    metalness: 0.05,
    transparent: quality.reflections,
    opacity: quality.reflections ? 0.86 : 1,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  hall.add(floor);

  let reflector = null;
  if (quality.reflections) {
    reflector = new Reflector(new THREE.PlaneGeometry(90, 90), {
      textureWidth: 1024,
      textureHeight: 1024,
      color: 0x8a8f94,
      clipBias: 0.003,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.002;
    hall.add(reflector);
  }

  // vloermarkeringen
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xe5b40d, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const addStrip = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.003, z);
    m.receiveShadow = true;
    hall.add(m);
  };
  addStrip(1.55, 0, 0.09, 80);
  addStrip(-1.55, 0, 0.09, 80);
  addStrip(4.05, 0, 0.12, 80);
  addStrip(-4.05, 0, 0.12, 80);

  const hatchTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e5b40d";
    ctx.lineWidth = 22;
    for (let i = -w; i < w * 2; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    ctx.strokeStyle = "#e5b40d";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
  });
  const hatchMat = new THREE.MeshStandardMaterial({ map: hatchTex, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const [x, z] of [[2.3, 1.6], [-2.3, 1.6], [2.3, -1.1], [-2.3, -1.1]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), hatchMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    m.receiveShadow = true;
    hall.add(m);
  }

  // lopende band: rails + rollen
  for (const x of [-0.62, 0.62]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 80), M.darkSteel);
    rail.position.set(x, 0.07, 0);
    rail.castShadow = rail.receiveShadow = true;
    hall.add(rail);
  }
  const rollerGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.14, 14);
  rollerGeo.rotateZ(Math.PI / 2);
  const rollerCount = 170;
  const rollers = new THREE.InstancedMesh(rollerGeo, M.steel, rollerCount);
  rollers.receiveShadow = true;
  rollers.userData.z = [];
  for (let i = 0; i < rollerCount; i++) rollers.userData.z.push(-38 + i * 0.45);
  hall.add(rollers);

  // kolommen, dakliggers, lichtstroken
  const colGeo = new THREE.BoxGeometry(0.45, 10, 0.45);
  const colPos = [];
  for (let z = -35; z <= 35; z += 7) colPos.push([8.5, z], [-8.5, z]);
  const cols = new THREE.InstancedMesh(colGeo, M.columnPaint, colPos.length);
  colPos.forEach(([x, z], i) => cols.setMatrixAt(i, _m1.makeTranslation(x, 5, z)));
  cols.castShadow = cols.receiveShadow = true;
  hall.add(cols);

  const beamGeo = new THREE.BoxGeometry(18, 0.5, 0.3);
  const beams = new THREE.InstancedMesh(beamGeo, M.beam, 11);
  for (let i = 0; i < 11; i++) beams.setMatrixAt(i, _m1.makeTranslation(0, 8.9, -35 + i * 7));
  hall.add(beams);

  const stripGeo = new THREE.BoxGeometry(0.2, 0.05, 2.8);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  stripMat.color.setScalar(5);
  const stripPos = [];
  for (const x of [-5.2, -1.8, 1.8, 5.2]) for (let z = -36; z <= 36; z += 4) stripPos.push([x, z]);
  const strips = new THREE.InstancedMesh(stripGeo, stripMat, stripPos.length);
  stripPos.forEach(([x, z], i) => strips.setMatrixAt(i, _m1.makeTranslation(x, 6.6, z)));
  hall.add(strips);
  const housingGeo = new THREE.BoxGeometry(0.34, 0.1, 2.9);
  const housings = new THREE.InstancedMesh(housingGeo, M.beam, stripPos.length);
  stripPos.forEach(([x, z], i) => housings.setMatrixAt(i, _m1.makeTranslation(x, 6.68, z)));
  hall.add(housings);

  // zijwanden met hoge ramen
  for (const x of [-12, 12]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 12), M.wall);
    wall.position.set(x, 6, 0);
    wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    hall.add(wall);
  }
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  winMat.color.setRGB(0.55, 0.7, 0.9).multiplyScalar(1.6);
  const winGeo = new THREE.PlaneGeometry(4.2, 1.6);
  for (const x of [-11.95, 11.95]) {
    for (let z = -32; z <= 32; z += 8) {
      const win = new THREE.Mesh(winGeo, winMat);
      win.position.set(x, 8.2, z);
      win.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
      hall.add(win);
    }
  }

  // veiligheidshekken (halfhoog)
  const fenceTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(40,44,48,1)";
    ctx.lineWidth = 3;
    for (let i = 0; i <= w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }
  });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  const fenceMat = new THREE.MeshStandardMaterial({ map: fenceTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
  for (const x of [-7.4, 7.4]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), fenceMat);
    fenceTex.repeat.set(9, 1.1);
    panel.position.set(x, 0.62, 0);
    panel.rotation.y = Math.PI / 2;
    panel.castShadow = true;
    hall.add(panel);
    for (let z = -4.5; z <= 4.5; z += 1.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), M.yellow);
      post.position.set(x, 0.6, z);
      post.castShadow = true;
      hall.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 9), M.yellow);
    rail.position.set(x, 1.2, 0);
    hall.add(rail);
  }

  // zwaailampen op de hekken
  const beacons = [];
  for (const [x, z] of [[7.4, -4.5], [-7.4, 4.5]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), M.darkSteel);
    post.position.set(x, 1.45, z);
    hall.add(post);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xff7a00 });
    lampMat.color.multiplyScalar(3);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 16), lampMat);
    lamp.position.set(x, 1.77, z);
    hall.add(lamp);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.15, 16, 1, true, 0, Math.PI), M.robotDark);
    shade.position.copy(lamp.position);
    hall.add(shade);
    beacons.push(shade);
  }

  // bandenrekken en deurrekken
  const tireGeo = new THREE.TorusGeometry(0.3, 0.11, 14, 32);
  for (const [x, z, dz] of [[3.1, 3.15, 0.26], [-3.1, 3.15, 0.26], [4.1, -2.1, -0.26], [-4.1, -2.1, -0.26]]) {
    for (let i = 0; i < 2; i++) {
      const tire = new THREE.Mesh(tireGeo, M.rubber);
      tire.position.set(x, 0.42, z + dz * i);
      tire.rotation.y = Math.PI / 2;
      tire.castShadow = true;
      tire.receiveShadow = true;
      hall.add(tire);
    }
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.8), M.darkSteel);
    rack.position.set(x, 0.1, z + dz * 0.5);
    rack.castShadow = rack.receiveShadow = true;
    hall.add(rack);
  }
  // standaards waarop de wielen klaarstaan
  for (const [x, z] of [[3.1, 2.6], [-3.1, 2.6], [3.55, -0.2], [-3.55, -0.2]]) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.54, 12), M.darkSteel);
    stand.position.set(x, 0.27, z);
    stand.castShadow = true;
    hall.add(stand);
  }
  for (const s of [1, -1]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.08), M.darkSteel);
    frame.position.set(s * 3.3, 0.35, -2.95);
    frame.castShadow = true;
    hall.add(frame);
    for (const dx of [-0.85, 0.85]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), M.yellow);
      leg.position.set(s * 3.3 + dx, 0.35, -2.95);
      leg.castShadow = true;
      hall.add(leg);
    }
  }

  // hangbaan (rail aan het plafond)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 80), M.beam);
  rail.position.set(0, 4.95, 0);
  rail.castShadow = true;
  hall.add(rail);
  for (let z = -35; z <= 35; z += 7) {
    const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.8, 0.06), M.beam);
    hanger.position.set(0, 6.95, z);
    hall.add(hanger);
  }

  // stofdeeltjes in de lucht
  const dustCount = 450;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = rand(-8, 8);
    dustPos[i * 3 + 1] = rand(0.3, 6);
    dustPos[i * 3 + 2] = rand(-10, 10);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xcfd8e0, size: 0.025, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  hall.add(dust);

  return { hall, floorMat, reflector, rollers, beacons, dust, dustBase: dustPos.slice() };
}

// ---------------------------------------------------------------------------
// Hijstakel met laadframes
// ---------------------------------------------------------------------------

function buildHoist(scene, M) {
  const trolley = new THREE.Group();
  scene.add(trolley);
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    trolley.add(m);
    return m;
  };
  add(new RoundedBoxGeometry(0.5, 0.3, 0.9, 2, 0.04), M.yellow, 0, 4.66, 0);
  add(new RoundedBoxGeometry(0.36, 0.3, 0.46, 2, 0.04), M.robotDark, 0, 4.4, 0);
  for (const z of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 14), M.darkSteel, 0, 4.82, z).rotation.z = Math.PI / 2;

  const cableGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const makeCable = () => {
    const c = new THREE.Mesh(cableGeo, M.cable);
    c.castShadow = true;
    scene.add(c);
    return c;
  };

  const box = (w, h, d, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    return m;
  };

  // motor: juk met twee kettingen
  const engineRig = new THREE.Group();
  engineRig.add(box(0.72, 0.06, 0.06, M.yellow));
  scene.add(engineRig);

  // carrosserie: rechthoekig hijsframe
  const bodyRig = new THREE.Group();
  for (const x of [-0.92, 0.92]) {
    const b = box(0.08, 0.1, 2.9, M.yellow);
    b.position.x = x;
    bodyRig.add(b);
  }
  for (const z of [-1.2, 1.2]) {
    const b = box(1.92, 0.1, 0.08, M.yellow);
    b.position.z = z;
    bodyRig.add(b);
  }
  scene.add(bodyRig);

  // ruit: zuignapframe
  const glassRig = new THREE.Group();
  glassRig.add(box(0.08, 0.06, 1.0, M.darkSteel));
  const cross = box(1.1, 0.06, 0.08, M.darkSteel);
  glassRig.add(cross);
  for (const [x, z] of [[0.45, 0.35], [-0.45, 0.35], [0.45, -0.35], [-0.45, -0.35]]) {
    const post = box(0.03, 0.18, 0.03, M.steel);
    post.position.set(x, -0.09, z);
    glassRig.add(post);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.05, 16), M.cup);
    cup.position.set(x, -0.2, z);
    glassRig.add(cup);
  }
  scene.add(glassRig);

  return {
    trolley,
    rigs: { engine: engineRig, body: bodyRig, glass: glassRig },
    mainCables: [makeCable(), makeCable()],
    subCables: [makeCable(), makeCable(), makeCable(), makeCable()],
  };
}

// ---------------------------------------------------------------------------
// Hoofdklasse
// ---------------------------------------------------------------------------

const HOIST_PARK_Z = -16;

const HOIST_JOBS = [
  { kind: "engine", t0: TL.engine, travel: 2.0, lower: 1.6, release: 0.6, leave: 2.0, lift: 2.6 },
  { kind: "body", t0: TL.body, travel: 1.8, lower: 1.6, release: 0.4, leave: 2.0, lift: 2.1 },
  { kind: "glass", t0: TL.glass, travel: 1.4, lower: 1.5, release: 0.4, leave: 2.0, lift: 2.2 },
];

function hoistJobState(job, t, installedZ) {
  const tau = t - job.t0;
  const t1 = job.travel;
  const t2 = t1 + job.lower;
  const t3 = t2 + job.release;
  const t4 = t3 + job.leave;
  if (tau < 0 || tau > t4) return null;
  const st = { trolleyZ: installedZ, lift: 0, raise: 0, sway: 0 };
  if (tau < t1) {
    st.trolleyZ = lerp(HOIST_PARK_Z, installedZ, easeInOut(tau / t1));
    st.lift = job.lift;
  } else if (tau < t2) {
    st.lift = job.lift * (1 - easeInOut((tau - t1) / job.lower));
  } else if (tau < t3) {
    st.raise = 0.7 * easeInOut((tau - t2) / job.release);
  } else {
    const k = easeInOut((tau - t3) / job.leave);
    st.raise = 0.7 + 1.2 * k;
    st.trolleyZ = lerp(installedZ, HOIST_PARK_Z, k);
  }
  st.sway = Math.sin(tau * 3.1) * 0.03 * (1 - seg(tau, 0, t2));
  return st;
}

class CarFactory {
  constructor(container, cb) {
    this.container = container;
    this.cb = cb || {};
    this.ready = false;
    this.pendingPlay = false;
    this.playStart = null;
    this.stepIndex = -1;
    this.doneFired = false;
    this.visible = true;
    this.lastFrame = performance.now();
    this.frameTimes = [];

    const params = new URLSearchParams(window.location.search);
    const forced = params.get("q");
    this.level = forced === "low" ? 2 : forced === "mid" ? 1 : 0;
    this.lockQuality = !!forced;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "factory-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1216);
    this.scene.fog = new THREE.Fog(0x0e1216, 12, 40);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.85;

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 120);
    this.camera.position.set(6.5, 2, 6);

    this.M = makeMaterials();
    this.setupLights();
    this.quality = { reflections: this.level === 0 };
    this.hallParts = buildHall(this.scene, this.M, this.quality);
    this.hoist = buildHoist(this.scene, this.M);
    this.setupRobots();
    this.sparks = new Sparks(this.scene);
    this.setupWeldFx();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 288), 0.22, 0.3, 2.4);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.applyQuality();
    this.resize();
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.resize()).observe(container);
    } else {
      window.addEventListener("resize", () => this.resize());
    }
    if (window.IntersectionObserver) {
      new IntersectionObserver((entries) => {
        this.visible = entries[0].isIntersecting;
      }).observe(container);
    }

    this.loadCar();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  setupLights() {
    const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
    key.position.set(4.5, 9, 5.5);
    key.target.position.set(0, 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -6;
    sc.right = 6;
    sc.top = 6;
    sc.bottom = -6;
    sc.near = 1;
    sc.far = 25;
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    this.scene.add(key, key.target);
    this.keyLight = key;

    this.scene.add(new THREE.HemisphereLight(0xc4d8ff, 0x2a2622, 0.55));
    const rim = new THREE.DirectionalLight(0x9cc4ff, 1.1);
    rim.position.set(-4, 5, -7);
    this.scene.add(rim);

    this.headSpots = [];
    for (const x of [0.62, -0.62]) {
      const spot = new THREE.SpotLight(0xf4f7ff, 0, 16, 0.42, 0.55, 1.4);
      spot.position.set(x, 0.66 + S, 2.2);
      spot.target.position.set(x * 1.6, 0, 8);
      this.scene.add(spot, spot.target);
      this.headSpots.push(spot);
    }
  }

  setupRobots() {
    this.robots = {
      weldL: new Robot(this.scene, this.M, V(2.3, 0, 1.6), 1, "weld"),
      weldR: new Robot(this.scene, this.M, V(-2.3, 0, 1.6), -1, "weld"),
      handL: new Robot(this.scene, this.M, V(2.3, 0, -1.1), 1, "grip"),
      handR: new Robot(this.scene, this.M, V(-2.3, 0, -1.1), -1, "grip"),
    };
    // robots van naburige stations, ver weg in de hal
    this.farRobots = [];
    for (const z of [-13, -20, 13, 20]) {
      for (const s of [1, -1]) {
        const r = new Robot(this.scene, this.M, V(s * 2.3, 0, z), s, s > 0 ? "weld" : "grip");
        r.phase = Math.random() * 6;
        this.farRobots.push(r);
      }
    }
  }

  setupWeldFx() {
    const glowTex = canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(200,225,255,0.55)");
      g.addColorStop(1, "rgba(120,170,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.weldFx = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
      mat.color.setScalar(4);
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(0.45);
      sprite.visible = false;
      this.scene.add(sprite);
      const light = new THREE.PointLight(0xa8d4ff, 0, 6, 2);
      this.scene.add(light);
      this.weldFx.push({ sprite, light });
    }
  }

  applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    const ratios = [Math.min(dpr, 1.75), Math.min(dpr, 1.25), 1];
    this.renderer.setPixelRatio(ratios[this.level]);
    this.bloom.enabled = this.level < 2;
    const size = this.level === 0 ? 2048 : 1024;
    if (this.keyLight.shadow.mapSize.x !== size) {
      this.keyLight.shadow.mapSize.set(size, size);
      if (this.keyLight.shadow.map) {
        this.keyLight.shadow.map.dispose();
        this.keyLight.shadow.map = null;
      }
    }
    const refl = this.hallParts.reflector;
    if (refl) {
      refl.visible = this.level === 0;
      this.hallParts.floorMat.opacity = this.level === 0 ? 0.86 : 1;
      this.hallParts.floorMat.transparent = this.level === 0;
      this.hallParts.floorMat.needsUpdate = true;
    }
    this.resize();
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1.4 ? 46 : 38;
    this.camera.updateProjectionMatrix();
  }

  // -------------------------------------------------------------------------
  // Automodel laden en opdelen in montagegroepen
  // -------------------------------------------------------------------------

  loadCar() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    let data;
    try {
      data = b64ToArrayBuffer(window.CAR_MODEL_B64);
    } catch (e) {
      this.fail(e);
      return;
    }
    loader.parse(
      data,
      "",
      (gltf) => {
        try {
          this.setupCar(gltf.scene);
          this.ready = true;
          if (this.cb.onReady) this.cb.onReady();
          if (this.pendingPlay) this.play();
        } catch (e) {
          this.fail(e);
        }
      },
      (err) => this.fail(err)
    );
  }

  fail(err) {
    if (this.failed) return;
    this.failed = true;
    if (window.console) console.error("Car3D:", err);
    if (this.cb.onError) this.cb.onError(err);
  }

  setupCar(model) {
    const carRoot = new THREE.Group();
    this.scene.add(carRoot);
    carRoot.add(model);
    carRoot.updateMatrixWorld(true);
    this.carRoot = carRoot;

    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    const get = (name) => {
      const o = carRoot.getObjectByName(name);
      if (!o) throw new Error("Onderdeel ontbreekt: " + name);
      return o;
    };
    const group = (names) => {
      const g = new THREE.Group();
      carRoot.add(g);
      for (const n of names) g.attach(get(n));
      return g;
    };

    // GLTFLoader vervangt spaties in namen door "_"
    for (const n of ["Engine", "License_Plate", "InteriorSteeringEmblem"]) {
      const o = model.getObjectByName(n);
      if (o) o.visible = false;
    }

    // lichten: onthoud de oorspronkelijke sterkte en zet ze uit
    this.lightMats = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.name || this.lightMats.some((l) => l.mat === m)) continue;
        if (["Headlight", "Brakelight", "Signallight", "Dashboard"].includes(m.name)) {
          this.lightMats.push({ mat: m, kind: m.name, base: m.emissiveIntensity || 1 });
        }
      }
    });

    // glas eerst loskoppelen, zodat het niet met deuren/carrosserie meekomt
    this.doorWindows = ["BodyDoorLWindow", "BodyDoorRWindow"].map((n) => {
      const obj = get(n);
      carRoot.attach(obj);
      return { obj, home: obj.position.clone() };
    });
    this.windshield = group(["BodyWindshield", "BodyWindshieldGasket", "BodyWindshieldWipersBase", "BodyWindshieldWipers"]);

    // remschijven en remklauwen horen bij het chassis
    const chassisParts = ["Axles", "InteriorFloor", "InteriorMid"];
    for (const w of ["FrontL", "FrontR", "RearL", "RearR"]) chassisParts.push(`Wheel${w}BrakeDisc`, `Wheel${w}BrakePad`);
    group(chassisParts);

    // wielen: draaipunt in het midden van de band
    this.wheels = [];
    const wheelDefs = [
      ["WheelFrontL", 1, "weldL"],
      ["WheelFrontR", -1, "weldR"],
      ["WheelRearL", 1, "handL"],
      ["WheelRearR", -1, "handR"],
    ];
    for (const [name, side, robot] of wheelDefs) {
      const node = get(name);
      const box = new THREE.Box3().setFromObject(node, true);
      const center = box.getCenter(new THREE.Vector3());
      const pivot = new THREE.Group();
      pivot.position.copy(center);
      carRoot.add(pivot);
      carRoot.updateMatrixWorld(true);
      pivot.attach(node);
      const front = name.includes("Front");
      const rz = this.robots[robot].base.z;
      this.wheels.push({
        pivot,
        side,
        robot,
        home: center.clone(),
        rackWorld: front ? V(side * 3.1, 0.92, rz + 1.0) : V(side * 3.55, 0.92, -0.2),
      });
    }

    // deuren
    this.doors = [];
    for (const [name, side] of [["BodyDoorLColor1", 1], ["BodyDoorRColor1", -1]]) {
      const node = get(name);
      carRoot.attach(node);
      const box = new THREE.Box3().setFromObject(node, true);
      const centerWorld = box.getCenter(new THREE.Vector3());
      node.updateMatrixWorld(true);
      const centerLocal = node.worldToLocal(centerWorld.clone());
      this.doors.push({
        obj: node,
        side,
        homePos: node.position.clone(),
        homeQuat: node.quaternion.clone(),
        centerLocal,
        halfThick: box.getSize(new THREE.Vector3()).x * 0.5,
        robot: side > 0 ? "handL" : "handR",
      });
    }

    // carrosserie (hangt aan de takel)
    this.bodyShell = group(["BodyPanelsColor2", "BodyPillars", "BodyRoofPanel", "InteriorCage", "BodyRearPanelsColor1", "BodyHood"]);

    // interieur in golven
    const waves = [
      ["InteriorFloormats"],
      ["InteriorDashSides", "InteriorDashMid", "InteriorSteeringDash", "InteriorSteeringDashColumn", "InteriorSteeringBase"],
      ["InteriorSteeringCylinder", "InteriorSteeringHandleL", "InteriorSteeringHandleR", "InteriorPedalAccel", "InteriorPedalAccelArm", "InteriorPedalBrake", "InteriorPedalBrakeArm"],
      ["InteriorSeatsFrame1", "InteriorSeatsFrame2", "InteriorSeatsColor1", "InteriorSeatsColor2"],
      ["InteriorPillar"],
    ];
    this.interiorWaves = waves.map((names, i) => ({ grp: group(names), side: i % 2 === 0 ? 1 : -1, t0: TL.interior + i * 0.5 }));

    // motor
    this.engine = buildEngine(this.M);
    this.engineHome = V(0, 0.16, 1.93);
    this.engine.position.copy(this.engineHome);
    carRoot.add(this.engine);

    // transportslede
    const skid = new THREE.Group();
    const skidMesh = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y - S, z);
      m.castShadow = m.receiveShadow = true;
      skid.add(m);
    };
    for (const x of [-0.62, 0.62]) skidMesh(new THREE.BoxGeometry(0.13, 0.08, 3.6), this.M.darkSteel, x, 0.24, 0.2);
    for (const z of [-1.2, 0.2, 1.6]) skidMesh(new THREE.BoxGeometry(1.37, 0.06, 0.1), this.M.darkSteel, 0, 0.24, z);
    for (const x of [-0.62, 0.62]) {
      for (const z of [-0.9, 1.2]) {
        skidMesh(new THREE.CylinderGeometry(0.035, 0.045, 0.1, 12), this.M.yellow, x, 0.3, z);
      }
    }
    carRoot.add(skid);

    // afmetingen van het glas voor het zuignapframe
    const wsBox = new THREE.Box3().setFromObject(get("BodyWindshield"), true);
    this.windshieldCenter = wsBox.getCenter(new THREE.Vector3());
    this.roofZ = new THREE.Box3().setFromObject(get("BodyRoofPanel"), true).getCenter(new THREE.Vector3()).z;
    const bodyBox = new THREE.Box3().setFromObject(this.bodyShell, true);
    this.bodyTop = bodyBox.max.y;
  }

  // -------------------------------------------------------------------------
  // Afspelen
  // -------------------------------------------------------------------------

  play() {
    if (!this.ready) {
      this.pendingPlay = true;
      return;
    }
    this.pendingPlay = false;
    this.frozenT = null;
    this.playStart = performance.now() / 1000;
    this.stepIndex = -1;
    this.doneFired = false;
    this.sparks.reset();
  }

  seek(t, freeze) {
    if (!this.ready) return;
    this.playStart = performance.now() / 1000 - t;
    this.frozenT = freeze ? t : null;
    this.stepIndex = -1;
    this.doneFired = t >= DONE.start;
  }

  time() {
    if (this.frozenT != null) return this.frozenT;
    if (this.playStart === null) return 0;
    return performance.now() / 1000 - this.playStart;
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (!this.ready || !this.visible || document.hidden) return;

    const t = this.time();
    this.update(t, dt, now / 1000);
    this.composer.render();
    this.trackPerformance(dt);
  }

  trackPerformance(dt) {
    if (this.lockQuality || this.level >= 2) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.036) {
      this.level++;
      this.applyQuality();
    }
  }

  // -------------------------------------------------------------------------
  // Toestand per tijdstip
  // -------------------------------------------------------------------------

  update(t, dt, clock) {
    this.updateSteps(t);

    // 1. chassis komt aanrijden
    const arrive = easeOut(seg(t, TL.chassis, TL.chassis + 3.0));
    const carZ = lerp(-14, 0, arrive);
    this.carRoot.position.set(0, S, carZ);
    const rollers = this.hallParts.rollers;
    const rollAngle = carZ / 0.05;
    for (let i = 0; i < rollers.count; i++) {
      _m1.makeRotationX(rollAngle).setPosition(0, 0.15, rollers.userData.z[i]);
      rollers.setMatrixAt(i, _m1);
    }
    rollers.instanceMatrix.needsUpdate = true;

    // 2-4. takel: motor, carrosserie, voorruit
    this.updateHoist(t);

    // 3. interieur
    for (const w of this.interiorWaves) {
      const k = seg(t, w.t0, w.t0 + 0.9);
      w.grp.visible = k > 0;
      const e = 1 - easeInOut(k);
      w.grp.position.set(w.side * 0.8 * e, 1.25 * e, 0);
    }

    // 5. deuren, 6. wielen, 7. zijruiten
    this.updateDoors(t);
    this.updateWheels(t);
    for (let i = 0; i < this.doorWindows.length; i++) {
      const w = this.doorWindows[i];
      const k = seg(t, TL.glass + 2.5, TL.glass + 3.7);
      w.obj.visible = t >= TL.glass + 2.5;
      w.obj.position.copy(w.home);
      w.obj.position.y -= 0.34 * (1 - easeInOut(k));
    }

    // robots
    this.updateRobots(t, dt);
    for (const r of this.farRobots) {
      const ph = clock * 0.7 + r.phase;
      _v2.set(r.base.x - r.side * (0.9 + 0.25 * Math.sin(ph)), 1.1 + 0.25 * Math.sin(ph * 1.3), r.base.z + 0.5 * Math.sin(ph * 0.8));
      r.solve(_v2, _v3.set(-r.side, -0.4, 0).normalize());
    }

    // eindscène: lichten aan
    this.updateLights(t);

    // sfeer
    for (const b of this.hallParts.beacons) b.rotation.y = clock * 5;
    const dust = this.hallParts.dust.geometry.attributes.position;
    const base = this.hallParts.dustBase;
    for (let i = 0; i < dust.count; i++) {
      dust.array[i * 3] = base[i * 3] + Math.sin(clock * 0.15 + i) * 0.35;
      dust.array[i * 3 + 1] = base[i * 3 + 1] + Math.sin(clock * 0.11 + i * 1.7) * 0.25;
    }
    dust.needsUpdate = true;

    this.sparks.update(dt);
    this.updateCamera(t, clock);
  }

  updateSteps(t) {
    let idx = -1;
    for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i].start) idx = i;
    if (t >= DONE.start) idx = STEPS.length;
    if (idx !== this.stepIndex && idx >= 0) {
      this.stepIndex = idx;
      if (this.cb.onStep) this.cb.onStep(idx, STEPS.length, idx < STEPS.length ? STEPS[idx] : DONE);
    }
    if (!this.doneFired && t >= DONE.start) {
      this.doneFired = true;
      if (this.cb.onDone) this.cb.onDone();
    }
  }

  updateHoist(t) {
    const H = this.hoist;
    const rootZ = this.carRoot.position.z;
    let active = null;
    let state = null;
    for (const job of HOIST_JOBS) {
      const installedZ =
        job.kind === "engine" ? this.engineHome.z : job.kind === "body" ? this.roofZ : this.windshieldCenter.z;
      const st = hoistJobState(job, t, installedZ + rootZ);
      if (st) {
        active = job;
        state = st;
        break;
      }
    }

    // lasten: positie volgt de takel tot ze zijn geplaatst
    const engineJob = HOIST_JOBS[0];
    const bodyJob = HOIST_JOBS[1];
    const glassJob = HOIST_JOBS[2];

    const loadPose = (job, homeZ, fallbackLift) => {
      if (t < job.t0) return { visible: false, lift: fallbackLift, dz: HOIST_PARK_Z - homeZ, sway: 0 };
      if (active === job) {
        const dz = state.trolleyZ - (homeZ + rootZ);
        const attached = state.raise === 0;
        return { visible: true, lift: state.lift, dz: attached ? dz : 0, sway: attached ? state.sway : 0 };
      }
      return { visible: true, lift: 0, dz: 0, sway: 0 };
    };

    const ep = loadPose(engineJob, this.engineHome.z, engineJob.lift);
    this.engine.visible = ep.visible;
    this.engine.position.set(this.engineHome.x, this.engineHome.y + ep.lift, this.engineHome.z + ep.dz);
    this.engine.rotation.x = ep.sway;

    const bp = loadPose(bodyJob, this.roofZ, bodyJob.lift);
    this.bodyShell.visible = bp.visible;
    this.bodyShell.position.set(0, bp.lift, bp.dz);
    this.bodyShell.rotation.x = bp.sway * 0.4;

    const gp = loadPose(glassJob, this.windshieldCenter.z, glassJob.lift);
    this.windshield.visible = gp.visible;
    this.windshield.position.set(0, gp.lift, gp.dz);

    // takel en kabels
    const trolleyZ = state ? state.trolleyZ : HOIST_PARK_Z;
    H.trolley.position.z = trolleyZ;
    for (const k in H.rigs) H.rigs[k].visible = !!active && active.kind === k;
    for (const c of H.mainCables) c.visible = false;
    for (const c of H.subCables) c.visible = false;
    if (!active) return;

    const rig = H.rigs[active.kind];
    const hookTop = V(0, 4.25, trolleyZ);
    const raise = state.raise;
    const rw = (x, y, z) => V(x, y + S, z + rootZ); // carRoot-lokaal naar wereld

    if (active.kind === "engine") {
      const top = this.engine.position;
      const barY = top.y + 0.62 + 0.36 + raise;
      rig.position.copy(rw(0, barY, top.z));
      rig.rotation.x = raise === 0 ? state.sway : 0;
      placeCable(H.mainCables[0], hookTop, rig.position);
      H.mainCables[0].visible = true;
      if (raise < 0.5) {
        for (let i = 0; i < 2; i++) {
          const x = i ? 0.22 : -0.22;
          const eye = rw(x, top.y + 0.56, top.z - 0.12);
          const bar = rig.position.clone().add(V(x * 1.4, 0, 0));
          placeCable(H.subCables[i], bar, eye);
          H.subCables[i].visible = raise === 0;
        }
      }
    } else if (active.kind === "body") {
      const off = this.bodyShell.position;
      const frameY = this.bodyTop + off.y + 0.55 + raise;
      rig.position.copy(rw(0, frameY, this.roofZ + off.z));
      placeCable(H.mainCables[0], hookTop, rig.position.clone().add(V(0, 0, 0.9)));
      placeCable(H.mainCables[1], hookTop, rig.position.clone().add(V(0, 0, -0.9)));
      H.mainCables[0].visible = H.mainCables[1].visible = true;
      if (raise === 0) {
        let i = 0;
        for (const x of [-0.92, 0.92]) {
          for (const z of [-0.3, 0.3]) {
            const a = rig.position.clone().add(V(x, 0, z));
            const b = rw(x * 0.5, this.bodyTop + off.y - 0.03, this.roofZ + off.z + z);
            placeCable(H.subCables[i], a, b);
            H.subCables[i].visible = true;
            i++;
          }
        }
      }
    } else {
      const off = this.windshield.position;
      const c = this.windshieldCenter;
      const p = rw(c.x, c.y + off.y + 0.24 + raise, c.z + off.z);
      rig.position.copy(p);
      rig.rotation.x = 0.19;
      placeCable(H.mainCables[0], hookTop, V(p.x, p.y + 0.05, p.z));
      H.mainCables[0].visible = true;
    }
  }

  doorPose(d, t, outPos, outAngle) {
    const tau = t - TL.doors;
    const rootZ = this.carRoot.position.z;
    const s = d.side;
    // rek naast de robot (wereldcoördinaten, omgezet naar carRoot)
    const rackPos = V(s * 2.45, d.homePos.y, -2.55 - rootZ);
    const rackAng = -s * Math.PI / 2;
    const openAng = -s * 0.52;
    const pre = V(d.homePos.x + s * 0.55, d.homePos.y + 0.02, d.homePos.z);
    const home = d.homePos;
    let ang;
    if (tau < 0.7) {
      outPos.copy(rackPos);
      ang = rackAng;
    } else if (tau < 2.3) {
      const k = easeInOut((tau - 0.7) / 1.6);
      outPos.copy(rackPos).lerp(pre, k);
      ang = lerp(rackAng, openAng, k);
    } else if (tau < 3.0) {
      const k = easeInOut((tau - 2.3) / 0.7);
      outPos.copy(pre).lerp(home, k);
      ang = openAng;
    } else if (tau < 3.9) {
      outPos.copy(home);
      ang = openAng;
    } else {
      outPos.copy(home);
      const k = seg(tau, 3.9, 4.4);
      ang = openAng * (1 - easeIn(k));
    }
    outAngle.value = ang;
  }

  updateDoors(t) {
    const angle = { value: 0 };
    for (const d of this.doors) {
      this.doorPose(d, t, _v2, angle);
      d.angle = angle.value;
      d.obj.position.copy(_v2);
      _q1.setFromAxisAngle(Y_AXIS, angle.value);
      d.obj.quaternion.copy(_q1).multiply(d.homeQuat);
    }
  }

  doorGrip(d, outP, outD) {
    d.obj.updateWorldMatrix(true, false);
    outP.copy(d.centerLocal).applyMatrix4(d.obj.matrixWorld);
    _q1.setFromAxisAngle(Y_AXIS, d.angle);
    const outward = _v3.set(d.side, 0, 0).applyQuaternion(_q1);
    outP.addScaledVector(outward, d.halfThick * 0.6);
    outD.copy(outward).negate();
  }

  wheelCenter(w, t, out) {
    const tau = t - TL.wheels;
    const rootZ = this.carRoot.position.z;
    const rack = V(w.rackWorld.x, w.rackWorld.y - S, w.rackWorld.z - rootZ);
    const pre = V(w.home.x + w.side * 0.85, w.home.y, w.home.z);
    return keyed([[0.7, rack], [2.1, pre], [2.8, w.home]], tau, out);
  }

  updateWheels(t) {
    const tau = t - TL.wheels;
    for (const w of this.wheels) {
      this.wheelCenter(w, t, w.pivot.position);
      const tighten = tau > 2.85 && tau < 3.45 ? Math.sin((tau - 2.85) * 42) * 0.1 * (1 - seg(tau, 2.85, 3.45)) : 0;
      w.pivot.rotation.x = tighten;
    }
  }

  updateRobots(t, dt) {
    const R = this.robots;
    const P = _v2;
    const D = V(0, 0, 0);
    const fxOn = [false, false];

    // lassen
    const weldPoints = [V(1.03, 0.42, 1.3), V(1.0, 0.86, 0.98), V(0.86, 1.06, 0.45), V(1.06, 0.38, 0.35)];
    const weldRobots = [R.weldL, R.weldR];
    for (let ri = 0; ri < 2; ri++) {
      const r = weldRobots[ri];
      const s = r.side;
      const delay = ri * 0.2;
      const tw = t - TL.weld - delay;
      let pose = null;
      if (tw >= 0 && tw < 4.0) {
        const keys = [[0, r.home.p]];
        const dirs = [];
        let time = 0;
        for (let i = 0; i < weldPoints.length; i++) {
          const wp = weldPoints[i];
          const world = V(wp.x * s, wp.y + S, wp.z + this.carRoot.position.z);
          time += 0.42;
          keys.push([time, world]);
          time += 0.5;
          keys.push([time, world]);
          dirs.push([time - 0.5, time, world]);
        }
        keys.push([time + 0.4, r.home.p]);
        keyed(keys, tw, P);
        D.set(-s, -0.22, 0).normalize();
        const k = seg(tw, 0, 0.42) * (1 - seg(tw, time, time + 0.4));
        D.lerp(r.home.d, 1 - k).normalize();
        for (const [a, b, world] of dirs) {
          if (tw >= a && tw < b) {
            fxOn[ri] = true;
            this.emitWeld(ri, world, s, dt);
          }
        }
        pose = true;
      }
      if (!pose) {
        const wheel = this.wheels.find((w) => w.robot === (ri === 0 ? "weldL" : "weldR"));
        this.wheelRobotPose(r, wheel, t, P, D);
      }
      r.solve(P, D);
    }
    for (let i = 0; i < 2; i++) {
      if (!fxOn[i]) {
        this.weldFx[i].sprite.visible = false;
        this.weldFx[i].light.intensity = 0;
      }
    }

    // deuren en wielen
    const handRobots = [R.handL, R.handR];
    for (let ri = 0; ri < 2; ri++) {
      const r = handRobots[ri];
      const door = this.doors[ri];
      const tau = t - TL.doors;
      if (tau >= 0 && tau < 4.4) {
        const grip = V();
        const gdir = V();
        this.doorGrip(door, grip, gdir);
        if (tau < 0.7) {
          const k = easeInOut(tau / 0.7);
          P.copy(r.home.p).lerp(grip, k);
          D.copy(r.home.d).lerp(gdir, k).normalize();
        } else if (tau < 3.0) {
          P.copy(grip);
          D.copy(gdir);
        } else if (tau < 3.45) {
          const k = easeInOut((tau - 3.0) / 0.45);
          P.copy(grip).addScaledVector(gdir, -0.4 * k);
          D.copy(gdir);
        } else {
          const back = grip.clone().addScaledVector(gdir, -0.4);
          const k = easeInOut(seg(tau, 3.45, 4.2));
          P.copy(back).lerp(r.home.p, k);
          D.copy(gdir).lerp(r.home.d, k).normalize();
        }
      } else {
        const wheel = this.wheels.find((w) => w.robot === (ri === 0 ? "handL" : "handR"));
        this.wheelRobotPose(r, wheel, t, P, D);
      }
      r.solve(P, D);
    }
  }

  wheelRobotPose(r, wheel, t, P, D) {
    const tau = t - TL.wheels;
    if (tau < 0 || tau > 4.4) {
      P.copy(r.home.p);
      D.copy(r.home.d);
      return;
    }
    const center = this.wheelCenter(wheel, t, V());
    const grip = center.clone();
    grip.x += wheel.side * 0.17;
    grip.y += S;
    grip.z += this.carRoot.position.z;
    const gdir = V(-wheel.side, 0, 0);
    if (tau < 0.7) {
      const k = easeInOut(tau / 0.7);
      P.copy(r.home.p).lerp(grip, k);
      D.copy(r.home.d).lerp(gdir, k).normalize();
    } else if (tau < 3.45) {
      P.copy(grip);
      D.copy(gdir);
    } else if (tau < 3.85) {
      P.copy(grip).addScaledVector(gdir, -0.35 * easeInOut((tau - 3.45) / 0.4));
      D.copy(gdir);
    } else {
      const back = grip.clone().addScaledVector(gdir, -0.35);
      const k = easeInOut(seg(tau, 3.85, 4.4));
      P.copy(back).lerp(r.home.p, k);
      D.copy(gdir).lerp(r.home.d, k).normalize();
    }
  }

  emitWeld(i, world, side, dt) {
    const fx = this.weldFx[i];
    fx.sprite.visible = true;
    fx.sprite.position.copy(world).add(V(side * 0.03, 0, 0));
    const flick = 0.6 + Math.random() * 0.8;
    fx.sprite.scale.setScalar(0.3 + Math.random() * 0.25);
    fx.light.position.copy(world).add(V(side * 0.15, 0.05, 0));
    fx.light.intensity = 6 * flick;
    this.sparks.emit(world, V(side, 0.25, 0), Math.max(1, Math.round(dt * 520)));
  }

  updateLights(t) {
    const tau = t - TL.final;
    const on = tau >= 0;
    const start = seg(tau, 0.15, 0.75);
    const flicker = tau > 0.15 && tau < 0.45 ? (Math.sin(tau * 90) > 0 ? 1 : 0.2) : 1;
    const head = on ? start * flicker : 0;
    const blink = tau > 1.0 && tau < 2.6 ? (Math.sin((tau - 1.0) * Math.PI * 3.2) > 0 ? 1 : 0) : 0;
    for (const l of this.lightMats) {
      let k = head;
      if (l.kind === "Signallight") k = blink;
      if (l.kind === "Dashboard") k = on ? seg(tau, 0.4, 1.0) : 0;
      l.mat.emissiveIntensity = Math.min(l.base, 6) * k;
    }
    for (const s of this.headSpots) s.intensity = 30 * head;
  }

  updateCamera(t, clock) {
    // Camerastandpunten kijken tussen de robots door (robots staan op x=±2,3, z=1,6 en z=-1,1).
    const pos = [
      [0, V(1.2, 2.2, 9.5)],
      [3.0, V(2.4, 2.4, 7.2)],
      [4.2, V(1.4, 2.4, 7.4)],
      [5.4, V(1.6, 2.6, 6.6)],
      [6.9, V(1.7, 2.5, 5.2)],
      [8.2, V(-2.0, 3.8, 4.2)],
      [10.3, V(-1.6, 3.4, 3.6)],
      [11.6, V(7.4, 2.9, 0.4)],
      [13.8, V(7.0, 2.4, 0.3)],
      [14.8, V(2.0, 2.1, 6.2)],
      [17.8, V(2.4, 2.0, 5.9)],
      [18.8, V(7.0, 2.8, -0.6)],
      [21.5, V(6.6, 2.3, 0.4)],
      [22.8, V(1.2, 1.25, 5.9)],
      [26.0, V(1.4, 1.15, 5.7)],
      [27.0, V(2.0, 3.0, 6.6)],
      [28.8, V(2.0, 2.8, 6.0)],
      [30.0, V(1.8, 2.4, 5.8)],
      [31.4, V(1.0, 1.6, 7.2)],
    ];
    const tgt = [
      [0, V(0, 0.9, -3.0)],
      [3.0, V(0, 0.7, 0.2)],
      [4.2, V(0, 2.6, -1.5)],
      [5.4, V(0, 2.4, 1.8)],
      [6.9, V(0, 0.8, 1.8)],
      [8.2, V(0, 0.6, 0.3)],
      [10.3, V(0, 0.7, 0.1)],
      [11.6, V(0, 2.0, -0.8)],
      [13.8, V(0, 1.0, 0.1)],
      [14.8, V(1.0, 1.0, 1.0)],
      [17.8, V(0.9, 0.9, 0.7)],
      [18.8, V(1.8, 0.9, -1.4)],
      [21.5, V(0.9, 0.9, 0.1)],
      [22.8, V(0.4, 0.6, 0.5)],
      [26.0, V(0.3, 0.6, 0.3)],
      [27.0, V(0, 2.4, 0.4)],
      [28.8, V(0, 1.6, 0.8)],
      [30.0, V(0, 1.0, 0.8)],
      [31.4, V(0, 0.75, 0.4)],
    ];
    if (this.debugCam) {
      this.camera.position.copy(this.debugCam.pos);
      this.camera.lookAt(this.debugCam.target);
      return;
    }
    keyed(pos, t, this.camera.position);
    const target = keyed(tgt, t, V());
    // na de montage: langzaam om de auto heen draaien
    const orbit = Math.max(0, t - 31.4);
    if (orbit > 0) {
      const ang = Math.atan2(1.0, 6.8) + orbit * 0.1;
      const radius = 6.87;
      const rise = Math.min(1, orbit / 4);
      this.camera.position.set(Math.sin(ang) * radius, 1.6 + 0.5 * rise + 0.3 * Math.sin(orbit * 0.25) * rise, 0.4 + Math.cos(ang) * radius);
    }
    // lichte "camerakraan"-beweging
    this.camera.position.x += Math.sin(clock * 0.37) * 0.06;
    this.camera.position.y += Math.sin(clock * 0.29) * 0.04;
    this.camera.lookAt(target);
  }
}

// ---------------------------------------------------------------------------
// Publieke API voor js/script.js
// ---------------------------------------------------------------------------

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch (e) {
    return false;
  }
}

let instance = null;

window.Car3D = {
  steps: STEPS,
  done: DONE,
  init(container, callbacks) {
    if (instance) return true;
    if (!webglAvailable() || !window.CAR_MODEL_B64) return false;
    try {
      instance = new CarFactory(container, callbacks);
      return true;
    } catch (e) {
      if (window.console) console.error("Car3D:", e);
      return false;
    }
  },
  play() {
    if (instance) instance.play();
  },
  seek(t, freeze) {
    if (instance) instance.seek(t, freeze);
  },
  isReady() {
    return !!(instance && instance.ready);
  },
  debugCamera(pos, target) {
    if (instance) instance.debugCam = pos ? { pos: V(...pos), target: V(...target) } : null;
  },
  quality() {
    return instance ? instance.level : -1;
  },
};
