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
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

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
  tunnel: 32.4,
  end: 43.0,
};

const TUNNEL_Z = 15.1; // waar de auto in de lichttunnel stilstaat

const STEPS = [
  { start: TL.chassis, title: "Chassis", caption: "Het chassis komt binnen op de lopende band" },
  { start: TL.engine, title: "Motor", caption: "Een takel laat de motor in de motorruimte zakken" },
  { start: TL.interior, title: "Interieur", caption: "Vloer, dashboard, stuur en stoelen worden geplaatst" },
  { start: TL.body, title: "Carrosserie", caption: "De carrosserie zakt op het chassis en wordt vastgelast" },
  { start: TL.doors, title: "Deuren", caption: "Robots hangen de deuren erin" },
  { start: TL.wheels, title: "Wielen", caption: "Vier robots monteren tegelijk de wielen" },
  { start: TL.glass, title: "Ruiten", caption: "De voorruit wordt geplaatst en de zijruiten gaan omhoog" },
  { start: TL.final, title: "Testen", caption: "Lichten aan en door de lichttunnel: alles wordt gecontroleerd" },
];
const DONE = { start: 38.6, title: "Klaar!", caption: "Deze auto is getest en klaar voor de weg" };

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

// Grijswaarde-ruis als ruwheidskaart: geeft lak en metaal kleine oneffenheden.
function noiseTexture(size, base, spread, blotches) {
  const tex = canvasTexture(size, size, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = base + (Math.random() - 0.5) * spread;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (let i = 0; i < blotches; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = rand(8, w / 5);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const light = Math.random() < 0.5;
      g.addColorStop(0, light ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.14)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, false);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeMaterials() {
  const std = (color, roughness, metalness, extra) =>
    new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness }, extra || {}));
  const rough = noiseTexture(256, 205, 45, 40);
  const wallTex = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#7f8890";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, "rgba(0,0,0,0.22)");
      g.addColorStop(0.35, "rgba(255,255,255,0.12)");
      g.addColorStop(1, "rgba(0,0,0,0.05)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, h);
    }
  });
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(30, 3);
  return {
    robotOrange: std(0xd9580e, 0.5, 0.22, { roughnessMap: rough }),
    robotGrey: std(0x33383d, 0.6, 0.6, { roughnessMap: rough }),
    robotDark: std(0x1c1f22, 0.62, 0.5, { roughnessMap: rough }),
    primer: std(0xa4aaaf, 0.42, 0.85, { roughnessMap: rough }),
    wallPanel: std(0xffffff, 0.75, 0.35, { map: wallTex }),
    roof: std(0x39424a, 0.85, 0.3),
    duct: std(0xb4bac0, 0.38, 0.9, { roughnessMap: rough }),
    red: std(0xb81d17, 0.45, 0.2),
    agvBody: std(0x59626a, 0.55, 0.5, { roughnessMap: rough }),
    crateBlue: std(0x1f5fa8, 0.6, 0.0),
    tunnelFrame: std(0x23282d, 0.4, 0.8),
    tunnelWall: std(0x23282d, 0.5, 0.6, { side: THREE.DoubleSide }),
    tunnelFloor: std(0x16191c, 0.55, 0.3),
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

let warningTex = null;
function getWarningTexture() {
  if (!warningTex) {
    warningTex = canvasTexture(128, 128, (ctx, w) => {
      ctx.clearRect(0, 0, w, w);
      ctx.beginPath();
      ctx.moveTo(w / 2, 8);
      ctx.lineTo(w - 8, w - 14);
      ctx.lineTo(8, w - 14);
      ctx.closePath();
      ctx.fillStyle = "#f2c200";
      ctx.fill();
      ctx.lineWidth = 9;
      ctx.strokeStyle = "#111";
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.font = "bold 64px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("!", w / 2, w - 30);
    });
  }
  return warningTex;
}

function labelTexture(text) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#111";
    ctx.font = "bold 84px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

function decalMaterial(map) {
  return new THREE.MeshStandardMaterial({
    map,
    transparent: true,
    roughness: 0.5,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    depthWrite: false,
  });
}

class Robot {
  constructor(parent, M, base, side, tool, label) {
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
    const hose2 = new THREE.CatmullRomCurve3([V(-0.16, 0.1, -0.1), V(-0.21, this.L1 * 0.55, -0.18), V(-0.15, this.L1 - 0.12, -0.12)]);
    this.shoulder.add(mesh(new THREE.TubeGeometry(hose2, 20, 0.02, 8), M.hose));
    const warnMat = decalMaterial(getWarningTexture());
    for (const sx of [1, -1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), warnMat);
      w.position.set(sx * 0.137, this.L1 * 0.68, 0.02);
      w.rotation.y = sx * Math.PI / 2;
      this.shoulder.add(w);
    }
    if (label) {
      const lblMat = decalMaterial(labelTexture(label));
      for (const sx of [1, -1]) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), lblMat);
        l.position.set(sx * 0.293, 0.32, 0.05);
        l.rotation.y = sx * Math.PI / 2;
        this.j1.add(l);
      }
    }

    this.elbow = new THREE.Group();
    this.elbow.position.y = this.L1;
    this.shoulder.add(this.elbow);
    const elbowJoint = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.46, 24), M.robotGrey);
    elbowJoint.rotation.z = Math.PI / 2;
    this.elbow.add(elbowJoint);
    this.elbow.add(mesh(new RoundedBoxGeometry(0.34, 0.34, 0.36, 3, 0.07), M.robotOrange, 0, -0.02, -0.16));
    this.elbow.add(mesh(new RoundedBoxGeometry(0.21, this.L2, 0.23, 3, 0.06), M.robotOrange, 0, this.L2 / 2, 0));
    this.elbow.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 18), M.robotGrey, 0, 0.1, -0.2));
    const hose3 = new THREE.CatmullRomCurve3([V(0.1, 0.05, -0.16), V(0.16, this.L2 * 0.5, -0.12), V(0.08, this.L2 - 0.05, -0.02)]);
    this.elbow.add(mesh(new THREE.TubeGeometry(hose3, 20, 0.022, 8), M.hose));

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
// Lasrook: zachte wolkjes die opstijgen en vervagen
// ---------------------------------------------------------------------------

