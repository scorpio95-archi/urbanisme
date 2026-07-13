/* ============================================================
   URBANISME — parametres.js
   Page paramètres du compte : infos de base, école, champs
   spécifiques au rôle, mot de passe. Réutilise au maximum les
   classes déjà existantes (form-group, dash-wrap, btn-primary,
   submit-status, section-label).
   ============================================================ */

const SUPABASE_URL = 'https://qptnjgdfobznwmsguvyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdG5qZ2Rmb2J6bndtc2d1dnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA3MjIsImV4cCI6MjA5MzQ5NjcyMn0.QLfIITvc-AdWVLZHHghocNYyYyYvPxZZMAXhdl_4Bdo';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEVELS = ["L1", "L2", "L3", "M1", "M2", "A1", "A2", "A3", "A4"];

const paramsWrap = document.getElementById('paramsWrap');
const logoutBtn = document.getElementById('logoutBtn');

logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
  window.location.href = 'connexion.html';
});

let currentUser = null;
let currentProfile = null;
let currentRoleProfile = null; // ligne dans student_profiles ou teacher_profiles (peut être null si pas encore créée)
let schoolsList = []; // [{id, name}] ou [{id:null, name}] en mode fallback

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }
  currentUser = session.user;

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, full_name, role, school, school_id, bio, location, avatar_url')
    .eq('id', currentUser.id)
    .single();

  if (profileError || !profile){
    paramsWrap.innerHTML = `<div class="empty-state">Impossible de charger ton profil. Reconnecte-toi.</div>`;
    return;
  }
  currentProfile = profile;

  if (profile.role === 'student'){
    const { data } = await sb.from('student_profiles').select('level').eq('profile_id', currentUser.id).maybeSingle();
    currentRoleProfile = data || {};
  } else if (profile.role === 'teacher'){
    const { data } = await sb.from('teacher_profiles').select('academic_title, years_experience').eq('profile_id', currentUser.id).maybeSingle();
    currentRoleProfile = data || {};
  }

  await loadSchools();
  render();
}

async function loadSchools(){
  const { data, error } = await sb.from('schools').select('id, name').eq('is_active', true).order('name');
  // En cas d'échec, on ne propose que "Autre" plutôt que de générer de faux ids
  // qui casseraient la contrainte de clé étrangère school_id -> schools.id.
  schoolsList = (!error && data) ? data : [];
}

