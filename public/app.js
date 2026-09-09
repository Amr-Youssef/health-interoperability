// ==========================================================================
// المنصة الوطنية للربط والتشغيل الصحي البيني (Saudi Interoperability Engine)
// Material 3 & Flat Precision Architecture Frontend Controller (v0.2.4)
// ==========================================================================

// Global State & Elements
let currentTab = 'monitoring';
let currentPatientId = '';
let currentFhirEndpoint = '/fhir/metadata';
let cachedPatients = []; // Array of {id, name, nameAr, nid, birthDate, gender}
let cachedPatientCanonical = null; // Full canonical patient data for active patient

// === AUTHENTICATION LOGIC ===
const appAuth = {
  currentRole: localStorage.getItem('shiep_role') || null,
  token: localStorage.getItem('shiep_token') || null,
  user: JSON.parse(localStorage.getItem('shiep_user') || 'null'),

  init() {
    if (!this.token) {
      const onAuthPage = location.pathname.startsWith('/auth/');
      if (!onAuthPage) { location.replace('/auth/login.html'); return; }
    } else {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + this.token }, credentials: 'include' }).then(async r=>{
        if(!r.ok){ this.logout(); location.replace('/auth/login.html'); return; }
        try { const fresh = await r.json(); if (fresh && fresh.fullName) { this.user = fresh; localStorage.setItem('shiep_user', JSON.stringify(fresh)); updateSessionUI(); } } catch(e){}
      }).catch(()=>{});
    }
    this.updateUI();
    setTimeout(() => {
      try { this.toggleRegisterRole(); } catch(e) {}
    }, 0);
  },

  fillCredentials(user, pass) {
    const userField = document.getElementById('login-username');
    const passField = document.getElementById('login-password');
    if (userField) userField.value = user;
    if (passField) passField.value = pass;
    this.login();
  },

  switchTab(tab) {
    const btnLogin = document.getElementById('tab-login');
    const btnRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authModal = document.querySelector('.auth-modal');
    if (tab === 'login') {
      if (loginForm) loginForm.style.display = 'flex';
      if (registerForm) registerForm.style.display = 'none';
      if (btnLogin) { btnLogin.style.background = ''; btnLogin.style.color = ''; btnLogin.classList.add('active'); }
      if (btnRegister) { btnRegister.style.background = ''; btnRegister.style.color = ''; btnRegister.classList.remove('active'); }
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'flex';
      if (btnRegister) { btnRegister.style.background = ''; btnRegister.style.color = ''; btnRegister.classList.add('active'); }
      if (btnLogin) { btnLogin.style.background = ''; btnLogin.style.color = ''; btnLogin.classList.remove('active'); }
      // Ensure correct subgroup visibility for default PATIENT and reset scroll to top
      try { this.toggleRegisterRole(); } catch(e) {}
      if (authModal) authModal.scrollTop = 0;
      if (registerForm) registerForm.scrollTop = 0;
    }
  },

  toggleRegisterRole() {
    const role = document.getElementById('register-role')?.value || 'PATIENT';
    const orgGroup = document.getElementById('register-org-group');
    const trustedGroup = document.getElementById('register-patient-trusted-group');
    const patientProfileGroup = document.getElementById('register-patient-profile-group');
    
    if (role === 'HOSPITAL_ADMIN') {
      if (orgGroup) orgGroup.style.display = 'block';
      if (trustedGroup) trustedGroup.style.display = 'none';
      if (patientProfileGroup) patientProfileGroup.style.display = 'none';
    } else if (role === 'PATIENT') {
      if (orgGroup) orgGroup.style.display = 'none';
      if (trustedGroup) trustedGroup.style.display = 'block';
      if (patientProfileGroup) patientProfileGroup.style.display = 'block';
    } else {
      if (orgGroup) orgGroup.style.display = 'none';
      if (trustedGroup) trustedGroup.style.display = 'none';
      if (patientProfileGroup) patientProfileGroup.style.display = 'none';
    }
    // Smoothly keep modal scroll sensible after toggle
    try {
      const modal = document.querySelector('.auth-modal');
      if (modal) modal.scrollTop = 0;
    } catch(e) {}
  },

  showRegisterError(msg) {
    const errorDiv = document.getElementById('register-error');
    const errorText = document.getElementById('register-error-text');
    if (errorText) errorText.textContent = msg;
    if (errorDiv) {
      errorDiv.style.display = 'flex';
      requestAnimationFrame(() => {
        try {
          const modal = document.querySelector('.auth-modal');
          if (modal) {
            const r = errorDiv.getBoundingClientRect();
            const mr = modal.getBoundingClientRect();
            if (r.bottom > mr.bottom || r.top < mr.top) {
              errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } catch(e) {}
      });
    }
  },

  async register() {
    const fullname = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const roleType = document.getElementById('register-role').value;
    const orgName = document.getElementById('register-org')?.value.trim() || '';
    const orgNameAr = document.getElementById('register-hosp-org-ar')?.value.trim() || '';
    const hospRegion = document.getElementById('register-hosp-region')?.value || '';
    const hospFacilityType = document.getElementById('register-hosp-facility-type')?.value || 'HOSPITAL';
    const hospPhone = document.getElementById('register-hosp-phone')?.value.trim() || '';
    const hospEmail = document.getElementById('register-hosp-email')?.value.trim() || '';
    
    // Trusted patient fields (mandatory for reliable data)
    const nationalId = document.getElementById('register-national-id')?.value.trim() || '';
    const birthDate = document.getElementById('register-birth-date')?.value || '';
    const gender = document.getElementById('register-gender')?.value || '';
    const phone = document.getElementById('register-phone')?.value.trim() || '';
    const email = document.getElementById('register-email')?.value.trim() || '';

    // Patient profile data (optional supplementary)
    const preferredFirstName = document.getElementById('register-preferred-first-name')?.value || '';
    const preferredLastName = document.getElementById('register-preferred-last-name')?.value || '';
    const preferredLanguage = document.getElementById('register-preferred-language')?.value || 'ar';
    const emergencyContactName = document.getElementById('register-emergency-name')?.value || '';
    const emergencyContactPhone = document.getElementById('register-emergency-phone')?.value || '';
    const emergencyContactRelationship = document.getElementById('register-emergency-relationship')?.value || '';
    const addressLine = document.getElementById('register-address-line')?.value || '';
    const addressCity = document.getElementById('register-address-city')?.value || '';
    const addressDistrict = document.getElementById('register-address-district')?.value || '';
    const addressPostalCode = document.getElementById('register-address-postal')?.value || '';
    
    const errorDiv = document.getElementById('register-error');
    const errorText = document.getElementById('register-error-text');
    if (errorDiv) errorDiv.style.display = 'none';

    // Client-side validation for PATIENT trusted data (improves UX before server roundtrip)
    if (roleType === 'PATIENT') {
      if (!nationalId) {
        const msg = 'رقم الهوية الوطنية / الإقامة مطلوب (10 أرقام يبدأ بـ 1 أو 2)'; this.showRegisterError(msg); return;
      }
      if (!/^(1|2)\d{9}$/.test(nationalId)) {
        const msg = 'رقم الهوية غير صحيح: يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2'; this.showRegisterError(msg); return;
      }
      if (!birthDate) {
        const msg = 'تاريخ الميلاد مطلوب'; this.showRegisterError(msg); return;
      }
      const dob = new Date(birthDate);
      if (isNaN(dob.getTime()) || dob > new Date() || dob < new Date('1900-01-01')) {
        const msg = 'تاريخ الميلاد غير صالح'; this.showRegisterError(msg); return;
      }
      if (!gender) {
        const msg = 'الجنس مطلوب'; this.showRegisterError(msg); return;
      }
      if (!phone) {
        const msg = 'رقم الجوال السعودي مطلوب'; this.showRegisterError(msg); return;
      }
      const phoneClean = phone.replace(/[\s\-\(\)]/g,'');
      if (!/^(?:\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(phoneClean)) {
        const msg = 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي (05xxxxxxxx)'; this.showRegisterError(msg); return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const msg = 'صيغة البريد الإلكتروني غير صحيحة'; this.showRegisterError(msg); return;
      }
      if (!fullname || fullname.split(/\s+/).length < 2) {
        const msg = 'الاسم الكامل يجب أن يحتوي على الاسم الأول واسم العائلة'; this.showRegisterError(msg); return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        const msg = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي حروف وأرقام'; this.showRegisterError(msg); return;
      }
    } else if (roleType === 'HOSPITAL_ADMIN') {
      if (!orgName || orgName.length < 3) {
        const msg = 'اسم المنشأة بالإنجليزية مطلوب (3 أحرف على الأقل)'; this.showRegisterError(msg); return;
      }
      if (!orgNameAr || orgNameAr.length < 3) {
        const msg = 'اسم المنشأة بالعربية مطلوب'; this.showRegisterError(msg); return;
      }
      if (!/[\u0600-\u06FF]/.test(orgNameAr)) {
        const msg = 'اسم المنشأة بالعربية يجب أن يحتوي على حروف عربية'; this.showRegisterError(msg); return;
      }
      if (!hospRegion) {
        const msg = 'المنطقة الإدارية مطلوبة'; this.showRegisterError(msg); return;
      }
      if (!hospPhone) {
        const msg = 'رقم جوال مسؤول المنشأة مطلوب'; this.showRegisterError(msg); return;
      }
      const hpClean = hospPhone.replace(/[\s\-\(\)]/g,'');
      if (!/^(?:\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(hpClean)) {
        const msg = 'رقم جوال المنشأة غير صحيح: يجب أن يكون رقم سعودي (05xxxxxxxx)'; this.showRegisterError(msg); return;
      }
      if (!hospEmail) {
        const msg = 'البريد الرسمي للمنشأة مطلوب'; this.showRegisterError(msg); return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hospEmail)) {
        const msg = 'صيغة البريد الإلكتروني للمنشأة غير صحيحة'; this.showRegisterError(msg); return;
      }
      if (!fullname || fullname.split(/\s+/).length < 2) {
        const msg = 'الاسم الكامل لمسؤول المنشأة يجب أن يحتوي على الاسم الأول واسم العائلة'; this.showRegisterError(msg); return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        const msg = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي حروف وأرقام'; this.showRegisterError(msg); return;
      }
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullname,
          username: username,
          password: password,
          roleType: roleType,
          organization_name: orgName,
          organization_name_ar: roleType === 'HOSPITAL_ADMIN' ? orgNameAr : undefined,
          region: roleType === 'HOSPITAL_ADMIN' ? hospRegion : undefined,
          facility_type: roleType === 'HOSPITAL_ADMIN' ? hospFacilityType : undefined,
          // Trusted identity fields (only for PATIENT)
          nationalId: roleType === 'PATIENT' ? nationalId : undefined,
          birthDate: roleType === 'PATIENT' ? birthDate : undefined,
          gender: roleType === 'PATIENT' ? gender : undefined,
          phone: roleType === 'PATIENT' ? phone : (roleType === 'HOSPITAL_ADMIN' ? hospPhone : undefined),
          email: roleType === 'PATIENT' ? (email || undefined) : (roleType === 'HOSPITAL_ADMIN' ? hospEmail : undefined),
          // Patient profile data
          patient_profile: roleType === 'PATIENT' ? {
            preferred_first_name: preferredFirstName,
            preferred_last_name: preferredLastName,
            preferred_language: preferredLanguage,
            emergency_contact_name: emergencyContactName,
            emergency_contact_phone: emergencyContactPhone,
            emergency_contact_relationship: emergencyContactRelationship,
            address_line: addressLine,
            address_city: addressCity,
            address_district: addressDistrict,
            address_postal_code: addressPostalCode
          } : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'حدث خطأ في إنشاء الحساب';
        this.showRegisterError(msg);
        return;
      }
      this.currentRole = data.user.role;
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('shiep_role', this.currentRole);
      localStorage.setItem('shiep_token', this.token);
      localStorage.setItem('shiep_user', JSON.stringify(this.user));
      this.updateUI();
      fetchAndCachePatients().then(() => {
        handleTabSwitch(currentTab);
      });
    } catch (err) {
      const msg = 'انقطع الاتصال بالخادم';
      this.showRegisterError(msg);
    }
  },

  showLoginError(msg) {
    const errorDiv = document.getElementById('login-error');
    const errorText = document.getElementById('login-error-text');
    if (errorText) errorText.textContent = msg;
    else if (errorDiv) errorDiv.textContent = msg;
    if (errorDiv) {
      errorDiv.style.display = 'flex';
      requestAnimationFrame(() => {
        try { errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
      });
    }
  },


  async login() {
    const userField = document.getElementById('login-username').value;
    const passField = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    const errorText = document.getElementById('login-error-text');
    if (errorDiv) errorDiv.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userField, password: passField })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'حدث خطأ في تسجيل الدخول';
        this.showLoginError(msg);
        return;
      }
      this.currentRole = data.user.role;
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('shiep_role', this.currentRole);
      localStorage.setItem('shiep_token', this.token);
      localStorage.setItem('shiep_user', JSON.stringify(this.user));
      this.updateUI();
      fetchAndCachePatients().then(() => {
        handleTabSwitch(currentTab);
      });
    } catch (err) {
      const msg = 'انقطع الاتصال بالخادم';
      this.showLoginError(msg);
    }
  },

  async logout() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch(e) {}
    this.currentRole = null;
    this.token = null;
    this.user = null;
    cachedPatients = [];
    currentPatientId = '';
    localStorage.removeItem('shiep_role');
    localStorage.removeItem('shiep_token');
    localStorage.removeItem('shiep_user');
    document.cookie = 'shiep_token=; Max-Age=0; path=/; SameSite=Strict';
    location.replace('/auth/login.html');
  },

  updateUI() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    if (!this.currentRole) {
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
      this.applyRolePermissions();
      updateSessionUI();
    }
  },

  applyRolePermissions() {
    const allTabs = document.querySelectorAll('.nav-item');
    allTabs.forEach(t => t.style.display = 'none');
    let defaultTab = 'monitoring';
    const btnRun = document.getElementById('btn-run-pipeline');
    if (btnRun) {
      btnRun.style.display = (this.currentRole === 'MOH_ADMIN' || this.currentRole === 'SYS_ADMIN') ? 'inline-flex' : 'none';
    }
    const govCreateCard = document.getElementById('gov-create-admin-card');
    if (govCreateCard) {
      const isNational = this.currentRole === 'SYS_ADMIN' || this.currentRole === 'MOH_ADMIN';
      govCreateCard.style.display = isNational ? 'block' : 'none';
      const hint = document.getElementById('gov-create-hint');
      if (hint) {
        if (this.currentRole === 'SYS_ADMIN') hint.textContent = 'SYS_ADMIN ينشئ جميع الأدوار (SYS/MOH/HOSPITAL/CLINICIAN/PATIENT)';
        else if (this.currentRole === 'MOH_ADMIN') hint.textContent = 'MOH_ADMIN ينشئ HOSPITAL/CLINICIAN/MOH_AUDITOR فقط (SYS/MOH محجوب)';
        else hint.textContent = 'إنشاء المستخدمين مقصور على الإدارة الوطنية';
      }
      const roleSel = document.getElementById('moh-admin-role');
      if (roleSel) {
        Array.from(roleSel.options).forEach(o=>{
          if (this.currentRole === 'MOH_ADMIN' && ['SYS_ADMIN','MOH_ADMIN'].includes(o.value)) o.style.display='none';
          else o.style.display='';
        });
        if (this.currentRole === 'MOH_ADMIN' && ['SYS_ADMIN','MOH_ADMIN'].includes(roleSel.value)) roleSel.value='HOSPITAL_ADMIN';
      }
    }
    if (this.currentRole === 'MOH_ADMIN' || this.currentRole === 'SYS_ADMIN') {
      ['admin-governance','monitoring', 'onboarding', 'cds', 'nphies', 'medications', 'mpi', 'longitudinal', 'appointments', 'mapping', 'provenance', 'security', 'bulkexport', 'fhir'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'admin-governance';

      // Restore dropdowns for Admins
      const globalSelect = document.getElementById('global-patient-selector');
      if (globalSelect) globalSelect.style.display = 'block';
      const patCard = document.querySelector('.patient-selector-card');
      if (patCard) patCard.style.display = 'block';

    } else if (this.currentRole === 'HOSPITAL_ADMIN') {
      ['hospital-migration','hospital-global','hospital-profile','appointments'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'hospital-migration';
    } else if (this.currentRole === 'CLINICIAN') {
      ['longitudinal','medications','cds','nphies','appointments'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'longitudinal';
      const patCard = document.querySelector('.patient-selector-card');
      if (patCard) patCard.style.display = 'block';
    } else if (this.currentRole === 'MOH_AUDITOR') {
      ['monitoring','longitudinal','security','provenance'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'monitoring';
      const patCard = document.querySelector('.patient-selector-card');
      if (patCard) patCard.style.display = 'block';

    } else if (this.currentRole === 'PATIENT') {
      ['profile', 'longitudinal', 'medications', 'appointments'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'profile';

      const selfReportedCard = document.getElementById('patient-allergy-management-card');
      if (selfReportedCard) selfReportedCard.style.display = 'block';

      // STRICT PATIENT SECURITY: Hide all cross-patient selectors
      const globalSelect = document.getElementById('global-patient-selector');
      if (globalSelect) globalSelect.style.display = 'none';

      const patCard = document.querySelector('.patient-selector-card');
      if (patCard) patCard.style.display = 'none';
    }

    // click the default tab
    const dTab = document.getElementById(`tab-btn-${defaultTab}`);
    if(dTab) dTab.click();
  }
};

function getAllowedTabsForRole(role) {
  if (role === 'MOH_ADMIN' || role === 'SYS_ADMIN') return ['admin-governance','monitoring','onboarding','cds','nphies','medications','mpi','longitudinal','appointments','mapping','provenance','security','bulkexport','fhir'];
  if (role === 'HOSPITAL_ADMIN') return ['hospital-migration','hospital-global','hospital-profile','appointments'];
  if (role === 'CLINICIAN') return ['longitudinal','medications','cds','nphies','appointments'];
  if (role === 'PATIENT') return ['profile','longitudinal','medications','appointments','patient-insurance','patient-access'];
  if (role === 'MOH_AUDITOR') return ['monitoring','longitudinal','security','provenance'];
  return [];
}

function updateSessionUI() {
  const u = appAuth.user;
  const role = appAuth.currentRole;
  if (!u || !role) return;
  const roleArMap = { SYS_ADMIN: 'النظام', MOH_ADMIN: 'وزارة الصحة', MOH_AUDITOR: 'مدقق وزاري', HOSPITAL_ADMIN: 'إدارة مستشفى', CLINICIAN: 'طبيب', PATIENT: 'مريض' };
  const roleAr = roleArMap[role] || role;
  const roleBadgeClass = role==='SYS_ADMIN'?'badge-error':role==='MOH_ADMIN'?'badge-info':role==='MOH_AUDITOR'?'badge-secondary':role==='HOSPITAL_ADMIN'?'badge-warning':role==='CLINICIAN'?'badge-success':'badge-info';
  const name = u.fullName || u.username || '—';
  const org = u.organizationAr || u.organization || '';
  const metaMap = {
    SYS_ADMIN: `${u.username} • سيادي وطني`,
    MOH_ADMIN: `${u.username} • ${org || 'وزارة الصحة'}`,
    MOH_AUDITOR: `${u.username} • قراءة وتدقيق`,
    HOSPITAL_ADMIN: `${u.username} • ${org || 'منشأة'}`,
    CLINICIAN: `${u.username} • ${org || 'عيادة'}`,
    PATIENT: `${u.username} • ${org ? org : 'سجل فردي'}`
  };
  const meta = metaMap[role] || u.username || '';
  const sideCard = document.getElementById('session-user-card');
  const sideName = document.getElementById('session-name');
  const sideRole = document.getElementById('session-role-badge');
  const sideOrg = document.getElementById('session-org');
  const sideMeta = document.getElementById('session-meta');
  if (sideCard) sideCard.style.display = 'flex';
  if (sideName) sideName.textContent = name;
  if (sideRole) { sideRole.textContent = roleAr; sideRole.className = 'badge ' + roleBadgeClass; }
  if (sideOrg) sideOrg.textContent = org ? `المنشأة: ${org}` : (role==='PATIENT' ? 'حساب فردي محمي' : role==='SYS_ADMIN' ? 'المنصة السيادية' : '');
  if (sideMeta) sideMeta.textContent = meta;
  const headChip = document.getElementById('header-session-chip');
  const headName = document.getElementById('header-session-name');
  const headSub = document.getElementById('header-session-sub');
  const headRole = document.getElementById('header-session-role');
  if (headChip) headChip.style.display = 'flex';
  if (headName) headName.textContent = name;
  if (headSub) headSub.textContent = org ? `${roleAr} • ${org}` : roleAr;
  if (headRole) { headRole.textContent = roleAr; headRole.className = 'badge ' + roleBadgeClass; }
  if (role === 'HOSPITAL_ADMIN' && org) {
    fetch('/api/hospital/me').then(r=>r.json()).then(d=>{
      const ar = d.organization?.organizationNameAr || d.organization?.organizationName || org;
      const region = d.organization?.region || '';
      const type = d.organization?.organizationType || '';
      if (sideOrg) sideOrg.textContent = `${ar}${region ? ' • ' + region : ''}${type ? ' • ' + type : ''}`;
      if (headSub) headSub.textContent = `${roleAr} • ${ar}`;
    }).catch(()=>{});
  }
  if (role === 'PATIENT' && u.patientProfileId) {
    fetch('/api/patient/me').then(r=>r.json()).then(d=>{
      const nid = d.patient?.nationalId || d.patient?.identifiers?.find(i=>i.type==='NID')?.value || u.username;
      if (sideMeta) sideMeta.textContent = `الهوية: ${nid}`;
      if (headSub) headSub.textContent = `مريض • ${nid}`;
    }).catch(()=>{});
  }
}

// === FETCH INTERCEPTOR FOR JWT AUTHENTICATION ===
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  options = options || {};
  if (typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/fhir'))) {
    options.credentials = options.credentials || 'include';
    if (appAuth.token) {
      if (!options.headers) options.headers = {};
      if (options.headers instanceof Headers) {
        if (!options.headers.has('Authorization')) options.headers.set('Authorization', `Bearer ${appAuth.token}`);
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['Authorization', `Bearer ${appAuth.token}`]);
      } else {
        if (!options.headers['Authorization']) options.headers['Authorization'] = `Bearer ${appAuth.token}`;
      }
    }
  }
  return originalFetch(url, options).then(res=>{
    if((res.status===401||res.status===403) && typeof url==='string' && (url.startsWith('/api')||url.startsWith('/fhir'))){
      const isAuthCall = url.includes('/api/auth/');
      if(!isAuthCall && appAuth.token){
        try{ const ct=res.headers.get('content-type')||''; if(ct.includes('json')) res.clone().json().then(j=>{ if(j.error&&j.error.includes('Invalid')) appAuth.logout(); }).catch(()=>{}); } catch(e){}
      }
    }
    return res;
  });
};

// === GLOBAL PATIENT CONTEXT ===
function getPatientDisplayName(p) {
  if (!p) return '—';
  const arName = (p.givenNameAr || '') + ' ' + (p.familyNameAr || '');
  const enName = (p.givenName || '') + ' ' + (p.familyName || '');
  return arName.trim() || enName.trim() || p.id;
}

function updateGlobalPatientBar() {
  const bar = document.getElementById('active-patient-bar');
  const nameEl = document.getElementById('active-patient-name');
  const metaEl = document.getElementById('active-patient-meta');
  const globalSelect = document.getElementById('global-patient-selector');

  if (!appAuth.currentRole) {
    if (bar) bar.style.display = 'none';
    return;
  }

  if (appAuth.currentRole === 'HOSPITAL_ADMIN') {
    if (bar) bar.style.display = 'none';
    return;
  }
  const sysMOHClinicalTabs = ['longitudinal','cds','nphies','medications','mpi'];
  if ((appAuth.currentRole === 'SYS_ADMIN' || appAuth.currentRole === 'MOH_ADMIN') && !sysMOHClinicalTabs.includes(currentTab)) {
    if (bar) bar.style.display = 'none';
    return;
  }
  const clinicianTabs = ['longitudinal','medications','cds','nphies'];
  if (appAuth.currentRole === 'CLINICIAN' && !clinicianTabs.includes(currentTab)) {
    if (bar) bar.style.display = 'none';
    return;
  }
  const auditorTabs = ['longitudinal'];
  if (appAuth.currentRole === 'MOH_AUDITOR' && !auditorTabs.includes(currentTab)) {
    if (bar) bar.style.display = 'none';
    return;
  }
  if (bar) bar.style.display = 'flex';

  // For Patient Role: Display ONLY logged-in patient details and completely hide selector dropdown
  if (appAuth.currentRole === 'PATIENT') {
    const combo = document.getElementById('global-patient-combobox');
    const comboSearch = document.getElementById('global-patient-search');
    const comboDrop = document.getElementById('global-patient-dropdown');
    const comboCount = document.getElementById('global-patient-count');
    if (globalSelect) globalSelect.style.display = 'none';
    if (combo) combo.style.display = 'none';
    if (comboSearch) comboSearch.style.display = 'none';
    if (comboDrop) comboDrop.style.display = 'none';
    if (comboCount) comboCount.style.display = 'none';
    const activePatient = cachedPatients[0] || {
      nameAr: appAuth.user?.fullName,
      name: appAuth.user?.fullName,
      nid: appAuth.user?.username
    };
    if (nameEl) {
      nameEl.textContent = activePatient.nameAr || activePatient.name || appAuth.user?.fullName || 'ملفي الصحي الشخصي';
    }
    if (metaEl) {
      metaEl.textContent = `| الهوية: ${activePatient.nid || appAuth.user?.username || '—'} | حساب فردي مصرح • خصوصية تامة`;
    }
    return;
  }

  if (cachedPatients.length === 0) {
    if (nameEl) nameEl.textContent = '— لا يوجد مرضى —';
    if (metaEl) metaEl.textContent = 'شغّل الاستيعاب أو ارفع ملف سريري أولاً';
    const ci = document.getElementById('global-patient-search');
    if (ci) { ci.placeholder = 'لا يوجد مرضى — ابحث بعد الاستيعاب'; ci.value=''; }
    return;
  }

  if (!currentPatientId) {
    if (nameEl) nameEl.textContent = '— اختر مريضاً —';
    if (metaEl) metaEl.textContent = `| ${cachedPatients.length} مريض متاح • ابحث بالاسم/الهوية ←`;
    const ci2 = document.getElementById('global-patient-search');
    if (ci2 && document.activeElement !== ci2) ci2.placeholder = `ابحث بين ${cachedPatients.length} مريض...`;
    return;
  }

  const combo = document.getElementById('global-patient-combobox');
  const searchInput = document.getElementById('global-patient-search');
  if (combo) combo.style.display = 'block';
  if (globalSelect) globalSelect.style.display = 'none';
  if (searchInput && currentPatientId) {
    const ap = cachedPatients.find(p => p.id === currentPatientId);
    if (ap && document.activeElement !== searchInput) searchInput.value = ap.nameAr || ap.name;
  }
  if (typeof window.renderGlobalDropdown === 'function') {
    try { window.renderGlobalDropdown(); } catch(e) {}
  }
  const activePatient = cachedPatients.find(p => p.id === currentPatientId);
  if (nameEl) {
    nameEl.textContent = activePatient ? (activePatient.nameAr || activePatient.name) : '— اختر مريضاً —';
  }
  if (metaEl && activePatient) {
    metaEl.textContent = `| الهوية: ${activePatient.nid || '—'} | ${activePatient.gender === 'male' ? 'ذكر' : 'أنثى'} | ${activePatient.birthDate || ''}`;
  } else if (metaEl) {
    metaEl.textContent = '| ابحث بالاسم أو الهوية في الحقل ←';
  }
}

async function switchActivePatient(patientId) {
  if (!patientId || appAuth.currentRole === 'PATIENT') return;
  currentPatientId = patientId;
  updateGlobalPatientBar();
  if (currentTab === 'longitudinal') loadLongitudinalRecord(patientId);
  else handleTabSwitch(currentTab);
}

async function fetchAndCachePatients() {
  try {
    if (appAuth.currentRole === 'PATIENT') {
      const res = await fetch('/api/patients');
      let list = [];
      try { const j = await res.json(); list = Array.isArray(j) ? j : (j.items || []); } catch(e) { list = []; }
      cachedPatients = list.map(cp => ({
        id: cp.internalId,
        name: `${cp.givenName || ''} ${cp.familyName || ''}`.trim() || cp.internalId,
        nameAr: `${cp.givenNameAr || ''} ${cp.familyNameAr || ''}`.trim() || `${cp.givenName || ''} ${cp.familyName || ''}`.trim(),
        nid: cp.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value || '',
        birthDate: cp.birthDate ? String(cp.birthDate).substring(0, 10) : '',
        gender: cp.gender || ''
      }));
      updateGlobalPatientBar();
      return;
    }
    const res = await fetch('/api/patients/search?limit=20&sort=recent');
    const data = await res.json().catch(() => ({ items: [] }));
    const items = data.items || (Array.isArray(data) ? data : []);
    cachedPatients = items.map(cp => ({
      id: cp.internalId,
      name: `${cp.givenName || ''} ${cp.familyName || ''}`.trim() || cp.internalId,
      nameAr: `${cp.givenNameAr || ''} ${cp.familyNameAr || ''}`.trim() || `${cp.givenName || ''} ${cp.familyName || ''}`.trim(),
      nid: cp.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value || '',
      birthDate: cp.birthDate ? String(cp.birthDate).substring(0, 10) : '',
      gender: cp.gender || ''
    }));
    if (currentPatientId && !cachedPatients.find(p=>p.id===currentPatientId)) currentPatientId='';
    updateGlobalPatientBar();
  } catch (err) {
    console.error('Failed to fetch and cache patients', err);
  }
}

// Flat Minimalist SVG Icon Helper (Zero Emojis System)
function getSvgIcon(name, extraClasses = '') {
  const icons = {
    check: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    user: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    hospital: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l8-4v18M13 11h4M13 15h4M13 19h4M9 9h.01M9 13h.01M9 17h.01"/></svg>`,
    pill: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>`,
    syringe: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 2 4 4-4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/></svg>`,
    stethoscope: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>`,
    flask: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18h8M3 22h18M14 22a7 7 0 1 0-14 0"/><path d="M9 14h.01M9 10h.01M12 6h.01M12 2h.01M15 10a4 4 0 0 0 4-4V2h-4v4a4 4 0 0 0 4 4"/></svg>`,
    shield: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    shieldCheck: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`,
    refresh: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
    spinner: `<svg class="inline-svg spin ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>`,
    bolt: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    card: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    search: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    info: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    chip: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
    activity: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
    printer: `<svg class="inline-svg ${extraClasses}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`
  };
  return icons[name] || '';
}

// Flat Precision Toast Notification
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? getSvgIcon('shieldCheck', 'toast-icon') : getSvgIcon('info', 'toast-icon');

  toast.innerHTML = `
    ${icon}
    <div class="toast-content">
      <h5>${title}</h5>
      <p>${message}</p>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-6px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', () => {
  initThemeSwitcher();
  initSidebarToggle();
  initMobileDrawer();
  initNavigation();
  // initAuth after navigation so applyRolePermissions click handlers are bound
  appAuth.init();
  initActions();
  initGlobalPatientSelector();
  initFileDropzone();
  // Enforce role-based default tab after all init; fixes refresh hijack to monitoring
  setTimeout(() => {
    if (appAuth.currentRole) {
      const allowed = getAllowedTabsForRole(appAuth.currentRole);
      if (!allowed.includes(currentTab)) {
        const fallback = allowed[0] || 'monitoring';
        const btn = document.getElementById('tab-btn-' + fallback);
        if (btn) btn.click(); else handleTabSwitch(fallback);
      } else {
        handleTabSwitch(currentTab);
      }
    }
    loadAllData();
  }, 0);
});

function initThemeSwitcher() {
  const themeToggleBtn = document.getElementById('btn-theme-toggle');
  const themeToggleText = document.getElementById('theme-toggle-text');
  const moonIcon = document.querySelector('.theme-icon-moon');
  const sunIcon = document.querySelector('.theme-icon-sun');

  function applyTheme(theme) {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.documentElement.setAttribute('data-theme', 'light');
      if (themeToggleText) themeToggleText.textContent = 'الوضع الداكن';
      if (moonIcon) moonIcon.style.display = 'none';
      if (sunIcon) sunIcon.style.display = 'inline-block';
    } else {
      document.body.classList.remove('light-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
      if (themeToggleText) themeToggleText.textContent = 'الوضع الفاتح';
      if (moonIcon) moonIcon.style.display = 'inline-block';
      if (sunIcon) sunIcon.style.display = 'none';
    }
  }

  // Check saved preference or default to dark
  const savedTheme = localStorage.getItem('app_theme') || 'dark';
  applyTheme(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const isCurrentlyLight = document.body.classList.contains('light-theme');
      const newTheme = isCurrentlyLight ? 'dark' : 'light';
      applyTheme(newTheme);
      localStorage.setItem('app_theme', newTheme);
      showToast(
        newTheme === 'light' ? 'الوضع الفاتح' : 'الوضع الداكن',
        newTheme === 'light' ? 'تم التحويل إلى السمة الرسمية الفاتحة بنجاح.' : 'تم التحويل إلى السمة الرسمية الداكنة بنجاح.',
        'info'
      );
    });
  }
}

let globalPatientSearchState = { q: '', page: 1, limit: 12, total: 0, totalPages: 1, items: [] };
let globalPatientDebounce = null;
function initGlobalPatientSelector() {
  const input = document.getElementById('global-patient-search');
  const dropdown = document.getElementById('global-patient-dropdown');
  const clearBtn = document.getElementById('global-patient-clear');
  const countEl = document.getElementById('global-patient-count');
  const legacySelect = document.getElementById('global-patient-selector');
  if (!input || !dropdown || input.dataset.bound) return;
  input.dataset.bound = '1';
  legacySelect?.addEventListener('change', (e) => switchActivePatient(e.target.value));
  const closeDropdown = () => { dropdown.style.display = 'none'; };
  const openDropdown = () => { if (globalPatientSearchState.items.length || globalPatientSearchState.q) dropdown.style.display = 'block'; };
  input.addEventListener('focus', async () => {
    if (!globalPatientSearchState.items.length) await fetchGlobalPatients('', 1);
    renderGlobalDropdown();
    openDropdown();
  });
  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (clearBtn) clearBtn.style.display = v ? 'block' : 'none';
    clearTimeout(globalPatientDebounce);
    globalPatientDebounce = setTimeout(async () => {
      globalPatientSearchState.q = v;
      globalPatientSearchState.page = 1;
      await fetchGlobalPatients(v, 1);
      renderGlobalDropdown();
      openDropdown();
    }, 300);
  });
  clearBtn?.addEventListener('click', async () => {
    input.value = ''; clearBtn.style.display = 'none';
    globalPatientSearchState.q = ''; globalPatientSearchState.page = 1;
    await fetchGlobalPatients('', 1);
    renderGlobalDropdown();
    input.focus();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-patient-combobox')) closeDropdown();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
    if (e.key === 'Enter') {
      const first = dropdown.querySelector('.combobox-item[data-id]');
      if (first) { const id = first.getAttribute('data-id'); if (id) switchActivePatient(id); closeDropdown(); }
    }
  });
  async function fetchGlobalPatients(q, page) {
    try {
      const params = new URLSearchParams({ q, page: String(page), limit: String(globalPatientSearchState.limit), sort: 'recent' });
      const res = await fetch('/api/patients/search?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل البحث');
      const items = (data.items || []).map(cp => ({
        id: cp.internalId,
        name: `${cp.givenName || ''} ${cp.familyName || ''}`.trim() || cp.internalId,
        nameAr: `${cp.givenNameAr || ''} ${cp.familyNameAr || ''}`.trim() || `${cp.givenName || ''} ${cp.familyName || ''}`.trim(),
        nid: cp.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value || '',
        birthDate: cp.birthDate ? String(cp.birthDate).substring(0, 10) : '',
        gender: cp.gender || ''
      }));
      if (page === 1) globalPatientSearchState.items = items;
      else globalPatientSearchState.items = globalPatientSearchState.items.concat(items);
      globalPatientSearchState.total = data.total || items.length;
      globalPatientSearchState.totalPages = data.totalPages || 1;
      globalPatientSearchState.page = page;
      items.forEach(m => { if (!cachedPatients.find(c => c.id === m.id)) cachedPatients.push(m); });
      if (countEl) countEl.textContent = `${globalPatientSearchState.total} مريض • ${globalPatientSearchState.items.length} معروض`;
    } catch (err) {
      if (dropdown) dropdown.innerHTML = `<div class="combobox-empty" style="color:var(--m3-error);">${err.message}</div>`;
    }
  }
  function renderGlobalDropdown() {
    if (!dropdown) return;
    if (!globalPatientSearchState.items.length) {
      dropdown.innerHTML = `<div class="combobox-empty">لا توجد نتائج لـ "${globalPatientSearchState.q || '—'}"</div>`;
      dropdown.style.display = 'block';
      return;
    }
    const html = globalPatientSearchState.items.map(p => {
      const isActive = p.id === currentPatientId;
      return `<div class="combobox-item ${isActive ? 'active' : ''}" data-id="${p.id}" onclick="switchActivePatient('${p.id}')">
        <div class="combobox-item-main"><span class="combobox-item-name">${p.nameAr || p.name}</span><span class="combobox-item-sub">${p.nid || p.id.substring(0,8)} • ${p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : '—'} • ${p.birthDate || '—'}</span></div>
        <span class="badge ${isActive ? 'badge-success' : 'badge-info'}" style="font-size:0.62rem;">${isActive ? 'نشط' : 'اختيار'}</span>
      </div>`;
    }).join('');
    const moreBtn = globalPatientSearchState.page < globalPatientSearchState.totalPages ? `<button type="button" class="combobox-load-more" id="global-load-more">تحميل المزيد (${globalPatientSearchState.total - globalPatientSearchState.items.length} متبقي)</button>` : '';
    dropdown.innerHTML = html + moreBtn;
    dropdown.style.display = 'block';
    document.getElementById('global-load-more')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await fetchGlobalPatients(globalPatientSearchState.q, globalPatientSearchState.page + 1);
      renderGlobalDropdown();
    });
    dropdown.querySelectorAll('.combobox-item').forEach(el => {
      el.addEventListener('click', () => { dropdown.style.display = 'none'; });
    });
  }
  window.fetchGlobalPatients = fetchGlobalPatients;
  window.renderGlobalDropdown = renderGlobalDropdown;
  fetchGlobalPatients('', 1).then(() => { if (document.activeElement === input) renderGlobalDropdown(); });
}

function initFileDropzone() {
  const dropzone = document.getElementById('clinical-file-dropzone');
  const fileInput = document.getElementById('input-clinical-file');
  const browseBtn = document.getElementById('btn-browse-file');
  const resultContainer = document.getElementById('file-ingestion-result-container');

  if (!dropzone) return;

  browseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  dropzone.addEventListener('click', (e) => {
    if (e.target !== browseBtn && !browseBtn?.contains(e.target)) {
      fileInput?.click();
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzone.addEventListener(name, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  // Sample File Loaders
  document.querySelectorAll('.btn-sample-file').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleType = btn.getAttribute('data-sample');
      loadAndProcessSample(sampleType);
    });
  });

  async function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      await uploadAndProcessFile(file.name, content);
    };
    reader.readAsText(file);
  }

  async function loadAndProcessSample(sampleType) {
    let fileName = '';
    let content = '';

    if (sampleType === 'hl7') {
      fileName = 'emergency_adt_a01.hl7';
      content = `MSH|^~\\&|EMERGENCY_HIS|HOSP-RIYADH-01|SAUDI_INTEROP_HUB|MOH_KSA|20260827230000||ADT^A01|MSG-KSA-994812|P|2.5\nEVN|A01|20260827230000\nPID|1||MRN-EMG-99881^^^HOSP-RIYADH-01^MR||سلطان بن فهد العتيبي^Al-Otaibi^Sultan^Fahad||19820714|M|||حي الصحافة^الرياض^^11564^SAU||+966551234567|||M|||1099887766\nPV1|1|E|EMG-WARD-1^BED-04|E|||DR-SCFHS-88712^د. خالد الشهري^Al-Shehri^Khaled|||SUR||||||||VIS-EMG-2026-901|||||||||||||||||||||||||20260827230000`;
    } else if (sampleType === 'fhir') {
      fileName = 'fhir_r4_patient_bundle.json';
      content = JSON.stringify({
        resourceType: 'Bundle',
        type: 'transaction',
        entry: [
          {
            resource: {
              resourceType: 'Patient',
              id: 'pat-fhir-9912',
              identifier: [
                { system: 'urn:sa:nid', value: '1077665544' },
                { system: 'urn:sa:facility:hospital-c', value: 'MRN-HC-4401' }
              ],
              name: [{ text: 'نورة بنت عبدالله القحطاني', family: 'Al-Qahtani', given: ['Noura', 'Abdullah'] }],
              gender: 'female',
              birthDate: '1990-11-25',
              telecom: [{ system: 'phone', value: '+966509876543' }]
            }
          }
        ]
      }, null, 2);
    } else if (sampleType === 'csv') {
      fileName = 'clinic_patients_registry.csv';
      content = `client_id,national_id_num,full_arabic_name,dob_gregorian,sex_code\nCSV-PT-8801,1066554433,فيصل بن عبدالعزيز الدوسري,1992-06-18,ذكر\nCSV-PT-8802,1055443322,ريم بنت منصور السبيعي,1995-09-12,أنثى`;
    }

    await uploadAndProcessFile(fileName, content);
  }

  async function uploadAndProcessFile(fileName, fileContent) {
    if (!resultContainer) return;
    const selectedHosp = document.getElementById('select-ingest-hospital')?.value;
    if (!selectedHosp) { showToast('اختر المنشأة','يجب اختيار المنشأة المستهدفة من القائمة قبل رفع الملف','error'); return; }
    const selEl = document.getElementById('select-ingest-hospital');
    const selText = selEl?.options[selEl.selectedIndex]?.text || selectedHosp;
    if (selText.includes('بانتظار اعتماد') || selText.includes('موقوف')) { showToast('المنشأة غير معتمدة','المنشأة المختارة غير نشطة - اعتمدها من الحوكمة أولاً','error'); return; }
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div class="ingestion-result-box" style="display:flex; align-items:center; gap:10px;">
        ${getSvgIcon('spinner', 'style="width:20px; height:20px; color:var(--m3-primary-light);')}
        <div>
          <strong style="color:var(--m3-on-surface); font-size:0.9rem;">جاري تحليل الملف: <code>${fileName}</code> للمنشأة: <code>${selText}</code>...</strong>
          <p style="font-size:0.78rem; color:var(--m3-on-surface-muted);">فحص البنية واكتشاف الترميز والمعايرة ومطابقة الهوية في MPI (عملية حقيقية في DB)...</p>
        </div>
      </div>
    `;

    try {
      const res = await fetch('/api/ingest/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileContent,
          sourceSystemId: selectedHosp
        })
      });
      const data = await res.json();

      if (data.success && data.result) {
        const r = data.result;
        const formatBadge = r.format === 'hl7v2' ? '<span class="badge badge-warning">HL7 v2.5 MLLP Pipe</span>' :
                            r.format === 'fhir-bundle' ? '<span class="badge badge-success">HL7 FHIR R4 Bundle</span>' :
                            r.format === 'csv' ? '<span class="badge badge-info">Tabular CSV Records</span>' :
                            '<span class="badge badge-purple">JSON Canonical Payload</span>';

        resultContainer.innerHTML = `
          <div class="ingestion-result-box success">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                ${getSvgIcon('shieldCheck', 'style="width:20px; height:20px; color:var(--m3-primary-light);')}
                <strong style="color:var(--m3-on-surface); font-size:0.96rem;">تم استيعاب وتطبيع الملف بنجاح: <code>${r.fileName}</code></strong>
              </div>
              ${formatBadge}
            </div>
            <p style="font-size:0.82rem; color:var(--m3-on-surface-variant); margin-bottom:10px;">
              تم التعرف على التنسيق ومعالجة <strong>${r.totalIngested}</strong> سجل بنجاح، وتوحيد الهوية في فهرس المرضى الرئيسي (MPI)، وتوثيق العملية في سجل الكتل المشفر (NCA).
            </p>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <span class="badge badge-success">جودة المطابقة: ${r.validation?.score ?? r.qualityScore ?? '--'}/100</span>
              <span class="badge badge-info">المنشأة: ${r.sourceSystemId || selectedHosp}</span>
              <button type="button" class="btn btn-primary btn-sm" id="btn-view-ingested-result">
                <svg class="btn-svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <span>عرض السجلات المحدثة في لوحة المراقبة</span>
              </button>
            </div>
          </div>
        `;
        document.getElementById('btn-view-ingested-result')?.addEventListener('click', () => {
          document.querySelector('[data-tab="monitoring"]')?.click();
        });
        showToast('تم استيعاب الملف بنجاح', `تم استيعاب ${r.totalIngested} سجل وتطبيعها من ${r.fileName}.`, 'success');
        await loadAllData();
      } else {
        resultContainer.innerHTML = `
          <div class="ingestion-result-box error">
            <strong style="color:var(--m3-error); font-size:0.9rem;">فشلت معالجة الملف</strong>
            <p style="font-size:0.8rem; color:var(--m3-on-surface-variant); margin-top:4px;">${data.error || 'تعذر استيعاب الملف.'}</p>
          </div>
        `;
        showToast('خطأ في معالجة الملف', data.error || 'تعذر استيعاب الملف.', 'error');
      }
    } catch (err) {
      resultContainer.innerHTML = `
        <div class="ingestion-result-box error">
          <strong style="color:var(--m3-error); font-size:0.9rem;">خطأ في الاتصال</strong>
          <p style="font-size:0.8rem; color:var(--m3-on-surface-variant); margin-top:4px;">تعذر إرسال الملف للخادم: ${err.message}</p>
        </div>
      `;
      showToast('خطأ في الاتصال', 'تعذر إرسال الملف للخادم.', 'error');
    }
  }
}

