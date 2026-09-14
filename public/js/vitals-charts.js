/* مخططات العلامات الحيوية — SVG خفيف بلا مكتبات (ضغط/سكر/وزن)
   Vitals time-series charts: dependency-free inline SVG, token-colored via CSS.
   Reads the same vital records rendered by patient-self-reported.js (snake or camel). */
(function () {
  'use strict';

  var W = 560, H = 200, PAD_L = 46, PAD_R = 12, PAD_T = 14, PAD_B = 28;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  function field(o, snake, camel) {
    if (o == null) return undefined;
    if (o[snake] !== undefined && o[snake] !== null) return o[snake];
    return o[camel];
  }

  /* Real-record identity: every plotted point links back to its DB row. No synthetic points ever. */
  function recordId(o) {
    if (o == null) return '';
    var id = o.id || o.vitalId || o.vital_id || '';
    return String(id);
  }

  function shortId(id) { return id.length > 8 ? id.substring(0, 8) : id; }

  function dateOf(o) {
    var d = field(o, 'recorded_at', 'recordedAt') || field(o, 'created_at', 'createdAt');
    var t = d ? new Date(d).getTime() : NaN;
    return isFinite(t) ? t : null;
  }

  function typeOf(o) {
    var t = field(o, 'observation_type', 'observationType');
    return String(t == null ? '' : t).trim().toUpperCase();
  }

  function fmtDate(t) {
    try { return new Date(t).toLocaleDateString('ar-SA', { day: 'numeric', month: 'numeric' }); }
    catch (e) { return new Date(t).toLocaleDateString(); }
  }

  function fmtDateLong(t) {
    try { return new Date(t).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return new Date(t).toLocaleDateString(); }
  }

  function fmtVal(v) { return (Math.round(v * 10) / 10).toString(); }

  /* Core builder: pure string output, easy to test. */
  function buildChartSVG(opts) {
    var series = opts.series; /* [{label, color(var), points:[{t,v}], dashed?}] */
    var thresholds = opts.thresholds || []; /* [{v, label, color}] */
    var aria = opts.aria || '';

    var all = [];
    series.forEach(function (s) { s.points.forEach(function (p) { all.push(p.v); }); });
    thresholds.forEach(function (th) { all.push(th.v); });
    if (!all.length) return '';
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (lo === hi) { lo -= 1; hi += 1; }
    var span = hi - lo, pad = span * 0.12;
    lo -= pad; hi += pad;

    var iw = W - PAD_L - PAD_R, ih = H - PAD_T - PAD_B;
    function x(i, n) { return n === 1 ? PAD_L + iw / 2 : PAD_L + (iw * i) / (n - 1); }
    function y(v) { return PAD_T + ih - ((v - lo) / (hi - lo)) * ih; }

    var out = '';
    out += '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(aria) + '" style="width:100%; height:auto; display:block;" preserveAspectRatio="xMidYMid meet">';

    /* y gridlines (4) */
    var g;
    for (g = 0; g <= 3; g++) {
      var gv = lo + ((hi - lo) * g) / 3, gy = y(gv);
      out += '<line x1="' + PAD_L + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PAD_R) + '" y2="' + gy.toFixed(1) + '" stroke="var(--m3-surface-container-highest)" stroke-width="1"/>';
      out += '<text x="' + (PAD_L - 6) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end" font-size="10" fill="var(--m3-on-surface-muted)" font-family="\'JetBrains Mono\',monospace">' + esc(fmtVal(gv)) + '</text>';
    }

    /* thresholds */
    thresholds.forEach(function (th) {
      var ty = y(th.v);
      if (ty < PAD_T || ty > PAD_T + ih) return;
      out += '<line x1="' + PAD_L + '" y1="' + ty.toFixed(1) + '" x2="' + (W - PAD_R) + '" y2="' + ty.toFixed(1) + '" stroke="' + th.color + '" stroke-width="1" stroke-dasharray="4 4" opacity="0.8"/>';
      out += '<text x="' + (W - PAD_R - 2) + '" y="' + (ty - 4).toFixed(1) + '" text-anchor="end" font-size="9" fill="' + th.color + '">' + esc(th.label) + '</text>';
    });

    /* x labels: up to 5 ticks from the longest series */
    var ref = series[0].points, n = ref.length, tickIdx = [];
    if (n === 1) tickIdx = [0];
    else { var k; for (k = 0; k < 5; k++) tickIdx.push(Math.round((k * (n - 1)) / 4)); }
    var seen = {};
    tickIdx.forEach(function (i) {
      if (seen[i]) return; seen[i] = 1;
      var p = ref[i]; if (!p) return;
      out += '<text x="' + x(i, n).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="var(--m3-on-surface-muted)">' + esc(fmtDate(p.t)) + '</text>';
    });

    /* series */
    series.forEach(function (s) {
      var pts = s.points.map(function (p, i) { return x(i, s.points.length).toFixed(1) + ',' + y(p.v).toFixed(1); }).join(' ');
      out += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"' + (s.dashed ? ' stroke-dasharray="5 4"' : '') + '/>';
      s.points.forEach(function (p, i) {
        var tip = s.label + ': ' + fmtVal(p.v) + ' — ' + fmtDateLong(p.t) + (p.id ? ' • سجل ' + shortId(p.id) : '');
        out += '<circle cx="' + x(i, s.points.length).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="3" fill="' + s.color + '"><title>' + esc(tip) + '</title></circle>';
      });
    });

    out += '</svg>';
    return out;
  }

  /* Provenance footer: count + real date range + source. Every number on screen traces to DB rows. */
  function provenance(pts) {
    var first = pts[0], last = pts[pts.length - 1];
    return pts.length + ' قياسات حقيقية • من ' + fmtDate(first.t) + ' إلى ' + fmtDate(last.t) + ' • المصدر: إبلاغ ذاتي (UNVERIFIED)';
  }

  function chartCard(title, latestChip, legend, svg, provNote, extraNote) {
    return '<div class="sr-chart" dir="ltr">'
      + '<div class="sr-chart-head" dir="rtl"><strong>' + esc(title) + '</strong><span><span class="badge badge-warning" style="font-size:0.62rem; margin-inline-end:4px;">PATIENT</span><span class="badge badge-info">' + esc(latestChip) + '</span></span></div>'
      + '<div class="sr-chart-legend" dir="rtl">' + legend + '</div>'
      + svg
      + '<small class="sr-chart-note" dir="rtl">' + esc(provNote) + '</small>'
      + (extraNote ? '<small class="sr-chart-note" dir="rtl">' + esc(extraNote) + '</small>' : '')
      + '</div>';
  }

  function legendDot(color, label) {
    return '<span class="sr-legend-item"><span class="sr-legend-dot" style="background:' + color + ';"></span>' + esc(label) + '</span>';
  }

  function latestLabel(pts, fmt) {
    var p = pts[pts.length - 1];
    return fmt(p.v) + ' • ' + fmtDate(p.t);
  }

  function renderBP(list) {
    var pts = list.map(function (o) {
      var t = dateOf(o); if (t == null) return null;
      var s = num(field(o, 'systolic', 'systolic')), d = num(field(o, 'diastolic', 'diastolic'));
      if (s == null || d == null) return null;
      return { t: t, s: s, d: d, id: recordId(o) };
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; }).slice(-30);
    if (pts.length < 2) return '';
    var sys = pts.map(function (p) { return { t: p.t, v: p.s, id: p.id }; });
    var dia = pts.map(function (p) { return { t: p.t, v: p.d, id: p.id }; });
    var last = pts[pts.length - 1];
    var svg = buildChartSVG({
      series: [
        { label: 'انقباضي', color: 'var(--m3-primary)', points: sys },
        { label: 'انبساطي', color: 'var(--m3-tertiary)', points: dia }
      ],
      thresholds: [
        { v: 140, label: 'حد مرتفع 140', color: 'var(--m3-warning)' },
        { v: 90, label: 'حد مرتفع 90', color: 'var(--m3-warning)' }
      ],
      aria: 'مخطط ضغط الدم: ' + pts.length + ' قياسات، آخرها ' + last.s + '/' + last.d + ' بتاريخ ' + fmtDateLong(last.t)
    });
    return chartCard(
      'ضغط الدم (mmHg)',
      last.s + '/' + last.d + ' • ' + fmtDate(last.t),
      legendDot('var(--m3-primary)', 'انقباضي') + legendDot('var(--m3-tertiary)', 'انبساطي') + legendDot('var(--m3-warning)', 'حد مرتفع 140/90'),
      svg,
      provenance(pts),
      'الخط المتقطع عتبة الارتفاع السريرية، وليست تشخيصاً.'
    );
  }

  function renderSingle(list, types, title, unit, colorVar) {
    var pts = list.map(function (o) {
      var t = dateOf(o); if (t == null) return null;
      var v = num(field(o, 'value_quantity', 'valueQuantity'));
      if (v == null) return null;
      return { t: t, v: v, id: recordId(o) };
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; }).slice(-30);
    if (pts.length < 2) return '';
    var last = pts[pts.length - 1];
    var svg = buildChartSVG({
      series: [{ label: title, color: colorVar, points: pts }],
      aria: 'مخطط ' + title + ': ' + pts.length + ' قياسات، آخرها ' + fmtVal(last.v) + ' ' + unit + ' بتاريخ ' + fmtDateLong(last.t)
    });
    return chartCard(
      title + ' (' + unit + ')',
      latestLabel(pts, fmtVal) + ' ' + unit,
      legendDot(colorVar, title),
      svg,
      provenance(pts),
      ''
    );
  }

  function render(containerId, vitals) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var list = Array.isArray(vitals) ? vitals : (vitals && Array.isArray(vitals.items) ? vitals.items : []);
    if (!list.length) { el.innerHTML = ''; return; }
    var bp = list.filter(function (o) { return typeOf(o) === 'BLOOD_PRESSURE'; });
    var sugar = list.filter(function (o) { var t = typeOf(o); return t === 'BLOOD_SUGAR' || t === 'BLOOD_GLUCOSE'; });
    var weight = list.filter(function (o) { return typeOf(o) === 'WEIGHT'; });
    var html = renderBP(bp)
      + renderSingle(sugar, null, 'سكر الدم', 'mg/dL', 'var(--m3-primary)')
      + renderSingle(weight, null, 'الوزن', 'kg', 'var(--m3-tertiary)');
    if (!html) {
      el.innerHTML = '<small style="color:var(--m3-on-surface-muted);">لا توجد قياسات كافية للرسم — أضف قياسين على الأقل من نفس النوع (ضغط، سكر، وزن).</small>';
      return;
    }
    el.innerHTML = '<div class="sr-charts-grid">' + html + '</div>';
  }

  window.VitalsCharts = { render: render, buildChartSVG: buildChartSVG };
})();
