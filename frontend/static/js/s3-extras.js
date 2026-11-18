/* 3D extras: Compiler Pipeline Factory, Tutor Avatar, Transformation Lab, DFA Automaton, Text Particles */
(() => {
'use strict';
const T = window.THREE, S3 = window.SPO3D;
if (!T || !S3) return;

const V = (x, y, z) => new T.Vector3(x, y, z);
const STAGES = [
  {id: 'lexer', name: '01 Lexer', desc: 'Token Stream & Scanner', color: '#3B82F6'},
  {id: 'parser', name: '02 Parser', desc: 'AST Syntax Tree Builder', color: '#6366F1'},
  {id: 'semantic', name: '03 Semantic', desc: 'Symbol Tables & Scopes', color: '#0EA5E9'},
  {id: 'ir', name: '04 TAC IR', desc: 'Three-Address Code & Blocks', color: '#0D9488'},
  {id: 'ssa', name: '05 SSA / CFG', desc: 'Dominance & φ Placement', color: '#8B5CF6'},
  {id: 'opt', name: '06 10-Pass Core', desc: 'Iterative Pass Manager', color: '#F59E0B'},
  {id: 'codegen', name: '07 CodeGen', desc: 'Target Python Generator', color: '#10B981'},
  {id: 'validate', name: '08 Validator', desc: 'Differential Testing', color: '#EC4899'}
];

/* ---------- Grand 3D Animated Compiler Factory (Pipeline Studio) ---------- */
S3.compilerFactory = (el, {onSelectStage} = {}) => {
  const st = S3.mount(el, {camera: [0, 9, 22], fov: 45, lights: true, target: [0, 0, 0]});
  if (!st) return S3.fallback(el);
  const P = S3.pal(), n = STAGES.length, W = 28, step = W / (n - 1);
  const stations = [], particles = [], beams = [];

  // Conveyor Belt Base
  const baseGeo = new T.BoxGeometry(W + 4, 0.4, 4);
  const baseMat = new T.MeshStandardMaterial({color: 0xF1F5F9, roughness: 0.6, metalness: 0.2});
  const belt = new T.Mesh(baseGeo, baseMat);
  belt.position.y = -0.2;
  st.scene.add(belt);

  // Guide rails
  [-1.9, 1.9].forEach(z => {
    const rail = new T.Mesh(new T.BoxGeometry(W + 4, 0.25, 0.15), new T.MeshStandardMaterial({color: 0x94A3B8, metalness: 0.8, roughness: 0.2}));
    rail.position.set(0, 0.1, z);
    st.scene.add(rail);
  });

  // 8 Physical Compiler Stations
  STAGES.forEach((stage, i) => {
    const x = (i - (n - 1) / 2) * step;
    const group = new T.Group();
    group.position.set(x, 0, 0);

    // Pedestal
    const ped = new T.Mesh(new T.CylinderGeometry(1.2, 1.4, 0.6, 24), new T.MeshStandardMaterial({color: 0xE2E8F0, roughness: 0.4, metalness: 0.3}));
    ped.position.y = 0.3;
    group.add(ped);

    // Station Arch / Ring / Chamber
    let mech;
    if (i === 0) { // Lexer Scanner Ring
      mech = new T.Mesh(new T.TorusGeometry(1.1, 0.14, 16, 40), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.35, metalness: 0.6, roughness: 0.2}));
      mech.rotation.y = Math.PI / 2;
      mech.position.y = 1.8;
    } else if (i === 1) { // Parser AST Crystal
      mech = new T.Mesh(new T.OctahedronGeometry(0.95, 0), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.35, roughness: 0.2, metalness: 0.4}));
      mech.position.y = 1.8;
    } else if (i === 2) { // Semantic Radar
      mech = new T.Mesh(new T.ConeGeometry(0.9, 1.4, 20), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.3, wireframe: true}));
      mech.rotation.x = Math.PI;
      mech.position.y = 2.0;
    } else if (i === 3) { // TAC Column
      mech = new T.Mesh(new T.BoxGeometry(1.2, 1.8, 1.2), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.25, metalness: 0.5, roughness: 0.3}));
      mech.position.y = 1.5;
    } else if (i === 4) { // SSA φ Funnel
      mech = new T.Mesh(new T.CylinderGeometry(1.1, 0.2, 1.6, 20), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.4, transparent: true, opacity: 0.85}));
      mech.position.y = 1.7;
    } else if (i === 5) { // 10-Pass Optimization Reactor
      mech = new T.Mesh(new T.TorusKnotGeometry(0.7, 0.2, 64, 12), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.2}));
      mech.position.y = 1.8;
    } else if (i === 6) { // Code Generator Emitter
      mech = new T.Mesh(new T.IcosahedronGeometry(0.85, 1), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.4, roughness: 0.3}));
      mech.position.y = 1.8;
    } else { // Validator Dual Sensor
      mech = new T.Mesh(new T.DodecahedronGeometry(0.85, 0), new T.MeshStandardMaterial({color: stage.color, emissive: stage.color, emissiveIntensity: 0.4, wireframe: true}));
      mech.position.y = 1.8;
    }
    group.add(mech);

    // Glowing Station Beacon Light
    const beacon = S3.glow(stage.color, 2.2, 0.6);
    beacon.position.y = 1.8;
    group.add(beacon);

    // 3D Station Label
    const lbl = S3.label(stage.name + '\n' + stage.desc, {color: P.text, line: 0.32, weight: 700});
    lbl.position.set(0, -1.0, 2.0);
    group.add(lbl);

    group.userData = {stage, i, mech, beacon, active: false, pulse: 0};
    st.scene.add(group);
    stations.push(group);

    // Conveyor connecting beams between stations
    if (i < n - 1) {
      const xNext = ((i + 1) - (n - 1) / 2) * step;
      const beamGeo = new T.CylinderGeometry(0.04, 0.04, step, 8);
      const beamMat = new T.MeshBasicMaterial({color: stage.color, transparent: true, opacity: 0.6});
      const beam = new T.Mesh(beamGeo, beamMat);
      beam.rotation.z = Math.PI / 2;
      beam.position.set((x + xNext) / 2, 1.8, 0);
      st.scene.add(beam);
      beams.push(beam);
    }
  });

  // Animated Code Payload Capsule moving along the pipeline
  const capsule = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 0.9), new T.MeshStandardMaterial({color: 0xFFD84D, emissive: 0xFFD84D, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.8}));
  const capsuleGlow = S3.glow(0xFFD84D, 3.2, 0.9);
  capsule.add(capsuleGlow);
  capsule.position.set(-W / 2, 1.8, 0);
  st.scene.add(capsule);

  let simProgress = 0, simulating = true, speed = 0.22;

  st.onTick((dt, t) => {
    // Animate individual station mechanisms
    stations.forEach((s, idx) => {
      const u = s.userData;
      if (u.mech) {
        u.mech.rotation.y += dt * (0.8 + idx * 0.15);
        if (idx === 5) u.mech.rotation.x += dt * 0.6; // reactor spin
      }
      if (u.active) {
        u.pulse = Math.min(1, u.pulse + dt * 3);
        u.beacon.scale.setScalar(2.2 + Math.sin(t * 8) * 0.4);
      } else {
        u.pulse = Math.max(0, u.pulse - dt * 2);
        u.beacon.scale.setScalar(2.2);
      }
    });

    // Move code capsule along conveyor
    if (simulating) {
      simProgress = (simProgress + dt * speed) % 1;
      const curX = (simProgress - 0.5) * (W + 2);
      capsule.position.x = curX;
      capsule.position.y = 1.8 + Math.sin(t * 6) * 0.12;
      capsule.rotation.y += dt * 2;
      capsule.rotation.z = Math.sin(t * 4) * 0.15;

      // Activate corresponding station
      const currentStationIdx = Math.floor(simProgress * n);
      stations.forEach((s, idx) => {
        s.userData.active = (idx === currentStationIdx);
      });
    }
  });

  st.hover(() => stations.map(s => s.userData.mech), (h, ev) => {
    if (!h) return st.hideTip();
    const grp = h.object.parent;
    const s = grp.userData.stage;
    st.showTip(S3.tipHtml(`<b>${s.name}</b>`, [`<b>Function:</b> ${s.desc}`, `Click to inspect this phase`]), ev);
  });

  st.click(() => stations.map(s => s.userData.mech), h => {
    if (h && onSelectStage) {
      const s = h.object.parent.userData.stage;
      onSelectStage(s.id, s);
    }
  });

  st.setSimulating = on => { simulating = on; };
  st.jumpToStage = idx => {
    simProgress = Math.max(0, Math.min(0.99, idx / n));
  };

  el.insertAdjacentHTML('beforeend', '<div class="s3-legend"><span><i style="background:#3B82F6"></i>Lexer</span><span><i style="background:#6366F1"></i>Parser/AST</span><span><i style="background:#0EA5E9"></i>Semantic</span><span><i style="background:#0D9488"></i>TAC IR</span><span><i style="background:#8B5CF6"></i>SSA/φ</span><span><i style="background:#F59E0B"></i>Passes</span><span><i style="background:#10B981"></i>CodeGen</span><span><i style="background:#EC4899"></i>Validator</span><em>click a station to inspect · drag to orbit</em></div>');
  return st;
};

