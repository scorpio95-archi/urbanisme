/* ============================================================
   URBANISME — tableau-de-bord.js
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ATELIERS = {
  diagnostic: { table: 'urba_diagnostic_projects', label: 'Diagnostic territorial' },
  atelier:    { table: 'urba_atelier_projects',    label: 'Atelier de projet urbain' },
  plan:       { table: 'urba_plan_projects',       label: "Plan d'aménagement" },
  memoire:    { table: 'urba_memoire_projects',    label: 'Mémoire de recherche' },
  sig:        { table: 'urba_sig_projects',        label: 'Cartographie & SIG' }
};

const STATUS_LABELS = {
  pending: 'En attente',
  approved: 'Publié',
  rejected: 'Refusé'
};

// Rôles tels que définis dans public.user_role (migration)
const ROLE_LABELS = {
  etudiant: 'Étudiant',
  enseignant: 'Enseignant',
  visiteur: 'Visiteur',
  admin: 'Admin'
};

const dashWrap = document.getElementById('dashWrap');
// ---------- MENU HAMBURGER + ÉTAT CONNEXION ----------
const burgerBtn = document.getElementById('burgerBtn');
const menuPanel = document.getElementById('menuPanel');
const overlay = document.getElementById('overlay');
function toggleMenu(force){
  const open = force !== undefined ? force : !menuPanel.classList.contains('open');
  menuPanel.classList.toggle('open', open);
  overlay.classList.toggle('open', open);
  burgerBtn.classList.toggle('open', open);
}
burgerBtn.addEventListener('click', () => toggleMenu());
overlay.addEventListener('click', () => toggleMenu(false));
document.querySelectorAll('[data-close]').forEach(a => a.addEventListener('click', () => toggleMenu(false)));

(async function syncAuthMenu(){
  const link = document.getElementById('authMenuLink');
  if (!link) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session){
    link.setAttribute('href', '#');
    link.childNodes[0].textContent = 'Déconnexion';
    const sub = document.getElementById('authMenuSub');
    if (sub) sub.textContent = session.user.email || '';
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = 'index.html';
    });
  }
})();

async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }

  const userId = session.user.id;

  const { data: profile, error: profileError } = await sb
    .from('profiles')
    .select('full_name, role, school_id, avatar_url')
    .eq('id', userId)
    .single();

  if (profileError || !profile){
    dashWrap.innerHTML = `<div class="empty-state">Impossible de charger ton profil. Reconnecte-toi.</div>`;
    return;
  }

  renderDashboard(profile, userId);
}

function renderDashboard(profile, userId){
  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const initial = (profile.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const initialSafe = initial.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const avatarHtml = profile.avatar_url
    ? `<img src="${profile.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`
    : `<span style="color:var(--blan); font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:1.3rem;">${initialSafe}</span>`;

  const canValidate = profile.role === 'enseignant' || profile.role === 'admin';
  const isAdmin = profile.role === 'admin';

  dashWrap.innerHTML = `
    <div class="dash-header">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:52px; height:52px; border-radius:50%; overflow:hidden; background:var(--fond-3); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${avatarHtml}
        </div>
        <h1>Bonjour, ${profile.full_name || 'toi'}</h1>
      </div>
      <span class="role-pill role-${profile.role}">${roleLabel}</span>
    </div>

    <div class="section-label" style="margin-top:30px;"><span>Mes travaux</span><div class="line"></div></div>
    <div class="dash-list" id="myProjectsList"><div class="empty-state">Chargement...</div></div>

    ${canValidate ? `
      <div class="section-label" style="margin-top:34px;"><span>À valider</span><div class="line"></div></div>
      <div class="dash-list" id="pendingList"><div class="empty-state">Chargement...</div></div>
    ` : ''}

    ${isAdmin ? `
      <div class="section-label" style="margin-top:34px;"><span>Statistiques</span><div class="line"></div></div>
      <div class="stats-grid" id="adminStatsGrid" style="padding:14px 0;">
        <div class="stat-card"><div class="stat-number" id="stat-inscrits">—</div><div class="stat-label">Inscrits</div></div>
        <div class="stat-card"><div class="stat-number" id="stat-publications">—</div><div class="stat-label">Travaux publiés</div></div>
        <div class="stat-card"><div class="stat-number" id="stat-collectifs">—</div><div class="stat-label">Collectifs</div></div>
        <div class="stat-card"><div class="stat-number" id="stat-articles">—</div><div class="stat-label">Articles Revue</div></div>
      </div>
      <canvas id="statsChart" height="180" style="margin-top:10px;"></canvas>
      <button class="btn-primary" style="width:100%; margin-top:16px;" id="rapportBtn">Envoyer un rapport</button>
      <p id="rapportMsg" style="font-size:0.8rem; margin-top:8px; text-align:center; color:var(--txt-doux);"></p>

      <div class="section-label" style="margin-top:34px;"><span>Modération</span><div class="line"></div></div>
      <p style="font-size:0.82rem; color:var(--txt-doux); margin-top:6px;">Retirer tout contenu déjà publié qui enfreint les règles de la plateforme.</p>
      <div class="dash-list" id="moderationList" style="margin-top:10px;"><div class="empty-state">Chargement...</div></div>

      <div class="section-label" style="margin-top:34px;"><span>Utilisateurs</span><div class="line"></div></div>
      <div class="dash-list" id="usersList"><div class="empty-state">Chargement...</div></div>
    ` : ''}
  `;

  loadMyProjects(userId);
  if (canValidate) loadPendingQueue();
  if (isAdmin){
    loadAdminStats();
    loadModeration();
    loadUsers();
    document.getElementById('rapportBtn').addEventListener('click', sendRapport);
  }
}

async function loadMyProjects(userId){
  const list = document.getElementById('myProjectsList');

  const results = await Promise.all(Object.entries(ATELIERS).map(async ([key, cfg]) => {
    const { data, error } = await sb
      .from(cfg.table)
      .select('*')
      .eq('student_id', userId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(p => ({ ...p, _atelierKey: key }));
  }));

  const mine = results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (mine.length === 0){
    list.innerHTML = `<div class="empty-state">Tu n'as pas encore soumis de travail depuis ton compte. Utilise le bouton "+" sur l'accueil.</div>`;
    return;
  }

  list.innerHTML = mine.map(p => `
    <div class="dash-row" style="cursor:pointer;" onclick="window.location.href='projet-detail.html?atelier=${p._atelierKey}&id=${p.id}'">
      <div>
        <div class="dash-row-title">${p.title}</div>
        <div class="dash-row-meta">${ATELIERS[p._atelierKey].label}</div>
      </div>
      <span class="status-pill status-${p.status}">${STATUS_LABELS[p.status] || p.status}</span>
    </div>
  `).join('');
}

async function loadPendingQueue(){
  const list = document.getElementById('pendingList');

  const results = await Promise.all(Object.entries(ATELIERS).map(async ([key, cfg]) => {
    const { data, error } = await sb
      .from(cfg.table)
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(p => ({ ...p, _atelierKey: key }));
  }));

  const pending = results.flat().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  if (pending.length === 0){
    list.innerHTML = `<div class="empty-state">Rien à valider pour le moment.</div>`;
    return;
  }

  list.innerHTML = pending.map(p => `
    <div class="dash-row dash-row-validate" data-id="${p.id}" data-atelier="${p._atelierKey}">
      <div>
        <div class="dash-row-title">${p.title}</div>
        <div class="dash-row-meta">${ATELIERS[p._atelierKey].label} — ${p.contributor_name || 'Anonyme'}</div>
      </div>
      <div class="dash-actions">
        <button class="btn-approve" data-action="approve" data-id="${p.id}" data-atelier="${p._atelierKey}">Publier</button>
        <button class="btn-reject" data-action="reject" data-id="${p.id}" data-atelier="${p._atelierKey}">Refuser</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleValidation(btn.dataset.id, btn.dataset.atelier, btn.dataset.action));
  });
}

async function handleValidation(projectId, atelierKey, action){
  const cfg = ATELIERS[atelierKey];
  if (!cfg) return;

  const { data: { session } } = await sb.auth.getSession();
  const updates = action === 'approve'
    ? { status: 'approved', is_public: true, validated_by: session.user.id, validated_at: new Date().toISOString() }
    : { status: 'rejected', is_public: false, validated_by: session.user.id, validated_at: new Date().toISOString() };

  const { error } = await sb.from(cfg.table).update(updates).eq('id', projectId);
  if (!error) loadPendingQueue();
}

/* ============================================================
   ADMIN — Statistiques, Modération, Utilisateurs
   ============================================================ */