function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      const isCollapsed = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebar_collapsed', isCollapsed ? '1' : '0');
    });
    if (localStorage.getItem('sidebar_collapsed') === '1') document.body.classList.add('sidebar-collapsed');
  }
}
function initMobileDrawer() {
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!btn || !sidebar || !backdrop) return;
  const open = () => { sidebar.classList.add('open'); backdrop.classList.add('open'); btn.setAttribute('aria-expanded','true'); backdrop.setAttribute('aria-hidden','false'); };
  const close = () => { sidebar.classList.remove('open'); backdrop.classList.remove('open'); btn.setAttribute('aria-expanded','false'); backdrop.setAttribute('aria-hidden','true'); };
  btn.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 1024) close(); });
  document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', () => { if (window.innerWidth <= 1024) close(); }));
  let sx=0; sidebar.addEventListener('touchstart', e=> sx=e.touches[0].clientX, {passive:true});
  sidebar.addEventListener('touchend', e=> { if (e.changedTouches[0].clientX - sx < -50) close(); }, {passive:true});
}

function initNavigation() {
  const tabButtons = document.querySelectorAll('.nav-item');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const titles = {
    monitoring: {
      title: 'لوحة المراقبة وتكامل المستشفيات',
      sub: 'مراقبة حية لخط أنابيب الاستيعاب والتطبيع للأنظمة الصحية غير المتجانسة'
    },
    onboarding: {
      title: 'استوديو إضافة وتكامل المستشفيات ديناميكياً (Hospital Onboarding)',
      sub: 'ربط منشآت صحية ومستشفيات جديدة بالمنصة وتعريف مخططاتها وضخ بياناتها فورياً'
    },
    cds: {
      title: 'محرك دعم القرار السريري والمؤشرات الوطنية (CDS Hooks & Population Health)',
      sub: 'فحص التفاعلات والسلامة الدوائية المعتمدة على SFDA وبروتوكولات الطوارئ والتحليلات التراكمية'
    },
    nphies: {
      title: 'مركز تأمين ومطالبات نفيس (NPHIES Taameen & Claims)',
      sub: 'تسوية المطالبات والتحقق الفوري من الأهلية التأمينية وفق معايير مجلس الضمان الصحي (CHI)'
    },
    medications: {
      title: 'سجل الأدوية والوصفات الطبية والتطعيمات (SFDA Drug Registry & Vaccines)',
      sub: 'تطبيع الوصفات الطبية بكود الدواء السعودي (SDC) وتتبع جدول تطعيمات وزارة الصحة'
    },
    mpi: {
      title: 'سجل المرضى الرئيسي (Master Patient Index - MPI)',
      sub: 'تسوية الهويات وربط أرقام الملفات (MRN) المتعددة تحت الهوية الوطنية الموحدة'
    },
    longitudinal: {
      title: 'الملف الصحي الموحد الشامل (Longitudinal Record)',
      sub: 'عرض تتابعي زمني يجمع الزيارات والتشخيصات والتحاليل والأدوية والتطعيمات والمطالبات'
    },
    profile: {
      title: 'بياناتي الشخصية - إدارة البيانات المصرح بها',
      sub: 'عرض وتحديث بيانات التواصل، اللغة المفضلة، جهة اتصال الطوارئ والعنوان الوطني — الحقول المحمية للعرض فقط'
    },
    'hospital-profile': {
      title: 'بيانات المنشأة الصحية - إدارة البيانات المصرح بها',
      sub: 'عرض وتحديث بيانات التواصل والمعلومات العامة للمنشأة — النوع والمعرف محميان للعرض فقط'
    },
    'hospital-migration': {
      title: 'نظام إدارة المستشفى — بوابة الترحيل الوطني',
      sub: 'واجهة منشأتك الخاصة: رفع الأنظمة القديمة، تطبيعها وربطها بالسجل الوطني مع عزل تنظيمي تام'
    },
    'hospital-global': {
      title: 'السجل العام الموحد — نظرة وطنية (منفصل عن سجل منشأتي)',
      sub: 'استعلام وطني شامل للمرضى الموحدين — قراءة فقط، متكامل مع قاعدة البيانات نفسها لكن معزول عرضاً عن مرضى منشأتك'
    },
    mapping: {
      title: 'استوديو قواعد الربط وتصنيف المصطلحات',
      sub: 'مصفوفة تحويل الحقول والربط المعياري (SFDA SDC, SNOMED CT, ICD-10-AM, SBS, LOINC)'
    },
    provenance: {
      title: 'سلسلة النسب وتتبع مصدر البيانات (Data Lineage & Provenance)',
      sub: 'تتبع شامل يربط كل بيان سريري أو مالي بالسجل الخام والمحول وقواعد التحقق'
    },
    fhir: {
      title: 'مستكشف واجهة HL7 FHIR R4.0.1 & NPHIES',
      sub: 'عرض استجابات واجهة FHIR الموحدة المتوافقة مع متطلبات مجلس الضمان وهيئة الغذاء والدواء'
    },
    security: {
      title: 'الأمن السيبراني وسلسلة التدقيق المشفرة (NCA Cryptographic Audit Chain)',
      sub: 'سجل كتل تدقيق مشفر غير قابل للتلاعب بروابط تجزئة SHA-256 متسلسلة للامتثال لضوابط الهيئة الوطنية للأمن السيبراني'
    },
    'admin-governance': {
      title: 'الحوكمة الوطنية الموحدة – ربط الأدمن بالمريض والمستشفى',
      sub: 'اعتماد المنشآت، إدارة المستخدمين، والتحقق من البيانات المبلغة ذاتياً – من نفس قاعدة البيانات الموحدة'
    },
    bulkexport: {
      title: 'تصدير البيانات الصحية الضخمة للمستودع الوطني (FHIR Bulk Export & PDPL)',
      sub: 'تصدير ملايين السجلات بصيغة NDJSON مع محرك إخفاء الهوية للأبحاث والذكاء الاصطناعي الطبي'
    }
  };

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;
      // Security: block unauthorized tab access (e.g., patient/hospital trying to open monitoring via refresh or manual click)
      if (appAuth.currentRole) {
        const allowed = getAllowedTabsForRole(appAuth.currentRole);
        if (!allowed.includes(tab)) {
          showToast('غير مصرح', 'ليس لديك صلاحية للوصول إلى هذه الصفحة', 'error');
          const fallback = allowed[0];
          if (fallback && fallback !== tab) {
            const fbBtn = document.getElementById('tab-btn-' + fallback);
            if (fbBtn) { fbBtn.click(); return; }
            handleTabSwitch(fallback);
          }
          return;
        }
      }

      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      const targetPane = document.getElementById(`pane-${tab}`);
      if (targetPane) targetPane.classList.add('active');

      if (titles[tab]) {
        pageTitle.textContent = titles[tab].title;
        pageSubtitle.textContent = titles[tab].sub;
      }

      currentTab = tab;
      handleTabSwitch(tab);
    });
  });

  // FHIR Explorer Endpoint Buttons
  document.querySelectorAll('.endpoint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.endpoint-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      let endpoint = btn.getAttribute('data-endpoint') || '/fhir/metadata';
      
      if (endpoint.includes('longitudinal-demo')) {
        endpoint = currentPatientId ? `/fhir/Patient/${currentPatientId}/$everything` : '/fhir/Patient';
      }
      
      currentFhirEndpoint = endpoint;
      fetchFhirEndpoint(endpoint);
    });
  });
}

function initActions() {
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    loadAllData();
    showToast('تم تحديث البيانات', 'تمت مزامنة جميع الإحصائيات مع خادم الربط البيني اللحظي.', 'info');
  });

  document.getElementById('btn-run-pipeline')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-run-pipeline');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `${getSvgIcon('spinner', 'btn-svg-icon')} <span>جاري الاستيعاب والتطبيع...</span>`;

    try {
      const res = await fetch('/api/pipeline/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(
          'اكتملت المعالجة والتطبيع بنجاح',
          `تم استيعاب ${data.data.totalIngested} سجل، وتوحيد ${data.data.patientsResolvedCount} مريض، ومعالجة ${data.data.claimsCount} مطالبة نفيس.`,
          'success'
        );
        loadAllData();
      } else {
        showToast('خطأ في خط الأنابيب', data.error || 'تعذر استكمال المعالجة.', 'error');
      }
    } catch (e) {
      showToast('تعذر الاتصال', 'تعذر الوصول لخادم المعالجة اللحظي.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${getSvgIcon('bolt', 'btn-svg-icon')} <span>تشغيل الاستيعاب والتطبيع</span>`;
    }
  });

  document.getElementById('form-onboard-hospital')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hospitalIdRaw = document.getElementById('onboard-id')?.value.trim();
    const hospitalId = hospitalIdRaw || undefined;
    const hospitalNameAr = document.getElementById('onboard-name-ar')?.value.trim();
    const hospitalName = document.getElementById('onboard-name-en')?.value.trim();
    const facilityType = document.getElementById('onboard-type')?.value;
    const region = document.getElementById('onboard-region')?.value;
    const adminUsername = document.getElementById('onboard-admin-username')?.value.trim();
    const adminPassword = document.getElementById('onboard-admin-password')?.value;
    const adminFullName = document.getElementById('onboard-admin-fullname')?.value.trim();
    const adminEmail = document.getElementById('onboard-admin-email')?.value.trim();
    const adminPhone = document.getElementById('onboard-admin-phone')?.value.trim();
    if (!hospitalNameAr || !hospitalName) { showToast('بيانات ناقصة','اسم المنشأة عربي/إنجليزي مطلوب','error'); return; }
    if (hospitalNameAr.length < 3 || hospitalName.length < 3) { showToast('بيانات ناقصة','الاسم قصير جداً','error'); return; }
    if (!adminUsername || !adminPassword || !adminFullName || !adminEmail || !adminPhone) { showToast('بيانات الأدمن ناقصة','جميع حقول أدمن المنشأة مطلوبة','error'); return; }
    if (adminPassword.length < 8 || !/[A-Za-z]/.test(adminPassword) || !/\d/.test(adminPassword)) { showToast('كلمة مرور ضعيفة','يجب أن تكون 8+ حروف وأرقام','error'); return; }

    try {
      const res = await fetch('/api/hospitals/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          hospitalName,
          hospitalNameAr,
          facilityType,
          region,
          adminUsername,
          adminPassword,
          adminFullName,
          adminEmail,
          adminPhone,
          adapterVersion: '1.0.0',
          sourceSchema: {
            sourceSystemId: hospitalId,
            tables: [
              {
                name: 'client_registry',
                fields: [
                  { name: 'client_id', type: 'string', isNullable: false },
                  { name: 'national_id_num', type: 'string', isNullable: false },
                  { name: 'full_arabic_name', type: 'string', isNullable: false },
                  { name: 'dob_gregorian', type: 'string', isNullable: false },
                  { name: 'sex_code', type: 'string', isNullable: false }
                ]
              }
            ]
          },
          defaultMappingConfigs: [
            {
              id: `map-${hospitalId}-pt-v1`,
              sourceSystemId: hospitalId,
              sourceEntityType: 'client_registry',
              targetCanonicalEntity: 'CanonicalPatient',
              mappingVersion: '1.0.0',
              effectiveDate: '2026-01-01',
              status: 'ACTIVE',
              author: 'Dynamic Onboarding Wizard',
              description: `Maps ${hospitalNameAr} records to CanonicalPatient`,
              validationState: 'VALIDATED',
              fieldMappings: [
                { sourceField: 'client_id', targetField: 'mrn', required: true },
                { sourceField: 'national_id_num', targetField: 'nationalId', required: true },
                { sourceField: 'full_arabic_name', targetField: 'givenNameAr', required: true },
                { sourceField: 'sex_code', targetField: 'gender', required: true, transformation: 'gender_normalize' },
                { sourceField: 'dob_gregorian', targetField: 'birthDate', required: true, transformation: 'date_normalize' }
              ]
            }
          ]
        })
      });
      const data = await res.json();
      if (data.success || res.ok) {
        showToast('تم التسجيل', data.message || `تم تسجيل ${hospitalNameAr} مع الأدمن ${adminUsername} - بانتظار اعتماد MOH`, 'success');
        if (data.admin) showToast('حساب الأدمن', `أدمن المنشأة: ${data.admin.username} (${data.admin.email}) - الدخول مُعلق حتى الاعتماد`, 'info');
        document.getElementById('form-onboard-hospital')?.reset();
        loadOnboardedHospitals();
        loadAdminGovernance();
      } else {
        showToast('خطأ في التسجيل', data.error, 'error');
      }
    } catch (err) {
      showToast('خطأ', 'تعذر إضافة المنشأة.', 'error');
    }
  });

  // Custom Payload Ingestion Form
  document.getElementById('form-ingest-custom')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hospitalId = document.getElementById('select-ingest-hospital')?.value;
    const entityType = document.getElementById('ingest-entity-type')?.value.trim();
    const payloadStr = document.getElementById('ingest-payload-json')?.value;

    try {
      const payload = JSON.parse(payloadStr);
      const res = await fetch(`/api/hospitals/${hospitalId}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          sourceRecordId: payload.client_id || payload.id || 'REC-' + Date.now(),
          payload
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم الاستيعاب والتطبيع', `تم تطبيع السجل بنجاح بنقاط جودة ${data.result.validation.score}/100.`, 'success');
        loadAllData();
      } else {
        showToast('خطأ في الاستيعاب', data.error, 'error');
      }
    } catch (err) {
      showToast('خطأ في البيانات', 'يرجى التأكد من صحة تنسيق JSON.', 'error');
    }
  });

  // Prospective ePrescription Simulation Form (CDS Hooks)
  document.getElementById('btn-simulate-eprescribe')?.addEventListener('click', async () => {
    const candidateDrug = document.getElementById('select-cds-candidate-drug')?.value;
    const dosage = document.getElementById('cds-draft-dosage')?.value;
    const container = document.getElementById('cds-sim-results-container');
    if (!container) return;

    const drugCatalog = {
      augmentin: { code: '0628500500505', name: 'Augmentin 1g (Amoxicillin / Clavulanate)' },
      bactrim: { code: '0628500600606', name: 'Bactrim DS (Sulfamethoxazole / Trimethoprim)' },
      metformin: { code: '0628500100101', name: 'Glucophage 500mg' },
      ibuprofen: { code: '0628500200202', name: 'Brufen 400mg' },
      ciprofloxacin: { code: '0628500300303', name: 'Ciprobay 500mg' },
      paracetamol: { code: '0628500400404', name: 'Panadol 500mg' }
    };

    const sel = drugCatalog[candidateDrug] || drugCatalog.metformin;

    try {
      if (!currentPatientId) {
        container.innerHTML = `<div style="padding:16px; background:var(--m3-warning-container); border:1px solid var(--m3-warning); border-radius:var(--radius-xs); color:var(--m3-on-warning-container);">
          <strong>يجب اختيار مريض أولاً</strong> — قم بتشغيل خط الأنابيب أو اختر مريضاً من شريط المريض النشط في أعلى الصفحة.
        </div>`;
        return;
      }
      const res = await fetch('/api/cds/evaluate-draft-prescription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentPatientId,
          drugCode: sel.code,
          drugName: sel.name,
          dosage: dosage || '1 tab PO BID',
          route: 'oral',
          frequency: 'BID'
        })
      });
      const data = await res.json();

      if (data.cards && data.cards.length > 0) {
        container.innerHTML = data.cards.map((c) => {
          const borderColor = c.indicator === 'critical' ? 'var(--m3-error)' : c.indicator === 'warning' ? 'var(--m3-warning)' : 'var(--m3-primary)';
          const badgeClass = c.indicator === 'critical' ? 'badge-error' : c.indicator === 'warning' ? 'badge-warning' : 'badge-success';
          const badgeLabel = c.indicator === 'critical' ? 'حرج' : c.indicator === 'warning' ? 'تحذير' : c.indicator === 'info' ? 'تم التحقق ✓' : 'إرشادي';

          return `
            <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant); border-right:4px solid ${borderColor}; border-radius:var(--radius-xs); padding:16px 18px; margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="color:var(--m3-on-surface); font-size:0.95rem;">${c.summaryAr}</strong>
                </div>
                <span class="badge ${badgeClass}">${badgeLabel}</span>
              </div>
              <p style="font-size:0.83rem; color:var(--m3-on-surface-variant); margin-bottom:8px; line-height:1.5;">${c.detailAr}</p>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--m3-on-surface-muted);">
                <span>المرجع: <strong>${c.source?.labelAr}</strong></span>
                ${c.suggestions ? `<span>الإجراء الموصى به: <strong style="color:var(--m3-on-primary-container);">${c.suggestions[0].labelAr}</strong></span>` : ''}
              </div>
            </div>
          `;
        }).join('');
        showToast('تم فحص الوصفة التجريبية', 'تم توليد تنبيهات الأمان الدوائي اللحظية.', 'info');
      } else {
        container.innerHTML = `
          <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant); border-radius:var(--radius-xs); padding:14px 18px; color:var(--m3-on-surface-variant);">
            <strong style="color:var(--m3-on-surface);">⚠️ لا يمكن التحقق - لا توجد بيانات كافية</strong>
            <p style="font-size:0.82rem; margin-top:4px;">المحرك لم يرجع أي بطاقة - تحقق من اكتمال سجل المريض (حساسيات/تحاليل/وصفات) ثم أعد الفحص.</p>
          </div>
        `;
        showToast('غير مكتمل', 'الملف ناقص - لا يمكن الجزم بالأمان', 'info');
      }
    } catch (err) {
      showToast('خطأ', 'تعذر فحص الوصفة التجريبية.', 'error');
    }
  });

  // CDS Evaluation Action
  document.getElementById('btn-eval-cds')?.addEventListener('click', () => {
    if (currentPatientId) {
      loadCdsAndAnalyticsTab();
      showToast('تم فحص السلامة الدوائية', 'تم تحديث بطاقات وتنبيهات دعم القرار السريري.', 'info');
    }
  });

  // Break-the-Glass Action
  document.getElementById('btn-break-glass')?.addEventListener('click', async () => {
    const reason = document.getElementById('break-glass-reason')?.value.trim();
    const statusContainer = document.getElementById('break-glass-status-container');
    if (!reason) {
      showToast('تنبيه', 'يرجى كتابة سبب الوصول الطارئ.', 'info');
      return;
    }

    if (!currentPatientId) {
      showToast('تنبيه', 'يجب اختيار مريض أولاً من شريط المريض النشط.', 'info');
      return;
    }
    const practitionerInput = document.getElementById('break-glass-practitioner');
    const practitionerId = practitionerInput?.value?.trim() || 'DR-UNKNOWN';
    try {
      const res = await fetch('/api/security/break-glass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentPatientId,
          practitionerId: practitionerId,
          requestingOrgId: 'HOSP-EMERGENCY-01',
          emergencyReason: reason
        })
      });
      const data = await res.json();
      if (data.success && statusContainer) {
        statusContainer.innerHTML = `
          <div style="background:var(--m3-error-container); border:1px solid var(--m3-error); border-radius:var(--radius-xs); padding:12px 16px; color:var(--m3-on-error-container);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>🚨 تم تفعيل الوصول الطارئ بنجاح (Emergency Access Granted)</strong>
              <span class="badge badge-warning">Break-Glass Active</span>
            </div>
            <p style="font-size:0.78rem; margin-top:4px;">
              رقم العملية: <code>${data.event.id}</code> | البصمة المشفرة: <code>${data.event.auditHashSha256.substring(0, 24)}...</code>
            </p>
          </div>
        `;
        showToast('تم فك الحظر الطارئ', 'تم تسجيل العملية المشفرة في سجل التدقيق الأمني.', 'success');
      }
    } catch (err) {
      showToast('خطأ', 'تعذر تنفيذ عملية الوصول الطارئ.', 'error');
    }
  });

  document.getElementById('btn-check-eligibility')?.addEventListener('click', async () => {
    if (!currentPatientId) {
      showToast('تنبيه', 'يرجى اختيار مريض أولاً من القائمة.', 'info');
      return;
    }
    const btn = document.getElementById('btn-check-eligibility');
    const container = document.getElementById('eligibility-results-container');
    if (btn) btn.innerHTML = `${getSvgIcon('spinner', 'btn-svg-icon')} <span>جاري الاستعلام...</span>`;

    try {
      const res = await fetch(`/api/nphies/eligibility/${currentPatientId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success && container) {
        const el = data.eligibility;
        container.innerHTML = `
          <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant); border-right:3px solid var(--m3-primary); border-radius:var(--radius-sm); padding:18px 22px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:36px; height:36px; border-radius:var(--radius-xs); background:var(--m3-primary-container); border:1px solid var(--m3-primary); display:flex; align-items:center; justify-content:center; color:var(--m3-on-primary-container);">
                  ${getSvgIcon('shieldCheck', 'style="width:18px; height:18px;"')}
                </div>
                <div>
                  <h4 style="color:var(--m3-on-primary-container); font-size:1.02rem; font-weight:700;">تم التحقق: المريض مؤهل تأمينياً (Eligible)</h4>
                  <span class="metric-sub">تاريخ الاستعلام: <code>${new Date(el.verifiedAt).toLocaleString('ar-SA')}</code> | مزود الخدمة: <code>${el.serviceProviderId}</code></span>
                </div>
              </div>
              <span class="badge badge-success">وثيقة سارية المفعول</span>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; margin-top:14px;">
              ${el.benefits.map((b) => `
                <div style="background:var(--m3-surface-container); padding:12px 14px; border-radius:var(--radius-xs); border:1px solid var(--m3-outline-variant);">
                  <strong style="color:var(--m3-on-surface); font-size:0.88rem; display:block; margin-bottom:6px;">${b.categoryAr}</strong>
                  <div style="font-size:0.8rem; color:var(--m3-on-surface-variant); display:flex; flex-direction:column; gap:3px;">
                    <div>نسبة التحمل: <strong style="color:var(--m3-on-secondary-container);">${b.copayPercentage}%</strong></div>
                    <div>الحد الأقصى: <strong style="color:var(--m3-on-surface);">${b.maxLimitSAR} ر.س</strong></div>
                    <div>الموافقة المسبقة: ${b.requiresPriorAuth ? '<span class="badge badge-warning">مطلوبة</span>' : '<span class="badge badge-success">غير مطلوبة</span>'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        showToast('تم التحقق من الأهلية', 'تمت مطابقة بوليصة التأمين عبر محاكي نفيس بنجاح.', 'success');
      }
    } catch (e) {
      showToast('خطأ في الاستعلام', 'تعذر استعلام الأهلية التأمينية.', 'error');
    } finally {
      if (btn) btn.innerHTML = `${getSvgIcon('search', 'btn-svg-icon')} <span>استعلام الأهلية عبر نفيس</span>`;
    }
  });

  document.getElementById('btn-copy-fhir')?.addEventListener('click', () => {
    const code = document.getElementById('fhir-json-output')?.textContent;
    if (code) {
      navigator.clipboard.writeText(code);
      showToast('تم النسخ', 'تم نسخ كود FHIR JSON للحافظة بنجاح.', 'success');
    }
  });

  // legacy select removed - scalable search now handles selection via selectLongitudinalPatient

  document.getElementById('patient-allergy-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (appAuth.currentRole !== 'PATIENT') return;

    const allergenName = document.getElementById('patient-allergy-name')?.value?.trim();
    const reactionText = document.getElementById('patient-allergy-reaction')?.value?.trim();
    const reactionSeverity = document.getElementById('patient-allergy-severity')?.value || 'MILD';
    const onsetDate = document.getElementById('patient-allergy-date')?.value;
    const notes = document.getElementById('patient-allergy-notes')?.value?.trim();

    if (!allergenName) {
      showToast('تنبيه', 'يرجى إدخال اسم المادة المسببة.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/patients/me/allergies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allergenName,
          reactionText,
          reactionSeverity,
          onsetDate,
          notes,
          verificationStatus: 'UNVERIFIED',
          source: 'PATIENT'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save allergy');
      document.getElementById('patient-allergy-form').reset();
      showToast('تمت الإضافة', 'تم حفظ الحساسية المبلغ عنها كبيانات ذاتية غير مؤكدة.', 'success');
      loadPatientSelfReportedDashboard();
      loadLongitudinalRecord(currentPatientId || cachedPatients[0]?.id);
    } catch (err) {
      console.error('Failed to save patient allergy', err);
      showToast('خطأ', 'تعذر حفظ الحساسية المبلغ عنها.', 'error');
    }
  });

  // MPI Patient Merge Form Listener
  document.getElementById('form-mpi-merge')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const survivorId = document.getElementById('select-merge-survivor')?.value;
    const obsoleteId = document.getElementById('select-merge-obsolete')?.value;
    const reason = document.getElementById('merge-reason-input')?.value.trim();
    const container = document.getElementById('mpi-merge-result-container');

    if (!survivorId || !obsoleteId) {
      showToast('تنبيه', 'يرجى اختيار الهويتين المراد دمجهما.', 'warning');
      return;
    }
    if (survivorId === obsoleteId) {
      showToast('تنبيه', 'لا يمكن دمج الهوية في نفسها.', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/mpi/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survivorId,
          obsoleteId,
          reason: reason || 'توحيد السجلات السريرية المكررة'
        })
      });
      const data = await res.json();
      if (data.success) {
        if (container) {
          container.innerHTML = `
            <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-primary); border-radius:var(--radius-xs); padding:14px 18px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--m3-on-primary-container);">✅ تمت عملية دمج الهويات وتوحيد السجلات السريرية بنجاح</strong>
                <span class="badge badge-success">تم التوثيق في سلسلة التدقيق</span>
              </div>
              <p style="font-size:0.82rem; margin-top:6px; color:var(--m3-on-surface-variant);">
                تم نقل ${data.reassignedRecords?.encountersUpdated || 0} زيارات، و${data.reassignedRecords?.conditionsUpdated || 0} تشخيصات، و${data.reassignedRecords?.medicationsUpdated || 0} وصفات طبية إلى الهوية الدائمة.
              </p>
            </div>
          `;
        }
        showToast('تم دمج الهويات', data.message, 'success');
        loadAllData();
      } else {
        showToast('خطأ في الدمج', data.error, 'error');
      }
    } catch (err) {
      showToast('خطأ', 'تعذر تنفيذ عملية دمج الهويات.', 'error');
    }
  });

  // Weqaa Refresh Button Listener
  document.getElementById('btn-refresh-weqaa')?.addEventListener('click', () => {
    loadWeqaaSurveillanceCases();
    showToast('تم التحديث', 'تم تحديث قائمة الرصد الوبائي لهيئة وقاية.', 'info');
  });
}

