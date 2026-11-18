/* Interactive 3D compiler teacher with synchronized speech, gestures, and code lessons. */
(() => {
'use strict';
const T = window.THREE, S3 = window.SPO3D;
if (!T || !S3) return;

const V = (x, y, z) => new T.Vector3(x, y, z);

/* ---------- Create Humanoid 3D Character Model ---------- */
function createLeadCharacter(scene) {
  const root = new T.Group();
  scene.add(root);
  const groundShadow = new T.Mesh(
    new T.CircleGeometry(0.82, 32),
    new T.MeshBasicMaterial({color: 0x0F172A, transparent: true, opacity: 0.14, depthWrite: false})
  );
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.scale.set(1.15, 0.55, 1);
  groundShadow.position.y = 0.02;
  root.add(groundShadow);

  // Materials
  const skinMat = new T.MeshStandardMaterial({color: 0xE8BEAC, roughness: 0.6, metalness: 0.1});
  const hairMat = new T.MeshStandardMaterial({color: 0x171717, roughness: 0.8, metalness: 0.1});
  const glassesMat = new T.MeshStandardMaterial({color: 0x0F172A, roughness: 0.2, metalness: 0.8});
  const sweaterMat = new T.MeshStandardMaterial({color: 0x881337, roughness: 0.7, metalness: 0.15}); // Deep maroon
  const collarMat = new T.MeshStandardMaterial({color: 0x701A2A, roughness: 0.8, metalness: 0.1});
  const jeansMat = new T.MeshStandardMaterial({color: 0x94A3B8, roughness: 0.75, metalness: 0.1}); // Light grey denim
  const shoeMat = new T.MeshStandardMaterial({color: 0xF8FAFC, roughness: 0.3, metalness: 0.2}); // White sneakers
  const soleMat = new T.MeshStandardMaterial({color: 0x475569, roughness: 0.8});

  // Pelvis / Hips
  const pelvis = new T.Group();
  pelvis.position.y = 1.65;
  root.add(pelvis);

  // Torso / Maroon Sweater
  const torso = new T.Group();
  pelvis.add(torso);

  const torsoBody = new T.Mesh(new T.CylinderGeometry(0.52, 0.46, 1.1, 20), sweaterMat);
  torsoBody.position.y = 0.55;
  torsoBody.scale.set(1.15, 1, 0.75); // Flatter chest
  torso.add(torsoBody);

  // Crewneck Collar
  const collar = new T.Mesh(new T.TorusGeometry(0.28, 0.07, 12, 24), collarMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, 1.12, 0);
  torso.add(collar);

  // Neck
  const neck = new T.Mesh(new T.CylinderGeometry(0.18, 0.2, 0.25, 16), skinMat);
  neck.position.y = 1.18;
  torso.add(neck);

  // Head Group
  const headGroup = new T.Group();
  headGroup.position.set(0, 1.5, 0);
  torso.add(headGroup);

  // Head Base
  const head = new T.Mesh(new T.SphereGeometry(0.38, 28, 24), skinMat);
  head.scale.set(0.95, 1.15, 0.95);
  headGroup.add(head);

  const eyes = [];
  [-0.14, 0.14].forEach(x => {
    const eye = new T.Group();
    eye.position.set(x, 0.07, 0.33);
    const white = new T.Mesh(new T.SphereGeometry(0.055, 16, 12), new T.MeshStandardMaterial({color: 0xFFFFFF, roughness: 0.4}));
    const pupil = new T.Mesh(new T.SphereGeometry(0.026, 14, 10), new T.MeshStandardMaterial({color: 0x1E293B, roughness: 0.3}));
    pupil.position.z = 0.044;
    eye.add(white, pupil);
    headGroup.add(eye);
    eyes.push(eye);
    const brow = new T.Mesh(new T.BoxGeometry(0.13, 0.025, 0.025), hairMat);
    brow.position.set(x, 0.16, 0.36);
    headGroup.add(brow);
  });
  const nose = new T.Mesh(new T.SphereGeometry(0.045, 14, 10), skinMat);
  nose.scale.set(0.8, 0.8, 0.65);
  nose.position.set(0, -0.015, 0.38);
  headGroup.add(nose);
  const mouth = new T.Mesh(new T.SphereGeometry(0.045, 16, 10), new T.MeshStandardMaterial({color: 0x7F1D35, roughness: 0.6}));
  mouth.scale.set(1.15, 0.3, 0.3);
  mouth.position.set(0, -0.14, 0.35);
  headGroup.add(mouth);

  // Dark Textured Hair on top
  const hairTop = new T.Mesh(new T.SphereGeometry(0.41, 24, 20), hairMat);
  hairTop.position.set(0, 0.12, -0.05);
  hairTop.scale.set(1.0, 1.1, 1.05);
  headGroup.add(hairTop);

  // Stylish Quiff hair front
  const hairFront = new T.Mesh(new T.CylinderGeometry(0.36, 0.38, 0.2, 16), hairMat);
  hairFront.position.set(0, 0.38, 0.08);
  hairFront.rotation.x = -0.3;
  headGroup.add(hairFront);

  // 3D Black Glasses
  const glassesGroup = new T.Group();
  glassesGroup.position.set(0, 0.06, 0.38);
  headGroup.add(glassesGroup);

  [-0.14, 0.14].forEach(x => {
    const rim = new T.Mesh(new T.TorusGeometry(0.1, 0.018, 8, 20), glassesMat);
    rim.position.x = x;
    glassesGroup.add(rim);
  });
  const bridge = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 0.1, 6), glassesMat);
  bridge.rotation.z = Math.PI / 2;
  glassesGroup.add(bridge);

  // Left Arm
  const leftShoulder = new T.Group();
  leftShoulder.position.set(-0.65, 0.95, 0);
  torso.add(leftShoulder);
  const leftUpperArm = new T.Mesh(new T.CylinderGeometry(0.15, 0.13, 0.6, 12), sweaterMat);
  leftUpperArm.position.y = -0.3;
  leftShoulder.add(leftUpperArm);
  const leftElbow = new T.Group();
  leftElbow.position.y = -0.6;
  leftShoulder.add(leftElbow);
  const leftForearm = new T.Mesh(new T.CylinderGeometry(0.13, 0.11, 0.55, 12), sweaterMat);
  leftForearm.position.y = -0.25;
  leftElbow.add(leftForearm);
  const leftHand = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), skinMat);
  leftHand.position.y = -0.58;
  leftElbow.add(leftHand);

  // Right Arm
  const rightShoulder = new T.Group();
  rightShoulder.position.set(0.65, 0.95, 0);
  torso.add(rightShoulder);
  const rightUpperArm = new T.Mesh(new T.CylinderGeometry(0.15, 0.13, 0.6, 12), sweaterMat);
  rightUpperArm.position.y = -0.3;
  rightShoulder.add(rightUpperArm);
  const rightElbow = new T.Group();
  rightElbow.position.y = -0.6;
  rightShoulder.add(rightElbow);
  const rightForearm = new T.Mesh(new T.CylinderGeometry(0.13, 0.11, 0.55, 12), sweaterMat);
  rightForearm.position.y = -0.25;
  rightElbow.add(rightForearm);
  const rightHand = new T.Mesh(new T.SphereGeometry(0.12, 16, 12), skinMat);
  rightHand.position.y = -0.58;
  rightElbow.add(rightHand);

  // Left Leg (Grey Jeans)
  const leftHip = new T.Group();
  leftHip.position.set(-0.25, 0, 0);
  pelvis.add(leftHip);
  const leftThigh = new T.Mesh(new T.CylinderGeometry(0.19, 0.16, 0.8, 14), jeansMat);
  leftThigh.position.y = -0.4;
  leftHip.add(leftThigh);
  const leftKnee = new T.Group();
  leftKnee.position.y = -0.8;
  leftHip.add(leftKnee);
  const leftShin = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.8, 14), jeansMat);
  leftShin.position.y = -0.4;
  leftKnee.add(leftShin);
  const leftShoe = new T.Mesh(new T.BoxGeometry(0.24, 0.18, 0.44), shoeMat);
  leftShoe.position.set(0, -0.82, 0.08);
  leftKnee.add(leftShoe);

  // Right Leg (Grey Jeans)
  const rightHip = new T.Group();
  rightHip.position.set(0.25, 0, 0);
  pelvis.add(rightHip);
  const rightThigh = new T.Mesh(new T.CylinderGeometry(0.19, 0.16, 0.8, 14), jeansMat);
  rightThigh.position.y = -0.4;
  rightHip.add(rightThigh);
  const rightKnee = new T.Group();
  rightKnee.position.y = -0.8;
  rightHip.add(rightKnee);
  const rightShin = new T.Mesh(new T.CylinderGeometry(0.16, 0.13, 0.8, 14), jeansMat);
  rightShin.position.y = -0.4;
  rightKnee.add(rightShin);
  const rightShoe = new T.Mesh(new T.BoxGeometry(0.24, 0.18, 0.44), shoeMat);
  rightShoe.position.set(0, -0.82, 0.08);
  rightKnee.add(rightShoe);

  // Magic Creation Summoning Node (Tokens & Tree branches from hands)
  const summonGroup = new T.Group();
  summonGroup.position.set(0, 1.2, 0.9);
  torso.add(summonGroup);

  // Tokens (Keywords, Identifiers, Numbers)
  const tokenCubes = [];
  const tokenColors = [0x3B82F6, 0x10B981, 0xF59E0B, 0x8B5CF6];
  const tokenLabels = ['KW:def', 'ID:calc', 'INT:42', 'OP:+'];
  for (let i = 0; i < 4; i++) {
    const tb = new T.Mesh(new T.BoxGeometry(0.22, 0.22, 0.22), new T.MeshStandardMaterial({color: tokenColors[i], emissive: tokenColors[i], emissiveIntensity: 0.6}));
    tb.position.set((i - 1.5) * 0.35, 0, 0);
    const tag = S3.label(tokenLabels[i], {line: 0.14, color: '#fff'});
    tag.position.z = 0.14;
    tb.add(tag);
    summonGroup.add(tb);
    tokenCubes.push(tb);
  }

  // 3D Syntax Tree Branches created with hands
  const treeBranchGroup = new T.Group();
  summonGroup.add(treeBranchGroup);

  const treeNodes = [
    {pos: [0, 0.6, 0], col: 0x4F46E5, lbl: 'FunctionDef'},
    {pos: [-0.5, 0.1, 0], col: 0x0EA5E9, lbl: 'Assign'},
    {pos: [0.5, 0.1, 0], col: 0x10B981, lbl: 'Return'},
    {pos: [-0.7, -0.4, 0], col: 0xF59E0B, lbl: 'BinOp (+)'},
    {pos: [-0.3, -0.4, 0], col: 0xEC4899, lbl: 'Num: 10'}
  ];
  treeNodes.forEach(tn => {
    const m = new T.Mesh(new T.OctahedronGeometry(0.12, 0), new T.MeshStandardMaterial({color: tn.col, emissive: tn.col, emissiveIntensity: 0.5}));
    m.position.set(...tn.pos);
    const l = S3.label(tn.lbl, {line: 0.12, color: '#fff'});
    l.position.set(tn.pos[0], tn.pos[1] + 0.15, tn.pos[2]);
    treeBranchGroup.add(m, l);
  });
  // Connecting branch lines
  const branchLines = [
    [[0, 0.6, 0], [-0.5, 0.1, 0]],
    [[0, 0.6, 0], [0.5, 0.1, 0]],
    [[-0.5, 0.1, 0], [-0.7, -0.4, 0]],
    [[-0.5, 0.1, 0], [-0.3, -0.4, 0]]
  ];
  branchLines.forEach(([p1, p2]) => {
    const pts = [V(...p1), V(...p2)];
    const line = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({color: 0x38BDF8, transparent: true, opacity: 0.8}));
    treeBranchGroup.add(line);
  });

  summonGroup.visible = false;
  treeBranchGroup.visible = false;

  return {
    root, pelvis, torso, headGroup,
    leftShoulder, leftElbow, leftHand,
    rightShoulder, rightElbow, rightHand,
    leftHip, leftKnee, rightHip, rightKnee,
    summonGroup, tokenCubes, treeBranchGroup, mouth, eyes
  };
}

