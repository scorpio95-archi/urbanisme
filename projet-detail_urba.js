/* ============================================================
   URBANISME — projet-detail.js
   Page dédiée pour un travail d'un des 5 ateliers isolés.
   URL : projet-detail.html?atelier=diagnostic&id=uuid
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

const ENJEU_LABELS = {
  risques_resilience: 'Risques & résilience',
  habitat_informel: 'Habitat informel',
  mobilite: 'Mobilité urbaine',
  foncier: 'Gouvernance foncière',
  autre: 'Autre enjeu'
};

const EXTRA_FIELD_LABELS = {
  diagnostic: { zone_etudiee: 'Zone étudiée', methodologie: 'Méthodologie', donnees_population: 'Données population' },
  atelier: { site: 'Site', commanditaire: 'Commanditaire', equipe: 'Équipe', brief_projet: 'Brief du projet' },
  plan: { zone: 'Zone', type_zonage: 'Type de zonage', echelle: 'Échelle' },
  memoire: { question_recherche: 'Question de recherche', encadrant: 'Encadrant', mots_cles: 'Mots-clés' },
  sig: { logiciel_utilise: 'Logiciel utilisé', systeme_coordonnees: 'Système de coordonnées', couches_donnees: 'Couches de données' }
};

const params = new URLSearchParams(window.location.search);
const atelierKey = params.get('atelier');
const projetId = params.get('id');
const config = ATELIERS[atelierKey];

// ---------- MENU HAMBURGER ----------
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

// ---------- ÉTAT CONNEXION DANS LE MENU (persistant, pas de reconnexion par page) ----------
(async function syncAuthMenu(){
  const link = document.getElementById("authMenuLink");
  if (!link) return;
  const { data: { session } } = await sb.auth.getSession();
  if (session){
    link.setAttribute("href", "#");
    link.childNodes[0].textContent = "Déconnexion";
    const sub = document.getElementById("authMenuSub");
    if (sub) sub.textContent = session.user.email || "";
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      await sb.auth.signOut();
      window.location.href = "index.html";
    });
  }
})();


const wrap = document.getElementById('projetWrap');
let currentUserId = null;

async function init(){
  if (!config || !projetId){
    wrap.innerHTML = `<div class="empty-state">Ce travail est introuvable.</div>`;
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  currentUserId = session ? session.user.id : null;

  const { data: p, error } = await sb.from(config.table).select('*').eq('id', projetId).single();

  if (error || !p){
    wrap.innerHTML = `<div class="empty-state">Ce travail n'est pas accessible (pas encore validé, ou lien invalide).</div>`;
    return;
  }

  render(p);
  loadLikes();
  loadComments();
}

function render(p){
  const extras = EXTRA_FIELD_LABELS[atelierKey] || {};
  const extraHtml = Object.entries(extras)
    .filter(([col]) => p[col])
    .map(([col, label]) => {
      const val = Array.isArray(p[col]) ? p[col].join(', ') : p[col];
      return `<div class="modal-block"><h4>${label}</h4><p>${val}</p></div>`;
    }).join('');

  const plansHtml = (atelierKey === 'plan' && Array.isArray(p.plans_files) && p.plans_files.length)
    ? `<div class="modal-block"><h4>Plans techniques</h4>${p.plans_files.map(f => `<a class="pdf-link" href="${f.url}" target="_blank" style="display:block; margin-top:8px;">📐 ${f.nom}</a>`).join('')}</div>`
    : '';

  const documentHtml = p.document_url
    ? `<a class="pdf-link" href="${p.document_url}" target="_blank">📄 Ouvrir le document complet</a>`
    : '';

  const carteHtml = p.carte_export_url
    ? `<div class="modal-image" style="border-radius:10px; margin:14px 0;"><img src="${p.carte_export_url}"></div>`
    : '';

  wrap.innerHTML = `
    ${p.cover_image_url ? `<div class="modal-image" style="border-radius:10px; margin-bottom:16px;"><img src="${p.cover_image_url}"></div>` : ''}
    <span class="projet-badge" style="position:static; display:inline-block; margin-bottom:10px;">${config.label}</span>
    <h1>${p.title}</h1>
    <div class="projet-meta" style="border:none; padding-top:6px;">
      ${p.location ? `<span>📍 ${p.location}</span>` : ''}
      ${p.level ? `<span>🎓 ${p.level}</span>` : ''}
      ${p.enjeu_urbain ? `<span>⚑ ${ENJEU_LABELS[p.enjeu_urbain] || p.enjeu_urbain}</span>` : ''}
    </div>

    <div class="modal-block"><p>${p.description || ''}</p></div>
    ${extraHtml}
    ${plansHtml}
    ${carteHtml}
    ${documentHtml}

    ${p.contributor_name ? `<div class="modal-block"><h4>Auteur</h4><p>${p.contributor_name}</p></div>` : ''}

    <div class="engagement-bar">
      <button class="like-btn" id="likeBtn">♥ <span id="likeCount">0</span></button>
    </div>

    <div class="section-label" style="margin-top:10px;"><span>Commentaires</span><div class="line"></div></div>
    <div id="commentsList" style="margin-top:10px;"></div>
    <div id="commentFormWrap"></div>
  `;

  document.getElementById('likeBtn').addEventListener('click', toggleLike);

  const formWrap = document.getElementById('commentFormWrap');
  if (currentUserId){
    formWrap.innerHTML = `
      <form class="comment-form" id="commentForm">
        <input type="text" id="commentInput" placeholder="Écrire un commentaire..." required>
        <button type="submit" class="btn-primary">Publier</button>
      </form>`;
    document.getElementById('commentForm').addEventListener('submit', postComment);
  } else {
    formWrap.innerHTML = `<p style="font-size:0.85rem; color:var(--txt-doux); margin-top:10px;"><a href="connexion.html" style="color:var(--orange);">Connecte-toi</a> pour commenter.</p>`;
  }
}

// ---------- LIKES ----------
async function loadLikes(){
  const { count } = await sb
    .from('urba_likes')
    .select('*', { count: 'exact', head: true })
    .eq('atelier_table', config.table)
    .eq('project_id', projetId);
  document.getElementById('likeCount').textContent = count || 0;

  if (currentUserId){
    const { data } = await sb
      .from('urba_likes')
      .select('id')
      .eq('atelier_table', config.table)
      .eq('project_id', projetId)
      .eq('profile_id', currentUserId)
      .maybeSingle();
    if (data) document.getElementById('likeBtn').classList.add('liked');
  }
}

async function toggleLike(){
  if (!currentUserId){ window.location.href = 'connexion.html'; return; }
  const btn = document.getElementById('likeBtn');
  const liked = btn.classList.contains('liked');

  if (liked){
    await sb.from('urba_likes').delete()
      .eq('atelier_table', config.table).eq('project_id', projetId).eq('profile_id', currentUserId);
  } else {
    await sb.from('urba_likes').insert({
      atelier_table: config.table, project_id: projetId, profile_id: currentUserId
    });
  }
  loadLikes();
}

// ---------- COMMENTAIRES ----------
async function loadComments(){
  const { data } = await sb
    .from('urba_comments')
    .select('id, content, created_at, profiles(full_name)')
    .eq('atelier_table', config.table)
    .eq('project_id', projetId)
    .order('created_at', { ascending: false });

  const list = document.getElementById('commentsList');
  if (!data || data.length === 0){
    list.innerHTML = `<p style="font-size:0.85rem; color:var(--txt-doux);">Aucun commentaire pour le moment.</p>`;
    return;
  }
  list.innerHTML = data.map(c => `
    <div class="comment-item">
      <div class="comment-author">${c.profiles ? c.profiles.full_name : 'Utilisateur'}</div>
      <div class="comment-text">${c.content}</div>
    </div>
  `).join('');
}

async function postComment(e){
  e.preventDefault();
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  if (!content) return;

  await sb.from('urba_comments').insert({
    atelier_table: config.table, project_id: projetId, profile_id: currentUserId, content
  });
  input.value = '';
  loadComments();
}

init();
