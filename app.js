/* ============================================================
   URBANISME — app.js
   ============================================================ */

const SUPABASE_URL = 'https://qptnjgdfobznwmsguvyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdG5qZ2Rmb2J6bndtc2d1dnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA3MjIsImV4cCI6MjA5MzQ5NjcyMn0.QLfIITvc-AdWVLZHHghocNYyYyYvPxZZMAXhdl_4Bdo';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

const TYPE_LABELS = {
  diagnostic: 'Diagnostic territorial',
  atelier: "Atelier d'urbanisme",
  plan_amenagement: "Plan d'aménagement",
  memoire: 'Mémoire de recherche',
  cartographie: 'Cartographie & SIG'
};

const FALLBACK_ICON = `<svg class="fallback-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M3 21h18M5 21V9l4-2v14M13 21V5l4 2v14M9 21v-4M17 21v-4"/></svg>`;

// ---------- GALERIE ----------
const projetsGrid = document.getElementById('projetsGrid');
const projetsEmpty = document.getElementById('projetsEmpty');

async function loadProjets(){
  const { data, error } = await sb
    .from('urbanisme_projects')
    .select('*')
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error){
    projetsEmpty.textContent = "Impossible de charger les projets pour le moment.";
    return;
  }

  if (!data || data.length === 0){
    projetsEmpty.textContent = "Les travaux des étudiants en urbanisme s'afficheront ici bientôt. Sois parmi les premiers à soumettre le tien !";
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

// ---------- MODAL SOUMISSION ----------
const submitOverlay = document.getElementById('submitOverlay');
const fabBtn = document.getElementById('fabBtn');
const submitForm = document.getElementById('submitForm');
const submitBtn = document.getElementById('submitBtn');
const submitStatus = document.getElementById('submitStatus');

fabBtn.addEventListener('click', () => submitOverlay.classList.add('open'));
document.querySelectorAll('[data-close-submit]').forEach(btn =>
  btn.addEventListener('click', () => submitOverlay.classList.remove('open'))
);
submitOverlay.addEventListener('click', (e) => { if (e.target === submitOverlay) submitOverlay.classList.remove('open'); });

submitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi en cours...';
  submitStatus.innerHTML = '';

  try {
    let coverUrl = null;
    const file = document.getElementById('f-cover').files[0];

    if (file){
      const path = `submissions/${Date.now()}-${file.name}`;
      const { error: uploadError } = await sb.storage.from('urbanisme').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = sb.storage.from('urbanisme').getPublicUrl(path);
      coverUrl = urlData.publicUrl;
    }

    const { error: insertError } = await sb.from('urbanisme_projects').insert({
      title: document.getElementById('f-title').value,
      travail_type: document.getElementById('f-type').value,
      description: document.getElementById('f-desc').value,
      location: document.getElementById('f-location').value || null,
      level: document.getElementById('f-level').value || null,
      cover_image_url: coverUrl,
      contributor_name: document.getElementById('f-name').value,
      contributor_email: document.getElementById('f-email').value,
      status: 'pending',
      is_public: false
    });

    if (insertError) throw insertError;

    submitStatus.innerHTML = `<div class="submit-status ok">Merci ! Ton travail a été envoyé et sera examiné avant publication.</div>`;
    submitForm.reset();
    setTimeout(() => submitOverlay.classList.remove('open'), 2000);

  } catch (err){
    submitStatus.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
  }
});

loadProjets();