/* ---------- 3D Transformation Laboratory ---------- */
S3.transformationLab = (el, {passName = 'constant_folding'} = {}) => {
  const st = S3.mount(el, {camera: [0, 4, 11], fov: 42, lights: true});
  if (!st) return S3.fallback(el);
  const P = S3.pal();

  const stageGroup = new T.Group();
  st.scene.add(stageGroup);

  let mode = passName;
  const buildScene = m => {
    while (stageGroup.children.length) {
      const c = stageGroup.children[0];
      if (c.geometry) c.geometry.dispose();
      stageGroup.remove(c);
    }

    if (m === 'constant_folding') {
      // Two number cubes merging into one
      const b1 = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 1.2), new T.MeshStandardMaterial({color: 0x3B82F6, metalness: 0.3, roughness: 0.3}));
      const l1 = S3.label('10', {line: 0.45, color: '#fff'}); l1.position.z = 0.65; b1.add(l1);
      const b2 = new T.Mesh(new T.BoxGeometry(1.2, 1.2, 1.2), new T.MeshStandardMaterial({color: 0x6366F1, metalness: 0.3, roughness: 0.3}));
      const l2 = S3.label('20', {line: 0.45, color: '#fff'}); l2.position.z = 0.65; b2.add(l2);
      const op = S3.label('+', {line: 0.7, color: P.text});
      const res = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshStandardMaterial({color: 0x10B981, emissive: 0x10B981, emissiveIntensity: 0.5, roughness: 0.2}));
      const l3 = S3.label('30\n(Folded)', {line: 0.45, color: '#fff'}); l3.position.z = 0.8; res.add(l3);
      res.visible = false;

      stageGroup.add(b1, b2, op, res);

      st.onTick((dt, t) => {
        const cycle = (t * 0.8) % 4;
        if (cycle < 2) {
          const k = cycle / 2;
          b1.position.set(-2.5 + k * 2.5, 1, 0);
          b2.position.set(2.5 - k * 2.5, 1, 0);
          op.position.set(0, 1.8 - k * 0.8, 0);
          b1.visible = true; b2.visible = true; op.visible = true;
          res.visible = false;
        } else {
          b1.visible = false; b2.visible = false; op.visible = false;
          res.visible = true;
          res.position.set(0, 1, 0);
          res.rotation.y += dt * 1.2;
          res.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
        }
      });
    } else if (m === 'dead_code') {
      // Unused variable dissolving into particles
      const deadBox = new T.Mesh(new T.BoxGeometry(2.2, 1.2, 0.8), new T.MeshStandardMaterial({color: 0xF43F5E, emissive: 0xF43F5E, emissiveIntensity: 0.4, transparent: true}));
      const l = S3.label('unused_x = 99\n[Dead Store]', {line: 0.3, color: '#fff'}); l.position.z = 0.45; deadBox.add(l);
      deadBox.position.y = 1;
      stageGroup.add(deadBox);

      st.onTick((dt, t) => {
        const cycle = (t * 0.7) % 3;
        if (cycle < 1.5) {
          deadBox.material.opacity = 1 - (cycle / 1.5) * 0.9;
          deadBox.scale.setScalar(1 - (cycle / 1.5) * 0.4);
          deadBox.position.y = 1 + (cycle / 1.5) * 0.8;
        } else {
          deadBox.material.opacity = 0;
          if (cycle > 2.8) deadBox.material.opacity = 1;
        }
      });
    } else {
      // LICM: hoisting invariant out of loop
      const loopCoil = new T.Mesh(new T.TorusGeometry(2.2, 0.16, 16, 48), new T.MeshStandardMaterial({color: 0x8B5CF6, wireframe: true}));
      loopCoil.rotation.x = Math.PI / 2;
      const invNode = new T.Mesh(new T.BoxGeometry(1.4, 0.8, 0.8), new T.MeshStandardMaterial({color: 0x10B981, emissive: 0x10B981, emissiveIntensity: 0.4}));
      const l = S3.label('inv = a * b\n[LICM Hoist]', {line: 0.28, color: '#fff'}); l.position.z = 0.45; invNode.add(l);
      const preheader = S3.label('Pre-Header Block', {color: P.muted, line: 0.32}); preheader.position.y = 3.6;
      stageGroup.add(loopCoil, invNode, preheader);

      st.onTick((dt, t) => {
        loopCoil.rotation.z += dt * 0.8;
        const cycle = (t * 0.6) % 3.5;
        if (cycle < 2) {
          const k = cycle / 2;
          invNode.position.set(0, 0.4 + k * 2.6, 0);
        } else {
          invNode.position.set(0, 3.0, 0);
        }
      });
    }
  };

  buildScene(mode);
  st.setMode = m => { mode = m; buildScene(m); };
  return st;
};

