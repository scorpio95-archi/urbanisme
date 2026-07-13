/* ============================================================
   URBANISME — connexion.js
   ============================================================ */

const SUPABASE_URL = 'https://qptnjgdfobznwmsguvyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdG5qZ2Rmb2J6bndtc2d1dnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA3MjIsImV4cCI6MjA5MzQ5NjcyMn0.QLfIITvc-AdWVLZHHghocNYyYyYvPxZZMAXhdl_4Bdo';
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
