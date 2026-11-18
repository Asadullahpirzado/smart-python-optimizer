/* 3D charts: bars, curves (growth), pie/donut, history helix, Big-O Complexity Terrain, Master Theorem 3D */
(() => {
'use strict';
const T = window.THREE, S3 = window.SPO3D;
if (!T || !S3) return;
const num = v => v == null || isNaN(v) ? '–' : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(1) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + 'k' : String(+Number(v).toFixed(v < 10 ? 2 : 1));
S3.num = num;
const legend = (el, items) => el.insertAdjacentHTML('beforeend', `<div class="s3-legend">${items.map(i => `<span><i style="background:${i.color}"></i>${i.name}</span>`).join('')}<em>drag to rotate · scroll to zoom</em></div>`);
const floor = (w, d, P, y = 0) => {
  const g = new T.Group(), plane = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({color: P.floor, transparent: true, opacity: .75, roughness: .9, metalness: 0}));
  plane.rotation.x = -Math.PI / 2; plane.position.y = y - .01; g.add(plane);
  const grid = new T.GridHelper(Math.max(w, d), Math.round(Math.max(w, d) / 1.2), P.grid, P.grid); grid.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d)); grid.position.y = y; grid.material.transparent = true; grid.material.opacity = .55; g.add(grid); return g;
};
const mat = (color, o = {}) => new T.MeshStandardMaterial({color, roughness: .32, metalness: .25, emissive: color, emissiveIntensity: .14, ...o});

/* ---------- grouped columns ---------- */
S3.bars = (el, {labels, series, unit = '', log = false}) => {
  const st = S3.mount(el, {camera: [0, 6, 14], autoRotate: true, target: [0, 1.8, 0]}); if (!st) return S3.fallback(el);
  const P = S3.pal(), ns = series.length, nl = labels.length, bw = .62, grpW = ns * bw + (ns - 1) * .08, step = grpW + .9, W = nl * step, H = 5;
  const all = series.flatMap(s => s.values).filter(v => v > 0), mx = Math.max(...all, 1e-9);
  const hOf = v => v <= 0 ? .04 : Math.max(.08, (log ? Math.log10(1 + v) / Math.log10(1 + mx) : v / mx) * H);
  st.scene.add(floor(W + 2, grpW + 3, P));
  const bars = [];
  labels.forEach((lb, i) => {
    const gx = (i - (nl - 1) / 2) * step;
    series.forEach((s, k) => {
      const v = s.values[i], h = hOf(v), m = new T.Mesh(new T.BoxGeometry(bw, 1, bw), mat(s.color));
      m.position.set(gx + (k - (ns - 1) / 2) * (bw + .08), .001, 0); m.scale.y = .001; m.userData = {h, v, name: s.name, label: lb, delay: i * .06 + k * .03, base: s.color}; bars.push(m); st.scene.add(m);
      const t = S3.label(num(v), {color: P.text, line: .3, weight: 700}); t.position.set(m.position.x, h + .4, 0); t.visible = false; m.userData.tag = t; st.scene.add(t);
    });
    const l = S3.label(String(lb), {color: P.muted, line: .32}); l.position.set(gx, -.05, grpW / 2 + 1); st.scene.add(l);
  });
  for (let k = 0; k <= 4; k++) { const y = (k / 4) * H, val = log ? Math.pow(10, (k / 4) * Math.log10(1 + mx)) - 1 : mx * k / 4; const t = S3.label(num(val) + (k === 4 ? ' ' + unit : ''), {color: P.muted, line: .26, weight: 500}); t.position.set(-W / 2 - 1.4, y, 0); st.scene.add(t);
    const ln = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-W / 2 - .3, y, -grpW / 2 - 1.2), new T.Vector3(W / 2 + .3, y, -grpW / 2 - 1.2)]), new T.LineBasicMaterial({color: P.grid, transparent: true, opacity: .5})); st.scene.add(ln); }
  st.onTick((dt, t) => { bars.forEach(b => { const p = S3.ease((t - b.userData.delay) / .9); b.scale.y = Math.max(.001, b.userData.h * p); b.position.y = b.scale.y / 2; if (p >= 1) b.userData.tag.visible = true; }); });
  let last = null; st.hover(() => bars, (h, ev) => {
    if (last && last !== (h && h.object)) { last.material.emissiveIntensity = .14; last = null; }
    if (!h) return st.hideTip(); last = h.object; last.material.emissiveIntensity = .55; const u = last.userData;
    st.showTip(S3.tipHtml(`<span style="color:${u.base}">●</span> ${u.name}`, [`${u.label}: <b>${num(u.v)} ${unit}</b>`]), ev); });
  st.fitView = () => st.reset(); legend(el, series.map(s => ({name: s.name, color: s.color}))); return st;
};

