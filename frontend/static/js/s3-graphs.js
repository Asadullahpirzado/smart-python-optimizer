/* 3D graphs (CFG tower, AST cone-tree, call-graph force layout), Code City, module hub */
(() => {
'use strict';
const T = window.THREE, S3 = window.SPO3D;
if (!T || !S3) return;
const V = (x, y, z) => new T.Vector3(x, y, z);
const EDGE = {true: '#16A34A', false: '#F97316', back: '#A855F7', exc: '#F472B6', seq: null};

function layoutTower(nodes, edges, root) {
  const idx = new Map(nodes.map((n, i) => [n.id, i])), adj = nodes.map(() => []);
  edges.forEach((e, i) => { if (idx.has(e.from) && idx.has(e.to)) adj[idx.get(e.from)].push([idx.get(e.to), i]); });
  const back = new Set(), state = new Array(nodes.length).fill(0), start = idx.has(root) ? idx.get(root) : 0, level = new Array(nodes.length).fill(-1);
  const dfs = s => { const st = [[s, 0]]; state[s] = 1; while (st.length) { const top = st[st.length - 1], [u, k] = top; if (k < adj[u].length) { top[1]++; const [v, ei] = adj[u][k]; if (state[v] === 1) back.add(ei); else if (state[v] === 0) { state[v] = 1; st.push([v, 0]); } } else { state[u] = 2; st.pop(); } } };
  dfs(start); level[start] = 0;
  for (let it = 0, ch = true; ch && it < nodes.length + 2; it++) { ch = false; adj.forEach((a, u) => { if (level[u] < 0) return; a.forEach(([v, ei]) => { if (!back.has(ei) && level[v] < level[u] + 1) { level[v] = level[u] + 1; ch = true; } }); }); }
  const maxL = Math.max(0, ...level), groups = new Map(); level.forEach((l, i) => { if (l < 0) l = maxL + 1; if (!groups.has(l)) groups.set(l, []); groups.get(l).push(i); });
  const pos = new Array(nodes.length); [...groups.entries()].forEach(([l, arr]) => { const n = arr.length, r = n === 1 ? 0 : Math.max(2.4, n * 1.6 / (2 * Math.PI) * 1.5); arr.forEach((i, k) => { const a = k / n * Math.PI * 2 + l * .55; pos[i] = V(Math.cos(a) * r, -l * 2.8, Math.sin(a) * r); }); });
  nodes.forEach((n, i) => { if (n.unreach && pos[i]) pos[i].y -= 0.5; }); return {pos, back};
}

function layoutDomTree(nodes) {
  // Compute positions based on immediate dominator (idom) tree
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const kids = nodes.map(() => []);
  let root = 0;
  nodes.forEach((n, i) => {
    if (n.idom && idx.has(n.idom) && idx.get(n.idom) !== i) {
      kids[idx.get(n.idom)].push(i);
    } else if (n.label && n.label.toLowerCase().includes('entry')) {
      root = i;
    }
  });
  const pos = new Array(nodes.length);
  const leaves = new Array(nodes.length).fill(1);
  const calcLeaves = u => {
    if (!kids[u].length) { leaves[u] = 1; return; }
    let sum = 0;
    kids[u].forEach(v => { calcLeaves(v); sum += leaves[v]; });
    leaves[u] = Math.max(1, sum);
  };
  calcLeaves(root);
  const place = (u, depth, x0, x1) => {
    pos[u] = V((x0 + x1) / 2, -depth * 2.5, 0);
    let curX = x0;
    const total = leaves[u];
    kids[u].forEach(v => {
      const w = (x1 - x0) * (leaves[v] / total);
      place(v, depth + 1, curX, curX + w);
      curX += w;
    });
  };
  place(root, 0, -Math.max(4, leaves[root] * 1.8), Math.max(4, leaves[root] * 1.8));
  nodes.forEach((n, i) => { if (!pos[i]) pos[i] = V(0, -5, 0); });
  return {pos, back: new Set()};
}

function layoutTree(nodes, edges) {
  const idx = new Map(nodes.map((n, i) => [n.id, i])), kids = nodes.map(() => []), hasP = new Set();
  edges.forEach(e => { if (idx.has(e.from) && idx.has(e.to)) { kids[idx.get(e.from)].push(idx.get(e.to)); hasP.add(idx.get(e.to)); } });
  const leaves = new Array(nodes.length).fill(0), pos = new Array(nodes.length);
  const calc = u => { const st = [u], ord = []; while (st.length) { const x = st.pop(); ord.push(x); (kids[x] || []).forEach(k => st.push(k)); } ord.reverse().forEach(x => { leaves[x] = kids[x].length ? kids[x].reduce((a, k) => a + leaves[k], 0) : 1; }); };
  calc(0);
  const place = (u, a0, a1, d) => {
    const st = [[u, a0, a1, d]];
    while (st.length) {
      const [x, s, e, dp] = st.pop(), m = (s + e) / 2, r = dp * 2.2;
      pos[x] = V(Math.cos(m) * r, -dp * 1.6, Math.sin(m) * r);
      let a = s;
      (kids[x] || []).forEach(k => {
        const w = (e - s) * (leaves[k] || 1) / Math.max(1, leaves[x] || 1);
        st.push([k, a, a + w, dp + 1]);
        a += w;
      });
    }
  };
  place(0, 0, Math.PI * 2, 0);
  nodes.forEach((_, i) => { if (!pos[i]) pos[i] = V(0, 0, 0); });
  return {pos, back: new Set()};
}

function layoutForce(nodes, edges) {
  const n = nodes.length, idx = new Map(nodes.map((x, i) => [x.id, i])), p = nodes.map((_, i) => { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y), a = i * 2.399963; return V(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(Math.max(3, Math.sqrt(n) * 1.8)); });
  const es = edges.filter(e => idx.has(e.from) && idx.has(e.to)).map(e => [idx.get(e.from), idx.get(e.to)]), k = 3.2;
  for (let it = 0; it < 220; it++) {
    const f = p.map(() => V(0, 0, 0)), cool = 1 - it / 240;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const d = p[i].clone().sub(p[j]), l = Math.max(.2, d.length()), s = k * k / l / l; d.multiplyScalar(s); f[i].add(d); f[j].sub(d); }
    es.forEach(([a, b]) => { const d = p[b].clone().sub(p[a]), l = d.length() || .1, s = (l - k) * .08; d.normalize().multiplyScalar(s); f[a].add(d); f[b].sub(d); });
    p.forEach((q, i) => { f[i].add(q.clone().multiplyScalar(-.02)); const l = f[i].length(); if (l > .6) f[i].multiplyScalar(.6 / l); q.add(f[i].multiplyScalar(cool)); });
  }
  return {pos: p, back: new Set()};
}

S3.graph = (el, {nodes, edges, layout = 'tower', root, onSelect, onSimStep}) => {
  const st = S3.mount(el, {camera: [8, 5, 17], autoRotate: false}); if (!st) return S3.fallback(el);
  const P = S3.pal();
  let currentLayout = layout;
  let L = layout === 'tree' ? layoutTree(nodes, edges) : layout === 'force' ? layoutForce(nodes, edges) : layoutTower(nodes, edges, root || (nodes[0] && nodes[0].id));
  const idx = new Map(nodes.map((n, i) => [n.id, i])), meshes = [], edgeObjs = [], root3 = new T.Group();
  st.scene.add(root3);

  // Floating pulses along edges
  const edgePulses = [];

  const mk = (n, i) => {
    const c = n.color || '#4285F4', sz = n.size || [1.4, .7, 1.4];
    let geo;
    if (n.shape === 'sphere') {
      geo = new T.SphereGeometry(sz[0] / 2, 24, 16);
    } else if (n.shape === 'prism') {
      geo = new T.CylinderGeometry(sz[0] * 0.55, sz[0] * 0.55, sz[1], 6);
    } else if (n.shape === 'capsule') {
      geo = new T.CylinderGeometry(sz[0] * 0.45, sz[0] * 0.45, sz[1], 16);
    } else {
      geo = new T.BoxGeometry(...sz);
    }

    const mat = new T.MeshStandardMaterial({
      color: c,
      roughness: .32,
      metalness: .22,
      emissive: c,
      emissiveIntensity: n.dim ? .02 : .25,
      transparent: !!n.dim,
      opacity: n.dim ? .45 : 1
    });

    const m = new T.Mesh(geo, mat);
    m.position.copy(L.pos[i] || V(0, 0, 0));
    m.userData = {n, i, c, basePos: m.position.clone()};
    root3.add(m);
    meshes.push(m);

    // Glowing outline / pedestal
    if (n.glow) {
      const g = S3.glow(c, sz[0] * 2.6, .65);
      g.position.copy(m.position);
      m.userData.glow = g;
      root3.add(g);
    }

    // Top Header Cap for Basic Blocks (gives realistic CC terminal look)
    if (n.shape !== 'sphere') {
      const capMat = new T.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.2});
      const cap = new T.Mesh(new T.BoxGeometry(sz[0] * 1.02, 0.12, sz[2] * 1.02), capMat);
      cap.position.set(0, sz[1] / 2 + 0.05, 0);
      m.add(cap);
    }

    if (n.label) {
      const t = S3.label(n.label, {color: P.text, line: n.shape === 'sphere' ? .28 : .32, weight: 700, mono: true});
      t.position.copy(m.position).add(V(0, sz[1] / 2 + .42, 0));
      m.userData.labelMesh = t;
      root3.add(t);
    }
  };

  nodes.forEach(mk);

  const makeEdges = () => {
    // Clear old edges
    edgeObjs.forEach(e => {
      root3.remove(e.tube);
      root3.remove(e.cone);
      if (e.labelObj) root3.remove(e.labelObj);
    });
    edgeObjs.length = 0;

    edges.forEach((e, ei) => {
      if (!idx.has(e.from) || !idx.has(e.to)) return;
      const u = idx.get(e.from), v = idx.get(e.to);
      const a = L.pos[u], b = L.pos[v];
      const isBack = L.back.has(ei) || e.kind === 'back', kind = isBack ? 'back' : e.kind || 'seq';
      const color = EDGE[kind] || '#64748B';
      const mid = a.clone().add(b).multiplyScalar(.5);
      const out = V(mid.x, 0, mid.z);
      if (out.lengthSq() < .01) out.set(1, 0, 0);
      out.normalize();
      mid.add(isBack ? out.multiplyScalar(2.6) : V(0, 0, 0).add(out.multiplyScalar(a.distanceTo(b) * .08)));
      if (a.equals(b)) mid.add(V(1.4, .8, 0));

      const curve = new T.QuadraticBezierCurve3(a, mid, b);
      const tubeGeo = new T.TubeGeometry(curve, 24, isBack ? .035 : .042, 8);
      const tube = new T.Mesh(tubeGeo, new T.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0.35, roughness: 0.3, transparent: true, opacity: isBack ? .8 : .9}));
      const cone = new T.Mesh(new T.ConeGeometry(.13, .36, 12), new T.MeshStandardMaterial({color, emissive: color, emissiveIntensity: 0.5}));
      const tp = curve.getPoint(.82), tg = curve.getTangent(.82);
      cone.position.copy(tp);
      cone.quaternion.setFromUnitVectors(V(0, 1, 0), tg);
      root3.add(tube, cone);

      let labelObj = null;
      if (e.label && e.label !== '' && kind !== 'seq') {
        labelObj = S3.label(e.label, {color, line: .24, weight: 800});
        labelObj.position.copy(curve.getPoint(.5)).add(V(0, .24, 0));
        root3.add(labelObj);
      }

      edgeObjs.push({tube, cone, from: e.from, to: e.to, curve, kind, labelObj, color});
    });
  };

  makeEdges();
  st.fit(L.pos, 1.15, [.5, .35, 1]);

  let sel = null, hov = null;
  const paint = () => {
    meshes.forEach(m => {
      const on = m === sel, hv = m === hov;
      m.material.emissiveIntensity = on ? .95 : hv ? .65 : (m.userData.n.dim ? .02 : .25);
      m.scale.setScalar(on || hv ? 1.14 : 1);
    });
    const sid = sel ? sel.userData.n.id : null;
    edgeObjs.forEach(e => {
      const hit = sid && (e.from === sid || e.to === sid);
      const o = !sid ? .88 : hit ? 1 : .15;
      e.tube.material.opacity = o;
      e.cone.material.opacity = o;
      if (e.labelObj) e.labelObj.visible = !sid || hit;
    });
  };

  const select = id => {
    sel = meshes.find(m => m.userData.n.id === id) || null;
    paint();
    if (sel && onSelect) onSelect(sel.userData.n);
  };

  st.hover(() => meshes, (h, ev) => {
    hov = h ? h.object : null;
    paint();
    if (!h) return st.hideTip();
    const n = hov.userData.n;
    st.showTip(S3.tipHtml(n.tipTitle || n.label || n.id, n.tip || []), ev);
  });

  st.click(() => meshes, h => {
    if (h) {
      select(h.object.userData.n.id);
    } else {
      sel = null;
      paint();
      if (onSelect) onSelect(null);
    }
  });

  /* Interactive Program Counter (PC) Walking Orb */
  let run = null, orb = null;
  const outs = id => edgeObjs.filter(e => e.from === id);

  const initSim = () => {
    if (orb) { root3.remove(orb); orb = null; }
    run = null;
    const start = nodes[idx.has(root) ? idx.get(root) : 0];
    if (!start) return false;
    orb = new T.Mesh(new T.SphereGeometry(.26, 20, 16), new T.MeshStandardMaterial({color: '#FFD84D', emissive: '#FFD84D', emissiveIntensity: 1.0}));
    const g = S3.glow('#FFD84D', 2.0, .95);
    orb.add(g);
    root3.add(orb);
    orb.position.copy(L.pos[idx.get(start.id)]);
    run = {cur: start.id, e: null, t: 0, steps: 0, visits: {}, paused: false};
    if (onSimStep) onSimStep({block: start, step: 0, msg: `Program Counter at Entry block: ${start.label || start.id}`});
    return true;
  };

  st.simulate = on => {
    if (!on) {
      if (orb) { root3.remove(orb); orb = null; }
      run = null;
      return false;
    }
    return initSim();
  };

  st.simPlay = () => { if (!run) initSim(); if (run) run.paused = false; };
  st.simPause = () => { if (run) run.paused = true; };
  st.simStep = () => {
    if (!run) initSim();
    if (!run) return;
    const o = outs(run.cur);
    if (!o.length) {
      if (onSimStep) onSimStep({block: nodes[idx.get(run.cur)], step: run.steps, msg: `Reached Exit block: ${run.cur}`});
      return;
    }
    const targetEdge = o.find(e => e.kind === 'true' && !run.visits[run.cur + 't']) || o[Math.floor(Math.random() * o.length)];
    run.visits[run.cur + 't'] = 1;
    run.cur = targetEdge.to;
    run.steps++;
    orb.position.copy(L.pos[idx.get(run.cur)]);
    const targetNode = nodes[idx.get(run.cur)];
    select(run.cur);
    if (onSimStep) onSimStep({
      block: targetNode,
      step: run.steps,
      edge: targetEdge,
      msg: `Step ${run.steps}: Took ${targetEdge.kind.toUpperCase()} branch to block ${targetNode.label || targetNode.id}`
    });
  };
  st.simReset = () => { initSim(); };

  // Morph to Dominator Tree or Tower
  st.setLayout = newLayout => {
    currentLayout = newLayout;
    L = currentLayout === 'domtree' ? layoutDomTree(nodes) :
        currentLayout === 'tree' ? layoutTree(nodes, edges) :
        currentLayout === 'force' ? layoutForce(nodes, edges) :
        layoutTower(nodes, edges, root || (nodes[0] && nodes[0].id));

    // Smoothly animate nodes to new positions
    meshes.forEach((m, i) => {
      m.userData.targetPos = L.pos[i] ? L.pos[i].clone() : V(0, 0, 0);
    });
    makeEdges();
    st.fit(L.pos, 1.15, [.5, .35, 1]);
  };

  // Search & Camera Fly-To for AST
  st.searchAndFly = query => {
    if (!query) return null;
    const q = query.toLowerCase();
    const hit = meshes.find(m => {
      const lbl = (m.userData.n.label || '').toLowerCase();
      const tip = (m.userData.n.tipTitle || '').toLowerCase();
      return lbl.includes(q) || tip.includes(q);
    });
    if (hit) {
      select(hit.userData.n.id);
      const targetPos = hit.position.clone();
      st.camera.position.set(targetPos.x + 4, targetPos.y + 2, targetPos.z + 8);
      if (st.controls) {
        st.controls.target.copy(targetPos);
        st.controls.update();
      }
      return hit.userData.n;
    }
    return null;
  };

  // Main animation loop
  st.onTick((dt, t) => {
    // Smooth node transitions if layout changed
    meshes.forEach(m => {
      if (m.userData.targetPos) {
        m.position.lerp(m.userData.targetPos, Math.min(1, dt * 5));
        if (m.userData.glow) m.userData.glow.position.copy(m.position);
        if (m.userData.labelMesh) {
          const sz = m.userData.n.size || [1.4, .7, 1.4];
          m.userData.labelMesh.position.copy(m.position).add(V(0, sz[1] / 2 + .42, 0));
        }
      }
    });

    if (!run || run.paused) return;

    if (!run.e) {
      const o = outs(run.cur);
      run.steps++;
      if (!o.length || run.steps > 90) {
        run.t += dt;
        if (orb) orb.position.copy(L.pos[idx.get(run.cur)]);
        if (run.t > 1.4) st.simulate(true);
        return;
      }
      const fresh = o.filter(e => !(run.visits[e.to] > 2));
      const pool = fresh.length ? fresh : o;
      run.e = pool.find(e => e.kind === 'true' && !run.visits[run.cur + 't']) || pool[Math.floor(Math.random() * pool.length)];
      run.visits[run.cur + 't'] = 1;
      run.t = 0;
    }

    run.t += dt * 1.2;
    const p = Math.min(1, run.t);
    if (orb && run.e && run.e.curve) {
      orb.position.copy(run.e.curve.getPoint(p));
    }
    if (p >= 1 && run.e) {
      run.visits[run.e.to] = (run.visits[run.e.to] || 0) + 1;
      run.cur = run.e.to;
      const targetNode = nodes[idx.get(run.cur)];
      if (onSimStep) onSimStep({
        block: targetNode,
        step: run.steps,
        edge: run.e,
        msg: `PC advanced to block ${targetNode.label || targetNode.id}`
      });
      run.e = null;
      run.t = 0;
    }
  });

  st.select = select;
  st.nodeCount = nodes.length;
  el.insertAdjacentHTML('beforeend', '<div class="s3-legend"><em>drag = rotate · right-drag = pan · scroll = zoom · click node to inspect</em></div>');
  return st;
};