function render(){
  const p = currentProfile;
  const rp = currentRoleProfile || {};
  const roleLabel = p.role === 'teacher' ? 'Enseignant' : p.role === 'admin' ? 'Admin' : p.role === 'visitor' ? 'Visiteur' : 'Étudiant';

  const schoolOptions = schoolsList.map(s =>
    `<option value="${s.id}" ${s.id === p.school_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
  // Comme à l'inscription : school_id pointe vers une vraie école, "school" (texte)
  // n'est rempli QUE si l'utilisateur a choisi "Autre". On matche donc sur l'id, pas le texte.
  const isOtherSchool = !p.school_id && !!p.school;
paramsWrap.innerHTML = `
    <div class="dash-header">
      <h1>Paramètres</h1>
      <span class="role-pill role-${p.role}">${roleLabel}</span>
    </div>

    <!-- ---------- INFOS DE BASE ---------- -->
    <div class="section-label" style="margin-top:30px;"><span>Infos de base</span><div class="line"></div></div>
    <form id="basicForm">
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px; margin-top:14px;">
        <div id="avatarCircle" style="width:88px; height:88px; border-radius:50%; overflow:hidden; background:var(--navy); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${p.avatar_url
            ? `<img id="avatarImg" src="${escapeAttr(p.avatar_url)}" style="width:100%; height:100%; object-fit:cover;">`
            : `<span id="avatarInitial" style="color:var(--blan); font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:2rem;">${escapeHtml(getInitial(p.full_name))}</span>`}
        </div>
        <button type="button" id="avatarCameraBtn" aria-label="Changer la photo de profil"
                style="width:32px; height:32px; border-radius:50%; border:1px solid var(--liseret); background:var(--blan); display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--navy)" stroke-width="2" style="width:16px; height:16px;">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <input type="file" id="p-avatar" accept="image/*" style="display:none;">
      </div>

      <div class="form-group">
        <label for="p-name">Nom complet</label>
        <input type="text" id="p-name" value="${escapeAttr(p.full_name || '')}" required>
      </div>

      <div class="form-group">
        <label for="p-bio">Bio</label>
        <textarea id="p-bio">${escapeHtml(p.bio || '')}</textarea>
      </div>

      <div class="form-group">
        <label for="p-location">Localisation</label>
        <input type="text" id="p-location" value="${escapeAttr(p.location || '')}" placeholder="Ex: Les Cayes">
      </div>

      <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;" id="basicBtn">Enregistrer les infos</button>
      <div id="basicStatus"></div>
    </form>

    <!-- ---------- ÉCOLE ---------- -->
    <div class="section-label" style="margin-top:34px;"><span>École</span><div class="line"></div></div>
    <form id="schoolForm">
      <div class="form-group">
        <label for="p-school-select">École</label>
        <select id="p-school-select">
          <option value="">Choisis ton établissement</option>
          ${schoolOptions}
          <option value="autre" ${isOtherSchool ? 'selected' : ''}>Autre (préciser)</option>
        </select>
      </div>
      <div class="form-group school-other ${isOtherSchool ? 'show' : ''}" id="schoolOtherWrap">
        <label for="p-school-other">Nom de l'école</label>
        <input type="text" id="p-school-other" value="${isOtherSchool ? escapeAttr(p.school || '') : ''}">
      </div>

      <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;" id="schoolBtn">Enregistrer l'école</button>
      <div id="schoolStatus"></div>
    </form>

    <!-- ---------- CHAMPS SPÉCIFIQUES AU RÔLE ---------- -->
    ${(p.role === 'teacher' || p.role === 'student') ? `
      <div class="section-label" style="margin-top:34px;"><span>${p.role === 'teacher' ? 'Infos enseignant' : 'Infos étudiant'}</span><div class="line"></div></div>
      <form id="roleForm">
        ${p.role === 'teacher' ? `
          <div class="form-group">
            <label for="p-title">Titre</label>
            <input type="text" id="p-title" value="${escapeAttr(rp.academic_title || '')}" placeholder="Ex: Professeur d'urbanisme">
          </div>
          <div class="form-group">
            <label for="p-experience">Années d'expérience</label>
            <input type="number" id="p-experience" min="0" max="60" value="${rp.years_experience ?? ''}">
          </div>
        ` : `
          <div class="form-group">
            <label for="p-level">Niveau</label>
            <select id="p-level">
              <option value="">—</option>
              ${LEVELS.map(l => `<option value="${l}" ${l === rp.level ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </div>
        `}

        <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;" id="roleBtn">Enregistrer</button>
        <div id="roleStatus"></div>
      </form>
    ` : ''}

    <!-- ---------- MOT DE PASSE ---------- -->
    <div class="section-label" style="margin-top:34px;"><span>Mot de passe</span><div class="line"></div></div>
    <form id="passwordForm">
      <div class="form-group">
        <label for="p-current-password">Mot de passe actuel</label>
        <input type="password" id="p-current-password" required autocomplete="current-password">
      </div>
      <div class="form-group">
        <label for="p-new-password">Nouveau mot de passe</label>
        <input type="password" id="p-new-password" required minlength="6" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label for="p-confirm-password">Confirmer le nouveau mot de passe</label>
        <input type="password" id="p-confirm-password" required minlength="6" autocomplete="new-password">
      </div>

      <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;" id="passwordBtn">Changer le mot de passe</button>
      <div id="passwordStatus"></div>
    </form>
  `;

  wireBasicForm();
  wireSchoolForm();
  if (document.getElementById('roleForm')) wireRoleForm();
  wirePasswordForm();
}

// ---------- INFOS DE BASE ----------
function wireBasicForm(){
  const form = document.getElementById('basicForm');
  const btn = document.getElementById('basicBtn');
  const status = document.getElementById('basicStatus');
  const avatarInput = document.getElementById('p-avatar');
  const avatarCircle = document.getElementById('avatarCircle');
  const cameraBtn = document.getElementById('avatarCameraBtn');

  cameraBtn.addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', () => {
    const file = avatarInput.files[0];
    if (file){
      avatarCircle.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%; height:100%; object-fit:cover;">`;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    status.innerHTML = '';

    try {
      let avatarUrl = currentProfile.avatar_url || null;
      const file = avatarInput.files[0];

      if (file){
        const path = `${currentUser.id}-${Date.now()}-${file.name}`;
        const { error: uploadError } = await sb.storage.from('avatars').upload(path, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }

      const updates = {
        full_name: document.getElementById('p-name').value,
        bio: document.getElementById('p-bio').value || null,
        location: document.getElementById('p-location').value || null,
        avatar_url: avatarUrl
      };

      const { error } = await sb.from('profiles').update(updates).eq('id', currentUser.id);
      if (error) throw error;

      Object.assign(currentProfile, updates);
      status.innerHTML = `<div class="submit-status ok">Infos enregistrées.</div>`;

    } catch (err){
      status.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer les infos';
    }
  });
}

// ---------- ÉCOLE ----------
function wireSchoolForm(){
  const form = document.getElementById('schoolForm');
  const btn = document.getElementById('schoolBtn');
  const status = document.getElementById('schoolStatus');
  const select = document.getElementById('p-school-select');
  const otherWrap = document.getElementById('schoolOtherWrap');
  const otherInput = document.getElementById('p-school-other');

  select.addEventListener('change', () => {
    otherWrap.classList.toggle('show', select.value === 'autre');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    status.innerHTML = '';

    try {
      const schoolChoice = select.value;
      if (!schoolChoice) throw new Error("Choisis ton établissement.");

      const schoolId = schoolChoice !== 'autre' ? schoolChoice : null;
      const schoolOther = schoolChoice === 'autre' ? otherInput.value.trim() : null;
      if (schoolChoice === 'autre' && !schoolOther) throw new Error("Indique le nom de ton école.");

      const updates = { school_id: schoolId, school: schoolOther };

      const { error } = await sb.from('profiles').update(updates).eq('id', currentUser.id);
      if (error) throw error;

      Object.assign(currentProfile, updates);

      // school_id est dupliqué dans student_profiles / teacher_profiles — on le resynchronise
      if (currentProfile.role === 'teacher'){
        await sb.from('teacher_profiles').upsert(
          { profile_id: currentUser.id, school_id: updates.school_id },
          { onConflict: 'profile_id' }
        );
        if (currentRoleProfile) currentRoleProfile.school_id = updates.school_id;
      } else if (currentProfile.role === 'student'){
        await sb.from('student_profiles').upsert(
          { profile_id: currentUser.id, school_id: updates.school_id },
          { onConflict: 'profile_id' }
        );
        if (currentRoleProfile) currentRoleProfile.school_id = updates.school_id;
      }

      status.innerHTML = `<div class="submit-status ok">École enregistrée.</div>`;

    } catch (err){
      status.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Enregistrer l'école";
    }
  });
}

// ---------- CHAMPS SPÉCIFIQUES AU RÔLE ----------
function wireRoleForm(){
  const form = document.getElementById('roleForm');
  const btn = document.getElementById('roleBtn');
  const status = document.getElementById('roleStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    status.innerHTML = '';

    try {
      if (currentProfile.role === 'teacher'){
        const updates = {
          profile_id: currentUser.id,
          school_id: currentProfile.school_id || null,
          academic_title: document.getElementById('p-title').value || null,
          years_experience: document.getElementById('p-experience').value === '' ? null : parseInt(document.getElementById('p-experience').value, 10)
        };
        const { error } = await sb.from('teacher_profiles').upsert(updates, { onConflict: 'profile_id' });
        if (error) throw error;
        Object.assign(currentRoleProfile, updates);

      } else if (currentProfile.role === 'student'){
        const updates = {
          profile_id: currentUser.id,
          school_id: currentProfile.school_id || null,
          level: document.getElementById('p-level').value || null
        };
        const { error } = await sb.from('student_profiles').upsert(updates, { onConflict: 'profile_id' });
        if (error) throw error;
        Object.assign(currentRoleProfile, updates);
      }

      status.innerHTML = `<div class="submit-status ok">Enregistré.</div>`;

    } catch (err){
      status.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Enregistrer';
    }
  });
}

// ---------- MOT DE PASSE ----------
function wirePasswordForm(){
  const form = document.getElementById('passwordForm');
  const btn = document.getElementById('passwordBtn');
  const status = document.getElementById('passwordStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Changement en cours...';
    status.innerHTML = '';

    try {
      const currentPassword = document.getElementById('p-current-password').value;
      const newPassword = document.getElementById('p-new-password').value;
      const confirmPassword = document.getElementById('p-confirm-password').value;

      if (newPassword !== confirmPassword){
        throw new Error("Les deux mots de passe ne correspondent pas.");
      }

      // Vérifie le mot de passe actuel avant de le changer
      const { error: verifyError } = await sb.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword
      });
      if (verifyError) throw new Error("Mot de passe actuel incorrect.");

      const { error: updateError } = await sb.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      form.reset();
      status.innerHTML = `<div class="submit-status ok">Mot de passe changé.</div>`;

    } catch (err){
      status.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Changer le mot de passe';
    }
  });
}

// ---------- UTILITAIRES ----------
function getInitial(name){
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}
function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(str){
  return escapeHtml(str).replace(/"/g, '&quot;');
}

init();
