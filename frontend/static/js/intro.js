/* Welcome cinematic: clean, lightweight greeting in 12 languages */
const Intro = {
  seen: () => true, // By default skip particle storm so the application boots instantly without lag
  mark: () => { try { localStorage.setItem('spo_intro', '1'); } catch (e) {} },
  show({force = false, done} = {}) {
    if (!force) { done && done(); return; }
    const el = document.createElement('div'); el.id = 'intro';
    el.innerHTML = `
      <button class="intro-skip">Skip ✕</button>
      <div class="intro-ui" style="text-align:center;padding:40px 20px">
        <h1 style="font-size:32px;font-weight:800;color:var(--text);margin-bottom:12px">Smart Python Optimizer Studio</h1>
        <p class="muted" style="font-size:16px;max-width:600px;margin:0 auto 24px">Interactive 3D Compiler Construction &amp; Program Optimization Studio</p>
        <div class="intro-langs" id="introLangs" style="margin-bottom:24px">${LANGS.map(l => `<button data-c="${l.code}">${l.name}</button>`).join('')}</div>
        <button class="btn primary big" id="introGo">Enter Studio</button>
      </div>
    `;
    document.body.appendChild(el);
    const close = () => { el.remove(); done && done(); };
    $('#introGo', el).onclick = close;
    $('.intro-skip', el).onclick = close;
  }
};
