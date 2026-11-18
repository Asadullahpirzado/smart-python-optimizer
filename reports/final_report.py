"""Final (submission-style) report: cover page, compiler phases, optimizations, complexity, benchmark, validation,
3D screenshots, code diff, tutor notes and conclusion.  One self-contained HTML file; 'Print / Save as PDF' uses the browser."""
import html
import math
import re
import time

KEYS = ["title", "subtitle", "student", "roll", "course", "instructor", "university", "date", "file", "summary", "source", "phases", "opts",
        "algos", "complexity", "benchmark", "validation", "visuals", "diff", "notes", "safety", "conclusion", "print", "opportunities",
        "applied", "lines", "time", "space", "pass", "line", "before", "after", "why", "function", "original", "optimized", "improvement",
        "passed", "failed"]
_H = {
    "en": ["Final Optimization Report", "Intelligent Python Code Optimization and Algorithmic Performance Analysis", "Student", "Roll no.", "Course", "Instructor", "University", "Date", "File", "Executive summary", "Source program", "Compiler phases", "Optimizations applied", "Algorithmic analysis", "Complexity analysis", "Benchmark results", "Validation", "3D visualizations", "Code difference", "Learning notes", "Safety and limitations", "Conclusion", "Print / Save as PDF", "Opportunities", "Applied", "Lines", "Time", "Space", "Technique", "Line", "Before", "After", "Why", "Function", "Original", "Optimized", "Improvement", "Passed", "Failed"],
    "ur": ["حتمی آپٹیمائزیشن رپورٹ", "ذہین پائتھن کوڈ آپٹیمائزیشن اور الگورتھمک کارکردگی کا تجزیہ", "طالب علم", "رول نمبر", "کورس", "استاد", "یونیورسٹی", "تاریخ", "فائل", "خلاصہ", "سورس پروگرام", "کمپائلر کے مراحل", "لاگو کی گئی آپٹیمائزیشنز", "الگورتھمک تجزیہ", "پیچیدگی کا تجزیہ", "بینچ مارک نتائج", "تصدیق", "تھری ڈی بصری مناظر", "کوڈ میں فرق", "سیکھنے کے نوٹس", "حفاظت اور حدود", "نتیجہ", "پرنٹ / پی ڈی ایف محفوظ کریں", "مواقع", "لاگو", "لائنیں", "وقت", "میموری", "تکنیک", "لائن", "پہلے", "بعد میں", "وجہ", "فنکشن", "اصل", "آپٹیمائزڈ", "بہتری", "کامیاب", "ناکام"],
    "hi": ["अंतिम ऑप्टिमाइज़ेशन रिपोर्ट", "बुद्धिमान पायथन कोड ऑप्टिमाइज़ेशन और एल्गोरिदमिक प्रदर्शन विश्लेषण", "छात्र", "रोल नंबर", "कोर्स", "शिक्षक", "विश्वविद्यालय", "तारीख", "फ़ाइल", "सारांश", "स्रोत प्रोग्राम", "कंपाइलर के चरण", "लागू किए गए ऑप्टिमाइज़ेशन", "एल्गोरिदमिक विश्लेषण", "जटिलता विश्लेषण", "बेंचमार्क परिणाम", "सत्यापन", "3D दृश्य", "कोड में अंतर", "सीखने के नोट्स", "सुरक्षा और सीमाएँ", "निष्कर्ष", "प्रिंट / PDF सहेजें", "अवसर", "लागू", "लाइनें", "समय", "मेमोरी", "तकनीक", "लाइन", "पहले", "बाद में", "कारण", "फ़ंक्शन", "मूल", "ऑप्टिमाइज़्ड", "सुधार", "सफल", "विफल"],
    "ar": ["تقرير التحسين النهائي", "تحسين شيفرة بايثون الذكي وتحليل أداء الخوارزميات", "الطالب", "الرقم الجامعي", "المقرر", "المدرّس", "الجامعة", "التاريخ", "الملف", "الملخص التنفيذي", "البرنامج المصدري", "مراحل المترجم", "التحسينات المطبَّقة", "تحليل الخوارزميات", "تحليل التعقيد", "نتائج القياس", "التحقق", "التصورات ثلاثية الأبعاد", "الفرق بين الشيفرتين", "ملاحظات التعلّم", "السلامة والقيود", "الخلاصة", "طباعة / حفظ PDF", "الفرص", "المطبَّق", "الأسطر", "الزمن", "الذاكرة", "التقنية", "السطر", "قبل", "بعد", "السبب", "الدالة", "الأصلي", "المحسَّن", "التحسّن", "نجح", "فشل"],
    "sd": ["آخري آپٽيمائيزيشن رپورٽ", "سمارٽ پائٿون ڪوڊ آپٽيمائيزيشن ۽ الگورٿم ڪارڪردگي جو تجزيو", "شاگرد", "رول نمبر", "ڪورس", "استاد", "يونيورسٽي", "تاريخ", "فائل", "خلاصو", "سورس پروگرام", "ڪمپائلر جا مرحلا", "لاڳو ڪيل آپٽيمائيزيشنون", "الگورٿم جو تجزيو", "پيچيدگي جو تجزيو", "بينچ مارڪ نتيجا", "تصديق", "ٽي ڊي بصري منظر", "ڪوڊ ۾ فرق", "سکيا جا نوٽس", "حفاظت ۽ حدون", "نتيجو", "پرنٽ / پي ڊي ايف محفوظ ڪريو", "موقعا", "لاڳو", "لائنون", "وقت", "ميموري", "ٽيڪنڪ", "لائن", "اڳ", "پوءِ", "سبب", "فنڪشن", "اصل", "آپٽيمائيزڊ", "بهتري", "ڪامياب", "ناڪام"],
    "es": ["Informe final de optimización", "Optimización inteligente de código Python y análisis del rendimiento algorítmico", "Estudiante", "N.º de matrícula", "Curso", "Profesor", "Universidad", "Fecha", "Archivo", "Resumen ejecutivo", "Programa fuente", "Fases del compilador", "Optimizaciones aplicadas", "Análisis algorítmico", "Análisis de complejidad", "Resultados del benchmark", "Validación", "Visualizaciones 3D", "Diferencias de código", "Notas de aprendizaje", "Seguridad y limitaciones", "Conclusión", "Imprimir / Guardar como PDF", "Oportunidades", "Aplicadas", "Líneas", "Tiempo", "Espacio", "Técnica", "Línea", "Antes", "Después", "Por qué", "Función", "Original", "Optimizado", "Mejora", "Aprobada", "Fallida"],
    "fr": ["Rapport final d'optimisation", "Optimisation intelligente de code Python et analyse de performance algorithmique", "Étudiant", "N° d'étudiant", "Cours", "Enseignant", "Université", "Date", "Fichier", "Résumé", "Programme source", "Phases du compilateur", "Optimisations appliquées", "Analyse algorithmique", "Analyse de complexité", "Résultats du benchmark", "Validation", "Visualisations 3D", "Différences de code", "Notes d'apprentissage", "Sécurité et limites", "Conclusion", "Imprimer / Enregistrer en PDF", "Opportunités", "Appliquées", "Lignes", "Temps", "Espace", "Technique", "Ligne", "Avant", "Après", "Pourquoi", "Fonction", "Original", "Optimisé", "Amélioration", "Réussie", "Échouée"],
    "de": ["Abschlussbericht zur Optimierung", "Intelligente Python-Code-Optimierung und algorithmische Leistungsanalyse", "Student", "Matrikelnr.", "Kurs", "Dozent", "Universität", "Datum", "Datei", "Zusammenfassung", "Quellprogramm", "Compiler-Phasen", "Angewendete Optimierungen", "Algorithmische Analyse", "Komplexitätsanalyse", "Benchmark-Ergebnisse", "Validierung", "3D-Visualisierungen", "Code-Unterschiede", "Lernnotizen", "Sicherheit und Grenzen", "Fazit", "Drucken / Als PDF speichern", "Möglichkeiten", "Angewendet", "Zeilen", "Zeit", "Speicher", "Technik", "Zeile", "Vorher", "Nachher", "Warum", "Funktion", "Original", "Optimiert", "Verbesserung", "Bestanden", "Fehlgeschlagen"],
    "tr": ["Nihai Optimizasyon Raporu", "Akıllı Python Kod Optimizasyonu ve Algoritmik Performans Analizi", "Öğrenci", "Öğrenci no.", "Ders", "Öğretim üyesi", "Üniversite", "Tarih", "Dosya", "Yönetici özeti", "Kaynak program", "Derleyici aşamaları", "Uygulanan optimizasyonlar", "Algoritmik analiz", "Karmaşıklık analizi", "Kıyaslama sonuçları", "Doğrulama", "3D görselleştirmeler", "Kod farkı", "Öğrenme notları", "Güvenlik ve sınırlar", "Sonuç", "Yazdır / PDF olarak kaydet", "Fırsatlar", "Uygulanan", "Satır sayısı", "Zaman", "Bellek", "Teknik", "Satır", "Önce", "Sonra", "Neden", "Fonksiyon", "Orijinal", "Optimize", "İyileşme", "Başarılı", "Başarısız"],
    "zh": ["最终优化报告", "智能 Python 代码优化与算法性能分析", "学生", "学号", "课程", "指导教师", "大学", "日期", "文件", "执行摘要", "源程序", "编译器阶段", "已应用的优化", "算法分析", "复杂度分析", "基准测试结果", "验证", "3D 可视化", "代码差异", "学习笔记", "安全与局限", "结论", "打印 / 另存为 PDF", "优化机会", "已应用", "行数", "时间", "空间", "技术", "行", "优化前", "优化后", "原因", "函数", "原始", "优化后版本", "提升", "通过", "失败"],
    "ja": ["最終最適化レポート", "インテリジェントなPythonコード最適化とアルゴリズム性能分析", "学生", "学籍番号", "科目", "担当教員", "大学", "日付", "ファイル", "概要", "ソースプログラム", "コンパイラの段階", "適用した最適化", "アルゴリズム分析", "計算量の分析", "ベンチマーク結果", "検証", "3D可視化", "コードの差分", "学習ノート", "安全性と制限", "結論", "印刷 / PDFとして保存", "機会", "適用済み", "行数", "時間", "メモリ", "手法", "行", "変更前", "変更後", "理由", "関数", "元", "最適化後", "改善", "合格", "不合格"],
    "ru": ["Итоговый отчёт об оптимизации", "Интеллектуальная оптимизация кода Python и анализ алгоритмической производительности", "Студент", "Номер зачётки", "Курс", "Преподаватель", "Университет", "Дата", "Файл", "Краткое резюме", "Исходная программа", "Этапы компилятора", "Применённые оптимизации", "Алгоритмический анализ", "Анализ сложности", "Результаты бенчмарка", "Проверка", "3D-визуализации", "Различия кода", "Учебные заметки", "Безопасность и ограничения", "Заключение", "Печать / Сохранить как PDF", "Возможности", "Применено", "Строк", "Время", "Память", "Приём", "Строка", "До", "После", "Почему", "Функция", "Оригинал", "Оптимизировано", "Улучшение", "Пройдена", "Не пройдена"],
}
HEADS = {k: dict(zip(KEYS, v)) for k, v in _H.items()}
RTL = {"ur", "ar", "sd"}
E_ = html.escape
IMG_RE = re.compile(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")
IMG_CAPTIONS = {"cfg": "Control-flow graph (3D)", "growth": "Operation growth (3D)", "city": "Code City: original vs optimized", "passes": "Optimizations by technique",
                "bench": "Measured benchmark (3D)", "callgraph": "Call graph (3D)"}


def _num(v):
    return f"{v:,.0f}" if abs(v) >= 100 else f"{v:.2f}".rstrip("0").rstrip(".")


def svg_lines(sizes, a, b, w=640, h=260):
    """Log-scale line chart: original (orange) vs optimized (green)."""
    vals = [v for v in a + b if v and v > 0]
    if not vals or len(sizes) < 2:
        return ""
    lo, hi = 0, math.log10(1 + max(vals)) or 1
    px, py, pw, ph = 56, 16, w - 76, h - 56

    def pt(i, v):
        return px + pw * i / (len(sizes) - 1), py + ph * (1 - (math.log10(1 + max(v, 0)) - lo) / (hi - lo))
    out = [f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" class="chart">']
    for k in range(5):
        y = py + ph * k / 4
        val = 10 ** (hi * (1 - k / 4)) - 1
        out.append(f'<line x1="{px}" y1="{y:.1f}" x2="{px + pw}" y2="{y:.1f}" stroke="#E2E8F0"/><text x="{px - 6}" y="{y + 4:.1f}" font-size="10" text-anchor="end" fill="#64748B">{_num(val)}</text>')
    for i, s in enumerate(sizes):
        out.append(f'<text x="{px + pw * i / (len(sizes) - 1):.1f}" y="{h - 30}" font-size="10" text-anchor="middle" fill="#64748B">{s}</text>')
    for series, col in ((a, "#FB923C"), (b, "#34D399")):
        pts = " ".join("%.1f,%.1f" % pt(i, v) for i, v in enumerate(series))
        out.append(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="3" stroke-linejoin="round"/>')
        for i, v in enumerate(series):
            x, y = pt(i, v)
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="{col}"/>')
    out.append(f'<text x="{px}" y="{h - 8}" font-size="11" fill="#FB923C">&#9632; original</text><text x="{px + 90}" y="{h - 8}" font-size="11" fill="#34D399">&#9632; optimized</text><text x="{w - 10}" y="{h - 8}" font-size="10" text-anchor="end" fill="#64748B">n (log y)</text></svg>')
    return "".join(out)


def svg_bars(labels, a, b, unit, w=640, h=240):
    mx = max([v for v in a + b if v] or [1])
    px, py, pw, ph = 50, 14, w - 70, h - 54
    step = pw / max(len(labels), 1)
    out = [f'<svg viewBox="0 0 {w} {h}" xmlns="http://www.w3.org/2000/svg" class="chart">']
    for k in range(5):
        y = py + ph * k / 4
        out.append(f'<line x1="{px}" y1="{y:.1f}" x2="{px + pw}" y2="{y:.1f}" stroke="#E2E8F0"/><text x="{px - 6}" y="{y + 4:.1f}" font-size="10" text-anchor="end" fill="#64748B">{_num(mx * (1 - k / 4))}</text>')
    for i, lb in enumerate(labels):
        x0 = px + step * i + step * .15
        for j, (v, col) in enumerate(((a[i], "#FB923C"), (b[i], "#34D399"))):
            bh = ph * (v / mx if mx else 0)
            out.append(f'<rect x="{x0 + j * step * .35:.1f}" y="{py + ph - bh:.1f}" width="{step * .32:.1f}" height="{bh:.1f}" rx="3" fill="{col}"/>')
        out.append(f'<text x="{px + step * (i + .5):.1f}" y="{h - 30}" font-size="10" text-anchor="middle" fill="#64748B">{E_(str(lb))}</text>')
    out.append(f'<text x="{px}" y="{h - 8}" font-size="11" fill="#FB923C">&#9632; original</text><text x="{px + 90}" y="{h - 8}" font-size="11" fill="#34D399">&#9632; optimized</text><text x="{w - 10}" y="{h - 8}" font-size="10" text-anchor="end" fill="#64748B">{E_(unit)}</text></svg>')
    return "".join(out)


def _table(heads, rows):
    return "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in heads) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"


def _diff_html(text):
    out = []
    for ln in (text or "").splitlines()[:400]:
        cls = "add" if ln.startswith("+") and not ln.startswith("+++") else "del" if ln.startswith("-") and not ln.startswith("---") else "hunk" if ln.startswith("@@") else ""
        out.append(f'<div class="d {cls}">{E_(ln) or "&nbsp;"}</div>')
    return "".join(out)


def clean_images(images):
    out = {}
    if isinstance(images, dict):
        for k, v in list(images.items())[:8]:
            if k in IMG_CAPTIONS and isinstance(v, str) and len(v) < 3_500_000 and IMG_RE.match(v):
                out[k] = v
    return out


def _s(v, n=200):
    return str(v or "").strip()[:n]


def build(rep, extra=None):
    extra = extra if isinstance(extra, dict) else {}
    lang = extra.get("lang") if extra.get("lang") in HEADS else "en"
    H = HEADS[lang]
    meta = extra.get("meta") if isinstance(extra.get("meta"), dict) else {}
    s, c = rep["summary"], rep["complexity"]
    imgs = clean_images(extra.get("images"))
    an = extra.get("analysis") if isinstance(extra.get("analysis"), dict) else {}
    val = extra.get("validation") if isinstance(extra.get("validation"), dict) else None
    lesson = [x for x in (extra.get("lesson") or []) if isinstance(x, dict)][:40]
    today = time.strftime("%Y-%m-%d")
    meta_rows = "".join(f"<div><b>{H[k]}</b><span>{E_(_s(meta.get(k)))}</span></div>" for k in ("student", "roll", "course", "instructor", "university") if _s(meta.get(k)))
    tiles = [(H["opportunities"], s["opportunities"], "#4285F4"), (H["applied"], s["applied"], "#34D399"), (H["lines"], f"{rep['lines']['original']} → {rep['lines']['optimized']}", "#FB923C"),
             (H["time"], f"{E_(c['original']['time'])} → {E_(c['optimized']['time'])}", "#A78BFA"), (H["space"], f"{E_(c['original']['space'])} → {E_(c['optimized']['space'])}", "#2DD4BF")]
    tiles_html = "".join(f"<div class='tile' style='border-top:4px solid {col}'><b>{v}</b><span>{k}</span></div>" for k, v, col in tiles)
    sec = []

    def section(title, body):
        sec.append(f"<section><h2><i>{len(sec) + 1}</i>{title}</h2>{body}</section>")

    section(H["summary"], f"<div class='tiles'>{tiles_html}</div><p class='muted'>{E_(rep['filename'])} · {s['node_reduction_pct']}% AST ↓ · {s['iterations']} iteration(s)</p>")
    st = an.get("stats") if isinstance(an.get("stats"), dict) else {}
    if st:
        rows = [(E_(str(k)), E_(str(v))) for k, v in list(st.items())[:14]]
        sem = an.get("semantic") if isinstance(an.get("semantic"), dict) else {}
        extra_html = f"<p>{E_(str(sem.get('undefined', 0)))} undefined · {E_(str(sem.get('unused_imports', 0)))} unused imports · {E_(str(sem.get('unused_variables', 0)))} unused variables</p>" if sem else ""
        section(H["source"], _table(["", ""], rows) + extra_html)
    scopes = an.get("scopes") if isinstance(an.get("scopes"), list) else []
    if scopes or an.get("tokens"):
        rows = [(f"<code>{E_(_s(x.get('name'), 60))}</code>", E_(str(x.get("blocks", ""))), E_(str(x.get("loops", ""))), E_(str(x.get("unreachable", ""))), E_(str(x.get("phi", "")))) for x in scopes[:60] if isinstance(x, dict)]
        pre = f"<p>tokens: <b>{E_(str(an.get('tokens', '')))}</b> · AST nodes: <b>{E_(str(an.get('ast_nodes', '')))}</b> · call graph: <b>{E_(str(an.get('functions', '')))}</b> functions, recursive: {E_(', '.join(map(str, an.get('recursive', [])[:12])) or '–')}</p>"
        section(H["phases"], pre + (_table(["Scope", "Basic blocks", "Loops", "Unreachable", "φ"], rows) if rows else ""))
    by = s["by_pass"]
    rows = [(E_(k), str(v)) for k, v in sorted(by.items(), key=lambda kv: -kv[1])]
    ch = [(E_(x["pass_name"]), str(x["lineno"]), f"<code>{E_(x['before'][:120])}</code>", f"<code>{E_(x['after'][:120])}</code>", E_(x["explanation"])) for x in rep["changes"][:150]]
    body = (_table([H["pass"], H["applied"]], rows) if rows else "") + (_table([H["pass"], H["line"], H["before"], H["after"], H["why"]], ch) if ch else "<p class='muted'>–</p>")
    if len(rep["changes"]) > 150:
        body += f"<p class='muted'>… {len(rep['changes']) - 150} more</p>"
    section(H["opts"], body)
    rr = [(E_(r["title"]), E_(r["function"]), str(r["lineno"]), f"{E_(r['original_complexity'])} → {E_(r['improved_complexity'])}", E_(r["explanation"])) for r in rep["recommendations"]]
    section(H["algos"], _table(["", H["function"], H["line"], "O(·)", H["why"]], rr) if rr else "<p class='muted'>–</p>")
    after = {x["name"]: x for x in c["optimized"]["functions"]}
    fr = [(f"<code>{E_(x['name'])}</code>", str(x["lineno"]), E_(x["time"]), E_(after.get(x["name"], {}).get("time", "–")), E_(x["space"]), E_(x.get("recurrence") or "")) for x in c["original"]["functions"]]
    g = c["growth"]
    section(H["complexity"], _table([H["function"], H["line"], H["original"], H["optimized"], H["space"], "T(n)"], fr) + svg_lines(g["sizes"], g["original"], g["optimized"]))
    b = rep.get("benchmark")
    if b and b.get("rows"):
        r = b["rows"]
        brow = [(str(x["size"]), f"{x['original']['mean_s'] * 1000:.3f} ms", f"{x['optimized']['mean_s'] * 1000:.3f} ms", f"{x['time_improvement_pct']:.1f}%", f"{x['original']['peak_kb']:.0f} KB", f"{x['optimized']['peak_kb']:.0f} KB") for x in r]
        section(H["benchmark"], _table(["n", H["original"], H["optimized"], H["improvement"], "KB " + H["original"], "KB " + H["optimized"]], brow) +
                svg_bars([x["size"] for x in r], [x["original"]["mean_s"] * 1000 for x in r], [x["optimized"]["mean_s"] * 1000 for x in r], "ms"))
    checks = rep["static_validation"]["checks"]
    vbody = f"<p><span class='pill {'ok' if rep['static_validation']['ok'] else 'bad'}'>{H['passed'] if rep['static_validation']['ok'] else H['failed']}</span> " + " · ".join(("✓ " if k["ok"] else "✗ ") + E_(k["name"]) for k in checks) + "</p>"
    if val:
        vbody += f"<p><span class='pill {'ok' if val.get('ok') else 'bad'}'>{H['passed'] if val.get('ok') else H['failed']}</span> differential + property-based testing ({E_(str(val.get('engine', '')))})</p>"
        vr = [(f"<code>{E_(_s(x.get('name'), 60))}</code>", E_(str(x.get("differential_cases", ""))), E_(str(x.get("property_cases", ""))), "✓" if not x.get("mismatches") else "✗") for x in (val.get("functions") or [])[:60] if isinstance(x, dict)]
        if vr:
            vbody += _table([H["function"], "Differential", "Property", ""], vr)
    section(H["validation"], vbody)
    if imgs:
        figs = "".join(f"<figure><img src='{v}' alt=''><figcaption>{E_(IMG_CAPTIONS[k])}</figcaption></figure>" for k, v in imgs.items())
        section(H["visuals"], f"<div class='figs'>{figs}</div>")
    section(H["diff"], f"<div class='diff'>{_diff_html(rep.get('unified_diff'))}</div>")
    if lesson:
        section(H["notes"], "".join(f"<h3>{E_(_s(x.get('title'), 120))}</h3><p>{E_(_s(x.get('say'), 2000))}</p>" for x in lesson))
    section(H["safety"], "<ul>" + "".join(f"<li>{E_(w)}</li>" for w in rep["warnings"]) + "</ul><p class='muted'>Complexity figures are static estimates; speed-ups are reported only from real benchmark runs. Output is regenerated with ast.unparse (comments are not preserved). Benchmark and validation execute the code in a resource-limited subprocess.</p>")
    concl = _s(extra.get("conclusion"), 2000) or f"{c['original']['time']} → {c['optimized']['time']}"
    section(H["conclusion"], f"<p class='concl'>{E_(concl)}</p><div class='sig'><span>{H['student']}: ____________________</span><span>{H['instructor']}: ____________________</span></div>")
    rtl = lang in RTL
    css = """*{box-sizing:border-box}body{font-family:'Segoe UI','Noto Naskh Arabic','Noto Nastaliq Urdu','Noto Sans Devanagari','Noto Sans JP','Noto Sans SC',Tahoma,Arial,sans-serif;background:#EEF2F9;color:#1F2A44;margin:0;line-height:1.6}
.page{max-width:920px;margin:0 auto;background:#fff;padding:0 44px 40px}.cover{padding:70px 0 40px;text-align:center;border-bottom:6px solid #4285F4;background:linear-gradient(135deg,#EEF4FF,#F6F0FF);margin:0 -44px 24px;padding-left:44px;padding-right:44px}
.cover h1{font-size:38px;margin:0 0 10px;color:#2B3A67}.cover p{color:#64748B;margin:4px 0}.cover .badge3d{display:inline-block;margin-top:14px;padding:4px 14px;border-radius:20px;background:#4285F4;color:#fff;font-weight:700;font-size:13px}
.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:26px auto 0;max-width:720px;text-align:start}.meta div{background:#fff;border-radius:10px;padding:8px 12px;box-shadow:0 1px 6px #0001}.meta b{display:block;font-size:11px;text-transform:uppercase;color:#64748B}
section{margin:26px 0;page-break-inside:auto}h2{font-size:21px;border-bottom:2px solid #E2E8F0;padding-bottom:6px;color:#2B3A67}h2 i{display:inline-block;width:30px;height:30px;line-height:30px;border-radius:50%;background:#4285F4;color:#fff;font-style:normal;text-align:center;font-size:14px;margin-inline-end:10px}h3{font-size:15px;margin:14px 0 2px}
.tiles{display:flex;gap:12px;flex-wrap:wrap}.tile{flex:1;min-width:130px;background:#F8FAFC;border-radius:12px;padding:14px 16px}.tile b{display:block;font-size:20px}.tile span{color:#64748B;font-size:12.5px}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12.5px}th,td{padding:6px 9px;border-bottom:1px solid #E2E8F0;text-align:start;vertical-align:top}th{background:#EEF2FF;font-size:11.5px}code{background:#F1F5F9;padding:1px 5px;border-radius:4px;font-family:Consolas,monospace;font-size:12px;word-break:break-word}
.muted{color:#64748B;font-size:12.5px}.chart{width:100%;max-width:640px;display:block;margin:10px auto}.pill{display:inline-block;padding:2px 12px;border-radius:20px;font-weight:700;font-size:12px}.pill.ok{background:#D1FAE5;color:#047857}.pill.bad{background:#FFE4E6;color:#BE123C}
.figs{display:grid;grid-template-columns:1fr 1fr;gap:14px}figure{margin:0;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;page-break-inside:avoid}figure img{width:100%;display:block}figcaption{padding:6px 10px;font-size:12px;color:#64748B;background:#F8FAFC}
.diff{font-family:Consolas,monospace;font-size:11.5px;background:#0F172A;color:#CBD5E1;border-radius:10px;padding:10px;direction:ltr;text-align:left}.d{white-space:pre-wrap;word-break:break-all}.d.add{background:#064E3B55;color:#6EE7B7}.d.del{background:#7F1D1D66;color:#FDA4AF}.d.hunk{color:#93C5FD}
.concl{font-size:15px;background:#F0F9FF;border-inline-start:5px solid #4285F4;padding:12px 16px;border-radius:8px}.sig{display:flex;justify-content:space-between;gap:20px;margin-top:40px;color:#64748B;font-size:13px}
.bar{position:sticky;top:0;background:#1F2A44;color:#fff;padding:10px 20px;display:flex;gap:12px;align-items:center;z-index:5}.bar button{background:#4285F4;border:0;color:#fff;padding:7px 16px;border-radius:9px;font-weight:700;cursor:pointer}
@media print{body{background:#fff}.bar{display:none}.page{padding:0;max-width:none}.cover{margin:0 0 16px}section{page-break-inside:auto}h2{page-break-after:avoid}table,figure{page-break-inside:avoid}@page{margin:14mm}}
@media(max-width:700px){.figs{grid-template-columns:1fr}.page{padding:0 16px}.cover{margin:0 -16px 20px}}"""
    return f"""<!doctype html><html lang="{lang}" dir="{'rtl' if rtl else 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{E_(H['title'])} – {E_(rep['filename'])}</title><style>{css}</style></head><body>
<div class="bar"><button onclick="window.print()">{E_(H['print'])}</button><span>{E_(rep['filename'])}</span></div>
<div class="page"><div class="cover"><h1>{E_(H['title'])}</h1><p>{E_(H['subtitle'])}</p><p><b>{H['file']}:</b> {E_(rep['filename'])} · <b>{H['date']}:</b> {today}</p><span class="badge3d">Smart Python Optimizer · 3D</span><div class="meta">{meta_rows}</div></div>
{''.join(sec)}</div></body></html>"""
