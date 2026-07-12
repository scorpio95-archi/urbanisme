/* ============================================================
   LAKOU — shared/nav.js
   Fil d'ariane de liaison entre les sites du réseau Lakou.

   UTILISATION (2 lignes, dans cet ordre, juste après <body>) :

     <script>window.LAKOU_SITE = "archi";</script>
     <script src="shared/nav.js"></script>

   Remplace "archi" par la clé du site courant :
     "inivesite"    → Lakou Inivesite (la structure mère)
     "archi"        → Lakou Archi (page mère de la famille Archi)
     "architecture" → Architecture (discipline, sous Lakou Archi)
     "urbanisme"    → Urbanisme (discipline, sous Lakou Archi)
     "ingenierie"   → Lakou Enjenyè

   Pas de "defer" nécessaire, pas de dépendance à
   document.currentScript — juste une variable globale simple,
   donc ça marche même si le script est déplacé, dupliqué,
   ou chargé différemment d'un repo à l'autre.
   ============================================================ */

(function () {
  const SITES = {
    inivesite:    { label: "Lakou Inivesite", url: "https://lakou-inivesite.vercel.app/", parent: null },
    archi:        { label: "Lakou Archi",     url: "https://lakou-archi-rho.vercel.app/", parent: "inivesite" },
    architecture: { label: "Architecture",    url: "https://lakou-archi-k68x.vercel.app/", parent: "archi" },
    urbanisme:    { label: "Urbanisme",       url: "https://urbanisme-one.vercel.app/", parent: "archi" },
    ingenierie:   { label: "Lakou Enjenyè",   url: "https://lakou-enjenye26.vercel.app/index.html", parent: "inivesite" }
  };

  const current = window.LAKOU_SITE || "inivesite";

  if (!SITES[current]) {
    console.warn('[Lakou nav.js] Site inconnu: "' + current + '". Vérifie window.LAKOU_SITE.');
    return;
  }

  const chain = [];
  let node = current;
  while (node && SITES[node]) {
    chain.unshift(node);
    node = SITES[node].parent;
  }

  const style = document.createElement('style');
  style.textContent = `
    .lakou-network-bar{
      position:relative; z-index:500;
      display:flex; align-items:center; gap:6px; flex-wrap:wrap;
      font-family:'Karla', 'Inter', sans-serif; font-size:0.72rem;
      background:#211712; color:#f2e4c8;
      padding:7px 16px; letter-spacing:0.02em;
    }
    .lakou-network-bar a{ color:#f2e4c8; text-decoration:none; font-weight:700; }
    .lakou-network-bar a:hover{ text-decoration:underline; }
    .lakou-network-bar .lakou-sep{ opacity:0.4; }
    .lakou-network-bar .lakou-current{ opacity:0.55; }
  `;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.className = 'lakou-network-bar';

  const parts = chain.map((key, i) => {
    const site = SITES[key];
    const icon = i === 0 ? '🏠 ' : '';
    const label = icon + site.label;
    const isLast = i === chain.length - 1;
    const link = isLast
      ? `<span class="lakou-current">${label}</span>`
      : `<a href="${site.url}">${label}</a>`;
    return i === 0 ? link : `<span class="lakou-sep">›</span>${link}`;
  });

  bar.innerHTML = parts.join(' ');

  function insertBar(){
    document.body.insertBefore(bar, document.body.firstChild);
  }

  if (document.body) {
    insertBar();
  } else {
    document.addEventListener('DOMContentLoaded', insertBar);
  }
})();
