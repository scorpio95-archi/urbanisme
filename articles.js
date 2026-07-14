/* ============================================================
   URBANISME — articles.js
   Feed d'articles façon "post" : avatar + nom + date, lien
   externe ou document (PDF/Word), image de couverture optionnelle
   (URL ou upload). Modifiable/effaçable par l'auteur uniquement.
   ============================================================ */

const SUPABASE_URL = 'https://qptnjgdfobznwmsguvyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdG5qZ2Rmb2J6bndtc2d1dnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjA3MjIsImV4cCI6MjA5MzQ5NjcyMn0.QLfIITvc-AdWVLZHHghocNYyYyYvPxZZMAXhdl_4Bdo';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const feedEl = document.getElementById('articlesFeed');
const fabBtn = document.getElementById('fabBtn');
const overlay = document.getElementById('articleOverlay');
const form = document.getElementById('articleForm');
const submitBtn = document.getElementById('articleSubmitBtn');
const statusEl = document.getElementById('articleStatus');
const modalTitle = document.getElementById('articleModalTitle');

const idInput = document.getElementById('a-id');
const titleInput = document.getElementById('a-title');
const summaryInput = document.getElementById('a-summary');
const urlInput = document.getElementById('a-url');
const fileInput = document.getElementById('a-file');
const fileHint = document.getElementById('fileHint');
const imageUrlInput = document.getElementById('a-image-url');
const imageFileInput = document.getElementById('a-image-file');
const linkGroup = document.getElementById('linkGroup');
const fileGroup = document.getElementById('fileGroup');
const contentTypeButtons = document.querySelectorAll('[data-content-type]');

let currentUser = null;
let currentContentType = 'link';
let editingArticle = null; // article en cours d'édition, ou null si création

// ---------- TOGGLE TYPE DE CONTENU ----------
contentTypeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    contentTypeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentContentType = btn.dataset.contentType;
    linkGroup.style.display = currentContentType === 'link' ? 'block' : 'none';
    fileGroup.style.display = currentContentType === 'file' ? 'block' : 'none';
  });
});

// ---------- OUVERTURE / FERMETURE MODAL ----------
fabBtn.addEventListener('click', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    window.location.href = 'connexion.html';
    return;
  }
  openModal();
});
document.querySelectorAll('[data-close-article]').forEach(btn =>
  btn.addEventListener('click', () => overlay.classList.remove('open'))
);
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('open'); });

function openModal(article){
  editingArticle = article || null;
  form.reset();
  statusEl.innerHTML = '';
  fileHint.textContent = '';

  if (article){
    modalTitle.textContent = "Modifier l'article";
    submitBtn.textContent = 'Enregistrer les modifications';
    idInput.value = article.id;
    titleInput.value = article.title || '';
    summaryInput.value = article.summary || '';
    imageUrlInput.value = '';
    if (article.file_url){
      setContentType('file');
      fileHint.textContent = `Document actuel : ${article.file_name || 'fichier'} — choisis un nouveau fichier pour le remplacer.`;
    } else {
      setContentType('link');
      urlInput.value = article.url || '';
    }
  } else {
    modalTitle.textContent = 'Poster un article';
    submitBtn.textContent = 'Publier';
    idInput.value = '';
    setContentType('link');
  }

  overlay.classList.add('open');
}

function setContentType(type){
  currentContentType = type;
  contentTypeButtons.forEach(b => b.classList.toggle('active', b.dataset.contentType === type));
  linkGroup.style.display = type === 'link' ? 'block' : 'none';
  fileGroup.style.display = type === 'file' ? 'block' : 'none';
}

