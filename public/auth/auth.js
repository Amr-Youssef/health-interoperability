(() => {
  const $ = (s) => document.querySelector(s);
  const errBox = (msg) => {
    const box = $('#register-error'), txt = $('#register-error-text');
    if (!box) return;
    if (msg) { if (txt) txt.textContent = msg; box.classList.add('show'); box.style.display='flex'; }
    else { box.classList.remove('show'); box.style.display='none'; }
  };
  const showSuccess = (msg) => {
    const b = $('#register-success'); if (!b) return;
    b.textContent = msg; b.style.display='block';
  };
  const setFieldErr = (id, msg) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (msg) { el.textContent = msg; el.classList.add('show'); el.style.display='block'; }
    else { el.textContent=''; el.classList.remove('show'); el.style.display='none'; }
  };
  const markInvalid = (input, isErr) => {
    if (!input) return;
    input.classList.toggle('invalid', !!isErr);
    input.classList.toggle('valid', !isErr && input.value.trim().length>0);
  };

  const existingToken = localStorage.getItem('shiep_token');
  if (existingToken) {
    fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + existingToken }, credentials: 'include' }).then(r=>{
      if(r.ok) location.replace('/');
      else { localStorage.removeItem('shiep_token'); localStorage.removeItem('shiep_role'); localStorage.removeItem('shiep_user'); }
    }).catch(()=>{});
  } else {
    fetch('/api/auth/me', { credentials: 'include' }).then(r=>{ if(r.ok) location.replace('/'); }).catch(()=>{});
  }

  document.querySelectorAll('[data-fill]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v=b.getAttribute('data-fill');
      const map={sys_admin:['admin','admin123'],admin:['admin','admin123'],moh_admin:['moh_admin','moh123456'],moh_auditor:['moh_auditor','auditor123'],hospital_a:['hospital_a','pass123'],clinician:['clinician','clinician123'],patient:['patient','patient123']};
      const c=map[v]; if(!c) return;
      const u=$('#login-username'), p=$('#login-password');
      if(u) u.value=c[0]; if(p) p.value=c[1];
      const form=$('#login-form');
      if(!form) return;
      if(typeof form.requestSubmit==='function') try{ form.requestSubmit(); return; }catch{}
      form.dispatchEvent(new Event('submit', {cancelable:true, bubbles:true}));
    });
  });

  const loginForm=$('#login-form');
  if(loginForm){
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const box=document.getElementById('login-error'), txt=document.getElementById('login-error-text');
      const hide=()=>{ if(box) box.style.display='none'; };
      hide();
      const username=$('#login-username').value.trim();
      const password=$('#login-password').value;
      const btn=$('#btn-login'); if(btn) btn.disabled=true;
      try{
        const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,password})});
        const d=await r.json();
        if(!r.ok){ if(box){box.style.display='flex'; if(txt) txt.textContent=(d.error||'فشل تسجيل الدخول')+(d.stage?' (رمز التشخيص: '+d.stage+')':'');} return; }
        localStorage.setItem('shiep_token', d.token);
        localStorage.setItem('shiep_role', d.user.role);
        localStorage.setItem('shiep_user', JSON.stringify(d.user));
        const next=new URLSearchParams(location.search).get('next')||'/';
        location.replace(next);
      }catch{ if(box){box.style.display='flex'; if(txt) txt.textContent='انقطع الاتصال بالخادم';} }
      finally{ if(btn) btn.disabled=false; }
    });
  }

  // ---------- REGISTER ----------
  const roleCards = document.querySelectorAll('.role-card');
  const roleInput = $('#register-role');
  const patientSec = $('#patient-section');
  const hospitalSec = $('#hospital-section');
  const clinicianSec = $('#clinician-section');
  const stepperSteps = document.querySelectorAll('.step');

  async function loadClinicianOrgs(){
    const sel=$('#register-clinician-org');
    if(!sel) return;
    try{
      const r=await fetch('/api/public/organizations');
      const orgs=await r.json();
      if(Array.isArray(orgs) && orgs.length>0){
        sel.innerHTML = '<option value="">-- اختر المنشأة --</option>' + orgs.map(o=>`<option value="${o.id}">${o.organization_name_ar||o.organization_name} (${o.region}) - ${o.organization_type}</option>`).join('');
      } else sel.innerHTML='<option value="">لا توجد منشآت معتمدة حالياً</option>';
    } catch{ const s=$('#register-clinician-org'); if(s) s.innerHTML='<option value="">فشل تحميل المنشآت</option>'; }
  }

  function setRole(role){
    if (roleInput) roleInput.value = role;
    roleCards.forEach(c=>{
      const is = c.getAttribute('data-role')===role;
      c.classList.toggle('selected', is);
      c.setAttribute('aria-pressed', String(is));
    });
    if(patientSec) patientSec.style.display = role==='PATIENT'?'block':'none';
    if(hospitalSec) hospitalSec.style.display = role==='HOSPITAL_ADMIN'?'block':'none';
    if(clinicianSec) clinicianSec.style.display = role==='CLINICIAN'?'block':'none';
    if(role==='CLINICIAN') loadClinicianOrgs();
    // reset stepper to 2
    syncStepper();
    errBox('');
  }
  roleCards.forEach(c=>{
    c.addEventListener('click', ()=> setRole(c.getAttribute('data-role')));
    c.addEventListener('keydown', (e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setRole(c.getAttribute('data-role')); }});
  });

  function syncStepper(){
    const role = roleInput?.value || 'PATIENT';
    // step 2 active when fields visible, step 3 when submitting/success
    stepperSteps.forEach(s=>{
      const n=Number(s.getAttribute('data-s'));
      s.classList.remove('active','done');
      if(n===1) s.classList.add('done');
      if(n===2) s.classList.add('active');
    });
    const l1=$('#step-line-1'); if(l1) l1.classList.add('done');
  }

  // password toggle
  document.querySelectorAll('.pwd-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=btn.getAttribute('data-toggle');
      const inp=document.getElementById(id);
      if(!inp) return;
      const isPwd = inp.type==='password';
      inp.type = isPwd?'text':'password';
      btn.textContent = isPwd?'إخفاء':'إظهار';
    });
  });

  // validation helpers (mirror backend)
  const isValidNid = (v)=> /^(1|2)\d{9}$/.test(v.trim());
  const normalizePhone = (raw)=>{
    const cleaned = raw.replace(/[\s\-\(\)]/g,'');
    if(/^05\d{8}$/.test(cleaned)) return '+966'+cleaned.substring(1);
    if(/^5\d{8}$/.test(cleaned)) return '+966'+cleaned;
    if(/^9665\d{8}$/.test(cleaned)) return '+'+cleaned;
    if(/^\+9665\d{8}$/.test(cleaned)) return cleaned;
    return null;
  };
  const isValidEmail = (v)=> /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isValidUsername = (v)=> /^[a-zA-Z0-9_\-\.]{3,30}$/.test(v);

  // pwd strength
  const pwdInput = $('#register-password');
  const pwdMeter = $('#pwd-meter');
  const pwdHint = $('#pwd-hint');
  function updatePwdMeter(){
    if(!pwdInput||!pwdMeter) return;
    const v=pwdInput.value;
    let score=0;
    if(v.length>=8) score++;
    if(/[A-Za-z]/.test(v) && /\d/.test(v)) score++;
    if(/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if(/[^A-Za-z0-9]/.test(v)) score++;
    const bars = pwdMeter.querySelectorAll('i');
    bars.forEach((b,i)=>{
      b.className='';
      if(i<score){
        if(score<=1) b.classList.add('filled');
        else if(score===2) b.classList.add('mid');
        else b.classList.add('strong');
      }
    });
    if(pwdHint){
      if(!v) pwdHint.textContent='8 أحرف على الأقل • حرف + رقم';
      else if(score<=1) pwdHint.textContent='ضعيفة جداً';
      else if(score===2) pwdHint.textContent='متوسطة - أضف حرف كبير ورمز';
      else if(score>=3) pwdHint.textContent='قوية ✓';
    }
  }
  pwdInput?.addEventListener('input', updatePwdMeter);

  // inline validations
  const fullnameEl=$('#register-fullname'), usernameEl=$('#register-username'), nidEl=$('#register-nid'), dobEl=$('#register-dob'), phoneEl=$('#register-phone'), emailEl=$('#register-email'), orgEl=$('#register-org'), orgArEl=$('#register-org-ar');
  const hphoneEl=$('#register-hphone'), hemailEl=$('#register-hemail'), regionEl=$('#register-region');
  const clinOrgEl=$('#register-clinician-org'), clinPhoneEl=$('#register-clinician-phone'), clinEmailEl=$('#register-clinician-email');

  function vFullname(){
    const v=fullnameEl?.value.trim()||'';
    if(!v) {setFieldErr('err-fullname','الاسم الكامل مطلوب'); markInvalid(fullnameEl,true); return false;}
    if(v.length<3||v.length>80){setFieldErr('err-fullname','يجب أن يكون بين 3 و 80 حرفاً'); markInvalid(fullnameEl,true); return false;}
    if(v.split(/\s+/).length<2){setFieldErr('err-fullname','يجب إدخال الاسم الأول واسم العائلة'); markInvalid(fullnameEl,true); return false;}
    setFieldErr('err-fullname',''); markInvalid(fullnameEl,false); return true;
  }
  function vUsername(){
    const v=usernameEl?.value.trim()||'';
    if(!v){setFieldErr('err-username','اسم المستخدم مطلوب'); markInvalid(usernameEl,true); return false;}
    if(v.length<3||v.length>30){setFieldErr('err-username','يجب أن يكون بين 3 و 30 حرفاً'); markInvalid(usernameEl,true); return false;}
    if(!isValidUsername(v)){setFieldErr('err-username','أحرف إنجليزية وأرقام و _ - . فقط'); markInvalid(usernameEl,true); return false;}
    setFieldErr('err-username',''); markInvalid(usernameEl,false); return true;
  }
  function vPassword(){
    const v=pwdInput?.value||'';
    if(v.length<8){setFieldErr('err-password','كلمة المرور 8 أحرف على الأقل'); markInvalid(pwdInput,true); return false;}
    if(!/[A-Za-z]/.test(v)||!/\d/.test(v)){setFieldErr('err-password','يجب أن تحتوي على حروف وأرقام'); markInvalid(pwdInput,true); return false;}
    setFieldErr('err-password',''); markInvalid(pwdInput,false); return true;
  }
  function vPassword2(){
    const a=pwdInput?.value||'', b=$('#register-password2')?.value||'';
    const okEl=$('#ok-password2');
    if(a!==b){setFieldErr('err-password2','كلمتا المرور غير متطابقتين'); if(okEl) okEl.classList.remove('show'); markInvalid($('#register-password2'),true); return false;}
    if(!b){setFieldErr('err-password2','تأكيد كلمة المرور مطلوب'); markInvalid($('#register-password2'),true); return false;}
    setFieldErr('err-password2',''); if(okEl) okEl.classList.add('show'); markInvalid($('#register-password2'),false); return true;
  }
  function vNid(){
    const v=nidEl?.value.trim()||'';
    const hint=$('#nid-hint'), ok=$('#ok-nid');
    if(!v){setFieldErr('err-nid','رقم الهوية مطلوب (10 أرقام)'); if(ok) ok.classList.remove('show'); markInvalid(nidEl,true); return false;}
    if(!isValidNid(v)){setFieldErr('err-nid','يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2'); if(ok) ok.classList.remove('show'); markInvalid(nidEl,true); return false;}
    setFieldErr('err-nid',''); markInvalid(nidEl,false);
    if(ok){ ok.textContent = v.startsWith('1')?'✓ هوية وطنية':'✓ هوية مقيم'; ok.classList.add('show'); }
    if(hint) hint.textContent = v.startsWith('1')?'نوع: هوية وطنية (NID)':'نوع: إقامة (IQAMA)';
    return true;
  }
  function vDob(){
    const v=dobEl?.value||'';
    if(!v){setFieldErr('err-dob','تاريخ الميلاد مطلوب'); markInvalid(dobEl,true); return false;}
    const d=new Date(v); const now=new Date();
    if(isNaN(d.getTime())){setFieldErr('err-dob','تاريخ غير صالح'); markInvalid(dobEl,true); return false;}
    if(d>now){setFieldErr('err-dob','لا يمكن أن يكون في المستقبل'); markInvalid(dobEl,true); return false;}
    if(d<new Date('1900-01-01')){setFieldErr('err-dob','تاريخ غير واقعي (قبل 1900)'); markInvalid(dobEl,true); return false;}
    const age = now.getFullYear()-d.getFullYear();
    if(age<0||age>120){setFieldErr('err-dob','العمر يجب أن يكون 0-120'); markInvalid(dobEl,true); return false;}
    setFieldErr('err-dob',''); markInvalid(dobEl,false); return true;
  }
  function vPhoneGeneric(el, errId, okId){
    const v=el?.value.trim()||'';
    if(!v){setFieldErr(errId,'رقم الجوال مطلوب'); markInvalid(el,true); return false;}
    const norm=normalizePhone(v);
    if(!norm){setFieldErr(errId,'صيغة غير صحيحة: 05xxxxxxxx أو +9665xxxxxxxx'); markInvalid(el,true); return false;}
    setFieldErr(errId,''); markInvalid(el,false);
    const ok=document.getElementById(okId); if(ok){ ok.textContent='✓ '+norm; ok.classList.add('show'); ok.style.display='block'; }
    return true;
  }
  function vEmailOptional(el, errId){
    const v=el?.value.trim()||'';
    if(!v){setFieldErr(errId,''); markInvalid(el,false); return true;}
    if(!isValidEmail(v)){setFieldErr(errId,'صيغة البريد غير صحيحة'); markInvalid(el,true); return false;}
    setFieldErr(errId,''); markInvalid(el,false); return true;
  }
  function vOrg(){
    const v=orgEl?.value.trim()||'';
    if(!v){setFieldErr('err-org','اسم المنشأة بالإنجليزية مطلوب'); markInvalid(orgEl,true); return false;}
    if(v.length<3||v.length>120){setFieldErr('err-org','3-120 حرف'); markInvalid(orgEl,true); return false;}
    setFieldErr('err-org',''); markInvalid(orgEl,false); return true;
  }
  function vOrgAr(){
    const v=orgArEl?.value.trim()||'';
    if(!v){setFieldErr('err-org-ar','اسم المنشأة بالعربية مطلوب'); markInvalid(orgArEl,true); return false;}
    if(v.length<3||v.length>120){setFieldErr('err-org-ar','3-120 حرف'); markInvalid(orgArEl,true); return false;}
    if(!/[\u0600-\u06FF]/.test(v)){setFieldErr('err-org-ar','يجب أن يحتوي على حروف عربية'); markInvalid(orgArEl,true); return false;}
    setFieldErr('err-org-ar',''); markInvalid(orgArEl,false); return true;
  }

  // bind blur
  fullnameEl?.addEventListener('blur', vFullname); usernameEl?.addEventListener('blur', vUsername);
  pwdInput?.addEventListener('blur', vPassword); $('#register-password2')?.addEventListener('input', vPassword2);
  nidEl?.addEventListener('blur', vNid); nidEl?.addEventListener('input', ()=>{ if(nidEl.value.length===10) vNid(); });
  dobEl?.addEventListener('change', vDob);
  phoneEl?.addEventListener('blur', ()=>vPhoneGeneric(phoneEl,'err-phone','ok-phone'));
  emailEl?.addEventListener('blur', ()=>vEmailOptional(emailEl,'err-email'));
  orgEl?.addEventListener('blur', vOrg); orgArEl?.addEventListener('blur', vOrgAr);
  hphoneEl?.addEventListener('blur', ()=>vPhoneGeneric(hphoneEl,'err-hphone','ok-phone'));
  hemailEl?.addEventListener('blur', ()=>{
    const v=hemailEl.value.trim();
    if(!v){setFieldErr('err-hemail','البريد الرسمي مطلوب'); markInvalid(hemailEl,true); return;}
    if(!isValidEmail(v)){setFieldErr('err-hemail','صيغة البريد غير صحيحة'); markInvalid(hemailEl,true); return;}
    setFieldErr('err-hemail',''); markInvalid(hemailEl,false);
  });
  regionEl?.addEventListener('change', ()=>{
    if(!regionEl.value) setFieldErr('err-region','المنطقة مطلوبة');
    else setFieldErr('err-region','');
  });
  // emergency phone
  $('#register-emergency-phone')?.addEventListener('blur', ()=>{
    const v=$('#register-emergency-phone').value.trim();
    if(!v){ setFieldErr('err-emergency-phone',''); return;}
    if(!normalizePhone(v)){ setFieldErr('err-emergency-phone','رقم غير صحيح'); } else setFieldErr('err-emergency-phone','');
  });
  $('#register-postal')?.addEventListener('blur', ()=>{
    const v=$('#register-postal').value.trim();
    if(!v){ setFieldErr('err-postal',''); return;}
    if(!/^\d{5}$/.test(v)) setFieldErr('err-postal','يجب أن يكون 5 أرقام');
    else setFieldErr('err-postal','');
  });

  // gender pills
  document.querySelectorAll('.radio-pill').forEach(p=>{
    p.addEventListener('click', ()=>{
      const inp=p.querySelector('input'); if(inp) inp.checked=true;
      document.querySelectorAll('.radio-pill').forEach(x=>x.classList.remove('selected'));
      p.classList.add('selected');
      setFieldErr('err-gender','');
    });
  });

  // dob max
  if(dobEl){ dobEl.max = new Date().toISOString().split('T')[0]; dobEl.min='1900-01-01'; }

  const regForm=$('#register-form');
  if(regForm){
    regForm.addEventListener('submit', async (e)=>{
      e.preventDefault(); errBox('');
      const role = roleInput?.value || 'PATIENT';
      let valid = true;
      if(!vFullname()) valid=false;
      if(!vUsername()) valid=false;
      if(!vPassword()) valid=false;
      if(!vPassword2()) valid=false;

      let payload = {
        full_name: fullnameEl.value.trim(),
        username: usernameEl.value.trim(),
        password: pwdInput.value,
        roleType: role
      };

      if(role==='PATIENT'){
        const genderEl = document.querySelector('input[name="gender"]:checked');
        const genderVal = genderEl?genderEl.value:'';
        if(!vNid()) valid=false;
        if(!vDob()) valid=false;
        if(!genderVal){ setFieldErr('err-gender','الجنس مطلوب'); valid=false; }
        if(!vPhoneGeneric(phoneEl,'err-phone','ok-phone')) valid=false;
        if(!vEmailOptional(emailEl,'err-email')) valid=false;
        // emergency postal validation optional already
        if(!valid){ errBox('يرجى تصحيح الحقول المميزة أعلاه'); return; }
        const phoneNorm = normalizePhone(phoneEl.value.trim());
        const emailNorm = emailEl.value.trim()||undefined;
        payload.nationalId = nidEl.value.trim();
        payload.birthDate = dobEl.value;
        payload.gender = genderVal;
        payload.phone = phoneNorm;
        if(emailNorm) payload.email = emailNorm;
        // patient_profile
        const ep = $('#register-emergency-phone')?.value.trim();
        let epNorm = ep ? (normalizePhone(ep)||ep) : undefined;
        const postal = $('#register-postal')?.value.trim();
        const postalValid = postal && /^\d{5}$/.test(postal) ? postal : undefined;
        payload.patient_profile = {
          preferred_first_name: $('#register-preferred-first-name')?.value.trim()||'',
          preferred_last_name: $('#register-preferred-last-name')?.value.trim()||'',
          preferred_language: $('#register-preferred-language')?.value||'ar',
          emergency_contact_name: $('#register-emergency-name')?.value.trim()||null,
          emergency_contact_phone: epNorm||null,
          emergency_contact_relationship: $('#register-emergency-rel')?.value||null,
          address_line: $('#register-address')?.value.trim()||null,
          address_city: $('#register-city')?.value.trim()||null,
          address_district: $('#register-district')?.value.trim()||null,
          address_postal_code: postalValid||null
        };
      } else if(role==='HOSPITAL_ADMIN') {
        if(!vOrg()) valid=false;
        if(!vOrgAr()) valid=false;
        const regionVal = regionEl?.value||'';
        if(!regionVal){ setFieldErr('err-region','المنطقة مطلوبة'); valid=false; } else setFieldErr('err-region','');
        if(!vPhoneGeneric(hphoneEl,'err-hphone','ok-phone')) valid=false;
        const hemailVal = hemailEl?.value.trim()||'';
        if(!hemailVal){ setFieldErr('err-hemail','البريد الرسمي مطلوب'); valid=false; }
        else if(!isValidEmail(hemailVal)){ setFieldErr('err-hemail','صيغة البريد غير صحيحة'); valid=false; } else setFieldErr('err-hemail','');
        if(!valid){ errBox('يرجى تصحيح حقول المنشأة المميزة'); return; }
        payload.organization_name = orgEl.value.trim();
        payload.organization_name_ar = orgArEl.value.trim();
        payload.region = regionVal;
        payload.facility_type = $('#register-facility-type')?.value||'HOSPITAL';
        payload.phone = normalizePhone(hphoneEl.value.trim());
        payload.email = hemailVal.toLowerCase();
      } else if(role==='CLINICIAN') {
        const orgId = clinOrgEl?.value||'';
        if(!orgId){ setFieldErr('err-clinician-org','يجب اختيار المنشأة'); valid=false; } else setFieldErr('err-clinician-org','');
        if(!vPhoneGeneric(clinPhoneEl,'err-clinician-phone','ok-phone')) valid=false;
        if(!vEmailOptional(clinEmailEl,'err-clinician-email')) valid=false;
        if(!valid){ errBox('يرجى تصحيح حقول الطبيب المميزة'); return; }
        payload.organization_id = orgId;
        payload.phone = normalizePhone(clinPhoneEl.value.trim());
        const ce = clinEmailEl?.value.trim(); if(ce) payload.email = ce.toLowerCase();
      }

      const btn=$('#btn-register');
      if(btn){ btn.disabled=true; btn.innerHTML='<span>جاري الإنشاء...</span>'; }
      try{
        const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
        const d=await r.json();
        if(!r.ok){
          const msg = d.error||'فشل إنشاء الحساب';
          errBox(msg);
          // map to fields
          if(msg.includes('اسم المستخدم')) { setFieldErr('err-username',msg); markInvalid(usernameEl,true); }
          if(msg.includes('البريد')) { setFieldErr('err-email',msg); setFieldErr('err-hemail',msg); }
          if(msg.includes('الهوية')) { setFieldErr('err-nid',msg); markInvalid(nidEl,true); }
          if(msg.includes('الجوال')||msg.includes('جوال')) { setFieldErr('err-phone',msg); setFieldErr('err-hphone',msg); }
          if(msg.includes('المنشأة')) { setFieldErr('err-org',msg); setFieldErr('err-org-ar',msg); }
          return;
        }
        localStorage.setItem('shiep_token', d.token);
        localStorage.setItem('shiep_role', d.user.role);
        localStorage.setItem('shiep_user', JSON.stringify(d.user));
        // stepper done
        stepperSteps.forEach(s=>{ s.classList.remove('active'); s.classList.add('done'); });
        document.querySelectorAll('.stepper-line').forEach(l=>l.classList.add('done'));
        showSuccess(role==='HOSPITAL_ADMIN' ? '✓ تم إنشاء حساب المنشأة بنجاح - بانتظار موافقة الوزارة' : '✓ تم إنشاء حسابك بنجاح');
        setTimeout(()=> location.replace('/'), 900);
      }catch{
        errBox('انقطع الاتصال بالخادم');
      } finally {
        if(btn){ btn.disabled=false; btn.innerHTML='<span>إنشاء الحساب والمتابعة للمنصة</span>'; }
      }
    });
  }
})();