/* ---------- Enhanced 3D Code City ---------- */
S3.city = (el, {left, right, onPick}) => {
  const st = S3.mount(el, {camera: [0, 24, 40], target: [0, 0, 0], autoRotate: false});
  if (!st) return S3.fallback(el);
  const P = S3.pal();
  const COLORS = {
    normal: '#93C5FD',
    removed: '#F43F5E',
    changed: '#FB923C',
    added: '#34D399',
    blank: '#E2E8F0'
  };
  const districts = [];

  const build = (side, data, x0, title) => {
    const lines = data.lines, N = lines.length;
    const cols = Math.max(4, Math.ceil(Math.sqrt(N * 1.5))), rows = Math.ceil(N / cols), cell = 1.15;
    const inst = new T.InstancedMesh(
      new T.BoxGeometry(.92, 1, .92),
      new T.MeshStandardMaterial({roughness: .35, metalness: .2, emissive: 0xffffff, emissiveIntensity: .06}),
      Math.max(1, N)
    );
    const d = new T.Object3D(), c = new T.Color(), info = [];

    lines.forEach((txt, i) => {
      const len = txt.trim().length;
      const mark = data.marks[i + 1] || (len ? 'normal' : 'blank');
      const targetH = len ? .35 + Math.min(len, 90) / 90 * 4.6 : .08;
      const col = i % cols, row = Math.floor(i / cols);
      const px = x0 + (col - cols / 2) * cell;
      const pz = (row - rows / 2) * cell;

      d.position.set(px, targetH / 2, pz);
      d.scale.set(1, targetH, 1);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
      inst.setColorAt(i, c.set(COLORS[mark]));

      info.push({line: i + 1, txt, mark, targetH, currentH: 0.05, p: new T.Vector3(px, targetH / 2, pz), col, row});
    });

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.userData = {side, info, cols, cell, x0};
    st.scene.add(inst);

    // City Ground Base
    const w = cols * cell + 2.5, dd = rows * cell + 2.5;
    const base = new T.Mesh(
      new T.BoxGeometry(w, .35, dd),
      new T.MeshStandardMaterial({color: P.floor, transparent: true, opacity: .85, roughness: .85})
    );
    base.position.set(x0, -.18, 0);
    st.scene.add(base);

    // Glowing Perimeter Border
    const border = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(w, .36, dd)),
      new T.LineBasicMaterial({color: side === 'left' ? '#3B82F6' : '#10B981', transparent: true, opacity: 0.8})
    );
    border.position.copy(base.position);
    st.scene.add(border);

    // District Holographic Title Banner
    const t = S3.label(title + '\n' + N + ' Lines of Code', {color: P.text, line: .85, weight: 800});
    t.position.set(x0, 7.5, -dd / 2 - 1.2);
    st.scene.add(t);

    districts.push({inst, info, x0, w, dd, buildTime: 0});
    return {w, dd};
  };

  const lw = Math.ceil(Math.sqrt(left.lines.length * 1.5)) * 1.15 + 2.5;
  const rw = Math.ceil(Math.sqrt(right.lines.length * 1.5)) * 1.15 + 2.5;
  const off = (lw + rw) / 2 + 5;

  build('left', left, -off / 2, 'ORIGINAL CODEBASE');
  build('right', right, off / 2, 'OPTIMIZED COMPILER CODEBASE');

  // Animated Highway / Optimization Bridge connecting both cities
  const bridgePts = [
    V(-off / 2 + lw / 2, 0.2, 0),
    V(0, 1.2, 0),
    V(off / 2 - rw / 2, 0.2, 0)
  ];
  const bridgeCurve = new T.CatmullRomCurve3(bridgePts);
  const bridgeMesh = new T.Mesh(
    new T.TubeGeometry(bridgeCurve, 32, 0.12, 8),
    new T.MeshStandardMaterial({color: 0x10B981, emissive: 0x10B981, emissiveIntensity: 0.5, transparent: true, opacity: 0.7})
  );
  st.scene.add(bridgeMesh);

  // Traveling Data Photons across the bridge
  const photon = new T.Mesh(new T.SphereGeometry(0.35, 16, 12), new T.MeshBasicMaterial({color: 0xFFD84D}));
  photon.add(S3.glow(0xFFD84D, 2.5, 0.9));
  st.scene.add(photon);

  // Target Beacon for selected line
  const beacon = new T.Mesh(
    new T.CylinderGeometry(.15, .15, 34, 12),
    new T.MeshBasicMaterial({color: '#FFD84D', transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false})
  );
  beacon.visible = false;
  st.scene.add(beacon);

  let cameraTargetPos = null, controlsTargetPos = null;

  st.focus = (side, line) => {
    const d = districts.find(x => x.inst.userData.side === side);
    const it = d && d.info[line - 1];
    if (!it) return beacon.visible = false;
    beacon.visible = true;
    beacon.position.set(it.p.x, 17, it.p.z);
    cameraTargetPos = V(it.p.x + 8, 14, it.p.z + 16);
    controlsTargetPos = V(it.p.x, 1, it.p.z);
  };

  st.flyTo = st.focus;

  // Staggered City Rise Animation on tick
  const dummy = new T.Object3D();
  st.onTick((dt, t) => {
    // Animate city construction growth on load (only for compact sets to preserve 60 FPS)
    districts.forEach(dst => {
      dst.buildTime += dt;
      if (dst.buildTime < 2.0 && dst.info.length < 200) {
        let changed = false;
        dst.info.forEach((it, idx) => {
          const delay = (it.col + it.row) * 0.03;
          const p = Math.max(0, Math.min(1, (dst.buildTime - delay) / 0.7));
          const curH = S3.ease(p) * it.targetH;
          dummy.position.set(it.p.x, curH / 2, it.p.z);
          dummy.scale.set(1, curH, 1);
          dummy.updateMatrix();
          dst.inst.setMatrixAt(idx, dummy.matrix);
          changed = true;
        });
        if (changed) dst.inst.instanceMatrix.needsUpdate = true;
      }
    });

    // Move photon across bridge
    const bridgeProgress = (t * 0.5) % 1;
    photon.position.copy(bridgeCurve.getPoint(bridgeProgress));

    // Smooth camera glide if target is set
    if (cameraTargetPos) {
      st.camera.position.lerp(cameraTargetPos, Math.min(1, dt * 4));
      if (st.camera.position.distanceTo(cameraTargetPos) < 0.1) cameraTargetPos = null;
    }
    if (controlsTargetPos && st.controls) {
      st.controls.target.lerp(controlsTargetPos, Math.min(1, dt * 4));
      st.controls.update();
      if (st.controls.target.distanceTo(controlsTargetPos) < 0.1) controlsTargetPos = null;
    }
  });

  st.hover(() => districts.map(d => d.inst), (h, ev) => {
    if (!h || h.instanceId == null) return st.hideTip();
    const d = h.object.userData, it = d.info[h.instanceId];
    const lbl = {removed: 'removed / replaced', changed: 'modified', added: 'added', normal: 'unchanged', blank: 'blank'}[it.mark];
    st.showTip(S3.tipHtml(`${d.side === 'left' ? 'Original' : 'Optimized'} · Line ${it.line}`, [
      `<code>${(it.txt.trim().slice(0, 75) || '(blank)').replace(/</g, '&lt;')}</code>`,
      `<i style="color:${COLORS[it.mark]}">●</i> Status: <b>${lbl}</b>`
    ]), ev);
  });

  st.click(() => districts.map(d => d.inst), h => {
    if (h && h.instanceId != null && onPick) {
      const d = h.object.userData;
      onPick(d.side, d.info[h.instanceId].line);
    }
  });

  st.camera.position.set(0, off * .52 + 10, off * .72 + 18);
  if (st.controls) st.controls.target.set(0, 0, 0);

  el.insertAdjacentHTML('beforeend', `<div class="s3-legend">${Object.entries({unchanged: COLORS.normal, modified: COLORS.changed, removed: COLORS.removed, added: COLORS.added}).map(([k, v]) => `<span><i style="background:${v}"></i>${k}</span>`).join('')}<em>1 skyscraper = 1 line · height = line complexity</em></div>`);
  return st;
};

