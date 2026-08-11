/* ============================================================
   URBANISME — contact.js
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


// Pré-remplit avec le nom/email du compte connecté, si dispo
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  document.getElementById('c-email').value = session.user.email || '';
  const { data: profile } = await sb.from('profiles').select('full_name').eq('id', session.user.id).single();
  if (profile?.full_name) document.getElementById('c-nom').value = profile.full_name;
})();

// ---------- ENVOI ----------
const form = document.getElementById('contactForm');
const btn = document.getElementById('c-submit');
const statusEl = document.getElementById('c-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Envoi...';
  statusEl.innerHTML = '';

  const { data: { session } } = await sb.auth.getSession();

  const payload = {
    nom: document.getElementById('c-nom').value,
    email: document.getElementById('c-email').value,
    sujet: document.getElementById('c-sujet').value,
    message: document.getElementById('c-message').value,
    access_token: session ? session.access_token : null
  };

  const { error } = await sb.functions.invoke('send-contact-message', { body: payload });

  btn.disabled = false;
  btn.textContent = 'Envoyer';

  if (error){
    statusEl.innerHTML = `<div class="submit-status err">Échec de l'envoi : ${error.message || 'erreur inconnue'}</div>`;
    return;
  }

  statusEl.innerHTML = `<div class="submit-status ok">Message envoyé. Réponse par email sous peu.</div>`;
  form.reset();
});