/* ---------- 3D Lexical DFA State Machine Visualizer ---------- */
S3.dfaVisualizer = (el, {tokenType = 'NUMBER'} = {}) => {
  const st = S3.mount(el, {camera: [0, 2, 10], fov: 45, lights: true});
  if (!st) return S3.fallback(el);
  const P = S3.pal();

  const states = [
    {id: 'q0', label: 'Start (q0)', x: -4, y: 0, accept: false},
    {id: 'q1', label: 'Digit (q1)', x: -1, y: 0.8, accept: false},
    {id: 'q2', label: 'Dot (q2)', x: 1.5, y: -0.8, accept: false},
    {id: 'q3', label: 'Float (q3)', x: 4, y: 0, accept: true}
  ];

  const stateNodes = [];
  states.forEach(s => {
    const geo = s.accept ? new T.TorusGeometry(0.65, 0.08, 16, 32) : new T.SphereGeometry(0.55, 24, 16);
    const mat = new T.MeshStandardMaterial({color: s.accept ? 0x10B981 : 0x3B82F6, emissive: s.accept ? 0x10B981 : 0x3B82F6, emissiveIntensity: 0.4, roughness: 0.3});
    const m = new T.Mesh(geo, mat);
    m.position.set(s.x, s.y, 0);
    const lbl = S3.label(s.label, {color: P.text, line: 0.28, weight: 700});
    lbl.position.set(s.x, s.y - 0.9, 0);
    st.scene.add(m, lbl);
    stateNodes.push({mesh: m, s});
  });

  // Transition conduits
  const transitions = [
    {from: states[0], to: states[1], char: '[0-9]'},
    {from: states[1], to: states[2], char: "'.'"},
    {from: states[2], to: states[3], char: '[0-9]'}
  ];
  transitions.forEach(tr => {
    const p1 = V(tr.from.x, tr.from.y, 0), p2 = V(tr.to.x, tr.to.y, 0);
    const curve = new T.CatmullRomCurve3([p1, p1.clone().add(p2).multiplyScalar(0.5).add(V(0, 0.6, 0)), p2]);
    const tube = new T.Mesh(new T.TubeGeometry(curve, 20, 0.03, 8), new T.MeshBasicMaterial({color: 0x94A3B8}));
    const tag = S3.label(tr.char, {color: '#2563EB', line: 0.26, weight: 700});
    tag.position.copy(curve.getPoint(0.5)).add(V(0, 0.3, 0));
    st.scene.add(tube, tag);
  });

  // Animated probe token
  const tokenOrb = new T.Mesh(new T.SphereGeometry(0.2, 16, 12), new T.MeshBasicMaterial({color: 0xFFD84D}));
  tokenOrb.add(S3.glow(0xFFD84D, 1.8, 0.8));
  st.scene.add(tokenOrb);

  let activeIndex = 0;
  st.onTick((dt, t) => {
    const cycle = (t * 0.9) % states.length;
    activeIndex = Math.floor(cycle);
    const p = cycle - activeIndex;
    const cur = states[activeIndex];
    const nxt = states[(activeIndex + 1) % states.length];
    tokenOrb.position.lerpVectors(V(cur.x, cur.y, 0), V(nxt.x, nxt.y, 0), S3.ease(p));
  });

  el.insertAdjacentHTML('beforeend', '<div class="s3-legend"><span><i style="background:#3B82F6"></i>State</span><span><i style="background:#10B981"></i>Accept State</span><em>DFA Lexer Token Transition Automaton</em></div>');
  return st;
};

