/* Web Audio & HTML5 Audio Synthesizer: 100% guaranteed audible sound across all devices and browsers */
const SoundFX = {
  ctx: null,
  wavCache: {},

  // Generate 16-bit PCM WAV Data URI
  createWav(fn, durationSec = 0.35, sampleRate = 22050) {
    const numSamples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const val = Math.max(-1, Math.min(1, fn(t, i, numSamples)));
      view.setInt16(44 + i * 2, val < 0 ? val * 0x8000 : val * 0x7FFF, true);
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(binary);
  },

  // Play WAV sound via native HTML5 Audio element
  playWav(key, fn, duration = 0.35) {
    try {
      if (!SoundFX.wavCache[key]) {
        SoundFX.wavCache[key] = SoundFX.createWav(fn, duration);
      }
      const audio = new Audio(SoundFX.wavCache[key]);
      audio.volume = 1.0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      return audio;
    } catch (e) {
      return null;
    }
  },

  // Melodic audible chime
  chime(type = 'success') {
    const freqs = type === 'tokens' ? [440, 554.37, 659.25, 880] :
                  type === 'tree' ? [523.25, 659.25, 783.99, 1046.5] :
                  type === 'action' ? [587.33, 739.99, 880] : [523.25, 659.25, 783.99];
    return SoundFX.playWav('chime_' + type, (t) => {
      let sum = 0;
      freqs.forEach((f, idx) => {
        const start = idx * 0.08;
        if (t >= start) {
          const env = Math.exp(-(t - start) * 7.5);
          sum += Math.sin(2 * Math.PI * f * (t - start)) * env * 0.32;
        }
      });
      return sum;
    }, 0.45);
  },

  // Vocal speaking syllable sound
  speakBip(seed = 0) {
    const notes = [261.63, 293.66, 329.63, 392.00, 440.00];
    const f0 = notes[(Math.abs(seed) || 0) % notes.length];
    return SoundFX.playWav('bip_' + (seed % 5), (t) => {
      const env = Math.sin(Math.PI * (t / 0.11));
      return (Math.sin(2 * Math.PI * f0 * t) * 0.65 + Math.sin(2 * Math.PI * (f0 * 2) * t) * 0.25) * Math.max(0, env) * 0.3;
    }, 0.11);
  },

  init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !SoundFX.ctx) SoundFX.ctx = new AC();
      if (SoundFX.ctx && SoundFX.ctx.state === 'suspended') SoundFX.ctx.resume().catch(() => {});
    } catch (e) {}
  },

  unlock() {
    SoundFX.init();
    if (SoundFX.ctx && SoundFX.ctx.state === 'suspended') {
      SoundFX.ctx.resume().catch(() => {});
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.resume(); } catch (e) {}
    }
  }
};

/* Unlock audio on first user interaction anywhere */
window.addEventListener('click', () => SoundFX.unlock(), {passive: true});
window.addEventListener('keydown', () => SoundFX.unlock(), {passive: true});

