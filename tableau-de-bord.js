/* ============================================================
   URBANISME — tableau-de-bord.js
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TYPE_LABELS = {
  diagnostic: 'Diagnostic territorial',
  atelier: "Atelier d'urbanisme",
  plan_amenagement: "Plan d'aménagement",
  memoire: 'Mémoire de recherche',
  cartographie: 'Cartographie & SIG'
};

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Publié',
  rejected: 'Refusé'
};

const dashWrap = document.getElementById('dashWrap');
const logoutBtn = document.getElementById('logoutBtn');

logoutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
  window.location.href = 'connexion.html';
});

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }

  const userId = session.user.id;

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('full_name, role, school, school_id, avatar_url')
    .eq('id', userId)
    .single();

  if (profileError || !profile){
    dashWrap.innerHTML = `<div class="empty-state">Impossible de charger ton profil. Reconnecte-toi.</div>`;
    return;
  }

  renderDashboard(profile, userId);
}

function renderDashboard(profile, userId){
  const roleLabel = profile.role === 'teacher' ? 'Enseignant' : profile.role === 'admin' ? 'Admin' : 'Étudiant';
  const initial = (profile.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const initialSafe = initial.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const avatarHtml = profile.avatar_url
    ? `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`
    : `<span style="color:var(--blan); font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:1.3rem;">${initialSafe}</span>`;

  dashWrap.innerHTML = `
    <div class="dash-header">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:52px; height:52px; border-radius:50%; overflow:hidden; background:var(--navy); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${avatarHtml}
        </div>
        <h1>Bonjour, ${profile.full_name || 'toi'}</h1>
      </div>
      <span class="role-pill role-${profile.role}">${roleLabel}</span>
    </div>

    <div class="section-label" style="margin-top:30px;"><span>Mes travaux</span><div class="line"></div></div>
    <div class="dash-list" id="myProjectsList"><div class="empty-state">Chargement...</div></div>

    ${profile.role === 'teacher' ? `
      <div class="section-label" style="margin-top:34px;"><span>À valider</span><div class="line"></div></div>
      <div class="dash-list" id="pendingList"><div class="empty-state">Chargement...</div></div>
    ` : ''}
  `;

  loadMyProjects(userId);
  if (profile.role === 'teacher') loadPendingQueue();
}

async function loadMyProjects(userId){
  const list = document.getElementById('myProjectsList');
  const { data, error } = await sb
    .from('urbanisme_projects')
    .select('*')
    .eq('student_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0){
    list.innerHTML = `<div class="empty-state">Tu n'as pas encore soumis de travail depuis ton compte. Utilise le bouton "+" sur l'accueil.</div>`;
    return;
  }

  list.innerHTML = data.map(p => `
    <div class="dash-row">
      <div>
        <div class="dash-row-title">${p.title}</div>
        <div class="dash-row-meta">${TYPE_LABELS[p.travail_type] || p.travail_type}</div>
      </div>
      <span class="status-pill status-${p.status}">${STATUS_LABELS[p.status] || p.status}</span>
    </div>
  `).join('');
}

async function loadPendingQueue(){
  const list = document.getElementById('pendingList');
  const { data, error } = await sb
    .from('urbanisme_projects')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !data || data.length === 0){
    list.innerHTML = `<div class="empty-state">Rien à valider pour le moment.</div>`;
    return;
  }

  list.innerHTML = data.map(p => `
    <div class="dash-row dash-row-validate" data-id="${p.id}">
      <div>
        <div class="dash-row-title">${p.title}</div>
        <div class="dash-row-meta">${TYPE_LABELS[p.travail_type] || p.travail_type} — ${p.contributor_name || 'Anonyme'}</div>
      </div>
      <div class="dash-actions">
        <button class="btn-approve" data-action="approve" data-id="${p.id}">Publier</button>
        <button class="btn-reject" data-action="reject" data-id="${p.id}">Refuser</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleValidation(btn.dataset.id, btn.dataset.action));
  });
}

async function handleValidation(projectId, action){
  const { data: { session } } = await sb.auth.getSession();
  const updates = action === 'approve'
    ? { status: 'approved', is_public: true, validated_by: session.user.id, validated_at: new Date().toISOString() }
    : { status: 'rejected', is_public: false, validated_by: session.user.id, validated_at: new Date().toISOString() };

  const { error } = await sb.from('urbanisme_projects').update(updates).eq('id', projectId);
  if (!error) loadPendingQueue();
}

init();
