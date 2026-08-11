/* URBANISME — apropos.js : juste le menu hamburger, page statique. */
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