/* ---------- Compiler Pipeline HUD ---------- */
const HUD_STAGES = ['Lexer', 'Parser', 'Semantic', 'IR/CFG', 'Data-flow', 'Passes', 'Validate', 'CodeGen'];
S3.pipeline = el => {
  const st = S3.mount(el, {controls: false, camera: [0, 1.5, 10.5], fov: 42, lights: true, keep: true});
  if (!st) return null;
  const gates = [], W = 14, n = HUD_STAGES.length, P = S3.pal();
  HUD_STAGES.forEach((nm, i) => {
    const x = (i / (n - 1) - .5) * W;
    const g = new T.Mesh(new T.TorusGeometry(.62, .09, 12, 36), new T.MeshStandardMaterial({color: '#475569', emissive: '#000', roughness: .3, metalness: .5}));
    g.position.x = x; g.rotation.y = Math.PI / 2; st.scene.add(g); gates.push(g);
    const l = S3.label(nm, {color: P.text, line: .3, weight: 700}); l.position.set(x, -1.25, 0); st.scene.add(l);
  });
  const N = 90, pos = new Float32Array(N * 3), geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const pts = new T.Points(geo, new T.PointsMaterial({size: .22, map: S3.glowTexture(), color: '#FFD84D', transparent: true, depthWrite: false, blending: T.AdditiveBlending})); st.scene.add(pts);
  const seeds = Array.from({length: N}, () => ({t: Math.random(), a: Math.random() * 6.28, r: Math.random() * .45, s: .15 + Math.random() * .2}));
  let prog = 0, target = 0; st.setProgress = f => { target = Math.max(0, Math.min(1, f)); }; st.finish = () => { target = 1.001; };
  st.onTick((dt, t) => {
    prog += (target - prog) * Math.min(1, dt * 4);
    gates.forEach((g, i) => {
      const on = prog * (n - 1) + .5 >= i, cur = Math.abs(prog * (n - 1) - i) < .5;
      g.material.emissive.set(on ? (cur ? '#FFD84D' : '#10B981') : '#000');
      g.material.emissiveIntensity = on ? (cur ? .9 : .5) : 0;
      g.rotation.x += dt * (cur ? 4 : .6);
      g.scale.setScalar(cur ? 1.18 : 1);
    });
    seeds.forEach((s, i) => {
      s.t = (s.t + dt * s.s) % 1; const x = (s.t - .5) * W, lit = (s.t) <= Math.max(.05, prog);
      pos.set([x, Math.sin(s.a + t * 2) * s.r, Math.cos(s.a + t * 2) * s.r], i * 3); if (!lit) pos[i * 3 + 1] = 99;
    });
    geo.attributes.position.needsUpdate = true;
  });
  return st;
};

