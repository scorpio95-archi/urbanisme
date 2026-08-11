/* ============================================================
   URBANISME — revue-article.js
   ============================================================ */

const SUPABASE_URL = 'https://rqtkcnpibhgmnbzuwyfq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Uz7jG2Q8EQPTjDRTIo1jCA_xwOzFkJw';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const params = new URLSearchParams(window.location.search);
const articleId = params.get('id');

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


const wrap = document.getElementById('articleWrap');
let currentUserId = null;

function formatDate(iso){
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function init(){
  if (!articleId){
    wrap.innerHTML = `<div class="empty-state">Article introuvable.</div>`;
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  currentUserId = session ? session.user.id : null;

  const { data: a, error } = await sb
    .from('urba_revue_articles')
    .select('*, category:urba_revue_categories(label), author:profiles!author_id(full_name), collectif:urba_collectifs(id, name), images:urba_revue_article_images(url, order_index)')
    .eq('id', articleId)
    .single();

  if (error || !a){
    wrap.innerHTML = `<div class="empty-state">Cet article n'est pas accessible (pas encore validé, ou lien invalide).</div>`;
    return;
  }

  render(a);
  loadLikes();
  loadComments();
}

function render(a){
  const images = (a.images || []).sort((x, y) => x.order_index - y.order_index);
  const carouselHtml = images.length
    ? `<div class="article-carousel">${images.map(img => `<img src="${img.url}">`).join('')}</div>`
    : '';

  const byline = a.collectif
    ? `<a href="collectif-detail.html?id=${a.collectif.id}" style="color:var(--orange); text-decoration:none; font-weight:700;">${a.collectif.name}</a>`
    : (a.author ? a.author.full_name : '');

  wrap.innerHTML = `
    ${a.cover_image_url ? `<div class="modal-image" style="border-radius:10px; margin-bottom:16px;"><img src="${a.cover_image_url}"></div>` : ''}
    ${a.category ? `<span class="projet-badge" style="position:static; display:inline-block; margin-bottom:10px;">${a.category.label}</span>` : ''}
    <h1>${a.title}</h1>
    <div class="projet-meta" style="border:none; padding-top:6px;">
      ${byline ? `<span>${byline}</span>` : ''}
      <span>${formatDate(a.published_at || a.created_at)}</span>
    </div>

    ${carouselHtml}

    <div class="modal-block" style="margin-top:16px;"><p style="white-space:pre-wrap;">${a.content}</p></div>

    ${a.video_url ? `<video class="article-video" src="${a.video_url}" controls></video>` : ''}
    ${a.pdf_url ? `<a class="pdf-link" href="${a.pdf_url}" target="_blank">📄 Ouvrir le document PDF</a>` : ''}

    <div class="engagement-bar">
      <button class="like-btn" id="likeBtn">♥ <span id="likeCount">0</span></button>
    </div>

    <div class="section-label" style="margin-top:10px;"><span>Commentaires</span><div class="line"></div></div>
    <div id="commentsList" style="margin-top:10px;"></div>
    <div id="commentFormWrap"></div>
  `;

  document.getElementById('likeBtn').addEventListener('click', toggleLike);

  const formWrap = document.getElementById('commentFormWrap');
  if (currentUserId){
    formWrap.innerHTML = `
      <form class="comment-form" id="commentForm">
        <input type="text" id="commentInput" placeholder="Écrire un commentaire..." required>
        <button type="submit" class="btn-primary">Publier</button>
      </form>`;
    document.getElementById('commentForm').addEventListener('submit', postComment);
  } else {
    formWrap.innerHTML = `<p style="font-size:0.85rem; color:var(--txt-doux); margin-top:10px;"><a href="connexion.html" style="color:var(--orange);">Connecte-toi</a> pour commenter.</p>`;
  }
}

// ---------- LIKES ----------
async function loadLikes(){
  const { count } = await sb
    .from('urba_likes')
    .select('*', { count: 'exact', head: true })
    .eq('atelier_table', 'urba_revue_articles')
    .eq('project_id', articleId);
  document.getElementById('likeCount').textContent = count || 0;

  if (currentUserId){
    const { data } = await sb
      .from('urba_likes')
      .select('id')
      .eq('atelier_table', 'urba_revue_articles')
      .eq('project_id', articleId)
      .eq('profile_id', currentUserId)
      .maybeSingle();
    if (data) document.getElementById('likeBtn').classList.add('liked');
  }
}

async function toggleLike(){
  if (!currentUserId){ window.location.href = 'connexion.html'; return; }
  const btn = document.getElementById('likeBtn');
  const liked = btn.classList.contains('liked');

  if (liked){
    await sb.from('urba_likes').delete()
      .eq('atelier_table', 'urba_revue_articles').eq('project_id', articleId).eq('profile_id', currentUserId);
  } else {
    await sb.from('urba_likes').insert({
      atelier_table: 'urba_revue_articles', project_id: articleId, profile_id: currentUserId
    });
  }
  loadLikes();
}

// ---------- COMMENTAIRES ----------
async function loadComments(){
  const { data } = await sb
    .from('urba_comments')
    .select('id, content, created_at, profiles(full_name)')
    .eq('atelier_table', 'urba_revue_articles')
    .eq('project_id', articleId)
    .order('created_at', { ascending: false });

  const list = document.getElementById('commentsList');
  if (!data || data.length === 0){
    list.innerHTML = `<p style="font-size:0.85rem; color:var(--txt-doux);">Aucun commentaire pour le moment.</p>`;
    return;
  }
  list.innerHTML = data.map(c => `
    <div class="comment-item">
      <div class="comment-author">${c.profiles ? c.profiles.full_name : 'Utilisateur'}</div>
      <div class="comment-text">${c.content}</div>
    </div>
  `).join('');
}

async function postComment(e){
  e.preventDefault();
  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  if (!content) return;

  await sb.from('urba_comments').insert({
    atelier_table: 'urba_revue_articles', project_id: articleId, profile_id: currentUserId, content
  });
  input.value = '';
  loadComments();
}

init();