/* ---------- growth curves (one tube + ribbon per series) ---------- */
S3.curves = (el, {xs, series, log = true, unit = 'ops'}) => {
  const st = S3.mount(el, {camera: [-2, 6, 15], autoRotate: true, target: [0, 2.6, 0]}); if (!st) return S3.fallback(el);
  const P = S3.pal(), W = 14, H = 6, ns = series.length, dz = 2.6, n = xs.length, all = series.flatMap(s => s.values).filter(v => v > 0), mx = Math.max(...all, 1);
  const yOf = v => v <= 0 ? 0 : (log ? Math.log10(1 + v) / Math.log10(1 + mx) : v / mx) * H, xOf = i => (n === 1 ? 0 : (i / (n - 1) - .5) * W);
  st.scene.add(floor(W + 3, ns * dz + 2, P));
  xs.forEach((x, i) => { const l = S3.label(String(x), {color: P.muted, line: .3}); l.position.set(xOf(i), -.05, (ns * dz) / 2 + 1.2); st.scene.add(l); });
  const ax = S3.label('input size n', {color: P.text, line: .32, weight: 700}); ax.position.set(0, -.05, (ns * dz) / 2 + 2.2); st.scene.add(ax);
  for (let k = 0; k <= 4; k++) { const y = (k / 4) * H, val = log ? Math.pow(10, (k / 4) * Math.log10(1 + mx)) - 1 : mx * k / 4; const t = S3.label(num(val), {color: P.muted, line: .26, weight: 500}); t.position.set(-W / 2 - 1.3, y, -(ns * dz) / 2); st.scene.add(t); }
  const tubes = [], dots = [];
  series.forEach((s, k) => {
    const z = (k - (ns - 1) / 2) * dz, pts = s.values.map((v, i) => new T.Vector3(xOf(i), yOf(v), z)), curve = new T.CatmullRomCurve3(pts, false, 'catmullrom', .4);
    const tube = new T.Mesh(new T.TubeGeometry(curve, 120, .1, 10, false), mat(s.color, {emissiveIntensity: .35})); st.scene.add(tube); tubes.push(tube);
    const samp = curve.getPoints(120), pos = [], idx = []; samp.forEach((p, i) => { pos.push(p.x, Math.max(0, p.y), z, p.x, 0, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); const rib = new T.Mesh(rg, new T.MeshBasicMaterial({color: s.color, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false})); st.scene.add(rib); tube.userData.rib = rib;
    pts.forEach((p, i) => { const d = new T.Mesh(new T.SphereGeometry(.17, 16, 12), mat(s.color, {emissiveIntensity: .5})); d.position.copy(p); d.userData = {name: s.name, n: xs[i], v: s.values[i], c: s.color}; st.scene.add(d); dots.push(d); });
    const nm = S3.label(s.name, {color: '#fff', bg: s.color, line: .3, pad: 10}); nm.position.set(W / 2 + 1.6, yOf(s.values[n - 1]), z); st.scene.add(nm);
  });
  st.onTick((dt, t) => { const p = S3.ease(t / 1.6); tubes.forEach(tb => { const g = tb.geometry, c = g.index.count; g.setDrawRange(0, Math.floor(c * p / 3) * 3); }); dots.forEach((d, i) => { d.visible = p > (i % n) / n; }); });
  let last = null; st.hover(() => dots, (h, ev) => { if (last) { last.scale.setScalar(1); last = null; } if (!h) return st.hideTip(); last = h.object; last.scale.setScalar(1.6); const u = last.userData; st.showTip(S3.tipHtml(`<span style="color:${u.c}">●</span> ${u.name}`, [`n = <b>${u.n}</b>`, `≈ <b>${num(u.v)}</b> ${unit}`]), ev); });
  legend(el, series.map(s => ({name: s.name, color: s.color}))); return st;
};

/* ---------- donut ---------- */
S3.pie = (el, {items}) => {
  const st = S3.mount(el, {camera: [0, 7.5, 8.5], autoRotate: true, target: [0, 0, 0]}); if (!st) return S3.fallback(el);
  const P = S3.pal(), total = items.reduce((a, b) => a + b.value, 0) || 1, R = 3, r0 = 1.25, parts = []; let a0 = 0;
  items.forEach(it => {
    const a1 = a0 + (it.value / total) * Math.PI * 2 - (items.length > 1 ? .025 : 0), sh = new T.Shape(); sh.moveTo(R * Math.cos(a0), R * Math.sin(a0)); sh.absarc(0, 0, R, a0, a1, false); sh.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1)); sh.absarc(0, 0, r0, a1, a0, true); sh.closePath();
    const m = new T.Mesh(new T.ExtrudeGeometry(sh, {depth: .8, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2, curveSegments: 24}), mat(it.color)); m.rotation.x = -Math.PI / 2;
    const mid = (a0 + a1) / 2; m.userData = {it, dir: new T.Vector3(Math.cos(mid), 0, -Math.sin(mid)), pct: 100 * it.value / total, out: 0, grow: 0}; st.scene.add(m); parts.push(m);
    const l = S3.label(`${it.label}\n${Math.round(100 * it.value / total)}%`, {color: P.text, line: .3}); l.position.set(Math.cos(mid) * (R + 1.5), 1.1, -Math.sin(mid) * (R + 1.5)); st.scene.add(l); a0 = a1 + (items.length > 1 ? .025 : 0);
  });
  const ctr = S3.label(String(total), {color: P.text, line: .8, weight: 800}); ctr.position.set(0, 1.2, 0); st.scene.add(ctr); const sub = S3.label('optimizations', {color: P.muted, line: .26}); sub.position.set(0, .6, 0); st.scene.add(sub);
  let hov = null; st.onTick((dt, t) => parts.forEach(m => { m.userData.out += ((m === hov ? .45 : 0) - m.userData.out) * Math.min(1, dt * 10); m.userData.grow = Math.min(1, m.userData.grow + dt * 1.4); m.position.copy(m.userData.dir).multiplyScalar(m.userData.out); m.scale.z = S3.ease(m.userData.grow); }));
  st.hover(() => parts, (h, ev) => { hov = h ? h.object : null; if (!h) return st.hideTip(); const u = hov.userData; st.showTip(S3.tipHtml(`<span style="color:${u.it.color}">●</span> ${u.it.label}`, [`<b>${u.it.value}</b> change(s) · ${u.pct.toFixed(1)}%`]), ev); });
  legend(el, items.map(i => ({name: i.label, color: i.color}))); return st;
};

