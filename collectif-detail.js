/* ============================================================
   URBANISME — collectif-detail.js
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_VIDEO_SECONDS = 150;
const MAX_VIDEO_BYTES_BEFORE_COMPRESSION = 30 * 1024 * 1024;

const params = new URLSearchParams(window.location.search);
const collectifId = params.get('id');

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


const wrap = document.getElementById('collectifWrap');
const fabAddContent = document.getElementById('fabAddContent');

let currentUserId = null;
let isCreator = false;
let isMember = false;

async function init(){
  if (!collectifId){
    wrap.innerHTML = `<div class="empty-state">Collectif introuvable.</div>`;
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  currentUserId = session ? session.user.id : null;

  const { data: c, error } = await sb
    .from('urba_collectifs')
    .select('*, membres:urba_collectif_membres(id, profile_id, membre_nom, role_in_collectif, profiles(full_name, avatar_url))')
    .eq('id', collectifId)
    .single();

  if (error || !c){
    wrap.innerHTML = `<div class="empty-state">Ce collectif n'est pas accessible (pas encore validé, ou lien invalide).</div>`;
    return;
  }

  isCreator = currentUserId === c.created_by;
  isMember = isCreator || (c.membres || []).some(m => m.profile_id === currentUserId);

  render(c);

  if (isMember) fabAddContent.classList.remove('hidden');
  if (isCreator) loadDemandes();

  loadContenus(c.id, c.name);
}

function render(c){
  const membresHtml = (c.membres || []).map(m => {
    const nom = m.profiles ? m.profiles.full_name : (m.membre_nom || 'Membre');
    return `<span class="filter-chip" style="cursor:default;">${nom}${m.role_in_collectif ? ` · ${m.role_in_collectif}` : ''}</span>`;
  }).join('');

  let joinAction = '';
  if (!currentUserId){
    joinAction = `<a href="connexion.html" class="btn-primary" style="margin-top:16px; display:inline-block;">Se connecter pour rejoindre</a>`;
  } else if (isMember){
    joinAction = `<div class="submit-status ok" style="margin-top:16px;">Tu fais partie de ce collectif.</div>`;
  } else {
    joinAction = `<button class="btn-primary" style="margin-top:16px;" id="joinBtn">Demander à rejoindre</button><div id="joinStatus"></div>`;
  }

  wrap.innerHTML = `
    <div class="modal-image" style="border-radius:10px; margin-bottom:16px;">
      ${c.cover_image_url ? `<img src="${c.cover_image_url}">` : ''}
    </div>
    <h1>${c.name}</h1>
    <div class="projet-meta" style="border:none; padding-top:6px;">
      ${c.year_created ? `<span>📅 Depuis ${c.year_created}</span>` : ''}
      ${c.url ? `<span>🔗 <a href="${c.url}" target="_blank" style="color:var(--orange);">Toujours actif ailleurs</a></span>` : ''}
    </div>
    <div class="modal-block"><p>${c.description || ''}</p></div>
    ${c.histoire ? `<div class="modal-block"><h4>Histoire</h4><p>${c.histoire}</p></div>` : ''}

    <div class="section-label" style="margin-top:26px;"><span>Membres</span><div class="line"></div></div>
    <div class="filter-bar" style="padding:14px 0;">${membresHtml || '<span style="color:var(--txt-doux); font-size:0.85rem;">Pas encore de membres listés.</span>'}</div>

    ${joinAction}

    <div id="demandesPanel"></div>

    <div class="section-label" style="margin-top:30px;" id="contenusLabel"><span>Contenu partagé</span><div class="line"></div></div>
    <div class="dash-list" id="contenusList"><div class="empty-state">Chargement...</div></div>
  `;

  const joinBtn = document.getElementById('joinBtn');
  if (joinBtn) joinBtn.addEventListener('click', () => requestJoin(c.id));
}

// ---------- DEMANDE D'ADHÉSION ----------
async function requestJoin(cId){
  const btn = document.getElementById('joinBtn');
  const status = document.getElementById('joinStatus');
  btn.disabled = true;

  const { error } = await sb.from('urba_collectif_demandes').insert({
    collectif_id: cId,
    profile_id: currentUserId,
    status: 'pending'
  });

  if (error){
    status.innerHTML = `<div class="submit-status err">${error.message}</div>`;
    btn.disabled = false;
  } else {
    status.innerHTML = `<div class="submit-status ok">Demande envoyée. Le créateur du collectif doit encore la valider.</div>`;
    btn.remove();
  }
}

// ---------- DEMANDES EN ATTENTE (créateur uniquement) ----------
async function loadDemandes(){
  const panel = document.getElementById('demandesPanel');
  const { data, error } = await sb
    .from('urba_collectif_demandes')
    .select('id, message, profiles(full_name)')
    .eq('collectif_id', collectifId)
    .eq('status', 'pending');

  if (error || !data || data.length === 0) return;

  panel.innerHTML = `
    <div class="section-label" style="margin-top:26px;"><span>Demandes en attente</span><div class="line"></div></div>
    <div class="dash-list">
      ${data.map(d => `
        <div class="dash-row dash-row-validate" data-demande="${d.id}">
          <div class="dash-row-title">${d.profiles ? d.profiles.full_name : 'Utilisateur'}</div>
          <div class="dash-actions">
            <button class="btn-approve" data-action="approve" data-id="${d.id}">Accepter</button>
            <button class="btn-reject" data-action="reject" data-id="${d.id}">Refuser</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  panel.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => decideDemande(btn.dataset.id, btn.dataset.action));
  });
}

async function decideDemande(demandeId, action){
  const { data: demande, error: fetchErr } = await sb
    .from('urba_collectif_demandes').select('profile_id, collectif_id').eq('id', demandeId).single();
  if (fetchErr || !demande) return;

  const status = action === 'approve' ? 'approved' : 'rejected';
  await sb.from('urba_collectif_demandes').update({ status, decided_at: new Date().toISOString() }).eq('id', demandeId);

  if (action === 'approve'){
    await sb.from('urba_collectif_membres').insert({
      collectif_id: demande.collectif_id,
      profile_id: demande.profile_id
    });
  }
  loadDemandes();
}

// ---------- CONTENU DÉJÀ PUBLIÉ PAR CE COLLECTIF ----------
async function loadContenus(cId, cName){
  const list = document.getElementById('contenusList');
  const { data, error } = await sb
    .from('urba_revue_articles')
    .select('id, title, excerpt, cover_image_url, published_at, created_at')
    .eq('collectif_id', cId)
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0){
    list.innerHTML = `<div class="empty-state">${cName} n'a pas encore publié de contenu dans la Revue.</div>`;
    return;
  }

  list.innerHTML = data.map(a => `
    <div class="dash-row" style="cursor:pointer;" onclick="window.location.href='revue-article.html?id=${a.id}'">
      <div>
        <div class="dash-row-title">${a.title}</div>
        ${a.excerpt ? `<div class="dash-row-meta">${a.excerpt}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ---------- MODAL AJOUT DE CONTENU ----------
const contentOverlay = document.getElementById('contentOverlay');
const contentForm = document.getElementById('contentForm');
const contentSaveBtn = document.getElementById('contentSaveBtn');
const contentStatus = document.getElementById('contentStatus');

fabAddContent.addEventListener('click', () => contentOverlay.classList.add('open'));
document.querySelectorAll('[data-close-content]').forEach(btn =>
  btn.addEventListener('click', () => contentOverlay.classList.remove('open'))
);
contentOverlay.addEventListener('click', (e) => { if (e.target === contentOverlay) contentOverlay.classList.remove('open'); });

let pendingVideoFile = null;
let pendingVideoDuration = null;

document.getElementById('k-video').addEventListener('change', function(){
  const file = this.files[0];
  if (!file) return;
  const statusEl = document.getElementById('videoStatusMsg');
  statusEl.textContent = 'Vérification de la vidéo...';

  const tempVideo = document.createElement('video');
  tempVideo.preload = 'metadata';
  tempVideo.src = URL.createObjectURL(file);
  tempVideo.onloadedmetadata = async () => {
    const duration = tempVideo.duration;
    URL.revokeObjectURL(tempVideo.src);

    if (duration > MAX_VIDEO_SECONDS){
      statusEl.textContent = `Vidéo trop longue (${Math.round(duration)}s). Maximum ${MAX_VIDEO_SECONDS}s.`;
      this.value = '';
      pendingVideoFile = null;
      pendingVideoDuration = null;
      return;
    }

    pendingVideoDuration = Math.round(duration);
    let finalFile = file;

    if (file.size > MAX_VIDEO_BYTES_BEFORE_COMPRESSION){
      statusEl.textContent = `Compression en cours (${Math.round(file.size / 1024 / 1024)} Mo)...`;
      try {
        finalFile = await compressVideoFile(file);
        statusEl.textContent = `Compressée : ${Math.round(finalFile.size / 1024 / 1024 * 10) / 10} Mo.`;
      } catch (e){
        statusEl.textContent = 'Compression impossible sur cet appareil, envoi du fichier original.';
      }
    } else {
      statusEl.textContent = `Vidéo prête (${Math.round(file.size / 1024 / 1024 * 10) / 10} Mo, ${pendingVideoDuration}s).`;
    }

    pendingVideoFile = finalFile;
    const preview = document.getElementById('videoPreview');
    preview.src = URL.createObjectURL(finalFile);
    preview.style.display = 'block';
  };
  tempVideo.onerror = () => { statusEl.textContent = 'Impossible de lire cette vidéo.'; };
});

function compressVideoFile(file){
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.addEventListener('loadedmetadata', () => {
      const maxWidth = 854;
      const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(25);
      const mimeType = (window.MediaRecorder && MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
        ? 'video/webm;codecs=vp9' : 'video/webm';

      if (!window.MediaRecorder){ reject(new Error('MediaRecorder non supporté')); return; }

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1200000 });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const newName = file.name.replace(/\.[^.]+$/, '') + '.webm';
        resolve(new File([blob], newName, { type: mimeType }));
      };
      recorder.onerror = e => reject(e.error || new Error('Erreur MediaRecorder'));

      function drawFrame(){
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, w, h);
        requestAnimationFrame(drawFrame);
      }
      video.addEventListener('play', () => { recorder.start(); drawFrame(); });
      video.addEventListener('ended', () => recorder.stop());
      video.play().catch(reject);
    });
    video.addEventListener('error', () => reject(new Error('Lecture vidéo impossible')));
  });
}

async function uploadTo(bucketPath, file){
  const path = `${bucketPath}/${Date.now()}-${file.name}`;
  const { error } = await sb.storage.from('urbanisme').upload(path, file);
  if (error) throw error;
  return sb.storage.from('urbanisme').getPublicUrl(path).data.publicUrl;
}

contentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  contentSaveBtn.disabled = true;
  contentSaveBtn.textContent = 'Envoi...';
  contentStatus.innerHTML = '';

  try {
    let coverUrl = null;
    const coverFile = document.getElementById('k-cover').files[0];
    if (coverFile) coverUrl = await uploadTo(`revue/${collectifId}/covers`, coverFile);

    let videoUrl = null;
    if (pendingVideoFile) videoUrl = await uploadTo(`revue/${collectifId}/videos`, pendingVideoFile);

    let pdfUrl = null;
    const pdfFile = document.getElementById('k-pdf').files[0];
    if (pdfFile) pdfUrl = await uploadTo(`revue/${collectifId}/docs`, pdfFile);

    const { data: cat } = await sb.from('urba_revue_categories').select('id').eq('slug', 'collectifs').single();

    const payload = {
      title: document.getElementById('k-title').value,
      content: document.getElementById('k-body').value,
      cover_image_url: coverUrl,
      video_url: videoUrl,
      video_duration_seconds: videoUrl ? pendingVideoDuration : null,
      pdf_url: pdfUrl,
      author_id: currentUserId,
      collectif_id: collectifId,
      category_id: cat ? cat.id : null,
      status: 'pending',
      is_public: false
    };

    const { data: inserted, error: insertError } = await sb
      .from('urba_revue_articles').insert(payload).select().single();
    if (insertError) throw insertError;

    const galleryFiles = Array.from(document.getElementById('k-gallery').files || []);
    for (let i = 0; i < galleryFiles.length; i++){
      const url = await uploadTo(`revue/${collectifId}/gallery`, galleryFiles[i]);
      await sb.from('urba_revue_article_images').insert({ article_id: inserted.id, url, order_index: i });
    }

    contentStatus.innerHTML = `<div class="submit-status ok">Contenu envoyé, en attente de validation.</div>`;
    contentForm.reset();
    document.getElementById('videoPreview').style.display = 'none';
    pendingVideoFile = null;
    setTimeout(() => contentOverlay.classList.remove('open'), 1800);

  } catch (err){
    contentStatus.innerHTML = `<div class="submit-status err">Erreur : ${err.message || err}</div>`;
  } finally {
    contentSaveBtn.disabled = false;
    contentSaveBtn.textContent = 'Envoyer';
  }
});

init();