/* ---------- Module Hub (Dashboard) ---------- */
S3.hub = (el, items, onGo) => {
  const st = S3.mount(el, {camera: [0, 7, 15], target: [0, 0, 0], autoRotate: true, autoRotateSpeed: .5, minDist: 6, maxDist: 30});
  if (!st) return S3.fallback(el);
  const P = S3.pal();
  const core = new T.Mesh(new T.IcosahedronGeometry(1.5, 2), new T.MeshStandardMaterial({color: '#4285F4', emissive: '#4285F4', emissiveIntensity: .45, roughness: .25, metalness: .4, flatShading: true}));
  st.scene.add(core);
  const cg = S3.glow('#7AA8FF', 7, .6);
  st.scene.add(cg);
  const ct = S3.label('Smart Python\nOptimizer', {color: '#fff', line: .34, weight: 800});
  ct.position.y = 0;
  st.scene.add(ct);

  const planets = [], rings = [[4.2, 0], [6.6, 1]];
  rings.forEach(([r, k]) => {
    const ring = new T.Mesh(new T.RingGeometry(r - .015, r + .015, 128), new T.MeshBasicMaterial({color: P.line, transparent: true, opacity: .35, side: T.DoubleSide}));
    ring.rotation.x = -Math.PI / 2;
    st.scene.add(ring);
  });

  items.forEach((it, i) => {
    const k = i < 5 ? 0 : 1, cnt = k ? items.length - 5 : 5, j = k ? i - 5 : i, r = rings[k][0], col = S3.PAL[i % 6];
    const g = new T.Group();
    const m = new T.Mesh(new T.SphereGeometry(.62, 28, 20), new T.MeshStandardMaterial({color: col, roughness: .3, metalness: .25, emissive: col, emissiveIntensity: .22}));
    g.add(m);
    const ic = S3.label(it.icon, {line: .62, depthTest: true});
    ic.position.set(0, 0, .75);
    g.add(ic);
    const tx = S3.label(it.label, {color: P.text, line: .26, weight: 700});
    tx.position.y = -1.05;
    g.add(tx);
    g.userData = {r, a0: j / cnt * Math.PI * 2 + k * .5, sp: (k ? .07 : .12) * (k ? -1 : 1), it, m, y: (k ? -.4 : .3)};
    st.scene.add(g);
    planets.push(g);
  });

  let hov = null;
  st.onTick((dt, t) => {
    core.rotation.y += dt * .4;
    core.rotation.x += dt * .15;
    core.scale.setScalar(1 + Math.sin(t * 2) * .03);
    planets.forEach(g => {
      const u = g.userData;
      u.a0 += u.sp * dt;
      g.position.set(Math.cos(u.a0) * u.r, u.y + Math.sin(t + u.r) * .15, Math.sin(u.a0) * u.r);
      g.scale.setScalar(g === hov ? 1.3 : 1);
      u.m.rotation.y += dt;
    });
  });

  st.hover(() => planets.map(g => g.userData.m), (h, ev) => {
    hov = h ? h.object.parent : null;
    if (st.controls) st.controls.autoRotate = !h;
    if (!h) return st.hideTip();
    st.showTip(S3.tipHtml(hov.userData.it.label, ['click to open']), ev);
  });

  st.click(() => planets.map(g => g.userData.m), h => {
    if (h) onGo(h.object.parent.userData.it.id);
  });

  el.insertAdjacentHTML('beforeend', '<div class="s3-legend"><em>click a planet to open that module · drag to rotate</em></div>');
  return st;
};
})();
