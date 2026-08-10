/* ============================================================
   URBANISME — collectifs.js (liste + création)
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
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

// ---------- LISTE DES COLLECTIFS ----------
const grid = document.getElementById('collectifsGrid');
const emptyState = document.getElementById('collectifsEmpty');

async function loadCollectifs(){
  const { data, error } = await sb
    .from('urba_collectifs')
    .select('*, membres:urba_collectif_membres(id)')
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0){
    emptyState.textContent = "Aucun collectif publié pour le moment. Sois le premier à faire vivre le tien.";
    return;
  }

  emptyState.remove();

  data.forEach(c => {
    const card = document.createElement('div');
    card.className = 'projet-card';
    const imgHtml = c.cover_image_url
      ? `<img src="${c.cover_image_url}" alt="${c.name}">`
      : `<svg class="fallback-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;

    card.innerHTML = `
      <div class="projet-image">
        ${imgHtml}
        <span class="projet-badge">${c.year_created || ''}</span>
      </div>
      <div class="projet-body">
        <div class="projet-title">${c.name}</div>
        <div class="projet-meta">
          <span>${(c.membres || []).length} membre${(c.membres || []).length > 1 ? 's' : ''}</span>
          ${c.url ? `<span>🔗 Actif ailleurs</span>` : ''}
        </div>
      </div>
    `;
    card.addEventListener('click', () => window.location.href = `collectif-detail.html?id=${c.id}`);
    grid.appendChild(card);
  });
}
loadCollectifs();

// ---------- CRÉATION D'UN COLLECTIF ----------
const fabBtn = document.getElementById('fabBtn');
const createOverlay = document.getElementById('createOverlay');
const createForm = document.getElementById('createForm');
const createBtn = document.getElementById('createBtn');
const createStatus = document.getElementById('createStatus');

fabBtn.addEventListener('click', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }
  createOverlay.classList.add('open');
});
document.querySelectorAll('[data-close-create]').forEach(btn =>
  btn.addEventListener('click', () => createOverlay.classList.remove('open'))
);
createOverlay.addEventListener('click', (e) => { if (e.target === createOverlay) createOverlay.classList.remove('open'); });

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  createBtn.disabled = true;
  createBtn.textContent = 'Création...';
  createStatus.innerHTML = '';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Connexion requise.');

    let coverUrl = null;
    const coverFile = document.getElementById('c-cover').files[0];
    if (coverFile){
      const path = `collectifs/${Date.now()}-${coverFile.name}`;
      const { error: upErr } = await sb.storage.from('urbanisme').upload(path, coverFile);
      if (upErr) throw upErr;
      coverUrl = sb.storage.from('urbanisme').getPublicUrl(path).data.publicUrl;
    }

    const payload = {
      name: document.getElementById('c-name').value,
      year_created: parseInt(document.getElementById('c-year').value, 10),
      url: document.getElementById('c-url').value || null,
      description: document.getElementById('c-desc').value,
      histoire: document.getElementById('c-histoire').value || null,
      cover_image_url: coverUrl,
      created_by: session.user.id,
      status: 'pending',
      is_public: false
    };

    const { data: inserted, error: insertError } = await sb
      .from('urba_collectifs').insert(payload).select().single();
    if (insertError) throw insertError;

    // Le créateur devient automatiquement premier membre
    await sb.from('urba_collectif_membres').insert({
      collectif_id: inserted.id,
      profile_id: session.user.id,
      role_in_collectif: 'fondateur'
    });

    createStatus.innerHTML = `<div class="submit-status ok">Collectif créé ! Il sera visible publiquement après validation.</div>`;
    createForm.reset();
    setTimeout(() => { window.location.href = `collectif-detail.html?id=${inserted.id}`; }, 1500);

  } catch (err){
    createStatus.innerHTML = `<div class="submit-status err">Erreur : ${err.message || err}</div>`;
  } finally {
    createBtn.disabled = false;
    createBtn.textContent = 'Créer le collectif';
  }
});
