// Football physics: a prolate spheroid that falls, tumbles and takes the famously crazy football bounce.
// Units are yards (like the rest of the field). The ball mesh's local +z is its long axis.
import * as THREE from 'three';

const G = 10.7; // 9.8 m/s^2 in yards
const A = 0.19; // half length
const B = 0.11; // radius
const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const axis = new THREE.Vector3();

/** How far below its center the ball reaches when its long axis is `dir` (unit). */
const supportY = (dir) => { const c = dir.y; return Math.sqrt(A * A * c * c + B * B * (1 - c * c)); };

export function createBallPhysics(ball, { rand = Math.random, onBounce = null } = {}) {
  const s = {
    active: false, // physics owns the ball
    rolling: false,
    resting: false,
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    w: new THREE.Vector3(), // angular velocity (rad/s, world)
    q: new THREE.Quaternion(),
    bounces: 0,
    t: 0,
    yawRate: 0,
  };
  const longAxis = (out = new THREE.Vector3()) => out.set(0, 0, 1).applyQuaternion(s.q);

  /** Hand the ball to physics: pos, vel (yards/s), optional spin vector and starting orientation. */
  s.launch = (pos, vel, { spin = null, quat = null } = {}) => {
    s.active = true; s.rolling = false; s.resting = false; s.bounces = 0; s.t = 0;
    s.p.copy(pos); s.v.copy(vel);
    s.q.copy(quat ?? ball.quaternion);
    if (spin) s.w.copy(spin);
    else s.w.set((rand() - 0.5) * 14, (rand() - 0.5) * 8, (rand() - 0.5) * 14);
  };
  s.stop = () => { s.active = false; s.rolling = false; };
  s.speed = () => Math.hypot(s.v.x, s.v.z);
  /** Low and slow enough to scoop up or fall on. */
  s.grabbable = () => s.active && s.p.y < 1.25 && (s.rolling || s.resting || Math.hypot(s.v.x, s.v.y, s.v.z) < 11);

  s.step = (dt) => {
    if (!s.active) return;
    s.t += dt;
    dt = Math.min(dt, 1 / 30);
    if (s.resting) { apply(); return; }
    if (!s.rolling) {
      // ---- flight / tumbling
      s.v.y -= G * dt;
      s.v.multiplyScalar(1 - 0.06 * dt); // a little air drag
      s.p.addScaledVector(s.v, dt);
      const wl = s.w.length();
      if (wl > 1e-4) { tmpQ.setFromAxisAngle(axis.copy(s.w).divideScalar(wl), wl * dt); s.q.premultiply(tmpQ).normalize(); }
      const L = longAxis(tmpV);
      const h = supportY(L);
      if (s.p.y <= h && s.v.y < 0) {
        s.p.y = h;
        s.bounces++;
        const tip = Math.abs(L.y); // 1 = lands on its point, 0 = lands flat on its side
        const impact = -s.v.y;
        // the bounce: off the point it kicks up and squirts sideways; flat it skids
        const e = 0.28 + tip * (0.25 + rand() * 0.35);
        s.v.y = impact * e;
        const ang = (rand() - 0.5) * (0.25 + 2.2 * tip * tip);
        const c = Math.cos(ang), sn = Math.sin(ang);
        const vx = s.v.x * c - s.v.z * sn, vz = s.v.x * sn + s.v.z * c;
        const keep = 0.62 + rand() * 0.18 - tip * 0.12 + (tip > 0.6 ? rand() * 0.35 : 0);
        s.v.x = vx * keep; s.v.z = vz * keep;
        // the ground grabs one end: a big tumble
        const hv = tmpV.set(s.v.x, 0, s.v.z);
        const roll = axis.crossVectors(UP, hv).multiplyScalar(1 / B * 0.6);
        s.w.copy(roll).add(new THREE.Vector3((rand() - 0.5), (rand() - 0.5) * 0.6, (rand() - 0.5)).multiplyScalar(4 + 10 * tip));
        onBounce?.(impact, tip);
        if (s.v.y < 0.9 || s.bounces > 6) {
          // settle onto its side and start rolling
          s.v.y = 0; s.rolling = true;
          const flat = longAxis(new THREE.Vector3()); flat.y = 0;
          if (flat.lengthSq() < 1e-4) flat.set(rand() - 0.5, 0, rand() - 0.5);
          flat.normalize();
          s.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flat);
          s.yawRate = (rand() - 0.5) * 3;
        }
      }
    } else {
      // ---- rolling on its side: it curls in an arc (one end is always ahead) and wobbles to a stop
      const L = longAxis(new THREE.Vector3()); L.y = 0; L.normalize();
      const hs = s.speed();
      const fr = Math.exp(-(1.4 + (hs < 1.2 ? 2.2 : 0)) * dt);
      s.v.x *= fr; s.v.z *= fr;
      // velocity across the long axis rolls it; along the axis it just slides
      const perp = tmpV.set(-L.z, 0, L.x);
      const across = s.v.x * perp.x + s.v.z * perp.z;
      // curling path: turn the velocity a little toward the long axis
      const turn = s.yawRate * dt * Math.min(1, hs / 2);
      const c = Math.cos(turn), sn = Math.sin(turn);
      const vx = s.v.x * c - s.v.z * sn; s.v.z = s.v.x * sn + s.v.z * c; s.v.x = vx;
      s.yawRate *= Math.exp(-0.8 * dt);
      s.p.x += s.v.x * dt; s.p.z += s.v.z * dt;
      // spin about its long axis from rolling, and yaw slowly
      tmpQ.setFromAxisAngle(L, -(across / B) * dt); s.q.premultiply(tmpQ);
      tmpQ.setFromAxisAngle(UP, s.yawRate * dt * 0.6 + across * dt * 0.08); s.q.premultiply(tmpQ);
      s.q.normalize();
      // rocking on the seams as it slows
      const wob = Math.sin(s.t * 9) * 0.012 * Math.min(1, hs);
      s.p.y = B + wob;
      if (hs < 0.06) { s.resting = true; s.v.set(0, 0, 0); }
    }
    apply();
  };
  const apply = () => {
    ball.position.copy(s.p);
    ball.quaternion.copy(s.q);
    const sh = ball.userData.shadow;
    if (sh) { sh.position.set(s.p.x, 0.03, s.p.z); sh.scale.setScalar(0.3 * Math.max(0.4, 1 - s.p.y * 0.15)); }
  };
  return s;
}

/** Point a flying ball along its path with a tight spiral (wobble > 0 for a duck). */
export function orientInFlight(ball, vel, spinAngle, wobble = 0, t = 0) {
  tmpV.copy(ball.position).add(vel);
  ball.lookAt(tmpV);
  if (wobble > 0) { ball.rotateX(Math.sin(t * 7) * wobble); ball.rotateY(Math.cos(t * 7) * wobble); }
  ball.rotateZ(spinAngle);
}
