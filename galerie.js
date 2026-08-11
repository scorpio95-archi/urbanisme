/* ============================================================
   URBANISME — galerie.js
   Interroge les 5 tables d'ateliers isolées en parallèle,
   fusionne et trie côté client (pas de table partagée).
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

// ---------- FILTRE PAR ATELIER (lu depuis l'URL) ----------
const params = new URLSearchParams(window.location.search);
const activeAtelier = params.get('atelier') || '';

document.querySelectorAll('.filter-chip').forEach(chip => {
  if (chip.dataset.atelier === activeAtelier) chip.classList.add('active');
});

const galerieTitle = document.getElementById('galerieTitle');
const galerieSubtitle = document.getElementById('galerieSubtitle');
if (activeAtelier && ATELIERS[activeAtelier]){
  galerieTitle.textContent = ATELIERS[activeAtelier].label;
  galerieSubtitle.textContent = `Tous les travaux publiés dans "${ATELIERS[activeAtelier].label}".`;
}

// ---------- GALERIE ----------
const projetsGrid = document.getElementById('projetsGrid');
const projetsEmpty = document.getElementById('projetsEmpty');

async function loadProjets(){
  const keysToQuery = activeAtelier && ATELIERS[activeAtelier]
    ? [activeAtelier]
    : Object.keys(ATELIERS);

  const results = await Promise.all(keysToQuery.map(async key => {
    const { data, error } = await sb
      .from(ATELIERS[key].table)
      .select('*')
      .eq('status', 'approved')
      .eq('is_public', true)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(p => ({ ...p, _atelierKey: key }));
  }));

  const all = results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (all.length === 0){
    projetsEmpty.textContent = activeAtelier
      ? "Aucun travail publié dans cet atelier pour le moment."
      : "Les travaux des étudiants en urbanisme s'afficheront ici bientôt. Sois parmi les premiers à soumettre le tien !";
    return;
  }

  projetsEmpty.remove();

  all.forEach(p => {
    const card = document.createElement('div');
    card.className = 'projet-card';
    const imgHtml = p.cover_image_url
      ? `<img src="${p.cover_image_url}" alt="${p.title}">`
      : FALLBACK_ICON;

    card.innerHTML = `
      <div class="projet-image">
        ${imgHtml}
        <span class="projet-badge">${ATELIERS[p._atelierKey].label}</span>
      </div>
      <div class="projet-body">
        <div class="projet-title">${p.title}</div>
        <div class="projet-meta">
          ${p.location ? `<span>${p.location}</span>` : ''}
          ${p.level ? `<span>${p.level}</span>` : ''}
          ${p.enjeu_urbain ? `<span>${ENJEU_LABELS[p.enjeu_urbain] || p.enjeu_urbain}</span>` : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => window.location.href = `projet-detail.html?atelier=${p._atelierKey}&id=${p.id}`);
    projetsGrid.appendChild(card);
  });
}

// ---------- (modal détail retiré — remplacé par projet-detail.html, pages partageables) ----------

loadProjets();