/* ---------- 3D Lead Guide Controller Hub Component ---------- */
let activeGuide = null;

S3.leadController = (mountEl) => {
  const st = S3.mount(mountEl, {camera: [0, 2.45, 8], fov: 38, controls: false, keep: true});
  if (!st) return null;

  const char = createLeadCharacter(st.scene);
  st.camera.lookAt(0, 2.45, 0);
  let animState = 'idle'; // idle | walk | wave | summon_tokens | summon_tree | speak | point | punch
  let walkProgress = 0, walkSpeed = 6, talking = false, speechPulse = 0;
  let waveTimer = 0, summonTimer = 0, speakTimer = 0, pointTimer = 0, walkEndState = 'idle';
  let currentTargetX = 0, facingYaw = 0, punchTimer = 0, punchHeading = 0, featureTravel = false;

  st.char = char;

  // Animation Loop
  st.onTick((dt, t) => {
    // Reset rotations baseline
    char.torso.position.y = 0;
    char.torso.rotation.x = 0;
    char.torso.rotation.z = 0;
    char.headGroup.rotation.set(0, 0, 0);
    char.root.rotation.y += (facingYaw - char.root.rotation.y) * Math.min(1, dt * 8);

    // Idle Breathing
    const breath = Math.sin(t * 2) * 0.03;
    char.torso.position.y = breath;
    char.headGroup.position.y = 1.5 + breath * 0.5;
    const blink = Math.pow(Math.max(0, Math.sin(t * 0.82 + 1.1)), 28);
    char.eyes.forEach(eye => { eye.scale.y = 1 - blink * 0.9; });
    speechPulse *= Math.pow(0.02, dt);
    char.mouth.scale.y = 0.3 + ((talking || animState === 'speak') ? (0.25 + speechPulse * 0.7) * Math.abs(Math.sin(t * 12)) : 0);

    if (animState === 'walk') {
      walkProgress += dt * walkSpeed;
      // Walking leg swing
      char.leftHip.rotation.x = Math.sin(walkProgress) * 0.65;
      char.rightHip.rotation.x = -Math.sin(walkProgress) * 0.65;
      char.leftKnee.rotation.x = Math.max(0, -Math.sin(walkProgress) * 0.55);
      char.rightKnee.rotation.x = Math.max(0, Math.sin(walkProgress) * 0.55);

      // Walking arm swing (opposite legs)
      char.leftShoulder.rotation.x = -Math.sin(walkProgress) * 0.5;
      char.rightShoulder.rotation.x = Math.sin(walkProgress) * 0.5;
      char.leftElbow.rotation.x = -0.3;
      char.rightElbow.rotation.x = -0.3;

      // Torso bobbing
      char.pelvis.position.y = 1.65 + Math.abs(Math.sin(walkProgress * 2)) * 0.07;

      // Move toward target X
      char.root.position.x += (currentTargetX - char.root.position.x) * Math.min(1, dt * 3);
      if (Math.abs(currentTargetX - char.root.position.x) < 0.05) {
        animState = walkEndState === 'point' ? 'point' : (talking ? 'speak' : 'idle');
        pointTimer = 0;
        speakTimer = 0;
      }
    } else {
      // Return legs to neutral
      char.leftHip.rotation.x *= 0.8;
      char.rightHip.rotation.x *= 0.8;
      char.leftKnee.rotation.x *= 0.8;
      char.rightKnee.rotation.x *= 0.8;
      char.pelvis.position.y = 1.65;

      if (animState === 'wave') {
        waveTimer -= dt;
        char.rightShoulder.rotation.z = -1.4;
        char.rightShoulder.rotation.x = -0.5;
        char.rightElbow.rotation.z = -0.9 + Math.sin(t * 12) * 0.35;
        char.headGroup.rotation.z = -0.08;
        if (waveTimer <= 0) animState = 'idle';
      } else if (animState === 'summon_tokens') {
        if (!talking) summonTimer -= dt;
        // Raise both hands forward together
        char.leftShoulder.rotation.x = -1.1;
        char.rightShoulder.rotation.x = -1.1;
        char.leftShoulder.rotation.z = 0.3;
        char.rightShoulder.rotation.z = -0.3;
        char.leftElbow.rotation.x = -0.6;
        char.rightElbow.rotation.x = -0.6;

        char.summonGroup.visible = true;
        char.summonGroup.children[0].visible = true; // tokens
        char.treeBranchGroup.visible = false;

        // Spin and float tokens
        char.tokenCubes.forEach((cube, idx) => {
          cube.rotation.y += dt * (1.5 + idx * 0.5);
          cube.position.y = Math.sin(t * 4 + idx) * 0.08;
        });
        if (summonTimer <= 0) {
          char.summonGroup.visible = false;
          animState = 'idle';
        }
      } else if (animState === 'summon_tree') {
        if (!talking) summonTimer -= dt;
        // Spread both arms wide like a creator
        char.leftShoulder.rotation.x = -0.9;
        char.rightShoulder.rotation.x = -0.9;
        char.leftShoulder.rotation.z = 0.6;
        char.rightShoulder.rotation.z = -0.6;
        char.leftElbow.rotation.x = -0.4;
        char.rightElbow.rotation.x = -0.4;

        char.summonGroup.visible = true;
        char.summonGroup.children[0].visible = false;
        char.treeBranchGroup.visible = true;
        char.treeBranchGroup.rotation.y += dt * 0.8;

        if (summonTimer <= 0) {
          char.summonGroup.visible = false;
          animState = 'idle';
        }
      } else if (animState === 'punch') {
        punchTimer += dt;
        const phase = punchTimer / 0.78;
        const reach = phase < 0.2 ? phase / 0.2 : phase < 0.48 ? 1 : Math.max(0, 1 - (phase - 0.48) / 0.3);
        char.rightShoulder.rotation.x = 0.18 - reach * 1.58;
        char.rightShoulder.rotation.z = -0.15 - punchHeading * 0.3;
        char.rightElbow.rotation.x = -1.05 + reach * 0.88;
        char.leftShoulder.rotation.x = -0.65;
        char.leftElbow.rotation.x = -0.5;
        char.torso.rotation.x = reach * 0.08;
        char.headGroup.rotation.x = -0.04 + reach * 0.08;
        if (punchTimer >= 0.78) {
          animState = talking ? 'speak' : 'idle';
          facingYaw = 0;
        }
      } else if (animState === 'point') {
        pointTimer += dt;
        char.rightShoulder.rotation.x = -1.25;
        char.rightShoulder.rotation.z = -0.08;
        char.rightElbow.rotation.x = -0.12;
        char.leftShoulder.rotation.x = -0.28;
        char.leftElbow.rotation.x = -0.45;
        char.headGroup.rotation.x = -0.08;
        if (pointTimer > 1.5) animState = talking ? 'speak' : 'idle';
      } else if (animState === 'speak') {
        if (!talking) speakTimer -= dt;
        // Expressive speech head movements and hand gesturing
        char.headGroup.rotation.x = Math.sin(t * 6) * 0.08;
        char.headGroup.rotation.y = Math.sin(t * 3) * 0.08;
        char.rightShoulder.rotation.x = -0.6 + Math.sin(t * 4) * 0.2;
        char.rightElbow.rotation.x = -0.5;
        char.leftShoulder.rotation.x = -0.3 + Math.cos(t * 3) * 0.15;
        if (speakTimer <= 0) animState = 'idle';
      } else {
        // Idle hands resting near sides/pockets
        char.leftShoulder.rotation.set(0.1, 0, 0.15);
        char.rightShoulder.rotation.set(0.1, 0, -0.15);
        char.leftElbow.rotation.set(-0.35, 0, 0);
        char.rightElbow.rotation.set(-0.35, 0, 0);
        char.summonGroup.visible = false;
      }
    }
  });

  // Action Triggers
  st.wave = () => { if (!featureTravel) { animState = 'wave'; waveTimer = 2.0; } };
  st.setFeatureTravel = value => { featureTravel = !!value; };
  st.walkTo = (x, heading = Math.sign(x) * 0.24, endState = 'idle') => {
    currentTargetX = Math.max(-0.8, Math.min(0.8, x));
    facingYaw = Math.max(-0.7, Math.min(0.7, heading));
    walkEndState = endState === 'point' ? 'point' : 'idle';
    animState = 'walk';
  };
  st.pointAt = (fraction = 0) => {
    const x = Math.max(-0.72, Math.min(0.72, Number(fraction) || 0));
    st.walkTo(x, Math.sign(x) * 0.18, 'point');
  };
  st.summonTokens = () => { if (!featureTravel) { animState = 'summon_tokens'; summonTimer = 4.5; } };
  st.summonTree = () => { if (!featureTravel) { animState = 'summon_tree'; summonTimer = 4.5; } };
  st.speakAnim = (sec = 3.5) => { if (!featureTravel) { animState = 'speak'; speakTimer = sec; } };
  st.heroPunch = heading => {
    punchHeading = Math.max(-0.7, Math.min(0.7, Number(heading) || 0));
    facingYaw = punchHeading;
    punchTimer = 0;
    animState = 'punch';
  };
  st.setSpeaking = value => {
    talking = !!value;
    if (talking && animState === 'idle') { animState = 'speak'; speakTimer = 0; }
    if (!talking && animState === 'speak') speakTimer = 0;
  };
  st.pulseLevel = value => { speechPulse = Math.max(speechPulse, value); };

  activeGuide = st;
  S3.teacher = st;
  return st;
}

