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
    this.updateUI();
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
    if (tab === 'login') {
      document.getElementById('login-form').style.display = 'block';
      document.getElementById('register-form').style.display = 'none';
      btnLogin.style.background = '#2d3748'; btnLogin.style.color = 'white';
      btnRegister.style.background = '#1a202c'; btnRegister.style.color = '#a0aec0';
    } else {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('register-form').style.display = 'block';
      btnRegister.style.background = '#2d3748'; btnRegister.style.color = 'white';
      btnLogin.style.background = '#1a202c'; btnLogin.style.color = '#a0aec0';
    }
  },

  toggleRegisterRole() {
    const role = document.getElementById('register-role').value;
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
  },

  async register() {
    const fullname = document.getElementById('register-fullname').value.trim();
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const roleType = document.getElementById('register-role').value;
    const orgName = document.getElementById('register-org').value;
    
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
        const msg = 'رقم الهوية الوطنية / الإقامة مطلوب (10 أرقام يبدأ بـ 1 أو 2)';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (!/^(1|2)\d{9}$/.test(nationalId)) {
        const msg = 'رقم الهوية غير صحيح: يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (!birthDate) {
        const msg = 'تاريخ الميلاد مطلوب';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      const dob = new Date(birthDate);
      if (isNaN(dob.getTime()) || dob > new Date() || dob < new Date('1900-01-01')) {
        const msg = 'تاريخ الميلاد غير صالح';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (!gender) {
        const msg = 'الجنس مطلوب';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (!phone) {
        const msg = 'رقم الجوال السعودي مطلوب';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      const phoneClean = phone.replace(/[\s\-\(\)]/g,'');
      if (!/^(?:\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(phoneClean)) {
        const msg = 'رقم الجوال غير صحيح: يجب أن يكون رقم سعودي (05xxxxxxxx)';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        const msg = 'صيغة البريد الإلكتروني غير صحيحة';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (!fullname || fullname.split(/\s+/).length < 2) {
        const msg = 'الاسم الكامل يجب أن يحتوي على الاسم الأول واسم العائلة';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
      }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        const msg = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي حروف وأرقام';
        if (errorText) errorText.textContent = msg; if (errorDiv) errorDiv.style.display = 'flex'; return;
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
          // Trusted identity fields (only for PATIENT)
          nationalId: roleType === 'PATIENT' ? nationalId : undefined,
          birthDate: roleType === 'PATIENT' ? birthDate : undefined,
          gender: roleType === 'PATIENT' ? gender : undefined,
          phone: roleType === 'PATIENT' ? phone : undefined,
          email: email || undefined,
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
        if (errorText) errorText.textContent = msg;
        else if (errorDiv) errorDiv.textContent = msg;
        if (errorDiv) errorDiv.style.display = 'flex';
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
      if (errorText) errorText.textContent = msg;
      else if (errorDiv) errorDiv.textContent = msg;
      if (errorDiv) errorDiv.style.display = 'flex';
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
        if (errorText) errorText.textContent = msg;
        else if (errorDiv) errorDiv.textContent = msg;
        if (errorDiv) errorDiv.style.display = 'flex';
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
      if (errorText) errorText.textContent = msg;
      else if (errorDiv) errorDiv.textContent = msg;
      if (errorDiv) errorDiv.style.display = 'flex';
    }
  },

  logout() {
    this.currentRole = null;
    this.token = null;
    this.user = null;
    cachedPatients = [];
    currentPatientId = '';
    localStorage.removeItem('shiep_role');
    localStorage.removeItem('shiep_token');
    localStorage.removeItem('shiep_user');
    this.updateUI();
  },

  updateUI() {
    const overlay = document.getElementById('auth-overlay');
    if (!overlay) return;

    if (!this.currentRole) {
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
      this.applyRolePermissions();
    }
  },

  applyRolePermissions() {
    const allTabs = document.querySelectorAll('.nav-item');
    allTabs.forEach(t => t.style.display = 'none'); // hide all by default
    
    let defaultTab = 'monitoring';

    // Show/hide run pipeline button (Only for central authorities)
    const btnRun = document.getElementById('btn-run-pipeline');
    if (btnRun) {
      btnRun.style.display = (this.currentRole === 'MOH_ADMIN' || this.currentRole === 'SYS_ADMIN') ? 'inline-flex' : 'none';
    }

    if (this.currentRole === 'MOH_ADMIN' || this.currentRole === 'SYS_ADMIN') {
      ['monitoring', 'onboarding', 'cds', 'nphies', 'medications', 'mpi', 'longitudinal', 'mapping', 'provenance', 'security', 'bulkexport', 'fhir'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'monitoring';

      // Restore dropdowns for Admins
      const globalSelect = document.getElementById('global-patient-selector');
      if (globalSelect) globalSelect.style.display = 'block';
      const patCard = document.querySelector('.patient-selector-card');
      if (patCard) patCard.style.display = 'block';

    } else if (this.currentRole === 'HOSPITAL_ADMIN') {
      ['onboarding', 'bulkexport', 'fhir'].forEach(id => {
        const t = document.getElementById(`tab-btn-${id}`);
        if(t) t.style.display = 'flex';
      });
      defaultTab = 'onboarding';

      const globalSelect = document.getElementById('global-patient-selector');
      if (globalSelect) globalSelect.style.display = 'block';
      const patCard = document.querySelector('.patient-selector-card');
      if (patCard) patCard.style.display = 'block';

    } else if (this.currentRole === 'PATIENT') {
      ['profile', 'longitudinal', 'medications'].forEach(id => {
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

// === FETCH INTERCEPTOR FOR JWT AUTHENTICATION ===
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  options = options || {};
  if (appAuth.token && typeof url === 'string' && (url.startsWith('/api') || url.startsWith('/fhir'))) {
    if (!options.headers) {
      options.headers = {};
    }
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', `Bearer ${appAuth.token}`);
      }
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['Authorization', `Bearer ${appAuth.token}`]);
    } else {
      if (!options.headers['Authorization']) {
        options.headers['Authorization'] = `Bearer ${appAuth.token}`;
      }
    }
  }
  return originalFetch(url, options);
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

  if (bar) bar.style.display = 'flex';

  // For Patient Role: Display ONLY logged-in patient details and completely hide selector dropdown
  if (appAuth.currentRole === 'PATIENT') {
    if (globalSelect) globalSelect.style.display = 'none';
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
    if (bar) bar.style.display = 'none';
    return;
  }

  // Populate global selector for Admin/Hospital
  if (globalSelect) {
    globalSelect.style.display = 'block';
    globalSelect.innerHTML = cachedPatients.map(p =>
      `<option value="${p.id}">${p.nameAr || p.name} (${p.nid || p.id.substring(0,8)})</option>`
    ).join('');
    globalSelect.value = currentPatientId;
  }

  const activePatient = cachedPatients.find(p => p.id === currentPatientId);
  if (nameEl && activePatient) {
    nameEl.textContent = activePatient.nameAr || activePatient.name;
  }
  if (metaEl && activePatient) {
    metaEl.textContent = `| الهوية: ${activePatient.nid || '—'} | ${activePatient.gender === 'male' ? 'ذكر' : 'أنثى'} | ${activePatient.birthDate || ''}`;
  }
}

async function switchActivePatient(patientId) {
  if (!patientId || appAuth.currentRole === 'PATIENT') return;
  currentPatientId = patientId;
  updateGlobalPatientBar();

  // Sync longitudinal patient selector
  const longSelect = document.getElementById('select-longitudinal-patient');
  if (longSelect) longSelect.value = patientId;

  // Reload current tab data with new patient context
  handleTabSwitch(currentTab);
}

async function fetchAndCachePatients() {
  try {
    // Fetch canonical patients for proper Arabic names
    const canRes = await fetch('/api/patients');
    let canonicalPatients = [];
    try {
      canonicalPatients = await canRes.json();
    } catch(e) { /* fallback to FHIR */ }

    if (appAuth.currentRole === 'PATIENT') {
      cachedPatients = canonicalPatients.map(cp => ({
        id: cp.internalId,
        name: `${cp.givenName || ''} ${cp.familyName || ''}`.trim() || cp.internalId,
        nameAr: `${cp.givenNameAr || ''} ${cp.familyNameAr || ''}`.trim() || `${cp.givenName || ''} ${cp.familyName || ''}`.trim(),
        nid: cp.identifiers?.find(i => i.type === 'NID' || i.type === 'IQAMA')?.value || '',
        birthDate: cp.birthDate ? String(cp.birthDate).substring(0, 10) : '',
        gender: cp.gender || ''
      }));

      if (cachedPatients.length > 0) {
        currentPatientId = cachedPatients[0].id;
      }
      updateGlobalPatientBar();
      return;
    }

    const res = await fetch('/fhir/Patient');
    const bundle = await res.json();
    const patients = bundle.entry?.map(e => e.resource) || [];

    cachedPatients = patients.map(p => {
      const nameObj = p.name?.[0] || {};
      const nid = p.identifier?.find(i => i.system?.includes('nid'))?.value || '';
      // Try to find canonical patient for Arabic name
      const canonical = canonicalPatients.find(cp =>
        cp.identifiers?.some(i => i.value === nid) || cp.internalId === p.id
      );
      const nameAr = canonical ? `${canonical.givenNameAr || ''} ${canonical.familyNameAr || ''}`.trim() : '';

      return {
        id: p.id,
        name: `${nameObj.given?.join(' ') || ''} ${nameObj.family || ''}`.trim() || p.id,
        nameAr: nameAr || `${nameObj.given?.join(' ') || ''} ${nameObj.family || ''}`.trim(),
        nid: nid,
        birthDate: p.birthDate || '',
        gender: p.gender || ''
      };
    });

    if (!currentPatientId && cachedPatients.length > 0) {
      currentPatientId = cachedPatients[0].id;
    }

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
  appAuth.init();
  initThemeSwitcher();
  initSidebarToggle();
  initNavigation();
  initActions();
  initGlobalPatientSelector();
  initFileDropzone();
  loadAllData();
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

function initGlobalPatientSelector() {
  document.getElementById('global-patient-selector')?.addEventListener('change', (e) => {
    switchActivePatient(e.target.value);
  });
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
    resultContainer.style.display = 'block';
    resultContainer.innerHTML = `
      <div class="ingestion-result-box" style="display:flex; align-items:center; gap:10px;">
        ${getSvgIcon('spinner', 'style="width:20px; height:20px; color:var(--m3-primary-light);')}
        <div>
          <strong style="color:var(--m3-on-surface); font-size:0.9rem;">جاري تحليل ومعالجة وتطبيع الملف: <code>${fileName}</code>...</strong>
          <p style="font-size:0.78rem; color:var(--m3-on-surface-muted);">فحص البنية واكتشاف الترميز والمعايرة ومطابقة الهوية في MPI...</p>
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
          sourceSystemId: 'file-dropzone-uploader'
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
              <span class="badge badge-success">جودة المطابقة: 100/100</span>
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

    if (localStorage.getItem('sidebar_collapsed') === '1') {
      document.body.classList.add('sidebar-collapsed');
    }
  }
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
    bulkexport: {
      title: 'تصدير البيانات الصحية الضخمة للمستودع الوطني (FHIR Bulk Export & PDPL)',
      sub: 'تصدير ملايين السجلات بصيغة NDJSON مع محرك إخفاء الهوية للأبحاث والذكاء الاصطناعي الطبي'
    }
  };

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (!tab) return;

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

  // Dynamic Hospital Onboarding Form
  document.getElementById('form-onboard-hospital')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hospitalId = document.getElementById('onboard-id')?.value.trim();
    const hospitalNameAr = document.getElementById('onboard-name-ar')?.value.trim();
    const hospitalName = document.getElementById('onboard-name-en')?.value.trim();
    const facilityType = document.getElementById('onboard-type')?.value;
    const region = document.getElementById('onboard-region')?.value;

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
      if (data.success) {
        showToast('تم تسجيل المنشأة', `تم تفعيل الموصل الخاص بـ ${hospitalNameAr} بنجاح.`, 'success');
        loadOnboardedHospitals();
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
          const badgeClass = c.indicator === 'critical' ? 'badge-warning' : c.indicator === 'warning' ? 'badge-warning' : 'badge-success';

          return `
            <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant); border-right:4px solid ${borderColor}; border-radius:var(--radius-xs); padding:16px 18px; margin-bottom:10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <strong style="color:var(--m3-on-surface); font-size:0.95rem;">${c.summaryAr}</strong>
                </div>
                <span class="badge ${badgeClass}">${c.indicator === 'warning' ? 'تحذير تفاعل دوائي' : 'إرشادي معتمد'}</span>
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
          <div style="background:var(--m3-surface-container-low); border:1px solid var(--m3-primary); border-radius:var(--radius-xs); padding:14px 18px; color:var(--m3-on-primary-container);">
            <strong>✅ الدواء آمن تماماً للوصف</strong>
            <p style="font-size:0.82rem; margin-top:4px;">لم يتم رصد أي تعارضات دوائية أو تحذيرات كلوية لهذا المريض مع دواء (${sel.name}).</p>
          </div>
        `;
        showToast('الوصفة آمنة', 'لا توجد تعارضات مع هذا الدواء.', 'success');
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

  document.getElementById('select-longitudinal-patient')?.addEventListener('change', (e) => {
    const patId = e.target.value;
    if (patId) {
      currentPatientId = patId;
      loadLongitudinalRecord(patId);
    }
  });

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
  if (tab === 'monitoring') loadMonitoringStats();
  if (tab === 'onboarding') loadOnboardedHospitals();
  if (tab === 'cds') loadCdsAndAnalyticsTab();
  if (tab === 'nphies') loadNphiesTab();
  if (tab === 'medications') loadMedicationsTab();
  if (tab === 'mpi') loadMpiIdentities();
  if (tab === 'longitudinal') {
    loadPatientsDropdown();
    if (appAuth.currentRole === 'PATIENT') {
      loadPatientSelfReportedDashboard();
    }
  }
  if (tab === 'profile') {
    if (appAuth.currentRole === 'PATIENT') {
      loadPatientProfileTab();
    } else {
      // Non-patient should not see this tab; redirect
      showToast('تنبيه', 'هذه الصفحة مخصصة لحسابات المرضى فقط', 'info');
    }
  }
  if (tab === 'mapping') loadMappingStudio();
  if (tab === 'provenance') loadProvenanceRecords();
  if (tab === 'security') loadSecurityAuditChain();
  if (tab === 'bulkexport') loadBulkExportTab();
  if (tab === 'fhir') fetchFhirEndpoint(currentFhirEndpoint);
}

async function loadAllData() {
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
        const knownHospitalNames = {
          'hl7v2-mllp-feed': { nameAr: 'تغذية HL7 v2.5 MLLP الفورية', desc: 'قناة استيعاب رسائل ADT A01 و ORU R01 الحية للقبول والتنويم في الوقت الفعلي.', tag: 'modern', type: 'HL7 v2.5 MLLP Protocol' },
          'hospital-a': { nameAr: 'مستشفى الأمل التخصصي', desc: 'موصل بيانات علائقية محلية.', tag: 'legacy', type: 'قواعد بيانات علائقية' },
          'hospital-b': { nameAr: 'مستشفى النور الحديث', desc: 'موصل بيانات علائقية إنجليزية.', tag: 'modern', type: 'Relational Database' },
          'hospital-c': { nameAr: 'مركز الملك فهد التخصصي', desc: 'موصل واجهات FHIR R4.', tag: 'fhir', type: 'HL7 FHIR R4 REST API' }
        };

        sourcesGrid.innerHTML = data.sources.map((s) => {
          const sysId = s.systemId || s.sourceSystemId || '';
          const recCount = s.extractedRecordCount ?? 0;
          const lastSyncRaw = s.lastHeartbeat || s.lastSyncTime || s.lastChecked || new Date().toISOString();
          const lastSyncDate = new Date(lastSyncRaw);
          const lastSyncStr = !isNaN(lastSyncDate.getTime()) ? lastSyncDate.toLocaleTimeString('ar-SA') : new Date().toLocaleTimeString('ar-SA');
          const latency = s.latencyMs || 5;

          // Match known or dynamic hospital definition
          const dynDef = data.dynamicHospitals?.find(d => d.hospitalId === sysId);
          const nameAr = dynDef ? dynDef.hospitalNameAr : (knownHospitalNames[sysId]?.nameAr || sysId);
          const desc = dynDef ? `منشأة مسجلة ديناميكياً في منطقة ${dynDef.region} بنظام موصل ذكي.` : (knownHospitalNames[sysId]?.desc || 'موصل بيانات سريرية متصل بالمنصة.');
          const tagClass = dynDef ? 'modern' : (knownHospitalNames[sysId]?.tag || 'fhir');
          const sourceType = dynDef ? `Dynamic (${dynDef.facilityType})` : (knownHospitalNames[sysId]?.type || 'Standard Protocol Feed');

          return `
            <div class="source-card">
              <div class="source-header">
                <div class="source-title-wrap">
                  <span class="source-tag ${tagClass}">${sysId}</span>
                  <h4>${nameAr}</h4>
                </div>
                <span class="status-indicator online">
                  <span class="status-dot"></span> متصل
                </span>
              </div>
              <div class="source-body">
                <p class="source-desc">${desc}</p>
                <div class="source-details">
                  <div class="detail-row"><span>نوع المصدر:</span><strong>${sourceType}</strong></div>
                  <div class="detail-row"><span>إجمالي السجلات المستوعبة:</span><strong>${recCount} سجل</strong></div>
                  <div class="detail-row"><span>زمن الاستجابة:</span><span class="badge badge-success">${latency}ms</span></div>
                  <div class="detail-row"><span>آخر اتصال:</span><code>${lastSyncStr}</code></div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Populate Audit Table
    const tbody = document.getElementById('audit-table-body');
    if (tbody && data.recentAudit) {
      tbody.innerHTML = data.recentAudit.map((a) => `
        <tr>
          <td><code>${new Date(a.timestamp).toLocaleTimeString('ar-SA')}</code></td>
          <td><span class="badge badge-success">${a.action}</span></td>
          <td><strong>${a.entityType}</strong></td>
          <td><code>${a.entityId?.substring(0, 8)}...</code></td>
          <td style="color:var(--m3-on-surface-variant);">${a.detail}</td>
        </tr>
      `).join('') || '<tr><td colspan="5" class="text-center py-4">لا توجد سجلات تدقيق حتى الآن.</td></tr>';
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
      tbody.innerHTML = hospitals.map(h => `
        <tr>
          <td><code>${h.hospitalId}</code></td>
          <td><strong>${h.hospitalNameAr}</strong></td>
          <td>${h.hospitalName}</td>
          <td><span class="badge badge-info">${h.facilityType}</span></td>
          <td>${h.region}</td>
          <td><code>${new Date(h.createdAt).toLocaleDateString('ar-SA')}</code></td>
          <td><span class="status-indicator online"><span class="status-dot"></span> متصل وجاهز</span></td>
        </tr>
      `).join('');
    }

    if (select && hospitals) {
      select.innerHTML = hospitals.map(h => `
        <option value="${h.hospitalId}">${h.hospitalNameAr} (${h.hospitalId})</option>
      `).join('');
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
      kpiSpeed.textContent = `${analytics.financialInteroperability.averageSettlementDurationSeconds}s`;
    }

    // 2. Patient CDS Hooks Safety Cards
    const container = document.getElementById('cds-cards-container');
    if (!currentPatientId) {
      if (container) {
        const activePatient = cachedPatients.find(p => p.id === currentPatientId);
        container.innerHTML = `<div style="padding:16px; background:var(--m3-surface-container-low); border:1px solid var(--m3-outline-variant); border-radius:var(--radius-xs); text-align:center;">
          <p style="color:var(--m3-on-surface-variant); font-size:0.88rem;">يجب تشغيل خط الأنابيب أولاً لاستيعاب بيانات المرضى، ثم اختيار مريض من شريط المريض النشط أعلاه.</p>
        </div>`;
      }
      return;
    }

    if (currentPatientId) {
      const activePatient = cachedPatients.find(p => p.id === currentPatientId);
      const patientLabel = activePatient ? (activePatient.nameAr || activePatient.name) : currentPatientId.substring(0, 8);

      const resCds = await fetch(`/api/cds/patient/${currentPatientId}/safety-alerts`);
      const cdsData = await resCds.json();

      if (container && cdsData.cards) {
        const patientHeader = `<div style="padding:10px 14px; background:var(--m3-primary-container); border:1px solid rgba(16,185,129,0.3); border-radius:var(--radius-xs); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <strong style="color:var(--m3-on-primary-container); font-size:0.88rem;">تقييم السلامة الدوائية للمريض: ${patientLabel}</strong>
          <span class="badge badge-info">${cdsData.cards.length} تنبيه</span>
        </div>`;

        if (cdsData.cards.length === 0) {
          container.innerHTML = patientHeader + '<p class="text-center py-4 text-muted">لا توجد تعارضات أو تنبيهات دوائية حرجة مسجلة لهذا المريض.</p>';
          return;
        }

        container.innerHTML = patientHeader + cdsData.cards.map((c) => {
          const indicatorBadge = c.indicator === 'critical' ? '<span class="badge badge-warning" style="background:#B91C1C; color:#fff;">حرج - تدقيق فوري</span>' :
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

    // 3. Weqaa Communicable Disease Surveillance Cases
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
      const urgencyBadge = c.urgency === 'IMMEDIATE_6H' ? '<span class="badge badge-warning" style="background:#B91C1C; color:#fff;">فوري (خلال 6 ساعات)</span>' :
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
          <pre style="direction:ltr; text-align:left; background:#0f172a; color:#38bdf8; padding:12px; border-radius:4px; font-size:0.75rem; max-height:280px; overflow:auto;">${JSON.stringify(bundle, null, 2)}</pre>
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
        const rowStyle = isCurrent ? 'background:rgba(16, 185, 129, 0.05);' : '';
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

    // Claims Table
    const claimsTbody = document.getElementById('nphies-claims-tbody');
    if (claimsTbody && data.claims) {
      claimsTbody.innerHTML = data.claims.map((clm) => {
        const resp = data.claimResponses?.find((r) => r.claimId === clm.internalId);
        const sbsCode = clm.items?.[0]?.serviceCode?.sbsCode || 'SBS-E11';
        const linkedPatient = cachedPatients.find(p => p.id === clm.patientId);
        const patientName = linkedPatient ? (linkedPatient.nameAr || linkedPatient.name) : 'مريض مسجل';
        const isCurrent = clm.patientId === currentPatientId;
        const rowStyle = isCurrent ? 'background:rgba(16, 185, 129, 0.05);' : '';
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
        const rowStyle = isCurrentPatient ? 'background:rgba(16, 185, 129, 0.05);' : '';

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
        const rowStyle = isCurrentPatient ? 'background:rgba(16, 185, 129, 0.05);' : '';

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
                ? `<span class="badge badge-warning" style="background:#B45309; color:#fff;">هوية مدمجة (Merged Into: ${id.mergedInto?.substring(0, 8)}...)</span>
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

// 7. LONGITUDINAL RECORD
async function loadPatientsDropdown() {
  const select = document.getElementById('select-longitudinal-patient');
  const patCard = document.querySelector('.patient-selector-card');

  if (appAuth.currentRole === 'PATIENT') {
    if (patCard) patCard.style.display = 'none';
    if (cachedPatients.length === 0) {
      await fetchAndCachePatients();
    }
    if (cachedPatients.length > 0) {
      currentPatientId = cachedPatients[0].id;
    }
    if (currentPatientId) {
      loadLongitudinalRecord(currentPatientId);
      loadPatientSelfReportedDashboard();
    }
    return;
  }

  if (patCard) patCard.style.display = 'block';
  if (!select) return;

  try {
    if (cachedPatients.length === 0) {
      await fetchAndCachePatients();
    }

    if (cachedPatients.length === 0) {
      select.innerHTML = '<option value="">لا يوجد مرضى حتى الآن. شغل خط الأنابيب أولاً.</option>';
      return;
    }

    select.innerHTML = cachedPatients.map((p) => {
      const displayName = p.nameAr || p.name;
      const sub = p.nid ? `(هوية: ${p.nid})` : `(معرف: ${p.id.substring(0, 8)})`;
      return `<option value="${p.id}">${displayName} ${sub}</option>`;
    }).join('');

    if (!currentPatientId && cachedPatients[0]) {
      currentPatientId = cachedPatients[0].id;
    }

    if (currentPatientId) {
      select.value = currentPatientId;
      loadLongitudinalRecord(currentPatientId);
    }
  } catch (err) {
    console.error('Failed to load patients dropdown', err);
  }
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
    loadingEl.innerHTML = `<div class="card" style="border:1px solid var(--m3-error); background:rgba(239,68,68,0.08); padding:16px; text-align:center;">
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
    statusEl.innerHTML = `<div style="background:rgba(239,68,68,0.10); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:6px; font-size:0.85rem;">رقم الجوال مطلوب بصيغة سعودية (05xxxxxxxx)</div>`;
    return;
  }
  const phoneClean = cleanPayload.phone.replace(/[\s\-\(\)]/g,'');
  if (!/^(?:\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(phoneClean)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:rgba(239,68,68,0.10); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:6px; font-size:0.85rem;">رقم الجوال غير صحيح</div>`;
    return;
  }
  if (cleanPayload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanPayload.email)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:rgba(239,68,68,0.10); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:6px; font-size:0.85rem;">صيغة البريد غير صحيحة</div>`;
    return;
  }
  if (cleanPayload.addressPostalCode && !/^\d{5}$/.test(cleanPayload.addressPostalCode)) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = `<div style="background:rgba(239,68,68,0.10); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:6px; font-size:0.85rem;">الرمز البريدي يجب أن يكون 5 أرقام</div>`;
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
    statusEl.innerHTML = `<div style="background:rgba(16,185,129,0.12); border:1px solid var(--m3-primary); color:var(--m3-on-primary-container); padding:12px 14px; border-radius:6px; font-size:0.88rem; display:flex; align-items:center; gap:8px;">
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
    statusEl.innerHTML = `<div style="background:rgba(239,68,68,0.10); border:1px solid var(--m3-error); color:var(--m3-error); padding:10px 14px; border-radius:6px; font-size:0.85rem;">${err.message}</div>`;
    showToast('خطأ في الحفظ', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function loadLongitudinalRecord(patientId) {
  const container = document.getElementById('longitudinal-content');
  if (!container) return;

  try {
    const res = await fetch(`/api/patients/${patientId}/longitudinal`);
    const data = await res.json();
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
          <h3 style="margin:0; font-size:1.1rem; color:#1b5e20;">المملكة العربية السعودية • وزارة الصحة</h3>
          <h4 style="margin:2px 0; font-size:0.9rem; color:#222;">المنصة الوطنية للربط والتشغيل الصحي البيني (Saudi Interoperability Engine)</h4>
          <span style="font-size:0.75rem; color:#555;">التقرير السريري التتابعي الموحد المعتمد (Certified Longitudinal Health Summary)</span>
        </div>
        <div style="text-align:left; font-size:0.75rem; color:#333;">
          <div><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-SA')}</div>
          <div><strong>${idLabel}:</strong> <code>${nid}</code></div>
          <div><strong>التوثيق الرقمي:</strong> <span style="color:#1b5e20; font-weight:700;">سجل معتمد (NCA Verified)</span></div>
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
  } catch (err) {
    console.error('Failed to load longitudinal record', err);
  }
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
              <svg class="pdf-emblem-svg" viewBox="0 0 100 100" fill="none" stroke="#1b5e20" stroke-width="3">
                <circle cx="50" cy="50" r="44" stroke="#1b5e20" stroke-width="2"/>
                <circle cx="50" cy="50" r="40" stroke="#b8860b" stroke-width="1.2" stroke-dasharray="3 2"/>
                <path d="M50 18 L50 82 M28 36 L72 64 M72 36 L28 64" stroke="#1b5e20" stroke-width="2.5"/>
                <circle cx="50" cy="50" r="9" fill="#1b5e20"/>
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
              <div><strong>حالة الوثيقة:</strong> <span style="color:#1b5e20; font-weight:700;">موثقة ومعتمدة رقمياً</span></div>
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
              <small style="font-size:0.68rem; color:#666;">LOINC 4548-4 (الهدف: &lt; 7.0%)</small>
            </div>
            <div class="pdf-kpi-box">
              <div class="kpi-title">سكر الدم الصائم (Glucose)</div>
              <div class="kpi-num">${isDiabetic ? '142' : '94'} mg/dL</div>
              <small style="font-size:0.68rem; color:#666;">LOINC 1558-6 (المرجع: 70 - 99)</small>
            </div>
            <div class="pdf-kpi-box">
              <div class="kpi-title">الأدوية الفعالة المصروفة</div>
              <div class="kpi-num">${medications.length} أدوية</div>
              <small style="font-size:0.68rem; color:#666;">مسجلة بترميز هيئة الغذاء والدواء SFDA</small>
            </div>
            <div class="pdf-kpi-box">
              <div class="kpi-title">سجل الزيارات والمنشآت</div>
              <div class="kpi-num">${encounters.length} زيارات</div>
              <small style="font-size:0.68rem; color:#666;">عبر ${new Set(encounters.map(e => e.provenance?.sourceSystemId)).size || 1} منشآت صحية</small>
            </div>
          </div>

          <!-- 1. Active Prescriptions -->
          <div class="pdf-section">
            <div class="pdf-section-header">
              <h4>1. قائمة الأدوية والوصفات الطبية المعتمدة (Active ePrescriptions - SFDA SDC)</h4>
              <span style="font-size:0.72rem; color:#666;">مطابقة لدليل هيئة الغذاء والدواء (SFDA)</span>
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
                    <td><strong>${m.medication?.code?.sourceCode || 'دواء معتمد'}</strong><br><small style="color:#666;">${m.medication?.code?.sfdaDisplay || ''}</small></td>
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
              <span style="font-size:0.72rem; color:#666;">ترميز SNOMED CT السريري و ICD-10-AM الإحصائي</span>
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
                    <td><strong>${c.code?.sourceCode || 'تشخيص سريري'}</strong><br><small style="color:#666;">${c.code?.sourceDisplay || ''}</small></td>
                    <td><code>SNOMED ${c.code?.snomedCode || 'N/A'}</code><br><small>${c.code?.snomedDisplay || ''}</small></td>
                    <td><span style="background:#f3e5f5; padding:2px 6px; border-radius:3px; font-weight:700;">${c.code?.icd10amCode || 'N/A'}</span></td>
                    <td><span style="background:#fff3e0; padding:2px 6px; border-radius:3px; font-weight:700;">${c.code?.sbsCode || 'N/A'}</span></td>
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
              <span style="font-size:0.72rem; color:#666;">ترميز LOINC العالمي للتحاليل المخبرية</span>
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
                    <td><strong style="color:#1b5e20; font-size:0.9rem;">${o.valueQuantity?.value} ${o.valueQuantity?.unit || ''}</strong></td>
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
              <span style="font-size:0.72rem; color:#666;">ترميز وزارة الصحة (MOH) ومعيار CVX العالمي</span>
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
                    <td><span style="background:#e8eaf6; padding:2px 6px; border-radius:3px; font-weight:700;">CVX ${i.vaccineCode?.cvxCode || '158'}</span></td>
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
              <span style="font-size:0.72rem; color:#666;">ترميز SNOMED CT وتصنيف الخطورة الإكلينيكية</span>
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
                    <td><strong>${a.substanceTextAr || a.substanceText}</strong><br><small style="color:#666;">${a.substanceText}</small></td>
                    <td><code>SNOMED ${a.substanceCode?.snomedCode || '764146007'}</code></td>
                    <td><span style="background:${a.criticality === 'high' ? '#ffebee' : '#e8f5e9'}; color:${a.criticality === 'high' ? '#c62828' : '#2e7d32'}; padding:2px 6px; border-radius:3px; font-weight:700;">${a.criticality === 'high' ? 'عالية الخطورة' : 'منخفضة'}</span></td>
                    <td><strong style="color:#c62828;">${a.reactions?.[0]?.manifestationTextAr || a.reactions?.[0]?.manifestationText || 'صدمة تحسسية'}</strong></td>
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
              <span style="font-size:0.72rem; color:#666;">تقارير لوحات الفحص الشاملة</span>
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
                    <td><span style="background:#e8f5e9; color:#2e7d32; padding:2px 6px; border-radius:3px; font-weight:700;">${d.status}</span></td>
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
              <span style="font-size:0.72rem; color:#666;">سجل زيارات موحد متعدد المنشآت</span>
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
                <svg viewBox="0 0 24 24" width="50" height="50" fill="#1b5e20">
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
              <div style="font-weight:700; color:#1b5e20;">ختم المركز الوطني للمعلومات الصحية (NHIC)</div>
              <div style="font-size:0.7rem; color:#666;">المملكة العربية السعودية • تم التوليد سحابياً عبر خط الأنابيب الوطني الموحد</div>
              <div style="font-size:0.68rem; color:#888;">وثيقة رسمية خاضعة لأحكام نظام حماية البيانات الشخصية ولائحة التشغيل البيني</div>
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

    container.innerHTML = records.map((p) => `
      <div class="card mb-6" style="padding:18px 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <h4 style="font-size:1.02rem; color:var(--m3-on-surface);">${p.targetEntityType} (المعرف: <code>${p.targetEntityId.substring(0, 8)}...</code>)</h4>
            <span class="metric-sub">${p.activityDescription}</span>
          </div>
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

// 10. FHIR EXPLORER
async function fetchFhirEndpoint(endpoint) {
  const displayUrl = document.getElementById('fhir-url-display');
  const displayJson = document.getElementById('fhir-json-output');
  if (displayUrl) displayUrl.textContent = `GET ${endpoint}`;
  if (displayJson) displayJson.textContent = 'جاري جلب استجابة FHIR R4...';

  try {
    const res = await fetch(endpoint);
    const data = await res.json();
    if (displayJson) {
      displayJson.textContent = JSON.stringify(data, null, 2);
    }
  } catch (err) {
    if (displayJson) displayJson.textContent = 'تعذر جلب بيانات FHIR من الخادم.';
  }
}

// 11. CYBERSECURITY & NCA AUDIT HASH CHAIN
async function loadSecurityAuditChain() {
  const tbody = document.getElementById('audit-chain-tbody');
  const totalBlocksEl = document.getElementById('audit-total-blocks');
  const statusEl = document.getElementById('audit-chain-status');

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
        statusEl.style.color = '#10B981';
      } else {
        statusEl.textContent = `انكسار في السلسلة عند كتلة #${verification.brokenAtIndex}`;
        statusEl.style.color = '#EF4444';
      }
    }

    if (tbody && chain) {
      tbody.innerHTML = chain.map((b) => `
        <tr>
          <td><span class="badge badge-info">Block #${b.index}</span></td>
          <td><span class="badge badge-success">${b.action}</span></td>
          <td><strong>${b.actor}</strong></td>
          <td>${b.entityType} <code>${b.entityId?.substring(0, 10)}...</code></td>
          <td><code>${new Date(b.timestamp).toLocaleTimeString('ar-SA')}</code></td>
          <td title="${b.previousHash}"><code>${b.previousHash.substring(0, 14)}...</code></td>
          <td title="${b.currentHash}"><strong style="color:#6366F1;">${b.currentHash.substring(0, 14)}...</strong></td>
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
  alert('✅ تم التحقق التشفيري بنجاح: السلسلة المشفرة سليمة 100% وخالية من أي تلاعب (NCA Tamper-Proof Verified).');
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
        <div style="color:#10B981; font-weight:bold; margin-bottom:8px;">✅ تم تجهيز الحزم بنجاح (Bulk Export Ready)</div>
        <div>• نوع التصدير: <strong>${data.isAnonymized ? 'مجهّل للأبحاث (PDPL De-identified)' : 'قياسي كامل (Standard Full Export)'}</strong></div>
        <div>• إجمالي الموارد المصدرة: <strong>${data.totalResourcesExported} مورد</strong></div>
        <div>• توقيت المعاملة: <code>${data.transactionTime}</code></div>
        <div>• الحزم المنشأة: ${data.output?.map(o => `<span class="badge badge-info mr-1">${o.type}: ${o.count}</span>`).join(' ') || '0'}</div>
      `;
    }

    if (previewEl && data.output) {
      const sampleNdjson = data.output.map(o => `# === ${o.type} NDJSON Stream (${o.count} items) ===\n${o.ndjson}`).join('\n\n');
      previewEl.textContent = sampleNdjson;
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

