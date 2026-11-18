/* 3D core: Stage (renderer/camera/controls/picking), labels, glow, universe background.  Needs vendor/three-bundle.js */
(() => {
'use strict';
const T = window.THREE, OC = window.THREE_OrbitControls;
const S3 = window.SPO3D = window.SPO3D || {};
S3.available = !!T && (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
S3.isDark = () => false;
S3.quality = () => { try { return (window.state && state.settings && state.settings.quality) || 'high'; } catch (e) { return 'high'; } };
S3.on = () => S3.available && S3.quality() !== 'off';
S3.PAL = ['#4285F4', '#A78BFA', '#2DD4BF', '#34D399', '#FB923C', '#F472B6'];
S3.pal = () => ({text: '#25324B', muted: '#64748B', grid: 0xC6D2E4, floor: 0xFFFFFF, node: 0xEEF4FF, line: 0x94A3B8, bg: '#FFFFFF'});
S3.stages = new Set();
S3.disposeAll = () => { [...S3.stages].forEach(s => { if (!s.keep) s.dispose(); }); };
S3.shared = new Set();

/* ---------- textures ---------- */
let glowTex = null;
S3.glowTexture = () => {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); glowTex = new T.CanvasTexture(c); glowTex.colorSpace = T.SRGBColorSpace; S3.shared.add(glowTex); return glowTex;
};
S3.glow = (color, size = 1.6, opacity = .7) => {
  const s = new T.Sprite(new T.SpriteMaterial({map: S3.glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending}));
  s.scale.set(size, size, 1); s.userData.glow = true; return s;
};
/* text sprite; `line` = world height of one text line */
S3.label = (text, o = {}) => {
  const {color = '#fff', bg = null, line = .34, weight = 600, mono = false, pad = 12, depthTest = false, border = null, align = 'center'} = o;
  const px = 34, lines = String(text).split('\n'), font = `${weight} ${px}px ${mono ? '"JetBrains Mono",Consolas,monospace' : '"Plus Jakarta Sans","Segoe UI",system-ui,sans-serif'}`;
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const w = Math.ceil(Math.max(...lines.map(l => m.measureText(l).width))) + pad * 2, lh = Math.round(px * 1.3), h = lh * lines.length + pad * 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; const r = 16; g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath(); g.fill(); if (border) { g.strokeStyle = border; g.lineWidth = 3; g.stroke(); } }
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = align === 'left' ? 'left' : 'center';
  lines.forEach((l, i) => g.fillText(l, align === 'left' ? pad : w / 2, pad + lh * i + lh / 2));
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const sp = new T.Sprite(new T.SpriteMaterial({map: tex, transparent: true, depthWrite: false, depthTest}));
  const k = line / lh; sp.scale.set(w * k, h * k, 1); sp.userData.size = [w * k, h * k]; return sp;
};
const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); S3.ease = ease;
S3.color = c => new T.Color(c);

