// Steps 02, 03, 05 and 08: list of offers, filters, "Learn more" panel, "Apply" form and user feedback.
(async () => {
  const list = $("#ads"), pager = $("#pager"), count = $("#count"), reset = $("#reset");
  const fContract = $("#f-contract"), fCategory = $("#f-category"), fLocation = $("#f-location"), fQ = $("#q");
  const fDate = $("#f-date"), fDuration = $("#f-duration");
  const PER_PAGE = 6;
  let page = 1;
  const applied = new Set(); // ids of the offers the logged-in user already applied to
  const contract = v => CONTRACT_FR[v] || v;

  await loadNav();
  if (me) {
    try { (await api("/auth/me/applications")).items.forEach(a => applied.add(a.advertisement_id)); } catch { /* not critical */ }
  }
  try { // category filter options come from GET /api/categories
    const cats = await fetchAll("/categories");
    fCategory.insertAdjacentHTML("beforeend", cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""));
  } catch { fCategory.closest("label").hidden = true; }

  // ---------- rendering ----------
  const actionButtons = (id) => applied.has(id)
    ? `<button class="btn" data-act="more" data-label="En savoir plus" aria-expanded="false">En savoir plus</button>
       <button class="btn solid" disabled title="Vous avez déjà postulé à cette offre">Postulé</button>`
    : `<button class="btn" data-act="more" data-label="En savoir plus" aria-expanded="false">En savoir plus</button>
       <button class="btn solid" data-act="apply" data-label="Postuler" aria-expanded="false">Postuler</button>`;

  const card = a => `<article class="ad" data-id="${a.id}">
    <span class="pin" data-t="${esc(a.contract_type)}" title="${esc(contract(a.contract_type))}"></span>
    <h2>${esc(a.title)}${applied.has(a.id) ? '<span class="tag applied">Postulé</span>' : ""}</h2>
    <p class="meta">${esc(a.company_name)}${a.location ? ", " + esc(a.location) : ""}</p>
    <ul class="chips" aria-label="Résumé de l'offre"><li class="chip">${esc(contract(a.contract_type))}</li>${a.duration_months ? `<li class="chip">${a.duration_months} mois</li>` : ""}${a.category_name ? `<li class="chip cat">${esc(a.category_name)}</li>` : ""}</ul>
    <p>${esc(a.short_description)}</p>
    <div class="actions">${actionButtons(a.id)}</div>
    <div class="panel detail" data-panel="more" hidden></div>
    <div class="panel" data-panel="apply" hidden></div>
  </article>`;

  const skeleton = () => Array.from({ length: 3 }, () => '<div class="skel" aria-hidden="true"><i></i><i></i><i></i></div>').join("");

  // Step 03/04: full details fetched from GET /api/advertisements/<id>, shown inside the card
  const details = a => {
    const row = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : "";
    const site = /^https?:\/\//.test(a.company_website || "") ? ` <a href="${esc(a.company_website)}" target="_blank" rel="noopener">Site de l'entreprise</a>` : "";
    return `<div class="detail-grid">${row("Contrat", contract(a.contract_type))}${row("Catégorie", a.category_name)}${row("Lieu", a.location)}
      ${row("Temps de travail", a.working_time)}${row("Durée", a.duration_months ? a.duration_months + " mois" : "")}${row("Salaire", a.wage)}${row("Publiée le", day(a.created_at))}${row("Contact", a.contact_name)}</div>
      <h3>À propos du poste</h3>
      <p class="full">${esc(a.full_description || a.short_description)}</p>
      <p class="company-box">Proposée par <strong>${esc(a.company_name)}</strong>.${site}</p>`;
  };

  // Step 05/06: logged-in users only write a message
  const applyForm = () => `<form class="apply">
    ${me ? `<p>Vous postulez en tant que <strong>${esc(me.first_name)} ${esc(me.last_name)}</strong> (${esc(me.email)}).</p>` : `
    <div class="row"><label>Prénom<input name="first_name" required autocomplete="given-name"></label>
    <label>Nom<input name="last_name" required autocomplete="family-name"></label></div>
    <div class="row"><label>E-mail<input name="email" type="email" required autocomplete="email"></label>
    <label>Téléphone (facultatif)<input name="phone" type="tel" autocomplete="tel"></label></div>
    <p class="hint"><a href="/login">Connectez-vous</a> pour ne plus remplir ces champs.</p>`}
    <label>Message au recruteur<textarea name="message" rows="4" required placeholder="Présentez-vous et expliquez pourquoi cette offre vous intéresse."></textarea></label>
    <button class="btn solid">Envoyer ma candidature</button><p class="msg" role="status"></p></form>`;

  const markApplied = art => {
    applied.add(+art.dataset.id);
    if (!$(".tag.applied", art)) $("h2", art).insertAdjacentHTML("beforeend", '<span class="tag applied">Postulé</span>');
    const btn = $('[data-act="apply"]', art);
    if (btn) { btn.disabled = true; btn.textContent = "Postulé"; btn.removeAttribute("data-act"); }
  };

  // ---------- loading the list ----------
  const filters = () => ({ q: fQ.value.trim(), contract_type: fContract.value, category_id: fCategory.value, location: fLocation.value.trim(),
    date_from: fDate.value, duration: fDuration.value });
  const active = f => Object.values(f).some(Boolean);

  async function load() {
    const f = filters();
    reset.hidden = !active(f);
    list.setAttribute("aria-busy", "true");
    list.innerHTML = skeleton();
    count.textContent = "Chargement des offres...";
    const params = { ...f }; // "4-6" (duration) becomes ?min_duration=4&max_duration=6
    delete params.duration;
    if (f.duration) [params.min_duration, params.max_duration] = f.duration.split("-");
    const qs = new URLSearchParams({ page, per_page: PER_PAGE, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) });
    try {
      const r = await api(`/advertisements?${qs}`);
      count.textContent = r.total ? `${r.total} offre${r.total > 1 ? "s" : ""}${active(f) ? (r.total > 1 ? " correspondent" : " correspond") + " à votre recherche" : ""}` : "";
      list.innerHTML = r.items.length ? r.items.map(card).join("")
        : `<div class="state"><h2>Aucune offre trouvée</h2><p>${active(f) ? "Aucun résultat avec ces filtres. Essayez avec moins de filtres ou un mot-clé plus court." : "Il n'y a pas encore d'offres. Revenez bientôt."}</p>${active(f) ? '<button class="btn solid" data-clear>Effacer les filtres</button>' : ""}</div>`;
      pager.innerHTML = r.pages > 1
        ? `<button class="btn" data-go="${page - 1}" ${page <= 1 ? "disabled" : ""}>Précédent</button><span>Page ${r.page} sur ${r.pages}</span><button class="btn" data-go="${page + 1}" ${page >= r.pages ? "disabled" : ""}>Suivant</button>` : "";
    } catch (e) {
      count.textContent = "";
      pager.innerHTML = "";
      list.innerHTML = `<div class="state err" role="alert"><h2>Impossible de charger les offres</h2><p>${esc(e.message)}</p><button class="btn solid" data-retry>Réessayer</button></div>`;
    }
    list.removeAttribute("aria-busy");
  }

  const refilter = () => { page = 1; load(); };
  const clearFilters = () => { fQ.value = fLocation.value = fContract.value = fCategory.value = fDate.value = fDuration.value = ""; refilter(); };

  // ---------- events ----------
  list.addEventListener("click", async e => {
    if (e.target.closest("[data-clear]")) return clearFilters();
    if (e.target.closest("[data-retry]")) return load();
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const art = b.closest(".ad"), act = b.dataset.act, panel = $(`[data-panel="${act}"]`, art);
    const open = panel.hidden;
    panel.hidden = !open;
    b.setAttribute("aria-expanded", open);
    b.textContent = open ? (act === "more" ? "Voir moins" : "Fermer") : b.dataset.label;
    if (!open || panel.dataset.ready) return;
    if (act === "apply") { panel.innerHTML = applyForm(); panel.dataset.ready = 1; $("input, textarea", panel).focus(); return; }
    panel.innerHTML = '<p class="hint">Chargement des détails...</p>';
    try { panel.innerHTML = details(await api("/advertisements/" + art.dataset.id)); panel.dataset.ready = 1; }
    catch (err) { panel.innerHTML = `<p class="notice err" role="alert">${esc(err.message)}</p>`; }
  });

  list.addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, msg = $(".msg", f), art = f.closest(".ad"), btn = $("button", f), panel = f.closest(".panel");
    msg.className = "msg"; msg.textContent = "Envoi de votre candidature...";
    btn.disabled = true;
    try {
      const r = await api(`/advertisements/${art.dataset.id}/applications`, { method: "POST", body: Object.fromEntries(new FormData(f)) });
      markApplied(art);
      panel.innerHTML = r.email_sent
        ? '<p class="notice ok" role="status">Candidature envoyée. Le recruteur a été prévenu par e-mail.</p>'
        : '<p class="notice info" role="status">Candidature enregistrée. L\'e-mail de notification n\'a pas pu être envoyé, mais le recruteur la verra dans l\'espace d\'administration.</p>';
    } catch (err) {
      btn.disabled = false;
      if (err.status === 409) {
        markApplied(art);
        panel.innerHTML = '<p class="notice info" role="status">Vous avez déjà postulé à cette offre. Il n\'y a rien d\'autre à faire.</p>';
      } else { msg.textContent = err.message; msg.className = "msg err"; }
    }
  });

  pager.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) { page = +g.dataset.go; load(); $("#filters").scrollIntoView({ behavior: "smooth" }); } });
  $("#search").addEventListener("submit", e => { e.preventDefault(); refilter(); });
  $("#filters").addEventListener("submit", e => e.preventDefault());
  fContract.addEventListener("change", refilter);
  fCategory.addEventListener("change", refilter);
  fDate.addEventListener("change", refilter);
  fDuration.addEventListener("change", refilter);
  fLocation.addEventListener("input", debounce(refilter));
  reset.addEventListener("click", clearFilters);
  load();
})();