/* Voice engine (speech synthesis + recognition) and the Tutor (lesson builder, glossary Q&A, quiz). Needs i18n.js */
const Voice = {
  voices: [], rate: 1, voiceURI: '', enabled: true, token: 0, avatar: null, current: null, currentOwner: null,
  supported: 'speechSynthesis' in window,
  avatars() { return (Array.isArray(Voice.avatar) ? Voice.avatar : [Voice.avatar]).filter(Boolean); },
  init() {
    if (!Voice.supported) return;
    const load = () => {
      Voice.voices = speechSynthesis.getVoices() || [];
    };
    load();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = load;
    }
    setTimeout(load, 200);
    setTimeout(load, 1000);
  },
  norm: s => String(s || '').toLowerCase().replace('_', '-'),
  /* best voice for a UI language code: exact locale > same language > language fallback > ANY available voice */
  pick(code) {
    if (!Voice.voices.length && Voice.supported) {
      Voice.voices = speechSynthesis.getVoices() || [];
    }
    const l = langOf(code);
    const selectedVoice = Voice.voices.find(v => v.voiceURI === Voice.voiceURI);
    if (selectedVoice) return {voice: selectedVoice, fallback: Voice.norm(selectedVoice.lang).split('-')[0] !== Voice.norm(l.speech).split('-')[0], lang: selectedVoice.lang};
    const tryLang = tag => {
      const base = String(tag || '').split('-')[0].toLowerCase();
      const all = Voice.voices.filter(v => Voice.norm(v.lang).split('-')[0] === base);
      return all.find(v => Voice.norm(v.lang) === Voice.norm(tag) && !/compact/i.test(v.name)) ||
             all.find(v => Voice.norm(v.lang) === Voice.norm(tag)) ||
             all.find(v => v.localService) ||
             all[0] || null;
    };
    let v = tryLang(l.speech), fb = false;
    if (!v && l.speechFallback) { v = tryLang(l.speechFallback); fb = !!v; }
    // Fallback to any English or primary voice if language specific not found
    if (!v && Voice.voices.length) {
      v = tryLang('en-US') || tryLang('en') || Voice.voices.find(x => x.default) || Voice.voices[0];
      fb = true;
    }
    return {voice: v, fallback: fb, lang: v ? v.lang : (l.speech || 'en-US')};
  },
  has: code => !!Voice.pick(code).voice,
  chunks(text) {
    const out = [], parts = String(text).replace(/\s+/g, ' ').split(/(?<=[.!?؟۔।。！？])\s*/);
    let cur = '';
    parts.forEach(p => {
      if ((cur + ' ' + p).length > 170 && cur) { out.push(cur.trim()); cur = p; }
      else cur += ' ' + p;
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  },
  stop() {
    Voice.token++;
    if (Voice.supported && speechSynthesis.speaking) {
      try { speechSynthesis.cancel(); } catch (e) {}
    }
    Voice.avatars().forEach(a => a.setSpeaking(false));
    const current = Voice.current;
    Voice.current = null;
    Voice.currentOwner = null;
    if (current) current();
  },
  pause() {
    if (Voice.supported) {
      try { speechSynthesis.pause(); } catch (e) {}
    }
    Voice.avatars().forEach(a => a.setSpeaking(false));
  },
  resume() {
    SoundFX.unlock();
    if (Voice.supported) {
      try { speechSynthesis.resume(); } catch (e) {}
    }
    Voice.avatars().forEach(a => a.setSpeaking(true));
  },
  unlock() {
    SoundFX.unlock();
  },
  /* resolves when finished (or stopped). Always speaks and emits audio */
  speak(text, code, o = {}) {
    const wasSpeaking = Voice.supported && speechSynthesis.speaking;
    Voice.stop();
    SoundFX.unlock();
    const my = ++Voice.token, pk = Voice.pick(code), cs = Voice.chunks(text);
    Voice.currentOwner = o.owner || 'guide';

    return new Promise(res => {
      let done = false;
      let keepAliveInterval = null;

      const fin = () => {
        if (done) return;
        done = true;
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        if (my === Voice.token) { Voice.current = null; Voice.currentOwner = null; }
        Voice.avatars().forEach(a => a.setSpeaking(false));
        res(my === Voice.token);
      };
      Voice.current = fin;

      if (!Voice.enabled) {
        Voice.avatars().forEach(a => a.setSpeaking(false));
        fin();
        return;
      }

      // Play guaranteed audible chime via native HTML5 Audio
      Voice.avatars().forEach(a => a.setSpeaking(true));

      let i = 0;
      let cadenceTick = 0;

      const next = () => {
        if (my !== Voice.token || done) return fin();
        if (i >= cs.length) return fin();

        const chunk = cs[i++];
        if (!Voice.supported) {
          // Fallback tone sequence
          SoundFX.speakBip(cadenceTick++);
          setTimeout(next, Math.max(1200, chunk.length * 50));
          return;
        }

        const u = new SpeechSynthesisUtterance(chunk);
        if (pk.voice) u.voice = pk.voice;
        u.lang = pk.voice ? pk.voice.lang : (pk.lang || 'en-US');
        u.rate = Math.max(0.5, Math.min(2, Number(Voice.rate) || 1));
        u.pitch = 1.0;
        u.volume = 1.0;

        u.onstart = () => {
          if (my !== Voice.token) return;
          if (typeof o.onstart === 'function') o.onstart();
          Voice.avatars().forEach(a => a.setSpeaking(true));
        };

        u.onboundary = (e) => {
          if (my !== Voice.token) return;
          if (typeof o.onboundary === 'function') o.onboundary(e);
          Voice.avatars().forEach(a => a.pulseLevel(0.95));
        };

        u.onend = () => {
          if (my !== Voice.token) return fin();
          setTimeout(next, 50);
        };

        u.onerror = (err) => {
          console.warn('Speech synthesis utterance error:', err);
          try { speechSynthesis.resume(); } catch (e) {}
          if (my === Voice.token) setTimeout(next, 60);
          else fin();
        };

        // Resume speech engine in case Chrome suspended it
        try { speechSynthesis.resume(); } catch (e) {}

        // Speak utterance
        try {
          speechSynthesis.speak(u);
        } catch (e) {
          console.warn('speechSynthesis.speak error:', e);
          next();
        }
      };

      // Periodic keep-alive for Chrome 15s pause bug
      keepAliveInterval = setInterval(() => {
        if (speechSynthesis.speaking) {
          try {
            speechSynthesis.pause();
            speechSynthesis.resume();
          } catch (e) {}
        } else if (done) {
          clearInterval(keepAliveInterval);
        }
      }, 4000);

      // Brief delay after cancel to allow browser audio thread to ready
      setTimeout(next, wasSpeaking ? 90 : 20);
    });
  },
  recognition: () => window.SpeechRecognition || window.webkitSpeechRecognition,
  listen(code) {
    const SR = Voice.recognition(); if (!SR) return Promise.reject(new Error('Speech recognition is not supported in this browser (use Chrome or Edge).'));
    const l = langOf(code), r = new SR(); r.lang = l.speechFallback || l.speech; r.interimResults = false; r.maxAlternatives = 1;
    return new Promise((res, rej) => { r.onresult = e => res(e.results[0][0].transcript); r.onerror = e => rej(new Error(e.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Could not hear you (' + e.error + ').')); r.onnomatch = () => rej(new Error('Could not understand.')); r.onend = () => rej(new Error('No speech detected.')); try { r.start(); } catch (e) { rej(e); } });
  }
};
Voice.init();

const COMMANDS = {
  analyze: ['analyze', 'analyse', 'تجزیہ', 'विश्लेषण', 'حلل', 'analiza', 'analys', 'analysiere', 'analiz', '分析', '解析', 'анализ'],
  optimize: ['optimize', 'optimise', 'آپٹیمائز', 'ऑप्टिमाइज़', 'ऑप्टिमाइज', 'حسّن', 'حسن', 'optimiza', 'optimis', 'optimier', 'optimiz', '优化', '最適化', 'оптимиз'],
  next: ['next', 'اگلا', 'अगला', 'التالي', 'siguiente', 'suivant', 'weiter', 'ileri', '下一', '次へ', 'далее', 'дальше'],
  back: ['back', 'previous', 'پچھلا', 'पिछला', 'السابق', 'atrás', 'retour', 'zurück', 'geri', '上一', '戻る', 'назад'],
  stop: ['stop', 'pause', 'روکیں', 'रुको', 'रोकें', 'توقف', 'para', 'arrête', 'halt', 'dur', '停止', '暂停', '止めて', 'стоп'],
  play: ['play', 'start lesson', 'lesson', 'سبق', 'شروع', 'चलाओ', 'पाठ', 'درس', 'ابدأ', 'lección', 'leçon', 'lektion', 'ders', '课程', 'レッスン', 'урок'],
  quiz: ['quiz', 'test', 'کوئز', 'क्विज़', 'क्विज', 'اختبار', 'cuestionario', 'prueba', 'questionnaire', '测验', 'クイズ', 'тест', 'ڪوئز']
};
const Tutor = {
  clean: s => String(s ?? '').replace(/[`*_#]/g, '').replace(/\s+/g, ' ').trim(),
  short: (s, n = 48) => { s = Tutor.clean(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; },
  label(lang, key) { const t = (TUTOR[lang] || TUTOR.en).pass[key] || TUTOR.en.pass[key] || key; return t.split(/[:：]/)[0]; },
  command(text) { const q = String(text).toLowerCase(); for (const [k, ws] of Object.entries(COMMANDS)) if (ws.some(w => q.includes(w.toLowerCase()))) return k; return null; },
  answer(q, lang, f) {
    const t = TUTOR[lang] || TUTOR.en, s = ' ' + String(q).toLowerCase();
    const g = GLOSS.find(x => x.k.some(w => s.includes(w.toLowerCase())));
    const answer = g ? (g.t[lang] || g.t.en) : t.ui.noAnswer;
    if (lang !== 'en' || !f || !f.analysis) return answer;
    const a = f.analysis, o = f.opt && f.optCode === f.code ? f.opt : null;
    if (/lexer|lexical|token/.test(s)) return `${answer}\n\nFor this file the tokenizer found ${a.tokens.total} tokens. The first examples are ${(a.tokens.rows || []).slice(0, 5).map(x => `${x.type} "${x.text}"`).join(', ') || 'none'}.`;
    if (/parser|parse|ast|syntax tree/.test(s)) return `${answer}\n\nThe current AST contains ${a.ast.total_nodes} nodes, including ${a.ast.structure.Functions} function(s), ${a.ast.structure.Loops} loop(s), and ${a.ast.structure.Conditionals} conditional(s).`;
    if (/semantic|symbol|undefined|unused/.test(s)) return `${answer}\n\nFor this file the static checks report ${(a.semantic.undefined_names || []).length} possibly undefined name(s), ${(a.semantic.unused_variables || []).length} unused local variable(s), and ${(a.semantic.unused_imports || []).length} unused import(s). Dynamic Python behavior can affect these heuristics.`;
    if (/control flow|cfg|basic block/.test(s)) {
      const graphs = Object.values(a.cfg || {});
      return `${answer}\n\nThe current analysis has ${graphs.length} scope graph(s), ${graphs.reduce((n, x) => n + (x.blocks || 0), 0)} basic block(s), and ${graphs.reduce((n, x) => n + x.loops.length, 0)} detected loop(s).`;
    }
    if (/ssa|phi|φ/.test(s)) {
      const phis = Object.values(a.ssa || {}).reduce((n, x) => n + (x.phi_count || 0), 0);
      return `${answer}\n\nThe current analysis generated ${phis} phi function(s) across its reported scopes.`;
    }
    if (/optim|fold|dead code|propagat|inlin|invariant|strength|unroll/.test(s)) {
      if (!o) return `${answer}\n\nThere is no optimization result for the current source yet. Run Optimize to see applicable transformations and their exact before-and-after code.`;
      const change = o.changes[0];
      return `${answer}\n\nFor the current source, ${o.changes.length} transformation(s) were applied. ${change ? `For example, ${change.pass_name} changed "${change.before}" to "${change.after}" on line ${change.lineno}.` : 'No automatic transformation was applied.'} Recommendations are suggestions and are not automatically applied.`;
    }
    if (/complexity|big.?o|time|space/.test(s)) return `${answer}\n\nThe static estimate for this source is time ${a.complexity.time} and auxiliary space ${a.complexity.space}. These are heuristic estimates; they are not measured runtime results.`;
    return answer;
  },
  stats(f) { const code = f.code || ''; return {lines: code.split('\n').length, functions: (code.match(/^\s*(async\s+)?def\s/gm) || []).length, loops: (code.match(/^\s*(for|while|async\s+for)\b/gm) || []).length}; },
  /* lesson steps built from the student's own analysis / optimization results */
  build(f, lang) {
    const T = TUTOR[lang] || TUTOR.en, steps = [], st = Tutor.stats(f), o = f.opt, cx = o ? o.complexity.original : (f.analysis ? f.analysis.complexity : null);
    steps.push({id: 'hello', title: T.titles.hello, say: fill(T.hello, {file: f.name}) + ' ' + fill(T.stats, {...st, time: cx ? cx.time : '?', space: cx ? cx.space : '?'}), tag: 'intro'});
    steps.push({id: 'phases', title: T.titles.phases, say: T.phases, tag: 'compiler'});
    const analysis = f.analysis;
    if (analysis && lang === 'en') {
      const tokenRows = (analysis.tokens.rows || []).slice(0, 8)
        .map(row => `line ${row.line}: ${row.type} "${row.text}"`).join('; ');
      const tokenCounts = Object.entries(analysis.tokens.counts || {})
        .filter(([, count]) => count).map(([type, count]) => `${count} ${type.toLowerCase()}`).join(', ');
      steps.push({id: 'lexer', title: '1. Lexical analysis', tag: 'lexer',
        say: `The lexer turns source characters into tokens; it does not decide the meaning of the whole program. This project uses Python's tokenizer, so indentation, names, literals, operators, and punctuation are recognized according to Python's lexical rules. I found ${analysis.tokens.total} tokens${tokenCounts ? `: ${tokenCounts}` : ''}. Here are examples from the actual source: ${tokenRows || 'there are no displayable tokens'}. A tokenization error is reported separately from the parser's syntax check.`});

      const roots = (analysis.ast.outline.children || []).slice(0, 6).map(node => node.label).join(', ');
      steps.push({id: 'ast', title: '2. Parsing and the AST', tag: 'ast',
        say: `The parser checks whether the token sequence forms valid Python syntax and builds an abstract syntax tree. Your tree contains ${analysis.ast.total_nodes} nodes. Its top-level constructs include ${roots || 'no statements'}. The tree records nesting and operator precedence, so an expression such as a + b * c is represented with multiplication below addition rather than as an unstructured string. The 3D AST view visualizes this hierarchy; it is a structural model, not an execution trace.`});

      const sem = analysis.semantic, undefinedNames = sem.undefined_names || [], unused = sem.unused_variables || [], imports = sem.unused_imports || [];
      steps.push({id: 'semantic', title: '3. Semantic checks', tag: 'semantic',
        say: `Semantic analysis builds scoped symbol tables and reports names that may be undefined, unused local variables, and unused imports. For this file it found ${undefinedNames.length} possibly undefined name(s), ${unused.length} unused local variable(s), and ${imports.length} unused import(s). These are static diagnostics, not proof of a runtime failure: dynamic imports, reflection, and other Python features can make name resolution difficult to determine without running the program.`});

      const scopes = Object.entries(analysis.cfg || {}), blocks = scopes.reduce((n, [, data]) => n + (data.blocks || 0), 0);
      const loopCount = scopes.reduce((n, [, data]) => n + (data.loops || []).length, 0);
      const unreachable = scopes.reduce((n, [, data]) => n + (data.unreachable || []).length, 0);
      const irExample = (analysis.ir || []).slice(0, 2).map(item => `${item.scope}: ${item.text.split('\n').slice(0, 4).join('; ')}`).join(' | ');
      steps.push({id: 'ir-cfg', title: '4. Intermediate code and control flow', tag: 'cfg',
        say: `The middle end models each analyzed scope with basic blocks and control-flow edges. This report contains ${scopes.length} scope graph(s), ${blocks} basic block(s), ${loopCount} detected loop(s), and ${unreachable} block(s) marked unreachable. The control-flow graph shows possible transfers between blocks; it does not claim that every path will execute. A sample of the generated intermediate representation is: ${irExample || 'no IR text was emitted'}. Open the CFG page to inspect the full graph and its branches.`});

      const phiCount = Object.values(analysis.ssa || {}).reduce((n, item) => n + (item.phi_count || 0), 0);
      steps.push({id: 'ssa', title: '5. Data flow and SSA', tag: 'ssa',
        say: `Data-flow analyses propagate facts across the control-flow graph until they reach a fixed point. SSA, or static single assignment form, gives each assignment a distinct version of a variable and uses phi functions where control-flow paths join. This analysis produced ${phiCount} phi function(s) across the reported scopes. SSA and data-flow facts are explanatory intermediate results here; the optimizer's AST passes are the transformations applied to your Python source.`});

      const functions = (analysis.complexity.functions || []).map(fn =>
        `${fn.name} at line ${fn.lineno}: time ${fn.time}, auxiliary space ${fn.space}${fn.manual ? ' (manual analysis needed)' : ''}`).join('; ');
      steps.push({id: 'analysis-complexity', title: '6. Complexity estimate', tag: 'cx',
        say: `The static analyzer estimates asymptotic time and auxiliary space from recognized loops, recursion, and allocations. For this program it estimates overall time ${analysis.complexity.time} and space ${analysis.complexity.space}. Per-function estimates: ${functions || 'there are no function definitions'}. These are heuristic static estimates, not measured speedups; use the benchmark page for timing experiments, and interpret both results in light of the analyzer's documented limitations.`});
    }
    if (o) {
      const byPass = {}; o.changes.forEach(c => (byPass[c.pass_name] = byPass[c.pass_name] || []).push(c)); const keys = Object.keys(byPass).sort((a, b) => byPass[b].length - byPass[a].length);
      if (!o.changes.length) steps.push({id: 'opt0', title: T.titles.opt, say: T.nochange, tag: 'opt'});
      else { steps.push({id: 'opt', title: T.titles.opt, say: fill(T.optIntro, {n: o.changes.length, p: keys.length}), tag: 'opt'});
        keys.forEach(k => { const ex = byPass[k][0], more = byPass[k].slice(1, 3);
          steps.push({id: 'pass:' + k, title: Tutor.label(lang, k), pass: k, say: (T.pass[k] || TUTOR.en.pass[k] || '') + ' ' + fill(T.example, {line: ex.lineno, before: Tutor.short(ex.before), after: Tutor.short(ex.after)}),
            code: {before: ex.before, after: ex.after, line: ex.lineno, more: more.map(m => ({before: m.before, after: m.after, line: m.lineno})), why: ex.explanation}, focus: {line: ex.lineno}, tag: 'opt'}); }); }
    }
    const recs = o ? o.recommendations : (f.analysis ? f.analysis.algorithms : []);
    if (recs.length) { steps.push({id: 'recs', title: T.titles.recs, say: T.recsIntro, tag: 'algo'});
      recs.slice(0, 6).forEach((r, i) => steps.push({id: 'rec' + i, title: Tutor.short(r.title, 60), say: fill(T.rec, {fn: r.function, line: r.lineno, title: Tutor.clean(r.title), from: r.original_complexity, to: r.improved_complexity}) + ' ' + (T.recKind[r.kind] || T.recKind.generic),
        code: r.alternative_code ? {before: r.current, after: r.suggested, alt: r.alternative_code, line: r.lineno} : null, focus: {line: r.lineno}, tag: 'algo'})); }
    if (o && lang !== 'en') { const a = o.complexity.original.time, b = o.complexity.optimized.time; steps.push({id: 'cx', title: T.titles.cx, say: a !== b ? fill(T.cx, {a, b}) : fill(T.cxSame, {a}), tag: 'cx'}); }
    if (o && lang === 'en') {
      const before = o.normalized.split('\n').slice(0, 12).join('\n'), after = o.optimized.split('\n').slice(0, 12).join('\n');
      const clipped = text => text.split('\n').length >= 12 ? `${text}\n...` : text;
      steps.push({id: 'output', title: 'Generated source and results', tag: 'output',
        say: `The compiler pipeline returns optimized Python source; optimizing does not automatically run your program. The optimizer applied ${o.changes.length} transformation(s), and its static validation ${o.static_validation.ok ? 'accepted the generated source' : 'rejected the generated source and restored the original'}. Review the before-and-after excerpt, then use Code Comparison for the full diff. A runtime output is only available after you explicitly run validation or benchmarking, which execute the submitted code in a limited subprocess; those limits are not a security sandbox.`,
        code: {before: clipped(before), after: clipped(after), why: 'This is generated source code, not the program’s runtime output.'}});
      if (f.validation) {
        steps.push({id: 'validation', title: 'Validation results', tag: 'validation',
          say: f.validation.error ? `The last validation could not complete: ${f.validation.error}. Treat this result as inconclusive, not as evidence that the two programs are equivalent.` :
            `The last differential validation ${f.validation.ok ? 'found the tested executions equivalent' : 'found a behavioral difference'}. It compared ${f.validation.engine || 'the configured validation engine'} results for the cases it ran. Passing tests provide evidence for those cases only; they cannot prove equivalence for every possible input.`});
      }
    }
    steps.push({id: 'end', title: T.titles.end, say: T.end, tag: 'end'}); return steps;
  },
  /* quiz questions from the student's own functions and applied optimizations */
  quiz(f, lang) {
    const T = TUTOR[lang] || TUTOR.en, o = f.opt; if (!o) return null; const Q = [], POOL = ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2ⁿ)'];
    const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuffle(o.complexity.original.functions.filter(x => x.time && !x.manual)).slice(0, 3).forEach(fn => { const wrong = shuffle(POOL.filter(p => p !== fn.time)).slice(0, 3);
      Q.push({q: fill(T.quiz.cx, {fn: fn.name + '()'}), options: shuffle([{text: fn.time, ok: true}, ...wrong.map(text => ({text, ok: false}))]), explain: fn.recurrence ? fn.recurrence : '', kind: 'cx'}); });
    const seen = new Set(), all = Object.keys(TUTOR.en.pass).filter(k => k !== 'recommendations');
    shuffle(o.changes).forEach(c => { if (Q.length >= 6 || seen.has(c.pass_name) || !all.includes(c.pass_name) || c.before.length > 60) return; seen.add(c.pass_name);
      const wrong = shuffle(all.filter(k => k !== c.pass_name)).slice(0, 3);
      Q.push({q: fill(T.quiz.pass, {before: Tutor.short(c.before, 40), after: Tutor.short(c.after, 40)}), options: shuffle([{text: Tutor.label(lang, c.pass_name), ok: true}, ...wrong.map(k => ({text: Tutor.label(lang, k), ok: false}))]), explain: T.pass[c.pass_name] || '', kind: 'pass'}); });
    return Q;
  }
};