async function loadAdminStats(){
  const { count: inscrits } = await sb.from('profiles').select('*', { count: 'exact', head: true });
  document.getElementById('stat-inscrits').textContent = inscrits ?? 0;

  const counts = await Promise.all(Object.entries(ATELIERS).map(async ([key, cfg]) => {
    const { count } = await sb.from(cfg.table).select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_public', true);
    return { key, label: cfg.label, count: count || 0 };
  }));
  const totalPub = counts.reduce((s, c) => s + c.count, 0);
  document.getElementById('stat-publications').textContent = totalPub;

  const { count: collectifsCount } = await sb.from('urba_collectifs').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_public', true);
  document.getElementById('stat-collectifs').textContent = collectifsCount ?? 0;

  const { count: articlesCount } = await sb.from('urba_revue_articles').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_public', true);
  document.getElementById('stat-articles').textContent = articlesCount ?? 0;

  new Chart(document.getElementById('statsChart'), {
    type: 'bar',
    data: {
      labels: counts.map(c => c.label),
      datasets: [{ data: counts.map(c => c.count), backgroundColor: '#02A0A0', borderRadius: 4 }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#ffffffbf', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.08)' } },
        x: { ticks: { color: '#ffffffbf', font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

async function sendRapport(){
  const btn = document.getElementById('rapportBtn');
  const msg = document.getElementById('rapportMsg');
  btn.disabled = true;
  btn.textContent = 'Envoi...';
  msg.textContent = '';

  const { error } = await sb.functions.invoke('send-dashboard-report');

  btn.disabled = false;
  btn.textContent = 'Envoyer un rapport';

  if (error){
    msg.textContent = "Échec de l'envoi : " + (error.message || 'erreur inconnue');
    msg.style.color = '#ff8a75';
    return;
  }
  msg.textContent = 'Rapport envoyé par email.';
  msg.style.color = 'var(--turquoise-vive)';
}

async function loadModeration(){
  const list = document.getElementById('moderationList');

  const [ateliersResults, articlesRes, collectifsRes] = await Promise.all([
    Promise.all(Object.entries(ATELIERS).map(async ([key, cfg]) => {
      const { data } = await sb.from(cfg.table).select('id, title, created_at').eq('status', 'approved').eq('is_public', true).order('created_at', { ascending: false }).limit(10);
      return (data || []).map(p => ({ ...p, _kind: 'atelier', _key: key, _table: cfg.table, _label: cfg.label }));
    })),
    sb.from('urba_revue_articles').select('id, title, created_at').eq('status', 'approved').eq('is_public', true).order('created_at', { ascending: false }).limit(10),
    sb.from('urba_collectifs').select('id, name, created_at').eq('status', 'approved').eq('is_public', true).order('created_at', { ascending: false }).limit(10)
  ]);

  const items = [
    ...ateliersResults.flat(),
    ...((articlesRes.data || []).map(a => ({ id: a.id, title: a.title, created_at: a.created_at, _kind: 'article', _table: 'urba_revue_articles', _label: 'Revue' }))),
    ...((collectifsRes.data || []).map(c => ({ id: c.id, title: c.name, created_at: c.created_at, _kind: 'collectif', _table: 'urba_collectifs', _label: 'Collectif' })))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (items.length === 0){
    list.innerHTML = `<div class="empty-state">Rien à modérer pour le moment.</div>`;
    return;
  }

  list.innerHTML = items.map(it => `
    <div class="dash-row" data-mod="${it._table}:${it.id}">
      <div>
        <div class="dash-row-title">${it.title}</div>
        <div class="dash-row-meta">${it._label}</div>
      </div>
      <button class="btn-reject" data-table="${it._table}" data-id="${it.id}">Retirer</button>
    </div>
  `).join('');

  list.querySelectorAll('button[data-table]').forEach(btn => {
    btn.addEventListener('click', () => removeContent(btn.dataset.table, btn.dataset.id));
  });
}

async function removeContent(table, id){
  if (!confirm('Retirer définitivement ce contenu de la plateforme ?')) return;
  const { error } = await sb.from(table).update({ status: 'rejected', is_public: false }).eq('id', id);
  if (!error) loadModeration();
}

async function loadUsers(){
  const list = document.getElementById('usersList');
  const { data: users } = await sb.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false });

  if (!users || users.length === 0){
    list.innerHTML = `<div class="empty-state">Aucun inscrit.</div>`;
    return;
  }

  list.innerHTML = users.map(u => `
    <div class="dash-row">
      <span class="dash-row-title">${u.full_name || 'Sans nom'}</span>
      <select class="role-select" data-id="${u.id}" style="background:rgba(255,255,255,0.06); color:var(--blan); border:1px solid var(--liseret); border-radius:6px; padding:6px 8px; font-family:'Inter',sans-serif; font-size:0.8rem;">
        <option value="etudiant" ${u.role === 'etudiant' ? 'selected' : ''}>Étudiant</option>
        <option value="enseignant" ${u.role === 'enseignant' ? 'selected' : ''}>Enseignant</option>
        <option value="visiteur" ${u.role === 'visiteur' ? 'selected' : ''}>Visiteur</option>
        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
    </div>
  `).join('');

  list.querySelectorAll('select[data-id]').forEach(select => {
    select.addEventListener('change', async () => {
      const { error } = await sb.from('profiles').update({ role: select.value }).eq('id', select.dataset.id);
      if (error) alert("Échec : " + error.message);
    });
  });
}

init();