/* ---------- Lead Guide Floating Assistant Widget UI ---------- */
function initLeadGuideWidget() {
  if (document.getElementById('leadGuideContainer')) return;

  const wrap = document.createElement('div');
  wrap.id = 'leadGuideContainer';
  wrap.innerHTML = `
    <div class="guide-avatar-card">
      <div id="guide3dViewport" class="guide-3d-box"></div>
      <div class="guide-avatar-controls">
        <button id="guideReplayBtn" class="guide-icon-btn" type="button" aria-label="Replay welcome" title="Replay welcome">↻</button>
        <button id="guideMuteBtn" class="guide-icon-btn" type="button" aria-label="Mute teacher voice" title="Mute teacher voice">🔊</button>
      </div>
      <div id="guideSoundPill" class="guide-sound-pill" title="Click to hear teacher voice">🔊 Tap to hear voice</div>
    </div>
  `;

  document.body.appendChild(wrap);

  // Mount 3D Character
  const st = S3.leadController(document.getElementById('guide3dViewport'));
  if (st && window.Voice) Voice.avatar = [st];

  let voiceMuted = false, movingToFeature = false, voiceRun = 0, speechQueue = Promise.resolve(), activeSpeechTimer = null, activeSpeechResolve = null, stopRequest = Promise.resolve();
  let bubbleTimer = null;

  const showBubble = (text) => {
    const bubble = document.getElementById('guideSpeechBubble');
    const textEl = document.getElementById('guideSpeechText');
    if (!bubble || !textEl) return;
    clearTimeout(bubbleTimer);
    textEl.textContent = text;
    bubble.hidden = false;
    bubble.classList.remove('fade-out');
    bubbleTimer = setTimeout(() => {
      bubble.classList.add('fade-out');
      setTimeout(() => { bubble.hidden = true; }, 380);
    }, Math.max(5500, text.length * 68));
  };

  const speak = (msg, action = 'speak', point = 0, options = {}) => {
    const run = ++voiceRun;
    if (window.SoundFX) SoundFX.unlock();
    // Keep captions available only in the dedicated tutor lesson. The floating
    // character speaks without placing the narration text on top of the boy.
    const inTutorLesson = location.hash === '#tutor' && document.getElementById('cap');
    if (inTutorLesson && !options.noCaption) {
      const caption = document.getElementById('cap');
      caption.textContent = msg;
      caption.hidden = false;
    }

    if (st && action === 'point') {
      st.pointAt(point);
    } else if (st && !movingToFeature) {
      if (action === 'tokens') { st.summonTokens(); if (window.SoundFX) SoundFX.chime('tokens'); }
      else if (action === 'tree') { st.summonTree(); if (window.SoundFX) SoundFX.chime('tree'); }
      else if (action === 'wave') { st.wave(); if (window.SoundFX) SoundFX.chime('action'); }
      else st.speakAnim(Math.max(2.5, msg.length * 0.05));
    }

    if (!voiceMuted) {
      // Serialize speech requests so repeated clicks do not kill the Windows
      // speech host before it has time to start speaking.
      if (activeSpeechTimer) { clearTimeout(activeSpeechTimer); activeSpeechTimer = null; }
      if (activeSpeechResolve) { const resolve = activeSpeechResolve; activeSpeechResolve = null; resolve(); }
      if (st) st.setSpeaking(true);
      speechQueue = speechQueue.catch(() => {}).then(async () => {
        await stopRequest;
        if (run !== voiceRun || voiceMuted) return;
        const response = await fetch('/api/tts?direct=1&text=' + encodeURIComponent(msg));
        if (!response.ok) throw new Error('Windows voice could not start.');
        const estimate = Math.max(2400, msg.length * 76);
        if (run !== voiceRun) { fetch('/api/tts/stop', {method: 'POST'}).catch(() => {}); return; }
        await new Promise(resolve => { activeSpeechResolve = resolve; activeSpeechTimer = setTimeout(() => { activeSpeechTimer = null; activeSpeechResolve = null; resolve(); }, estimate); });
      }).catch(err => {
        console.warn('Guide voice could not start:', err);
        if (window.toast) toast('The guide could not start speech. Check the app server and Windows audio output.', 'err');
      }).finally(() => { if (run === voiceRun && st) st.setSpeaking(false); });
    }
    return speechQueue;
  };
  const stopSpeech = () => {
    voiceRun++;
    if (activeSpeechTimer) { clearTimeout(activeSpeechTimer); activeSpeechTimer = null; }
    if (activeSpeechResolve) { const resolve = activeSpeechResolve; activeSpeechResolve = null; resolve(); }
    if (st) st.setSpeaking(false);
    stopRequest = fetch('/api/tts/stop', {method: 'POST'}).catch(() => {});
    return stopRequest;
  };
  const welcome = "Welcome to Smart Python Optimizer. If you are new, start with a demonstration preset on the dashboard, open the Code Editor, and choose Analyze to see how Python source becomes tokens, a syntax tree, symbols, and control-flow graphs. Then choose Optimize to apply safe transformations and compare the before-and-after code. You can click pages, controls, charts, or graph blocks and I will explain what they mean and how to use them. The diagrams teach compiler ideas; they do not run your program.";

  let travelId = 0, travelTimers = [], activeTarget = null;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const travelToFeature = target => {
    const card = wrap.querySelector('.guide-avatar-card');
    if (!st || !card || !target) return;
    travelTimers.forEach(clearTimeout);
    travelTimers = [];
    if (activeTarget && activeTarget.isConnected) activeTarget.classList.remove('guide-target-approach', 'guide-target-hit');
    activeTarget = target;
    movingToFeature = true;
    st.setFeatureTravel(true);
    const id = ++travelId;
    wrap.style.transition = 'none';
    wrap.classList.remove('guide-traveling');
    void wrap.offsetWidth;

    const from = card.getBoundingClientRect();
    const currentX = parseFloat(wrap.style.getPropertyValue('--guide-x')) || 0;
    const currentY = parseFloat(wrap.style.getPropertyValue('--guide-y')) || 0;
    const to = target.getBoundingClientRect();
    const left = to.left + to.width / 2 < window.innerWidth / 2
      ? clamp(to.right + 12, 12, window.innerWidth - from.width - 12)
      : clamp(to.left - from.width - 12, 12, window.innerWidth - from.width - 12);
    const top = clamp(to.top + to.height / 2 - from.height / 2, 12, window.innerHeight - from.height - 12);
    const dx = left - (from.left - currentX), dy = top - (from.top - currentY);
    const walkDirection = Math.sign(dx) || 1;
    const heading = clamp((to.left + to.width / 2 - (left + from.width / 2)) / Math.max(from.width, 1), -0.7, 0.7);
    wrap.style.transition = '';
    wrap.classList.add('guide-traveling');
    wrap.style.setProperty('--guide-x', `${dx}px`);
    wrap.style.setProperty('--guide-y', `${dy}px`);
    st.walkTo(walkDirection * 0.72, walkDirection * 0.28);
    target.classList.add('guide-target-approach');

    travelTimers.push(setTimeout(() => {
      if (id !== travelId) return;
      if (target.isConnected) {
        target.classList.remove('guide-target-approach');
        target.classList.add('guide-target-hit');
        travelTimers.push(setTimeout(() => {
          target.classList.remove('guide-target-hit');
          if (activeTarget === target) activeTarget = null;
        }, 750));
      }
      st.heroPunch(heading);
      travelTimers.push(setTimeout(() => {
        if (id !== travelId) return;
        wrap.style.setProperty('--guide-x', '0px');
        wrap.style.setProperty('--guide-y', '0px');
        st.walkTo(0, 0);
        wrap.classList.remove('guide-traveling');
        movingToFeature = false;
        st.setFeatureTravel(false);
      }, 650));
    }, 560));
  };

  const pageLessons = {
    dashboard: "Welcome to Smart Python Optimizer. This dashboard is the starting point: choose a sample preset to load a small Python program, then use Analyze to inspect compiler stages or Optimize to see safe source transformations. The top file menu chooses which open file is active, and the left navigation opens each work area. The eight pipeline stages explain how source moves from tokens and syntax through analysis, optimization, code generation, and validation. The 3D diagrams are teaching views of compiler structures, not a live execution of your code.",
    editor: "The editor is where you enter and manage Python files. Use Upload to bring in one or more .py files, New file to create another tab, and Load sample to get a working example; the file chips switch the active source. Analyze reads the code and builds tokens, syntax trees, symbol diagnostics, control-flow and complexity results without changing it. Optimize runs the enabled passes and shows generated code and a change report. Clear empties the editor and Reset restores its original contents, so save anything you want to keep first. If you edit after an analysis, run Analyze or Optimize again because old results no longer describe the current text.",
    compiler: "Compiler Analysis is the project’s microscope for the active Python file. Tokens shows how the tokenizer divides source into names, numbers, operators, and punctuation; AST shows nested syntax objects; Symbols reports scopes and names; IR shows three-address intermediate instructions; Data-flow tracks facts across blocks; and SSA gives assignments unique versions with phi-functions at joins. Use the phase tabs to compare these representations of the same source. These are static models, so behavior created dynamically at runtime may not be visible.",
    cfg: "A control-flow graph, or CFG, divides a function into basic blocks and draws edges for possible next steps. A node is a block of instructions; an arrow is a possible transfer, including true/false branches and loop back-edges. Select a node to inspect its instructions and dominator, use Scope to switch functions, and Fit view to bring the graph into frame. Play and Step animate a teaching path through the graph; they do not execute your Python program, and a simulated path is only one possible route. Switch to the dominator tree to see which blocks every route must pass through.",
    results: "Optimization Results are the audit trail for Optimize. The summary counts opportunities and actual changes; the transformation list explains each changed expression and identifies its pass and source line. Use the search field and pass filter to find a transformation, then inspect the before-and-after code and explanation. Recommendations are suggestions; the optimizer does not silently apply most algorithm changes. Static validation checks that generated code parses and passes project checks, but it cannot prove every runtime behavior is preserved. Compare the output and run trusted test cases before relying on a change.",
    algorithms: "Algorithm Analysis looks for common performance patterns such as repeated recursive work, nested scans, and costly data-structure choices. It estimates the likely time or space effect and may suggest memoization or another approach. A recommendation is an explanation, not a guaranteed speedup: it depends on input shape, data, and program behavior. Review the proposed code, preserve edge cases, and benchmark representative inputs before adopting it.",
    compare: "Code Comparison places the original program beside the generated version. Color marks show removed, changed, and inserted lines; selecting a change focuses the corresponding code area. This is useful for checking what an optimization actually rewrote before downloading it. The generator unparses a Python syntax tree, so comments and original formatting are not preserved even when program logic is unchanged. Use Validate for selected behavior checks, and inspect the diff yourself.",
    complexity: "Complexity Analyzer estimates how running time and extra memory grow as input size grows. Big O describes growth, not seconds: O(n) means work tends to grow proportionally with input, while O(n²) can grow much faster for large inputs. The graph plots the analyzer’s model for original and optimized code; it is not a stopwatch and small-looking curves do not prove a speedup. Static recognition is approximate, especially for dynamic Python and library calls. Use Benchmarking for measurements on representative inputs.",
    benchmark: "Benchmarking runs the original and optimized versions on input sizes you choose, then reports elapsed time and peak memory. Enter a callable entry point and matching sizes; increase repeats to reduce timing noise, and keep runs small enough to finish within the timeout. Compare several sizes rather than trusting one measurement, because startup costs and machine load affect results. This feature executes the submitted program in a limited subprocess, not a security sandbox, so benchmark only code you trust.",
    history: "Optimization History lists reports saved by earlier runs on this machine. Search narrows the list, the filter can focus on runs with measurements, and opening a report lets you revisit its code changes. Old entries are snapshots; they do not update when you edit the current file. Clear all removes the saved history from this app, so use it only when you no longer need those records.",
    reports: "Reports and Downloads exports the current optimization report. HTML is convenient to open in a browser, Markdown is easy to read or edit as text, JSON is structured data, and the buttons can download optimized Python files. Exporting does not run the generated program. Check the report’s filename and transformation list before sharing or submitting it.",
    final: "The Final Academic Report assembles a presentation-ready summary for the active optimized file. Enter your student and course details, choose whether to include diagram screenshots and lesson notes, then Generate to preview the self-contained report. Benchmark and validation sections appear only if you ran those actions; estimates must not be described as measured results. Use Print or Save as PDF to create a copy, and review the preview before submitting it.",
    tutor: "The Voice Tutor turns the active file’s analysis into a guided compiler lesson. Play walks through the lesson; Previous and Next move one explanation at a time; Ask answers glossary or source questions and can accept spoken questions where the browser supports recognition; Quiz checks concepts from the current report. The caption shows the same lesson text as the narration. The CFG panel lets you select a scope and block; the teacher points to the selected block and explains its instructions. Lessons are generated from this project’s analysis and glossary, not from a general-purpose AI model.",
    settings: "Settings let you choose which optimizer passes run, select the speaking voice and language, adjust speech speed, and tune 3D quality. Start with conservative defaults: assuming untyped values are numeric can enable more transformations but may be wrong for strings or lists. Treat a module as a script only if you do not need module-level names to remain part of an importable API. Lower 3D quality can help on slower graphics hardware; Off uses 2D fallbacks. Run the regression suite after changing optimization assumptions."
  };

  const controlLessons = {
    quickAnalyze: 'Analyze inspects the active file and refreshes compiler results without rewriting your code. It tokenizes and parses the program, checks names, and builds IR, CFG, data-flow, SSA, and complexity information. Open Compiler Analysis or Control Flow Graph to inspect the results.',
    quickOptimize: 'Optimize runs the enabled conservative optimization passes on the active file, validates the generated Python, and saves a report. It does not run your program. Open Optimization Results to review every applied change and Code Comparison to inspect the full diff.',
    qsSmall: 'This preset loads a complete small demonstration program. It is a good first example: Analyze it to see the compiler representations, then Optimize it to inspect transformations and their explanations.',
    qsConst: 'This example is designed to show constant folding and dead-code elimination. After it loads, run Optimize and inspect the transformation list to see which constant expressions were evaluated and which unused assignments were removed.',
    qsLicm: 'This example contains repeated expressions and loop work for LICM and common-subexpression elimination. Optimize it, then compare the loop before and after; only transformations the safety analysis can justify will be applied.',
    qsMemo: 'This example demonstrates recursive computation and algorithm analysis. Run Analyze for the recursion and complexity view, then inspect the recommendation for memoization. Suggestions need review because caching changes memory use and behavior for impure functions.',
    qsLarge: 'This stress-test preset loads a large Python source file to exercise the editor and analysis pipeline. It may take longer to analyze or optimize than the small examples, so start with Analyze and wait for completion before running additional actions.',
    runNow: 'This button starts the analysis or optimization needed for the page you requested. Analysis only reports findings; optimization generates changed source. Review the results before downloading or running code.',
    newF: 'New file adds a separate Python file to the workspace. Use the file selector to switch among files; each file has its own source and analysis results.',
    up: 'Upload imports Python source files from your computer into this workspace. Uploaded code is analyzed locally by this project; select the intended file before running Analyze or Optimize.',
    samp: 'Load sample fills the editor with a built-in example. It replaces the current editor contents for the selected file, so save your own source first if you need it.',
    clr: 'Clear removes the current editor text. Use it when you want to start over; it does not run or save the code.',
    rst: 'Reset restores the editor to the selected file’s saved or initial contents. Check the source before continuing if you have unsaved edits.',
    an: 'Analyze reads the current source and refreshes the compiler views without applying code changes. It is the best first step when you want to understand a program.',
    op: 'Optimize applies enabled transformations and produces a before-and-after report. Review the diff and validation notes; optimization does not execute the result.',
    expAll: 'Expand All opens every visible abstract-syntax-tree node so you can inspect the full nesting structure. Large programs may create a long tree.',
    colAll: 'Collapse All hides child AST nodes and leaves a compact outline. Expand a branch again when you want to study its syntax.',
    domToggle: 'This switches between the control-flow graph layout and the dominator tree. A dominator is a block every route from the entry must pass through; that structure helps explain loops and optimization analysis.',
    simPlay: 'Play animates one possible route through the selected scope’s control-flow graph. It is a visualization, not execution of the source program.',
    simPause: 'Pause stops the control-flow teaching animation while keeping the current block selected.',
    simStep: 'Step advances the teaching program counter by one graph edge so you can inspect a possible branch or loop transition. It does not execute Python instructions.',
    simReset: 'Reset returns the graph animation to its entry block and clears the current teaching path.',
    toggleCfgMode: 'Switch graph mode to compare the 3D CFG tower with the 2D graph. Both show the same basic blocks and possible control-flow edges.',
    fit: 'Fit view reframes the current graph so its nodes and edges are visible. Drag to rotate or pan, and scroll to zoom.',
    reAn: 'Re-analyze refreshes compiler results after the source has changed. This prevents you from relying on diagnostics or graphs from an earlier version.',
    reOp: 'Re-optimize applies the enabled passes to the latest source and creates a fresh report. Previous results describe the older source and may no longer apply.',
    val: 'Validate compares selected behavior of the original and optimized programs. Passing examples are useful evidence but do not prove equivalence; only run code you trust.',
    runB: 'Run benchmark executes the original and optimized entry point for the selected input sizes and repeats. Use trusted code and interpret small timing differences as noise.',
    tv: 'Test voice speaks a short phrase using the selected voice and language. If you hear nothing, check the laptop output device and Windows speech voices, then try another installed voice.',
    ri: 'Replay intro starts the welcome explanation and its compiler overview again.',
    rg: 'Run regression suite checks the project’s built-in sample cases against expected optimizer behavior. It tests the application, not whether your own program is correct.',
    rs: 'Reset to defaults restores the recommended optimization passes and settings. Any custom pass selection, voice, or quality preference will be replaced.',
    pf: 'This filter narrows the transformation list to one optimizer pass. Choose All passes to see every recorded change again.',
    applyAp: 'Apply approved applies only recommendations you have explicitly selected, then runs optimization again. Review each suggested change before approving it.',
    dl: 'Download saves the optimized Python source or current comparison artifact to your computer. Review the generated code first; downloading does not execute it.',
    dlz: 'Download all optimized files packages the generated versions of the optimized files into one ZIP archive. Check the active reports before sharing it.',
    gen: 'Generate builds the final academic report from the current analysis and optimization. Preview it first, because optional screenshots and benchmark results depend on what you selected or ran.',
    inShots: 'Include 3D screenshots adds visual snapshots of the compiler graphs and charts to the final report. Turn it off for a smaller, text-only report.',
    inLesson: 'Include tutor lesson notes adds the generated explanations for this source to the final report.',
    logS: 'Log scale changes the chart axis so very small and very large growth values can be compared. It changes how the curve is drawn, not the analyzer’s complexity estimate.',
    as: 'Treat module as a script allows removal of unused module-level variables. Leave it off if other Python files import this module and depend on those names.',
    anNumeric: 'Assume untyped values are numeric allows arithmetic optimizations on parameters without type annotations. This can be wrong for strings or custom objects, so keep it off unless you know the input types and validate the output.',
    q3: '3D quality trades detail for graphics performance. Choose Low on a slower laptop, or Off to use the 2D graph fallbacks if WebGL is unavailable.',
    vo: 'This switch enables or disables browser speech for the Voice Tutor and intro. The floating guide has its own speaker button.',
    voiceChoice: 'Choose an installed device voice for browser narration. Automatic selects a voice matching the chosen language when possible.',
    rt: 'Speech speed changes how quickly browser narration is spoken. Move it slightly at a time so explanations remain easy to follow.',
    lg: 'Language sets the tutor lesson and report language. Some device voices may not support every language, so the app may choose a fallback voice.',
    scopeSel: 'Scope selects which function’s basic blocks appear in the control-flow graph. A function has its own graph because its branches and loops are analyzed separately.',
    fileSel: 'The active-file selector switches the editor, compiler results, and optimization report to another open Python file. Always confirm the selected filename before analyzing or optimizing.',
    quickAnalyze: 'Analyze inspects the active Python file without rewriting source. It builds token, syntax, symbol, intermediate-code, control-flow, data-flow, SSA, and complexity information for the other pages.',
    quickOptimize: 'Optimize applies enabled transformations to the active file, validates generated syntax, and records changes for Results and Comparison. It does not execute the program.',
    pasteToggle: 'Paste code opens a dedicated text box. Paste Python with Ctrl+V or Command+V, then choose Use pasted code to replace the active editor file. Existing analysis and optimization results are cleared because they would describe the previous source.',
    pasteApply: 'Use pasted code replaces the active file with the source in the paste box. It clears results for the old source; choose Analyze to inspect the pasted program or Optimize to apply enabled passes.',
    pasteCancel: 'Cancel closes the paste box without changing the active source.',
    upProject: 'Upload project folder reads Python files from a folder you choose, skips common generated and dependency folders, and keeps each module’s relative path. Project uploads are limited to 100 Python files and 8 MB of source.',
    projectOptimize: 'Optimize project runs the optimizer on every Python module loaded from the project folder, records a report for each module, and leaves files with errors unchanged. Modules are processed independently; imports and public APIs are not rewritten across files.',
    projectDownload: 'Project ZIP packages the optimized modules under their original project paths in an optimized_project folder. This keeps package layout and import paths intact; review the per-file reports before replacing any originals.',
    burger: 'The menu button opens or closes the navigation on a narrow screen. Use the navigation links to switch among the editor, compiler views, results, performance tools, reports, tutor, and settings.',
    compilerPipeHero: 'This animated factory is a visual overview of the compiler pipeline. Choose a station to learn about its phase; the moving objects are a teaching animation and do not represent runtime execution of your Python.',
    langSel: 'The top language selector changes the language used by tutor lessons, reports, and the welcome narration where a matching installed voice is available.',
    entry: 'Entry point tells the benchmark which function or expression to call for each run. Enter a callable and arguments that match the selected program; leave it blank only if the benchmark page provides a default.',
    sizes: 'Input sizes are the values passed to the benchmark entry point. Use increasing sizes to compare scaling, and start small if the program may take a long time.',
    rep: 'Repeats controls how many timing samples the benchmark collects for each input size. More repeats take longer but can make averages less sensitive to short-lived system load.',
    astSearch: 'Filter AST nodes narrows the syntax-tree outline to matching node types or names. Clear the field to restore the complete tree.',
    up: 'Upload imports Python source files from your computer into this workspace. Uploaded code is analyzed locally by this project; select the intended file before running Analyze or Optimize.',
    samp: 'Choose a built-in Python example to load into the editor. Presets demonstrate different compiler and optimization concepts; loading one replaces the selected file source.',
    hc: 'Clear all permanently deletes the saved optimization history stored by this app. Export any reports you want to keep before clearing it.',
    hq: 'Search history filters saved optimization runs by filename or report text. Clear the query to show the full local history again.',
    hs: 'This history filter shows runs with time measurements when selected. It does not rerun a benchmark.',
    pf: 'Pass filter limits the results list to changes from one optimizer pass. Select All passes to restore the complete change list.',
    tv: 'Test voice plays a short sample through the tutor voice. If silent, verify the laptop output device and Windows volume, then try the replay or sound control again.',
    bPlay: 'Play starts the tutor lesson and speaks its explanations in order. Use Previous and Next to control the pace; the caption below the teacher mirrors the current lesson.',
    bPrev: 'Previous returns to the earlier lesson step and reads that explanation again.',
    bNext: 'Next advances to the next lesson step and reads its explanation.',
    qGo: 'Ask submits your question to the tutor glossary and source-aware answer helper. Ask about a compiler term, analysis result, or optimization shown for the current file.',
    qMic: 'The microphone starts browser speech recognition for your question when the browser and microphone permission support it. You can type the question if speech recognition is unavailable.',
    again: 'New quiz creates another set of concept questions from this file’s lesson.',
    nx: 'Next checks the selected quiz response and advances to another question.',
    pr: 'Print opens the browser print dialog, where you can print or save the report as a PDF.',
    hc: 'Clear all permanently deletes the saved optimization history stored by this app. Export reports you want to keep before clearing it.',
    ri: 'Replay intro starts the project overview again and walks through the main workflow for a new user.',
    dlz: 'Download all optimized files saves the generated versions together as a ZIP. Check which files have current optimization results before downloading.',
    dlo: 'Download optimized Python saves the active file’s generated source. Review the comparison first; downloading does not run the file.',
    vinfo: 'This status tells you which speech voice and language the app selected. A fallback voice can speak a different accent or language when the requested system voice is unavailable.',
    tutorCfgScope: 'Choose the function whose control-flow graph you want to inspect. Each scope gets its own set of basic blocks and branch paths.',
    q: 'Search transformations by pass, source text, or explanation. Clear the query to show all recorded changes again.'
  };
  const graphLessons = {
    cy: 'This is a control-flow graph for the selected function. Each node is a basic block and each arrow is a possible transfer of control. Select a block to inspect its instructions, reachability, and immediate dominator; loop back-edges show where repetition can happen.',
    cy3d: 'This 3D tower is the control-flow graph for the selected function. Blocks are stacked by flow, and colored arrows distinguish branches, loop backs, and exceptional paths. Click a block to inspect its instructions; use simulation controls to trace one possible route without executing the program.',
    tutorCfg: 'This is the lesson-linked control-flow graph. Choose a scope to switch functions, then click a block; I will explain its instructions and move to point at that block. Arrows show possible transfers, not a guaranteed runtime trace.',
    ast3d: 'This is a three-dimensional abstract syntax tree. Parent nodes contain expressions or statements, and child nodes show their components. Use it to see how Python nesting and operator precedence are represented after parsing; it is structure, not execution order.',
    chTok: 'These bars count token categories found by the Python tokenizer. Compare names, keywords, operators, and literals to get a quick picture of the source vocabulary; a high count is not by itself a performance problem.',
    dfa3d: 'This diagram visualizes the lexer’s finite-state recognition of token patterns. States represent recognition progress and transitions show how characters advance the scanner. It explains tokenization rules; it does not execute the program.',
    cg3d: 'This is a call graph. Each node represents a function and each arrow indicates a call from one function to another. Cycles can reveal recursion, while disconnected functions may be unused or reachable only through dynamic behavior.',
    city3d: 'This Code City maps source lines to buildings so dense or tall regions are easy to spot. In comparison views, colors distinguish changed, added, removed, and unchanged lines. Select a building to inspect the source line when that view supports line selection.',
    tcity: 'This Code City compares the original and optimized source. Each building represents a source line; the left and right districts show the two versions, and color marks indicate changes. The lesson focuses the line associated with the current optimization explanation.',
    sCity: 'This report preview maps the original and optimized source into two Code City districts. Heights reflect line length, while colors show changed, inserted, or removed lines. It is a visual summary; use the diff for exact text.',
    chGrow: 'These curves compare estimated operation growth for the original and optimized code as input size increases. The log scale helps display very different growth rates together. These are static estimates, not measured runtime; use the benchmark page for timing.',
    chM: 'This chart compares estimated auxiliary memory growth. It describes additional space used as input grows, not total machine memory or a measured peak.',
    chT: 'This chart compares estimated time-complexity growth. Big O describes how work scales, not how many seconds one run takes.',
    master3d: 'This visualization compares the recurrence’s growth against common complexity classes. It is a teaching model based on the analyzer’s recurrence estimate, so inspect the written assumptions before treating it as a result.',
    terrain3d: 'This surface visualizes how an estimated operation count changes across input dimensions. It helps compare trends and hotspots, but it is a model rather than measured performance.',
    transLab3d: 'This transformation view summarizes optimizer passes and their recorded changes. Choose a pass or result to understand what changed, then verify the before-and-after source in the diff.',
    chDist: 'These bars count applied transformations by optimization pass. A taller bar means that pass recorded more source changes; it does not mean that pass delivered the largest speedup.',
    chPass: 'This chart counts transformations by pass. It measures how many changes were applied, not how much runtime each pass saved.',
    chBench: 'These measured bars compare original and optimized benchmark times for the selected input sizes. Use repeated runs and several sizes; machine load and small sample noise can affect the result.',
    hx3d: 'Each point in this history helix represents a saved optimization run. It is a visual index of past reports, not a live view of the current source.',
    sCfg: 'This report snapshot shows the analyzed control-flow graph. Nodes are basic blocks, edges are possible branches, and loop edges return to earlier blocks. It was captured for the report and does not simulate execution.',
    sGrow: 'This report snapshot compares estimated complexity curves for original and optimized source. It illustrates scaling trends; it does not report measured seconds.',
    sPass: 'This report snapshot counts applied changes by optimizer pass. Counts should be read alongside each transformation explanation and any benchmark results.',
    sBench: 'This report snapshot shows measured benchmark timings. The results depend on the selected input sizes, repeats, and machine conditions.',
    sCg: 'This report snapshot shows the call graph. Nodes are functions and arrows show calls between them; recursive cycles are highlighted when the analyzer detects them.',
    chBench: 'These measured bars compare original and optimized benchmark times for the selected input sizes. Use repeated runs and several sizes; machine load and small sample noise can affect the result.'
  };
  const nodeLessons = {
    FunctionDef: 'A FunctionDef node represents a function declaration. Its children include the function name, parameters, decorators, and body. Click a child to inspect a smaller part of this syntax tree.',
    AsyncFunctionDef: 'An AsyncFunctionDef represents an asynchronous function declared with async def. Its body can suspend at await expressions, so its control flow includes asynchronous behavior that a static graph only approximates.',
    ClassDef: 'A ClassDef node represents a class declaration, including its name, base classes, and body. Methods inside it are function definitions nested in the class namespace.',
    Return: 'A Return node exits the current function and optionally supplies a value to its caller. A return inside a branch means only paths that reach that statement exit there.',
    If: 'An If node tests a condition and chooses between its body and else branch. The control-flow graph represents these alternatives with outgoing edges.',
    For: 'A For node iterates over an iterable. Its body may execute zero or many times depending on the iterable, and a loop-back edge represents another iteration.',
    While: 'A While node repeats its body while a condition remains true. A condition that never becomes false can create an infinite loop.',
    Assign: 'An Assign node binds the result of its value expression to one or more targets. In Python, assigning a name does not necessarily copy an object; names refer to objects.',
    AugAssign: 'An AugAssign node combines an operation and assignment, such as total += value. Python may implement this differently from a simple reassignment for mutable objects.',
    Call: 'A Call node evaluates a callable and passes positional or keyword arguments. The call graph can summarize known function calls, though dynamic dispatch may hide targets.',
    BinOp: 'A BinOp node applies a binary operator to a left and right expression. The child nodes show operand structure, while the operator determines the operation and precedence.',
    Compare: 'A Compare node evaluates one or more comparisons. Python supports chained comparisons such as a < b < c, which are not always equivalent to combining two comparisons with and.',
    Name: 'A Name node refers to an identifier. Its meaning depends on the current scope and may refer to a local, global, parameter, imported name, or built-in.',
    Constant: 'A Constant node contains a literal value such as a number, string, boolean, or None. Known constants can enable folding when the operation is safe.',
    Import: 'An Import node loads one or more modules and binds names. Imports can have side effects, so removing one requires care even when its name is not referenced directly.',
    ImportFrom: 'An ImportFrom node binds selected names from a module. Static unused-import checks may miss uses through reflection or other dynamic patterns.',
    ListComp: 'A ListComp node builds a list from an expression and one or more generators, optionally filtered by conditions. It allocates the complete list in memory.',
    DictComp: 'A DictComp node builds a dictionary from generated key and value expressions. Duplicate keys overwrite earlier values as the comprehension proceeds.',
    Lambda: 'A Lambda node creates a small anonymous function expression. It captures names from its surrounding scope and returns the value of its expression.',
    Try: 'A Try node separates normal execution from exception handlers and optional else and finally blocks. Exceptions create control-flow paths that ordinary branches do not show.',
    With: 'A With node manages a resource through a context manager. The manager’s exit logic runs when control leaves the block, including when an exception occurs.',
    BoolOp: 'A BoolOp node combines conditions with and or or. Python short-circuits: later operands are evaluated only when needed.',
    UnaryOp: 'A UnaryOp node applies one operator to one operand, such as not, unary minus, or bitwise inversion.',
    Expr: 'An Expr node evaluates an expression as a statement, often because the expression is a function call. Any side effects from that call may matter even if its value is unused.'
  };

  window.ProjectGuide = {
    explain: (text, action = 'speak', options = {}) => speak(text, action, 0, options),
    stopVoice: stopSpeech,
    line(side, line, text, total = 1, options = {}) {
      const fraction = total < 2 ? 0 : (Math.max(1, Math.min(total, line)) / total - 0.5) * 1.35;
      if (options.focusOnly) { if (st) st.pointAt(fraction); return; }
      speak(`You selected line ${line} in the ${side === 'left' ? 'original' : 'optimized'} source. ${text ? `The code here is ${text}.` : 'This line is part of the displayed source.'} In Code City, each building corresponds to one source line; its height reflects line length and its color shows whether it changed.`, 'point', fraction);
    },
    node(nodeType, label = '') {
      const key = Object.keys(nodeLessons).find(k => String(nodeType || label).startsWith(k));
      if (key) speak(nodeLessons[key], 'tree');
      else speak(`This syntax node is ${nodeType || label || 'an AST item'}. Its children represent the parts Python parsed inside it. Expand or select nearby nodes to see how the statement or expression is nested.`, 'tree');
    },
    block(node, scope, index = 0, count = 1) {
      if (!node) return;
      const label = node.label || node.id || 'selected block';
      const instructions = (node.instrs || node.tip || []).map(x => String(x).replace(/<[^>]*>/g, '').trim()).filter(Boolean).slice(0, 5);
      const status = node.reach === false || node.reachable === false ? 'The analyzer marks this block unreachable from the entry.' : 'This block is reachable according to the graph analysis.';
      const detail = instructions.length ? ` Its instructions are ${instructions.join('; ')}.` : ' It has no displayed instructions.';
      const merge = node.idom ? ` Its immediate dominator is ${node.idom}, the closest block that every incoming path must pass through.` : '';
      const direction = count < 2 ? 0 : (index / (count - 1) - 0.5) * 1.35;
      speak(`You selected ${label} in scope ${scope}. A basic block is a straight-line group of instructions with no branch inside it.${detail} ${status}${merge} Follow its outgoing arrows to see where control can go next.`, 'point', direction);
    }
  };
  const soundPill = document.getElementById('guideSoundPill');
  const dismissPill = () => {
    if (soundPill) {
      soundPill.style.opacity = '0';
      setTimeout(() => { if (soundPill.parentNode) soundPill.remove(); }, 300);
    }
  };
  if (soundPill) {
    soundPill.onclick = (e) => {
      e.stopPropagation();
      dismissPill();
      if (window.Voice) Voice.unlock();
      if (window.SoundFX) SoundFX.chime('success');
      if (window.toast) toast("🔊 Sound active! If still quiet, ensure your device speaker and browser tab are not muted.", "ok");
      speak(welcome, 'wave');
    };
  }

  document.getElementById('guideReplayBtn').onclick = () => {
    dismissPill();
    if (window.Voice) Voice.unlock();
    if (window.SoundFX) SoundFX.chime('action');
    if (window.toast) toast("🔊 Playing teacher voice...", "ok");
    speak(welcome, 'wave');
  };

  document.getElementById('guideMuteBtn').onclick = () => {
    dismissPill();
    if (window.Voice) Voice.unlock();
    voiceMuted = !voiceMuted;
    document.getElementById('guideMuteBtn').textContent = voiceMuted ? '🔇' : '🔊';
    document.getElementById('guideMuteBtn').setAttribute('aria-label', voiceMuted ? 'Unmute teacher voice' : 'Mute teacher voice');
    document.getElementById('guideMuteBtn').setAttribute('aria-pressed', String(voiceMuted));
    if (voiceMuted && window.Voice) {
      Voice.stop();
      if (activeSpeechTimer) { clearTimeout(activeSpeechTimer); activeSpeechTimer = null; }
      voiceRun++;
      fetch('/api/tts/stop', {method: 'POST'}).catch(() => {});
    } else {
      if (window.SoundFX) SoundFX.chime('success');
      speak("Voice audio is active and unmuted.", 'speak');
    }
  };

  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : e.target.parentElement;
    if (!target || target.closest('#leadGuideContainer')) return;

    let feature = target.closest('button, a, [role="button"], .pipe-step, .s3, #cy, select, input[type="checkbox"], input[type="range"], input[type="text"]:not(.ace_text-input), input[type="number"], textarea:not(.ace_text-input)');
    if (!feature) feature = target.closest('label')?.querySelector('select, input[type="checkbox"], input[type="range"], input[type="text"], input[type="number"]') || null;
    if (feature) travelToFeature(feature);
    if (target.closest('#bPlay, #bNext, #bPrev, #qGo, #qMic, #qs, #nx, .quiz-opt, .stepbar button, .tabs button')) return;

    const step = target.closest('.pipe-step');
    if (step) {
      const pTitle = (step.querySelector('.p-title') || {}).textContent || '';
      if (pTitle.includes('Lexer')) {
        speak(pageLessons.compiler + " In this phase the Python tokenizer classifies the source into a token stream.", 'tokens');
      } else if (pTitle.includes('Parser')) {
        speak(pageLessons.compiler + " The parser constructs the AST after checking Python syntax.", 'tree');
      } else if (pTitle.includes('Semantic')) {
        speak("Semantic analysis builds scoped symbol tables and reports possibly undefined names, unused local variables, and unused imports. In dynamic Python programs these checks are necessarily conservative and may not see names introduced through reflection or runtime imports.", 'speak');
      } else if (pTitle.includes('TAC IR')) {
        speak("The intermediate representation and control-flow graph organize instructions into basic blocks and represent possible branches and loop edges. This makes later data-flow and optimization analyses easier to explain. The graph describes possible flow, not a trace of a particular run.", 'speak');
      } else if (pTitle.includes('SSA')) {
        speak("Static single-assignment form gives each assignment a distinct variable version. Phi functions merge versions where control-flow paths join, making definitions and uses easier to reason about.", 'tree');
      } else if (pTitle.includes('Pass Manager')) {
        speak(pageLessons.results);
      } else if (pTitle.includes('Code Gen')) {
        speak("Code generation unparses the optimized Python AST back into source text. The comparison view highlights changes against the original. Because generation uses AST unparsing, comments and original formatting are not retained.", 'speak');
      } else if (pTitle.includes('Validation')) {
        speak("Differential validation runs selected test cases against the original and optimized programs and compares their results. Passing those cases is useful evidence, not a guarantee of equivalence. The subprocess limits are not a security sandbox, so do not run untrusted code.", 'speak');
      }
      return;
    }

    const graphic = target.closest('.s3, #cy');
    if (graphic) {
      const lesson = graphLessons[graphic.id];
      if (lesson) speak(lesson, graphic.id.includes('ast') || graphic.id.includes('dfa') ? 'tree' : 'speak');
      else {
        const page = pageLessons[location.hash.slice(1) || 'dashboard'] || pageLessons.dashboard;
        speak(`This is an interactive visualization on the ${location.hash.slice(1) || 'dashboard'} page. Drag to rotate the 3D view, scroll to zoom, and select a visible node or control to inspect its details. Its labels and colors summarize analysis results; they are not a trace of your program running. ${page}`, 'tree');
      }
      return;
    }

    const btn = target.closest('button, a, [role="button"]');
    if (btn) {
      const txt = (btn.textContent || '').trim();
      const id = btn.id || '';
      const route = btn.dataset.id;
      if (route && pageLessons[route]) {
        speak(pageLessons[route], route === 'compiler' ? 'tree' : 'speak');
      } else if (controlLessons[id]) {
        speak(controlLessons[id], /ast|cfg|dom|sim|fit|Pass|Grow/i.test(id) ? 'tree' : 'speak');
      } else if (btn.matches('.stepbar button')) {
        const index = Number(btn.dataset.i), cap = document.getElementById('cap');
        if (cap && Number.isInteger(index)) speak(`Lesson step ${index + 1} selected. ${cap.textContent}`, 'speak', 0, {noCaption: true});
      } else if (btn.closest('#lgs')) {
        speak(`You selected ${txt}. Tutor lessons and voice guidance will use the selected language where a matching installed voice is available.`, 'speak');
      } else if (btn.matches('.tabs button')) {
        const label = txt.replace(/\s+/g, ' ').trim();
        const detail = /Ask/i.test(label) ? 'The Ask tab lets you ask about compiler terms or this file. Enter a question or choose a glossary term, then submit it; voice recognition depends on browser support.' : /Quiz/i.test(label) ? 'The Quiz tab checks concepts from the current analysis and optimization lesson. Read each option and use Next to continue through the questions.' : 'The Lesson tab presents the guided explanation for the current source. Use Play, Previous, and Next to control lesson narration.';
        speak(detail, 'speak');
      } else if (btn.matches('.quiz-opt')) {
        speak(`You selected answer ${txt}. The quiz will tell you whether it matches the concept and show the correct answer when needed.`, 'speak');
      } else if (btn.closest('#tbody') && txt) {
        speak(`You selected ${txt}. This control belongs to the tutor. The current lesson and captions explain the compiler concept; use the Lesson, Ask, and Quiz tabs to learn, ask questions, or check your understanding.`, 'speak', 0, {noCaption: true});
      } else if (id === 'quickAnalyze' || id === 'an') {
        speak("Analyze processes the active source without changing it. It tokenizes the code, parses it into an AST, runs semantic checks, builds intermediate and control-flow representations, computes data-flow and SSA summaries, and estimates complexity. If the editor has changed since the previous analysis, these results will be refreshed.");
      } else if (id === 'quickOptimize' || id === 'op') {
        speak("Optimize applies the enabled, conservative AST passes to the active source. It validates generated Python and reports each actual change. The optimizer does not execute the program; use the explicit validation or benchmark controls when you want runtime tests, and only run code you trust.");
      } else if (id === 'simPlay' || id === 'simStep') {
        speak("The simulator animates a selected route through the displayed control-flow blocks. It is an educational visualization of the graph and should not be confused with executing your Python program.", 'speak');
      } else if (id === 'domToggle') {
        speak("The dominator view reorganizes the control-flow graph around dominance relationships. A node dominates another when every path from the entry to that node passes through it; this helps explain loop structure and some optimization analyses.", 'tree');
      } else if (txt.includes('Constant Folding')) {
        speak("Constant folding evaluates a supported expression at compile time when its operands are known constants, for example replacing 10 + 20 with 30. The implementation uses conservative rules and leaves expressions alone when it cannot safely prove the result.", 'tokens');
      } else if (txt.includes('Dead Code')) {
        speak("Dead-code elimination removes assignments that cannot affect a later observable result, subject to the optimizer's safety rules. Expressions with side effects must be retained, and the transformation list shows what was actually removed.", 'speak');
      } else if (txt.includes('LICM')) {
        speak("Loop-invariant code motion can move a safe expression out of a loop when its value does not change between iterations. This avoids repeating that computation, but the pass only acts when its conservative analysis considers the move safe.", 'tree');
      } else if (txt.includes('Common subexpression') || txt.includes('CSE')) {
        speak('Common-subexpression elimination reuses a previously computed value when the same safe expression appears again and its inputs have not changed. This can reduce repeated arithmetic, but the optimizer avoids expressions with uncertain types or side effects.');
      } else if (txt.includes('Constant propagation')) {
        speak('Constant propagation follows known values through assignments. If a variable is known to hold a constant, later uses can be replaced with that value, which may expose more folding opportunities.');
      } else if (txt.includes('Copy propagation')) {
        speak('Copy propagation replaces a temporary name with the value or variable it simply copied, when doing so is safe. This can simplify later expressions and make dead assignments visible.');
      } else if (txt.includes('Function inlining') || txt.includes('Inlining')) {
        speak('Function inlining substitutes a small function body at a call site to reduce call overhead and expose more optimization opportunities. It can increase code size and is limited to simple functions whose behavior the optimizer can safely reproduce.');
      } else if (txt.includes('Loop unrolling')) {
        speak('Loop unrolling expands a small loop into repeated statements to reduce loop-control overhead. It can make code larger, so this optimizer only considers short constant-trip loops.');
      } else if (txt.includes('Strength reduction')) {
        speak('Strength reduction replaces repeated arithmetic with a cheaper equivalent when numeric assumptions are safe. The Python optimizer only changes supported cases it can justify, because changing operators can alter behavior for strings or custom objects.');
      } else if (txt.includes('Unused imports')) {
        speak('Unused-import removal deletes imported names the analyzer cannot find referenced in the module. Reflection and dynamic use can be invisible to static analysis, so review the diff if your program looks up imports dynamically.');
      } else if (id === 'samp' || txt.includes('demo_small.py') || txt.includes('Constant Folding & DCE') || txt.includes('LICM & CSE') || txt.includes('Recursion & Memoization')) {
        speak("This preset loads a small demonstration program into the editor. After it loads, choose Analyze to inspect compiler structures or Optimize to see which transformations apply to that example.");
      } else if (btn.title || btn.getAttribute('aria-label')) {
        speak(`${btn.title || btn.getAttribute('aria-label')}. ${pageLessons[location.hash.slice(1) || 'dashboard'] || pageLessons.dashboard}`);
      } else {
        const label = (btn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 64);
        if (label) speak(`You selected ${label}. ${pageLessons[location.hash.slice(1) || 'dashboard'] || pageLessons.dashboard}`);
      }
    } else if (feature && (feature.matches('select, input[type="checkbox"], input[type="range"], input[type="text"], input[type="number"], input[type="file"], textarea'))) {
      const id = feature.id || '', label = feature.closest('label')?.textContent || feature.getAttribute('aria-label') || feature.getAttribute('placeholder') || feature.name || id;
      const detail = id === 'an' ? controlLessons[feature.type === 'checkbox' ? 'anNumeric' : 'an'] : controlLessons[id] || `This setting controls ${label || 'an option on this page'}. Read the nearby help text before changing it; settings can affect which analyses run or which transformations are considered safe.`;
      speak(detail);
    } else if (feature) {
      const label = (feature.getAttribute('aria-label') || feature.getAttribute('title') || feature.textContent || 'this 3D feature')
        .replace(/\s+/g, ' ').trim().slice(0, 64);
      speak(`You selected ${label}. ${pageLessons[location.hash.slice(1) || 'dashboard'] || pageLessons.dashboard}`);
    } else if (target.closest('#view') && !target.closest('.editor-box, .ace_editor, pre, code')) {
      const card = target.closest('.card'), heading = card?.querySelector('h2, h3, h4, .p-title')?.textContent?.replace(/\s+/g, ' ').trim();
      const row = target.closest('tr'), picked = (row?.textContent || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 100);
      const page = pageLessons[location.hash.slice(1) || 'dashboard'] || pageLessons.dashboard;
      speak(`${heading ? `This section is ${heading}. ` : 'You clicked in the current work area. '}${picked && picked !== heading ? `The selected detail says ${picked}. ` : ''}${page}`, 'speak', 0, {noCaption: true});
    }
  }, true);

  setTimeout(() => { if (st) st.wave(); }, 1200);
}

// Boot Guide Controller on load
window.addEventListener('DOMContentLoaded', () => {
  // Keep the guide available throughout the app; the tutor's own lesson view
  // reuses the same animated character behaviors for source-aware explanations.
  setTimeout(initLeadGuideWidget, 500);
});

})();