class Smoke {
  constructor(parent, max = 48) {
    const tex = canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(215,220,225,0.9)");
      g.addColorStop(0.5, "rgba(190,196,202,0.35)");
      g.addColorStop(1, "rgba(180,186,192,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    this.group = new THREE.Group();
    parent.add(this.group);
    this.items = [];
    this.next = 0;
    for (let i = 0; i < max; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.visible = false;
      this.group.add(sprite);
      this.items.push({ sprite, age: 0, life: 1, alive: false, vel: V(0, 0, 0) });
    }
  }

  emit(pos) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.alive = true;
    it.age = 0;
    it.life = rand(1.8, 3.2);
    it.sprite.position.set(pos.x + rand(-0.04, 0.04), pos.y + rand(0, 0.05), pos.z + rand(-0.04, 0.04));
    it.vel.set(rand(-0.06, 0.06), rand(0.22, 0.42), rand(-0.06, 0.06));
    it.sprite.visible = true;
  }

  update(dt) {
    for (const it of this.items) {
      if (!it.alive) continue;
      it.age += dt;
      const k = it.age / it.life;
      if (k >= 1) {
        it.alive = false;
        it.sprite.visible = false;
        continue;
      }
      it.sprite.position.addScaledVector(it.vel, dt);
      it.sprite.scale.setScalar(0.18 + k * 1.0);
      it.sprite.material.opacity = 0.26 * Math.sin(Math.PI * k);
    }
  }

  reset() {
    for (const it of this.items) {
      it.alive = false;
      it.sprite.visible = false;
    }
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
  for (let i = 0; i < 11; i++) beams.setMatrixAt(i, _m1.makeTranslation(0, 8.55, -35 + i * 7));
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
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x4d5b55, roughness: 0.8, metalness: 0.1 });
  for (const x of [-12, 12]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 11), M.wallPanel);
    wall.position.set(x, 5.5, 0);
    wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.receiveShadow = true;
    hall.add(wall);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(90, 2.2), bandMat);
    band.position.set(x * 0.998, 1.1, 0);
    band.rotation.y = wall.rotation.y;
    hall.add(band);
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

  return { hall, floorMat, reflector, rollers, beacons, dust, dustBase: dustPos.slice(), hatchMat, colPos };
}

// ---------------------------------------------------------------------------
// Dak, installaties, borden, AGV's en de lichttunnel
// ---------------------------------------------------------------------------

function textPanel(w, h, draw) {
  const tex = canvasTexture(w, h, draw);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: true });
  return { tex, mat };
}

