// Mini play diagrams for the play picker cards (SVG strings, no DOM). Same coordinates as the play engine:
// x across the field, z downfield (negative = the end zone you attack), line of scrimmage at z = 0.
import { OFF_FORMATION, OL_X, rushLane, stopGap } from '../../data/playbook.js';

const COLS = ['#ffd43b', '#60a5fa', '#f472b6', '#4ade80', '#fb923c']; // X, S, Z, TE, RB (same as the field)
const SLOTS = ['X', 'S', 'Z', 'TE', 'RB'];
// depth is squeezed so deep routes fit a short card strip
const Y = (z) => (z < 0 ? Math.max(-17, z * 0.45) : z * 0.7);
const X = (x) => Math.max(-22.5, Math.min(22.5, x));
const f = (n) => Math.round(n * 100) / 100;
let K = 1; // line/marker scale (the line-of-scrimmage close-ups use smaller marks)

function path(pts, col, { w: w0 = 1.1, end = 'arrow', op = 1 } = {}) {
  const w = w0 * K;
  const P = pts.map((p) => [X(p.x), Y(p.z)]);
  if (P.length < 2) return '';
  let out = `<polyline points="${P.map(([a, b]) => `${f(a)},${f(b)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" opacity="${op}"/>`;
  const [x1, y1] = P[P.length - 1], [x0, y0] = P[P.length - 2];
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  if (end === 'arrow') {
    const s = w * 2.2;
    out += `<polygon points="${f(x1 + ux * s * 0.6)},${f(y1 + uy * s * 0.6)} ${f(x1 - ux * s - uy * s * 0.8)},${f(y1 - uy * s + ux * s * 0.8)} ${f(x1 - ux * s + uy * s * 0.8)},${f(y1 - uy * s - ux * s * 0.8)}" fill="${col}" opacity="${op}"/>`;
  } else if (end === 'block') {
    const s = w * 1.8;
    out += `<line x1="${f(x1 - uy * s)}" y1="${f(y1 + ux * s)}" x2="${f(x1 + uy * s)}" y2="${f(y1 - ux * s)}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity="${op}"/>`;
  } else if (end === 'dot') out += `<circle cx="${f(x1)}" cy="${f(y1)}" r="${w * 1.3}" fill="${col}" opacity="${op}"/>`;
  return out;
}
const dot = (x, z, col = '#e2e8f0', r = 1.15) => `<circle cx="${f(X(x))}" cy="${f(Y(z))}" r="${f(r * K)}" fill="${col}"/>`;
const ex = (x, z, col = '#f87171') => { const a = X(x), b = Y(z), s = 0.95 * K; return `<path d="M${f(a - s)} ${f(b - s)}L${f(a + s)} ${f(b + s)}M${f(a + s)} ${f(b - s)}L${f(a - s)} ${f(b + s)}" stroke="${col}" stroke-width="${f(0.6 * K)}"/>`; };
const rect = (x0, x1, z0, z1, col) => `<rect x="${f(Math.min(X(x0), X(x1)))}" y="${f(Math.min(Y(z0), Y(z1)))}" width="${f(Math.abs(X(x1) - X(x0)))}" height="${f(Math.abs(Y(z1) - Y(z0)))}" fill="${col}" fill-opacity="0.28" stroke="${col}" stroke-width="0.6" rx="1"/>`;

/** SVG string for one play card. mode: pass | route | run | cover | runD | rush | runStop. */
export function playArtSVG(mode, pl, { call = 'balanced', userRole } = {}) {
  if (!pl || !mode) return '';
  K = mode === 'rush' || mode === 'runStop' ? 0.38 : 1;
  const F = OFF_FORMATION[pl.form ?? 'shotgun'] ?? OFF_FORMATION.shotgun;
  const at = (slot) => ({ x: F[slot][0], z: F[slot][1] });
  let body = '';
  const offense = (skip = []) => {
    for (const x of OL_X) body += dot(x, 0.8, '#94a3b8', 1);
    for (const s of ['QB', 'RB', 'X', 'Z', 'S', 'TE']) if (!skip.includes(s)) body += dot(F[s][0], F[s][1]);
  };
  if (mode === 'pass') {
    for (const x of OL_X) body += path([{ x, z: 1.1 }, { x, z: 2.4 }], '#94a3b8', { w: 0.6, end: 'block', op: 0.8 });
    SLOTS.forEach((slot, i) => {
      const st = at(slot);
      const r = pl.routes?.[slot];
      if (r && !(slot === 'RB' && pl.screen !== undefined)) body += path([st, ...r.map(([dx, dz]) => ({ x: st.x + dx, z: dz }))], COLS[i]);
      else if (slot === 'RB' && pl.screen !== undefined) body += path([st, { x: pl.screen * 7, z: 2.2 }, { x: pl.screen * 8.5, z: -6 }], COLS[4]);
    });
    offense(['QB']);
    body += dot(F.QB[0], F.QB[1], '#ffd43b', 1.5);
  } else if (mode === 'route') {
    const st = at('Z');
    offense(['Z']);
    if (pl.route) body += path([st, ...pl.route.map(([dx, dz]) => ({ x: st.x + dx, z: dz }))], '#ffd43b', { w: 1.4, end: pl.sit ? 'dot' : 'arrow' });
    body += dot(st.x, st.z, '#ffd43b', 1.5);
  } else if (mode === 'run') {
    const h0 = pl.hole?.[0] ?? 0, h1 = pl.hole?.[1] ?? h0;
    const qbUser = userRole === 'QB';
    const rb = at('RB'), qb = at('QB');
    for (const x of OL_X) { const dx = Math.max(-1.1, Math.min(1.1, (h0 - x) * 0.35)); body += path([{ x, z: 0.8 }, { x: x + dx, z: -1 }], '#94a3b8', { w: 0.6, end: 'block', op: 0.8 }); }
    let pts;
    if (qbUser) pts = [qb, { x: h0, z: 0 }, { x: h1, z: -9 }];
    else if (pl.screen !== undefined) pts = [rb, { x: pl.screen * 7, z: 2.2 }, { x: pl.screen * 8.5, z: -8 }];
    else if (pl.pitch) pts = [rb, { x: h0 * 0.6, z: rb.z - 0.5 }, { x: h0, z: 0.2 }, { x: h1, z: -9 }];
    else pts = [rb, { x: qb.x + 0.3 * (Math.sign(h0) || 1), z: qb.z - 0.6 }, { x: h0, z: -0.2 }, { x: h1, z: -9 }];
    body += path(pts, '#4ade80', { w: 1.4 });
    offense(qbUser ? ['QB'] : ['RB']);
    body += qbUser ? dot(qb.x, qb.z, '#ffd43b', 1.5) : dot(rb.x, rb.z, '#ffd43b', 1.5);
  } else if (mode === 'cover') {
    const me = { x: 10.2, z: pl.press ? -1.6 : call === 'safe' ? -7 : -5 };
    offense();
    if (pl.user === 'deep') body += rect(4.5, 26.4, -11, -34, '#60a5fa');
    else if (pl.user === 'flat') body += rect(5.5, 26.4, -0.8, -9, '#38bdf8');
    else if (pl.user === 'blitz') body += path([me, { x: me.x - 3.5, z: 0.6 }, { x: 0.6, z: 4.4 }], '#f87171', { w: 1.4 });
    else body += path([me, { x: 11, z: 0 }], '#60a5fa', { w: 1.2, end: 'dot' });
    if (pl.twoDeep || pl.coverage === 'zone') { body += ex(-7, -13, '#cbd5e1'); body += ex(7, -15, '#cbd5e1'); } else if (!pl.blitz) body += ex(0, -15, '#cbd5e1');
    if (pl.blitz) for (const x of [-3.2, 3.2]) body += path([{ x, z: -5.5 }, { x: x * 0.4, z: 3.5 }], '#f87171', { w: 0.7, op: 0.7 });
    body += ex(me.x, me.z, '#ffd43b');
  } else if (mode === 'runD') {
    const me = { x: 10.2, z: -5 };
    offense();
    body += path([{ x: 0, z: 6.5 }, { x: 8, z: 4 }, { x: 10, z: -2 }], '#94a3b8', { w: 0.8, op: 0.8 });
    body += call === 'risky' ? path([me, { x: me.x - 1, z: -0.4 }, { x: 7.5, z: 4 }], '#f87171', { w: 1.4 }) : path([me, { x: me.x + 0.5, z: -2 }, { x: 10.5, z: -0.6 }, { x: 8, z: 1.6 }], '#f87171', { w: 1.4 });
    body += ex(me.x, me.z, '#ffd43b');
  } else if (mode === 'rush' || mode === 'runStop') {
    const dl = [-2.6, -0.9, 0.9, 2.6];
    for (const x of OL_X) body += dot(x, 0.8, '#94a3b8', 1);
    body += dot(0, mode === 'rush' ? 5 : 3.5) + dot(mode === 'rush' ? -1.6 : 0, mode === 'rush' ? 5.2 : 6.5);
    const me = { x: 0.9, z: -1.1 };
    if (mode === 'rush') {
      const lane = rushLane(pl.name);
      const via = lane === 'outside' ? { x: me.x + 2.8, z: 1.6 } : lane === 'loop' ? { x: me.x - 2.6, z: 0.7 } : lane === 'move' ? { x: me.x + 0.9, z: 1.4 } : { x: me.x * 0.6, z: 1.8 };
      body += path([me, via, { x: 0, z: 4.3 }], '#f87171', { w: 1.4 });
      if (pl.blitz) for (const x of [-3.2, 3.2]) body += path([{ x, z: -5.5 }, { x: x * 0.4, z: 3.5 }], '#f87171', { w: 0.7, op: 0.7 });
    } else {
      const gap = stopGap(pl.name);
      const to = gap === 'slant' ? [{ x: me.x + 1.7, z: 1.3 }] : gap === 'pinch' ? [{ x: me.x - 1.2, z: 1.1 }] : gap === 'spill' ? [{ x: me.x + 1.3, z: 0.9 }] : gap === 'shoot' ? [{ x: me.x, z: 1.2 }, { x: me.x + 0.3, z: 4 }] : [{ x: me.x, z: 0.5 }];
      body += path([me, ...to], '#f87171', { w: 1.4, end: gap === 'anchor' ? 'block' : 'arrow' });
    }
    dl.forEach((x, i) => { body += ex(x, -1.1, i === 2 ? '#ffd43b' : '#f87171'); });
    for (const x of [-3.2, 3.2]) body += ex(x, -5.5);
    return `<svg class="fc-art" viewBox="-9 -4.5 18 9" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><line x1="-9" y1="0" x2="9" y2="0" stroke="#fff" stroke-opacity="0.3" stroke-width="0.12"/>${body}</svg>`;
  } else return '';
  return `<svg class="fc-art" viewBox="-23 -17.5 46 23" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><line x1="-23" y1="0" x2="23" y2="0" stroke="#fff" stroke-opacity="0.3" stroke-width="0.35"/>${body}</svg>`;
}
