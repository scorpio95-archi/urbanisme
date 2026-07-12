/* ============================================================
   URBANISME — galerie.js
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

const FALLBACK_ICON = `<svg class="fallback-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 21h18M5 21V9l4-2v14M13 21V5l4 2v14M9 21v-4M17 21v-4"/></svg>`;

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

const typesToggle = document.getElementById('typesToggle');
const typesSubmenu = document.getElementById('typesSubmenu');
typesToggle.addEventListener('click', () => {
  typesToggle.classList.toggle('open');
  typesSubmenu.classList.toggle('open');
});

// ---------- FILTRE PAR TYPE (lu depuis l'URL) ----------
const params = new URLSearchParams(window.location.search);
const activeType = params.get('type') || '';

document.querySelectorAll('.filter-chip').forEach(chip => {
  if (chip.dataset.type === activeType) chip.classList.add('active');
});

const galerieTitle = document.getElementById('galerieTitle');
const galerieSubtitle = document.getElementById('galerieSubtitle');
if (activeType && TYPE_LABELS[activeType]){
  galerieTitle.textContent = TYPE_LABELS[activeType];
  galerieSubtitle.textContent = `Tous les travaux publiés de type "${TYPE_LABELS[activeType]}".`;
}

// ---------- GALERIE ----------
const projetsGrid = document.getElementById('projetsGrid');
const projetsEmpty = document.getElementById('projetsEmpty');

async function loadProjets(){
  let query = sb
    .from('urbanisme_projects')
    .select('*')
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (activeType){
    query = query.eq('travail_type', activeType);
  }

  const { data, error } = await query;

  if (error){
    projetsEmpty.textContent = "Impossible de charger les projets pour le moment.";
    return;
  }

  if (!data || data.length === 0){
    projetsEmpty.textContent = activeType
      ? "Aucun travail publié dans cette catégorie pour le moment."
      : "Les travaux des étudiants en urbanisme s'afficheront ici bientôt. Sois parmi les premiers à soumettre le tien !";
    return;
  }

  projetsEmpty.remove();

  data.forEach(p => {
    const card = document.createElement('div');
    card.className = 'projet-card';
    const imgHtml = p.cover_image_url
      ? `<img src="${p.cover_image_url}" alt="${p.title}">`
      : FALLBACK_ICON;

    card.innerHTML = `
      <div class="projet-image">
        ${imgHtml}
        <span class="projet-badge">${TYPE_LABELS[p.travail_type] || p.travail_type}</span>
      </div>
      <div class="projet-body">
        <div class="projet-title">${p.title}</div>
        <div class="projet-meta">
          ${p.location ? `<span>${p.location}</span>` : ''}
          ${p.level ? `<span>${p.level}</span>` : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => openDetail(p));
    projetsGrid.appendChild(card);
  });
}

// ---------- MODAL DÉTAIL ----------
const detailOverlay = document.getElementById('detailOverlay');
const detailContent = document.getElementById('detailContent');

function openDetail(p){
  const imgHtml = p.cover_image_url
    ? `<img src="${p.cover_image_url}" alt="${p.title}">`
    : '';
  detailContent.innerHTML = `
    <div class="modal-image">${imgHtml}</div>
    <span class="projet-badge" style="position:static; display:inline-block; margin-bottom:10px;">${TYPE_LABELS[p.travail_type] || p.travail_type}</span>
    <h2>${p.title}</h2>
    <div class="modal-block">
      <p>${p.description || ''}</p>
    </div>
    <div class="projet-meta" style="border:none; padding-top:0; margin-top:14px;">
      ${p.location ? `<span>📍 ${p.location}</span>` : ''}
      ${p.level ? `<span>🎓 ${p.level}</span>` : ''}
    </div>
  `;
  detailOverlay.classList.add('open');
}

document.querySelectorAll('[data-close-detail]').forEach(btn =>
  btn.addEventListener('click', () => detailOverlay.classList.remove('open'))
);
detailOverlay.addEventListener('click', (e) => { if (e.target === detailOverlay) detailOverlay.classList.remove('open'); });

loadProjets();
