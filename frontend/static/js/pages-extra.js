/* New pages: Voice Tutor (3D avatar, multi-language lesson, Q&A, voice commands, quiz) and Final Report */

/* ===== Voice Tutor ===== */
P.tutor = async view => {
  const f = file();
  if (f.code && (!f.analysis || f.analysisCode !== f.code) && !(await doAnalyze(true))) {
    view.innerHTML = `<div class="card"><h3>Could not analyze ${esc(f.name)}</h3><p>Fix the reported source issue, then return to the tutor to build a lesson from the current code.</p><a class="btn" href="#editor">Open editor</a></div>`;
    return;
  }
  const lessonFile = {...f, opt: f.optCode === f.code ? f.opt : null};
  if (!lessonFile.opt && !lessonFile.analysis) return needs(view, 'opt');
  const staleOptimization = !!f.opt && !lessonFile.opt;
  const lg = lang(), L = langOf(lg), T = TUTOR[lg] || TUTOR.en, steps = Tutor.build(lessonFile, lg); let cur = 0, playing = false, run = 0, tab = P._ttab || 'lesson', quiz = null, qi = 0, score = 0;
  const rtl = L.rtl ? 'rtl' : '';
  const speakTutor = text => window.ProjectGuide ? ProjectGuide.explain(text, 'speak', {noCaption: true}) : Voice.speak(text, lg);
  view.innerHTML = `${staleOptimization ? '<div class="card" style="margin-bottom:14px;border-left:5px solid var(--orange)">The code changed after its last optimization. This lesson uses fresh analysis and will not present the old transformations as results for the current source; optimize again for an up-to-date comparison.</div>' : ''}
    <div class="tutor-grid"><div class="tutor-side"><div class="card">${S3.on() ? (S3.teacher ? '<div class="s3-fallback">Your animated compiler guide is active in the corner. It follows the selected CFG block and speaks each lesson with captions.</div>' : slot('av')) : '<div class="s3-fallback">Your compiler guide is ready for lessons.</div>'}
      <div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm" id="bPrev">⏮ ${esc(T.ui.prev)}</button><button class="btn primary" id="bPlay">▶ ${esc(T.ui.play)}</button><button class="btn sm" id="bNext">${esc(T.ui.next)} ⏭</button></div>
      <div class="caption ${rtl}" id="cap" aria-live="polite"></div></div>
    <div class="card" style="margin-top:14px"><h3>🌐 Language</h3><div class="lang-grid" id="lgs">${LANGS.map(l => `<button data-c="${l.code}" class="${l.code === lg ? 'on' : ''}">${l.name}</button>`).join('')}</div>
      <p class="muted" id="vinfo" style="margin-top:10px"></p></div></div>
    <div><div class="card"><div class="tabs"><button data-t="lesson" class="${tab === 'lesson' ? 'on' : ''}">🎓 ${esc(T.ui.lesson)}</button><button data-t="ask" class="${tab === 'ask' ? 'on' : ''}">💬 ${esc(T.ui.ask)}</button><button data-t="quiz" class="${tab === 'quiz' ? 'on' : ''}">🧪 ${esc(T.ui.quiz)}</button></div><div id="tbody" class="${rtl}"></div></div>
    ${S3.on() && f.analysis && Object.keys(f.analysis.cfg || {}).length ? `<div class="card" style="margin-top:14px"><div class="row"><h3 style="margin:0">Live control-flow graph</h3><span class="sp"></span><label class="muted">Scope <select id="tutorCfgScope"></select></label></div><p class="muted" id="tutorCfgFocus" aria-live="polite">Choose a block to have the tutor inspect it.</p>${slot('tutorCfg', 'short')}</div>` : ''}
    ${S3.on() && lessonFile.opt ? `<div class="card" style="margin-top:14px"><h3>3D Code City – the tutor points at the line he is explaining</h3>${slot('tcity', 'short')}</div>` : ''}</div></div>`;
  // Use the animated tutor character here, while keeping it off the rest of the app.
  const av = S3.teacher || (S3.on() && S3.leadController && $('#av') ? S3.leadController($('#av')) : null); Voice.avatar = [av].filter(Boolean);
  let city = null, cfgGraph = null, cfgNodes = [], cfgScope = Object.keys((f.analysis || {}).cfg || {})[0];
  const cfgInfo = (node, scope) => {
    if (!node) return;
    const idx = Math.max(0, cfgNodes.findIndex(n => n.id === node.id));
    $('#tutorCfgFocus').textContent = `${scope} · ${node.label || node.id}${node.tipTitle ? ' · ' + node.tipTitle : ''}${(node.tip || []).length ? ' — ' + node.tip.join(' ') : ''}`;
    if (av) av.pointAt(cfgNodes.length < 2 ? 0 : (idx / (cfgNodes.length - 1) - 0.5) * 1.35);
    if (window.ProjectGuide) ProjectGuide.block(node, scope, idx, cfgNodes.length);
    const sourceText = [node.label, ...(node.tip || [])].join(' '), line = sourceText.match(/\b(?:line|L)\s*(\d+)\b/i);
    if (city && line) city.focus('left', Number(line[1]));
  };
  const drawCfg = scope => {
    const data = f.analysis.cfg[scope]; if (!data || !data.graph) return;
    if (cfgGraph && cfgGraph.dispose) cfgGraph.dispose();
    cfgNodes = data.graph.nodes.map(x => ({id: x.data.id, label: x.data.label.split('\n')[0], tipTitle: x.data.label, tip: x.data.instrs.slice(0, 8), idom: x.data.idom, reachable: x.data.reachable, dim: !x.data.reachable, color: x.data.reachable ? '#4285F4' : '#94A3B8', glow: x.data.id === (data.graph.nodes[0] || {}).data?.id}));
    const edges = data.graph.edges.map(e => ({from: e.data.source, to: e.data.target, label: e.data.label, kind: ['back', 'true', 'false', 'exc'].find(k => (e.classes || '').split(' ').includes(k)) || 'seq'}));
    cfgGraph = S3.graph($('#tutorCfg'), {nodes: cfgNodes, edges, layout: 'tower', onSelect: node => cfgInfo(node, scope)});
  };
  if (S3.on() && cfgScope) {
    const selector = $('#tutorCfgScope'); selector.innerHTML = Object.keys(f.analysis.cfg).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
    selector.value = cfgScope; drawCfg(cfgScope); selector.onchange = e => { cfgScope = e.target.value; drawCfg(cfgScope); };
  }
  if (S3.on() && lessonFile.opt) { const o = lessonFile.opt, lm = {}; o.changes.forEach(c => { lm[c.lineno] = c.after.startsWith('(removed') || c.after.startsWith('(branch') ? 'removed' : 'changed'; }); const rm = {}; o.diff.forEach(d => { for (let i = d.b[0]; i <= d.b[1]; i++) rm[i] = d.tag === 'insert' ? 'added' : 'changed'; });
    city = viz('tcity', el => S3.city(el, {left: {lines: f.code.split('\n'), marks: lm}, right: {lines: o.optimized.split('\n'), marks: rm}, onPick: (side, line) => { const source = (side === 'left' ? f.code : o.optimized).split('\n')[line - 1] || ''; if (window.ProjectGuide) ProjectGuide.line(side, line, source, (side === 'left' ? f.code : o.optimized).split('\n').length); }})); }
  const vi = () => { const pk = Voice.pick(lg); $('#vinfo').textContent = !Voice.supported ? 'Speech synthesis is unavailable in this browser.' : pk.voice ? `🔊 ${pk.voice.name} (${pk.voice.lang})${pk.fallback ? ' – stand-in voice (no native voice installed)' : ''}` : '🔇 No voice is installed for this language.'; }; vi(); setTimeout(vi, 700);
  $('#lgs').onclick = e => { const b = e.target.closest('button'); if (!b) return; state.settings.lang = b.dataset.c; $('#langSel').value = b.dataset.c; store.save(); render(); };
  const stepBar = () => `<div class="stepbar">${steps.map((s, i) => `<button data-i="${i}" class="${i === cur ? 'on' : i < cur ? 'done' : ''}">${i + 1}. ${esc(Tutor.short(s.title, 22))}</button>`).join('')}</div>`;
  const showStep = () => { const s = steps[cur]; $('#cap').textContent = s.say; $('#cap').hidden = false; if (city && s.focus) { city.focus('left', s.focus.line); if (window.ProjectGuide) ProjectGuide.line('left', s.focus.line, (f.code.split('\n')[s.focus.line - 1] || ''), f.code.split('\n').length, {focusOnly: true}); }
    const guide = av;
    if (guide) {
      if (s.tag === 'lexer') guide.summonTokens();
      else if (['ast', 'ssa'].includes(s.tag)) guide.summonTree();
      else if (s.tag === 'cfg' && cfgGraph && cfgNodes.length) cfgGraph.select(cfgNodes[0].id);
      else if (s.tag === 'intro') guide.wave();
      else guide.speakAnim(3.5);
    }
    if (tab !== 'lesson') return; const c = s.code;
    $('#tbody').innerHTML = `<h3>${esc(T.ui.step)} ${cur + 1} / ${steps.length} · ${esc(s.title)}</h3>${stepBar()}${c ? `<div class="codecard"><div><em>BEFORE${c.line ? ' · line ' + c.line : ''}</em><pre>${esc(c.before)}</pre></div><div><em>AFTER</em><pre>${esc(c.after)}</pre></div></div>${c.alt ? `<pre>${esc(c.alt)}</pre>` : ''}${(c.more || []).length ? `<p class="muted">More: ${c.more.map(m => `<code>${esc(Tutor.short(m.before, 36))}</code> → <code>${esc(Tutor.short(m.after, 36))}</code> (L${m.line})`).join(' · ')}</p>` : ''}${c.why ? `<p class="muted" style="direction:ltr;text-align:left">${esc(c.why)}</p>` : ''}` : ''}`;
    $$('.stepbar button').forEach(b => b.onclick = () => { stop(); cur = +b.dataset.i; showStep(); speakTutor(steps[cur].say); }); };
  const stop = () => { playing = false; run++; Voice.stop(); if (window.ProjectGuide) ProjectGuide.stopVoice(); $('#bPlay').textContent = '▶ ' + T.ui.play; };
  const play = async () => { if (playing) { stop(); return; } playing = true; const my = ++run; $('#bPlay').textContent = '⏸ ' + T.ui.pause; Voice.enabled = state.settings.voice !== false; if (av) av.wave();
    if (cur >= steps.length - 1 && !Voice.current) cur = Math.min(cur, steps.length - 1);
    while (playing && my === run && cur < steps.length) { showStep(); await speakTutor(steps[cur].say); if (my !== run) return; if (cur >= steps.length - 1) break; cur++; }
    if (my === run) { playing = false; $('#bPlay').textContent = '▶ ' + T.ui.play; } };
  $('#bPlay').onclick = play; $('#bNext').onclick = () => { stop(); cur = Math.min(steps.length - 1, cur + 1); showStep(); speakTutor(steps[cur].say); }; $('#bPrev').onclick = () => { stop(); cur = Math.max(0, cur - 1); showStep(); speakTutor(steps[cur].say); };
  /* ask / voice commands */
  const chat = []; const say = (who, text) => { chat.push([who, text]); if (tab === 'ask') drawAsk(); };
  const handle = async text => { text = text.trim(); if (!text) return; say('you', text); const cmd = Tutor.command(text);
    if (cmd === 'optimize') { say('pyro', '⚡ …'); if (await doOptimize()) { render(); } return; } if (cmd === 'analyze') { if (await doAnalyze()) render(); return; }
    if (cmd === 'next') return $('#bNext').click(); if (cmd === 'back') return $('#bPrev').click(); if (cmd === 'stop') return stop(); if (cmd === 'play') { setTab('lesson'); return play(); } if (cmd === 'quiz') return setTab('quiz');
    const ans = Tutor.answer(text, lg, lessonFile); say('pyro', ans); $('#cap').textContent = ans; speakTutor(ans); };
  const drawAsk = () => { $('#tbody').innerHTML = `<div class="row"><input type="text" id="q" style="flex:1;min-width:200px" placeholder="${esc(T.ui.askPh)}" ${rtl ? 'dir="rtl"' : ''}><button class="btn primary" id="qGo">${esc(T.ui.ask)}</button><button class="btn mic" id="qMic">🎤 ${esc(T.ui.mic)}</button></div>
      <p class="muted">Voice commands (any language): analyze · optimize · next · back · stop · play · quiz. Anything else is answered as a question about compilers.${Voice.recognition() ? '' : ' (Speech recognition needs Chrome or Edge.)'}</p>
      <div id="chat">${chat.filter(([w]) => w === 'you').map(([, t]) => `<div style="margin:8px 0;padding:10px 14px;border-radius:12px;background:rgba(66,133,244,.16)" class="${rtl}"><b>🧑</b> ${esc(t)}</div>`).join('') || `<p class="muted">${GLOSS.slice(0, 6).map(g => `<span class="badge" style="cursor:pointer;margin:2px" data-s="${esc(g.k[0])}">${esc(g.k[0].trim())}</span>`).join('')}</p>`}</div>`;
    const q = $('#q'); const go = () => { const v = q.value; q.value = ''; handle(v); }; $('#qGo').onclick = go; q.onkeydown = e => { if (e.key === 'Enter') go(); };
    $$('[data-s]').forEach(b => b.onclick = () => handle(b.dataset.s));
    $('#qMic').onclick = async () => { const b = $('#qMic'); b.classList.add('live'); b.textContent = '🎤 ' + T.ui.listening; try { handle(await Voice.listen(lg)); } catch (e) { toast(e.message, 'warn'); } finally { b.classList.remove('live'); b.textContent = '🎤 ' + T.ui.mic; } }; };
  /* quiz */
  const drawQuiz = () => { if (!quiz) quiz = Tutor.quiz(lessonFile, lg); if (!quiz || !quiz.length) { $('#tbody').innerHTML = `<p class="muted">${esc(T.quiz.needData)}</p>`; return; }
    if (qi >= quiz.length) { $('#tbody').innerHTML = `<h3>${esc(T.quiz.done)}</h3><p style="font-size:26px;font-weight:800">${esc(fill(T.quiz.score, {s: score, n: quiz.length}))}</p><button class="btn primary" id="again">${esc(T.ui.newQuiz)}</button>`; $('#again').onclick = () => { quiz = null; qi = 0; score = 0; drawQuiz(); }; if (av) av.wave(); return; }
    const q = quiz[qi]; $('#tbody').innerHTML = `<p class="muted">${qi + 1} / ${quiz.length}</p><h3 style="font-size:17px">${esc(q.q)} <button class="btn sm" id="qs">🔊</button></h3>${q.options.map((o, i) => `<button class="quiz-opt" data-i="${i}">${esc(o.text)}</button>`).join('')}<div id="fb"></div>`;
    $('#qs').onclick = () => speakTutor(q.q); let done = false;
    $$('.quiz-opt').forEach(b => b.onclick = () => { if (done) return; done = true; const o = q.options[+b.dataset.i], good = q.options.find(x => x.ok); b.classList.add(o.ok ? 'ok' : 'bad'); $$('.quiz-opt').forEach(x => { if (q.options[+x.dataset.i].ok) x.classList.add('ok'); }); if (o.ok) score++;
      const msg = o.ok ? T.quiz.ok : fill(T.quiz.bad, {ans: good.text}); $('#fb').innerHTML = `<span class="quiz-feedback-icon" aria-hidden="true">${o.ok ? '✓' : '↺'}</span><button class="btn primary" id="nx">${esc(T.ui.next)} ⏭</button>`; $('#cap').textContent = msg; speakTutor(msg); $('#nx').onclick = () => { qi++; drawQuiz(); if (quiz && qi < quiz.length) speakTutor(quiz[qi].q); }; }); };
  const setTab = t => { tab = P._ttab = t; $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); if (t === 'lesson') showStep(); else if (t === 'ask') drawAsk(); else drawQuiz(); };
  $$('.tabs button').forEach(b => b.onclick = () => { setTab(b.dataset.t); speakTutor(b.dataset.t === 'lesson' ? steps[cur].say : b.dataset.t === 'ask' ? 'Ask me a question about compiler construction or the active source code.' : 'The quiz tests the optimization and complexity results for this program.'); }); setTab(tab); $('#cap').textContent = steps[0].say;
};