/* ---------- Stage ---------- */
class Stage {
  constructor(el, o = {}) {
    this.el = el; this.o = o; this.keep = !!o.keep; this.ticks = []; this.disposed = false; this.clock = new T.Clock();
    this.scene = new T.Scene(); this.camera = new T.PerspectiveCamera(o.fov || 50, 1, .1, 600);
    this.camera.position.set(...(o.camera || [0, 4, 12]));
    const low = S3.quality() === 'low';
    this.renderer = new T.WebGLRenderer({antialias: !low, alpha: true, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2)); this.renderer.setClearColor(0x000000, 0);
    const cv = this.renderer.domElement; cv.style.cssText = 'display:block;width:100%;height:100%;outline:none'; el.appendChild(cv);
    if (o.lights !== false) {
      this.scene.add(new T.HemisphereLight(0xffffff, 0x9fb0d8, o.hemi ?? 2.0));
      const d = new T.DirectionalLight(0xffffff, o.sun ?? 2.4); d.position.set(6, 12, 8); this.scene.add(d);
      const d2 = new T.DirectionalLight(0xa78bfa, .8); d2.position.set(-8, -4, -6); this.scene.add(d2);
    }
    if (o.controls !== false) {
      const c = this.controls = new OC(this.camera, cv); c.enableDamping = true; c.dampingFactor = .08; c.autoRotate = !!o.autoRotate; c.autoRotateSpeed = o.autoRotateSpeed || .8;
      c.minDistance = o.minDist || 2; c.maxDistance = o.maxDist || 120; if (o.target) c.target.set(...o.target); c.addEventListener('start', () => { c.autoRotate = false; });
    }
    this.tip = document.createElement('div'); this.tip.className = 's3-tip'; el.appendChild(this.tip);
    this.ray = new T.Raycaster(); this.ndc = new T.Vector2();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el); this.resize();
    S3.stages.add(this); this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  resize() { const w = this.el.clientWidth || 300, h = this.el.clientHeight || 300; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  onTick(fn) { this.ticks.push(fn); return this; }
  loop() {
    if (this.disposed) return;
    if (!this.el.isConnected) { this.dispose(); return; }
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden || !this.el.clientWidth) return;
    const r = this.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const dt = Math.min(this.clock.getDelta(), .05), t = this.clock.elapsedTime;
    for (const f of this.ticks) f(dt, t);
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  pick(ev, objs) {
    const r = this.renderer.domElement.getBoundingClientRect(); this.ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera); return this.ray.intersectObjects(objs, false)[0] || null;
  }
  showTip(html, ev) { const r = this.el.getBoundingClientRect(); this.tip.innerHTML = html; this.tip.style.display = 'block'; const x = Math.min(ev.clientX - r.left + 14, r.width - this.tip.offsetWidth - 6), y = Math.min(ev.clientY - r.top + 14, r.height - this.tip.offsetHeight - 6); this.tip.style.transform = `translate(${Math.max(4, x)}px,${Math.max(4, y)}px)`; }
  hideTip() { this.tip.style.display = 'none'; }
  /* hover(getObjects, (hit|null, ev) => void); click(getObjects, (hit|null, ev) => void) – click ignores drags */
  hover(getObjs, cb) {
    const cv = this.renderer.domElement; let busy = false;
    cv.addEventListener('pointermove', ev => { if (busy || ev.buttons) return; busy = true; requestAnimationFrame(() => { busy = false; if (this.disposed) return; const h = this.pick(ev, getObjs()); cv.style.cursor = h ? 'pointer' : 'grab'; cb(h, ev); }); });
    cv.addEventListener('pointerleave', () => { this.hideTip(); cb(null, null); });
  }
  click(getObjs, cb) {
    const cv = this.renderer.domElement; let d = null;
    cv.addEventListener('pointerdown', ev => { d = [ev.clientX, ev.clientY]; });
    cv.addEventListener('pointerup', ev => { if (d && Math.hypot(ev.clientX - d[0], ev.clientY - d[1]) < 5) cb(this.pick(ev, getObjs()), ev); d = null; });
  }
  /* frame all points (array of Vector3) */
  fit(points, pad = 1.25, dir = [.35, .45, 1]) {
    if (!points.length) return; const b = new T.Box3().setFromPoints(points), c = b.getCenter(new T.Vector3()), sph = b.getBoundingSphere(new T.Sphere());
    const dist = ((sph.radius + 1.6) * pad) / Math.sin(T.MathUtils.degToRad(this.camera.fov / 2)) * (this.camera.aspect < 1 ? 1.4 : 1) * .7;
    const v = new T.Vector3(...dir).normalize().multiplyScalar(Math.max(dist, 4)); this.camera.position.copy(c).add(v);
    if (this.controls) { this.controls.target.copy(c); this.controls.maxDistance = Math.max(120, dist * 3); this.controls.update(); }
    this.home = {pos: this.camera.position.clone(), target: c.clone()};
  }
  setPreset(mode) {
    const c = (this.home && this.home.target) ? this.home.target.clone() : new T.Vector3(0, 0, 0);
    const d = (this.home && this.home.pos) ? this.home.pos.distanceTo(c) : 18;
    if (mode === 'top') { this.camera.position.set(c.x, c.y + d * 1.1, c.z + 0.001); }
    else if (mode === 'front') { this.camera.position.set(c.x, c.y, c.z + d); }
    else if (mode === 'side') { this.camera.position.set(c.x + d, c.y, c.z); }
    else if (mode === 'iso') { this.camera.position.set(c.x + d * 0.7, c.y + d * 0.75, c.z + d * 0.7); }
    else { this.reset(); return; }
    this.camera.lookAt(c);
    if (this.controls) { this.controls.target.copy(c); this.controls.update(); }
  }
  toggleSpin() {
    if (this.controls) { this.controls.autoRotate = !this.controls.autoRotate; return this.controls.autoRotate; }
    return false;
  }
  reset() { if (this.home) { this.camera.position.copy(this.home.pos); if (this.controls) { this.controls.target.copy(this.home.target); this.controls.update(); } } }
  shot(bg) { this.renderer.render(this.scene, this.camera); const cv = this.renderer.domElement, c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.fillStyle = bg || S3.pal().bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, 0); return c.toDataURL('image/jpeg', .88); }
  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.raf); S3.stages.delete(this);
    this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m.map && !S3.shared.has(m.map)) m.map.dispose(); m.dispose(); }); });
    if (this.controls) this.controls.dispose(); this.ro.disconnect(); this.renderer.dispose(); try { this.renderer.forceContextLoss(); } catch (e) {} this.renderer.domElement.remove(); this.tip.remove();
  }
}
S3.Stage = Stage;