/* ---------- history helix ---------- */
S3.helix = (el, {items}) => {
  const st = S3.mount(el, {camera: [0, 1, 11], autoRotate: true}); if (!st) return S3.fallback(el);
  const P = S3.pal(), n = items.length, pts = items.map((_, i) => new T.Vector3(Math.cos(i * .75) * 3, (i - (n - 1) / 2) * .55, Math.sin(i * .75) * 3));
  if (n > 1) { const t = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 12, .03, 6), new T.MeshBasicMaterial({color: P.line, transparent: true, opacity: .5})); st.scene.add(t); }
  const mx = Math.max(1, ...items.map(i => i.value)), spheres = items.map((it, i) => { const m = new T.Mesh(new T.SphereGeometry(.2 + .5 * (it.value / mx), 24, 16), mat(it.color)); m.position.copy(pts[i]); m.userData = it; st.scene.add(m); return m; });
  st.fit(pts.length ? pts : [new T.Vector3()], 1.1, [0, .2, 1]); st.onTick((dt, t) => spheres.forEach((m, i) => { m.position.x = pts[i].x; m.scale.setScalar(1 + Math.sin(t * 2 + i) * .04); }));
  let last = null; st.hover(() => spheres, (h, ev) => { if (last) { last.material.emissiveIntensity = .14; last = null; } if (!h) return st.hideTip(); last = h.object; last.material.emissiveIntensity = .6; st.showTip(last.userData.tip, ev); });
  legend(el, [{name: 'size = optimizations applied', color: '#4285F4'}, {name: 'green = measured speed-up', color: '#34D399'}]); return st;
};

