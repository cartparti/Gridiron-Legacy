#!/usr/bin/env python3
"""Build src/data/mhhead.js from the MakeHuman base mesh + targets (CC0 1.0, see tools/head/src/LICENSE.md).

The head (and upper neck) is cut out of the base body, moved into the game's head space (chin y 0.03, crown 0.43,
face toward -z), and the shape targets are reduced to that head and packed as int16 deltas. Run:
    python3 tools/head/build.py
"""
import base64, json, math, os, struct

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
OUT = os.path.join(HERE, '..', '..', 'src', 'data', 'mhhead.js')

NECK_CUT = 5.82          # MakeHuman units (dm): below this the shoulders start
CHIN_Y, CROWN_Y = 6.1555, 8.4913
HEAD_H = 0.40            # game units, chin to crown
S = HEAD_H / (CROWN_Y - CHIN_Y)
MID_Y = (CHIN_Y + CROWN_Y) / 2
Z_C = 0.57               # front-to-back centre of the skull


def to_game(x, y, z):
    return (-x * S, 0.23 + (y - MID_Y) * S, -(z - Z_C) * S)


V, groups, cur = [], {}, None
for line in open(os.path.join(SRC, 'base.obj')):
    if line.startswith('v '):
        V.append(tuple(map(float, line.split()[1:4])))
    elif line.startswith('g '):
        cur = line.split()[1]
    elif line.startswith('f '):
        groups.setdefault(cur, []).append([int(p.split('/')[0]) - 1 for p in line.split()[1:]])

# ---- head faces: every body face fully above the neck cut
faces = [f for f in groups['body'] if all(V[i][1] > NECK_CUT for i in f)]
used = sorted({i for f in faces for i in f})
remap = {o: n for n, o in enumerate(used)}
P = [to_game(*V[i]) for i in used]
tris = []
for f in faces:
    g = [remap[i] for i in f]
    # MakeHuman faces are quads; the mirror (x -> -x, z -> -z) keeps winding, so fan them as-is
    for k in range(1, len(g) - 1):
        tris.append((g[0], g[k], g[k + 1]))


def centre(name):
    s = {i for f in groups[name] for i in f}
    c = [sum(V[i][k] for i in s) / len(s) for k in range(3)]
    r = max(math.dist(V[i], c) for i in s)
    return c, r


eyeL, eyeR = centre('helper-l-eye'), centre('helper-r-eye')
teethU, teethL = centre('helper-upper-teeth'), centre('helper-lower-teeth')
eyes = [to_game(*eyeL[0]), to_game(*eyeR[0])]
eye_r = eyeL[1] * S
mouth = to_game(0, (teethU[0][1] + teethL[0][1]) / 2 + 0.01, max(V[i][2] for i in used if abs(V[i][0]) < 0.05 and abs(V[i][1] - 6.66) < 0.06))
nose_tip = to_game(0, 0, 0)
nt = max((V[i] for i in used if abs(V[i][0]) < 0.08), key=lambda p: p[2])
nose_tip = to_game(*nt)
chin = to_game(0, CHIN_Y, max(V[i][2] for i in used if abs(V[i][0]) < 0.1 and abs(V[i][1] - CHIN_Y) < 0.05))
xs = [p[0] for p in P]; ys = [p[1] for p in P]; zs = [p[2] for p in P]
dims = [max(xs) - min(xs), HEAD_H, max(zs) - min(zs)]

# ---- the face texture: eyes at columns 3.1 / 8.9, row 5.75; mouth at row 9.3 (same layout the painter uses)
ex = abs(eyes[0][0]); ey = eyes[0][1]; my = mouth[1]


def face_uv(p):
    col = 6 - (p[0] / ex) * 2.9 if eyes[0][0] > 0 else 6 + (p[0] / ex) * 2.9
    row = 5.75 + (ey - p[1]) / (ey - my) * 3.55
    return col / 12, 1 - row / 12


UV = [face_uv(p) for p in P]