S3.addToolbar = (st, el) => {
  if (!el || !st || el.querySelector('.s3-tools')) return;
  const bar = document.createElement('div');
  bar.className = 's3-tools';
  bar.innerHTML = `
    <button class="btn sm" data-a="reset" title="Reset View">⟲ Reset</button>
    <button class="btn sm" data-a="iso" title="Isometric 3D">📐 Iso</button>
    <button class="btn sm" data-a="top" title="Top-down View">🧭 Top</button>
    <button class="btn sm" data-a="spin" title="Auto-rotate">🔄 Spin</button>
    <button class="btn sm" data-a="fs" title="Fullscreen 3D">⛶</button>
  `;
  bar.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'reset') st.reset();
    else if (a === 'iso') st.setPreset('iso');
    else if (a === 'top') st.setPreset('top');
    else if (a === 'spin') { const on = st.toggleSpin(); b.style.color = on ? 'var(--indigo)' : ''; }
    else if (a === 'fs') {
      if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    }
  };
  el.appendChild(bar);
};

S3.fallback = (el, msg) => { el.innerHTML = `<div class="s3-fallback">${msg || '3D view is unavailable (WebGL is off or disabled in Settings).'}</div>`; return null; };
S3.mount = (el, o) => {
  if (!S3.on()) return null;
  try {
    const st = new Stage(el, o);
    if (o && o.toolbar !== false && o.controls !== false) S3.addToolbar(st, el);
    return st;
  } catch (e) {
    console.warn('3D init failed', e);
    S3.available = false;
    return null;
  }
};
/* disposable helper to keep tooltips consistent */
S3.tipHtml = (title, rows = []) => `<b>${title}</b>${rows.map(r => `<div>${r}</div>`).join('')}`;

/* ---------- universe background (disabled in clean light mode) ---------- */
S3.universe = () => {
  const host = document.getElementById('bg3d');
  if (host) host.style.display = 'none';
  return null;
};
S3.pulse = () => {};

/* ---------- CSS 3D tilt on stat cards (delegated) ---------- */
S3.initTilt = root => {
  let cur = null;
  root.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('.stat,.tilt'); if (cur && cur !== el) { cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); } cur = el; if (!el) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--ry', (x * 14).toFixed(1) + 'deg'); el.style.setProperty('--rx', (-y * 14).toFixed(1) + 'deg'); });
  root.addEventListener('pointerleave', () => { if (cur) { cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); cur = null; } });
};
})();