function buildHallExtras(scene, M, hallParts) {
  const hall = hallParts.hall;
  const inst = (geo, mat, list, shadow) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    if (shadow) im.castShadow = true;
    hall.add(im);
    return im;
  };
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const TR = (x, y, z, rx, ry, rz) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1));

  // dak met vakwerkspanten en gordingen
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(26, 90), M.roof);
  roof.rotation.x = Math.PI / 2;
  roof.position.y = 10.6;
  hall.add(roof);
  const trussZ = [];
  for (let i = 0; i < 11; i++) trussZ.push(-35 + i * 7);
  inst(new THREE.BoxGeometry(18, 0.3, 0.25), M.beam, trussZ.map((z) => T(0, 10.1, z)));
  const diag = [];
  for (const z of trussZ) {
    for (let k = 0; k < 12; k++) diag.push(TR(-9 + k * 1.5 + 0.75, 9.33, z, 0, 0, (k % 2 ? 1 : -1) * Math.PI / 4));
  }
  inst(new THREE.BoxGeometry(0.12, 2.12, 0.12), M.beam, diag);
  const purlins = [];
  for (let x = -9; x <= 9; x += 2.25) purlins.push(T(x, 10.35, 0));
  inst(new THREE.BoxGeometry(0.12, 0.18, 80), M.beam, purlins);

  // lichtstraten in het dak (daglicht)
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  skyMat.color.setRGB(0.78, 0.86, 1.0).multiplyScalar(1.7);
  const sky = [];
  for (const x of [-3.4, 3.4]) for (let i = 0; i < 10; i++) sky.push(TR(x, 10.55, -31.5 + i * 7, Math.PI / 2, 0, 0));
  inst(new THREE.PlaneGeometry(2.4, 5.0), skyMat, sky);

  // ventilatiekokers en kabelgoten
  const ductGeo = new THREE.CylinderGeometry(0.45, 0.45, 80, 28);
  ductGeo.rotateX(Math.PI / 2);
  inst(ductGeo, M.duct, [T(-4.6, 7.9, 0), T(4.6, 7.9, 0)]);
  const ringGeo = new THREE.TorusGeometry(0.47, 0.035, 8, 28);
  const rings = [];
  for (const x of [-4.6, 4.6]) for (let z = -36; z <= 36; z += 4) rings.push(T(x, 7.9, z));
  inst(ringGeo, M.darkSteel, rings);
  const hangers = [];
  for (const x of [-4.6, 4.6, -2.9, 2.9]) for (let z = -35; z <= 35; z += 7) hangers.push(T(x, x > 4 || x < -4 ? 9.2 : 8.4, z + 3.5));
  inst(new THREE.BoxGeometry(0.04, 2.4, 0.04), M.darkSteel, hangers);
  inst(new THREE.BoxGeometry(0.5, 0.08, 80), M.darkSteel, [T(-2.9, 6.3, 0), T(2.9, 6.3, 0)]);
  const cableGeo = new THREE.CylinderGeometry(0.025, 0.025, 80, 6);
  cableGeo.rotateX(Math.PI / 2);
  const cables = [];
  for (const x of [-2.9, 2.9]) for (const dx of [-0.15, -0.05, 0.06, 0.16]) cables.push(T(x + dx, 6.37, 0));
  inst(cableGeo, M.hose, cables);

  // kolomvoeten met geel-zwarte markering, brandblussers
  inst(new THREE.BoxGeometry(0.52, 1.4, 0.52), hallParts.hatchMat, hallParts.colPos.map(([x, z]) => T(x, 0.7, z)), true);
  const ext = [];
  const extTop = [];
  hallParts.colPos.forEach(([x, z], i) => {
    if (i % 4 !== 0) return;
    const sx = x > 0 ? -0.36 : 0.36;
    ext.push(T(x + sx, 1.0, z));
    extTop.push(T(x + sx, 1.3, z));
  });
  inst(new THREE.CylinderGeometry(0.09, 0.09, 0.52, 16), M.red, ext, true);
  inst(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 10), M.robotDark, extTop);

  // nooduitgangen
  const exit = textPanel(256, 96, (ctx, w, h) => {
    ctx.fillStyle = "#0f8a3c";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("NOODUITGANG", w / 2, h / 2);
  });
  exit.mat.color.setScalar(1.8);
  for (const [x, z] of [[-11.95, -10], [11.95, -24], [-11.95, 18], [11.95, 6]]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.38), exit.mat);
    sign.position.set(x, 3.0, z);
    sign.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    hall.add(sign);
  }

  // veiligheidsbord aan de wand
  const safety = textPanel(512, 256, (ctx, w, h) => {
    ctx.fillStyle = "#f4f4f0";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#0f7a38";
    ctx.fillRect(0, 0, w, 70);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("VEILIGHEID VOOROP", w / 2, 50);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 92px Arial, sans-serif";
    ctx.fillText("128", w / 2, 170);
    ctx.font = "30px Arial, sans-serif";
    ctx.fillText("dagen zonder ongeval", w / 2, 222);
  });
  const safetySign = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), new THREE.MeshStandardMaterial({ map: safety.tex, roughness: 0.6 }));
  safetySign.position.set(-11.9, 4.4, -4);
  safetySign.rotation.y = Math.PI / 2;
  hall.add(safetySign);

  // productiebord (andon) boven de lijn
  const andonCanvas = document.createElement("canvas");
  andonCanvas.width = 1024;
  andonCanvas.height = 256;
  const andonTex = new THREE.CanvasTexture(andonCanvas);
  andonTex.colorSpace = THREE.SRGBColorSpace;
  const andonMat = new THREE.MeshBasicMaterial({ map: andonTex });
  andonMat.color.setScalar(1.6);
  const andon = new THREE.Group();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.0), andonMat);
  andon.add(screen);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.16, 1.14, 0.12), M.robotDark);
  frame.position.z = -0.07;
  andon.add(frame);
  for (const x of [-1.6, 1.6]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 4.6, 6), M.cable);
    c.position.set(x, 2.85, -0.07);
    andon.add(c);
  }
  andon.position.set(0, 5.1, -7.2);
  hall.add(andon);
  const drawAndon = (made) => {
    const ctx = andonCanvas.getContext("2d");
    ctx.fillStyle = "#050607";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.font = "bold 46px 'Courier New', monospace";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffb000";
    ctx.fillText("LIJN 3  ·  EINDMONTAGE", 36, 58);
    ctx.fillStyle = "#39e46f";
    ctx.fillText("\u25CF OK", 830, 58);
    ctx.font = "bold 64px 'Courier New', monospace";
    ctx.fillStyle = "#e8eef2";
    ctx.fillText("TAKT 58 s", 36, 172);
    ctx.fillText(`GEBOUWD ${made} / 240`, 440, 172);
    andonTex.needsUpdate = true;
  };
  drawAndon(214);

  // AGV's (zelfrijdende transportkarren)
  const agvs = [];
  const makeAgv = (cargo) => {
    const g = new THREE.Group();
    const m = (geo, mat, x, y, z) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.set(x, y, z);
      o.castShadow = o.receiveShadow = true;
      g.add(o);
      return o;
    };
    m(new RoundedBoxGeometry(0.85, 0.3, 1.35, 2, 0.05), M.agvBody, 0, 0.2, 0);
    m(new THREE.BoxGeometry(0.87, 0.07, 0.06), M.yellow, 0, 0.16, 0.69);
    m(new THREE.BoxGeometry(0.87, 0.07, 0.06), M.yellow, 0, 0.16, -0.69);
    for (const [x, z] of [[0.36, 0.5], [-0.36, 0.5], [0.36, -0.5], [-0.36, -0.5]]) {
      m(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 12), M.rubber, x, 0.06, z).rotation.z = Math.PI / 2;
    }
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x3a8bff });
    beaconMat.color.multiplyScalar(3);
    m(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 12), beaconMat, 0.32, 0.39, 0.55);
    if (cargo === "crates") {
      m(new RoundedBoxGeometry(0.6, 0.32, 0.5, 2, 0.02), M.crateBlue, 0, 0.51, 0.3);
      m(new RoundedBoxGeometry(0.6, 0.32, 0.5, 2, 0.02), M.crateBlue, 0, 0.51, -0.3);
      m(new RoundedBoxGeometry(0.6, 0.32, 0.5, 2, 0.02), M.crateBlue, 0, 0.83, 0.3);
    } else {
      for (let i = 0; i < 2; i++) {
        const tire = m(new THREE.TorusGeometry(0.28, 0.1, 12, 28), M.rubber, 0, 0.45 + i * 0.2, 0);
        tire.rotation.x = Math.PI / 2;
      }
    }
    hall.add(g);
    return g;
  };
  agvs.push({ obj: makeAgv("crates"), x: -5.9, z0: -22, z1: 14, period: 34, offset: 0 });
  agvs.push({ obj: makeAgv("tires"), x: 5.9, z0: -32, z1: -9, period: 26, offset: 9 });

  // lichttunnel voor de eindcontrole
  const tunnel = new THREE.Group();
  hall.add(tunnel);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lightMat.color.setScalar(2.7);
  const z0 = TUNNEL_Z - 3.1;
  for (let i = 0; i < 6; i++) {
    const z = z0 + i * 1.25;
    for (const x of [-1.95, 1.95]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.45, 0.07), lightMat);
      bar.position.set(x, 1.3, z);
      tunnel.add(bar);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.16), M.tunnelFrame);
      back.position.set(x + Math.sign(x) * 0.09, 1.3, z);
      back.castShadow = true;
      tunnel.add(back);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.97, 0.07, 0.07), lightMat);
    top.position.set(0, 2.55, z);
    tunnel.add(top);
    const topBack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.16), M.tunnelFrame);
    topBack.position.set(0, 2.65, z);
    tunnel.add(topBack);
  }
  const tLen = 7.6;
  for (const x of [-2.35, 2.35]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(tLen, 2.9), M.tunnelWall);
    wall.position.set(x, 1.45, TUNNEL_Z + 0.04);
    wall.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.receiveShadow = true;
    tunnel.add(wall);
  }
  const tFloor = new THREE.Mesh(new THREE.PlaneGeometry(4.6, tLen), M.tunnelFloor);
  tFloor.rotation.x = -Math.PI / 2;
  tFloor.position.set(0, 0.006, TUNNEL_Z + 0.04);
  tFloor.receiveShadow = true;
  tunnel.add(tFloor);
  const tSign = textPanel(512, 128, (ctx, w, h) => {
    ctx.fillStyle = "#101316";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2b705";
    ctx.fillRect(0, h - 12, w, 12);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 58px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EINDCONTROLE", w / 2, h / 2 - 4);
  });
  for (const [z, ry] of [[TUNNEL_Z - tLen / 2 - 0.05, Math.PI], [TUNNEL_Z + tLen / 2 + 0.1, 0]]) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), tSign.mat);
    sign.position.set(0, 3.25, z);
    sign.rotation.y = ry;
    tunnel.add(sign);
  }

  const rectLights = [];
  const addRect = (w, h, pos, look, intensity) => {
    const l = new THREE.RectAreaLight(0xf4f8ff, intensity, w, h);
    l.position.copy(pos);
    l.lookAt(look);
    scene.add(l);
    rectLights.push(l);
  };
  addRect(3.6, 1.2, V(0, 2.5, TUNNEL_Z - 1.3), V(0, 0, TUNNEL_Z - 1.3), 6);
  addRect(3.6, 1.2, V(0, 2.5, TUNNEL_Z + 1.3), V(0, 0, TUNNEL_Z + 1.3), 6);
  addRect(4.0, 1.8, V(1.9, 1.3, TUNNEL_Z), V(0, 1.3, TUNNEL_Z), 4);
  addRect(4.0, 1.8, V(-1.9, 1.3, TUNNEL_Z), V(0, 1.3, TUNNEL_Z), 4);

  return { agvs, drawAndon, rectLights };
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
const BIW_Z = -16; // kale carrosserie op het lasstation stroomopwaarts

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
    this.warmup = 90;
    this.pausedAt = null;

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
    this.scene.background = new THREE.Color(0x2b333a);
    this.scene.fog = new THREE.Fog(0x2b333a, 14, 58);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    RectAreaLightUniformsLib.init();

    this.camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 120);
    this.camera.position.set(6.5, 2, 6);

    this.M = makeMaterials();
    this.setupLights();
    this.quality = { reflections: this.level === 0 };
    this.hallParts = buildHall(this.scene, this.M, this.quality);
    this.extras = buildHallExtras(this.scene, this.M, this.hallParts);
    this.produced = 214;
    this.hoist = buildHoist(this.scene, this.M);
    this.setupRobots();
    this.sparks = new Sparks(this.scene, 900);
    this.smoke = new Smoke(this.scene);
    this.setupWeldFx();

    // MSAA-rendertarget: zonder dit verliest de nabewerking de gladde randen
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.samples = 4;
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // ambient occlusion (zachte schaduw in hoeken en onder de auto), op halve resolutie
    this.gtao = new GTAOPass(this.scene, this.camera, 512, 288, undefined, {
      radius: 0.6,
      distanceExponent: 1.6,
      thickness: 1.4,
      scale: 1.15,
      samples: 12,
      distanceFallOff: 1.0,
      screenSpaceRadius: false,
    });
    const gtaoSetSize = this.gtao.setSize.bind(this.gtao);
    this.gtao.setSize = (w, h) => gtaoSetSize(Math.max(1, Math.round(w * 0.5)), Math.max(1, Math.round(h * 0.5)));
    const hideForAo = this.gtao._overrideVisibility.bind(this.gtao);
    this.gtao._overrideVisibility = () => {
      hideForAo();
      const extra = [this.hallParts.reflector, ...this.weldFx.map((f) => f.sprite), this.smoke.group];
      for (const o of extra) {
        if (o && o.visible) {
          o.visible = false;
          this.gtao._visibilityCache.push(o);
        }
      }
    };
    this.composer.addPass(this.gtao);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 288), 0.22, 0.3, 2.4);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.fade = document.createElement("div");
    this.fade.className = "factory-fade";
    container.appendChild(this.fade);

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

    this.scene.add(new THREE.HemisphereLight(0xc4d8ff, 0x3a3530, 0.85));
    // lichtbundel van de werkplekverlichting boven het station
    const pool = new THREE.SpotLight(0xfff3e4, 70, 16, 0.6, 0.85, 1.3);
    pool.position.set(0, 7.4, 0.3);
    pool.target.position.set(0, 0, 0.3);
    this.scene.add(pool, pool.target);
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
      weldL: new Robot(this.scene, this.M, V(2.3, 0, 1.6), 1, "weld", "R01"),
      weldR: new Robot(this.scene, this.M, V(-2.3, 0, 1.6), -1, "weld", "R02"),
      handL: new Robot(this.scene, this.M, V(2.3, 0, -1.1), 1, "grip", "R03"),
      handR: new Robot(this.scene, this.M, V(-2.3, 0, -1.1), -1, "grip", "R04"),
    };
    // lasstation stroomopwaarts: robots lassen daar de kale carrosserie van de volgende auto
    this.farRobots = [];
    const farDefs = [
      [1, -14.4, "weld"],
      [-1, -14.4, "weld"],
      [1, -17.6, "weld"],
      [-1, -17.6, "weld"],
      [1, -26, "grip"],
      [-1, -26, "grip"],
    ];
    // [x, y, z] op de carrosserie (linkerkant, carRoot-coördinaten)
    const front = [[1.03, 0.42, 1.3], [1.0, 0.86, 0.98], [0.86, 1.06, 0.45], [1.06, 0.38, 0.35]];
    const rear = [[1.0, 0.9, -0.8], [1.04, 0.4, -1.2], [0.88, 1.0, -0.35], [1.06, 0.42, -0.6]];
    for (const [side, z, tool] of farDefs) {
      const r = new Robot(this.scene, this.M, V(side * 2.3, 0, z), side, tool);
      r.phase = Math.random() * 6;
      if (tool === "weld") {
        const pts = z > -16 ? front : rear;
        r.weldPts = pts.map(([x, y, pz]) => V(side * x, y + S, BIW_Z + pz));
      }
      this.farRobots.push(r);
    }

    // signaallampen (groen = klaar, oranje knippert = robot beweegt)
    this.stackLights = [];
    for (const key of Object.keys(this.robots)) {
      const r = this.robots[key];
      const x = r.base.x + r.side * 0.62;
      const z = r.base.z + (r.base.z > 0 ? 0.62 : -0.62);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), this.M.darkSteel);
      pole.position.set(x, 0.85, z);
      this.scene.add(pole);
      const lamp = (color, y) => {
        const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.3 });
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.075, 14), mat);
        m.position.set(x, y, z);
        this.scene.add(m);
        return mat;
      };
      const light = { robot: key, green: lamp(0x22cc55, 1.72), amber: lamp(0xffa000, 1.8), red: lamp(0xdd2222, 1.88) };
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 14), this.M.robotDark);
      cap.position.set(x, 1.935, z);
      this.scene.add(cap);
      this.stackLights.push(light);
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
    const ratios = [Math.min(dpr, 1.5), Math.min(dpr, 1.15), 0.85];
    this.renderer.setPixelRatio(ratios[this.level]);
    this.bloom.enabled = this.level < 2;
    this.gtao.enabled = this.level === 0;
    const samples = [4, 2, 0][this.level];
    if (samples !== this.samples) {
      this.samples = samples;
      for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) {
        rt.samples = samples;
        rt.dispose();
      }
    }
    for (const l of this.extras.rectLights) l.visible = this.level === 0;
    if (this.biw) this.biw.visible = this.level === 0;
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
          this.warmupRender();
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

  // Eén keer alles tekenen terwijl het laadscherm nog zichtbaar is. Zo worden alle
  // shaders (ook van onderdelen die pas later verschijnen, schaduwen en nabewerking)
  // nu al voorbereid, en hapert de animatie later niet als er iets in beeld komt.
  warmupRender() {
    this.update(0, 0.016, 0);
    const forced = [];
    this.scene.traverse((o) => {
      if (o.visible || o.isLight) return;
      if (o === this.biw && this.level > 0) return;
      o.visible = true;
      forced.push(o);
    });
    this.composer.render();
    for (const o of forced) o.visible = false;
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
    this.skid = skid;

    // afmetingen van het glas voor het zuignapframe
    const wsBox = new THREE.Box3().setFromObject(get("BodyWindshield"), true);
    this.windshieldCenter = wsBox.getCenter(new THREE.Vector3());
    this.roofZ = new THREE.Box3().setFromObject(get("BodyRoofPanel"), true).getCenter(new THREE.Vector3()).z;
    const bodyBox = new THREE.Box3().setFromObject(this.bodyShell, true);
    this.bodyTop = bodyBox.max.y;

    // kale stalen carrosserie van de volgende auto, op het lasstation stroomopwaarts
    const biw = new THREE.Group();
    const hideMats = ["Glass", "Brakelight", "Signallight", "Headlight", "Mirror"];
    const primerize = (src) => {
      const c = src.clone(true);
      c.traverse((o) => {
        if (!o.isMesh) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && hideMats.includes(m.name)) o.visible = false;
        else o.material = this.M.primer;
        o.castShadow = o.receiveShadow = true;
      });
      biw.add(c);
    };
    primerize(this.bodyShell);
    for (const d of this.doors) primerize(d.obj);
    primerize(get("BodyUnderside"));
    biw.add(skid.clone(true));
    biw.position.set(0, S, BIW_Z);
    this.scene.add(biw);
    this.biw = biw;
    this.biw.visible = this.level === 0;
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
    this.smoke.reset();
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
    if (!this.ready) return;

    // buiten beeld: klok stilzetten, zodat de animatie verdergaat waar hij was
    if (!this.visible || document.hidden) {
      if (this.pausedAt == null) this.pausedAt = now / 1000;
      return;
    }
    if (this.pausedAt != null) {
      if (this.playStart !== null) this.playStart += now / 1000 - this.pausedAt;
      this.pausedAt = null;
    }

    let t = this.time();
    if (this.playStart !== null && this.frozenT == null && t >= TL.end) {
      this.play();
      t = 0;
    }
    const fadeIn = this.playStart === null ? 1 : 1 - seg(t, 0, 0.8);
    const fadeOut = seg(t, TL.end - 0.7, TL.end);
    this.fade.style.opacity = Math.max(fadeIn, fadeOut).toFixed(3);

    this.update(t, dt, now / 1000);
    this.composer.render();
    this.trackPerformance(dt);
  }

  trackPerformance(dt) {
    if (this.lockQuality || this.level >= 2) return;
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.026) {
      this.level++;
      this.applyQuality();
      this.warmup = 45;
    }
  }

  // -------------------------------------------------------------------------
  // Toestand per tijdstip
  // -------------------------------------------------------------------------

  update(t, dt, clock) {
    this.updateSteps(t);

    // 1. chassis komt aanrijden
    const arrive = easeOut(seg(t, TL.chassis, TL.chassis + 3.0));
    const toTunnel = easeInOut(seg(t, TL.tunnel, TL.tunnel + 5.0));
    const carZ = lerp(-14, 0, arrive) + TUNNEL_Z * toTunnel;
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
    this.updateFarRobots(dt, clock);
    this.updateStackLights(t, clock);

    // zelfrijdende karren in de gangpaden
    for (const a of this.extras.agvs) {
      const ph = ((clock + a.offset) / a.period) % 2;
      let z;
      let rot;
      if (ph < 1) {
        z = lerp(a.z0, a.z1, easeInOut(ph));
        rot = Math.PI * seg(ph, 0.93, 1.0);
      } else {
        z = lerp(a.z1, a.z0, easeInOut(ph - 1));
        rot = Math.PI + Math.PI * seg(ph, 1.93, 2.0);
      }
      a.obj.position.set(a.x, 0, z);
      a.obj.rotation.y = rot;
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
    this.smoke.update(dt);
    if (this.photoMode) this.applyPhotoPose();
    this.updateCamera(t, clock);
  }

  // -------------------------------------------------------------------------
  // Fotomodus: losse beelden voor de website (niet gebruikt tijdens de animatie)
  // -------------------------------------------------------------------------

  photo(mode) {
    if (this.photoSaved) {
      for (const [o, v] of this.photoSaved) o.visible = v;
      this.photoSaved = null;
      this.scene.fog = this.savedFog;
      this.scene.background.set(0x2b333a);
      this.studio.visible = false;
      this.skid.visible = true;
      this.setWireframe(false);
    }
    this.photoMode = mode || null;
    if (this.bloom) this.bloom.enabled = !mode && this.level < 2;
    if (!mode) return;
    if (!this.studio) {
      this.studio = new THREE.Group();
      this.studioFloorMat = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.4, metalness: 0.05 });
      const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), this.studioFloorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.studio.add(floor);
      this.studioGrid = new THREE.GridHelper(40, 80, 0x5aa6e0, 0x24527c);
      this.studioGrid.position.y = 0.003;
      this.studio.add(this.studioGrid);
      this.scene.add(this.studio);
    }
    this.photoSaved = [];
    for (const o of this.scene.children) {
      if (o === this.carRoot || o === this.studio || o.isLight) continue;
      this.photoSaved.push([o, o.visible]);
      o.visible = false;
    }
    this.savedFog = this.scene.fog;
    this.scene.fog = null;
    for (const l of this.lightMats) l.mat.emissiveIntensity = 0;
    this.studio.visible = true;
    this.skid.visible = false;
    if (mode === "design") {
      this.scene.background.set(0x0b1d30);
      this.studioFloorMat.color.set(0x0e2640);
      this.studioGrid.visible = true;
      this.setWireframe(true);
    } else {
      this.scene.background.set(0xd5dade);
      this.studioFloorMat.color.set(0xc9ced3);
      this.studioGrid.visible = false;
    }
  }

  applyPhotoPose() {
    this.carRoot.position.set(0, 0, 0);
    for (const l of this.lightMats) l.mat.emissiveIntensity = 0;
    for (const s of this.headSpots) s.intensity = 0;
    for (const k in this.hoist.rigs) this.hoist.rigs[k].visible = false;
    for (const c of this.hoist.mainCables.concat(this.hoist.subCables)) c.visible = false;
    if (this.photoMode !== "exploded") return;
    this.bodyShell.position.y += 1.3;
    this.windshield.position.y += 1.95;
    for (const d of this.doors) d.obj.position.x += d.side * 1.05;
    for (const w of this.doorWindows) w.obj.visible = false;
    for (const w of this.wheels) w.pivot.position.x += w.side * 1.0;
    for (const w of this.interiorWaves) w.grp.position.y += 0.55;
    this.engine.position.y += 0.35;
    this.engine.position.z += 0.9;
  }

  setWireframe(on) {
    const renderer = this.renderer;
    renderer.localClippingEnabled = on;
    if (!this.wire) {
      if (!on) return;
      const keepRear = [new THREE.Plane(V(0, 0, -1), 0.3)];
      const keepFront = [new THREE.Plane(V(0, 0, 1), -0.3)];
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x5fb4f0,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        clippingPlanes: keepFront,
      });
      this.wire = { meshes: [], mats: new Set(), keepRear };
      this.carRoot.traverse((o) => {
        if (!o.isMesh || o.userData.isWire) return;
        let p = o;
        while (p && p !== this.skid) p = p.parent;
        if (p === this.skid) return;
        const w = new THREE.Mesh(o.geometry, wireMat);
        w.userData.isWire = true;
        o.add(w);
        this.wire.meshes.push(w);
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => this.wire.mats.add(m));
      });
    }
    for (const w of this.wire.meshes) w.visible = on;
    for (const m of this.wire.mats) {
      m.clippingPlanes = on ? this.wire.keepRear : null;
      m.needsUpdate = true;
    }
  }

  photoAnchors(names) {
    const out = {};
    const pt = (obj) => new THREE.Box3().setFromObject(obj, true).getCenter(V());
    const src = {
      body: () => pt(this.bodyShell).add(V(0, 0.35, 0)),
      glass: () => pt(this.windshield),
      door: () => pt(this.doors[0].obj),
      wheel: () => pt(this.wheels[0].pivot),
      seats: () => pt(this.interiorWaves[3].grp),
      engine: () => pt(this.engine),
      dash: () => pt(this.interiorWaves[1].grp),
    };
    for (const n of names) {
      const p = src[n]().project(this.camera);
      out[n] = [((p.x + 1) / 2) * 100, ((1 - p.y) / 2) * 100];
    }
    return out;
  }

  updateFarRobots(dt, clock) {
    const weldOn = this.biw && this.biw.visible;
    for (const r of this.farRobots) {
      if (!r.weldPts) {
        const ph = clock * 0.7 + r.phase;
        _v2.set(r.base.x - r.side * (0.9 + 0.25 * Math.sin(ph)), 1.1 + 0.25 * Math.sin(ph * 1.3), r.base.z + 0.5 * Math.sin(ph * 0.8));
        r.solve(_v2, _v3.set(-r.side, -0.4, 0).normalize());
        continue;
      }
      const n = r.weldPts.length;
      const phase = (clock + r.phase) / 1.15;
      const i = Math.floor(phase) % n;
      const frac = phase - Math.floor(phase);
      const cur = r.weldPts[i];
      const prev = r.weldPts[(i + n - 1) % n];
      _v2.copy(prev).lerp(cur, easeInOut(Math.min(1, frac / 0.45)));
      r.solve(_v2, _v3.set(-r.side, -0.22, 0).normalize());
      if (weldOn && frac > 0.5) {
        this.sparks.emit(cur, _v3.set(r.side, 0.25, 0), Math.max(1, Math.round(dt * 150)));
        if (Math.random() < dt * 2.5) this.smoke.emit(cur);
      }
    }
  }

  updateStackLights(t, clock) {
    const inWindow = (a, b) => t >= a && t < b;
    const active = {
      weldL: inWindow(TL.weld, TL.weld + 4.1) || inWindow(TL.wheels, TL.wheels + 4.4),
      weldR: inWindow(TL.weld + 0.2, TL.weld + 4.3) || inWindow(TL.wheels, TL.wheels + 4.4),
      handL: inWindow(TL.doors, TL.doors + 4.4) || inWindow(TL.wheels, TL.wheels + 4.4),
      handR: inWindow(TL.doors, TL.doors + 4.4) || inWindow(TL.wheels, TL.wheels + 4.4),
    };
    const blink = Math.sin(clock * 9) > 0 ? 1 : 0;
    for (const l of this.stackLights) {
      const on = active[l.robot];
      l.green.emissiveIntensity = on ? 0 : 1.6;
      l.amber.emissiveIntensity = on ? 3 * blink : 0;
    }
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
      this.produced = this.produced >= 240 ? 1 : this.produced + 1;
      this.extras.drawAndon(this.produced);
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
    if (Math.random() < dt * 7) this.smoke.emit(world);
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
    const rootZ = this.carRoot.position.z;
    for (const s of this.headSpots) {
      s.intensity = 30 * head;
      s.position.z = 2.2 + rootZ;
      s.target.position.z = 8 + rootZ;
    }
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
      [31.3, V(1.2, 1.45, 6.9)],
      [32.6, V(2.4, 1.8, 8.6)],
      [34.0, V(3.8, 3.6, 11.0)],
      [35.4, V(0.8, 3.4, 20.5)],
      [36.6, V(1.6, 1.45, 21.6)],
      [37.8, V(1.5, 1.35, 20.8)],
      [40.8, V(-1.7, 1.9, 21.3)],
      [43.0, V(-2.3, 2.1, 21.6)],
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
      [31.3, V(0, 0.8, 0.6)],
      [32.6, V(0, 0.8, 2.2)],
      [34.0, V(0, 0.9, 8.0)],
      [35.4, V(0, 0.8, 13.6)],
      [36.6, V(0, 0.85, 14.8)],
      [37.8, V(0, 0.8, 15.3)],
      [40.8, V(0, 0.8, 15.3)],
      [43.0, V(0, 0.8, 15.3)],
    ];
    if (this.debugCam) {
      this.camera.position.copy(this.debugCam.pos);
      this.camera.lookAt(this.debugCam.target);
      return;
    }
    keyed(pos, t, this.camera.position);
    const target = keyed(tgt, t, V());
    // lichte "camerakraan"-beweging
    this.camera.position.x += Math.sin(clock * 0.37) * 0.06;
    this.camera.position.y += Math.sin(clock * 0.29) * 0.04;
    // korte schok bij zware handelingen: carrosserie neergezet, deur dicht, wielen erop, ruit geplaatst
    let shake = 0;
    for (const [at, amp] of [[TL.body + 3.4, 0.022], [TL.doors + 4.4, 0.012], [TL.wheels + 2.8, 0.01], [TL.glass + 2.9, 0.008]]) {
      const d = t - at;
      if (d > 0 && d < 1) shake += amp * Math.exp(-d * 6) * Math.sin(d * 55);
    }
    this.camera.position.y += shake;
    target.y += shake * 0.5;
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
  photo(mode) {
    if (instance) instance.photo(mode);
  },
  photoAnchors(names) {
    return instance ? instance.photoAnchors(names) : null;
  },
  debugCamera(pos, target) {
    if (instance) instance.debugCam = pos ? { pos: V(...pos), target: V(...target) } : null;
  },
  quality() {
    return instance ? instance.level : -1;
  },
};
