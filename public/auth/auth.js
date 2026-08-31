(() => {
  const $ = (s) => document.querySelector(s);
  const errBox = (id, msg) => {
    const box = document.getElementById(id);
    const txt = document.getElementById(id + '-text');
    if (txt) txt.textContent = msg;
    else if (box) box.textContent = msg;
    if (box) box.style.display = 'flex';
  };
  const hideErr = (id) => { const b=document.getElementById(id); if(b) b.style.display='none'; };

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
      const map={admin:['admin','admin123'],hospital_a:['hospital_a','pass123'],patient:['patient','patient123']};
      const c=map[v]; if(!c) return;
      const u=$('#login-username'), p=$('#login-password');
      if(u) u.value=c[0]; if(p) p.value=c[1];
      $('#login-form')?.requestSubmit();
    });
  });

  const loginForm=$('#login-form');
  if(loginForm){
    loginForm.addEventListener('submit', async (e)=>{
      e.preventDefault(); hideErr('login-error');
      const username=$('#login-username').value.trim();
      const password=$('#login-password').value;
      const btn=$('#btn-login'); if(btn) btn.disabled=true;
      try{
        const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username,password})});
        const d=await r.json();
        if(!r.ok) return errBox('login-error', d.error||'فشل تسجيل الدخول');
        localStorage.setItem('shiep_token', d.token);
        localStorage.setItem('shiep_role', d.user.role);
        localStorage.setItem('shiep_user', JSON.stringify(d.user));
        const next=new URLSearchParams(location.search).get('next')||'/';
        location.replace(next);
      }catch{ errBox('login-error','انقطع الاتصال بالخادم'); }
      finally{ if(btn) btn.disabled=false; }
    });
  }

  const regRole=$('#register-role'), orgGroup=$('#register-org-group'), patientExtra=$('#patient-extra');
  if(regRole){
    const sync=()=>{
      const v=regRole.value;
      if(orgGroup) orgGroup.style.display=v==='HOSPITAL_ADMIN'?'block':'none';
      if(patientExtra) patientExtra.style.display=v==='PATIENT'?'block':'none';
    };
    regRole.addEventListener('change', sync); sync();
  }

  const regForm=$('#register-form');
  if(regForm){
    regForm.addEventListener('submit', async (e)=>{
      e.preventDefault(); hideErr('register-error');
      const payload={
        full_name: $('#register-fullname').value.trim(),
        username: $('#register-username').value.trim(),
        password: $('#register-password').value,
        roleType: $('#register-role').value,
        organization_name: $('#register-org')?.value.trim()||undefined,
        patient_profile: $('#register-role').value==='PATIENT'?{
          preferred_first_name: $('#register-preferred-first-name')?.value||'',
          preferred_last_name: $('#register-preferred-last-name')?.value||'',
          preferred_language: $('#register-preferred-language')?.value||'ar'
        }:undefined
      };
      if(payload.password.length<8) return errBox('register-error','كلمة المرور 8 أحرف على الأقل');
      try{
        const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
        const d=await r.json();
        if(!r.ok) return errBox('register-error', d.error||'فشل إنشاء الحساب');
        localStorage.setItem('shiep_token', d.token);
        localStorage.setItem('shiep_role', d.user.role);
        localStorage.setItem('shiep_user', JSON.stringify(d.user));
        location.replace('/');
      }catch{ errBox('register-error','انقطع الاتصال'); }
    });
  }
})();
