/* ============================================================
   URBANISME — app.js (page d'accueil)
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

// ---------- ACCORDÉON "TYPES DE TRAVAUX" DANS LE MENU ----------
const typesToggle = document.getElementById('typesToggle');
const typesSubmenu = document.getElementById('typesSubmenu');
typesToggle.addEventListener('click', () => {
  typesToggle.classList.toggle('open');
  typesSubmenu.classList.toggle('open');
});

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

    // Si l'utilisateur est connecté, on rattache la soumission à son compte
    // (sinon elle n'apparaîtra jamais dans son tableau de bord "Mes travaux")
    const { data: { session } } = await sb.auth.getSession();

    // Si l'utilisateur est connecté en tant qu'enseignant, la base
    // auto-valide et publie le travail (voir la migration Supabase).
    // Sinon, il part en attente de validation.
    const { error: insertError } = await sb.from('urbanisme_projects').insert({
      title: document.getElementById('f-title').value,
      travail_type: document.getElementById('f-type').value,
      description: document.getElementById('f-desc').value,
      location: document.getElementById('f-location').value || null,
      level: document.getElementById('f-level').value || null,
      cover_image_url: coverUrl,
      student_id: session ? session.user.id : null,
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