// ---------- SOUMISSION (création ou édition) ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Envoi en cours...';
  statusEl.innerHTML = '';

  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Connecte-toi pour poster.');
    const userId = session.user.id;

    const payload = {
      title: titleInput.value,
      summary: summaryInput.value || null,
      author_id: userId,
      site: 'urbanisme'
    };

    // ---- contenu principal : lien ou document ----
    if (currentContentType === 'link'){
      if (!urlInput.value) throw new Error("Indique l'URL de l'article.");
      payload.url = urlInput.value;
      payload.file_url = null;
      payload.file_name = null;
    } else {
      const file = fileInput.files[0];
      if (file){
        const path = `articles/files/${userId}-${Date.now()}-${file.name}`;
        const { error: uploadError } = await sb.storage.from('urbanisme').upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = sb.storage.from('urbanisme').getPublicUrl(path);
        payload.file_url = urlData.publicUrl;
        payload.file_name = file.name;
      } else if (editingArticle && editingArticle.file_url){
        // garde le fichier existant si aucun nouveau n'est choisi
        payload.file_url = editingArticle.file_url;
        payload.file_name = editingArticle.file_name;
      } else {
        throw new Error('Choisis un fichier PDF ou Word.');
      }
      payload.url = null;
    }

    // ---- image de couverture (optionnelle) : upload prioritaire sur URL ----
    const coverFile = imageFileInput.files[0];
    if (coverFile){
      const path = `articles/covers/${userId}-${Date.now()}-${coverFile.name}`;
      const { error: uploadError } = await sb.storage.from('urbanisme').upload(path, coverFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = sb.storage.from('urbanisme').getPublicUrl(path);
      payload.image_url = urlData.publicUrl;
    } else if (imageUrlInput.value){
      payload.image_url = imageUrlInput.value;
    } else if (editingArticle){
      payload.image_url = editingArticle.image_url || null;
    } else {
      payload.image_url = null;
    }

    if (editingArticle){
      payload.updated_at = new Date().toISOString();
      const { error } = await sb.from('articles').update(payload).eq('id', editingArticle.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('articles').insert(payload);
      if (error) throw error;
    }

    overlay.classList.remove('open');
    loadArticles();

  } catch (err){
    statusEl.innerHTML = `<div class="submit-status err">Une erreur est survenue : ${err.message || err}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

// ---------- CHARGEMENT DU FEED ----------
async function loadArticles(){
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session ? session.user : null;

  const { data, error } = await sb
    .from('articles')
    .select('id, title, summary, url, image_url, file_url, file_name, author_id, created_at, profiles!articles_author_id_fkey(full_name, avatar_url)')
    .eq('site', 'urbanisme')
    .order('created_at', { ascending: false });

  if (error || !data){
    feedEl.innerHTML = `<div class="empty-state">Impossible de charger les articles pour le moment.</div>`;
    return;
  }

  if (data.length === 0){
    feedEl.innerHTML = `<div class="empty-state">Aucun article pour le moment. Sois le premier à en poster un !</div>`;
    return;
  }

  feedEl.innerHTML = `<div class="projets">${data.map(renderCard).join('')}</div>`;

  // Boutons d'ouverture (image + texte)
  data.forEach(article => {
    document.querySelectorAll(`[data-open-id="${article.id}"]`).forEach(el => {
      el.addEventListener('click', () => {
        const target = article.file_url || article.url;
        if (target) window.open(target, '_blank', 'noopener');
      });
    });
  });

  // Boutons modifier / supprimer (uniquement pour l'auteur)
  data.forEach(article => {
    const editBtn = document.getElementById(`edit-${article.id}`);
    const deleteBtn = document.getElementById(`delete-${article.id}`);
    if (editBtn) editBtn.addEventListener('click', () => openModal(article));
    if (deleteBtn) deleteBtn.addEventListener('click', () => handleDelete(article.id));
  });
}

function renderCard(article){
  const author = article.profiles || {};
  const name = author.full_name || 'Utilisateur';
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  const avatarHtml = author.avatar_url
    ? `<img src="${escapeAttr(author.avatar_url)}" style="width:100%; height:100%; object-fit:cover;">`
    : `<span style="color:var(--blan); font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:1rem;">${escapeHtml(initial)}</span>`;

  const date = new Date(article.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const isMine = currentUser && currentUser.id === article.author_id;
  const isFile = !!article.file_url;

  const mediaHtml = article.image_url
    ? `<img src="${escapeAttr(article.image_url)}" alt="" onerror="this.style.display='none';">`
    : `<svg class="fallback-icon" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8">${
        isFile
          ? '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>'
          : '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>'
      }</svg>`;

  return `
    <div class="projet-card">
      <div style="display:flex; align-items:center; gap:10px; padding:16px 18px 0;">
        <div style="width:40px; height:40px; border-radius:50%; overflow:hidden; background:var(--navy); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${avatarHtml}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:0.9rem; color:var(--navy); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(name)}</div>
          <div style="font-size:0.74rem; color:var(--enk-doux); margin-top:1px;">${date}</div>
        </div>
        ${isMine ? `
          <div style="display:flex; gap:6px; flex-shrink:0;">
            <button id="edit-${article.id}" type="button" aria-label="Modifier" style="background:none; border:1px solid var(--liseret); border-radius:6px; width:30px; height:30px; cursor:pointer; color:var(--navy); display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
            </button>
            <button id="delete-${article.id}" type="button" aria-label="Supprimer" style="background:none; border:1px solid var(--liseret); border-radius:6px; width:30px; height:30px; cursor:pointer; color:var(--corail-fonce); display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>
            </button>
          </div>
        ` : ''}
      </div>

      <div style="padding:12px 18px 0;">
        <div class="projet-title" style="margin-bottom:4px;">${escapeHtml(article.title)}</div>
        ${article.summary ? `<p style="font-size:0.88rem; color:var(--enk-doux); line-height:1.55; margin-bottom:12px;">${escapeHtml(article.summary)}</p>` : ''}
      </div>

      <div class="projet-image" data-open-id="${article.id}" style="cursor:pointer; margin:0 18px; width:calc(100% - 36px); border-radius:8px;">
        ${mediaHtml}
      </div>

      <div class="projet-body" style="padding-top:12px;">
        <span data-open-id="${article.id}" style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; font-weight:700; color:var(--corail-fonce); cursor:pointer;">
          ${isFile ? `Ouvrir le document (${escapeHtml(article.file_name || 'fichier')})` : 'Lire l\'article'} ↗
        </span>
      </div>
    </div>
  `;
}

async function handleDelete(articleId){
  if (!confirm('Supprimer cet article ? Cette action est définitive.')) return;
  const { error } = await sb.from('articles').delete().eq('id', articleId);
  if (!error) loadArticles();
}

// ---------- UTILITAIRES ----------
function escapeHtml(str){
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttr(str){
  return escapeHtml(str).replace(/"/g, '&quot;');
}

loadArticles();
