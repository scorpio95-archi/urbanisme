/* ============================================================
   URBANISME — tableau-de-bord.js
   ============================================================ */

const SUPABASE_URL = 'https://qptnjgdfobznwmsguvyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdG5qZ2Rmb2J6bndtc2d1dnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA3MjIsImV4cCI6MjA5MzQ5NjcyMn0.QLfIITvc-AdWVLZHHghocNYyYyYvPxZZMAXhdl_4Bdo';
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
    .select('full_name, role, school, school_id')
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

  dashWrap.innerHTML = `
    <div class="dash-header">
      <h1>Bonjour, ${profile.full_name || 'toi'}</h1>
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