/* ---------- 3D Big-O Complexity Terrain ---------- */
S3.complexityTerrain = (el, {currentClass = 'O(n)', originalClass = 'O(n^2)'} = {}) => {
  const st = S3.mount(el, {camera: [0, 12, 22], autoRotate: true, autoRotateSpeed: 0.4, target: [0, 2, 0]});
  if (!st) return S3.fallback(el);
  const P = S3.pal();

  // Create undulating 3D landscape of complexity classes
  const CLASSES = [
    {name: 'O(1)', color: '#3B82F6', fn: (x, z) => 0.4},
    {name: 'O(log n)', color: '#0EA5E9', fn: (x, z) => 0.8 + Math.log2(x + 1) * 0.7},
    {name: 'O(n)', color: '#10B981', fn: (x, z) => 0.5 + x * 0.3},
    {name: 'O(n log n)', color: '#F59E0B', fn: (x, z) => 0.5 + (x * 0.22) * Math.log2(x + 1) * 0.4},
    {name: 'O(n^2)', color: '#F97316', fn: (x, z) => 0.4 + (x * x * 0.038)},
    {name: 'O(2^n)', color: '#EF4444', fn: (x, z) => 0.4 + Math.min(10, Math.pow(1.4, x) * 0.25)}
  ];

  const W = 18, D = 14, segX = 36, segZ = 24;
  const geo = new T.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  const c1 = new T.Color('#3B82F6'), c2 = new T.Color('#10B981'), c3 = new T.Color('#F59E0B'), c4 = new T.Color('#EF4444');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = (x / (W / 2) + 1) * 4; // normalized 0 to 8
    const nz = (z / (D / 2) + 1) / 2; // normalized 0 to 1

    // Interpolate terrain elevation
    const elevation = Math.pow(nx * 0.35, 2.1) * (0.6 + nz * 0.6) + Math.sin(x * 0.8) * 0.3;
    pos.setY(i, Math.max(0, elevation));

    // Vertex color based on elevation
    const tElev = Math.min(1, elevation / 7);
    const vColor = tElev < 0.33 ? c1.clone().lerp(c2, tElev / 0.33) :
                   tElev < 0.66 ? c2.clone().lerp(c3, (tElev - 0.33) / 0.33) :
                   c3.clone().lerp(c4, (tElev - 0.66) / 0.34);
    colors.push(vColor.r, vColor.g, vColor.b);
  }

  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const terrainMat = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.15,
    wireframe: false,
    side: T.DoubleSide
  });

  const terrainMesh = new T.Mesh(geo, terrainMat);
  st.scene.add(terrainMesh);

  // Wireframe contour overlay
  const wireMat = new T.MeshBasicMaterial({color: P.grid, wireframe: true, transparent: true, opacity: 0.25});
  const wireMesh = new T.Mesh(geo, wireMat);
  wireMesh.position.y = 0.02;
  st.scene.add(wireMesh);

  // Ribbons and labels along the terrain
  CLASSES.forEach((cls, idx) => {
    const x = -W / 2 + 1.5 + (idx / (CLASSES.length - 1)) * (W - 3);
    const tag = S3.label(cls.name, {color: '#fff', bg: cls.color, line: 0.28, pad: 6});
    tag.position.set(x, 0.4 + idx * 0.9, D / 2 + 1.2);
    st.scene.add(tag);
  });

  // Animated Probe: Trajectory Ball tracing current program's Big-O
  const probeBall = new T.Mesh(new T.SphereGeometry(0.4, 20, 16), new T.MeshStandardMaterial({color: 0x10B981, emissive: 0x10B981, emissiveIntensity: 0.8}));
  probeBall.add(S3.glow(0x10B981, 2.4, 0.9));
  const probeTag = S3.label(`Optimized: ${currentClass}`, {color: '#10B981', line: 0.32, weight: 800});
  probeTag.position.y = 0.9;
  probeBall.add(probeTag);
  st.scene.add(probeBall);

  // Original Probe Ball
  const origBall = new T.Mesh(new T.SphereGeometry(0.35, 20, 16), new T.MeshStandardMaterial({color: 0xF97316, emissive: 0xF97316, emissiveIntensity: 0.8}));
  origBall.add(S3.glow(0xF97316, 2.2, 0.9));
  const origTag = S3.label(`Original: ${originalClass}`, {color: '#F97316', line: 0.3, weight: 800});
  origTag.position.y = 0.8;
  origBall.add(origTag);
  st.scene.add(origBall);

  st.onTick((dt, t) => {
    const p1 = (t * 0.4) % 1;
    const px1 = -W / 2 + 2 + p1 * (W - 4);
    const pz1 = 0;
    const py1 = 0.8 + Math.pow((p1 * 4) * 0.35, 1.8);
    probeBall.position.set(px1, py1, pz1);

    const p2 = ((t + 1.5) * 0.35) % 1;
    const px2 = -W / 2 + 2 + p2 * (W - 4);
    const pz2 = 2.5;
    const py2 = 0.8 + Math.pow((p2 * 4) * 0.45, 2.4);
    origBall.position.set(px2, py2, pz2);
  });

  legend(el, CLASSES.map(c => ({name: c.name, color: c.color})));
  return st;
};

