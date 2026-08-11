/* ============================================================
   URBANISME — parametres.js
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEVELS = ["L1", "L2", "L3", "M1", "M2", "A1", "A2", "A3", "A4"];
const ROLE_LABELS = { etudiant: 'Étudiant', enseignant: 'Enseignant', admin: 'Admin', visiteur: 'Visiteur' };

const paramsWrap = document.getElementById('paramsWrap');
const logoutBtn = document.getElementById('logoutBtn');

logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
  window.location.href = 'connexion.html';
});

let currentUser = null;
let currentProfile = null;
let currentRoleProfile = null;
let schoolsList = [];

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }
  currentUser = session.user;

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('id, full_name, role, school_id, school_other, bio, location, avatar_url')
    .eq('id', currentUser.id)
    .single();

  if (profileError || !profile){
    paramsWrap.innerHTML = `<div class="empty-state">Impossible de charger ton profil. Reconnecte-toi.</div>`;
    return;
  }
  currentProfile = profile;

  if (profile.role === 'etudiant'){
    const { data } = await sb.from('student_profiles').select('level').eq('profile_id', currentUser.id).maybeSingle();
    currentRoleProfile = data || {};
  } else if (profile.role === 'enseignant'){
    const { data } = await sb.from('teacher_profiles').select('academic_title, years_experience').eq('profile_id', currentUser.id).maybeSingle();
    currentRoleProfile = data || {};
  }

  await loadSchools();
  render();
  loadMesCollectifs();
}

async function loadSchools(){
  const { data, error } = await sb.from('schools').select('id, name').eq('is_active', true).order('name');
  schoolsList = (!error && data) ? data : [];
}

function render(){
  const p = currentProfile;
  const rp = currentRoleProfile || {};
  const roleLabel = ROLE_LABELS[p.role] || p.role;

  const schoolOptions = schoolsList.map(s =>
    `<option value="${s.id}" ${s.id === p.school_id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');
  const isOtherSchool = !p.school_id && !!p.school_other;

  paramsWrap.innerHTML = `
    <div class="dash-header">
      <h1>Paramètres</h1>
      <span class="role-pill role-${p.role}">${roleLabel}</span>
    </div>

    <!-- ---------- INFOS DE BASE ---------- -->
    <div class="section-label" style="margin-top:30px;"><span>Infos de base</span><div class="line"></div></div>
    <form id="basicForm">
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px; margin-top:14px;">
        <div id="avatarCircle" style="width:88px; height:88px; border-radius:50%; overflow:hidden; background:var(--fond-3); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${p.avatar_url
            ? `<img id="avatarImg" src="${escapeAttr(p.avatar_url)}" style="width:100%; height:100%; object-fit:cover;">`
            : `<span id="avatarInitial" style="color:var(--blan); font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:2rem;">${escapeHtml(getInitial(p.full_name))}</span>`}
        </div>
        <button type="button" id="avatarCameraBtn" aria-label="Changer la photo de profil"
                style="width:32px; height:32px; border-radius:50%; border:1px solid var(--liseret); background:var(--blan); display:flex; align-items:center; justify-content:center; cursor:pointer; padding:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--fond)" stroke-width="2" style="width:16px; height:16px;">
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
        <input type="text" id="p-school-other" value="${isOtherSchool ? escapeAttr(p.school_other || '') : ''}">
      </div>

      <button type="submit" class="btn-primary" style="width:100%; margin-top:20px;" id="schoolBtn">Enregistrer l'école</button>
      <div id="schoolStatus"></div>
    </form>

    <!-- ---------- CHAMPS SPÉCIFIQUES AU RÔLE ---------- -->
    ${(p.role === 'enseignant' || p.role === 'etudiant') ? `
      <div class="section-label" style="margin-top:34px;"><span>${p.role === 'enseignant' ? 'Infos enseignant' : 'Infos étudiant'}</span><div class="line"></div></div>
      <form id="roleForm">
        ${p.role === 'enseignant' ? `
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

    <!-- ---------- MES COLLECTIFS ---------- -->
    <div class="section-label" style="margin-top:34px;"><span>Mes collectifs</span><div class="line"></div></div>
    <div class="dash-list" id="mesCollectifsList"><div class="empty-state">Chargement...</div></div>
    <a href="collectifs.html" class="btn-primary" style="width:100%; margin-top:12px; display:block; text-align:center;">Découvrir / créer un collectif</a>

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

// ---------- MES COLLECTIFS ----------
async function loadMesCollectifs(){
  const list = document.getElementById('mesCollectifsList');

  const [{ data: membres }, { data: demandes }] = await Promise.all([
    sb.from('urba_collectif_membres').select('role_in_collectif, urba_collectifs(id, name, status)').eq('profile_id', currentUser.id),
    sb.from('urba_collectif_demandes').select('status, urba_collectifs(id, name)').eq('profile_id', currentUser.id).eq('status', 'pending')
  ]);

  const rows = [];
  (membres || []).filter(m => m.urba_collectifs).forEach(m => {
    rows.push(`
      <div class="dash-row" style="cursor:pointer;" onclick="window.location.href='collectif-detail.html?id=${m.urba_collectifs.id}'">
        <div class="dash-row-title">${m.urba_collectifs.name}</div>
        <span class="status-pill ${m.urba_collectifs.status === 'approved' ? 'status-approved' : 'status-pending'}">${m.role_in_collectif || 'membre'}</span>
      </div>`);
  });
  (demandes || []).filter(d => d.urba_collectifs).forEach(d => {
    rows.push(`
      <div class="dash-row">
        <div class="dash-row-title">${d.urba_collectifs.name}</div>
        <span class="status-pill status-pending">Demande en attente</span>
      </div>`);
  });

  list.innerHTML = rows.length ? rows.join('') : `<div class="empty-state">Tu ne fais partie d'aucun collectif pour le moment.</div>`;
}

// ---------- INFOS DE BASE ----------
function wireBasicForm(){
  const form = document.getElementById('basicForm');
  const btn = document.getElementById('basicBtn');
  const status = document.getElementById('basicStatus');
  const cameraBtn = document.getElementById('avatarCameraBtn');
  const avatarInput = document.getElementById('p-avatar');
  let pendingAvatarFile = null;

  cameraBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', () => {
    pendingAvatarFile = avatarInput.files[0] || null;
    if (!pendingAvatarFile) return;
    const reader = new FileReader();
    reader.onload = e => {
      const circle = document.getElementById('avatarCircle');
      circle.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover;">`;
    };
    reader.readAsDataURL(pendingAvatarFile);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';
    status.innerHTML = '';

    try {
      let avatarUrl = currentProfile.avatar_url;
      if (pendingAvatarFile){
        const path = `${currentUser.id}/${Date.now()}-${pendingAvatarFile.name}`;
        const { error: upErr } = await sb.storage.from('avatars').upload(path, pendingAvatarFile, { upsert: true });
        if (upErr) throw upErr;
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

      const updates = { school_id: schoolId, school_other: schoolOther };

      const { error } = await sb.from('profiles').update(updates).eq('id', currentUser.id);
      if (error) throw error;

      Object.assign(currentProfile, updates);
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
      if (currentProfile.role === 'enseignant'){
        const updates = {
          profile_id: currentUser.id,
          academic_title: document.getElementById('p-title').value || null,
          years_experience: document.getElementById('p-experience').value === '' ? null : parseInt(document.getElementById('p-experience').value, 10)
        };
        const { error } = await sb.from('teacher_profiles').upsert(updates, { onConflict: 'profile_id' });
        if (error) throw error;
        Object.assign(currentRoleProfile, updates);

      } else if (currentProfile.role === 'etudiant'){
        const updates = {
          profile_id: currentUser.id,
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