def tri_normal(t):
    a, b, c = (P[i] for i in t)
    u = [b[k] - a[k] for k in range(3)]; v = [c[k] - a[k] for k in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    l = math.sqrt(sum(x * x for x in n)) or 1
    return [x / l for x in n]


# which way do the triangles face? (the nose tip triangle should point toward -z)
nt_i = min(range(len(P)), key=lambda i: P[i][2])
probe = next(t for t in tris if nt_i in t)
flip = tri_normal(probe)[2] > 0
if flip:
    tris = [(a, c, b) for a, b, c in tris]

front, skin = [], []
for t in tris:
    n = tri_normal(t)
    u = sum(UV[i][0] for i in t) / 3; v = sum(UV[i][1] for i in t) / 3
    (front if (n[2] < -0.15 and 0.02 < u < 0.98 and 0.02 < v < 0.98) else skin).append(t)
order = skin + front

# ears: vertices well outside the skull at ear height (hair and beards must not grow on them)
ear = []
for i, p in enumerate(P):
    X = p[0] / (dims[0] / 2)
    ear.append(1 if abs(X) > 0.78 and ey - 0.075 < p[1] < ey + 0.03 and p[2] > eyes[0][2] + 0.04 else 0)


# landmarks that follow the shape targets: the eye-socket rims, the chin point and the crown
def ring(c):
    return [n for n, o in enumerate(used) if 0.12 < math.dist(V[o], c) < 0.3 and V[o][2] > c[2] - 0.05]
eye_rings = [ring(eyeL[0]), ring(eyeR[0])]
def ring_c(r):
    return [sum(P[i][k] for i in r) / len(r) for k in range(3)]
eye_off = [[eyes[j][k] - ring_c(eye_rings[j])[k] for k in range(3)] for j in range(2)]
chin_i = min((n for n, o in enumerate(used) if abs(V[o][0]) < 0.05 and V[o][2] > 0.9), key=lambda n: P[n][1])
crown_i = max(range(len(P)), key=lambda n: P[n][1])


def b64(fmt, arr):
    return base64.b64encode(struct.pack('<%d%s' % (len(arr), fmt), *arr)).decode()


def load_target(name):
    d = {}
    for line in open(os.path.join(SRC, 'targets', name + '.target')):
        if not line.strip() or line.startswith('#'):
            continue
        a = line.split()
        i = int(a[0])
        if i in remap:
            dx, dy, dz = map(float, a[1:4])
            d[remap[i]] = (-dx * S, dy * S, -dz * S)
    return d


def merge(*names):
    out = {}
    for n in names:
        for i, v in load_target(n).items():
            o = out.get(i, (0, 0, 0)); out[i] = tuple(o[k] + v[k] for k in range(3))
    return out


T = {}
files = sorted(f[:-7] for f in os.listdir(os.path.join(SRC, 'targets')))
done = set()
# gender: an even blend of MakeHuman's three regional young male/female macros (features never follow skin tone)
for sex in ('female', 'male'):
    parts = [f'macrodetails_{e}-{sex}-young' for e in ('african', 'asian', 'caucasian')]
    acc = {}
    for prt in parts:
        for i, v in load_target(prt).items():
            o = acc.get(i, (0, 0, 0)); acc[i] = tuple(o[k] + v[k] / 3 for k in range(3))
    T[f'{sex}-young'] = acc; done |= set(parts)
for f in files:
    if f in done:
        continue
    # l-/r- pairs become one symmetric target
    if '_l-' in f:
        r = f.replace('_l-', '_r-')
        name = f.split('_', 1)[1].replace('l-', '', 1)
        T[name] = merge(f, r); done |= {f, r}
    elif '_r-' in f:
        continue
    else:
        T[f.split('_', 1)[1]] = load_target(f); done.add(f)

packed = {}
for name, d in T.items():
    if not d:
        continue
    idx = sorted(d)
    m = max(abs(c) for i in idx for c in d[i]) or 1e-9
    q = m / 32767
    packed[name] = {'i': b64('H', idx), 'd': b64('h', [int(round(c / q)) for i in idx for c in d[i]]), 'q': q, 'n': len(idx)}

data = {
    'license': 'MakeHuman base mesh and targets, CC0 1.0 Universal (makehumancommunity/makehuman).',
    'pos': b64('f', [c for p in P for c in p]),
    'uv': b64('f', [c for p in UV for c in p]),
    'idx': b64('H', [i for t in order for i in t]),
    'skinTris': len(skin), 'faceTris': len(front),
    'ear': b64('B', ear),
    'eyes': eyes, 'eyeR': eye_r, 'eyeRings': [b64('H', r) for r in eye_rings], 'eyeOff': eye_off, 'chinI': chin_i, 'crownI': crown_i, 'mouth': mouth, 'noseTip': nose_tip, 'chin': chin, 'dims': dims,
    'targets': packed,
}
with open(OUT, 'w') as fh:
    fh.write('// Generated by tools/head/build.py from the MakeHuman base mesh + targets (CC0 1.0 Universal).\n')
    fh.write('// Do not edit by hand.\n')
    fh.write('export const MH_HEAD = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print('verts', len(P), 'tris', len(order), 'face tris', len(front), 'targets', len(packed), 'ears', sum(ear), 'flip', flip)
print('eyes', [[round(c, 4) for c in e] for e in eyes], 'eyeR', round(eye_r, 4), 'mouth', [round(c, 4) for c in mouth], 'chin', [round(c, 4) for c in chin], 'dims', [round(c, 3) for c in dims])
print('bytes', os.path.getsize(OUT), 'rings', [len(r) for r in eye_rings], 'chin', P[chin_i], 'crown', P[crown_i])