/* ---------- Lead Guide Avatar (Tutor Mode) ---------- */
S3.avatar = el => {
  const st = S3.mount(el, {controls: false, camera: [0, 0.4, 4.8], fov: 38, keep: false});
  if (!st) return null;

  const skinMat = new T.MeshStandardMaterial({color: 0xE8BEAC, roughness: 0.6, metalness: 0.1});
  const faceMat = new T.MeshStandardMaterial({color: 0xE8BEAC, roughness: 0.5, metalness: 0.1});
  const hairMat = new T.MeshStandardMaterial({color: 0x171717, roughness: 0.8, metalness: 0.1});
  const beardMat = new T.MeshStandardMaterial({color: 0x141414, roughness: 0.9, metalness: 0.05});
  const glassesMat = new T.MeshStandardMaterial({color: 0x0F172A, roughness: 0.2, metalness: 0.8});
  const sweaterMat = new T.MeshStandardMaterial({color: 0x881337, roughness: 0.7, metalness: 0.15});

  // Load user photo face
  const photoImg = new Image();
  photoImg.src = '/static/img/guide_photo.jpg';
  photoImg.onload = () => {
    try {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 512;
      const ctx = cv.getContext('2d');
      const iw = photoImg.naturalWidth, ih = photoImg.naturalHeight;
      ctx.drawImage(photoImg, iw * 0.39, ih * 0.165, iw * 0.25, ih * 0.21, 0, 0, 512, 512);
      const tex = new T.CanvasTexture(cv);
      faceMat.map = tex;
      faceMat.needsUpdate = true;
    } catch (e) {}
  };

  const g = new T.Group();
  st.scene.add(g);

  // Torso / Sweater
  const torso = new T.Mesh(new T.CylinderGeometry(0.55, 0.48, 1.15, 20), sweaterMat);
  torso.scale.set(1.15, 1, 0.75);
  torso.position.y = -0.55;
  g.add(torso);

  // Collar
  const collar = new T.Mesh(new T.TorusGeometry(0.3, 0.08, 12, 24), sweaterMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.05;
  g.add(collar);

  // Head group
  const headGroup = new T.Group();
  headGroup.position.y = 0.55;
  g.add(headGroup);

  const head = new T.Mesh(new T.SphereGeometry(0.42, 28, 24), skinMat);
  head.scale.set(0.95, 1.15, 0.95);
  headGroup.add(head);

  const faceQuad = new T.Mesh(new T.PlaneGeometry(0.58, 0.68), faceMat);
  faceQuad.position.set(0, 0.02, 0.4);
  headGroup.add(faceQuad);

  const hairTop = new T.Mesh(new T.SphereGeometry(0.44, 24, 20), hairMat);
  hairTop.position.set(0, 0.14, -0.05);
  hairTop.scale.set(1.0, 1.1, 1.05);
  headGroup.add(hairTop);

  const beard = new T.Mesh(new T.CylinderGeometry(0.42, 0.3, 0.48, 18), beardMat);
  beard.position.set(0, -0.18, 0.08);
  beard.scale.set(1.0, 0.9, 0.95);
  headGroup.add(beard);

  // Glasses
  const glasses = new T.Group();
  glasses.position.set(0, 0.08, 0.42);
  headGroup.add(glasses);
  [-0.15, 0.15].forEach(x => {
    const rim = new T.Mesh(new T.TorusGeometry(0.11, 0.02, 8, 20), glassesMat);
    rim.position.x = x;
    glasses.add(rim);
  });
  const bridge = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.11, 6), glassesMat);
  bridge.rotation.z = Math.PI / 2;
  glasses.add(bridge);

  // Arms
  const arms = [-1, 1].map(s => {
    const a = new T.Group();
    const up = new T.Mesh(new T.CylinderGeometry(0.15, 0.13, 0.6, 12), sweaterMat);
    up.position.y = -0.3;
    const hand = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), skinMat);
    hand.position.y = -0.65;
    a.add(up, hand);
    a.position.set(s * 0.72, -0.15, 0);
    a.rotation.z = s * 0.2;
    g.add(a);
    return a;
  });

  let speaking = false, level = 0, look = {x: 0, y: 0}, thinking = false, wave = 0;
  const mv = e => {
    const r = el.getBoundingClientRect();
    look.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / 300));
    look.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / 300));
  };
  window.addEventListener('pointermove', mv);
  const od = st.dispose.bind(st);
  st.dispose = () => { window.removeEventListener('pointermove', mv); od(); };

  st.setSpeaking = v => { speaking = v; if (!v) level = 0; };
  st.pulseLevel = v => { level = Math.max(level, v); };
  st.setThinking = v => { thinking = v; };
  st.wave = () => { wave = 1.8; };

  st.onTick((dt, t) => {
    g.position.y = Math.sin(t * 1.8) * 0.04;
    headGroup.rotation.y += ((look.x * 0.4) - headGroup.rotation.y) * 0.08;
    headGroup.rotation.x += ((look.y * 0.2) - headGroup.rotation.x) * 0.08;

    if (speaking) {
      headGroup.rotation.x += Math.sin(t * 8) * 0.04;
      arms[1].rotation.x = -0.4 + Math.sin(t * 4) * 0.15;
    } else {
      arms[1].rotation.x *= 0.9;
    }

    if (wave > 0) {
      wave -= dt;
      arms[1].rotation.z = -1.5 + Math.sin(t * 12) * 0.3;
      arms[1].rotation.x = -0.5;
    } else {
      arms[1].rotation.z += (-0.2 - arms[1].rotation.z) * 0.1;
    }
  });

  return st;
};

