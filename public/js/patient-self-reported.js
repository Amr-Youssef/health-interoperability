(function () {
  var BASE = '/api/patients/me';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function asList(j) { if (Array.isArray(j)) return j; if (j && Array.isArray(j.items)) return j.items; return []; }
  function status(msg, ok) {
    var el = document.getElementById('sr-status');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = '<div style="padding:8px 12px; font-size:0.82rem; border:1px solid ' + (ok ? 'var(--m3-primary)' : 'var(--m3-error)') + '; background:' + (ok ? 'var(--m3-primary-container)' : 'var(--m3-error-container)') + ';">' + esc(msg) + '</div>';
    setTimeout(function () { el.style.display = 'none'; }, 3500);
  }
  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(BASE + path, { method: opts.method || 'GET', headers: { 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }
  function pickId(o) { return o.id || o.allergyId || o.medicationId || o.conditionId || o.procedureId || o.familyId || o.vitalId || o.documentId || null; }
  function row(name, meta, id, type) {
    if (!id) return '<div style="padding:6px 8px; border:1px dashed var(--m3-error); margin-bottom:4px;"><strong>' + esc(name) + '</strong> <small>(تعذر الحذف: لا يوجد معرف — حدث الصفحة)</small></div>';
    return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--m3-outline-variant); margin-bottom:4px;"><span><strong>' + esc(name) + '</strong> <small style="color:var(--m3-on-surface-muted);">' + esc(meta || '') + '</small> <span class="badge badge-warning" style="font-size:0.62rem;">UNVERIFIED</span></span><button class="btn btn-secondary btn-sm" onclick="SR.del(\'' + type + '\',\'' + id + '\')">حذف</button></div>';
  }
  var DEL = { allergy: '/allergies/', medication: '/medications/', condition: '/conditions/', procedure: '/procedures/', family: '/family-history/', vital: '/vitals/', document: '/documents/' };
  window.SR = {
    bustLongitudinal() { try { var pid = (typeof currentPatientId !== 'undefined' ? currentPatientId : null); if (typeof longitudinalCache !== 'undefined' && pid) longitudinalCache.delete(pid); if (typeof loadLongitudinalRecord === 'function' && pid) loadLongitudinalRecord(pid); } catch (e) {} },
    async reload() {
      try {
        this.bustLongitudinal();
        var p = await api('/health-profile');
        this.render('sr-med-list', asList(p.medications).map(function (m) { return row(m.medicationName, (m.dose || '') + ' ' + (m.frequency || ''), pickId(m), 'medication'); }).join('') || '<small>لا توجد أدوية</small>');
        this.render('sr-cond-list', asList(p.conditions).map(function (c) { return row(c.conditionName, c.status || '', pickId(c), 'condition'); }).join('') || '<small>لا توجد حالات</small>');
        this.render('sr-proc-list', asList(p.procedures).map(function (x) { return row(x.procedureName, x.facilityName || '', pickId(x), 'procedure'); }).join('') || '<small>لا توجد عمليات</small>');
        this.render('sr-fam-list', asList(p.familyHistory || p.familyMembers).map(function (f) { return row(f.conditionName || '', f.relationship || '', pickId(f), 'family'); }).join('') || '<small>لا يوجد تاريخ عائلي</small>');
        this.render('sr-vit-list', asList(p.vitalObservations || p.vitals).map(function (v) { return row(v.observationType, (v.valueQuantity != null ? v.valueQuantity : (v.systolic ? v.systolic + '/' + v.diastolic : '')), pickId(v), 'vital'); }).join('') || '<small>لا توجد قياسات</small>');
        this.render('sr-doc-list', asList(p.documents).map(function (d) { return row(d.filename, d.documentCategory || '', pickId(d), 'document'); }).join('') || '<small>لا توجد مستندات</small>');
        this.render('sr-allergy-list', asList(p.allergies).map(function (a) { return row(a.allergenName, a.reactionSeverity || '', pickId(a), 'allergy'); }).join('') || '<small>لا توجد حساسيات</small>');
        var soc = p.socialHistory;
        this.render('sr-soc-list', soc && !soc.message ? '<small>' + esc(soc.smokingStatus || '') + ' • ' + esc(soc.physicalActivity || '') + ' • ' + esc(soc.occupation || '') + '</small>' : '<small>لا يوجد تاريخ اجتماعي</small>');
      } catch (e) { status(e.message, false); }
    },
    render(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; },
    async del(type, id) {
      if (!id || id === 'undefined' || id === 'null') return status('تعذر الحذف: معرف غير صالح — حدث الصفحة وحاول مجددا', false);
      if (!confirm('حذف هذا العنصر؟')) return;
      try { await api(DEL[type] + encodeURIComponent(id), { method: 'DELETE' }); status('تم الحذف', true); this.reload(); }
      catch (e) { status('فشل الحذف: ' + e.message, false); }
    },
    async addMedication() {
      var body = { medicationName: document.getElementById('sr-med-name').value.trim(), dose: document.getElementById('sr-med-dose').value.trim() || undefined, frequency: document.getElementById('sr-med-freq').value.trim() || undefined, currentlyTaking: document.getElementById('sr-med-taking').checked };
      if (!body.medicationName) return status('اسم الدواء مطلوب', false);
      try { await api('/medications', { method: 'POST', body: body }); status('تم حفظ الدواء كبيانات ذاتية', true); document.getElementById('sr-med-form').reset(); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async addCondition() {
      var body = { conditionName: document.getElementById('sr-cond-name').value.trim(), diagnosisDate: document.getElementById('sr-cond-date').value || undefined, treatingFacility: document.getElementById('sr-cond-facility').value.trim() || undefined };
      if (!body.conditionName) return status('اسم الحالة مطلوب', false);
      try { await api('/conditions', { method: 'POST', body: body }); status('تم حفظ الحالة', true); document.getElementById('sr-cond-form').reset(); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async addProcedure() {
      var body = { procedureName: document.getElementById('sr-proc-name').value.trim(), procedureDate: document.getElementById('sr-proc-date').value || undefined, facilityName: document.getElementById('sr-proc-facility').value.trim() || undefined };
      if (!body.procedureName) return status('اسم العملية مطلوب', false);
      try { await api('/procedures', { method: 'POST', body: body }); status('تم حفظ العملية', true); document.getElementById('sr-proc-form').reset(); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async addFamily() {
      var body = { relationship: document.getElementById('sr-fam-rel').value, conditionName: document.getElementById('sr-fam-cond').value.trim() };
      if (!body.conditionName) return status('اسم الحالة مطلوب', false);
      try { await api('/family-history', { method: 'POST', body: body }); status('تم حفظ التاريخ العائلي', true); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async saveSocial() {
      var body = { smokingStatus: document.getElementById('sr-soc-smoke').value || undefined, physicalActivity: document.getElementById('sr-soc-activity').value || undefined, occupation: document.getElementById('sr-soc-job').value.trim() || undefined, sleepHours: document.getElementById('sr-soc-sleep').value ? Number(document.getElementById('sr-soc-sleep').value) : undefined };
      try { await api('/social-history', { method: 'POST', body: body }); status('تم حفظ التاريخ الاجتماعي', true); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async addVital() {
      var t = document.getElementById('sr-vit-type').value;
      var dt = document.getElementById('sr-vit-date').value;
      if (!dt) return status('تاريخ القياس مطلوب', false);
      var body = { observationType: t, recordedAt: new Date(dt).toISOString() };
      if (t === 'BLOOD_PRESSURE') { body.systolic = Number(document.getElementById('sr-vit-sys').value) || undefined; body.diastolic = Number(document.getElementById('sr-vit-dia').value) || undefined; if (!body.systolic || !body.diastolic) return status('أدخل الانقباضي والانبساطي', false); }
      else { var v = document.getElementById('sr-vit-val').value; if (!v) return status('أدخل القيمة', false); body.valueQuantity = Number(v); }
      try { await api('/vitals', { method: 'POST', body: body }); status('تم حفظ القياس', true); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async addDocument() {
      var fn = document.getElementById('sr-doc-name').value.trim();
      if (!fn) return status('اسم الملف مطلوب', false);
      var body = { filename: fn, fileMimetype: 'application/pdf', fileSizeBytes: 1024, documentCategory: document.getElementById('sr-doc-cat').value, documentDescription: document.getElementById('sr-doc-desc').value.trim() || undefined };
      try { await api('/documents', { method: 'POST', body: body }); status('تم توثيق المستند', true); document.getElementById('sr-doc-form').reset(); this.reload(); }
      catch (e) { status(e.message, false); }
    },
    async export() {
      try { var p = await api('/health-profile'); var blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'my-health-profile.json'; a.click(); }
      catch (e) { status(e.message, false); }
    },
    inject() {
      if (document.getElementById('self-reported-health-card') || !document.getElementById('profile-content')) return;
      var anchor = document.querySelector('#profile-content .card[style*="dashed"]') || document.getElementById('profile-content').lastElementChild;
      var div = document.createElement('div');
      div.innerHTML = ''
        + '<div class="card mb-6" id="self-reported-health-card" style="border:1px solid var(--m3-outline-variant); margin-top:16px;">'
        + '<div class="card-header" style="background:var(--m3-surface-container-high);"><div class="card-header-title"><h3>سجلي الصحي الذاتي — إبلاغ ذاتي غير مؤكد</h3></div><span class="badge badge-warning">UNVERIFIED • PATIENT</span></div>'
        + '<div class="card-body"><p style="font-size:0.8rem;">تُحفظ كبيانات ذاتية وتتطلب تحققاً عبر verification-queue قبل الاعتماد. لا تعدل السجل السريري.</p>'
        + '<div id="sr-status" style="display:none; margin-bottom:12px;"></div>'
        + '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;" class="grid-2">'
        + '<div class="card" style="padding:12px;"><strong>أدويتي</strong><form id="sr-med-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.addMedication();"><input id="sr-med-name" class="form-select" placeholder="اسم الدواء *" required><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><input id="sr-med-dose" class="form-select" placeholder="الجرعة"><input id="sr-med-freq" class="form-select" placeholder="التكرار"></div><label style="font-size:0.75rem;"><input type="checkbox" id="sr-med-taking" checked> ما زلت أتناولها</label><button class="btn btn-primary btn-sm" type="submit">حفظ دواء</button></form><div id="sr-med-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '<div class="card" style="padding:12px;"><strong>حالاتي الصحية</strong><form id="sr-cond-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.addCondition();"><input id="sr-cond-name" class="form-select" placeholder="اسم الحالة *" required><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><input id="sr-cond-date" type="date" class="form-select"><input id="sr-cond-facility" class="form-select" placeholder="المنشأة"></div><button class="btn btn-primary btn-sm" type="submit">حفظ حالة</button></form><div id="sr-cond-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '<div class="card" style="padding:12px;"><strong>عملياتي</strong><form id="sr-proc-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.addProcedure();"><input id="sr-proc-name" class="form-select" placeholder="اسم العملية *" required><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><input id="sr-proc-date" type="date" class="form-select"><input id="sr-proc-facility" class="form-select" placeholder="المستشفى"></div><button class="btn btn-primary btn-sm" type="submit">حفظ عملية</button></form><div id="sr-proc-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '<div class="card" style="padding:12px;"><strong>التاريخ العائلي</strong><form id="sr-fam-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.addFamily();"><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><select id="sr-fam-rel" class="form-select"><option value="MOTHER">الأم</option><option value="FATHER">الأب</option><option value="SIBLING">أخ/أخت</option><option value="CHILD">ابن/ابنة</option><option value="OTHER">أخرى</option></select><input id="sr-fam-cond" class="form-select" placeholder="الحالة *" required></div><button class="btn btn-primary btn-sm" type="submit">حفظ</button></form><div id="sr-fam-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '<div class="card" style="padding:12px;"><strong>التاريخ الاجتماعي</strong><form id="sr-soc-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.saveSocial();"><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><select id="sr-soc-smoke" class="form-select"><option value="">التدخين --</option><option value="NEVER">لم أدخن</option><option value="FORMER">سابق</option><option value="CURRENT">حالي</option></select><select id="sr-soc-activity" class="form-select"><option value="">النشاط --</option><option value="SEDENTARY">خامل</option><option value="MODERATE">متوسط</option><option value="ACTIVE">نشط</option></select></div><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><input id="sr-soc-job" class="form-select" placeholder="المهنة"><input id="sr-soc-sleep" type="number" min="0" max="24" class="form-select" placeholder="ساعات النوم"></div><button class="btn btn-primary btn-sm" type="submit">حفظ</button></form><div id="sr-soc-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '<div class="card" style="padding:12px;"><strong>علاماتي الحيوية</strong><form id="sr-vit-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.addVital();"><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><select id="sr-vit-type" class="form-select"><option value="BLOOD_PRESSURE">ضغط الدم</option><option value="BLOOD_SUGAR">سكر الدم</option><option value="WEIGHT">الوزن</option><option value="HEIGHT">الطول</option><option value="TEMPERATURE">الحرارة</option><option value="HEART_RATE">النبض</option></select><input id="sr-vit-date" type="datetime-local" class="form-select" required></div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;"><input id="sr-vit-sys" type="number" class="form-select" placeholder="انقباضي"><input id="sr-vit-dia" type="number" class="form-select" placeholder="انبساطي"><input id="sr-vit-val" type="number" step="any" class="form-select" placeholder="قيمة"></div><button class="btn btn-primary btn-sm" type="submit">حفظ قياس</button></form><div id="sr-vit-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '<div class="card" style="padding:12px;"><strong>حساسياتي</strong><div id="sr-allergy-list" style="margin-top:8px; font-size:0.82rem;"></div><small>الإضافة من نموذج الحساسية. الحذف متاح هنا.</small></div>'
        + '<div class="card" style="padding:12px;"><strong>مستنداتي</strong><form id="sr-doc-form" style="display:grid; gap:8px; margin-top:8px;" onsubmit="event.preventDefault(); SR.addDocument();"><input id="sr-doc-name" class="form-select" placeholder="report.pdf *" required><div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;"><select id="sr-doc-cat" class="form-select"><option value="LAB_REPORT">مختبر</option><option value="RADIOLOGY">أشعة</option><option value="PRESCRIPTION">وصفة</option><option value="DISCHARGE">خروج</option><option value="OTHER">أخرى</option></select><input id="sr-doc-desc" class="form-select" placeholder="وصف"></div><button class="btn btn-primary btn-sm" type="submit">توثيق</button></form><div id="sr-doc-list" style="margin-top:8px; font-size:0.82rem;"></div></div>'
        + '</div><div style="margin-top:10px; display:flex; gap:8px;"><button class="btn btn-secondary btn-sm" onclick="SR.reload()">تحديث</button><button class="btn btn-secondary btn-sm" onclick="SR.export()">تصدير JSON</button></div>'
        + '</div></div>';
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(div, anchor);
      else document.getElementById('profile-content').appendChild(div);
    }
  };
  function boot() {
    SR.inject();
    if (window.appAuth && appAuth.currentRole === 'PATIENT') SR.reload();
    var orig = window.loadPatientProfileTab;
    if (orig && !orig._srWrapped) {
      var wrapped = function () { var r = orig.apply(this, arguments); Promise.resolve(r).then(function () { SR.inject(); SR.reload(); }); return r; };
      wrapped._srWrapped = true;
      window.loadPatientProfileTab = wrapped;
    }
    setInterval(function () { if (!document.getElementById('self-reported-health-card')) SR.inject(); }, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