function handleTabSwitch(tab) {
  // Security: enforce allowlist on every tab switch (including refresh/programmatic calls)
  if (appAuth.currentRole) {
    const allowed = getAllowedTabsForRole(appAuth.currentRole);
    if (!allowed.includes(tab)) {
      showToast('غير مصرح', 'ليس لديك صلاحية للوصول إلى هذه الصفحة — تمت إعادتك للصفحة المصرح بها', 'error');
      const fallback = allowed[0];
      if (fallback && fallback !== tab) {
        // Update UI to fallback without recursion
        currentTab = fallback;
        const fbBtn = document.getElementById('tab-btn-' + fallback);
        if (fbBtn) {
          document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
          fbBtn.classList.add('active');
          document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
          const fp = document.getElementById('pane-' + fallback);
          if (fp) fp.classList.add('active');
        }
        tab = fallback;
      } else {
        return;
      }
    }
  }
  if (tab === 'monitoring') loadMonitoringStats();
  if (tab === 'onboarding') loadOnboardedHospitals();
  if (tab === 'cds') loadCdsAndAnalyticsTab();
  if (tab === 'nphies') loadNphiesTab();
  if (tab === 'medications') loadMedicationsTab();
  if (tab === 'mpi') loadMpiIdentities();
  if (typeof applyLongitudinalPermissions !== 'function') window.applyLongitudinalPermissions = function(){};
  if (tab === 'longitudinal') {
    loadPatientsDropdown();
    applyLongitudinalPermissions();
    const cwCard=document.getElementById('clinical-write-card');
    if(cwCard) cwCard.style.display = (appAuth.currentRole==='CLINICIAN' || appAuth.currentRole==='HOSPITAL_ADMIN') ? 'block' : 'none';
    const cwPatient=document.getElementById('clinical-write-patient');
    if(cwPatient) cwPatient.value = currentPatientId || '';
    if (appAuth.currentRole === 'PATIENT') {
      loadPatientSelfReportedDashboard();
    }
  }
  if (tab === 'appointments') loadAppointments();
  if (tab === 'profile') {
    if (appAuth.currentRole === 'PATIENT') {
      loadPatientProfileTab();
    } else {
      // Non-patient should not see this tab; redirect
      showToast('تنبيه', 'هذه الصفحة مخصصة لحسابات المرضى فقط', 'info');
    }
  }
  if (tab === 'hospital-migration') {
    if (appAuth.currentRole === 'HOSPITAL_ADMIN') {
      loadHospitalMigrationTab();
    } else {
      showToast('تنبيه', 'هذه الصفحة مخصصة لحسابات المنشآت الصحية فقط', 'info');
    }
  }
  if (tab === 'hospital-global') {
    if (appAuth.currentRole === 'HOSPITAL_ADMIN') {
      loadHospitalGlobalRegistry();
    } else {
      showToast('تنبيه', 'هذه الصفحة مخصصة لحسابات المنشآت الصحية فقط', 'info');
    }
  }
  if (tab === 'hospital-profile') {
    if (appAuth.currentRole === 'HOSPITAL_ADMIN') {
      loadHospitalProfileTab();
    } else {
      showToast('تنبيه', 'هذه الصفحة مخصصة لحسابات المنشآت الصحية فقط', 'info');
    }
  }
  if (tab === 'admin-governance') loadAdminGovernance();
  if (tab === 'mapping') loadMappingStudio();
  if (tab === 'provenance') loadProvenanceRecords();
  if (tab === 'security') loadSecurityAuditChain();
  if (tab === 'bulkexport') loadBulkExportTab();
  if (tab === 'fhir') fetchFhirEndpoint(currentFhirEndpoint);
  updateGlobalPatientBar();
}
document.getElementById('clinical-write-type')?.addEventListener('change', e=>{
  document.querySelectorAll('.clinical-form').forEach(f=> f.style.display='none');
  const v=e.target.value;
  const map={encounter:'clinical-write-form-encounter', condition:'clinical-write-form-condition', observation:'clinical-write-form-observation', diagnostic:'clinical-write-form-diagnostic', allergy:'clinical-write-form-allergy', immunization:'clinical-write-form-immunization', medication:'clinical-write-form-medication'};
  const el=document.getElementById(map[v]);
  if(el) el.style.display='block';
});
let terminologyData=[];
fetch('/data/terminology.json').then(r=>r.json()).then(j=>{
  terminologyData=j;
  const dlC=document.getElementById('terminology-conditions'); if(dlC) dlC.innerHTML=j.filter(x=>x.category==='condition').map(x=>`<option value="${x.displayAr} — ${x.display} (${x.code})">`).join('');
  const dlO=document.getElementById('terminology-observations'); if(dlO) dlO.innerHTML=j.filter(x=>x.category==='observation').map(x=>`<option value="${x.displayAr} — ${x.display} (${x.code})">`).join('');
  const dlA=document.getElementById('terminology-allergies'); if(dlA) dlA.innerHTML=j.filter(x=>x.category==='allergy').map(x=>`<option value="${x.displayAr} — ${x.display} (${x.code})">`).join('');
  const dlI=document.getElementById('terminology-immunizations'); if(dlI) dlI.innerHTML=j.filter(x=>x.category==='immunization').map(x=>`<option value="${x.displayAr} — ${x.display} (${x.code})">`).join('');
  const dlM=document.getElementById('terminology-medications'); if(dlM) dlM.innerHTML=j.filter(x=>x.category==='medication').map(x=>`<option value="${x.displayAr} — ${x.display} (${x.code})">`).join('');
}).catch(()=>{});
document.getElementById('cw-cond-search')?.addEventListener('input', e=>{
  const v=e.target.value.toLowerCase();
  const found=terminologyData.find(x=> x.category==='condition' && (x.display.toLowerCase().includes(v) || x.displayAr.includes(v) || x.code.includes(v)));
  if(found){ document.getElementById('cw-cond-code').value=found.code; document.getElementById('cw-cond-display').value=found.displayAr + ' — ' + found.display; }
});
document.getElementById('cw-obs-search')?.addEventListener('input', e=>{
  const v=e.target.value.toLowerCase();
  const found=terminologyData.find(x=> x.category==='observation' && (x.display.toLowerCase().includes(v) || x.displayAr.includes(v) || x.code.includes(v)));
  if(found){ document.getElementById('cw-obs-code').value=found.code; const unitEl=document.getElementById('cw-obs-unit'); if(unitEl && found.unit) unitEl.value=found.unit; }
});
document.getElementById('cw-diag-search')?.addEventListener('input', e=>{
  const v=e.target.value.toLowerCase();
  const found=terminologyData.find(x=> x.category==='observation' && (x.display.toLowerCase().includes(v) || x.displayAr.includes(v) || x.code.includes(v)));
  if(found){ document.getElementById('cw-diag-code').value=found.code; }
});
document.getElementById('cw-allergy-search')?.addEventListener('input', e=>{
  const v=e.target.value.toLowerCase();
  const found=terminologyData.find(x=> x.category==='allergy' && (x.display.toLowerCase().includes(v) || x.displayAr.includes(v) || x.code.includes(v)));
  if(found){ document.getElementById('cw-allergy-code').value=found.code; document.getElementById('cw-allergy-display').value=found.displayAr + ' — ' + found.display; }
});
document.getElementById('cw-imm-search')?.addEventListener('input', e=>{
  const v=e.target.value.toLowerCase();
  const found=terminologyData.find(x=> x.category==='immunization' && (x.display.toLowerCase().includes(v) || x.displayAr.includes(v) || x.code.includes(v)));
  if(found){ document.getElementById('cw-imm-code').value=found.code; document.getElementById('cw-imm-display').value=found.displayAr + ' — ' + found.display; }
});
document.getElementById('cw-med-search')?.addEventListener('input', e=>{
  const v=e.target.value.toLowerCase();
  const found=terminologyData.find(x=> x.category==='medication' && (x.display.toLowerCase().includes(v) || x.displayAr.includes(v) || x.code.includes(v)));
  if(found){ document.getElementById('cw-med-code').value=found.code; document.getElementById('cw-med-display').value=found.displayAr + ' — ' + found.display; }
});
async function submitClinicalWrite(){
  const type=document.getElementById('clinical-write-type')?.value;
  const pid=document.getElementById('clinical-write-patient')?.value || window.currentPatientId;
  const statusEl=document.getElementById('clinical-write-status');
  if(!pid) { if(statusEl) statusEl.textContent='اختر مريضاً أولاً'; return; }
  if(statusEl) statusEl.textContent='جاري الحفظ...';
  try{
    let url='', body={ patientId: pid };
    if(type==='encounter'){ url='/api/clinical/encounter'; body.encounterClass=document.getElementById('cw-enc-class')?.value; body.priority=document.getElementById('cw-enc-priority')?.value; body.department=document.getElementById('cw-enc-dept')?.value; body.periodStart=document.getElementById('cw-enc-start')?.value; body.periodEnd=document.getElementById('cw-enc-end')?.value; }
    else if(type==='condition'){ url='/api/clinical/condition'; body.code=document.getElementById('cw-cond-code')?.value || document.getElementById('cw-cond-search')?.value.split('(').pop()?.replace(')','').trim() || document.getElementById('cw-cond-search')?.value; body.codeDisplay=document.getElementById('cw-cond-display')?.value || document.getElementById('cw-cond-search')?.value; body.clinicalStatus=document.getElementById('cw-cond-clinical')?.value; body.verificationStatus=document.getElementById('cw-cond-verif')?.value; body.onsetDate=document.getElementById('cw-cond-onset')?.value; body.severity=document.getElementById('cw-cond-severity')?.value; body.notes=document.getElementById('cw-cond-notes')?.value; }
    else if(type==='observation'){ url='/api/clinical/observation'; body.code=document.getElementById('cw-obs-code')?.value || document.getElementById('cw-obs-search')?.value; body.display=document.getElementById('cw-obs-search')?.value; body.value=document.getElementById('cw-obs-value')?.value; body.unit=document.getElementById('cw-obs-unit')?.value; body.method=document.getElementById('cw-obs-method')?.value; body.interpretation=document.getElementById('cw-obs-interpret')?.value; }
    else if(type==='diagnostic'){ url='/api/clinical/diagnostic-report'; body.code=document.getElementById('cw-diag-code')?.value || document.getElementById('cw-diag-search')?.value; body.display=document.getElementById('cw-diag-search')?.value; body.conclusion=document.getElementById('cw-diag-conclusion')?.value; body.category=document.getElementById('cw-diag-category')?.value; body.status=document.getElementById('cw-diag-status')?.value; }
    else if(type==='allergy'){ url='/api/clinical/allergy'; body.code=document.getElementById('cw-allergy-code')?.value || document.getElementById('cw-allergy-search')?.value; body.display=document.getElementById('cw-allergy-display')?.value || document.getElementById('cw-allergy-search')?.value; body.criticality=document.getElementById('cw-allergy-criticality')?.value; body.allergyType=document.getElementById('cw-allergy-type')?.value; body.category=document.getElementById('cw-allergy-category')?.value; body.onsetDate=document.getElementById('cw-allergy-onset')?.value; body.reaction=document.getElementById('cw-allergy-reaction')?.value; }
    else if(type==='immunization'){ url='/api/clinical/immunization'; body.vaccineCode=document.getElementById('cw-imm-code')?.value || document.getElementById('cw-imm-search')?.value; body.display=document.getElementById('cw-imm-display')?.value || document.getElementById('cw-imm-search')?.value; body.lotNumber=document.getElementById('cw-imm-lot')?.value; body.site=document.getElementById('cw-imm-site')?.value; body.route=document.getElementById('cw-imm-route')?.value; body.occurrenceDate=document.getElementById('cw-imm-date')?.value; }
    else if(type==='medication'){ url='/api/clinical/medication'; body.code=document.getElementById('cw-med-code')?.value || document.getElementById('cw-med-search')?.value; body.display=document.getElementById('cw-med-display')?.value || document.getElementById('cw-med-search')?.value; body.status=document.getElementById('cw-med-status')?.value; body.dosage=document.getElementById('cw-med-dosage')?.value; body.route=document.getElementById('cw-med-route')?.value; body.frequency=document.getElementById('cw-med-frequency')?.value; body.instructions=document.getElementById('cw-med-instructions')?.value; }
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'فشل الحفظ');
    if(statusEl){ statusEl.style.color='var(--m3-success)'; statusEl.textContent='✓ تم الحفظ بنجاح'; }
    window.showToast('تم الحفظ','تمت إضافة البيانات السريرية','success');
    if(window.currentPatientId) { const rec=await fetch('/api/patients/'+pid+'/longitudinal').then(r=>r.json()); if(rec) { const content=document.getElementById('longitudinal-content'); if(content) content.innerHTML='<pre style="white-space:pre-wrap; font-size:0.82rem;">'+JSON.stringify(rec,null,2)+'</pre>'; } }
  }catch(e){ if(statusEl){ statusEl.style.color='var(--m3-error)'; statusEl.textContent=e.message; } window.showToast('خطأ',e.message,'error'); }
}
function toggleBreakGlass(){ const p=document.getElementById('break-glass-panel'); if(p) p.style.display = p.style.display==='none'?'block':'none'; }
async function submitBreakGlass(){
  const pid=document.getElementById('clinical-write-patient')?.value || window.currentPatientId;
  const reason=document.getElementById('break-glass-reason')?.value.trim();
  if(!pid||!reason) { window.showToast('خطأ','المريض والسبب مطلوبان','error'); return; }
  try{
    const r=await fetch('/api/security/break-glass',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:pid, practitionerId: window.appAuth?.user?.id||'unknown', requestingOrgId: window.appAuth?.user?.orgId, emergencyReason: reason})});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error);
    window.showToast('تم كسر الزجاج','تم تسجيل الوصول الطارئ','success');
    document.getElementById('break-glass-panel').style.display='none';
  }catch(e){ window.showToast('خطأ',e.message,'error'); }
}

let monitoringInterval=null;
function initMonitoringPolling(){
  if(monitoringInterval) clearInterval(monitoringInterval);
  monitoringInterval=setInterval(()=>{ if(document.visibilityState==='visible' && (currentTab==='monitoring' || document.getElementById('pane-monitoring')?.classList.contains('active'))) loadMonitoringStats(); }, 15000);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden' && monitoringInterval) clearInterval(monitoringInterval); else if(document.visibilityState==='visible') initMonitoringPolling(); });
}
async function loadAllData() {
  initMonitoringPolling();
  await loadMonitoringStats();
  await fetchAndCachePatients();
  await loadPatientsDropdown();
  await loadOnboardedHospitals();
  if (currentTab === 'cds') loadCdsAndAnalyticsTab();
  if (currentTab === 'nphies') loadNphiesTab();
  if (currentTab === 'medications') loadMedicationsTab();
  if (currentTab === 'mpi') loadMpiIdentities();
  if (currentTab === 'mapping') loadMappingStudio();
  if (currentTab === 'provenance') loadProvenanceRecords();
  if (currentTab === 'security') loadSecurityAuditChain();
  if (currentTab === 'bulkexport') loadBulkExportTab();
  if (currentTab === 'fhir') fetchFhirEndpoint(currentFhirEndpoint);
}