/* ---------- Text particles for the Intro ---------- */
S3.textParticles = el => {
  const low = S3.quality() === 'low', N = low ? 2600 : 7000, st = S3.mount(el, {controls: false, camera: [0, 0, 15], fov: 50, lights: false, keep: false}); if (!st) return null;
  const pos = new Float32Array(N * 3), tgt = new Float32Array(N * 3), col = new Float32Array(N * 3), c = new T.Color(), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 8 + Math.random() * 10, a = Math.random() * 6.28, b = Math.random() * 3.14;
    pos.set([r * Math.sin(b) * Math.cos(a), r * Math.sin(b) * Math.sin(a), r * Math.cos(b) - 6], i * 3);
    tgt.set(pos.slice(i * 3, i * 3 + 3), i * 3);
    c.set(S3.PAL[i % 6]).lerp(new T.Color('#4F46E5'), .35);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
  const pts = new T.Points(g, new T.PointsMaterial({size: low ? .13 : .1, map: S3.glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: T.NormalBlending})); st.scene.add(pts);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const cx = cv.getContext('2d', {willReadFrequently: true});
  st.setText = (text, {rtl = false, weight = 800} = {}) => {
    cx.clearRect(0, 0, 1024, 256); let size = 150; const fam = '"Plus Jakarta Sans","Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI","Noto Sans Devanagari",Tahoma,sans-serif';
    do { cx.font = `${weight} ${size}px ${fam}`; size -= 6; } while (cx.measureText(text).width > 940 && size > 30);
    cx.direction = rtl ? 'rtl' : 'ltr';
    cx.fillStyle = '#0F172A';
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, 512, 132);
    const d = cx.getImageData(0, 0, 1024, 256).data, pxs = []; const step = low ? 5 : 3;
    for (let y = 0; y < 256; y += step) for (let x = 0; x < 1024; x += step) if (d[(y * 1024 + x) * 4 + 3] > 128) pxs.push(x, y);
    const m = pxs.length / 2, k = 14 / 1024;
    for (let i = 0; i < N; i++) { const j = i < m ? ((i * 7919) % m) : -1; if (j >= 0) tgt.set([(pxs[j * 2] - 512) * k, -(pxs[j * 2 + 1] - 128) * k, (Math.random() - .5) * .35], i * 3); else { const r = 7 + Math.random() * 9, a = Math.random() * 6.28; tgt.set([Math.cos(a) * r, Math.sin(a) * r * .55, -3 - Math.random() * 8], i * 3); } }
    for (let i = 0; i < N; i++) { const s = (Math.random() - .5) * 2.2; pos[i * 3] += s; pos[i * 3 + 1] += (Math.random() - .5) * 2.2; }
  };
  st.burst = () => { for (let i = 0; i < N * 3; i++) vel[i] = (Math.random() - .5) * 14; };
  st.onTick((dt, t) => {
    const k = Math.min(1, dt * 3.2); for (let i = 0; i < N * 3; i++) { pos[i] += (tgt[i] - pos[i]) * k + vel[i] * dt; vel[i] *= .9; }
    for (let i = 0; i < N; i += 1) pos[i * 3 + 1] += Math.sin(t * 1.4 + i) * .0015;
    g.attributes.position.needsUpdate = true;
    pts.rotation.y = Math.sin(t * .3) * .12; pts.rotation.x = Math.sin(t * .22) * .05;
  });
  return st;
};
})();
