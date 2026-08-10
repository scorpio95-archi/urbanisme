/* ============================================================
   URBANISME — connexion.js
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginStatus = document.getElementById('loginStatus');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginBtn.disabled = true;
  loginBtn.textContent = 'Connexion en cours...';
  loginStatus.innerHTML = '';

  const email = document.getElementById('l-email').value;
  const password = document.getElementById('l-password').value;

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    loginStatus.innerHTML = `<div class="submit-status ok">Connecté ! Redirection...</div>`;
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);

  } catch (err){
    loginStatus.innerHTML = `<div class="submit-status err">Erreur : ${err.message || err}</div>`;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Se connecter';
  }
});