/* ===== Final report ===== */
P.final = async view => {
  const f = file(); if (!f.opt) return needs(view, 'opt');
  const o = f.opt, lg = lang(); let meta = {student: 'Asadullah', course: 'Compiler Construction'}; try { meta = Object.assign(meta, JSON.parse(localStorage.getItem('spo_meta') || '{}')); } catch (e) {} if (!meta.student) meta.student = 'Asadullah';
  const fields = [['student', 'Student name'], ['roll', 'Roll number'], ['course', 'Course'], ['instructor', 'Instructor'], ['university', 'University']];
  view.innerHTML = `<div class="card"><h3>📑 Final report – ${esc(f.name)}</h3><p class="muted">One printable document in <b>${esc(langOf(lg).name)}</b> (change the language in the top bar): cover page, compiler phases, every optimization, algorithm analysis, complexity charts, benchmark, validation, 3D screenshots, code diff and the tutor's lesson notes.</p>
    <div class="grid g3">${fields.map(([k, l]) => `<label>${l}<br><input type="text" data-m="${k}" value="${esc(meta[k] || '')}" style="width:100%"></label>`).join('')}</div>
    <div class="row" style="margin-top:14px"><label><input type="checkbox" id="inShots" checked> include 3D screenshots</label><label><input type="checkbox" id="inLesson" checked> include tutor lesson notes</label><span class="sp"></span><button class="btn primary" id="gen" disabled>Preparing 3D previews…</button></div></div>
    ${S3.on() ? `<div class="card" style="margin-top:16px"><h3>3D snapshots captured for the report</h3><div class="grid g3"><div><b>Control-flow graph</b>${slot('sCfg', 'mini')}</div><div><b>Operation growth</b>${slot('sGrow', 'mini')}</div><div><b>Code City</b>${slot('sCity', 'mini')}</div>${f.analysis ? `<div><b>Call graph</b>${slot('sCg', 'mini')}</div>` : ''}${Object.keys(o.summary.by_pass).length ? `<div><b>Optimizations</b>${slot('sPass', 'mini')}</div>` : ''}${f.bench ? `<div><b>Benchmark</b>${slot('sBench', 'mini')}</div>` : ''}</div></div>` : ''}
    <div class="card" style="margin-top:16px" id="out" hidden><div class="row"><h3 style="margin:0">Preview</h3><span class="sp"></span><button class="btn green" id="dl">⬇ Download HTML</button><button class="btn teal" id="op">↗ Open in new tab</button><button class="btn orange" id="pr">🖨 Print / Save as PDF</button></div><iframe class="report" id="fr" style="height:720px;margin-top:12px"></iframe></div>`;
  const shots = {}; const snap = {};
  /* build the snapshot scenes in the bright palette so labels are dark on white paper */
  if (S3.on()) { try {
    const a = f.analysis; if (a) { const keys = Object.keys(a.cfg); const best = keys.sort((x, y) => a.cfg[y].blocks - a.cfg[x].blocks)[0], g = a.cfg[best].graph, KC = {entry: '#34D399', exit: '#F472B6', 'loop-header': '#8B5CF6', 'loop-body': '#B9A6FF', branch: '#FB923C', unreachable: '#94A3B8'};
      const nodes = g.nodes.map(x => { const cl = (x.classes || '').split(' '), kind = ['unreachable', 'loop-header', 'entry', 'exit', 'branch', 'loop-body'].find(k => cl.includes(k)); return {id: x.data.id, label: x.data.label.split('\n')[0], color: KC[kind] || '#4285F4', dim: kind === 'unreachable', glow: ['entry', 'exit', 'loop-header'].includes(kind), size: [1.5, .5 + Math.min(x.data.instrs.length, 8) * .17, 1.5]}; });
      snap.cfg = viz('sCfg', el => S3.graph(el, {nodes, edges: g.edges.map(e => ({from: e.data.source, to: e.data.target, label: e.data.label, kind: ['back', 'true', 'false', 'exc'].find(k => (e.classes || '').split(' ').includes(k)) || 'seq'})), layout: 'tower'}));
      if ($('#sCg')) { const cg = a.call_graph; snap.callgraph = viz('sCg', el => S3.graph(el, {layout: 'force', nodes: cg.nodes.slice(0, 80).map(x => ({id: x.id, label: x.id, shape: 'sphere', size: [.6], color: x.recursive ? '#F43F5E' : '#4285F4'})), edges: cg.edges.map(e => ({from: e.from, to: e.to}))})); } }
    else $('#sCfg').parentElement.remove();
    const gr = o.complexity.growth; snap.growth = viz('sGrow', el => S3.curves(el, {xs: gr.sizes, log: true, series: [{name: 'Original ' + o.complexity.original.time, color: PAL[4], values: gr.original}, {name: 'Optimized ' + o.complexity.optimized.time, color: PAL[3], values: gr.optimized}]}));
    const lm = {}; o.changes.forEach(c => { lm[c.lineno] = c.after.startsWith('(removed') || c.after.startsWith('(branch') ? 'removed' : 'changed'; }); const rm = {}; o.diff.forEach(d => { for (let i = d.b[0]; i <= d.b[1]; i++) rm[i] = d.tag === 'insert' ? 'added' : 'changed'; });
    snap.city = viz('sCity', el => S3.city(el, {left: {lines: f.code.split('\n'), marks: lm}, right: {lines: o.optimized.split('\n'), marks: rm}}));
    const ks = Object.keys(o.summary.by_pass); if ($('#sPass')) snap.passes = viz('sPass', el => S3.bars(el, {labels: ks.map(k => PASS_SHORT[k] || k), series: [{name: 'Changes', color: PAL[0], values: ks.map(k => o.summary.by_pass[k])}], unit: 'changes'}));
    if ($('#sBench') && f.bench) { const r = f.bench.rows, labels = r.map(x => String(x.size)); snap.bench = viz('sBench', el => S3.bars(el, {labels, series: [{name: 'Original', color: PAL[4], values: r.map(x => x.original.mean_s * 1000)}, {name: 'Optimized', color: PAL[3], values: r.map(x => x.optimized.mean_s * 1000)}], unit: 'ms'})); }
  } catch (e) {} }
  setTimeout(() => { const g = $('#gen'); if (g) { g.disabled = false; g.textContent = '📑 Generate final report'; } }, S3.on() ? 2600 : 200);
  let html = '';
  $('#gen').onclick = async () => { const btn = $('#gen'); btn.disabled = true; const done = progress('Building the final report…');
    try { $$('[data-m]').forEach(i => { meta[i.dataset.m] = i.value; }); try { localStorage.setItem('spo_meta', JSON.stringify(meta)); } catch (e) {}
      const images = {}; if ($('#inShots').checked) Object.entries(snap).forEach(([k, st]) => { if (st && st.shot) { try { images[k] = st.shot('#FFFFFF'); } catch (e) {} } });
      const T = TUTOR[lg] || TUTOR.en, a = f.analysis; const analysis = a ? {stats: a.stats, tokens: Object.values(a.tokens.counts).reduce((x, y) => x + y, 0), ast_nodes: a.ast.total_nodes, functions: a.call_graph.nodes.length, recursive: a.call_graph.recursive,
        semantic: {undefined: a.semantic.undefined_names.length, unused_imports: a.semantic.unused_imports.length, unused_variables: a.semantic.unused_variables.length}, scopes: Object.entries(a.cfg).map(([k, d]) => ({name: k, blocks: d.blocks, loops: d.loops.length, unreachable: d.unreachable.length, phi: (a.ssa[k] || {}).phi_count || 0}))} : {};
      const lesson = $('#inLesson').checked ? Tutor.build(f, lg).map(s => ({title: s.title, say: s.say})) : [];
      const same = o.complexity.original.time === o.complexity.optimized.time, conclusion = same ? fill(T.cxSame, {a: o.complexity.original.time}) : fill(T.cx, {a: o.complexity.original.time, b: o.complexity.optimized.time});
      const r = await fetch('/api/final_report', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({report_id: o.report_id, lang: lg, meta, images, analysis, validation: f.validation && !f.validation.error ? f.validation : null, lesson, conclusion})});
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Report failed'); html = await r.text(); $('#out').hidden = false; $('#fr').srcdoc = html; $('#out').scrollIntoView({behavior: 'smooth'}); toast('Final report ready', 'ok'); }
    catch (e) { toast(e.message, 'err'); } finally { done(); btn.disabled = false; } };
  $('#dl').onclick = () => download(f.name.replace(/\.py$/, '') + '_final_report.html', html, 'text/html');
  $('#op').onclick = () => window.open(URL.createObjectURL(new Blob([html], {type: 'text/html'})), '_blank');
  $('#pr').onclick = () => { const w = $('#fr').contentWindow; w.focus(); w.print(); };
};