/* ---------- 3D Master Theorem Recursion Solver Visualizer ---------- */
S3.masterTheorem3D = (el, {a = 2, b = 2, k = 1} = {}) => {
  const st = S3.mount(el, {camera: [0, 4, 14], autoRotate: true, autoRotateSpeed: 0.3, target: [0, -1, 0]});
  if (!st) return S3.fallback(el);
  const P = S3.pal();

  // Draw 3D Recursion Tree for T(n) = a T(n/b) + O(n^k)
  const treeGroup = new T.Group();
  st.scene.add(treeGroup);

  const maxDepth = 4;
  const drawNode = (x, y, z, depth, w) => {
    if (depth > maxDepth) return;
    const geo = new T.SphereGeometry(0.35 / (depth + 1) + 0.1, 16, 12);
    const col = depth === 0 ? '#3B82F6' : depth === 1 ? '#0EA5E9' : depth === 2 ? '#10B981' : '#F59E0B';
    const node = new T.Mesh(geo, mat(col, {emissiveIntensity: 0.4}));
    node.position.set(x, y, z);
    treeGroup.add(node);

    const branches = Math.min(a, 4);
    const nextW = w / branches;
    for (let i = 0; i < branches; i++) {
      const nextX = x - w / 2 + (i + 0.5) * nextW;
      const nextY = y - 1.8;
      const nextZ = z + (i - (branches - 1) / 2) * 0.6;

      const pts = [new T.Vector3(x, y, z), new T.Vector3(nextX, nextY, nextZ)];
      const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({color: P.line, transparent: true, opacity: 0.6}));
      treeGroup.add(line);

      drawNode(nextX, nextY, nextZ, depth + 1, nextW);
    }
  };

  drawNode(0, 3, 0, 0, 10);

  // Label for Recurrence Equation
  const logbA = Math.log(a) / Math.log(b);
  let caseResult = '';
  if (logbA > k) {
    caseResult = `Case 1: T(n) = Θ(n^{log_${b}(${a})}) = Θ(n^{${logbA.toFixed(2)}})`;
  } else if (Math.abs(logbA - k) < 1e-6) {
    caseResult = `Case 2: T(n) = Θ(n^{${k}} log n)`;
  } else {
    caseResult = `Case 3: T(n) = Θ(n^{${k}})`;
  }

  const lbl = S3.label(`T(n) = ${a}T(n/${b}) + O(n^${k})\n${caseResult}`, {color: P.text, line: 0.34, weight: 800});
  lbl.position.set(0, 4.8, 0);
  st.scene.add(lbl);

  el.insertAdjacentHTML('beforeend', `<div class="s3-legend"><span><i style="background:#3B82F6"></i>Root</span><span><i style="background:#10B981"></i>Subproblems</span><span><i style="background:#F59E0B"></i>Leaves</span><em>3D Master Theorem Recursion Tree</em></div>`);
  return st;
};
})();
