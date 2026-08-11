/* ============================================================
   URBANISME — app.js (page d'accueil)
   Soumission dynamique : 5 ateliers = 5 tables isolées.
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- CONFIG DES 5 ATELIERS ----------
const ATELIER_FIELDS = {
  diagnostic: {
    table: 'urba_diagnostic_projects',
    label: 'Diagnostic territorial',
    fields: [
      { id:'af-zone', col:'zone_etudiee', label:'Zone étudiée', type:'text', required:true },
      { id:'af-methodo', col:'methodologie', label:'Méthodologie', type:'textarea' },
      { id:'af-population', col:'donnees_population', label:'Données population (optionnel)', type:'text' }
    ]
  },
  atelier: {
    table: 'urba_atelier_projects',
    label: 'Atelier de projet urbain',
    fields: [
      { id:'af-site', col:'site', label:'Site du projet', type:'text', required:true },
      { id:'af-commanditaire', col:'commanditaire', label:"Commanditaire (mairie, communauté...)", type:'text' },
      { id:'af-equipe', col:'equipe', label:'Équipe', type:'text' },
      { id:'af-brief', col:'brief_projet', label:'Brief du projet', type:'textarea' }
    ]
  },
  plan: {
    table: 'urba_plan_projects',
    label: "Plan d'aménagement",
    fields: [
      { id:'af-zoneplan', col:'zone', label:'Zone concernée', type:'text', required:true },
      { id:'af-zonage', col:'type_zonage', label:'Type de zonage', type:'text' },
      { id:'af-echelle', col:'echelle', label:'Échelle', type:'text' },
      { id:'af-plansfiles', col:'plans_files', label:'Plans techniques (plusieurs fichiers possibles)', type:'file-multi' }
    ]
  },
  memoire: {
    table: 'urba_memoire_projects',
    label: 'Mémoire de recherche',
    fields: [
      { id:'af-resume', col:'resume', label:'Résumé', type:'textarea', required:true },
      { id:'af-question', col:'question_recherche', label:'Question de recherche', type:'text' },
      { id:'af-encadrant', col:'encadrant', label:'Encadrant', type:'text' },
      { id:'af-motscles', col:'mots_cles', label:'Mots-clés (séparés par virgule)', type:'text' },
      { id:'af-document', col:'document_url', label:'Document complet (PDF)', type:'file-single' }
    ]
  },
  sig: {
    table: 'urba_sig_projects',
    label: 'Cartographie & SIG',
    fields: [
      { id:'af-logiciel', col:'logiciel_utilise', label:'Logiciel utilisé', type:'text', required:true },
      { id:'af-couches', col:'couches_donnees', label:'Couches de données (séparées par virgule)', type:'text' },
      { id:'af-coord', col:'systeme_coordonnees', label:'Système de coordonnées', type:'text' },
      { id:'af-carteexport', col:'carte_export_url', label:'Export de carte (image)', type:'file-single' }
    ]
  }
};

// ---------- STATS RÉELLES (page d'accueil) ----------
async function loadStats(){
  const counts = await Promise.all(Object.entries(ATELIER_FIELDS).map(async ([key, cfg]) => {
    const { count } = await sb
      .from(cfg.table)
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_public', true);
    return [key, count || 0];
  }));

  let total = 0;
  counts.forEach(([key, count]) => {
    total += count;
    const el = document.getElementById(`stat-${key}`);
    if (el) el.textContent = count;
  });
  const totalEl = document.getElementById('stat-total');
  if (totalEl) totalEl.textContent = total;
}

// ---------- ANNUAIRE (page d'accueil) ----------
function initialOf(name){
  const i = (name || '?').trim().charAt(0).toUpperCase();
  return i.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') || '?';
}

async function loadAnnuaire(){
  const grid = document.getElementById('annuaireGrid');
  const empty = document.getElementById('annuaireEmpty');

  const { data, error } = await sb
    .from('profiles')
    .select('id, full_name, avatar_url, role, schools(name)')
    .order('created_at', { ascending: false })
    .limit(16);

  if (error || !data || data.length === 0){
    empty.textContent = "L'annuaire se remplira au fur et à mesure des inscriptions.";
    return;
  }

  empty.remove();

  const roleLabels = { etudiant: 'Étudiant', enseignant: 'Enseignant', visiteur: 'Visiteur', admin: 'Admin' };

  data.forEach(p => {
    const card = document.createElement('div');
    card.className = 'annuaire-card';
    const avatarHtml = p.avatar_url
      ? `<img src="${p.avatar_url}" alt="">`
      : initialOf(p.full_name);
    card.innerHTML = `
      <div class="annuaire-avatar">${avatarHtml}</div>
      <div class="annuaire-name">${p.full_name || 'Sans nom'}</div>
      ${p.schools && p.schools.name ? `<div class="annuaire-school">${p.schools.name}</div>` : ''}
      <span class="role-pill role-${p.role}">${roleLabels[p.role] || p.role}</span>
    `;
    grid.appendChild(card);
  });
}

loadStats();
loadAnnuaire();
loadAdminProfile();

// ---------- PROFIL ADMIN (bas de home) ----------
// Reflète toujours l'état actuel de Paramètres — aucune donnée dupliquée.
async function loadAdminProfile(){
  const section = document.getElementById('adminProfileSection');
  const { data, error } = await sb
    .from('profiles')
    .select('full_name, bio, avatar_url, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (error || !data) return; // pas d'admin visible pour l'instant, on n'affiche rien

  const avatarHtml = data.avatar_url
    ? `<img src="${data.avatar_url}" alt="">`
    : initialOf(data.full_name);

  section.innerHTML = `
    <div class="admin-profile-card">
      <div class="admin-profile-avatar">${avatarHtml}</div>
      <div class="admin-profile-name">${data.full_name || 'Administrateur'}</div>
      <span class="role-pill role-admin">Admin</span>
      ${data.bio ? `<div class="admin-profile-bio">${data.bio}</div>` : ''}
    </div>
  `;
}

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
const atelierSelect = document.getElementById('f-atelier');
const dynamicFields = document.getElementById('dynamicFields');

fabBtn.addEventListener('click', () => submitOverlay.classList.add('open'));
document.querySelectorAll('[data-close-submit]').forEach(btn =>
  btn.addEventListener('click', () => submitOverlay.classList.remove('open'))
);
submitOverlay.addEventListener('click', (e) => { if (e.target === submitOverlay) submitOverlay.classList.remove('open'); });

// ---------- CONSTRUCTION DYNAMIQUE DES CHAMPS SPÉCIFIQUES ----------
function fieldHtml(f){
  if (f.type === 'textarea'){
    return `
      <div class="form-group">
        <label for="${f.id}">${f.label}</label>
        <textarea id="${f.id}" ${f.required ? 'required' : ''}></textarea>
      </div>`;
  }
  if (f.type === 'file-single'){
    return `
      <div class="form-group">
        <label for="${f.id}">${f.label}</label>
        <input type="file" id="${f.id}">
      </div>`;
  }
  if (f.type === 'file-multi'){
    return `
      <div class="form-group">
        <label for="${f.id}">${f.label}</label>
        <input type="file" id="${f.id}" multiple>
      </div>`;
  }
  return `
    <div class="form-group">
      <label for="${f.id}">${f.label}</label>
      <input type="text" id="${f.id}" ${f.required ? 'required' : ''}>
    </div>`;
}

function renderAtelierFields(key){
  const config = ATELIER_FIELDS[key];
  if (!config){ dynamicFields.innerHTML = ''; return; }
  dynamicFields.innerHTML = config.fields.map(fieldHtml).join('');
}

atelierSelect.addEventListener('change', () => renderAtelierFields(atelierSelect.value));
renderAtelierFields(atelierSelect.value); // état initial

// ---------- UPLOAD HELPER ----------
async function uploadFile(file, subfolder){
  const path = `submissions/${subfolder}/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from('urbanisme').upload(path, file);
  if (error) throw error;
  const { data } = sb.storage.from('urbanisme').getPublicUrl(path);
  return data.publicUrl;
}

// ---------- SOUMISSION ----------
submitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi en cours...';
  submitStatus.innerHTML = '';

  const atelierKey = atelierSelect.value;
  const config = ATELIER_FIELDS[atelierKey];

  if (!config){
    submitStatus.innerHTML = `<div class="submit-status err">Choisis un atelier avant d'envoyer.</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
    return;
  }

  try {
    // Image de couverture (commune à tous les ateliers)
    let coverUrl = null;
    const coverFile = document.getElementById('f-cover').files[0];
    if (coverFile) coverUrl = await uploadFile(coverFile, atelierKey);

    // Champs spécifiques à l'atelier choisi
    const specificData = {};
    for (const f of config.fields){
      const el = document.getElementById(f.id);
      if (!el) continue;

      if (f.type === 'file-single'){
        const file = el.files[0];
        specificData[f.col] = file ? await uploadFile(file, `${atelierKey}/docs`) : null;
      } else if (f.type === 'file-multi'){
        const files = Array.from(el.files || []);
        if (files.length){
          const uploaded = [];
          for (const file of files){
            const url = await uploadFile(file, `${atelierKey}/plans`);
            uploaded.push({ url, nom: file.name });
          }
          specificData[f.col] = uploaded;
        } else {
          specificData[f.col] = null;
        }
      } else if (f.col === 'mots_cles' || f.col === 'couches_donnees'){
        specificData[f.col] = el.value ? el.value.split(',').map(s => s.trim()).filter(Boolean) : null;
      } else {
        specificData[f.col] = el.value || null;
      }
    }

    const { data: { session } } = await sb.auth.getSession();

    const payload = {
      title: document.getElementById('f-title').value,
      description: document.getElementById('f-desc').value,
      location: document.getElementById('f-location').value || null,
      level: document.getElementById('f-level').value || null,
      enjeu_urbain: document.getElementById('f-enjeu').value || null,
      cover_image_url: coverUrl,
      student_id: session ? session.user.id : null,
      contributor_name: document.getElementById('f-name').value,
      contributor_email: document.getElementById('f-email').value,
      status: 'pending',
      is_public: false,
      ...specificData
    };

    const { error: insertError } = await sb.from(config.table).insert(payload);
    if (insertError) throw insertError;

    submitStatus.innerHTML = `<div class="submit-status ok">Merci ! Ton travail a été envoyé et sera examiné avant publication.</div>`;
    submitForm.reset();
    renderAtelierFields('');
    setTimeout(() => submitOverlay.classList.remove('open'), 2000);

  } catch (err){
    submitStatus.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
  }
});
