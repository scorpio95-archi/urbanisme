/* ============================================================
   URBANISME — inscription.js
   Le rôle est choisi ici en exception (communauté niche) — mais
   il DOIT passer par les métadonnées du signUp, jamais par une
   update directe après coup (bloquée par trg_prevent_role_change).
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- BASCULE ÉTUDIANT / ENSEIGNANT ----------
let currentRole = 'student'; // valeur interne UI ; convertie en FR à l'envoi
const roleButtons = document.querySelectorAll('.role-btn');
const studentFields = document.getElementById('studentFields');
const teacherFields = document.getElementById('teacherFields');

roleButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    roleButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRole = btn.dataset.role;
    studentFields.style.display = currentRole === 'student' ? 'block' : 'none';
    teacherFields.style.display = currentRole === 'teacher' ? 'block' : 'none';
  });
});

function roleFr(){
  return currentRole === 'teacher' ? 'enseignant' : 'etudiant';
}

// ---------- LISTE DES ÉCOLES ----------
const schoolSelect = document.getElementById('s-school');
const schoolOtherGroup = document.getElementById('schoolOtherGroup');

async function loadSchools(){
  const { data, error } = await sb.from('schools').select('id, name').order('name');
  const options = ['<option value="">Choisis ton établissement</option>'];
  if (!error && data){
    data.forEach(s => options.push(`<option value="${s.id}">${s.name}</option>`));
  }
  options.push('<option value="autre">Autre (précise)</option>');
  schoolSelect.innerHTML = options.join('');
}
loadSchools();

schoolSelect.addEventListener('change', () => {
  schoolOtherGroup.classList.toggle('show', schoolSelect.value === 'autre');
});

// ---------- SOUMISSION ----------
const signupForm = document.getElementById('signupForm');
const signupBtn = document.getElementById('signupBtn');
const signupStatus = document.getElementById('signupStatus');

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  signupBtn.disabled = true;
  signupBtn.textContent = 'Création en cours...';
  signupStatus.innerHTML = '';

  const fullName = document.getElementById('s-name').value;
  const email = document.getElementById('s-email').value;
  const password = document.getElementById('s-password').value;
  const schoolChoice = schoolSelect.value;
  const schoolId = (schoolChoice && schoolChoice !== 'autre') ? schoolChoice : null;
  const schoolOther = schoolChoice === 'autre' ? document.getElementById('s-school-other').value : null;

  try {
    // Le rôle part dans raw_user_meta_data : handle_new_user() le lit
    // et l'assigne à la création du profil. C'est le SEUL canal valide —
    // une update après coup serait bloquée par trg_prevent_role_change.
    const { data: signUpData, error: signUpError } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { role: roleFr() },
        emailRedirectTo: 'https://urbanisme-one.vercel.app/connexion.html'
      }
    });
    if (signUpError) throw signUpError;

    const userId = signUpData.user ? signUpData.user.id : null;
    const hasSession = !!signUpData.session;

    if (userId && hasSession){
      // Complète le profil déjà créé par handle_new_user() —
      // on ne touche jamais au champ role ici.
      const { error: profileError } = await sb.from('profiles').update({
        full_name: fullName,
        school_id: schoolId,
        school_other: schoolOther
      }).eq('id', userId);
      if (profileError) throw profileError;

      if (currentRole === 'student'){
        const level = document.getElementById('s-level').value || null;
        await sb.from('student_profiles').upsert({
          profile_id: userId,
          level: level
        }, { onConflict: 'profile_id' });
      } else {
        const title = document.getElementById('s-title').value || null;
        const exp = document.getElementById('s-experience').value || null;
        await sb.from('teacher_profiles').upsert({
          profile_id: userId,
          academic_title: title,
          years_experience: exp || null
        }, { onConflict: 'profile_id' });
      }

      signupStatus.innerHTML = `<div class="submit-status ok">Compte créé et connecté ! Tu peux dès maintenant retourner à l'accueil.</div>`;
      signupForm.reset();
    } else {
      signupStatus.innerHTML = `<div class="submit-status ok">Compte créé ! Vérifie ton email pour confirmer ton adresse, puis connecte-toi — ton profil (${currentRole === 'student' ? 'étudiant' : 'enseignant'}) sera complété à ta première connexion.</div>`;
      signupForm.reset();
    }

  } catch (err){
    signupStatus.innerHTML = `<div class="submit-status err">Erreur : ${err.message || err}</div>`;
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Créer mon compte';
  }
});