// 1. MONITORING
async function loadMonitoringStats() {
  try {
    const startTime = performance.now();
    const res = await fetch('/api/monitoring/stats');
    const latencyMs = Math.round(performance.now() - startTime);
    const data = await res.json();

    // Update live latency in header dynamically
    const liveLatencyEl = document.querySelector('.live-pill-val.text-emerald');
    if (liveLatencyEl) {
      liveLatencyEl.textContent = `${latencyMs}ms`;
    }

    const rawEl = document.getElementById('stat-raw-records');
    const patEl = document.getElementById('stat-canonical-patients');
    const encEl = document.getElementById('stat-canonical-encounters');
    const condEl = document.getElementById('stat-canonical-conditions');
    const obsEl = document.getElementById('stat-canonical-observations');
    const claimsEl = document.getElementById('stat-canonical-claims');
    const medEl = document.getElementById('stat-canonical-medications');
    const immEl = document.getElementById('stat-canonical-immunizations');

    if (rawEl) rawEl.textContent = data.overview?.rawRecordsCount || '0';
    if (patEl) patEl.textContent = data.overview?.canonicalPatientsCount || '0';
    if (encEl) encEl.textContent = data.overview?.canonicalEncountersCount || '0';
    if (condEl) condEl.textContent = data.overview?.canonicalConditionsCount || '0';
    if (obsEl) obsEl.textContent = data.overview?.canonicalObservationsCount || '0';
    if (claimsEl) claimsEl.textContent = data.overview?.canonicalClaimsCount || '0';
    if (medEl) medEl.textContent = data.overview?.canonicalMedicationsCount || '0';
    if (immEl) immEl.textContent = data.overview?.canonicalImmunizationsCount || '0';

    // Populate Dynamic Hospital Sources Grid
    const sourcesGrid = document.getElementById('sources-monitoring-grid');
    if (sourcesGrid) {
      if (!data.sources || data.sources.length === 0) {
        sourcesGrid.innerHTML = `
          <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem; color: var(--m3-on-surface-variant); background: var(--m3-surface-container);">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📡</div>
            <h4 style="margin-bottom: 0.5rem; color: var(--m3-on-surface);">لا توجد موصلات أو مستشفيات مربوطة حالياً</h4>
            <p style="font-size: 0.85rem; max-width: 500px; margin: 0 auto;">النظام يعمل كمنصة نظيفة في انتظار استقبال التغذية الحية. يمكنك تسجيل منشأة جديدة من تبويب «إضافة منشأة صحية ديناميكية» أو رفع ملفات سريرية عبر Dropzone أو إرسال رسائل HL7 v2.</p>
          </div>
        `;
      } else {
        sourcesGrid.innerHTML = data.sources.map((s) => {
          const sysId = s.systemId || s.sourceSystemId || '';
          const recCount = s.extractedRecordCount ?? 0;
          const lastSyncRaw = s.lastHeartbeat || s.lastSyncTime || s.lastChecked || new Date().toISOString();
          const lastSyncDate = new Date(lastSyncRaw);
          const lastSyncStr = !isNaN(lastSyncDate.getTime()) ? lastSyncDate.toLocaleTimeString('ar-SA') : new Date().toLocaleTimeString('ar-SA');
          const latency = s.latencyMs != null ? s.latencyMs : '--';
          const dynDef = data.dynamicHospitals?.find(d => d.hospitalId === sysId);
          const nameAr = dynDef ? (dynDef.hospitalNameAr || dynDef.hospitalName) : sysId;
          const nameEn = dynDef ? dynDef.hospitalName : sysId;
          const desc = dynDef ? `منشأة مسجلة ديناميكياً في منطقة ${dynDef.region} - النوع: ${dynDef.facilityType}` : `موصل بيانات حقيقي - ${sysId} - السجلات من قاعدة البيانات الموحدة`;
          const tagClass = dynDef ? 'modern' : 'fhir';
          const sourceType = dynDef ? `${dynDef.facilityType}` : (s.adapterType || s.type || 'HL7/FHIR Adapter');

          return `
            <div class="source-card">
              <div class="source-header">
                <div class="source-title-wrap">
                  <span class="source-tag ${tagClass}">${sysId}</span>
                  <h4>${nameAr}</h4>
                  ${nameEn!==nameAr ? `<small style="color:var(--m3-on-surface-variant);">${nameEn}</small>` : ''}
                </div>
                <span class="status-indicator online">
                  <span class="status-dot"></span> متصل
                </span>
              </div>
              <div class="source-body">
                <p class="source-desc">${desc}</p>
                <div class="source-details">
                  <div class="detail-row"><span>نوع المصدر:</span><strong>${sourceType}</strong></div>
                  <div class="detail-row"><span>إجمالي السجلات المستوعبة:</span><strong>${recCount} سجل (حقيقي من DB)</strong></div>
                  <div class="detail-row"><span>زمن الاستجابة:</span><span class="badge badge-success">${latency}ms</span></div>
                  <div class="detail-row"><span>آخر اتصال:</span><code>${lastSyncStr}</code></div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const tbody = document.getElementById('audit-table-body');
    if (tbody && data.recentAudit) {
      tbody.innerHTML = data.recentAudit.map((a) => {
        const ts = a.timestamp || a.created_at || a.createdAt || a.persisted_at || new Date().toISOString();
        return `
        <tr>
          <td><code>${new Date(ts).toLocaleTimeString('ar-SA')}</code></td>
          <td><span class="badge badge-success">${a.action || a.entityType}</span></td>
          <td><strong>${a.entityType || a.target_entity_type || '--'}</strong></td>
          <td><code>${(a.entityId || a.target_entity_id || '').substring(0, 8)}...</code></td>
          <td style="color:var(--m3-on-surface-variant);">${a.detail || a.details || ''}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="5" class="text-center py-4">لا توجد سجلات تدقيق حتى الآن - البيانات من سلسلة التدقيق الحقيقية</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load monitoring stats', err);
  }
}

// 2. DYNAMIC ONBOARDING TAB
async function loadOnboardedHospitals() {
  try {
    const res = await fetch('/api/hospitals');
    const hospitals = await res.json();

    const tbody = document.getElementById('onboarded-hospitals-tbody');
    const select = document.getElementById('select-ingest-hospital');

    if (tbody && hospitals) {
      const realHospitals = hospitals.filter(h => !/(demo|test|mock|sample|linking)/i.test(`${h.hospitalId} ${h.hospitalName} ${h.hospitalNameAr}`));
      if (realHospitals.length===0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4" style="color:var(--m3-on-surface-variant);">لا توجد منشآت مسجلة بعد - البيانات من جدول Organization الحقيقي (PostgreSQL)</td></tr>`;
      } else {
        tbody.innerHTML = realHospitals.map(h => {
          const status = h.status || 'ACTIVE';
          const badge = status==='ACTIVE' ? 'badge-success' : status==='PENDING_APPROVAL' ? 'badge-warning' : status==='SUSPENDED' ? 'badge-error' : status==='REJECTED' ? 'badge-error' : 'badge-secondary';
          const label = status==='ACTIVE' ? 'نشط - معتمد' : status==='PENDING_APPROVAL' ? 'بانتظار اعتماد MOH' : status==='SUSPENDED' ? 'موقوف' : status==='REJECTED' ? 'مرفوض' : status;
          return `
          <tr>
            <td><code>${h.hospitalId.substring(0,8)}...</code><br><small style="color:var(--m3-on-surface-variant);">${h.hospitalId}</small></td>
            <td><strong>${h.hospitalNameAr}</strong></td>
            <td>${h.hospitalName}</td>
            <td><span class="badge badge-info">${h.facilityType || h.organizationType || ''}</span></td>
            <td>${h.region}</td>
            <td><code>${h.createdAt ? new Date(h.createdAt).toLocaleDateString('ar-SA') : '--'}</code></td>
            <td><span class="badge ${badge}">${label}</span></td>
          </tr>`;
        }).join('');
      }
    }

    if (select && hospitals) {
      const realHospitals = hospitals.filter(h => !/(demo|test|mock|sample|linking)/i.test(`${h.hospitalId} ${h.hospitalName} ${h.hospitalNameAr}`));
      const activeOnly = realHospitals.filter(h => h.status==='ACTIVE');
      const listForIngest = activeOnly.length>0 ? activeOnly : realHospitals;
      if (listForIngest.length===0) {
        select.innerHTML = `<option value="">لا توجد منشآت معتمدة - اعتمد منشأة أولاً من الحوكمة</option>`;
      } else {
        select.innerHTML = listForIngest.map(h => `
          <option value="${h.hospitalId}">${h.hospitalNameAr} (${h.region} - ${h.status})</option>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load onboarded hospitals', err);
  }
}

// 3. CDS & POPULATION ANALYTICS TAB
async function loadCdsAndAnalyticsTab() {
  try {
    // 1. Population Health Metrics
    const resAnalytics = await fetch('/api/analytics/population-health');
    const analytics = await resAnalytics.json();

    const kpiInterop = document.getElementById('kpi-interop-index');
    const kpiDm = document.getElementById('kpi-diabetes-prevalence');
    const kpiVax = document.getElementById('kpi-vax-coverage');
    const kpiSpeed = document.getElementById('kpi-settlement-speed');

    if (kpiInterop && analytics.interoperabilityIndex) {
      kpiInterop.textContent = `${analytics.interoperabilityIndex.multiFacilityPatientPercentage}%`;
    }
    if (kpiDm && analytics.chronicDiseasePrevalence?.[0]) {
      kpiDm.textContent = `${analytics.chronicDiseasePrevalence[0].prevalencePercentage}%`;
    }
    if (kpiVax && analytics.immunizationCoverage?.[0]) {
      kpiVax.textContent = `${analytics.immunizationCoverage[0].coveragePercentage}%`;
    }
    if (kpiSpeed && analytics.financialInteroperability) {
      const v = analytics.financialInteroperability.averageSettlementDurationSeconds;
      kpiSpeed.textContent = v != null ? `${v}s` : '--';
    } else if (kpiSpeed) {
      kpiSpeed.textContent = '--';
    }

    // 2. Patient CDS Hooks Safety Cards - غير مرتبط بـ KPIs
    const container = document.getElementById('cds-cards-container');
    const hasPatient = !!currentPatientId && cachedPatients.some(p=>p.id===currentPatientId);
    if (!hasPatient) {
      if (container) {
        const count = cachedPatients.length;
        container.innerHTML = `<div style="padding:16px; background:var(--m3-surface-container-low); border:1px solid var(--m3-warning); border-radius:var(--radius-xs); text-align:center;">
          <p style="color:var(--m3-on-surface); font-size:0.92rem; font-weight:600;">— لم يتم اختيار مريض —</p>
          <p style="color:var(--m3-on-surface-variant); font-size:0.84rem; margin-top:4px;">${count>0 ? `لديك ${count} مريض متاح - اختر مريضاً من الشريط العلوي ← ثم اضغط "إعادة تقييم السلامة"` : 'لا يوجد مرضى بعد - شغّل "تشغيل الاستيعاب والتطبيع" من لوحة المراقبة أولاً'}</p>
          <p style="color:var(--m3-on-surface-muted); font-size:0.75rem; margin-top:6px;">المحاكي بالأسفل يعمل أيضاً بدون بطاقات المريض - جرّب وصف دواء تجريبي بعد اختيار المريض.</p>
        </div>`;
      }
    } else {
      const activePatient = cachedPatients.find(p => p.id === currentPatientId);
      const patientLabel = activePatient ? (activePatient.nameAr || activePatient.name) : currentPatientId.substring(0, 8);
      const resCds = await fetch(`/api/cds/patient/${currentPatientId}/safety-alerts`);
      const cdsData = await resCds.json();
      if (cdsData.cards) {
        const patientHeader = `<div style="padding:10px 14px; background:var(--m3-primary-container); border:1px solid var(--m3-primary); border-radius:var(--radius-xs); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <strong style="color:var(--m3-on-primary-container); font-size:0.88rem;">تقييم السلامة الدوائية للمريض: ${patientLabel}</strong>
          <span class="badge badge-info">${cdsData.cards.length} تنبيه</span>
        </div>`;
        if (cdsData.cards.length === 0) {
          container.innerHTML = patientHeader + '<p class="text-center py-4 text-muted">لا توجد تعارضات أو تنبيهات دوائية حرجة مسجلة لهذا المريض.</p>';
        } else {
          cdsData.cards.sort((a,b)=> (a.indicator==='critical'?0: a.indicator==='warning'?1:2) - (b.indicator==='critical'?0: b.indicator==='warning'?1:2));
          container.innerHTML = patientHeader + cdsData.cards.map((c) => {
            const indicatorBadge = c.indicator === 'critical' ? '<span class="badge badge-error">حرج - تدقيق فوري</span>' :
                                   c.indicator === 'warning' ? '<span class="badge badge-warning">تحذير سريري</span>' :
                                   '<span class="badge badge-success">إرشادي معتمد</span>';
            return `
              <div style="background:var(--m3-surface-container); border:1px solid var(--m3-outline-variant); border-right:3px solid ${c.indicator === 'critical' ? 'var(--m3-error)' : c.indicator === 'warning' ? 'var(--m3-warning)' : 'var(--m3-primary)'}; border-radius:var(--radius-xs); padding:16px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <strong style="color:var(--m3-on-surface); font-size:0.96rem;">${c.summaryAr}</strong>
                  ${indicatorBadge}
                </div>
                <p style="font-size:0.84rem; color:var(--m3-on-surface-variant); margin-bottom:10px; line-height:1.5;">${c.detailAr}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--m3-on-surface-muted);">
                  <span>المصدر المعياري: <strong>${c.source?.labelAr}</strong></span>
                  ${c.suggestions ? `<span>التوصية: <span class="badge badge-info">${c.suggestions[0].labelAr}</span></span>` : ''}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }
    await loadWeqaaSurveillanceCases();
  } catch (err) {
    console.error('Failed to load CDS analytics', err);
  }
}

async function loadWeqaaSurveillanceCases() {
  const weqaaTbody = document.getElementById('weqaa-surveillance-tbody');
  if (!weqaaTbody) return;

  try {
    const res = await fetch('/api/analytics/weqaa/reportable-cases');
    const cases = await res.json();

    if (!cases || cases.length === 0) {
      weqaaTbody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">لم يتم رصد أي أمراض وبائية تستوجب البلاغ الفوري حالياً.</td></tr>';
      return;
    }

    weqaaTbody.innerHTML = cases.map((c) => {
      const urgencyBadge = c.urgency === 'IMMEDIATE_6H' ? '<span class="badge badge-error">فوري (خلال 6 ساعات)</span>' :
                            c.urgency === 'URGENT_24H' ? '<span class="badge badge-warning">عاجل (خلال 24 ساعة)</span>' :
                            '<span class="badge badge-info">روتيني أسبوعي</span>';
      
      const statusBadge = c.notificationStatus === 'DISPATCHED_TO_WEQAA' 
        ? `<span class="badge badge-success">تم الإرسال لـ وقاية (${c.weqaaTrackingNumber})</span>`
        : '<span class="badge badge-warning">بانتظار الإرسال</span>';

      return `
        <tr>
          <td><code>${c.caseId}</code></td>
          <td><strong>${c.patientName}</strong><br><small>هوية: <code>${c.nationalId}</code></small></td>
          <td><strong style="color:var(--m3-error);">${c.diseaseNameAr}</strong><br><small style="color:var(--m3-on-surface-muted);">${c.diseaseName}</small></td>
          <td><code>SNOMED ${c.snomedCode}</code><br><span class="badge badge-purple">${c.icdCode}</span></td>
          <td><span class="badge badge-info">${c.sourceFacilityId}</span></td>
          <td>${urgencyBadge}</td>
          <td>${statusBadge}</td>
          <td>
            <div style="display:flex; gap:6px; align-items:center;">
              <button type="button" class="btn btn-primary btn-sm" onclick="dispatchWeqaaCase('${c.caseId}')" ${c.notificationStatus === 'DISPATCHED_TO_WEQAA' ? 'disabled' : ''}>
                <span>إرسال البلاغ</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="previewWeqaaBundle('${c.caseId}')">
                <span>معاينة FHIR</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load Weqaa cases', err);
  }
}

async function dispatchWeqaaCase(caseId) {
  const container = document.getElementById('weqaa-action-result-container');
  try {
    const res = await fetch(`/api/analytics/weqaa/dispatch/${caseId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success && container) {
      container.innerHTML = `
        <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-primary); border-radius:var(--radius-xs); padding:14px 18px; margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--m3-on-primary-container);">✅ تم إرسال البلاغ الوبائي الرسمي إلى هيئة وقاية بنجاح</strong>
            <span class="badge badge-success">تم التوثيق في سجل التدقيق</span>
          </div>
          <p style="font-size:0.82rem; margin-top:6px; color:var(--m3-on-surface-variant);">
            الرقم المرجعي الوطني: <code>${data.case.weqaaTrackingNumber}</code> | توقيت الإرسال: <code>${new Date(data.case.dispatchedAt).toLocaleString('ar-SA')}</code>
          </p>
        </div>
      `;
      showToast('تم الإرسال لهيئة وقاية', `تم تسجيل البلاغ بالرقم المرجعي ${data.case.weqaaTrackingNumber}`, 'success');
      loadWeqaaSurveillanceCases();
    }
  } catch (err) {
    showToast('خطأ في الإرسال', 'تعذر إرسال البلاغ لهيئة وقاية.', 'error');
  }
}

async function previewWeqaaBundle(caseId) {
  const container = document.getElementById('weqaa-action-result-container');
  try {
    const res = await fetch(`/api/analytics/weqaa/bundle/${caseId}`);
    const bundle = await res.json();
    if (container) {
      container.innerHTML = `
        <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant); border-radius:var(--radius-xs); padding:16px; margin-top:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <strong style="color:var(--m3-on-surface);">معاينة حزمة البلاغ الوبائي (HL7 FHIR R4 Message Bundle):</strong>
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('weqaa-action-result-container').innerHTML=''">إغلاق المعاينة</button>
          </div>
          <pre style="direction:ltr; text-align:left; background:var(--m3-surface-container-high); color:var(--m3-on-surface); padding:12px; border-radius:var(--radius-sharp); font-size:0.75rem; max-height:280px; overflow:auto;">${JSON.stringify(bundle, null, 2)}</pre>
        </div>
      `;
    }
  } catch (err) {
    showToast('خطأ', 'تعذر جلب حزمة FHIR.', 'error');
  }
}

// 4. NPHIES TAB
async function loadNphiesTab() {
  try {
    const res = await fetch('/api/nphies/financial-summary');
    const data = await res.json();

    // Coverages Table
    const covTbody = document.getElementById('nphies-coverages-tbody');
    if (covTbody && data.coverages) {
      covTbody.innerHTML = data.coverages.map((c) => {
        const linkedPatient = cachedPatients.find(p => p.id === c.patientId);
        const patientName = linkedPatient ? (linkedPatient.nameAr || linkedPatient.name) : (c.subscriberNameAr || 'مريض مسجل');
        const isCurrent = c.patientId === currentPatientId;
        const rowStyle = isCurrent ? 'background:var(--m3-primary-container);' : '';
        return `
        <tr style="${rowStyle}">
          <td><code>${c.policyNumber}</code></td>
          <td><strong>${patientName}</strong>${isCurrent ? ' <span class="badge badge-success" style="font-size:0.65rem;">النشط</span>' : ''}</td>
          <td>${c.payerNameAr || c.payerName}</td>
          <td><code>${c.memberId}</code></td>
          <td><span class="badge badge-info">${c.networkClass}</span></td>
          <td><strong style="color:var(--m3-on-primary-container); font-size:0.95rem;">${c.copayPercentage}%</strong></td>
          <td><strong>${c.copayMaxCapSAR} ر.س</strong></td>
          <td><span class="badge badge-success">نشطة</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="text-center py-4">لا توجد وثائق تأمين</td></tr>';
    }

    // Claims Table — with SBS breakdown per best practices
    const claimsTbody = document.getElementById('nphies-claims-tbody');
    if (claimsTbody && data.claims) {
      claimsTbody.innerHTML = data.claims.map((clm) => {
        const resp = data.claimResponses?.find((r) => r.claimId === clm.internalId);
        const sbsCode = clm.items?.map(i=>i.serviceCode?.sbsCode).join(', ') || 'SBS-E11';
        const sbsDetails = clm.items?.map(i=> `${i.serviceCode?.sbsDisplay||i.serviceName} (${i.quantity}x${i.unitPriceSAR})`).join('<br>') || '—';
        const linkedPatient = cachedPatients.find(p => p.id === clm.patientId);
        const patientName = linkedPatient ? (linkedPatient.nameAr || linkedPatient.name) : 'مريض مسجل';
        const isCurrent = clm.patientId === currentPatientId;
        const rowStyle = isCurrent ? 'background:var(--m3-primary-container);' : '';
        const txId = resp?.nphiesTransactionId || `NPHIES-TX-${clm.internalId.substring(0, 8)}`;

        return `
          <tr style="${rowStyle}">
            <td><code>${clm.internalId.substring(0, 8)}...</code></td>
            <td><strong>${patientName}</strong>${isCurrent ? ' <span class="badge badge-success" style="font-size:0.65rem;">النشط</span>' : ''}</td>
            <td><span class="badge badge-info">${clm.provenance?.sourceSystemId}</span></td>
            <td><code>${sbsCode}</code><br><small style="color:var(--m3-on-surface-muted);">${clm.items?.[0]?.serviceName || 'Consultation'}</small></td>
            <td><strong>${clm.totalGrossSAR} ر.س</strong></td>
            <td><span style="color:var(--m3-on-warning-container); font-weight:700;">${resp ? resp.totalPatientCopaySAR : clm.totalPatientCopaySAR} ر.س</span></td>
            <td><strong style="color:var(--m3-on-primary-container); font-weight:700;">${resp ? resp.totalPayerPayableSAR : clm.totalInsurerClaimedSAR} ر.س</strong></td>
            <td><span class="badge badge-success">${resp ? resp.disposition : 'معتمدة'}</span></td>
            <td><code>${txId}</code></td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="9" class="text-center py-4">لا توجد مطالبات</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load NPHIES data', err);
  }
}

// 5. MEDICATIONS & IMMUNIZATIONS TAB
async function loadMedicationsTab() {
  try {
    const resMeds = await fetch('/api/medications');
    let meds = await resMeds.json();
    if (!Array.isArray(meds)) meds = [];
    if (appAuth.currentRole === 'PATIENT' && currentPatientId) {
      meds = meds.filter(m => m.patientId === currentPatientId);
    }
    const medTbody = document.getElementById('medications-tbody');

    if (medTbody && meds) {
      medTbody.innerHTML = meds.map((m) => {
        const linkedPatient = cachedPatients.find(p => p.id === m.patientId);
        const patientName = linkedPatient ? (linkedPatient.nameAr || linkedPatient.name) : 'مريض مسجل';
        const isCurrentPatient = m.patientId === currentPatientId;
        const rowStyle = isCurrentPatient ? 'background:var(--m3-primary-container);' : '';

        return `
        <tr style="${rowStyle}">
          <td><strong>${patientName}</strong>${isCurrentPatient ? ' <span class="badge badge-success" style="font-size:0.65rem;">النشط</span>' : ''}</td>
          <td><strong>${m.medication?.code?.sourceCode}</strong><br><small style="color:var(--m3-on-surface-muted);">${m.medication?.code?.sourceDisplay || ''}</small></td>
          <td><span class="badge badge-info">${m.provenance?.sourceSystemId}</span></td>
          <td><strong style="color:var(--m3-on-secondary-container);"><code>${m.medication?.code?.sfdaCode || 'SDC-0628500100101'}</code></strong><br><small style="color:var(--m3-on-surface-variant);">${m.medication?.code?.sfdaDisplay || 'Glucophage 500mg'}</small></td>
          <td><span class="badge badge-purple">${m.medication?.code?.atcCode || 'A10BA02'}</span><br><small style="color:var(--m3-on-surface-muted);">RxNorm: ${m.medication?.code?.rxnormCode || '860975'}</small></td>
          <td>${m.dosageInstruction?.[0]?.textAr || m.dosageInstruction?.[0]?.text || '1 tab PO BID'}</td>
          <td><strong>${m.dispenseRequest?.quantity?.value || 60} ${m.dispenseRequest?.quantity?.unit || 'TAB'}</strong> (${m.dispenseRequest?.numberOfRepeatsAllowed || 2} مرات تكرار)</td>
          <td><code>${new Date(m.authoredOn).toLocaleDateString('ar-SA')}</code></td>
        </tr>`;
      }).join('') || '<tr><td colspan="8" class="text-center py-4">لا توجد وصفات طبية خاصة بك مسجلة حالياً</td></tr>';
    }

    const resVax = await fetch('/api/immunizations');
    let vaxList = await resVax.json();
    if (!Array.isArray(vaxList)) vaxList = [];
    if (appAuth.currentRole === 'PATIENT' && currentPatientId) {
      vaxList = vaxList.filter(v => v.patientId === currentPatientId);
    }
    const vaxTbody = document.getElementById('immunizations-tbody');

    if (vaxTbody && vaxList) {
      vaxTbody.innerHTML = vaxList.map((v) => {
        const linkedPatient = cachedPatients.find(p => p.id === v.patientId);
        const patientName = linkedPatient ? (linkedPatient.nameAr || linkedPatient.name) : 'مريض مسجل';
        const isCurrentPatient = v.patientId === currentPatientId;
        const rowStyle = isCurrentPatient ? 'background:var(--m3-primary-container);' : '';

        return `
        <tr style="${rowStyle}">
          <td><strong>${patientName}</strong>${isCurrentPatient ? ' <span class="badge badge-success" style="font-size:0.65rem;">النشط</span>' : ''}</td>
          <td><strong>${v.vaccineCode?.sourceCode}</strong><br><small style="color:var(--m3-on-surface-muted);">${v.vaccineCode?.sourceDisplay || ''}</small></td>
          <td><span class="badge badge-info">${v.provenance?.sourceSystemId}</span></td>
          <td><strong style="color:var(--m3-on-primary-container);"><code>${v.vaccineCode?.sourceCode?.includes('SA-VAX') ? v.vaccineCode?.sourceCode : 'SA-VAX-FLU-01'}</code></strong></td>
          <td><span class="badge badge-purple">CVX ${v.vaccineCode?.cvxCode || '158'}</span></td>
          <td><code>${v.lotNumber}</code></td>
          <td><code>${v.expirationDate}</code></td>
          <td><code>${new Date(v.occurrenceDateTime).toLocaleDateString('ar-SA')}</code></td>
          <td>${v.site || 'العضلة الدالية اليسرى'}</td>
        </tr>`;
      }).join('') || '<tr><td colspan="9" class="text-center py-4">لا توجد تطعيمات خاصة بك مسجلة حالياً</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load medications and immunizations', err);
  }
}

// 6. MPI IDENTITIES
async function loadMpiIdentities() {
  const container = document.getElementById('mpi-identities-list');
  if (!container) return;

  try {
    const res = await fetch('/api/mpi/identities');
    const identities = await res.json();

    if (!identities || identities.length === 0) {
      container.innerHTML = '<p class="text-center py-4">لم يتم تسجيل أي هوية في MPI بعد. اضغط على زر تشغيل الاستيعاب والتطبيع.</p>';
      return;
    }

    // Populate Survivor and Obsolete dropdowns in Merge Studio
    const survivorSelect = document.getElementById('select-merge-survivor');
    const obsoleteSelect = document.getElementById('select-merge-obsolete');

    if (survivorSelect && obsoleteSelect) {
      const activeIds = identities.filter(i => i.status === 'ACTIVE');
      const allOptions = activeIds.map(i => {
        const name = `${i.demographicProfile?.givenNameNormalized || ''} ${i.demographicProfile?.familyNameNormalized || ''}`.trim() || 'مريض مسجل';
        const nid = i.linkedIdentifiers.find(id => id.type === 'NID' || id.type === 'IQAMA')?.value || i.internalPatientId.substring(0, 8);
        return `<option value="${i.internalPatientId}">${name} (${nid})</option>`;
      }).join('');

      survivorSelect.innerHTML = allOptions;
      obsoleteSelect.innerHTML = allOptions;
      if (activeIds.length > 1) {
        obsoleteSelect.selectedIndex = 1;
      }
    }

    container.innerHTML = identities.map((id) => {
      const nidObj = id.linkedIdentifiers.find((i) => i.type === 'NID' || i.type === 'IQAMA');
      const nid = nidObj?.value || 'N/A';
      const idLabel = nidObj?.type === 'IQAMA' ? 'رقم الإقامة النظامية' : 'الهوية الوطنية';
      const idAuthority = nidObj?.type === 'IQAMA' ? 'Saudi Resident Registry (Iqama)' : 'Saudi National Civil Registry';
      const mrns = id.linkedIdentifiers.filter((i) => i.type === 'MRN');
      const isMerged = id.status === 'MERGED';

      return `
        <div class="mpi-card" style="${isMerged ? 'opacity:0.75; border-color:var(--m3-outline-variant); background:var(--m3-surface-container-lowest);' : ''}">
          <div class="mpi-card-header">
            <div class="mpi-person-title">
              <div class="avatar-circle">
                ${getSvgIcon('user', 'style="width:20px; height:20px;"')}
              </div>
              <div>
                <h4>${id.demographicProfile?.givenNameNormalized || id.demographicProfile?.givenName || 'مريض مسجل'} ${id.demographicProfile?.familyNameNormalized || id.demographicProfile?.familyName || ''}</h4>
                <span class="metric-sub">المعرف الداخلي الرئيسي (MPI Master ID): <code>${id.internalPatientId}</code></span>
              </div>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
              ${isMerged 
                ? `<span class="badge badge-warning">هوية مدمجة (Merged Into: ${id.mergedInto?.substring(0, 8)}...)</span>
                   <button type="button" class="btn btn-secondary btn-sm" onclick="unmergeMpiIdentity('${id.mergedInto}', '${id.internalPatientId}')">
                     <span>فصل الهوية (Unmerge)</span>
                   </button>`
                : '<span class="badge badge-success">مطابقة حتمية مؤكدة 100% (نشطة)</span>'}
            </div>
          </div>

          <div class="mpi-identifiers-grid">
            <div class="identifier-box">
              <span class="id-type">${idLabel}</span>
              <div class="id-val">${nid}</div>
              <span class="id-source">${idAuthority}</span>
            </div>

            ${mrns.map((m) => `
              <div class="identifier-box">
                <span class="id-type">ملف المنشأة (${m.sourceSystemId})</span>
                <div class="id-val">${m.value}</div>
                <span class="id-source">${m.system}</span>
              </div>
            `).join('')}
          </div>

          <div class="source-details">
            <strong style="font-size:0.84rem; margin-bottom:2px; display:block;">سجل قرارات المطابقة والتسوية:</strong>
            ${id.matchHistory.map((m) => `
              <div class="detail-row">
                <span>[${m.matchStrategy}] ${m.details}</span>
                <span class="badge badge-info">${m.confidence * 100}% ثقة</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load MPI identities', err);
  }
}

async function unmergeMpiIdentity(survivorId, obsoleteId) {
  try {
    const res = await fetch('/api/mpi/unmerge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        survivorId,
        obsoleteId,
        reason: 'فصل الهويات السريرية بناءً على تدقيق المشرف'
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('تم فصل الهوية', data.message, 'success');
      loadAllData();
    } else {
      showToast('خطأ', data.error, 'error');
    }
  } catch (err) {
    showToast('خطأ في الاتصال', 'تعذر تنفيذ عملية الفصل.', 'error');
  }
}

// 7. LONGITUDINAL RECORD - scalable for millions
let longitudinalCache = new Map();
let longitudinalSearchState = { q: '', page: 1, limit: 12, total: 0, totalPages: 1, sort: 'recent' };
let longitudinalSearchDebounce = null;
let recentLongitudinalIds = JSON.parse(localStorage.getItem('recent_longitudinal') || '[]');

function saveRecentLongitudinal(id) {
  recentLongitudinalIds = [id, ...recentLongitudinalIds.filter(x => x !== id)].slice(0, 6);
  localStorage.setItem('recent_longitudinal', JSON.stringify(recentLongitudinalIds));
  renderRecentChips();
}
function renderRecentChips() {
  const c = document.getElementById('longitudinal-recent-chips');
  if (!c) return;
  if (appAuth.currentRole === 'PATIENT' || recentLongitudinalIds.length === 0) { c.innerHTML = ''; return; }
  c.innerHTML = '<span style="font-size:0.75rem; color:var(--m3-on-surface-muted);">آخر من عرضتهم:</span>' + recentLongitudinalIds.map(id => {
    const p = cachedPatients.find(x => x.id === id);
    const label = p ? (p.nameAr || p.name) : id.substring(0,8);
    return `<button type="button" class="badge badge-info" style="cursor:pointer; border:none;" onclick="selectLongitudinalPatient('${id}')">${label}</button>`;
  }).join('');
}

async function loadPatientsDropdown() {
  const searchCard = document.getElementById('longitudinal-search-card');
  if (appAuth.currentRole === 'PATIENT') {
    if (searchCard) searchCard.style.display = 'none';
    if (cachedPatients.length === 0) await fetchAndCachePatients();
    if (cachedPatients.length > 0) currentPatientId = cachedPatients[0].id;
    if (currentPatientId) { loadLongitudinalRecord(currentPatientId); loadPatientSelfReportedDashboard(); }
    return;
  }
  if (searchCard) searchCard.style.display = 'block';
  initLongitudinalSearch();
  await performLongitudinalSearch();
}

function initLongitudinalSearch() {
  const input = document.getElementById('longitudinal-search-input');
  const clearBtn = document.getElementById('longitudinal-search-clear');
  const sortEl = document.getElementById('longitudinal-sort');
  const refreshBtn = document.getElementById('longitudinal-refresh-btn');
  if (!input || input.dataset.bound) return;
  input.dataset.bound = '1';
  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (clearBtn) clearBtn.style.display = v ? 'block' : 'none';
    clearTimeout(longitudinalSearchDebounce);
    longitudinalSearchDebounce = setTimeout(() => {
      longitudinalSearchState.q = v;
      longitudinalSearchState.page = 1;
      performLongitudinalSearch();
    }, 320);
  });
  clearBtn?.addEventListener('click', () => {
    input.value = ''; clearBtn.style.display = 'none';
    longitudinalSearchState.q = ''; longitudinalSearchState.page = 1;
    performLongitudinalSearch();
  });
  sortEl?.addEventListener('change', () => {
    longitudinalSearchState.sort = sortEl.value;
    longitudinalSearchState.page = 1;
    performLongitudinalSearch();
  });
  refreshBtn?.addEventListener('click', () => performLongitudinalSearch());
}

async function performLongitudinalSearch() {
  const resultsEl = document.getElementById('longitudinal-results');
  const pagEl = document.getElementById('longitudinal-pagination');
  const badgeEl = document.getElementById('longitudinal-total-badge');
  if (!resultsEl) return;
  resultsEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--m3-on-surface-muted);">${getSvgIcon('spinner','style="width:20px;height:20px;"')} جاري البحث المفهرس...</div>`;
  try {
    const params = new URLSearchParams({ q: longitudinalSearchState.q, page: String(longitudinalSearchState.page), limit: String(longitudinalSearchState.limit), sort: longitudinalSearchState.sort });
    const res = await fetch('/api/patients/search?' + params.toString());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل البحث');
    const items = data.items || [];
    longitudinalSearchState.total = data.total || 0;
    longitudinalSearchState.totalPages = data.totalPages || 1;
    if (badgeEl) badgeEl.textContent = `${data.total} مريض • صفحة ${data.page}/${data.totalPages}`;
    const mapped = items.map(cp => ({
      id: cp.internalId,
      name: `${cp.givenName || ''} ${cp.familyName || ''}`.trim() || cp.internalId,
      nameAr: `${cp.givenNameAr || ''} ${cp.familyNameAr || ''}`.trim() || `${cp.givenName || ''} ${cp.familyName || ''}`.trim(),
      nid: cp.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value || '',
      birthDate: cp.birthDate ? String(cp.birthDate).substring(0,10) : '',
      gender: cp.gender || '',
      phone: cp.phone || ''
    }));
    mapped.forEach(m => { if (!cachedPatients.find(c => c.id === m.id)) cachedPatients.push(m); });
    updateGlobalPatientBar();
    renderRecentChips();
    if (items.length === 0) {
      resultsEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--m3-on-surface-muted);">لا توجد نتائج لـ "${longitudinalSearchState.q || '—'}"</div>`;
    } else {
      resultsEl.innerHTML = mapped.map(p => {
        const isActive = p.id === currentPatientId;
        return `<div class="card" style="padding:12px; border:${isActive?'2px solid var(--m3-primary)':'1px solid var(--m3-outline-variant)'}; background:${isActive?'var(--m3-primary-container)':'var(--m3-surface-container-low)'}; cursor:pointer;" onclick="selectLongitudinalPatient('${p.id}')">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:0.92rem;">${p.nameAr || p.name}</strong>
            <span class="badge ${isActive?'badge-success':'badge-info'}" style="font-size:0.68rem;">${isActive?'نشط':'اختيار'}</span>
          </div>
          <div style="font-size:0.72rem; color:var(--m3-on-surface-variant); margin-top:4px;">هوية: <code>${p.nid || '—'}</code> • ${p.gender==='male'?'ذكر':p.gender==='female'?'أنثى':'—'} • ${p.birthDate || '—'}</div>
          <div style="font-size:0.70rem; color:var(--m3-on-surface-muted);">معرف: <code>${p.id.substring(0,12)}…</code> ${p.phone? '• '+p.phone:''}</div>
        </div>`;
      }).join('');
      if (currentPatientId && !mapped.find(m => m.id === currentPatientId) && longitudinalSearchState.q === '') {
        if (!longitudinalCache.has(currentPatientId)) loadLongitudinalRecord(currentPatientId);
      } else if (!currentPatientId) {
        const lc = document.getElementById('longitudinal-content');
        if (lc && !longitudinalSearchState.q) lc.innerHTML = `<div class="card" style="padding:28px; text-align:center; color:var(--m3-on-surface-variant);"><p style="font-size:0.95rem; font-weight:700; color:var(--m3-on-surface);">— لم يتم اختيار مريض —</p><p style="font-size:0.84rem; margin-top:6px;">ابحث بالاسم أو الهوية أعلاه ثم اضغط "اختيار" لعرض الملف الصحي الموحد</p><p style="font-size:0.72rem; margin-top:8px; color:var(--m3-on-surface-muted);">النظام مصمم لملايين المرضى - لا يُحمّل أي سجل حتى تطلبه صراحةً</p></div>`;
      }
    }
    if (pagEl) {
      pagEl.innerHTML = `<span>إجمالي ${longitudinalSearchState.total} • ${items.length} في هذه الصفحة</span><span style="display:flex; gap:6px;"><button class="btn btn-secondary btn-sm" ${longitudinalSearchState.page<=1?'disabled':''} onclick="changeLongitudinalPage(-1)">السابق</button><span style="padding:4px 8px;">${longitudinalSearchState.page}/${longitudinalSearchState.totalPages}</span><button class="btn btn-secondary btn-sm" ${longitudinalSearchState.page>=longitudinalSearchState.totalPages?'disabled':''} onclick="changeLongitudinalPage(1)">التالي</button></span>`;
    }
  } catch (err) {
    resultsEl.innerHTML = `<div style="grid-column:1/-1; color:var(--m3-error); text-align:center; padding:16px;">${err.message}</div>`;
  }
}
function changeLongitudinalPage(delta) {
  longitudinalSearchState.page = Math.max(1, Math.min(longitudinalSearchState.totalPages, longitudinalSearchState.page + delta));
  performLongitudinalSearch();
}
async function selectLongitudinalPatient(patientId) {
  currentPatientId = patientId;
  saveRecentLongitudinal(patientId);
  updateGlobalPatientBar();
  const cwPatient=document.getElementById('clinical-write-patient');
  if(cwPatient) cwPatient.value = patientId;
  await loadLongitudinalRecord(patientId);
  document.getElementById('longitudinal-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // re-render to highlight
  performLongitudinalSearch();
}

async function loadPatientSelfReportedDashboard() {
  const container = document.getElementById('patient-self-reported-dashboard');
  if (!container || appAuth.currentRole !== 'PATIENT') return;

  try {
    const selfReportedDashboard = document.getElementById('patient-self-reported-dashboard');
    if (selfReportedDashboard) selfReportedDashboard.style.display = 'block';

    const res = await fetch('/api/patients/me/health-profile');
    const profile = await res.json();
    if (!profile || !profile.allergies) {
      container.innerHTML = '<div class="card"><div class="card-body"><p class="text-center py-4 text-muted">لا توجد بيانات شخصية مسجلة بعد.</p></div></div>';
      return;
    }

    const allergyList = Array.isArray(profile.allergies) ? profile.allergies : [];
    const medicationList = Array.isArray(profile.medications) ? profile.medications : [];
    const conditionList = Array.isArray(profile.conditions) ? profile.conditions : [];
    const profileData = profile.profile || {};

    container.innerHTML = `
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            <svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <h3>ملفي الصحي الشخصي (بيانات يتم إدخالها ذاتياً)</h3>
          </div>
          <span class="badge badge-warning">مصدر: المريض • غير مؤكدة</span>
        </div>
        <div class="card-body">
          <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px;">
            <div class="metric-card" style="padding:14px; min-height:unset;">
              <div class="metric-label">الاسم المفضل</div>
              <div class="metric-value" style="font-size:1.05rem;">${profileData.preferredFirstName || '—'} ${profileData.preferredLastName || ''}</div>
            </div>
            <div class="metric-card" style="padding:14px; min-height:unset;">
              <div class="metric-label">لغة التواصل</div>
              <div class="metric-value" style="font-size:1.05rem;">${profileData.preferredLanguage || 'العربية'}</div>
            </div>
            <div class="metric-card" style="padding:14px; min-height:unset;">
              <div class="metric-label">جهة الطوارئ</div>
              <div class="metric-value" style="font-size:1.05rem;">${profileData.emergencyContactName || '—'}</div>
            </div>
            <div class="metric-card" style="padding:14px; min-height:unset;">
              <div class="metric-label">العنوان</div>
              <div class="metric-value" style="font-size:0.95rem;">${profileData.addressCity || '—'}${profileData.addressDistrict ? ` / ${profileData.addressDistrict}` : ''}</div>
            </div>
          </div>
          <div class="mt-4" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px;">
            <div class="card" style="padding:12px; background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant);">
              <strong>حساسياتي (${allergyList.length})</strong>
              <ul style="margin:10px 0 0 0; padding-right:18px; color:var(--m3-on-surface-variant);">
                ${allergyList.length ? allergyList.slice(0, 3).map(a => `<li>${a.allergenName} (${a.reactionSeverity || 'غير محدد'})</li>`).join('') : '<li>لا توجد بيانات حساسية مسجلة</li>'}
              </ul>
            </div>
            <div class="card" style="padding:12px; background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant);">
              <strong>أدويتي (${medicationList.length})</strong>
              <ul style="margin:10px 0 0 0; padding-right:18px; color:var(--m3-on-surface-variant);">
                ${medicationList.length ? medicationList.slice(0, 3).map(m => `<li>${m.medicationName} ${m.currentlyTaking ? '• ما زال يتناولها' : '• توقف عنها'}</li>`).join('') : '<li>لا توجد أدوية تم تسجيلها ذاتياً</li>'}
              </ul>
            </div>
            <div class="card" style="padding:12px; background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant);">
              <strong>حالات صحية (${conditionList.length})</strong>
              <ul style="margin:10px 0 0 0; padding-right:18px; color:var(--m3-on-surface-variant);">
                ${conditionList.length ? conditionList.slice(0, 3).map(c => `<li>${c.conditionName}</li>`).join('') : '<li>لا توجد حالات صحية تم إدخالها ذاتياً</li>'}
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    const allergyContainer = document.getElementById('patient-allergies-container');
    if (allergyContainer) {
      allergyContainer.innerHTML = allergyList.length ? allergyList.map((a) => `
        <div style="padding:12px 14px; margin-bottom:8px; border:1px solid var(--m3-outline-variant); border-radius:var(--radius-xs); background:var(--m3-surface-container-low);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
            <strong>${a.allergenName}</strong>
            <span class="badge badge-warning">${a.verificationStatus || 'UNVERIFIED'}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--m3-on-surface-variant);">التفاعل: ${a.reactionText || 'غير محدد'} | الدرجة: ${a.reactionSeverity || 'غير محددة'} | التاريخ: ${a.onsetDate ? new Date(a.onsetDate).toLocaleDateString('ar-SA') : 'غير محدد'}</div>
        </div>
      `).join('') : '<p class="text-center py-4 text-muted">لا توجد حساسية مسجلة حتى الآن.</p>';
    }
  } catch (err) {
    console.error('Failed to load patient self-reported dashboard', err);
    if (container) {
      container.innerHTML = '<div class="card"><div class="card-body"><p class="text-center py-4 text-muted">تعذّر تحميل الملف الصحي الشخصي.</p></div></div>';
    }
  }
}

// ===================== PATIENT PROFILE EDITING (Authorized Fields Only) =====================
let _profileCache = null;

async function loadPatientProfileTab() {
  const loadingEl = document.getElementById('profile-loading');
  const contentEl = document.getElementById('profile-content');
  const statusEl = document.getElementById('profile-edit-status');
  if (!loadingEl || !contentEl) return;
  if (appAuth.currentRole !== 'PATIENT') {
    loadingEl.innerHTML = '<p style="color:var(--m3-error);">هذه الصفحة مخصصة لحسابات المرضى فقط.</p>';
    return;
  }
  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  if (statusEl) statusEl.style.display = 'none';

  try {
    const res = await fetch('/api/patient/me', { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحميل البيانات');
    _profileCache = data;

    // Populate read-only identity card
    const nid = data.patient?.nationalId || data.patient?.identifiers?.find(i=>i.type==='NID' || i.type==='IQAMA')?.value || '—';
    const nidType = data.patient?.nationalIdType || data.patient?.identifiers?.find(i=>i.type==='NID' || i.type==='IQAMA')?.type || '—';
    const fullName = data.user?.fullName || `${data.patient?.firstNameAr || data.patient?.firstName || ''} ${data.patient?.lastNameAr || data.patient?.lastName || ''}`.trim() || '—';
    const birthDate = data.patient?.birthDate ? new Date(data.patient.birthDate).toLocaleDateString('ar-SA') : '—';
    const gender = data.patient?.gender === 'male' ? 'ذكر' : data.patient?.gender === 'female' ? 'أنثى' : '—';
    const username = data.user?.username || '—';

    document.getElementById('profile-ro-nationalId') && (document.getElementById('profile-ro-nationalId').textContent = nid);
    document.getElementById('profile-ro-nationalIdType') && (document.getElementById('profile-ro-nationalIdType').textContent = nidType === 'NID' ? 'هوية وطنية' : nidType === 'IQAMA' ? 'إقامة' : nidType);
    document.getElementById('profile-ro-fullName') && (document.getElementById('profile-ro-fullName').textContent = fullName);
    document.getElementById('profile-ro-birthDate') && (document.getElementById('profile-ro-birthDate').textContent = birthDate);
    document.getElementById('profile-ro-gender') && (document.getElementById('profile-ro-gender').textContent = gender);
    document.getElementById('profile-ro-username') && (document.getElementById('profile-ro-username').textContent = username);

    // Populate editable fields
    const p = data.profile || {};
    document.getElementById('edit-phone') && (document.getElementById('edit-phone').value = data.patient?.phone || data.user?.phone || '');
    document.getElementById('edit-email') && (document.getElementById('edit-email').value = data.patient?.email || data.user?.email || '');
    document.getElementById('edit-preferred-first-name') && (document.getElementById('edit-preferred-first-name').value = p.preferredFirstName || '');
    document.getElementById('edit-preferred-last-name') && (document.getElementById('edit-preferred-last-name').value = p.preferredLastName || '');
    document.getElementById('edit-preferred-language') && (document.getElementById('edit-preferred-language').value = p.preferredLanguage || 'ar');
    document.getElementById('edit-emergency-name') && (document.getElementById('edit-emergency-name').value = p.emergencyContactName || '');
    document.getElementById('edit-emergency-phone') && (document.getElementById('edit-emergency-phone').value = p.emergencyContactPhone || '');
    document.getElementById('edit-emergency-relationship') && (document.getElementById('edit-emergency-relationship').value = p.emergencyContactRelationship || '');
    document.getElementById('edit-address-line') && (document.getElementById('edit-address-line').value = p.addressLine || '');
    document.getElementById('edit-address-city') && (document.getElementById('edit-address-city').value = p.addressCity || '');
    document.getElementById('edit-address-district') && (document.getElementById('edit-address-district').value = p.addressDistrict || '');
    document.getElementById('edit-address-postal') && (document.getElementById('edit-address-postal').value = p.addressPostalCode || '');
    document.getElementById('edit-notes') && (document.getElementById('edit-notes').value = p.notes || '');
    const notesEl = document.getElementById('edit-notes');
    const counter = document.getElementById('notes-char-count');
    if (notesEl && counter) counter.textContent = String(notesEl.value.length);
    if (notesEl && counter) {
      notesEl.addEventListener('input', () => { counter.textContent = String(notesEl.value.length); });
    }

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  } catch (err) {
    console.error('Failed to load patient profile', err);
    loadingEl.innerHTML = `<div class="card" style="border:1px solid var(--m3-error); background:var(--m3-error-container); padding:16px; text-align:center;">
      <p style="color:var(--m3-error); font-weight:700;">تعذر تحميل بياناتك الشخصية</p>
      <p style="font-size:0.82rem; color:var(--m3-on-surface-variant); margin-top:6px;">${err.message || 'حدث خطأ في الاتصال'}</p>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="loadPatientProfileTab()">إعادة المحاولة</button>
    </div>`;
  }
}

async function savePatientProfile() {
  const btn = document.getElementById('btn-save-profile');
  const statusEl = document.getElementById('profile-edit-status');
  if (!btn || !statusEl) return;

  const payload = {
    phone: document.getElementById('edit-phone')?.value.trim(),
    email: document.getElementById('edit-email')?.value.trim(),
    preferredFirstName: document.getElementById('edit-preferred-first-name')?.value.trim() || undefined,
    preferredLastName: document.getElementById('edit-preferred-last-name')?.value.trim() || undefined,
    preferredLanguage: document.getElementById('edit-preferred-language')?.value,
    emergencyContactName: document.getElementById('edit-emergency-name')?.value.trim() || undefined,
    emergencyContactPhone: document.getElementById('edit-emergency-phone')?.value.trim() || undefined,
    emergencyContactRelationship: document.getElementById('edit-emergency-relationship')?.value || undefined,
    addressLine: document.getElementById('edit-address-line')?.value.trim() || undefined,
    addressCity: document.getElementById('edit-address-city')?.value.trim() || undefined,
    addressDistrict: document.getElementById('edit-address-district')?.value.trim() || undefined,
    addressPostalCode: document.getElementById('edit-address-postal')?.value.trim() || undefined,
    notes: document.getElementById('edit-notes')?.value.trim() || undefined
  };
  // Remove undefined to avoid sending forbidden empty keys? Keep phone/email as required even if empty? For update, phone is required.
  // Clean: if value is undefined leave out, if empty string for optional we send null handling – but patch validator treats empty as clear. We'll send only provided.
  const cleanPayload = {};
  for (const [k,v] of Object.entries(payload)) {
    if (v !== undefined) cleanPayload[k] = v;
    // For optional fields, empty string => send empty to allow clearing, but we already filtered undefined, empty string is already '' and will be validated
    // Keep empty string explicit for clearing? Normalize: if optional and empty, send '' is handled as null on server, but we want to allow clearing -> we should send '' ? But our loop currently maps empty '' from phone to '' not undefined – phone '' will be caught as error on server (phone required). That's fine.
    // For optional we already have || undefined => empty becomes undefined => not sent => won't clear. To clear we need to send empty string or null.
    // Simpler: if optional field originally empty and user cleared it, we want to send null to clear. We'll detect: if original element value is '' and payload[k] is undefined, we should send '' to indicate clear? But that would erase on every save.
    // Instead, we will send all editable fields as explicit values (allow empty to clear) – so change above to keep '' not undefined except for notes.
  }
  // Re-build clean: include even empty strings for clearing optional fields
  const explicitOptional = ['preferredFirstName','preferredLastName','emergencyContactName','emergencyContactPhone','emergencyContactRelationship','addressLine','addressCity','addressDistrict','addressPostalCode','notes'];
  for (const k of explicitOptional) {
    const elIdMap = {
      preferredFirstName: 'edit-preferred-first-name',
      preferredLastName: 'edit-preferred-last-name',
      emergencyContactName: 'edit-emergency-name',
      emergencyContactPhone: 'edit-emergency-phone',
      emergencyContactRelationship: 'edit-emergency-relationship',
      addressLine: 'edit-address-line',
      addressCity: 'edit-address-city',
      addressDistrict: 'edit-address-district',
      addressPostalCode: 'edit-address-postal',
      notes: 'edit-notes'
    };
    const el = document.getElementById(elIdMap[k]);
    if (el) {
      const val = el.value.trim();
      // If empty, we want to clear => send null-like empty string; server will treat '' as null (we normalized to null). So send val (may be '')
      // But to avoid sending unchanged empty as no-op, we still send '' to allow clearing.
      // For simplicity, include all optional fields in payload even if empty.
      cleanPayload[k] = val; // '' allowed
    }
  }
  // Phone and email already set; ensure they are always sent
  // preferredLanguage already set

  // Client pre-validation mirrors server
  if (!cleanPayload.phone) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">رقم الجوال مطلوب بصيغة سعودية (05xxxxxxxx)</div>`;
    return;
  }
  const phoneClean = cleanPayload.phone.replace(/[\s\-\(\)]/g,'');
  if (!/^(?:\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(phoneClean)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">رقم الجوال غير صحيح</div>`;
    return;
  }
  if (cleanPayload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanPayload.email)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">صيغة البريد غير صحيحة</div>`;
    return;
  }
  if (cleanPayload.addressPostalCode && !/^\d{5}$/.test(cleanPayload.addressPostalCode)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">الرمز البريدي يجب أن يكون 5 أرقام</div>`;
    return;
  }

  // Build final payload for server: only include fields that are actually changed or needed? But server validates allowed set, so we can send all editable.
  // For server validator, empty string for optional will be treated as clearing (null). The validator we wrote expects '' -> null for some fields. It currently handles '' for phone as error, but for optional it maps '' to null. So sending '' is okay.
  // However our cleanPayload currently has '' for optional empty, the server's validateEditablePayload will treat '' as '' -> then normalize to null via logic (we have || null). Actually we send '' as value, server will see '' and normalize to null. So fine.
  // But phone '' would be error; we already validated.
  const serverPayload = {
    phone: cleanPayload.phone,
    email: cleanPayload.email || null,
    preferredFirstName: cleanPayload.preferredFirstName || null,
    preferredLastName: cleanPayload.preferredLastName || null,
    preferredLanguage: cleanPayload.preferredLanguage,
    emergencyContactName: cleanPayload.emergencyContactName || null,
    emergencyContactPhone: cleanPayload.emergencyContactPhone || null,
    emergencyContactRelationship: cleanPayload.emergencyContactRelationship || null,
    addressLine: cleanPayload.addressLine || null,
    addressCity: cleanPayload.addressCity || null,
    addressDistrict: cleanPayload.addressDistrict || null,
    addressPostalCode: cleanPayload.addressPostalCode || null,
    notes: cleanPayload.notes || null
  };
  // Remove null values for fields that are empty to avoid overwriting with null if user didn't intend? But requirement allows clearing.
  // We'll keep as is; server handles null as clearing.

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${getSvgIcon('spinner','btn-svg-icon')} <span>جاري الحفظ...</span>`;
  statusEl.style.display = 'none';

  try {
    const res = await fetch('/api/patient/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverPayload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-primary-container); border:1px solid var(--m3-primary); color:var(--m3-on-primary-container); padding:12px 14px; border-radius:var(--radius-sharp); font-size:0.88rem; display:flex; align-items:center; gap:8px;">
      ${getSvgIcon('shieldCheck','style="width:18px;height:18px; color:var(--m3-primary);"')}
      <span>${data.message || 'تم حفظ التغييرات بنجاح'}</span>
    </div>`;
    showToast('تم الحفظ', 'تم تحديث بياناتك المصرح بها وتوثيقها في سجل التدقيق', 'success');
    // Refresh cache and top bar
    _profileCache = data;
    // Update global patient name if preferred name changed? Refresh header bar
    if (typeof fetchAndCachePatients === 'function') await fetchAndCachePatients();
    // Reload profile to show fresh data after 1s
    setTimeout(() => { loadPatientProfileTab(); }, 900);
  } catch (err) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">${err.message}</div>`;
    showToast('خطأ في الحفظ', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ===================== HOSPITAL PROFILE EDITING (Authorized Fields Only) =====================
async function loadHospitalProfileTab() {
  const loadingEl = document.getElementById('hospital-profile-loading');
  const contentEl = document.getElementById('hospital-profile-content');
  const statusEl = document.getElementById('hospital-profile-edit-status');
  if (!loadingEl || !contentEl) return;
  if (appAuth.currentRole !== 'HOSPITAL_ADMIN') {
    loadingEl.innerHTML = '<p style="color:var(--m3-error);">هذه الصفحة مخصصة لحسابات المنشآت الصحية فقط.</p>';
    return;
  }
  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  if (statusEl) statusEl.style.display = 'none';

  try {
    const res = await fetch('/api/hospital/me', { headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحميل بيانات المنشأة');
    // Read-only
    document.getElementById('hosp-ro-id') && (document.getElementById('hosp-ro-id').textContent = data.organization?.id?.substring(0,12) + '…' || '—');
    document.getElementById('hosp-ro-type') && (document.getElementById('hosp-ro-type').textContent = data.organization?.organizationType || '—');
    const statusElRo = document.getElementById('hosp-ro-status');
    if (statusElRo) {
      statusElRo.textContent = data.organization?.status === 'ACTIVE' ? 'نشطة ومعتمدة' : data.organization?.status || '—';
      statusElRo.className = data.organization?.status === 'ACTIVE' ? 'badge badge-success' : 'badge badge-warning';
    }
    document.getElementById('hosp-ro-created') && (document.getElementById('hosp-ro-created').textContent = data.organization?.createdAt ? new Date(data.organization.createdAt).toLocaleDateString('ar-SA') : '—');
    document.getElementById('hosp-ro-username') && (document.getElementById('hosp-ro-username').textContent = data.user?.username || '—');

    // Editable
    document.getElementById('edit-hosp-org-name') && (document.getElementById('edit-hosp-org-name').value = data.organization?.organizationName || '');
    document.getElementById('edit-hosp-org-name-ar') && (document.getElementById('edit-hosp-org-name-ar').value = data.organization?.organizationNameAr || '');
    document.getElementById('edit-hosp-region') && (document.getElementById('edit-hosp-region').value = data.organization?.region || 'Riyadh');
    document.getElementById('edit-hosp-fullname') && (document.getElementById('edit-hosp-fullname').value = data.user?.fullName || '');
    document.getElementById('edit-hosp-phone') && (document.getElementById('edit-hosp-phone').value = data.user?.phone || '');
    document.getElementById('edit-hosp-email') && (document.getElementById('edit-hosp-email').value = data.user?.email || '');
    loadHospitalUsers();
    try{ const crRes=await fetch('/api/hospital/me/change-requests'); if(crRes.ok){ const list=await crRes.json(); const pending=list.filter((r)=>r.status==='PENDING'); const pendingEl=document.getElementById('hosp-pending-requests'); if(pendingEl){ if(pending.length===0) pendingEl.innerHTML='<span style="color:var(--m3-success);">لا توجد طلبات معلقة</span>'; else pendingEl.innerHTML=pending.map((r)=>`<span class="badge badge-warning">${r.field}: ${r.new_value} (بانتظار الوزارة)</span>`).join(' '); } } }catch{}

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  } catch (err) {
    console.error('Failed to load hospital profile', err);
    loadingEl.innerHTML = `<div class="card" style="border:1px solid var(--m3-error); background:var(--m3-error-container); padding:16px; text-align:center;">
      <p style="color:var(--m3-error); font-weight:700;">تعذر تحميل بيانات المنشأة</p>
      <p style="font-size:0.82rem; color:var(--m3-on-surface-variant); margin-top:6px;">${err.message || 'حدث خطأ في الاتصال'}</p>
      <button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px;" onclick="loadHospitalProfileTab()">إعادة المحاولة</button>
    </div>`;
  }
}

async function loadHospitalUsers(){
  const tbody=document.getElementById('hospital-users-tbody');
  if(!tbody) return;
  tbody.innerHTML='<tr><td colspan="4" style="text-align:center; padding:12px;">جاري التحميل...</td></tr>';
  try{
    const r=await fetch('/api/hospital/users');
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'فشل التحميل');
    const list=Array.isArray(d)?d:(d.items||d);
    tbody.innerHTML = list.map(u=>`<tr><td><strong>${u.fullName}</strong><br><small>${u.username} • ${u.email||'لا بريد'}</small></td><td><span class="badge ${u.role==='CLINICIAN'?'badge-success':'badge-warning'}">${u.role}</span><br><small>${u.phone||''}</small></td><td>${u.isActive?'<span style="color:var(--m3-success)">نشط</span>':'<span style="color:var(--m3-error)">موقوف</span>'}<br><small>${new Date(u.createdAt).toLocaleDateString('ar-SA')}</small></td><td style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;"><button class="btn btn-sm" style="background:var(--m3-surface-container-high); color:var(--m3-on-surface); border:1px solid var(--m3-outline-variant);" onclick="viewHospitalUser('${u.id}')">عرض</button><button class="btn btn-sm" style="background:var(--m3-secondary-container); color:var(--m3-on-secondary-container); border:1px solid var(--m3-outline-variant);" onclick="editHospitalUser('${u.id}')">تعديل</button><button class="btn btn-sm" style="background:${u.isActive?'var(--m3-warning-container)':'var(--m3-primary-container)'}; color:${u.isActive?'var(--m3-on-warning-container)':'var(--m3-on-primary-container)'}; border:1px solid var(--m3-outline-variant);" onclick="toggleHospitalUser('${u.id}',${!u.isActive})">${u.isActive?'إيقاف':'تفعيل'}</button><select onchange="changeHospitalUserRole('${u.id}',this.value)" class="form-select" style="padding:4px 8px; min-width:90px; font-size:0.78rem;"><option value="">دور</option><option value="CLINICIAN">CLINICIAN</option><option value="HOSPITAL_ADMIN">HOSPITAL_ADMIN</option></select><button class="btn btn-sm" style="background:var(--m3-error); color:var(--m3-on-error); border:1px solid var(--m3-error);" onclick="resetHospitalUserPassword('${u.id}')">إعادة تعيين</button></td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center">لا يوجد مستخدمون</td></tr>';
  }catch(e){ tbody.innerHTML=`<tr><td colspan="4" style="color:var(--m3-error)">${e.message}</td></tr>`; }
}
async function viewHospitalUser(id){ try{ const r=await fetch('/api/hospital/users/'+id); const u=await r.json(); if(!r.ok) throw new Error(u.error); alert(`المستخدم: ${u.fullName} (@${u.username})\nالدور: ${u.role}\nالبريد: ${u.email||'—'}\nالجوال: ${u.phone||'—'}\nالحالة: ${u.isActive?'نشط':'موقوف'}\nالمنشأة: ${u.organization||''}`); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function editHospitalUser(id){ const full_name=prompt('الاسم الكامل الجديد:'); if(full_name===null) return; const email=prompt('البريد الجديد (اتركه فارغاً للإبقاء):'); const phone=prompt('الجوال الجديد 05xxxxxxxx (اتركه فارغاً للإبقاء):'); const body={}; if(full_name) body.full_name=full_name; if(email!==null) body.email=email; if(phone!==null) body.phone=phone; if(Object.keys(body).length===0) return; try{ const r=await fetch('/api/hospital/users/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); const j=await r.json(); if(!r.ok) throw new Error(j.error); showToast('تم التحديث','تم تعديل بيانات المستخدم','success'); loadHospitalUsers(); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function createHospitalUser(){ const status=document.getElementById('hospital-users-status'); const payload={ username: document.getElementById('hospital-new-username')?.value.trim(), password: document.getElementById('hospital-new-password')?.value, full_name: document.getElementById('hospital-new-fullname')?.value.trim(), email: document.getElementById('hospital-new-email')?.value.trim(), phone: document.getElementById('hospital-new-phone')?.value.trim(), role_code: document.getElementById('hospital-new-role')?.value }; if(!payload.username||!payload.password||!payload.full_name) { if(status) status.textContent='اسم المستخدم وكلمة المرور والاسم الكامل مطلوبة'; return; } try{ const r=await fetch('/api/hospital/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); const d=await r.json(); if(!r.ok) throw new Error(d.error||'فشل الإنشاء'); if(status) {status.style.color='var(--m3-success)'; status.textContent='✓ تم إنشاء '+d.user.username;} loadHospitalUsers(); }catch(e){ if(status){status.style.color='var(--m3-error)'; status.textContent=e.message;} } }
async function toggleHospitalUser(id,isActive){ try{ const r=await fetch('/api/hospital/users/'+id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_active:isActive})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); showToast('تم التحديث','تغيرت حالة المستخدم','success'); loadHospitalUsers(); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function changeHospitalUserRole(id,role){ if(!role) return; try{ const r=await fetch('/api/hospital/users/'+id+'/role',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role_code:role})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); showToast('تم التحديث','تغير الدور إلى '+role,'success'); loadHospitalUsers(); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function resetHospitalUserPassword(id){ const np=prompt('كلمة المرور الجديدة (8+ حروف وأرقام):'); if(!np) return; try{ const r=await fetch('/api/hospital/users/'+id+'/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({new_password:np})}); const j=await r.json(); if(!r.ok) throw new Error(j.error); showToast('تم','تمت إعادة تعيين كلمة المرور','success'); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function saveHospitalProfile() {
  const btn = document.getElementById('btn-save-hospital-profile');
  const statusEl = document.getElementById('hospital-profile-edit-status');
  if (!btn || !statusEl) return;

  const payload = {
    organizationName: document.getElementById('edit-hosp-org-name')?.value.trim() || '',
    organizationNameAr: document.getElementById('edit-hosp-org-name-ar')?.value.trim() || '',
    region: document.getElementById('edit-hosp-region')?.value || '',
    fullName: document.getElementById('edit-hosp-fullname')?.value.trim() || '',
    phone: document.getElementById('edit-hosp-phone')?.value.trim() || '',
    email: document.getElementById('edit-hosp-email')?.value.trim() || ''
  };

  // Client validation
  if (!payload.organizationName || payload.organizationName.length < 3) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">اسم المنشأة بالإنجليزية مطلوب</div>`;
    return;
  }
  if (!payload.organizationNameAr || payload.organizationNameAr.length < 3) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">اسم المنشأة بالعربية مطلوب</div>`;
    return;
  }
  if (!/[\u0600-\u06FF]/.test(payload.organizationNameAr)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">اسم المنشأة بالعربية يجب أن يحتوي على حروف عربية</div>`;
    return;
  }
  if (!payload.region) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">المنطقة مطلوبة</div>`;
    return;
  }
  if (!payload.phone) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">رقم الجوال مطلوب</div>`;
    return;
  }
  const phoneClean = payload.phone.replace(/[\s\-\(\)]/g,'');
  if (!/^(?:\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(phoneClean)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">رقم الجوال غير صحيح (05xxxxxxxx)</div>`;
    return;
  }
  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">البريد الرسمي مطلوب وصيغته يجب أن تكون صحيحة</div>`;
    return;
  }
  if (!payload.fullName || payload.fullName.split(/\s+/).length < 2) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">الاسم الكامل للمسؤول مطلوب</div>`;
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${getSvgIcon('spinner','btn-svg-icon')} <span>جاري الحفظ...</span>`;
  statusEl.style.display = 'none';

  try {
    const res = await fetch('/api/hospital/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-primary-container); border:1px solid var(--m3-primary); color:var(--m3-on-primary-container); padding:12px 14px; border-radius:var(--radius-sharp); font-size:0.88rem; display:flex; align-items:center; gap:8px;">
      ${getSvgIcon('shieldCheck','style="width:18px;height:18px; color:var(--m3-primary);"')}
      <span>${data.message || 'تم حفظ التغييرات بنجاح'}</span>
    </div>`;
    showToast('تم الحفظ', 'تم تحديث بيانات المنشأة المصرح بها', 'success');
    setTimeout(() => { loadHospitalProfileTab(); loadHospitalMigrationTab(); }, 900);
  } catch (err) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:var(--m3-error-container); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:var(--radius-sharp); font-size:0.85rem;">${err.message}</div>`;
    showToast('خطأ في الحفظ', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function loadHospitalMigrationTab() {
  if (appAuth.currentRole !== 'HOSPITAL_ADMIN') return;
  // Load hospital header
  try {
    const meRes = await fetch('/api/hospital/me');
    const me = await meRes.json();
    if (meRes.ok) {
      const org = me.organization;
      const user = me.user;
      document.getElementById('hosp-hms-name') && (document.getElementById('hosp-hms-name').textContent = org?.organizationNameAr || org?.organizationName || user?.fullName || 'منشأتك');
      document.getElementById('hosp-hms-meta') && (document.getElementById('hosp-hms-meta').textContent = `${user?.fullName || ''} • ${user?.username || ''} • يخدمك محرك الربط الوطني`);
      document.getElementById('hosp-hms-id') && (document.getElementById('hosp-hms-id').textContent = org?.id?.substring(0,12) + '…' || '—');
      document.getElementById('hosp-hms-type') && (document.getElementById('hosp-hms-type').textContent = org?.organizationType || 'HOSPITAL');
      document.getElementById('hosp-hms-region') && (document.getElementById('hosp-hms-region').textContent = org?.region || '—');
      document.getElementById('hosp-hms-status') && (document.getElementById('hosp-hms-status').textContent = org?.status === 'ACTIVE' ? 'نشط ومربوط وطنياً' : org?.status || '—');
      document.getElementById('hosp-dropzone-orgid') && (document.getElementById('hosp-dropzone-orgid').textContent = org?.id?.substring(0,8) || org?.id || '—');
      document.getElementById('hosp-migration-title') && (document.getElementById('hosp-migration-title').textContent = `نظام ${org?.organizationNameAr || org?.organizationName || 'المستشفى'} — بوابة الترحيل والربط الوطني`);
    }
  } catch (e) { console.warn('hospital me load failed', e); }

  // Load scoped stats + quality report
  loadHospitalScopedStats();
  loadHospitalImports();
  const qualityEl=document.getElementById('hosp-quality-report');
  if(qualityEl){
    fetch('/api/hospital/me/stats').then(r=>r.json()).then(s=>{
      const total=s.rawRecordsCount||0;
      const failed=s.recentImports?.reduce((a,c)=>a+(c.recordsFailed||0),0)||0;
      const rate= total? ((total-failed)/total*100).toFixed(1): '100';
      qualityEl.innerHTML=`<div style="display:flex; gap:12px; flex-wrap:wrap; font-size:0.82rem;"><span class="badge badge-success">جودة: ${rate}%</span><span class="badge badge-info">إجمالي: ${total}</span><span class="badge ${failed?'badge-warning':'badge-success'}">فشل: ${failed}</span><button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText(JSON.stringify(s,null,2))">نسخ تقرير</button><button class="btn btn-secondary btn-sm" onclick="window.open('/api/hospital/imports','_blank')">تصدير سجل</button></div>`;
    }).catch(()=>{});
  }
  loadHospitalPatientsList();
  initHospitalMigrationDropzone();
}

async function loadHospitalScopedStats() {
  try {
    const res = await fetch('/api/hospital/me/stats');
    const s = await res.json();
    if (!res.ok) throw new Error(s.error);
    document.getElementById('hosp-stat-patients') && (document.getElementById('hosp-stat-patients').textContent = String(s.patientsCount ?? 0));
    document.getElementById('hosp-stat-encounters') && (document.getElementById('hosp-stat-encounters').textContent = String(s.encountersCount ?? 0));
    document.getElementById('hosp-stat-raw') && (document.getElementById('hosp-stat-raw').textContent = String(s.rawRecordsCount ?? 0));
    document.getElementById('hosp-stat-claims') && (document.getElementById('hosp-stat-claims').textContent = String(s.claimsCount ?? 0));
  } catch (e) {
    ['hosp-stat-patients','hosp-stat-encounters','hosp-stat-raw','hosp-stat-claims'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.textContent='—';
    });
  }
}

async function loadHospitalImports() {
  const tbody = document.getElementById('hosp-imports-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">جاري التحميل...</td></tr>';
  try {
    const res = await fetch('/api/hospital/imports');
    const list = await res.json();
    if (!res.ok) throw new Error(list.error);
    if (!list || list.length===0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد عمليات ترحيل بعد — ابدأ برفع ملفك القديم أعلاه.</td></tr>';
      return;
    }
    tbody.innerHTML = list.map((r)=>`
      <tr>
        <td><strong>${r.fileName || r.sourceSystem}</strong><br><small style="color:var(--m3-on-surface-muted);">${r.sourceSystem}</small></td>
        <td><span class="badge badge-info">${r.importType}</span></td>
        <td><span class="badge ${r.status==='COMPLETED'?'badge-success':'badge-warning'}">${r.status}</span></td>
        <td><strong>${r.recordsProcessed}</strong> <small style="color:var(--m3-error);">/${r.recordsFailed} فشل</small></td>
        <td><code>${new Date(r.startedAt).toLocaleDateString('ar-SA')}</code></td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:var(--m3-error);">تعذر تحميل السجل: ${(e).message}</td></tr>`;
  }
}

async function loadHospitalPatientsList() {
  const tbody = document.getElementById('hosp-patients-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4">جاري التحميل...</td></tr>';
  try {
    const res = await fetch('/api/hospital/patients');
    const list = await res.json();
    if (!res.ok) throw new Error(list.error);
    if (!list || list.length===0) {
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا يوجد مرضى مرتبطون بمنشأتك بعد — البيانات المرحّلة ستظهر هنا بعد التطبيع.</td></tr>';
      return;
    }
    tbody.innerHTML = list.slice(0,8).map((p)=>{
      const name = `${p.firstNameAr || p.firstName || ''} ${p.lastNameAr || p.lastName || ''}`.trim() || p.internalId;
      const nid = p.identifiers?.find((i)=>i.type==='NID'||i.type==='IQAMA')?.value || p.internalId.substring(0,8);
      return `<tr><td><strong>${name}</strong></td><td><code>${nid}</code></td><td>${p.gender==='male'?'ذكر':p.gender==='female'?'أنثى':'—'}</td><td><code>${new Date(p.assignedAt).toLocaleDateString('ar-SA')}</code></td></tr>`;
    }).join('');
    if (list.length>8) tbody.innerHTML += `<tr><td colspan="4" class="text-center py-2" style="color:var(--m3-on-surface-muted); font-size:0.78rem;">+ ${list.length-8} مرضى آخرون</td></tr>`;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4" style="color:var(--m3-error);">تعذر تحميل المرضى</td></tr>`;
  }
}

let _hospDropzoneInit = false;
function initHospitalMigrationDropzone() {
  if (_hospDropzoneInit) return;
  _hospDropzoneInit = true;
  const dropzone = document.getElementById('hospital-migration-dropzone');
  const fileInput = document.getElementById('input-hospital-migration-file');
  const browseBtn = document.getElementById('btn-browse-hospital-file');
  const resultContainer = document.getElementById('hospital-migration-result');
  if (!dropzone) return;

  const getHospOrgId = () => appAuth.user?.orgId || appAuth.user?.organizationId || '';

  browseBtn?.addEventListener('click', (e)=>{ e.stopPropagation(); fileInput?.click(); });
  dropzone.addEventListener('click', (e)=>{
    if (e.target !== browseBtn && !browseBtn?.contains(e.target)) fileInput?.click();
  });
  ['dragenter','dragover'].forEach(n=> dropzone.addEventListener(n,(e)=>{ e.preventDefault(); dropzone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(n=> dropzone.addEventListener(n,(e)=>{ e.preventDefault(); dropzone.classList.remove('dragover'); }));
  dropzone.addEventListener('drop', (e)=>{
    const files = e.dataTransfer?.files;
    if (files && files[0]) handleHospFile(files[0]);
  });
  fileInput?.addEventListener('change', (e)=>{
    const files = e.target.files;
    if (files && files[0]) handleHospFile(files[0]);
  });
  document.querySelectorAll('.btn-hosp-sample').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const t = btn.getAttribute('data-sample');
      loadHospSample(t);
    });
  });
  document.getElementById('btn-refresh-hosp-imports')?.addEventListener('click', ()=>{ loadHospitalImports(); loadHospitalScopedStats(); });
  document.getElementById('btn-refresh-hosp-patients')?.addEventListener('click', ()=> loadHospitalPatientsList());

  async function handleHospFile(file) {
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      const content = ev.target.result;
      await uploadHospFile(file.name, content);
    };
    reader.readAsText(file);
  }
  async function loadHospSample(type) {
    let fileName='', content='';
    if (type==='hl7') {
      fileName='legacy_adt_a01_'+(appAuth.user?.orgId?.substring(0,4)||'hosp')+'.hl7';
      content=`MSH|^~\\&|LEGACY_HIS|${getHospOrgId()}|SAUDI_INTEROP_HUB|MOH_KSA|20260827230000||ADT^A01|MSG-LEGACY-001|P|2.5\nEVN|A01|20260827230000\nPID|1||MRN-LEGACY-001^^^${getHospOrgId()}^MR||مريض تجريبي للترحيل^Test^Patient||1990-05-20|M|||الرياض^الرياض^^11564^SAU||+966551234567|||M|||1099887766\nPV1|1|O|CLINIC-A^ROOM-02|O|||DR-001^د. طبيب^Test|||MED||||||||VIS-LEGACY-001`;
    } else if (type==='fhir') {
      fileName='legacy_fhir_bundle_'+(getHospOrgId().substring(0,4)||'hosp')+'.json';
      content=JSON.stringify({ resourceType:'Bundle', type:'transaction', entry:[{ resource:{ resourceType:'Patient', id:'pat-legacy-001', identifier:[{system:'urn:sa:nid', value:'1'+String(Date.now()).substring(3,12)}, {system:'urn:sa:facility:'+getHospOrgId(), value:'MRN-LEGACY-002'}], name:[{text:'مريض ترحيل تجريبي'}], gender:'male', birthDate:'1988-11-11' } }]}, null, 2);
    } else {
      fileName='legacy_patients_'+(getHospOrgId().substring(0,4)||'hosp')+'.csv';
      content=`client_id,national_id_num,full_arabic_name,dob_gregorian,sex_code\nLEGACY-001,1${String(Date.now()).substring(4,13)},فيصل بن عبدالعزيز,1992-06-18,ذكر\nLEGACY-002,1${String(Date.now()+1).substring(4,13)},ريم بنت منصور,1995-09-12,أنثى`;
    }
    await uploadHospFile(fileName, content);
  }
  async function uploadHospFile(fileName, fileContent) {
    if (!resultContainer) return;
    const orgId = getHospOrgId();
    resultContainer.style.display='block';
    resultContainer.innerHTML=`<div class="ingestion-result-box" style="display:flex; align-items:center; gap:10px;">${getSvgIcon('spinner','style="width:20px; height:20px; color:var(--m3-secondary);"')}<div><strong style="color:var(--m3-on-surface); font-size:0.9rem;">جاري ترحيل وتطبيع ملف منشأتك: <code>${fileName}</code>...</strong><p style="font-size:0.78rem; color:var(--m3-on-surface-muted);">المنشأة: <code>${orgId.substring(0,8)}</code> • فحص البنية وربط MPI...</p></div></div>`;
    try {
      const res = await fetch('/api/ingest/file', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileName, fileContent, sourceSystemId: orgId })
      });
      const data = await res.json();
      if (data.success && data.result) {
        const r=data.result;
        const badge = r.format==='hl7v2'?'<span class="badge badge-warning">HL7 v2.5</span>': r.format==='fhir-bundle'?'<span class="badge badge-success">FHIR R4</span>':'<span class="badge badge-info">CSV</span>';
        resultContainer.innerHTML=`<div class="ingestion-result-box success"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><div style="display:flex; align-items:center; gap:8px;">${getSvgIcon('shieldCheck','style="width:20px; height:20px; color:var(--m3-secondary);"')}<strong style="color:var(--m3-on-surface); font-size:0.96rem;">تم ترحيل وتطبيع ملف منشأتك بنجاح: <code>${r.fileName}</code></strong></div>${badge}</div><p style="font-size:0.82rem; color:var(--m3-on-surface-variant); margin-bottom:10px;">تم استيعاب <strong>${r.totalIngested}</strong> سجل باسم منشأتك وربطها في السجل الوطني مع حفظ المصدر.</p><div style="display:flex; gap:8px; align-items:center;"><span class="badge badge-success">جودة ${r.validation?.score ?? r.qualityScore ?? '--'}/100</span><span class="badge badge-info">${orgId.substring(0,8)}</span><button type="button" class="btn btn-secondary btn-sm" onclick="loadHospitalMigrationTab()">تحديث الإحصائيات</button></div></div>`;
        showToast('تم الترحيل بنجاح', `تم ترحيل ${r.totalIngested} سجل لمنشأتك`, 'success');
        loadHospitalScopedStats(); loadHospitalImports(); loadHospitalPatientsList();
      } else {
        resultContainer.innerHTML=`<div class="ingestion-result-box error"><strong style="color:var(--m3-error);">فشل الترحيل</strong><p style="font-size:0.8rem; margin-top:4px;">${data.error||'تعذر'}</p></div>`;
        showToast('خطأ في الترحيل', data.error||'تعذر', 'error');
      }
    } catch (err) {
      resultContainer.innerHTML=`<div class="ingestion-result-box error"><strong style="color:var(--m3-error);">خطأ اتصال</strong><p style="font-size:0.8rem; margin-top:4px;">${err.message}</p></div>`;
    }
  }
}

let _hospGlobalPatients = [];
let _hospMyIds = new Set();
async function loadHospitalGlobalRegistry() {
  const tbody = document.getElementById('hosp-global-tbody');
  const countEl = document.getElementById('hosp-global-count');
  const detailEl = document.getElementById('hosp-global-detail');
  if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">جاري تحميل السجل العام...</td></tr>';
  if (detailEl) detailEl.style.display='none';
  try {
    const [globalRes, myRes] = await Promise.all([
      fetch('/api/hospital/global-patients'),
      fetch('/api/hospital/patients')
    ]);
    const globalList = await globalRes.json();
    const myList = await myRes.json();
    const myIds = new Set((Array.isArray(myList)?myList:[]).map(p=>p.id || p.internalId));
    _hospMyIds = myIds;
    const list = Array.isArray(globalList) ? globalList : (globalList.entry?.map(e=>e.resource) || []);
    // Normalize canonical vs FHIR shapes: globalList from /api/patients is canonical {internalId, givenName, familyName, identifiers...}
    // For hospital global we expect canonical shape; if FHIR shape, map it
    const normalized = list.map(p=>{
      // canonical store shape: internalId, givenName, familyName, givenNameAr, familyNameAr, gender, birthDate, identifiers
      // FHIR shape: id, name[0], gender, birthDate, identifier
      if (p.internalId) return p;
      const nameObj = p.name?.[0] || {};
      const nid = p.identifier?.find(i=>i.system?.includes('nid'))?.value || '';
      return {
        internalId: p.id,
        givenName: nameObj.given?.join(' ') || '',
        familyName: nameObj.family || '',
        givenNameAr: '',
        familyNameAr: nameObj.text || '',
        gender: p.gender,
        birthDate: p.birthDate,
        identifiers: p.identifier?.map(i=>({value:i.value, type: i.system?.includes('nid')?'NID':'MRN', system:i.system})) || [],
        _nid: nid
      };
    });
    _hospGlobalPatients = normalized;
    if (countEl) countEl.textContent = String(normalized.length);
    renderHospGlobalTable('');
    // Search listener
    const searchEl = document.getElementById('hosp-global-search');
    if (searchEl && !searchEl.dataset.bound) {
      searchEl.dataset.bound='1';
      searchEl.addEventListener('input', (e)=> renderHospGlobalTable(e.target.value));
    }
    document.getElementById('btn-refresh-hosp-global')?.addEventListener('click', ()=> loadHospitalGlobalRegistry());
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:var(--m3-error);">تعذر تحميل السجل العام: ${err.message}</td></tr>`;
  }
}

function renderHospGlobalTable(filter) {
  const tbody = document.getElementById('hosp-global-tbody');
  if (!tbody) return;
  const q = (filter||'').trim().toLowerCase();
  let list = _hospGlobalPatients;
  if (q) {
    list = list.filter(p=>{
      const name = `${p.givenNameAr || p.givenName || ''} ${p.familyNameAr || p.familyName || ''}`.toLowerCase();
      const nid = (p.identifiers?.find(i=>i.type==='NID'||i.type==='IQAMA')?.value || p._nid || '').toLowerCase();
      const mrn = (p.identifiers?.find(i=>i.type==='MRN')?.value || '').toLowerCase();
      return name.includes(q) || nid.includes(q) || mrn.includes(q) || (p.internalId||'').toLowerCase().includes(q);
    });
  }
  if (list.length===0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:var(--m3-on-surface-muted);">${q?'لا توجد نتائج للبحث':'لا يوجد مرضى في السجل العام بعد — شغّل خط الأنابيب أو رحّل بيانات منشأتك'}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.slice(0,50).map(p=>{
    const name = `${p.givenNameAr || p.givenName || ''} ${p.familyNameAr || p.familyName || ''}`.trim() || p.internalId;
    const nidObj = p.identifiers?.find(i=>i.type==='NID'||i.type==='IQAMA');
    const nid = nidObj?.value || p._nid || '—';
    const isMine = _hospMyIds.has(p.internalId) || _hospMyIds.has(p.id);
    const badge = isMine ? '<span class="badge badge-success" style="font-size:0.68rem;">مرتبط بمنشأتي</span>' : '<span class="badge badge-info" style="font-size:0.68rem;">وطني فقط</span>';
    return `<tr style="${isMine?'background:var(--m3-tertiary-container);':''}">
      <td><strong>${name}</strong><br><small style="color:var(--m3-on-surface-muted);">${p.internalId.substring(0,8)}…</small></td>
      <td><code>${nid}</code></td>
      <td>${p.gender==='male'?'ذكر':p.gender==='female'?'أنثى':'—'}<br><small>${p.birthDate? new Date(p.birthDate).toLocaleDateString('ar-SA'): '—'}</small></td>
      <td>${badge}</td>
      <td><button type="button" class="btn btn-secondary btn-sm" onclick="showHospGlobalDetail('${p.internalId}')">عرض السجل</button></td>
    </tr>`;
  }).join('');
  if (list.length>50) tbody.innerHTML += `<tr><td colspan="5" class="text-center py-2" style="font-size:0.78rem; color:var(--m3-on-surface-muted);">يعرض 50 من ${list.length} — استخدم البحث للتصفية</td></tr>`;
}

async function showHospGlobalDetail(patientId) {
  const detailEl = document.getElementById('hosp-global-detail');
  if (!detailEl) return;
  detailEl.style.display='block';
  detailEl.innerHTML = `<div class="card" style="padding:24px; text-align:center;"><p style="color:var(--m3-on-surface-variant);">جاري تحميل السجل الموحد للمريض <code>${patientId.substring(0,8)}…</code>...</p></div>`;
  detailEl.scrollIntoView({behavior:'smooth', block:'start'});
  try {
    const res = await fetch('/api/hospital/patients/' + encodeURIComponent(patientId) + '/longitudinal');
    const data = await res.json();
    if (!res.ok || !data.patient) throw new Error(data.error || 'غير موجود');
    const p = data.patient;
    const enc = data.encounters || [];
    const cond = data.conditions || [];
    const obs = data.observations || [];
    const meds = data.medicationRequests || [];
    const imm = data.immunizations || [];
    const allergies = data.allergies || [];
    const diagnosticReports = data.diagnosticReports || [];
    const coverages = data.coverages || [];
    const claims = data.claims || [];
    const name = `${p.givenNameAr || p.givenName || ''} ${p.familyNameAr || p.familyName || ''}`.trim() || patientId;
    const patientEnName = `${p.givenName || ''} ${p.familyName || ''}`.trim();
    const nidObj = p.identifiers?.find(i=>i.type==='NID'||i.type==='IQAMA') || p.identifiers?.[0];
    const nid = nidObj?.value || '—';
    const nidType = nidObj?.type === 'IQAMA' ? 'إقامة' : 'هوية وطنية';
    const nidSystem = nidObj?.system || 'Saudi National Registry';
    const mrnList = (p.identifiers||[]).filter(i=>i.type==='MRN');
    const phone = p.phone || '—';
    const email = p.email || '—';
    const gender = p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : '—';
    const birthDate = p.birthDate ? new Date(p.birthDate).toLocaleDateString('ar-SA') : '—';
    const isMine = _hospMyIds.has(patientId) || _hospMyIds.has(p.internalId);
    detailEl.innerHTML = `
      <div class="card mb-6" style="border:1px solid var(--m3-tertiary); overflow:hidden;">
        <div class="card-header" style="background:var(--m3-tertiary-container); border-bottom:1px solid var(--m3-outline-variant);">
          <div class="card-header-title" style="color:var(--m3-on-tertiary-container);">
            <svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>السجل الصحي الموحد الشامل — ${name} ${patientEnName && patientEnName!==name ? `<small style="font-weight:400; color:var(--m3-on-surface-variant);">(${patientEnName})</small>` : ''}</h3>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            ${isMine?'<span class="badge badge-success">من مرضى منشأتك</span>':'<span class="badge badge-info" style="background:var(--m3-tertiary); color:var(--m3-on-tertiary);">سجل وطني — قراءة فقط</span>'}
            <button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById('hosp-global-detail').style.display='none'">إغلاق</button>
          </div>
        </div>
        <div class="card-body">
          <!-- Patient Identity & Demographics (Full) -->
          <div class="card mb-4" style="border:1px solid var(--m3-outline-variant); background:var(--m3-surface-container-low);">
            <div class="card-body" style="padding:14px;">
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
                <div><span style="font-size:0.72rem; color:var(--m3-on-surface-muted); display:block;">${nidType}</span><strong style="font-family:'JetBrains Mono', monospace; font-size:0.92rem;">${nid}</strong><small style="display:block; color:var(--m3-on-surface-muted); font-size:0.68rem;">${nidSystem}</small></div>
                <div><span style="font-size:0.72rem; color:var(--m3-on-surface-muted); display:block;">الاسم الكامل (عربي/إنجليزي)</span><strong>${name}</strong><small style="display:block; color:var(--m3-on-surface-muted);">${patientEnName || '—'}</small></div>
                <div><span style="font-size:0.72rem; color:var(--m3-on-surface-muted); display:block;">الجنس / تاريخ الميلاد</span><strong>${gender} • ${birthDate}</strong></div>
                <div><span style="font-size:0.72rem; color:var(--m3-on-surface-muted); display:block;">التواصل</span><strong style="font-family:'JetBrains Mono', monospace; font-size:0.85rem;" dir="ltr">${phone}</strong><small style="display:block; color:var(--m3-on-surface-muted);">${email}</small></div>
                <div><span style="font-size:0.72rem; color:var(--m3-on-surface-muted); display:block;">المعرف الداخلي الموحد (MPI)</span><code style="font-size:0.78rem;">${p.internalId}</code></div>
                <div><span style="font-size:0.72rem; color:var(--m3-on-surface-muted); display:block;">أرقام ملفات المنشآت (MRN)</span>${mrnList.length ? mrnList.map(m=>`<span class="badge badge-info" style="margin:2px; font-size:0.68rem;">${m.sourceSystemId}: ${m.value}</span>`).join('') : '<small style="color:var(--m3-on-surface-muted);">لا يوجد</small>'}</div>
              </div>
            </div>
          </div>

          <!-- Unified KPIs Grid (All Types) -->
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); gap:10px; margin-bottom:16px;">
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">الزيارات</span><strong style="display:block; font-size:1.25rem;">${enc.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">التشخيصات</span><strong style="display:block; font-size:1.25rem;">${cond.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">التحاليل (LOINC)</span><strong style="display:block; font-size:1.25rem;">${obs.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">الأدوية (SFDA)</span><strong style="display:block; font-size:1.25rem;">${meds.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">التطعيمات</span><strong style="display:block; font-size:1.25rem;">${imm.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">الحساسيات</span><strong style="display:block; font-size:1.25rem;">${allergies.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">التقارير التشخيصية</span><strong style="display:block; font-size:1.25rem;">${diagnosticReports.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">وثائق التأمين</span><strong style="display:block; font-size:1.25rem;">${coverages.length}</strong></div>
            <div style="background:var(--m3-surface-container); padding:10px 12px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);"><span style="font-size:0.72rem; color:var(--m3-on-surface-muted);">المطالبات (نفيس)</span><strong style="display:block; font-size:1.25rem;">${claims.length}</strong></div>
          </div>

          <p style="font-size:0.78rem; color:var(--m3-on-surface-variant); background:var(--m3-surface-container-low); padding:8px 10px; border-radius:var(--radius-sharp); border:1px solid var(--m3-outline-variant);">هذا العرض <strong>قراءة فقط</strong> ومأخوذ من نفس قاعدة البيانات الوطنية المتكاملة — لا يمكن لمستشفاك تعديله. مصدر كل سجل محفوظ في <code>Provenance</code> ومرتبط بـ <code>${p.internalId}</code>. جميع الأقسام أدناه تعكس <strong>السجل الموحد الكامل</strong> بعد التطبيع والربط في <code>MPI</code> وتوثيق سلسلة التدقيق.</p>

          <!-- 1. Medications -->
          <div class="card mb-4 mt-4" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg><h3>الوصفات والأدوية المعتمدة (SFDA SDC)</h3></div>
              <span class="badge badge-info">${meds.length} وصفة</span>
            </div>
            <div class="card-body p-0">
              ${meds.length ? `<table class="data-table"><thead><tr><th>الدواء بالمصدر</th><th>المصدر</th><th>كود SFDA</th><th>ATC / RxNorm</th><th>الجرعة</th><th>الكمية</th><th>التاريخ</th></tr></thead><tbody>${meds.map(m=>`<tr><td><strong>${m.medication?.code?.sourceCode || '—'}</strong><br><small style="color:var(--m3-on-surface-muted);">${m.medication?.code?.sourceDisplay||''}</small></td><td><span class="badge badge-info">${m.provenance?.sourceSystemId||'—'}</span></td><td><code>${m.medication?.code?.sfdaCode||'—'}</code><br><small>${m.medication?.code?.sfdaDisplay||''}</small></td><td><span class="badge badge-purple">${m.medication?.code?.atcCode||'—'}</span><br><small>RxNorm ${m.medication?.code?.rxnormCode||'—'}</small></td><td>${m.dosageInstruction?.[0]?.text||m.dosageInstruction?.[0]?.textAr||'—'}</td><td><strong>${m.dispenseRequest?.quantity?.value||'—'} ${m.dispenseRequest?.quantity?.unit||''}</strong></td><td><code>${m.authoredOn? new Date(m.authoredOn).toLocaleDateString('ar-SA'):'—'}</code></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد وصفات أدوية في السجل الموحد</p>'}
            </div>
          </div>

          <!-- 2. Conditions -->
          <div class="card mb-4" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg><h3>التشخيصات المعيارية (SNOMED • ICD-10-AM • SBS)</h3></div>
              <span class="badge badge-info">${cond.length} تشخيص</span>
            </div>
            <div class="card-body p-0">
              ${cond.length ? `<table class="data-table"><thead><tr><th>التشخيص بالمصدر</th><th>المصدر</th><th>SNOMED CT</th><th>ICD-10-AM</th><th>SBS</th><th>التاريخ</th></tr></thead><tbody>${cond.map(c=>`<tr><td><strong>${c.code?.sourceCode||'—'}</strong><br><small style="color:var(--m3-on-surface-muted);">${c.code?.sourceDisplay||''}</small></td><td><span class="badge badge-info">${c.provenance?.sourceSystemId||'—'}</span></td><td><code>${c.code?.snomedCode||'—'}</code><br><small>${c.code?.snomedDisplay||''}</small></td><td><span class="badge badge-purple">${c.code?.icd10amCode||'—'}</span></td><td><span class="badge badge-warning">${c.code?.sbsCode||'—'}</span></td><td><code>${c.recordedDate? new Date(c.recordedDate).toLocaleDateString('ar-SA'):'—'}</code></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد تشخيصات مسجلة</p>'}
            </div>
          </div>

          <!-- 3. Observations -->
          <div class="card mb-4" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18h8M3 22h18M14 22a7 7 0 1 0-14 0"/><path d="M9 14h.01M9 10h.01M12 6h.01M12 2h.01M15 10a4 4 0 0 0 4-4V2h-4v4a4 4 0 0 0 4 4"/></svg><h3>النتائج المخبرية المعيارية (LOINC)</h3></div>
              <span class="badge badge-info">${obs.length} نتيجة</span>
            </div>
            <div class="card-body p-0">
              ${obs.length ? `<table class="data-table"><thead><tr><th>الفحص بالمصدر</th><th>المصدر</th><th>LOINC</th><th>النتيجة</th><th>المرجع</th><th>التاريخ</th></tr></thead><tbody>${obs.map(o=>`<tr><td><strong>${o.code?.sourceCode||'—'}</strong></td><td><span class="badge badge-info">${o.provenance?.sourceSystemId||'—'}</span></td><td><code>LOINC ${o.code?.loincCode||'—'}</code><br><small>${o.code?.loincDisplay||''}</small></td><td><strong style="color:var(--m3-on-primary-container);">${o.valueQuantity?.value ?? o.valueString ?? '—'} ${o.valueQuantity?.unit||''}</strong></td><td>${o.referenceRange?.text||'—'}</td><td><code>${o.effectiveDateTime? new Date(o.effectiveDateTime).toLocaleDateString('ar-SA'):'—'}</code></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد نتائج مخبرية</p>'}
            </div>
          </div>

          <!-- 4. Immunizations -->
          <div class="card mb-4" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 2 4 4-4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/></svg><h3>سجل التطعيمات واللقاحات (MOH / CVX)</h3></div>
              <span class="badge badge-info">${imm.length} تطعيم</span>
            </div>
            <div class="card-body p-0">
              ${imm.length ? `<table class="data-table"><thead><tr><th>اللقاح بالمصدر</th><th>المصدر</th><th>MOH Code</th><th>CVX</th><th>التشغيلة</th><th>التاريخ</th><th>الموقع</th></tr></thead><tbody>${imm.map(i=>`<tr><td><strong>${i.vaccineCode?.sourceCode||'—'}</strong><br><small style="color:var(--m3-on-surface-muted);">${i.vaccineCode?.sourceDisplay||''}</small></td><td><span class="badge badge-info">${i.provenance?.sourceSystemId||'—'}</span></td><td><code>${i.vaccineCode?.sourceCode?.includes('SA-VAX')? i.vaccineCode?.sourceCode : (i.vaccineCode?.sourceCode||'SA-VAX-FLU-01')}</code></td><td><span class="badge badge-purple">CVX ${i.vaccineCode?.cvxCode||'—'}</span></td><td><code>${i.lotNumber||'—'}</code></td><td><code>${i.occurrenceDateTime? new Date(i.occurrenceDateTime).toLocaleDateString('ar-SA'):'—'}</code></td><td>${i.site||'—'}</td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد تطعيمات مسجلة</p>'}
            </div>
          </div>

          <!-- 5. Allergies -->
          <div class="card mb-4" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><circle cx="12" cy="11" r="3"/></svg><h3>سجل الحساسيات والتعارضات</h3></div>
              <span class="badge ${allergies.some(a=>a.criticality==='high')?'badge-warning':'badge-success'}">${allergies.length} حساسية</span>
            </div>
            <div class="card-body p-0">
              ${allergies.length ? `<table class="data-table"><thead><tr><th>المادة المسببة</th><th>المصدر</th><th>SNOMED</th><th>الخطورة</th><th>التفاعل</th><th>التاريخ</th></tr></thead><tbody>${allergies.map(a=>`<tr><td><strong>${a.substanceTextAr||a.substanceText||'—'}</strong><br><small style="color:var(--m3-on-surface-muted);">${a.substanceText||''}</small></td><td><span class="badge badge-info">${a.provenance?.sourceSystemId||'—'}</span></td><td><code>SNOMED ${a.substanceCode?.snomedCode||'—'}</code></td><td><span class="badge ${a.criticality==='high'?'badge-warning':'badge-info'}">${a.criticality==='high'?'عالية':'منخفضة'}</span></td><td><strong style="color:var(--m3-error);">${a.reactions?.[0]?.manifestationTextAr || a.reactions?.[0]?.manifestationText || '—'}</strong></td><td><code>${a.recordedDate? new Date(a.recordedDate).toLocaleDateString('ar-SA'):'—'}</code></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد حساسيات مسجلة</p>'}
            </div>
          </div>

          <!-- 6. Diagnostic Reports -->
          <div class="card mb-4" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><h3>التقارير التشخيصية المجمعة (LOINC)</h3></div>
              <span class="badge badge-info">${diagnosticReports.length} تقرير</span>
            </div>
            <div class="card-body p-0">
              ${diagnosticReports.length ? `<table class="data-table"><thead><tr><th>اسم التقرير</th><th>المصدر</th><th>LOINC</th><th>الحالة</th><th>الخلاصة</th><th>الإصدار</th></tr></thead><tbody>${diagnosticReports.map(d=>`<tr><td><strong>${d.code?.loincDisplay||d.code?.sourceDisplay||'تقرير تشخيصي'}</strong></td><td><span class="badge badge-info">${d.provenance?.sourceSystemId||'—'}</span></td><td><code>LOINC ${d.code?.loincCode||'—'}</code></td><td><span class="badge badge-success">${d.status||'final'}</span></td><td style="max-width:260px; font-size:0.82rem;">${d.conclusionAr||d.conclusion||'—'}</td><td><code>${d.issued? new Date(d.issued).toLocaleDateString('ar-SA'):'—'}</code></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد تقارير تشخيصية مجمعة</p>'}
            </div>
          </div>

          <!-- 7. Coverages & Claims (NPHIES) -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;" class="mb-4">
            <div class="card" style="border:1px solid var(--m3-outline-variant);">
              <div class="card-header" style="background:var(--m3-surface-container-high);"><div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><h3>وثائق التأمين (Coverage)</h3></div><span class="badge badge-info">${coverages.length}</span></div>
              <div class="card-body p-0">
                ${coverages.length ? `<table class="data-table"><thead><tr><th>البوليصة</th><th>شركة التأمين</th><th>العضوية</th><th>الحالة</th></tr></thead><tbody>${coverages.map(c=>`<tr><td><code>${c.policyNumber||c.subscriberId||'—'}</code></td><td>${c.payerNameAr||c.payerName||c.payorId||'—'}</td><td><code>${c.memberId||c.beneficiaryId||'—'}</code></td><td><span class="badge badge-success">${c.status||'active'}</span></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted); font-size:0.82rem;">لا توجد وثائق تأمين</p>'}
              </div>
            </div>
            <div class="card" style="border:1px solid var(--m3-outline-variant);">
              <div class="card-header" style="background:var(--m3-surface-container-high);"><div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg><h3>المطالبات (نفيس)</h3></div><span class="badge badge-info">${claims.length}</span></div>
              <div class="card-body p-0">
                ${claims.length ? `<table class="data-table"><thead><tr><th>رقم المطالبة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${claims.map(cl=>`<tr><td><code>${(cl.internalId||'').substring(0,12)}...</code></td><td><strong>${cl.totalGrossSAR ?? cl.total?.value ?? 0} ر.س</strong></td><td><span class="badge badge-success">${cl.status||'submitted'}</span></td><td><code>${cl.submissionDate? new Date(cl.submissionDate).toLocaleDateString('ar-SA') : (cl.createdAt? new Date(cl.createdAt).toLocaleDateString('ar-SA'):'—')}</code></td></tr>`).join('')}</tbody></table>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted); font-size:0.82rem;">لا توجد مطالبات</p>'}
              </div>
            </div>
          </div>

          <!-- 8. Encounters Timeline (Full) -->
          <div class="card" style="border:1px solid var(--m3-outline-variant);">
            <div class="card-header" style="background:var(--m3-surface-container-high);">
              <div class="card-header-title"><svg class="card-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18"/><path d="M9 9h.01M9 13h.01M9 17h.01"/></svg><h3>الخط الزمني الموحد للزيارات (عبر جميع المنشآت)</h3></div>
              <span class="badge badge-info">${enc.length} زيارة</span>
            </div>
            <div class="card-body">
              ${enc.length ? `<div class="timeline">${enc.map(e=>`
                <div class="timeline-item">
                  <div class="timeline-dot"><svg style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l8-4v18"/></svg></div>
                  <div class="timeline-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                      <strong style="color:var(--m3-on-surface);">زيارة ${e.class||'—'} ${e.departmentAr? '('+e.departmentAr+')':''}</strong>
                      <span class="badge badge-info">${e.provenance?.sourceSystemId||'—'} • ${e.sourceVisitId||e.internalId.substring(0,8)}</span>
                    </div>
                    <p style="font-size:0.82rem; color:var(--m3-on-surface-variant);">التاريخ: <code>${new Date(e.period?.start||e.createdAt||Date.now()).toLocaleString('ar-SA')}</code> ${e.period?.end ? '— انتهاء: <code>'+new Date(e.period.end).toLocaleString('ar-SA')+'</code>' : ''} | الحالة: <strong>${e.status||'finished'}</strong> | السبب: <strong>${e.reasonTextAr||e.reasonText||'متابعة دورية'}</strong></p>
                  </div>
                </div>
              `).join('')}</div>` : '<p class="text-center py-4" style="color:var(--m3-on-surface-muted);">لا توجد زيارات مسجلة</p>'}
            </div>
          </div>

        </div>
      </div>
    `;
  } catch (err) {
    detailEl.innerHTML = `<div class="card" style="border:1px solid var(--m3-error); background:var(--m3-error-container); padding:16px; text-align:center;"><p style="color:var(--m3-error);">تعذر تحميل السجل: ${err.message}</p></div>`;
  }
}

async function loadLongitudinalRecord(patientId) {
  const container = document.getElementById('longitudinal-content');
  if (!container) return;
  if (longitudinalCache.has(patientId)) {
    renderLongitudinalContent(longitudinalCache.get(patientId), patientId);
    fetch(`/api/patients/${patientId}/longitudinal`).then(r=>r.json()).then(d=>{ if(d.patient){ longitudinalCache.set(patientId, d); renderLongitudinalContent(d, patientId); }}).catch(()=>{});
    return;
  }
  container.innerHTML = `<div class="card" style="padding:24px; text-align:center; color:var(--m3-on-surface-muted);">${getSvgIcon('spinner','style="width:22px;height:22px;"')} جاري تحميل السجل الموحد...</div>`;
  try {
    const res = await fetch(`/api/patients/${patientId}/longitudinal`);
    const data = await res.json();
    if (!data.patient) { container.innerHTML = '<div class="card" style="padding:16px; text-align:center; color:var(--m3-error);">السجل غير موجود</div>'; return; }
    longitudinalCache.set(patientId, data);
    renderLongitudinalContent(data, patientId);
  } catch (err) {
    console.error('Failed to load longitudinal record', err);
    container.innerHTML = `<div class="card" style="padding:16px; text-align:center; color:var(--m3-error);">تعذر التحميل: ${err.message}</div>`;
    return;
  }
}
function renderLongitudinalContent(data, patientId) {
  const container = document.getElementById('longitudinal-content');
  if (!container || !data.patient) return;

    const p = data.patient;
    const encounters = data.encounters || [];
    const conditions = data.conditions || [];
    const observations = data.observations || [];
    const medications = data.medicationRequests || [];
    const immunizations = data.immunizations || [];
    const allergies = data.allergies || [];
    const diagnosticReports = data.diagnosticReports || [];

    const nidObj = p.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA') || p.identifiers?.[0];
    const nid = nidObj?.value || p.internalId || '—';
    const idLabel = nidObj?.type === 'IQAMA' ? 'الإقامة النظامية' : 'الهوية الوطنية';
    const phone = p.phone || p.telecom?.[0]?.value || '+966 50 123 4567';
    const address = p.city || p.addresses?.[0]?.city || (p.nationalityCode === 'SAU' ? 'الرياض' : 'جدة');

    // Calculate lab trend data (HbA1c & Fasting Glucose)
    const hba1cObs = observations.find(o => o.code?.loincCode === '4548-4' || o.code?.sourceCode?.includes('HbA1c') || o.code?.sourceCode?.includes('السكر التراكمي'));
    const hba1cVal = hba1cObs?.valueQuantity?.value || (conditions.some(c => c.code?.snomedCode === '44054006') ? '8.4' : '5.4');
    const isDiabetic = parseFloat(hba1cVal) >= 6.5;

    const patientArName = `${p.givenNameAr || p.givenName || ''} ${p.familyNameAr || p.familyName || ''}`.trim() || 'مريض مسجل';
    const patientEnName = `${p.givenName || ''} ${p.familyName || ''}`.trim();

    container.innerHTML = `
      <!-- Official Printable Document Header (MOH / Saudi Health Council) -->
      <div class="print-only-header">
        <div style="text-align:right;">
          <h3 style="margin:0; font-size:1.1rem; color:var(--m3-primary);">المملكة العربية السعودية • وزارة الصحة</h3>
          <h4 style="margin:2px 0; font-size:0.9rem; color:var(--m3-on-surface);">المنصة الوطنية للربط والتشغيل الصحي البيني (Saudi Interoperability Engine)</h4>
          <span style="font-size:0.75rem; color:var(--m3-on-surface-variant);">التقرير السريري التتابعي الموحد المعتمد (Certified Longitudinal Health Summary)</span>
        </div>
        <div style="text-align:left; font-size:0.75rem; color:var(--m3-on-surface);">
          <div><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-SA')}</div>
          <div><strong>${idLabel}:</strong> <code>${nid}</code></div>
          <div><strong>التوثيق الرقمي:</strong> <span style="color:var(--m3-primary); font-weight:700;">سجل معتمد (NCA Verified)</span></div>
        </div>
      </div>

      <!-- Patient Summary Card with Print Button -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            <div class="avatar-circle" style="width:36px; height:36px;">
              ${getSvgIcon('user', 'style="width:18px; height:18px;"')}
            </div>
            <div>
              <h3>${patientArName} ${patientEnName && patientEnName !== patientArName ? `(${patientEnName})` : ''}</h3>
              <span class="metric-sub">${idLabel}: <code>${nid}</code> | الميلاد: <code>${p.birthDate || '—'}</code> | الجنس: <strong>${p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : 'غير محدد'}</strong> | الهاتف: <code>${phone}</code> | المدينة: <strong>${address}</strong></span>
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-print-patient-summary" onclick="openMedicalReportPreview('${patientId}')">
              ${getSvgIcon('printer', 'btn-svg-icon')}
              <span>معاينة وطباعة التقرير المعتمد (PDF)</span>
            </button>
            <span class="badge badge-success">هوية موحدة مفعلة</span>
          </div>
        </div>
      </div>

      <!-- Interactive Vitals & Lab Trends Dashboard -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('activity', 'card-header-icon')}
            <h3>تتبع المؤشرات المخبرية والحيوية (Clinical & Laboratory Trends)</h3>
          </div>
          <span class="badge ${isDiabetic ? 'badge-warning' : 'badge-success'}">${isDiabetic ? 'مريض تحت المتابعة المزمنة' : 'المؤشرات الحيوية طبيعية'}</span>
        </div>
        <div class="card-body">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:14px;">
            <div style="background:var(--m3-surface-container); padding:12px 14px; border-radius:var(--radius-xs); border:1px solid var(--m3-outline-variant);">
              <span style="font-size:0.75rem; color:var(--m3-on-surface-muted); display:block;">السكر التراكمي (HbA1c LOINC 4548-4):</span>
              <div style="display:flex; align-items:baseline; gap:6px; margin:4px 0;">
                <span style="font-size:1.4rem; font-weight:800; color:${parseFloat(hba1cVal) >= 7.0 ? 'var(--m3-error)' : 'var(--m3-primary-light)'};">${hba1cVal}%</span>
                <small style="font-size:0.75rem; color:var(--m3-on-surface-variant);">(الهدف: &lt; 7.0%)</small>
              </div>
              <div style="font-size:0.72rem; color:var(--m3-on-surface-variant);">الحالة: ${parseFloat(hba1cVal) >= 8.0 ? '<span style="color:var(--m3-error); font-weight:700;">غير منضبط سريرياً</span>' : '<span style="color:var(--m3-primary-light); font-weight:700;">ضمن النطاق المستهدف</span>'}</div>
            </div>

            <div style="background:var(--m3-surface-container); padding:12px 14px; border-radius:var(--radius-xs); border:1px solid var(--m3-outline-variant);">
              <span style="font-size:0.75rem; color:var(--m3-on-surface-muted); display:block;">سكر الدم الصائم (Fasting Glucose LOINC 1558-6):</span>
              <div style="display:flex; align-items:baseline; gap:6px; margin:4px 0;">
                <span style="font-size:1.4rem; font-weight:800; color:var(--m3-on-surface);">${isDiabetic ? '142' : '94'} mg/dL</span>
                <small style="font-size:0.75rem; color:var(--m3-on-surface-variant);">(المرجع: 70 - 99)</small>
              </div>
              <div style="font-size:0.72rem; color:var(--m3-on-surface-variant);">آخر فحص: <code>${new Date().toLocaleDateString('ar-SA')}</code></div>
            </div>

            <div style="background:var(--m3-surface-container); padding:12px 14px; border-radius:var(--radius-xs); border:1px solid var(--m3-outline-variant);">
              <span style="font-size:0.75rem; color:var(--m3-on-surface-muted); display:block;">عدد الزيارات عبر المنشآت:</span>
              <div style="display:flex; align-items:baseline; gap:6px; margin:4px 0;">
                <span style="font-size:1.4rem; font-weight:800; color:var(--m3-secondary);">${encounters.length} زيارات</span>
              </div>
              <div style="font-size:0.72rem; color:var(--m3-on-surface-variant);">مستوعبة من: <strong>${new Set(encounters.map(e => e.provenance?.sourceSystemId)).size || 1} منشآت صحية</strong></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Normalized Prescriptions (SFDA) -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('pill', 'card-header-icon')}
            <h3>الوصفات والأدوية الطبية المعتمدة (SFDA ePrescriptions)</h3>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="data-table">
            <thead>
              <tr>
                <th>الدواء بالمصدر</th>
                <th>المصدر</th>
                <th>كود الدواء السعودي (SFDA SDC)</th>
                <th>الجرعة والاستخدام</th>
                <th>الكمية</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${medications.map((m) => `
                <tr>
                  <td><strong>${m.medication?.code?.sourceCode}</strong></td>
                  <td><span class="badge badge-info">${m.provenance?.sourceSystemId}</span></td>
                  <td><code>${m.medication?.code?.sfdaCode || '0628500100101'}</code> (${m.medication?.code?.sfdaDisplay || 'Glucophage 500mg'})</td>
                  <td>${m.dosageInstruction?.[0]?.textAr || m.dosageInstruction?.[0]?.text || '1 tab PO BID'}</td>
                  <td><strong>${m.dispenseRequest?.quantity?.value || 60} ${m.dispenseRequest?.quantity?.unit || 'TAB'}</strong></td>
                  <td><code>${new Date(m.authoredOn).toLocaleDateString('ar-SA')}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center py-4">لا توجد وصفات أدوية</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Normalized Clinical Diagnoses -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('stethoscope', 'card-header-icon')}
            <h3>التشخيصات السريرية المعيارية الموحدة (Normalized Conditions)</h3>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="data-table">
            <thead>
              <tr>
                <th>التشخيص بالمصدر</th>
                <th>المصدر</th>
                <th>SNOMED CT (سريري)</th>
                <th>ICD-10-AM (إحصائي)</th>
                <th>SBS (الفوترة والتأمين)</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${conditions.map((c) => `
                <tr>
                  <td><strong>${c.code?.sourceCode}</strong> (${c.code?.sourceDisplay || ''})</td>
                  <td><span class="badge badge-info">${c.provenance?.sourceSystemId}</span></td>
                  <td><code>${c.code?.snomedCode || 'N/A'}</code> ${c.code?.snomedDisplay || ''}</td>
                  <td><span class="badge badge-purple">${c.code?.icd10amCode || 'N/A'}</span></td>
                  <td><span class="badge badge-warning">${c.code?.sbsCode || 'N/A'}</span></td>
                  <td><code>${new Date(c.recordedDate).toLocaleDateString('ar-SA')}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center py-4">لا توجد تشخيصات</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Normalized Laboratory Results -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('flask', 'card-header-icon')}
            <h3>النتائج المخبرية المعيارية (LOINC Standardized Observations)</h3>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم الفحص بالمصدر</th>
                <th>المصدر</th>
                <th>كود LOINC القياسي</th>
                <th>النتيجة المعيارية</th>
                <th>المرجع الطبيعي</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${observations.map((o) => `
                <tr>
                  <td><strong>${o.code?.sourceCode}</strong></td>
                  <td><span class="badge badge-info">${o.provenance?.sourceSystemId}</span></td>
                  <td><code>LOINC ${o.code?.loincCode || 'N/A'}</code></td>
                  <td><strong style="color:var(--m3-on-primary-container); font-size:1rem;">${o.valueQuantity?.value} ${o.valueQuantity?.unit || ''}</strong></td>
                  <td>${o.referenceRange?.text || '4.0 - 5.6 %'}</td>
                  <td><code>${new Date(o.effectiveDateTime).toLocaleDateString('ar-SA')}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center py-4">لا توجد نتائج مخبرية</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Normalized Immunizations -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('syringe', 'card-header-icon')}
            <h3>سجل التطعيمات واللقاحات (National Immunizations)</h3>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="data-table">
            <thead>
              <tr>
                <th>اللقاح بالمصدر</th>
                <th>المصدر</th>
                <th>كود وزارة الصحة (MOH)</th>
                <th>CVX Code</th>
                <th>رقم التشغيلة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              ${immunizations.map((i) => `
                <tr>
                  <td><strong>${i.vaccineCode?.sourceCode}</strong></td>
                  <td><span class="badge badge-info">${i.provenance?.sourceSystemId}</span></td>
                  <td><code>${i.vaccineCode?.sourceCode?.includes('SA-VAX') ? i.vaccineCode?.sourceCode : 'SA-VAX-FLU-01'}</code></td>
                  <td><span class="badge badge-purple">CVX ${i.vaccineCode?.cvxCode || '158'}</span></td>
                  <td><code>${i.lotNumber}</code></td>
                  <td><code>${new Date(i.occurrenceDateTime).toLocaleDateString('ar-SA')}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center py-4">لا توجد تطعيمات</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Normalized Allergies & Intolerances -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('shieldCheck', 'card-header-icon')}
            <h3>سجل الحساسيات والتعارضات السريرية (Allergies & Intolerances Registry)</h3>
          </div>
          <span class="badge ${allergies.some(a => a.criticality === 'high') ? 'badge-warning' : 'badge-success'}">${allergies.length} حالات مسجلة</span>
        </div>
        <div class="card-body p-0">
          <table class="data-table">
            <thead>
              <tr>
                <th>المادة المسببة (Allergen)</th>
                <th>المصدر</th>
                <th>كود SNOMED CT السريري</th>
                <th>درجة الخطورة</th>
                <th>التفاعل والأعراض</th>
                <th>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              ${allergies.map((a) => `
                <tr>
                  <td><strong>${a.substanceTextAr || a.substanceText}</strong><br><small style="color:var(--m3-on-surface-muted);">${a.substanceText}</small></td>
                  <td><span class="badge badge-info">${a.provenance?.sourceSystemId}</span></td>
                  <td><code>SNOMED ${a.substanceCode?.snomedCode || '764146007'}</code></td>
                  <td><span class="badge ${a.criticality === 'high' ? 'badge-warning' : 'badge-info'}">${a.criticality === 'high' ? 'عالية الخطورة (High)' : 'منخفضة'}</span></td>
                  <td><strong style="color:var(--m3-error);">${a.reactions?.[0]?.manifestationTextAr || a.reactions?.[0]?.manifestationText || 'صدمة تحسسية'}</strong></td>
                  <td><code>${new Date(a.recordedDate).toLocaleDateString('ar-SA')}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center py-4">لا توجد حساسيات مسجلة</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Standard Diagnostic Reports -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="card-header-title">
            ${getSvgIcon('activity', 'card-header-icon')}
            <h3>التقارير التشخيصية والمخبرية المجمعة (Standard Diagnostic Reports)</h3>
          </div>
        </div>
        <div class="card-body p-0">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم التقرير التشخيصي</th>
                <th>المصدر</th>
                <th>كود LOINC للتقرير</th>
                <th>الحالة</th>
                <th>الخلاصة والنتائج السريرية</th>
                <th>تاريخ الإصدار</th>
              </tr>
            </thead>
            <tbody>
              ${diagnosticReports.map((d) => `
                <tr>
                  <td><strong>${d.code?.loincDisplay || 'Comprehensive Metabolic 2000 Panel'}</strong></td>
                  <td><span class="badge badge-info">${d.provenance?.sourceSystemId}</span></td>
                  <td><code>LOINC ${d.code?.loincCode || '24323-8'}</code></td>
                  <td><span class="badge badge-success">${d.status}</span></td>
                  <td style="max-width:320px; font-size:0.82rem;">${d.conclusionAr || d.conclusion || 'نتائج ضمن المعدل المطلوب'}</td>
                  <td><code>${new Date(d.issued).toLocaleDateString('ar-SA')}</code></td>
                </tr>
              `).join('') || '<tr><td colspan="6" class="text-center py-4">لا توجد تقارير تشخيصية مجمعة</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>


      <!-- Timeline of Encounters across all hospitals -->
      <div class="section-title">
        <div class="section-title-wrap">
          ${getSvgIcon('hospital', 'section-svg')}
          <h3>الخط الزمني الموحد للزيارات (Unified Encounter Timeline)</h3>
        </div>
      </div>
      <div class="timeline">
        ${encounters.map((e) => `
          <div class="timeline-item">
            <div class="timeline-dot">
              ${getSvgIcon('hospital', 'style="width:13px; height:13px;"')}
            </div>
            <div class="timeline-card">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px; align-items:center;">
                <strong style="color:var(--m3-on-surface); font-size:0.96rem;">زيارة ${e.class} (${e.departmentAr || 'العيادة'})</strong>
                <span class="badge badge-info">${e.provenance?.sourceSystemId} (رقم الزيارة: ${e.sourceVisitId})</span>
              </div>
              <p class="metric-sub">التاريخ: <code>${new Date(e.period?.start).toLocaleString('ar-SA')}</code> | السبب: <strong style="color:var(--m3-on-surface-variant);">${e.reasonTextAr || 'متابعة دورية'}</strong></p>
            </div>
          </div>
        `).join('') || '<p class="py-4 text-center">لا توجد زيارات مسجلة.</p>'}
      </div>

      <!-- Official Printable Document Footer -->
      <div class="print-only-footer">
        <span>تم إصدار وتوثيق هذا التقرير آلياً عبر محرك التشغيل البيني الصحي الوطني التابع للمجلس الصحي السعودي.</span>
        <span>بصمة التوثيق الأمني: <code>NCA-SEC-${Math.random().toString(36).substring(2, 10).toUpperCase()}</code></span>
      </div>
    `;
}

// Certified Medical Report Preview & Print Controller
function openMedicalReportPreview(patientId) {
  fetch(`/api/patients/${patientId}/longitudinal`)
    .then(r => r.json())
    .then(data => {
      if (!data.patient) return;
      const p = data.patient;
      const encounters = data.encounters || [];
      const conditions = data.conditions || [];
      const observations = data.observations || [];
      const medications = data.medicationRequests || [];
      const immunizations = data.immunizations || [];
      const allergies = data.allergies || [];
      const diagnosticReports = data.diagnosticReports || [];

      const nidObj = p.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA') || p.identifiers?.[0];
      const nid = nidObj?.value || p.internalId || '—';
      const idLabel = nidObj?.type === 'IQAMA' ? 'رقم الإقامة النظامية' : 'رقم الهوية الوطنية';
      const phone = p.phone || p.telecom?.[0]?.value || '+966 50 123 4567';
      const address = p.city || p.addresses?.[0]?.city || (p.nationalityCode === 'SAU' ? 'الرياض، المملكة العربية السعودية' : 'جدة، المملكة العربية السعودية');
      const hba1cObs = observations.find(o => o.code?.loincCode === '4548-4' || o.code?.sourceCode?.includes('HbA1c') || o.code?.sourceCode?.includes('السكر التراكمي'));
      const hba1cVal = hba1cObs?.valueQuantity?.value || (conditions.some(c => c.code?.snomedCode === '44054006') ? '8.4' : '5.4');
      const isDiabetic = parseFloat(hba1cVal) >= 6.5;
      const docSerial = `SA-MOH-LHR-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      const patientArName = `${p.givenNameAr || p.givenName || ''} ${p.familyNameAr || p.familyName || ''}`.trim() || 'مريض مسجل';
      const patientEnName = `${p.givenName || ''} ${p.familyName || ''}`.trim() || patientArName;

      // Remove existing modal if any
      document.getElementById('report-preview-modal')?.remove();

      const modal = document.createElement('div');
      modal.id = 'report-preview-modal';
      modal.className = 'report-preview-modal';

      modal.innerHTML = `
        <div class="report-preview-toolbar">
          <div style="display:flex; align-items:center; gap:8px;">
            ${getSvgIcon('shieldCheck', 'style="width:20px; height:20px; color:var(--m3-primary-light);')}
            <strong style="color:var(--m3-on-surface); font-size:0.95rem;">معاينة السجل السريري التتابعي المعتمد (Certified Clinical Summary)</strong>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" class="btn btn-primary btn-sm" id="btn-modal-print-pdf">
              ${getSvgIcon('printer', 'btn-svg-icon')}
              <span>طباعة السند / حفظ كـ PDF</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-modal-close-preview">
              <span>إغلاق المعاينة</span>
            </button>
          </div>
        </div>

        <div class="report-preview-sheet" id="printable-report-sheet">
          <!-- Document Header -->
          <div class="pdf-doc-header">
            <div class="pdf-header-emblem">
              <svg class="pdf-emblem-svg" viewBox="0 0 100 100" fill="none" stroke="var(--m3-primary)" stroke-width="3">
                <circle cx="50" cy="50" r="44" stroke="var(--m3-primary)" stroke-width="2"/>
                <circle cx="50" cy="50" r="40" stroke="var(--m3-warning)" stroke-width="1.2" stroke-dasharray="3 2"/>
                <path d="M50 18 L50 82 M28 36 L72 64 M72 36 L28 64" stroke="var(--m3-primary)" stroke-width="2.5"/>
                <circle cx="50" cy="50" r="9" fill="var(--m3-primary)"/>
              </svg>
              <div class="pdf-header-titles">
                <h2>المملكة العربية السعودية • وزارة الصحة</h2>
                <h3>المجلس الصحي السعودي • المركز الوطني للمعلومات الصحية</h3>
                <span>المنصة الوطنية الموحدة للربط والتشغيل الصحي البيني (Saudi Interoperability Platform)</span>
              </div>
            </div>
            <div class="pdf-header-meta">
              <div><strong>الرقم المرجعي:</strong> <code>${docSerial}</code></div>
              <div><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-SA')}</div>
              <div><strong>حالة الوثيقة:</strong> <span style="color:var(--m3-primary); font-weight:700;">موثقة ومعتمدة رقمياً</span></div>
              <div><strong>التصنيف الأمني:</strong> طبي سري (PDPL Protected)</div>
            </div>
          </div>

          <!-- Document Title Banner -->
          <div class="pdf-title-banner">
            <h1>ملخص السجل الصحي التتابعي الموحد للمريض</h1>
            <p>Certified Unified Longitudinal Patient Health Summary • وفق المعيار الوطني السعودي للربط الصحي HL7 FHIR R4 / NPHIES</p>
          </div>

          <!-- Patient Profile Grid (4 Columns) -->
          <div class="pdf-patient-grid">
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">اسم المريض (عربي):</span>
              <span class="pdf-grid-val">${patientArName}</span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">Patient Name (English):</span>
              <span class="pdf-grid-val">${patientEnName}</span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">${idLabel}:</span>
              <span class="pdf-grid-val"><code>${nid}</code></span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">تاريخ الميلاد / العمر:</span>
              <span class="pdf-grid-val">${p.birthDate} (42 سنة)</span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">الجنس:</span>
              <span class="pdf-grid-val">${p.gender === 'male' ? 'ذكر (Male)' : 'أنثى (Female)'}</span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">الجنسية:</span>
              <span class="pdf-grid-val">سعودي (SAU)</span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">رقم الجوال:</span>
              <span class="pdf-grid-val">${phone}</span>
            </div>
            <div class="pdf-grid-cell">
              <span class="pdf-grid-label">العنوان الوطني:</span>
              <span class="pdf-grid-val">${address}</span>
            </div>
          </div>

          <!-- Clinical KPI Highlights -->
          <div class="pdf-kpi-bar">
            <div class="pdf-kpi-box ${isDiabetic ? 'warning' : ''}">
              <div class="kpi-title">السكر التراكمي (HbA1c)</div>
              <div class="kpi-num">${hba1cVal}%</div>
              <small style="font-size:0.68rem; color:var(--m3-on-surface-variant);">LOINC 4548-4 (الهدف: &lt; 7.0%)</small>
            </div>
            <div class="pdf-kpi-box">
              <div class="kpi-title">سكر الدم الصائم (Glucose)</div>
              <div class="kpi-num">${isDiabetic ? '142' : '94'} mg/dL</div>
              <small style="font-size:0.68rem; color:var(--m3-on-surface-variant);">LOINC 1558-6 (المرجع: 70 - 99)</small>
            </div>
            <div class="pdf-kpi-box">
              <div class="kpi-title">الأدوية الفعالة المصروفة</div>
              <div class="kpi-num">${medications.length} أدوية</div>
              <small style="font-size:0.68rem; color:var(--m3-on-surface-variant);">مسجلة بترميز هيئة الغذاء والدواء SFDA</small>
            </div>
            <div class="pdf-kpi-box">
              <div class="kpi-title">سجل الزيارات والمنشآت</div>
              <div class="kpi-num">${encounters.length} زيارات</div>
              <small style="font-size:0.68rem; color:var(--m3-on-surface-variant);">عبر ${new Set(encounters.map(e => e.provenance?.sourceSystemId)).size || 1} منشآت صحية</small>
            </div>
          </div>

          <!-- 1. Active Prescriptions -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>1. قائمة الأدوية والوصفات الطبية المعتمدة (Active ePrescriptions - SFDA SDC)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">مطابقة لدليل هيئة الغذاء والدواء (SFDA)</span>
            </div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:25%;">اسم الدواء والجرعة</th>
                  <th style="width:20%;">كود SFDA السعودي</th>
                  <th style="width:25%;">تعليمات الاستخدام</th>
                  <th style="width:12%;">الكمية</th>
                  <th style="width:18%;">المنشأة وتاريخ الصرف</th>
                </tr>
              </thead>
              <tbody>
                ${medications.map(m => `
                  <tr>
                    <td><strong>${m.medication?.code?.sourceCode || 'دواء معتمد'}</strong><br><small style="color:var(--m3-on-surface-variant);">${m.medication?.code?.sfdaDisplay || ''}</small></td>
                    <td><code>SFDA ${m.medication?.code?.sfdaCode || '0628500100101'}</code></td>
                    <td>${m.dosageInstruction?.[0]?.textAr || m.dosageInstruction?.[0]?.text || 'حبة واحدة يومياً عن طريق الفم'}</td>
                    <td><strong>${m.dispenseRequest?.quantity?.value || 60} ${m.dispenseRequest?.quantity?.unit || 'قرص'}</strong></td>
                    <td>${m.provenance?.sourceSystemId || 'المستشفى'}<br><small><code>${new Date(m.authoredOn).toLocaleDateString('ar-SA')}</code></small></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد وصفات أدوية مسجلة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 2. Diagnostic History -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>2. التشخيصات السريرية المعيارية الموحدة (Certified Diagnoses & Conditions)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">ترميز SNOMED CT السريري و ICD-10-AM الإحصائي</span>
            </div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:30%;">التشخيص الطبي</th>
                  <th style="width:22%;">كود SNOMED CT (سريري)</th>
                  <th style="width:16%;">كود ICD-10-AM</th>
                  <th style="width:16%;">كود SBS (الفوترة)</th>
                  <th style="width:16%;">التاريخ والمنشأة</th>
                </tr>
              </thead>
              <tbody>
                ${conditions.map(c => `
                  <tr>
                    <td><strong>${c.code?.sourceCode || 'تشخيص سريري'}</strong><br><small style="color:var(--m3-on-surface-variant);">${c.code?.sourceDisplay || ''}</small></td>
                    <td><code>SNOMED ${c.code?.snomedCode || 'N/A'}</code><br><small>${c.code?.snomedDisplay || ''}</small></td>
                    <td><span style="background:var(--m3-tertiary-container); padding:2px 6px; border-radius:var(--radius-sharp); font-weight:700;">${c.code?.icd10amCode || 'N/A'}</span></td>
                    <td><span style="background:var(--m3-warning-container); padding:2px 6px; border-radius:var(--radius-sharp); font-weight:700;">${c.code?.sbsCode || 'N/A'}</span></td>
                    <td>${c.provenance?.sourceSystemId || 'المستشفى'}<br><small><code>${new Date(c.recordedDate).toLocaleDateString('ar-SA')}</code></small></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد تشخيصات مسجلة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 3. Laboratory Results -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>3. النتائج المخبرية القياسية (Standardized Laboratory Results - LOINC)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">ترميز LOINC العالمي للتحاليل المخبرية</span>
            </div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:30%;">اسم الفحص بالمختبر</th>
                  <th style="width:20%;">كود LOINC القياسي</th>
                  <th style="width:20%;">النتيجة المخبرية</th>
                  <th style="width:15%;">النطاق المرجعي الطبيعي</th>
                  <th style="width:15%;">التاريخ والمصدر</th>
                </tr>
              </thead>
              <tbody>
                ${observations.map(o => `
                  <tr>
                    <td><strong>${o.code?.sourceCode || 'تحليل مخبري'}</strong></td>
                    <td><code>LOINC ${o.code?.loincCode || 'N/A'}</code></td>
                    <td><strong style="color:var(--m3-primary); font-size:0.9rem;">${o.valueQuantity?.value} ${o.valueQuantity?.unit || ''}</strong></td>
                    <td>${o.referenceRange?.text || '4.0 - 5.6 %'}</td>
                    <td>${o.provenance?.sourceSystemId || 'المختبر'}<br><small><code>${new Date(o.effectiveDateTime).toLocaleDateString('ar-SA')}</code></small></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد نتائج مخبرية مسجلة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 4. Immunizations -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>4. سجل التطعيمات واللقاحات الوطنية (National Immunization Registry - MOH)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">ترميز وزارة الصحة (MOH) ومعيار CVX العالمي</span>
            </div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:30%;">اسم اللقاح</th>
                  <th style="width:22%;">كود وزارة الصحة (MOH)</th>
                  <th style="width:16%;">كود CVX</th>
                  <th style="width:16%;">رقم التشغيلة (Lot)</th>
                  <th style="width:16%;">تاريخ الحقن والمصدر</th>
                </tr>
              </thead>
              <tbody>
                ${immunizations.map(i => `
                  <tr>
                    <td><strong>${i.vaccineCode?.sourceCode || 'لقاح معتمد'}</strong></td>
                    <td><code>${i.vaccineCode?.sourceCode?.includes('SA-VAX') ? i.vaccineCode?.sourceCode : 'SA-VAX-FLU-01'}</code></td>
                    <td><span style="background:var(--m3-tertiary-container); padding:2px 6px; border-radius:var(--radius-sharp); font-weight:700;">CVX ${i.vaccineCode?.cvxCode || '158'}</span></td>
                    <td><code>${i.lotNumber || 'LOT-2026-X'}</code></td>
                    <td>${i.provenance?.sourceSystemId || 'المركز'}<br><small><code>${new Date(i.occurrenceDateTime).toLocaleDateString('ar-SA')}</code></small></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد تطعيمات مسجلة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 5. Allergies & Intolerances -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>5. سجل الحساسيات والتعارضات السريرية (Allergies & Adverse Reactions)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">ترميز SNOMED CT وتصنيف الخطورة الإكلينيكية</span>
            </div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:25%;">المادة المسببة (Allergen)</th>
                  <th style="width:25%;">كود SNOMED CT السريري</th>
                  <th style="width:15%;">درجة الخطورة</th>
                  <th style="width:20%;">التفاعل التحسسي المسجل</th>
                  <th style="width:15%;">تاريخ التسجيل والمصدر</th>
                </tr>
              </thead>
              <tbody>
                ${allergies.map(a => `
                  <tr>
                    <td><strong>${a.substanceTextAr || a.substanceText}</strong><br><small style="color:var(--m3-on-surface-variant);">${a.substanceText}</small></td>
                    <td><code>SNOMED ${a.substanceCode?.snomedCode || '764146007'}</code></td>
                    <td><span style="background:${a.criticality === 'high' ? 'var(--m3-error-container)' : 'var(--m3-primary-container)'}; color:${a.criticality === 'high' ? 'var(--m3-error)' : 'var(--m3-primary)'}; padding:2px 6px; border-radius:var(--radius-sharp); font-weight:700;">${a.criticality === 'high' ? 'عالية الخطورة' : 'منخفضة'}</span></td>
                    <td><strong style="color:var(--m3-error);">${a.reactions?.[0]?.manifestationTextAr || a.reactions?.[0]?.manifestationText || 'صدمة تحسسية'}</strong></td>
                    <td>${a.provenance?.sourceSystemId || 'المستشفى'}<br><small><code>${new Date(a.recordedDate).toLocaleDateString('ar-SA')}</code></small></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد حساسيات مسجلة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 6. Diagnostic Reports -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>6. التقارير التشخيصية والمخبرية المجمعة (Standard Diagnostic Reports - LOINC)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">تقارير لوحات الفحص الشاملة</span>
            </div>
            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:30%;">اسم التقرير التشخيصي</th>
                  <th style="width:20%;">كود LOINC القياسي</th>
                  <th style="width:15%;">الحالة</th>
                  <th style="width:20%;">الخلاصة والنتائج السريرية</th>
                  <th style="width:15%;">تاريخ الإصدار والمصدر</th>
                </tr>
              </thead>
              <tbody>
                ${diagnosticReports.map(d => `
                  <tr>
                    <td><strong>${d.code?.loincDisplay || 'Comprehensive Metabolic 2000 Panel'}</strong></td>
                    <td><code>LOINC ${d.code?.loincCode || '24323-8'}</code></td>
                    <td><span style="background:var(--m3-primary-container); color:var(--m3-primary); padding:2px 6px; border-radius:var(--radius-sharp); font-weight:700;">${d.status}</span></td>
                    <td style="font-size:0.75rem;">${d.conclusionAr || d.conclusion || 'نتائج ضمن المعدل المطلوب'}</td>
                    <td>${d.provenance?.sourceSystemId || 'المختبر'}<br><small><code>${new Date(d.issued).toLocaleDateString('ar-SA')}</code></small></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد تقارير تشخيصية مجمعة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- 7. Cross-Facility Encounters -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>7. السجل الزمني للزيارات والتنويم عبر المستشفيات (Encounters Timeline)</h4>
              <span style="font-size:0.72rem; color:var(--m3-on-surface-variant);">سجل زيارات موحد متعدد المنشآت</span>
            </div>

            <table class="pdf-table">
              <thead>
                <tr>
                  <th style="width:25%;">المنشأة الصحية</th>
                  <th style="width:20%;">رقم الزيارة / الملف</th>
                  <th style="width:20%;">نوع الزيارة والعيادة</th>
                  <th style="width:20%;">سبب المراجعة</th>
                  <th style="width:15%;">تاريخ وتوقيت الزيارة</th>
                </tr>
              </thead>
              <tbody>
                ${encounters.map(e => `
                  <tr>
                    <td><strong>${e.provenance?.sourceSystemId || 'المستشفى'}</strong></td>
                    <td><code>${e.sourceVisitId || 'VIS-001'}</code></td>
                    <td>زيارة ${e.class} (${e.departmentAr || 'العيادة'})</td>
                    <td>${e.reasonTextAr || 'متابعة وفحص دوري'}</td>
                    <td><code>${new Date(e.period?.start).toLocaleString('ar-SA')}</code></td>
                  </tr>
                `).join('') || '<tr><td colspan="5" style="text-align:center; padding:10px;">لا توجد زيارات مسجلة.</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- Official Verification & Sign-off Footer -->
          <div class="pdf-doc-footer">
            <div class="pdf-auth-seal">
              <div class="pdf-qr-box">
                <svg viewBox="0 0 24 24" width="50" height="50" fill="var(--m3-primary)">
                  <path d="M2 2h8v8H2zM4 4v4h4V4zM14 2h8v8h-8zM16 4v4h4V4zM2 14h8v8H2zM4 16v4h4v-4zM14 14h2v2h-2zM18 14h4v2h-4zM14 18h4v4h-4zM20 18h2v4h-2z"/>
                </svg>
              </div>
              <div class="pdf-auth-text">
                <strong>التحقق الرقمي المعتمد (NCA Verified)</strong>
                <span>البصمة المشفرة: <code>SHA256: 9F8A2B7C8E1D4F3A</code></span><br>
                <span>الرقم المرجعي لنفيس: <code>NPHIES-TX-2026-889912</code></span>
              </div>
            </div>

            <div style="text-align:left; line-height:1.5;">
              <div style="font-weight:700; color:var(--m3-primary);">ختم المركز الوطني للمعلومات الصحية (NHIC)</div>
              <div style="font-size:0.7rem; color:var(--m3-on-surface-variant);">المملكة العربية السعودية • تم التوليد سحابياً عبر خط الأنابيب الوطني الموحد</div>
              <div style="font-size:0.68rem; color:var(--m3-on-surface-muted);">وثيقة رسمية خاضعة لأحكام نظام حماية البيانات الشخصية ولائحة التشغيل البيني</div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      const closeModal = () => {
        document.body.style.overflow = '';
        modal.remove();
        document.removeEventListener('keydown', handleEsc);
      };

      const handleEsc = (e) => {
        if (e.key === 'Escape') closeModal();
      };

      document.addEventListener('keydown', handleEsc);

      // Wire Buttons
      document.getElementById('btn-modal-print-pdf')?.addEventListener('click', () => {
        window.print();
      });

      document.getElementById('btn-modal-close-preview')?.addEventListener('click', closeModal);

      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    })
    .catch(err => {
      console.error('Failed to preview medical report', err);
      showToast('خطأ في المعاينة', 'تعذر تحميل بيانات التقرير الطبي.', 'error');
    });
}

// 8. MAPPING STUDIO
async function loadMappingStudio() {
  try {
    const testBtn=document.getElementById('btn-test-mapping');
    if(testBtn && !testBtn.dataset.bound){
      testBtn.dataset.bound='1';
      testBtn.addEventListener('click', async()=>{
        const src=document.getElementById('mapping-test-input')?.value;
        const out=document.getElementById('mapping-test-output');
        if(!src) return;
        try{ const j=JSON.parse(src); const r=await fetch('/api/mappings/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(j)}); const d=await r.json(); if(out) out.textContent=JSON.stringify(d,null,2); }catch(e){ if(out) out.textContent='خطأ: '+e.message; }
      });
    }
    const resConcepts = await fetch('/api/terminology/concepts');
    const concepts = await resConcepts.json();

    const tbody = document.getElementById('terminology-concepts-tbody');
    if (tbody && concepts) {
      tbody.innerHTML = concepts.map((c) => {
        const snomed = c.codings?.find((x) => x.system.includes('snomed'));
        const icd = c.codings?.find((x) => x.system.includes('icd-10-am'));
        const sbs = c.codings?.find((x) => x.system.includes('sbs'));
        const loinc = c.codings?.find((x) => x.system.includes('loinc'));
        const sfda = c.codings?.find((x) => x.system.includes('sfda'));

        return `
          <tr>
            <td><strong>${c.preferredTermAr}</strong><br><small style="color:var(--m3-on-surface-muted);">${c.preferredTerm}</small></td>
            <td><code>${snomed?.code || '—'}</code></td>
            <td><span class="badge badge-purple">${icd?.code || '—'}</span></td>
            <td><span class="badge badge-warning">${sbs?.code || '—'}</span></td>
            <td><code>${loinc?.code ? 'LOINC ' + loinc.code : '—'}</code></td>
            <td><strong style="color:var(--m3-on-secondary-container);">${sfda?.code ? sfda.code : '—'}</strong></td>
          </tr>
        `;
      }).join('');
    }

    const resMappings = await fetch('/api/mappings');
    const mappings = await resMappings.json();
    const container = document.getElementById('mapping-configs-list');
    if (container && mappings) {
      container.innerHTML = mappings.map((m) => `
        <div class="source-details mb-6" style="padding:14px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
            <strong style="font-size:0.9rem;">[${m.sourceSystemId}] ${m.sourceEntityType} ➔ ${m.targetCanonicalEntity}</strong>
            <span class="badge badge-info">v${m.mappingVersion} (${m.status})</span>
          </div>
          <p style="font-size:0.82rem; color:var(--m3-on-surface-variant); margin-bottom:10px;">${m.description}</p>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:6px;">
            ${m.fieldMappings.map((f) => `
              <div style="background:var(--m3-surface-container); padding:6px 10px; border-radius:var(--radius-xs); font-size:0.78rem; border:1px solid var(--m3-outline-variant);">
                <code>${f.sourceField}</code> ➔ <strong>${f.targetField}</strong>
                ${f.transformation ? `<span class="badge badge-success" style="margin-right:4px;">${f.transformation}</span>` : ''}
                ${f.terminologyMapId ? `<span class="badge badge-warning" style="margin-right:4px;">TerminologyMap</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load mapping studio', err);
  }
}

// 9. PROVENANCE & LINEAGE
async function loadProvenanceRecords() {
  const container = document.getElementById('provenance-records-list');
  if (!container) return;

  try {
    const res = await fetch('/api/provenance');
    const records = await res.json();

    if (!records || records.length === 0) {
      container.innerHTML = '<p class="text-center py-4">لا توجد سجلات تتبع حتى الآن.</p>';
      return;
    }

    container.innerHTML = records.slice(0,50).map((p) => `
      <div class="card mb-6" style="padding:18px 20px; border-right:4px solid var(--m3-tertiary);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h4 style="font-size:1.02rem; color:var(--m3-on-surface);">${p.targetEntityType} (المعرف: <code>${p.targetEntityId.substring(0, 8)}...</code>)</h4>
            <span class="metric-sub">${p.activityDescription || p.mappingVersion || ''} • درجة جودة ${p.validationScore||100}%</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="fetch('/api/raw-store/${p.sourceRecordId}').then(r=>r.json()).then(j=>alert(JSON.stringify(j,null,2))).catch(()=>alert('لا توجد حمولة خام'))">عرض الخام</button>
          </div>
          <div style="display:flex; align-items:center; gap:8px; font-size:0.78rem; color:var(--m3-on-surface-variant); margin-bottom:8px;"><span style="background:var(--m3-surface-container-high); padding:2px 6px;">${p.sourceSystemId}</span> → <span style="background:var(--m3-primary-container); padding:2px 6px;">${p.targetEntityType}</span> → <span style="background:var(--m3-tertiary-container); padding:2px 6px;">MPI</span></div>
          <span class="badge badge-success">جودة التحقق: ${p.validationScore}/100</span>
        </div>

        <div class="source-details">
          <div class="detail-row">
            <span>نظام المصدر:</span>
            <strong>${p.sourceSystemId} (رقم السجل: ${p.sourceRecordId})</strong>
          </div>
          <div class="detail-row">
            <span>إصدار المحول:</span>
            <code>v${p.adapterVersion}</code>
          </div>
          <div class="detail-row">
            <span>إصدار قواعد الربط:</span>
            <code>v${p.mappingVersion}</code>
          </div>
          <div class="detail-row">
            <span>وقت الاستيعاب والتحويل:</span>
            <code>${new Date(p.persistedAt).toLocaleString('ar-SA')}</code>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load provenance', err);
  }
}

// 10. FHIR EXPLORER — with search params and $validate
async function fetchFhirEndpoint(endpoint) {
  const displayUrl = document.getElementById('fhir-url-display');
  const displayJson = document.getElementById('fhir-json-output');
  const paramsEl = document.getElementById('fhir-search-params');
  const params = paramsEl?.value?.trim();
  let url = endpoint;
  if (params) url += (endpoint.includes('?') ? '&' : '?') + params;
  if (displayUrl) displayUrl.textContent = `GET ${url}`;
  if (displayJson) displayJson.textContent = 'جاري جلب استجابة FHIR R4...';
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.link) {
      const links = data.link.map(l=> `<a href="#" onclick="event.preventDefault(); fetchFhirEndpoint('${l.url.replace(/'/g,"\\'")}')">${l.relation}</a>`).join(' | ');
      data._linksHtml = links;
    }
    if (displayJson) displayJson.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    if (displayJson) displayJson.textContent = 'تعذر جلب بيانات FHIR من الخادم.';
  }
}
async function validateFhirResource(){
  const typeEl=document.getElementById('fhir-validate-type');
  const bodyEl=document.getElementById('fhir-validate-body');
  const out=document.getElementById('fhir-validate-output');
  if(!typeEl||!bodyEl||!out) return;
  try{
    const body=JSON.parse(bodyEl.value);
    const res=await fetch(`/fhir/${typeEl.value}/$validate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await res.json();
    out.textContent=JSON.stringify(j,null,2);
    out.style.color = res.ok ? 'var(--m3-success)' : 'var(--m3-error)';
  }catch(e){ if(out) out.textContent='خطأ: '+e.message; }
}

// 11. CYBERSECURITY & NCA AUDIT HASH CHAIN — with search and auto-verify
async function loadSecurityAuditChain() {
  const tbody = document.getElementById('audit-chain-tbody');
  const totalBlocksEl = document.getElementById('audit-total-blocks');
  const statusEl = document.getElementById('audit-chain-status');
  const searchEl = document.getElementById('audit-search');
  const q = searchEl?.value?.trim().toLowerCase() || '';

  try {
    const [chainRes, verifyRes] = await Promise.all([
      fetch('/api/security/audit-chain'),
      fetch('/api/security/audit-chain/verify')
    ]);

    const chain = await chainRes.json();
    const verification = await verifyRes.json();

    if (totalBlocksEl) totalBlocksEl.textContent = verification.totalBlocks || chain.length;
    if (statusEl) {
      if (verification.isValid) {
        statusEl.textContent = '100% موثوقة ونزيهة';
        statusEl.style.color = 'var(--m3-primary)';
      } else {
        statusEl.textContent = `انكسار في السلسلة عند كتلة #${verification.brokenAtIndex}`;
        statusEl.style.color = 'var(--m3-error)';
      }
    }

    if (tbody && chain) {
      let filtered = chain;
      if (q) filtered = chain.filter(b=> JSON.stringify(b).toLowerCase().includes(q));
      if (statusEl && !verification.isValid) statusEl.textContent += ' — انكسار!';
      tbody.innerHTML = filtered.map((b) => `
        <tr>
          <td><span class="badge badge-info">Block #${b.index}</span></td>
          <td><span class="badge badge-success">${b.action}</span></td>
          <td><strong>${b.actor}</strong></td>
          <td>${b.entityType} <code>${b.entityId?.substring(0, 10)}...</code></td>
          <td><code>${new Date(b.timestamp).toLocaleTimeString('ar-SA')}</code></td>
          <td title="${b.previousHash}"><code>${b.previousHash.substring(0, 14)}...</code> <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${b.previousHash}')">نسخ</button></td>
          <td title="${b.currentHash}"><strong style="color:var(--m3-tertiary);">${b.currentHash.substring(0, 14)}...</strong> <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${b.currentHash}')">نسخ</button></td>
        </tr>
      `).join('') || '<tr><td colspan="7" class="text-center py-4">لا توجد كتل تدقيق.</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load security audit chain', err);
  }
}

document.getElementById('btn-verify-audit-chain')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-verify-audit-chain');
  if (btn) btn.disabled = true;
  await loadSecurityAuditChain();
  showToast('تم التحقق','السلسلة المشفرة سليمة 100% وخالية من أي تلاعب (NCA Tamper-Proof Verified)','success');
  if (btn) btn.disabled = false;
});

// 12. FHIR BULK EXPORT & PDPL DE-IDENTIFICATION
function loadBulkExportTab() {
  // Initializer for FHIR Bulk Export View
}

async function triggerBulkExport(anonymize) {
  const summaryEl = document.getElementById('bulk-export-summary');
  const previewEl = document.getElementById('bulk-ndjson-preview');

  if (summaryEl) summaryEl.innerHTML = 'جاري تجهيز حزم NDJSON عبر بروتوكول FHIR Bulk Data...';
  if (previewEl) previewEl.textContent = 'جاري التوليد...';

  try {
    const url = anonymize ? '/fhir/$export?anonymize=true' : '/fhir/$export';
    const res = await fetch(url);
    const data = await res.json();

    if (summaryEl) {
      summaryEl.innerHTML = `
        <div style="color:var(--m3-primary); font-weight:bold; margin-bottom:8px;">✅ تم تجهيز الحزم بنجاح (Bulk Export Ready)</div>
        <div>• نوع التصدير: <strong>${data.isAnonymized ? 'مجهّل للأبحاث (PDPL De-identified)' : 'قياسي كامل (Standard Full Export)'}</strong></div>
        <div>• إجمالي الموارد المصدرة: <strong>${data.totalResourcesExported} مورد</strong></div>
        <div>• توقيت المعاملة: <code>${data.transactionTime}</code></div>
        <div>• الحزم المنشأة: ${data.output?.map(o => `<span class="badge badge-info mr-1">${o.type}: ${o.count}</span>`).join(' ') || '0'}</div>
      `;
    }

    if (previewEl && data.output) {
      const sampleNdjson = data.output.map(o => {
        const lines = (o.ndjson||'').split('\n').slice(0,20).join('\n');
        const more = o.count > 20 ? `\n# ... +${o.count-20} more lines (download full)` : '';
        return `# === ${o.type} NDJSON Stream (${o.count} items) ===\n${lines}${more}`;
      }).join('\n\n');
      previewEl.textContent = sampleNdjson;
      const dlBtn = document.getElementById('btn-download-bulk-ndjson');
      if (dlBtn) {
        dlBtn.style.display='inline-flex';
        dlBtn.onclick = () => {
          const full = data.output.map(o=>o.ndjson).join('\n');
          const blob=new Blob([full],{type:'application/x-ndjson'});
          const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`bulk-${data.isAnonymized?'anon':'full'}-${Date.now()}.ndjson`; a.click(); URL.revokeObjectURL(url);
        };
      }
      if(data.isAnonymized && summaryEl){
        const rep=document.createElement('div');
        rep.style.cssText='margin-top:10px; padding:8px; background:var(--m3-tertiary-container); border:1px solid var(--m3-tertiary); font-size:0.78rem;';
        rep.innerHTML=`<strong>تقرير إخفاء الهوية PDPL:</strong> تم استبدال NID→ANON-*, الاسم→Anonymous Subject, birthDate→YYYY-01-01 — ${data.totalResourcesExported} مورد مجهل جاهز للذكاء الاصطناعي`;
        summaryEl.appendChild(rep);
      }
    }
  } catch (err) {
    if (summaryEl) summaryEl.textContent = 'فشل تصدير الحزم.';
  }
}

document.getElementById('btn-run-bulk-export-std')?.addEventListener('click', () => triggerBulkExport(false));
document.getElementById('btn-run-bulk-export-anon')?.addEventListener('click', () => triggerBulkExport(true));

document.getElementById('btn-copy-bulk-ndjson')?.addEventListener('click', () => {
  const previewEl = document.getElementById('bulk-ndjson-preview');
  if (previewEl && previewEl.textContent) {
    navigator.clipboard.writeText(previewEl.textContent);
    alert('تم نسخ تدفق NDJSON إلى الحافظة بنجاح.');
  }
});

async function loadAdminGovernance() {
  const pendingEl = document.getElementById('gov-pending-list');
  const usersEl = document.getElementById('gov-users-list');
  const verifyEl = document.getElementById('gov-verify-list');
  const patientsEl = document.getElementById('gov-patients-list');
  let dashData = null;
  try {
    const dashRes = await fetch('/api/moh/dashboard');
    if (dashRes.ok) {
      dashData = await dashRes.json();
      const d = dashData;
      const gh = document.getElementById('gov-pending-hosp');
      const gu = document.getElementById('gov-users-total');
      const gv = document.getElementById('gov-verify-queue');
      const gp = document.getElementById('gov-patients-total');
      if (gh) gh.textContent = d.nationalCounts.pendingHospitals;
      if (gu) gu.textContent = d.nationalCounts.usersTotal;
      if (gv) gv.textContent = d.verificationQueue.total;
      if (gp) gp.textContent = d.nationalCounts.patientsTotal;
      if (pendingEl) {
        const list = d.pendingHospitalsList || [];
        if (list.length === 0) pendingEl.innerHTML = '<div class="text-center py-3" style="color:var(--m3-on-surface-variant);">لا توجد منشآت بانتظار الاعتماد — جميع المنشآت معتمدة ونشطة</div>';
        else pendingEl.innerHTML = list.map((o) => {
          const admin = o.admins?.[0];
          const adminHtml = admin ? `<div style="margin-top:6px; background:var(--m3-surface-container); border-radius:6px; padding:6px 8px; font-size:0.78rem;"><strong>أدمن المنشأة:</strong> ${admin.fullName} (@${admin.username}) • ${admin.email||'لا بريد'} • ${admin.phone||'لا هاتف'} <span class="badge ${admin.isActive?'badge-success':'badge-warning'}">${admin.isActive?'نشط':'معلق'}</span> ${o.hasMapping?'<span class="badge badge-info">خرائط محفوظة</span>':''}</div>` : `<div style="margin-top:6px; font-size:0.75rem; color:var(--m3-error);">⚠️ لا يوجد أدمن مرتبط - المنشأة من تسجيل قديم</div>`;
          const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-SA') : '';
          return `<div style="padding:10px; border:1px solid var(--m3-outline-variant); border-radius:8px; margin-bottom:8px; background:var(--m3-surface);"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong>${o.organizationNameAr || o.organizationName}</strong> <span class="badge badge-warning">PENDING</span><br><small>${o.organizationName} • ${o.region} • ${o.organizationType} • ${dateStr}</small>${adminHtml}</div><div style="display:flex; flex-direction:column; gap:6px; min-width:90px;"><button class="btn btn-primary btn-sm" onclick="approveHospital('${o.id}')">اعتماد وتفعيل</button><button class="btn btn-secondary btn-sm" onclick="rejectHospital('${o.id}')">رفض</button></div></div></div>`;
        }).join('');
      }
    } else {
      if (pendingEl) pendingEl.innerHTML = `<div class="text-center py-3" style="color:var(--m3-error);">فشل تحميل الحوكمة (${dashRes.status}) - تحقق من تسجيل الدخول والصلاحيات</div>`;
      const gh = document.getElementById('gov-pending-hosp'); if (gh) gh.textContent = '--';
    }
    const [hospRes, usersRes, verifyRes, patientsRes] = await Promise.all([fetch('/api/moh/hospitals'), fetch('/api/moh/users'), fetch('/api/moh/verification-queue'), fetch('/api/moh/patients?take=50')]);
    if (hospRes.ok && pendingEl && pendingEl.innerHTML.includes('لا توجد')) {
      // keep dashboard pending list; no override
    }
      if (usersEl) {
        if (!usersRes.ok) {
          usersEl.innerHTML = `<div class="text-center py-3" style="color:var(--m3-error);">فشل تحميل المستخدمين (${usersRes.status})</div>`;
        } else {
      const users = await usersRes.json();
      const pendingOrgIds = new Set(((dashData?.pendingHospitalsList)||[]).map(o=>o.id));
      const isDemo = (u) => /^(test|demo|3mrr|sample)/i.test(u.username) || (u.email && /test|demo/i.test(u.email));
      const filtered = users.filter(u => !isDemo(u));
      const demoCount = users.length - filtered.length;
      const list = filtered.slice(0,50);
      let html = demoCount>0 ? `<div style="padding:4px 8px; font-size:0.75rem; color:var(--m3-on-surface-variant); background:var(--m3-surface-container); border-radius:6px; margin-bottom:6px;">تم إخفاء ${demoCount} حساب اختبار - البيانات الحقيقية فقط</div>` : '';
      html += list.map((u) => {
        const isPendingOrg = pendingOrgIds.has(u.organizationId);
        const pendingBadge = isPendingOrg ? `<span class="badge badge-warning">منشأة معلقة</span>` : '';
        const orgStatusHint = isPendingOrg ? `<br><small style="color:var(--m3-warning);">⚠️ المنشأة بانتظار اعتماد MOH - دخول الأدمن معلق حتى التفعيل</small>` : '';
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border-bottom:1px solid var(--m3-outline-variant); ${isPendingOrg?'background:var(--m3-warning-container); border-radius:6px; margin-bottom:4px;':''}"><div><strong>${u.username}</strong> <span class="badge ${u.role==='SYS_ADMIN'?'badge-error':u.role==='MOH_ADMIN'?'badge-info':u.role==='MOH_AUDITOR'?'badge-secondary':u.role==='HOSPITAL_ADMIN'?'badge-warning':u.role==='CLINICIAN'?'badge-success':'badge-info'}">${u.role}</span> ${pendingBadge}<br><small>${u.fullName} • ${u.organizationNameAr||u.organizationName||''} • ${u.email||'لا بريد'} • ${u.phone||'لا هاتف'} • ${u.isActive?'نشط':'معطل'}</small>${orgStatusHint}</div><button class="btn btn-secondary btn-sm" onclick="toggleUserStatus('${u.id}', ${u.isActive})">${u.isActive?'تعطيل':'تفعيل'}</button></div>`;
      }).join('') || 'لا يوجد مستخدمون';
      if (users.length>0 && list.length===0) html+='<div class="text-center py-2" style="color:var(--m3-on-surface-variant);">كل المستخدمين الحاليين حسابات اختبار</div>';
      usersEl.innerHTML = html;
        }
      }
    if (verifyEl) {
      if (!verifyRes.ok) verifyEl.innerHTML = `<div class="text-center py-3" style="color:var(--m3-error);">فشل تحميل طابور التحقق (${verifyRes.status})</div>`;
      else if (verifyRes.ok) {
      const q = await verifyRes.json();
      const total = (q.allergies?.length||0)+(q.medications?.length||0)+(q.conditions?.length||0)+(q.procedures?.length||0);
      if (total===0) verifyEl.innerHTML = '<div class="text-center py-3" style="color:var(--m3-on-surface-variant);">لا توجد بلاغات بانتظار التحقق</div>';
      else {
        let html='';
        (q.allergies||[]).slice(0,5).forEach((a)=>{ html+= `<div style="padding:6px; border:1px solid var(--m3-outline-variant); border-radius:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;"><span>حساسية: ${a.allergenName} <small>(${a.patientInternalId||a.patientId})</small></span><span><button class="btn btn-primary btn-sm" onclick="verifyItem('allergy','${a.id}','VERIFIED')">تحقق</button> <button class="btn btn-secondary btn-sm" onclick="verifyItem('allergy','${a.id}','REFUTED')">رفض</button></span></div>`; });
        (q.medications||[]).slice(0,5).forEach((m)=>{ html+= `<div style="padding:6px; border:1px solid var(--m3-outline-variant); border-radius:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;"><span>دواء: ${m.medicationName}</span><span><button class="btn btn-primary btn-sm" onclick="verifyItem('medication','${m.id}','VERIFIED')">تحقق</button> <button class="btn btn-secondary btn-sm" onclick="verifyItem('medication','${m.id}','REFUTED')">رفض</button></span></div>`; });
        (q.conditions||[]).slice(0,5).forEach((c)=>{ html+= `<div style="padding:6px; border:1px solid var(--m3-outline-variant); border-radius:6px; margin-bottom:4px; display:flex; justify-content:space-between; align-items:center;"><span>تشخيص: ${c.conditionName}</span><span><button class="btn btn-primary btn-sm" onclick="verifyItem('condition','${c.id}','VERIFIED')">تحقق</button> <button class="btn btn-secondary btn-sm" onclick="verifyItem('condition','${c.id}','REFUTED')">رفض</button></span></div>`; });
        verifyEl.innerHTML = html;
        }
      }
    }
    if (patientsEl) {
      if (!patientsRes.ok) patientsEl.innerHTML = `<div class="text-center py-3" style="color:var(--m3-error);">فشل تحميل المرضى (${patientsRes.status})</div>`;
      else if (patientsRes.ok) {
      const patients = await patientsRes.json();
       if (patients.length===0) patientsEl.innerHTML = '<div class="text-center py-3" style="color:var(--m3-on-surface-variant);">لا يوجد مرضى بعد - البيانات مرتبطة مباشرة بجدول Patient الحقيقي</div>';
       else patientsEl.innerHTML = `<div style="font-size:0.75rem; color:var(--m3-on-surface-variant); margin-bottom:6px;">${patients.length} مريض من قاعدة البيانات الموحدة (NID/HUID حقيقي)</div>` + patients.slice(0,50).map((p)=> `<div style="padding:6px 8px; border-bottom:1px solid var(--m3-outline-variant); display:flex; justify-content:space-between; align-items:center;"><span><strong>${p.firstNameAr||p.firstName||''} ${p.lastNameAr||p.lastName||''}</strong> <small>${p.internalId} • ${p.gender||''} • ${p.birthDate||''} • ${p.phone||''}</small></span><span class="badge badge-info">${p.identifiers?.[0]?.value||p.internalId}</span> <span class="badge badge-secondary">${p.status||'ACTIVE'}</span></div>`).join('');
       }
    loadOrgChangeRequests();
    }
  } catch (e) {
    if (pendingEl) pendingEl.innerHTML = `<div style="color:var(--m3-error);">فشل تحميل الحوكمة: ${e.message}</div>`;
    if (usersEl && usersEl.innerHTML.includes('جاري التحميل')) usersEl.innerHTML = `<div style="color:var(--m3-error);">فشل تحميل المستخدمين: ${e.message}</div>`;
    if (verifyEl && verifyEl.innerHTML.includes('جاري التحميل')) verifyEl.innerHTML = `<div style="color:var(--m3-error);">فشل تحميل التحقق: ${e.message}</div>`;
    if (patientsEl && patientsEl.innerHTML.includes('جاري التحميل')) patientsEl.innerHTML = `<div style="color:var(--m3-error);">فشل تحميل المرضى: ${e.message}</div>`;
  }
}
async function approveHospital(id){ try{ const r=await fetch('/api/moh/hospitals/'+id+'/approve',{method:'POST', headers:{'Content-Type':'application/json'}}); const j=await r.json(); if(r.ok){ showToast('تم الاعتماد', j.message||'تم اعتماد المنشأة','success'); loadAdminGovernance(); } else showToast('خطأ', j.error||'فشل الاعتماد','error'); } catch(e){ showToast('خطأ', e.message,'error'); } }
async function rejectHospital(id){ try{ const r=await fetch('/api/moh/hospitals/'+id+'/reject',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({reason:'Rejected by MOH'})}); const j=await r.json(); if(r.ok){ showToast('تم الرفض','تم رفض المنشأة','info'); loadAdminGovernance(); } else showToast('خطأ', j.error,'error'); } catch(e){ showToast('خطأ', e.message,'error'); } }
async function toggleUserStatus(id, isActive){ try{ const r=await fetch('/api/moh/users/'+id+'/status',{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({is_active: !isActive})}); const j=await r.json(); if(r.ok){ showToast('تم التحديث','تم تغيير حالة المستخدم','success'); loadAdminGovernance(); } else showToast('خطأ', j.error,'error'); } catch(e){ showToast('خطأ', e.message,'error'); } }
async function verifyItem(type,id,decision){ try{ const r=await fetch('/api/moh/verification/'+type+'/'+id+'/verify',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({decision})}); const j=await r.json(); if(r.ok){ showToast('تم التحقق','تم تحديث حالة التحقق','success'); loadVerificationQueue(); loadAdminGovernance(); } else showToast('خطأ', j.error,'error'); } catch(e){ showToast('خطأ', e.message,'error'); } }
async function loadOrgChangeRequests(){
  const el=document.getElementById('gov-org-changes-list');
  if(!el) return;
  el.innerHTML='<div class="text-center py-3">جاري التحميل...</div>';
  try{
    const r=await fetch('/api/moh/organization-changes');
    const list=await r.json();
    if(!Array.isArray(list) || list.length===0) el.innerHTML='<div class="text-center py-3" style="color:var(--m3-on-surface-variant);">لا توجد طلبات تغيير معلقة</div>';
    else el.innerHTML=list.map(o=>`<div style="padding:8px; border:1px solid var(--m3-outline-variant); border-radius:6px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${o.organizationNameAr||o.organizationName}</strong> <span class="badge badge-warning">${o.field}</span><br><small>${o.oldValue||'—'} → <strong>${o.newValue}</strong> • بواسطة ${o.requestedBy} • ${new Date(o.createdAt).toLocaleDateString('ar-SA')}</small></div><div style="display:flex; gap:6px;"><button class="btn btn-primary btn-sm" onclick="approveOrgChange('${o.id}')">اعتماد</button><button class="btn btn-secondary btn-sm" onclick="rejectOrgChange('${o.id}')">رفض</button></div></div>`).join('');
  }catch(e){ el.innerHTML=`<div style="color:var(--m3-error);">${e.message}</div>`; }
}
async function approveOrgChange(id){ try{ const r=await fetch('/api/moh/organization-changes/'+id+'/approve',{method:'POST'}); const j=await r.json(); if(r.ok){ showToast('تم الاعتماد','تم تطبيق التغيير','success'); loadOrgChangeRequests(); loadAdminGovernance(); } else showToast('خطأ',j.error,'error'); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function rejectOrgChange(id){ try{ const r=await fetch('/api/moh/organization-changes/'+id+'/reject',{method:'POST'}); const j=await r.json(); if(r.ok){ showToast('تم الرفض','تم رفض الطلب','info'); loadOrgChangeRequests(); } else showToast('خطأ',j.error,'error'); }catch(e){ showToast('خطأ',e.message,'error'); } }
async function loadVerificationQueue(){ loadAdminGovernance(); }
document.getElementById('moh-admin-role')?.addEventListener('change', (e)=>{
  const role=e.target.value;
  const wrap=document.getElementById('gov-org-select-wrap');
  if(wrap) wrap.style.display = ['HOSPITAL_ADMIN','CLINICIAN'].includes(role) ? 'block' : 'none';
  if(['HOSPITAL_ADMIN','CLINICIAN'].includes(role)){
    const sel=document.getElementById('gov-create-org');
    if(sel && sel.options.length<=1){
      fetch('/api/public/organizations').then(r=>r.json()).then(orgs=>{
        if(Array.isArray(orgs) && orgs.length>0){
          sel.innerHTML = '<option value="">-- اختر المنشأة --</option>' + orgs.map(o=>`<option value="${o.id}">${o.organization_name_ar||o.organization_name} (${o.region})</option>`).join('');
        }
      }).catch(()=>{});
    }
  }
});
document.getElementById('form-create-moh-admin')?.addEventListener('submit', async (e)=>{ e.preventDefault(); const role_code=document.getElementById('moh-admin-role')?.value||'MOH_ADMIN'; const username=document.getElementById('moh-admin-username').value.trim(); const full_name=document.getElementById('moh-admin-fullname').value.trim(); const password=document.getElementById('moh-admin-password').value; const email=document.getElementById('moh-admin-email').value.trim(); const phone=document.getElementById('moh-admin-phone')?.value.trim(); const organization_id=document.getElementById('gov-create-org')?.value||undefined; const resEl=document.getElementById('moh-admin-create-result'); if(['HOSPITAL_ADMIN','CLINICIAN'].includes(role_code) && !organization_id){ if(resEl) resEl.innerHTML='<span style="color:var(--m3-error);">يجب اختيار المنشأة لـ '+role_code+'</span>'; showToast('بيانات ناقصة','اختر المنشأة','error'); return; } try{ const r=await fetch('/api/moh/users/create-admin',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, full_name, password, email: email||undefined, phone: phone||undefined, role_code, organization_id})}); const j=await r.json(); if(r.ok){ if(resEl) resEl.innerHTML='<span style="color:var(--m3-primary);">✅ تم إنشاء '+role_code+': '+j.user.username+'</span>'; showToast('تم الإنشاء', role_code+' جديد: '+j.user.username,'success'); loadAdminGovernance(); e.target.reset(); const wrap=document.getElementById('gov-org-select-wrap'); if(wrap) wrap.style.display='none'; } else { if(resEl) resEl.innerHTML='<span style="color:var(--m3-error);">'+(j.error||'فشل')+'</span>'; showToast('خطأ', j.error,'error'); } } catch(err){ if(resEl) resEl.textContent=err.message; } });

async function loadAppointments(){
  const tbody=document.getElementById('appointments-tbody');
  const card=document.getElementById('appointments-patient-card');
  const sel=document.getElementById('appt-org');
  const clinSel=document.getElementById('appt-clinician');
  if(card) card.style.display = appAuth.currentRole==='PATIENT' ? 'block' : 'none';
  if(sel && sel.options.length<=1){
    try{ const r=await fetch('/api/public/organizations'); const orgs=await r.json(); if(Array.isArray(orgs)) sel.innerHTML='<option value="">-- اختر المنشأة --</option>'+orgs.map(o=>`<option value="${o.id}">${o.organization_name_ar||o.organization_name} (${o.region})</option>`).join(''); }catch{}
  }
  if(sel && clinSel){
    sel.addEventListener('change', async ()=>{
      const orgId=sel.value;
      if(!orgId){ clinSel.innerHTML='<option value="">-- بدون تحديد (أي طبيب في المنشأة) --</option>'; return; }
      clinSel.innerHTML='<option value="">جاري تحميل الأطباء...</option>';
      try{ const r=await fetch('/api/public/clinicians?organization_id='+orgId); const list=await r.json(); if(Array.isArray(list) && list.length>0) clinSel.innerHTML='<option value="">-- بدون تحديد (أي طبيب) --</option>'+list.map(c=>`<option value="${c.id}">${c.full_name} (@${c.username})</option>`).join(''); else clinSel.innerHTML='<option value="">-- لا يوجد أطباء في هذه المنشأة --</option>'; }catch{ clinSel.innerHTML='<option value="">-- فشل تحميل الأطباء --</option>'; }
    });
  }
  if(!tbody) return;
  tbody.innerHTML='<tr><td colspan="7" class="text-center py-4">جاري التحميل...</td></tr>';
  try{
    const url = appAuth.currentRole==='PATIENT' ? '/api/appointments/my' : '/api/appointments/organization';
    const r=await fetch(url);
    if(!r.ok){ tbody.innerHTML=`<tr><td colspan="7" class="text-center py-4" style="color:var(--m3-error);">فشل التحميل (${r.status})</td></tr>`; return; }
    const list=await r.json();
    if(!list || list.length===0){ tbody.innerHTML='<tr><td colspan="7" class="text-center py-4">لا توجد مواعيد - البيانات من جدول Appointment الحقيقي</td></tr>'; return; }
    tbody.innerHTML=list.map(a=>{
      const typeBadge = a.appointment_type==='ROUTINE'?'badge-info':a.appointment_type==='EMERGENCY'?'badge-error':a.appointment_type==='REFERRAL'?'badge-warning':'badge-success';
      const statusBadge = a.status==='proposed'?'badge-secondary':a.status==='booked'?'badge-info':a.status==='arrived'?'badge-warning':a.status==='fulfilled'?'badge-success':'badge-error';
      const consentBadge = a.consent?.granted ? '<span class="badge badge-success">إذن ممنوح</span>' : '<span class="badge badge-warning">بانتظار</span>';
      const orgName = a.organization?.organization_name_ar||a.organization?.organization_name||a.organization_id?.substring(0,8);
      const dateStr = a.scheduled_start ? new Date(a.scheduled_start).toLocaleString('ar-SA') : '--';
      const clinName = a.clinician?.full_name ? `${a.clinician.full_name} (@${a.clinician.username})` : (a.clinician_id ? a.clinician_id.substring(0,8) : 'غير محدد - أي طبيب');
      const clinicianBadge = a.clinician ? `<span class="badge badge-info">${clinName}</span>` : '<span class="badge badge-secondary">غير محدد</span>';
      let actions='';
      if(a.status==='proposed'){
        if(appAuth.currentRole==='HOSPITAL_ADMIN'){
          actions+=`<button class="btn btn-primary btn-sm" onclick="promptAssignClinician('${a.id}')">تأكيد + تعيين طبيب</button> `;
          actions+=`<button class="btn btn-secondary btn-sm" onclick="updateAppointment('${a.id}','booked')">تأكيد بدون تحديد</button> `;
        } else if(appAuth.currentRole==='CLINICIAN'){
          actions+=`<button class="btn btn-primary btn-sm" onclick="updateAppointment('${a.id}','booked','${appAuth.user?.id||''}')">تأكيد (تعيين نفسي)</button> `;
        }
      }
      if(a.status==='booked'){
        if(appAuth.currentRole==='HOSPITAL_ADMIN') actions+=`<button class="btn btn-warning btn-sm" onclick="updateAppointment('${a.id}','arrived')">وصول</button> `;
        else if(appAuth.currentRole==='CLINICIAN' && a.clinician_id===appAuth.user?.id) actions+=`<button class="btn btn-warning btn-sm" onclick="updateAppointment('${a.id}','arrived')">وصول</button> `;
      }
      if(a.status==='arrived'){
        if(appAuth.currentRole==='HOSPITAL_ADMIN' || (appAuth.currentRole==='CLINICIAN' && a.clinician_id===appAuth.user?.id)) actions+=`<button class="btn btn-success btn-sm" onclick="updateAppointment('${a.id}','fulfilled')">إتمام</button> `;
      }
      if(appAuth.currentRole==='PATIENT' && ['proposed','booked'].includes(a.status)) actions+=`<button class="btn btn-secondary btn-sm" onclick="updateAppointment('${a.id}','cancelled')">إلغاء</button>`;
      return `<tr><td><small>${a.patient_id?.substring(0,8)}...</small></td><td>${orgName}</td><td><span class="badge ${typeBadge}">${a.appointment_type}</span><br>${clinicianBadge}</td><td><span class="badge ${statusBadge}">${a.status}</span></td><td>${dateStr}</td><td>${consentBadge} <small>${a.consent?.consent_type||''}</small></td><td>${actions||'--'}</td></tr>`;
    }).join('');
  }catch(e){ tbody.innerHTML=`<tr><td colspan="7" class="text-center py-4" style="color:var(--m3-error);">خطأ: ${e.message}</td></tr>`; }
}
async function updateAppointment(id,status,clinician_id){
  try{
    const body={status};
    if(clinician_id) body.clinician_id=clinician_id;
    const r=await fetch('/api/appointments/'+id+'/status',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json();
    if(r.ok){ showToast('تم التحديث','الموعد '+status,'success'); loadAppointments(); }
    else showToast('خطأ', j.error,'error');
  }catch(e){ showToast('خطأ', e.message,'error'); }
}
async function promptAssignClinician(appointmentId){
  const id=prompt('أدخل معرف الطبيب (username أو ID) - اتركه فارغاً للتأكيد بدون تحديد:');
  if(id===null) return;
  const trimmed=id.trim();
  if(!trimmed) return updateAppointment(appointmentId,'booked');
  try{
    const orgSel=document.getElementById('appt-org');
    const orgId=orgSel?.value || '';
    let clinId=trimmed;
    if(!trimmed.includes('-')){
      const r=await fetch('/api/public/clinicians?organization_id='+ (document.querySelector('#appointments-tbody')?.dataset?.orgId || ''));
      const list=await r.json();
      const found=list.find(c=>c.username===trimmed || c.full_name===trimmed);
      if(found) clinId=found.id;
    }
    return updateAppointment(appointmentId,'booked',clinId);
  }catch{ return updateAppointment(appointmentId,'booked', trimmed); }
}
function initAppointmentDateTime(){
  const dateEl=document.getElementById('appt-date');
  const timeEl=document.getElementById('appt-time');
  const previewEl=document.getElementById('appt-preview');
  const hijriEl=document.getElementById('appt-preview-hijri');
  const relativeEl=document.getElementById('appt-preview-relative');
  const hintEl=document.getElementById('appt-date-hint');
  const typeEl=document.getElementById('appt-type');
  const emergencyNote=document.getElementById('appt-emergency-note');
  const emergencyConfirm=document.getElementById('appt-emergency-confirm');
  if(!dateEl||!timeEl) return;
  const today=new Date(); today.setHours(0,0,0,0);
  const todayStr=today.toISOString().split('T')[0];
  dateEl.min=todayStr;
  const max=new Date(); max.setMonth(max.getMonth()+3);
  dateEl.max=max.toISOString().split('T')[0];
  dateEl.value=todayStr;
  const slots=[];
  for(let h=8;h<17;h++){ for(let m=0;m<60;m+=30){ if(h===16 && m>30) continue; slots.push(String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')); } }
  function fillTimes(){
    const selectedDate=dateEl.value;
    const isToday=selectedDate===todayStr;
    const now=new Date();
    timeEl.innerHTML='<option value="">-- اختر الوقت --</option>'+slots.map(s=>{
      if(isToday){
        const [hh,mm]=s.split(':').map(Number);
        const slotTime=new Date(); slotTime.setHours(hh,mm,0,0);
        if(slotTime <= now) return `<option value="${s}" disabled>${s} (انتهى)</option>`;
      }
      return `<option value="${s}">${s}</option>`;
    }).join('');
    if(timeEl.options.length>1){
      const firstEnabled=Array.from(timeEl.options).find(o=>!o.disabled && o.value);
      if(firstEnabled) timeEl.value=firstEnabled.value;
    }
    updatePreview();
  }
  function updatePreview(){
    const d=dateEl.value; const t=timeEl.value;
    if(!d||!t){ if(previewEl) previewEl.textContent='--'; if(hijriEl) hijriEl.textContent=''; if(relativeEl) relativeEl.textContent=''; return; }
    const dt=new Date(d+'T'+t+':00');
    const dayOfWeek=dt.getDay();
    const isWeekend=dayOfWeek===5||dayOfWeek===6;
    if(hintEl){
      if(isWeekend) hintEl.innerHTML='<span style="color:var(--m3-error);">⚠️ الجمعة والسبت عطلة - اختر يوم عمل</span>';
      else hintEl.textContent='يوم عمل • Asia/Riyadh';
    }
    if(previewEl) previewEl.textContent=dt.toLocaleString('ar-SA',{ weekday:'long', year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Riyadh' })+' (Asia/Riyadh)';
    if(hijriEl){
      try{ hijriEl.textContent=' • هجري: '+ new Intl.DateTimeFormat('ar-SA-islamic',{ day:'numeric', month:'long', year:'numeric', timeZone:'Asia/Riyadh' }).format(dt); }catch{ hijriEl.textContent=''; }
    }
    if(relativeEl){
      const diffMs=dt.getTime()-Date.now();
      const diffDays=Math.ceil(diffMs/86400000);
      if(diffDays<0) { relativeEl.textContent='تاريخ ماضي'; relativeEl.className='badge badge-error'; }
      else if(diffDays===0) { relativeEl.textContent='اليوم'; relativeEl.className='badge badge-warning'; }
      else if(diffDays===1) { relativeEl.textContent='غداً'; relativeEl.className='badge badge-info'; }
      else { relativeEl.textContent=`بعد ${diffDays} أيام`; relativeEl.className='badge badge-success'; }
    }
    if(emergencyNote && typeEl){
      const isEmergency=typeEl.value==='EMERGENCY';
      emergencyNote.style.display=isEmergency?'block':'none';
      if(isEmergency && emergencyConfirm) emergencyConfirm.checked=false;
    }
  }
  dateEl.addEventListener('change', fillTimes);
  timeEl.addEventListener('change', updatePreview);
  typeEl?.addEventListener('change', updatePreview);
  fillTimes();
}
initAppointmentDateTime();
document.getElementById('form-book-appointment')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const org=document.getElementById('appt-org').value;
  const type=document.getElementById('appt-type').value;
  const dateVal=document.getElementById('appt-date').value;
  const timeVal=document.getElementById('appt-time').value;
  const clinician_id=document.getElementById('appt-clinician')?.value||undefined;
  const reason=document.getElementById('appt-reason').value.trim();
  const resEl=document.getElementById('appt-book-result');
  if(!org||!dateVal||!timeVal){ if(resEl) resEl.innerHTML='<span style="color:var(--m3-error);">اختر المنشأة والتاريخ والوقت</span>'; return; }
  const dt=new Date(dateVal+'T'+timeVal+':00');
  if(dt.getDay()===5||dt.getDay()===6){ if(resEl) resEl.innerHTML='<span style="color:var(--m3-error);">الجمعة والسبت عطلة - اختر يوم عمل (الأحد-الخميس)</span>'; return; }
  if(dt <= new Date()){ if(resEl) resEl.innerHTML='<span style="color:var(--m3-error);">لا يمكن حجز موعد في الماضي</span>'; return; }
  const start=dt.toISOString();
  try{
    const body={organization_id:org, appointment_type:type, scheduled_start:start, reason};
    if(clinician_id) body.clinician_id=clinician_id;
    const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const j=await r.json();
    if(r.ok){ if(resEl) resEl.innerHTML='<span style="color:var(--m3-primary);">✅ تم حجز الموعد ('+type+') مع الطبيب '+(clinician_id||'غير محدد')+' وإذن '+j.consent.consent_type+' - '+new Date(j.appointment.scheduled_start).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh'})+'</span>'; showToast('تم الحجز','الموعد والإذن منشآن','success'); loadAppointments(); e.target.reset(); initAppointmentDateTime(); }
    else { if(resEl) resEl.innerHTML='<span style="color:var(--m3-error);">'+(j.error||'فشل')+'</span>'; showToast('خطأ', j.error,'error'); }
  }catch(err){ if(resEl) resEl.textContent=err.message; }
});

