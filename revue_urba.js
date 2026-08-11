/* ============================================================
   URBANISME — revue.js (liste)
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_VIDEO_SECONDS = 150;
const MAX_VIDEO_BYTES_BEFORE_COMPRESSION = 30 * 1024 * 1024;
const PAGE_SIZE = 12;

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


// ---------- CATÉGORIES ----------
let categoryId = '';
let searchTerm = '';
let page = 0;

async function loadCategories(){
  const { data } = await sb.from('urba_revue_categories').select('*').order('sort_order', { ascending: true });
  const bar = document.getElementById('filterBar');
  (data || []).forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.textContent = c.label;
    btn.addEventListener('click', () => setCategory(c.id, btn));
    bar.appendChild(btn);
  });
}

function setCategory(id, btn){
  categoryId = id;
  document.querySelectorAll('.filter-chip').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  loadArticles(true);
}
window.setCategory = setCategory;

let searchTimer = null;
document.getElementById('searchInput').addEventListener('input', function(){
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchTerm = this.value.trim();
    loadArticles(true);
  }, 400);
});

// ---------- LISTE DES ARTICLES ----------
const grid = document.getElementById('revueGrid');
const emptyState = document.getElementById('revueEmpty');
const loadMoreBtn = document.getElementById('loadMoreBtn');

function formatDate(iso){
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadArticles(reset){
  if (reset){ page = 0; grid.innerHTML = ''; }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = sb.from('urba_revue_articles')
    .select('*, category:urba_revue_categories(label), author:profiles!author_id(full_name), collectif:urba_collectifs(name)')
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (categoryId) query = query.eq('category_id', categoryId);
  if (searchTerm) query = query.ilike('title', `%${searchTerm}%`);

  const { data, error } = await query;
  const articles = data || [];

  if (reset && articles.length === 0){
    emptyState.textContent = "Rien à lire pour le moment. Les premiers articles arrivent bientôt.";
    grid.appendChild(emptyState);
  } else {
    emptyState.remove();
    articles.forEach(a => grid.appendChild(articleCard(a)));
  }

  page++;
  loadMoreBtn.classList.toggle('hidden', articles.length < PAGE_SIZE);
}

function articleCard(a){
  const card = document.createElement('div');
  card.className = 'projet-card';
  const imgHtml = a.cover_image_url
    ? `<img src="${a.cover_image_url}" alt="${a.title}">`
    : `<svg class="fallback-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"/></svg>`;

  const byline = a.collectif ? a.collectif.name : (a.author ? a.author.full_name : '');

  card.innerHTML = `
    <div class="projet-image">
      ${imgHtml}
      ${a.category ? `<span class="projet-badge">${a.category.label}</span>` : ''}
    </div>
    <div class="projet-body">
      <div class="projet-title">${a.title}</div>
      ${a.excerpt ? `<p style="font-size:0.85rem; color:var(--txt-doux); margin-top:4px;">${a.excerpt}</p>` : ''}
      <div class="projet-meta">
        ${byline ? `<span>${byline}</span>` : ''}
        <span>${formatDate(a.published_at || a.created_at)}</span>
      </div>
    </div>
  `;
  card.addEventListener('click', () => window.location.href = `revue-article.html?id=${a.id}`);
  return card;
}

loadCategories();
loadArticles(true);

// ---------- ÉCRIRE UN ARTICLE ----------
const fabBtn = document.getElementById('fabBtn');
const writeOverlay = document.getElementById('writeOverlay');
const writeForm = document.getElementById('writeForm');
const writeSaveBtn = document.getElementById('writeSaveBtn');
const writeStatus = document.getElementById('writeStatus');

fabBtn.addEventListener('click', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session){ window.location.href = 'connexion.html'; return; }

  await populateCategorySelect();
  await populateCollectifSelect(session.user.id);
  writeOverlay.classList.add('open');
});
document.querySelectorAll('[data-close-write]').forEach(btn =>
  btn.addEventListener('click', () => writeOverlay.classList.remove('open'))
);
writeOverlay.addEventListener('click', (e) => { if (e.target === writeOverlay) writeOverlay.classList.remove('open'); });

async function populateCategorySelect(){
  const { data } = await sb.from('urba_revue_categories').select('*').order('sort_order', { ascending: true });
  const sel = document.getElementById('w-category');
  sel.innerHTML = (data || []).map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

async function populateCollectifSelect(userId){
  const { data } = await sb
    .from('urba_collectif_membres')
    .select('urba_collectifs(id, name)')
    .eq('profile_id', userId);
  const sel = document.getElementById('w-collectif');
  sel.innerHTML = '<option value="">— En ton nom propre —</option>' +
    (data || []).filter(m => m.urba_collectifs).map(m => `<option value="${m.urba_collectifs.id}">${m.urba_collectifs.name}</option>`).join('');
}

// ---------- VIDÉO (durée + compression) ----------
let pendingVideoFile = null;
let pendingVideoDuration = null;

document.getElementById('w-video').addEventListener('change', function(){
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

writeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  writeSaveBtn.disabled = true;
  writeSaveBtn.textContent = 'Envoi...';
  writeStatus.innerHTML = '';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Connexion requise.');

    let coverUrl = null;
    const coverFile = document.getElementById('w-cover').files[0];
    if (coverFile) coverUrl = await uploadTo('revue/articles/covers', coverFile);

    let videoUrl = null;
    if (pendingVideoFile) videoUrl = await uploadTo('revue/articles/videos', pendingVideoFile);

    let pdfUrl = null;
    const pdfFile = document.getElementById('w-pdf').files[0];
    if (pdfFile) pdfUrl = await uploadTo('revue/articles/docs', pdfFile);

    const payload = {
      title: document.getElementById('w-title').value,
      excerpt: document.getElementById('w-excerpt').value || null,
      content: document.getElementById('w-content').value,
      category_id: document.getElementById('w-category').value || null,
      collectif_id: document.getElementById('w-collectif').value || null,
      cover_image_url: coverUrl,
      video_url: videoUrl,
      video_duration_seconds: videoUrl ? pendingVideoDuration : null,
      pdf_url: pdfUrl,
      author_id: session.user.id,
      status: 'pending',
      is_public: false
    };

    const { data: inserted, error: insertError } = await sb
      .from('urba_revue_articles').insert(payload).select().single();
    if (insertError) throw insertError;

    const galleryFiles = Array.from(document.getElementById('w-gallery').files || []);
    for (let i = 0; i < galleryFiles.length; i++){
      const url = await uploadTo('revue/articles/gallery', galleryFiles[i]);
      await sb.from('urba_revue_article_images').insert({ article_id: inserted.id, url, order_index: i });
    }

    writeStatus.innerHTML = `<div class="submit-status ok">Article envoyé, en attente de validation.</div>`;
    writeForm.reset();
    document.getElementById('videoPreview').style.display = 'none';
    pendingVideoFile = null;
    setTimeout(() => writeOverlay.classList.remove('open'), 1800);

  } catch (err){
    writeStatus.innerHTML = `<div class="submit-status err">Erreur : ${err.message || err}</div>`;
  } finally {
    writeSaveBtn.disabled = false;
    writeSaveBtn.textContent = 'Envoyer';
  }
});
