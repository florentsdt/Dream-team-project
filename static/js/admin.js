// Step 07 (+ 08): admin back office. CRUD on every table, dropdowns instead of typed ids,
// applications with a readable detail view, a filter by advertisement / status and one-click status changes.
//
// Field tuple = [key, type, required, extra]
//   type "select": extra = list of [value, label]      type "ref": extra = a key of REFS (loaded from the API as a dropdown)
const CONTRACTS = Object.entries(CONTRACT_FR);
const STATUS_OPTIONS = Object.entries(STATUS_FR);
const STATUSES = Object.keys(STATUS_FR);

// REFS: which table feeds a dropdown, and how an option is written
const REFS = {
  companies:      { source: "companies",      text: c => c.name },
  people:         { source: "people",         text: p => `${p.first_name} ${p.last_name} (${p.email})` },
  advertisements: { source: "advertisements", text: a => `${a.title} - ${a.company_name}` },
  categories:     { source: "categories",     text: k => k.name },
};

// Table cells: a plain column name, or [header, function(row) -> html]
const person = r => `${esc(r.person_name)}<br><small class="hint">${esc(r.person_email)}</small>`;
const TABLES = {
  advertisements: { label: "Offres", newText: "Créer une offre", editText: "Modifier l'offre",
    cols: ["id", "title", "company_name", "category_name", "location", "contract_type", "wage"],
    fields: [["title", "text", 1], ["short_description", "text", 1], ["full_description", "textarea"], ["wage", "text"], ["location", "text"],
      ["working_time", "text"], ["duration_months", "number"], ["contract_type", "select", 1, CONTRACTS], ["company_id", "ref", 1, "companies"],
      ["category_id", "ref", 1, "categories"], ["contact_id", "ref", 0, "people"]],
    extra: r => `<button class="btn sm" data-apps="${r.id}">Candidatures</button>` },
  companies: { label: "Entreprises", newText: "Créer une entreprise", editText: "Modifier l'entreprise", cols: ["id", "name", "location", "website"],
    fields: [["name", "text", 1], ["website", "text"], ["location", "text"], ["description", "textarea"]] },
  categories: { label: "Catégories", newText: "Créer une catégorie", editText: "Modifier la catégorie", cols: ["id", "name", "ads_count"], fields: [["name", "text", 1]] },
  people: { label: "Personnes", newText: "Créer une personne", editText: "Modifier la personne", cols: ["id", "first_name", "last_name", "email", "phone", "role", "has_account"],
    fields: [["first_name", "text", 1], ["last_name", "text", 1], ["email", "email", 1], ["phone", "text"], ["role", "select", 1, Object.entries(ROLE_FR)], ["password", "password"]] },
  applications: { label: "Candidatures", newText: "Créer une candidature", editText: "Modifier la candidature",
    cols: ["id", ["advertisement", r => `<span class="wrapcell">${esc(r.ad_title)}</span>`], ["applicant", person],
           ["message", r => `<button class="link cell-msg" data-view="${r.id}" title="Lire le message complet">${esc(r.message)}</button>`],
           ["status", r => statusSelect(r)], ["sent", r => `<span class="nowrap">${esc(day(r.created_at))}</span>`]],
    fields: [["advertisement_id", "ref", 1, "advertisements"], ["person_id", "ref", 1, "people"], ["message", "textarea", 1],
      ["status", "select", 0, STATUS_OPTIONS], ["email_sent", "select", 0, [["0", "Non"], ["1", "Oui"]]]] },
};

const statusSelect = r => `<select class="status-select" data-status="${r.id}" data-s="${esc(r.status)}" aria-label="Statut de la candidature ${r.id}">${
  STATUS_OPTIONS.map(([v, t]) => `<option value="${v}" ${v === r.status ? "selected" : ""}>${t}</option>`).join("")}</select>`;

let table = "advertisements", page = 1, q = "", editId = null, viewId = null;
const appFilter = { ad: "", status: "" };
const grid = $("#grid"), editor = $("#editor"), pager = $("#pager"), status = $("#status"), detail = $("#detail");
const say = (t, cls = "") => { status.textContent = t; status.className = "msg " + cls; };
const label = k => LABELS[k] || k.replace(/_/g, " ");
const colKey = c => Array.isArray(c) ? c[0] : c;
// What is displayed in a plain cell (values stay English in the database)
const fmt = (k, v) => k === "contract_type" ? (CONTRACT_FR[v] || v)
  : k === "role" ? (ROLE_FR[v] || v)
  : (k === "has_account" || k === "email_sent") ? (v ? "Oui" : "Non") : v;

// ---------- dropdown data (cached; dropped when the source table changes) ----------
const lookups = {};
const lookup = name => lookups[name] ??= fetchAll("/" + REFS[name].source).catch(e => { delete lookups[name]; throw e; });
const options = (name, rows, selected, blank) => (blank ? `<option value="">${blank}</option>` : "") +
  rows.map(r => `<option value="${r.id}" ${String(r.id) === String(selected) ? "selected" : ""}>${esc(REFS[name].text(r))}</option>`).join("");

function tabs() {
  $("#tabs").innerHTML = Object.entries(TABLES).map(([k, t]) =>
    `<button role="tab" class="tab" aria-selected="${k === table}" data-t="${k}">${t.label}</button>`).join("");
  $("#afilters").hidden = table !== "applications";
}

async function fillAdFilter() {
  const sel = $("#f-ad");
  try { sel.innerHTML = options("advertisements", await lookup("advertisements"), appFilter.ad, "Toutes les offres"); } catch { /* the grid shows the error */ }
  $("#f-status").value = appFilter.status;
}

// ---------- list ----------
async function load() {
  const def = TABLES[table];
  const head = def.cols.map(c => `<th>${esc(label(colKey(c)))}</th>`).join("");
  grid.innerHTML = `<thead><tr>${head}<th>Actions</th></tr></thead><tbody><tr><td colspan="${def.cols.length + 1}" class="hint">Chargement...</td></tr></tbody>`;
  const qs = new URLSearchParams({ page, per_page: 10, q });
  if (table === "applications") {
    if (appFilter.ad) qs.set("advertisement_id", appFilter.ad);
    if (appFilter.status) qs.set("status", appFilter.status);
  }
  try {
    const r = await api(`/${table}?${qs}`);
    const cell = (row, c) => Array.isArray(c) ? c[1](row) : esc(String(fmt(c, row[c]) ?? "").slice(0, 60));
    const empty = table === "applications" && (appFilter.ad || appFilter.status || q) ? "Aucune candidature ne correspond à ces filtres." : 'Aucun enregistrement. Utilisez « Nouvel enregistrement » pour en ajouter un.';
    grid.innerHTML = `<thead><tr>${head}<th>Actions</th></tr></thead><tbody>` +
      (r.items.map(row => `<tr class="${row.id === viewId && table === "applications" ? "row-open" : ""}">${def.cols.map(c => `<td>${cell(row, c)}</td>`).join("")}
        <td class="acts">${def.extra ? def.extra(row) + " " : ""}<button class="btn sm" data-edit="${row.id}">Modifier</button><button class="btn sm danger" data-del="${row.id}">Supprimer</button></td></tr>`).join("")
        || `<tr><td colspan="${def.cols.length + 1}" class="empty">${empty}</td></tr>`) + "</tbody>";
    pager.innerHTML = `<button class="btn" data-go="${page - 1}" ${page <= 1 ? "disabled" : ""}>Précédent</button><span>Page ${r.page} sur ${r.pages} (${r.total} enregistrement${r.total > 1 ? "s" : ""})</span><button class="btn" data-go="${page + 1}" ${page >= r.pages ? "disabled" : ""}>Suivant</button>`;
  } catch (e) {
    if (e.status === 401 || e.status === 403) location.href = "/login";
    grid.innerHTML = "";
    say(e.message, "err");
  }
}

// ---------- create / edit form ----------
async function openEditor(rec) {
  closeDetail();
  editId = rec?.id ?? null;
  const def = TABLES[table];
  const refs = Object.fromEntries(await Promise.all(def.fields.filter(f => f[1] === "ref").map(async f => [f[3], await lookup(f[3])])));
  editor.innerHTML = `<h2>${editId ? def.editText + " n°" + editId : def.newText}</h2>` +
    def.fields.map(([k, type, req, extra]) => {
      const v = rec?.[k] ?? "", r = req ? "required" : "";
      let hint = k === "password" && editId ? " (vide = inchangé)" : "";
      let input;
      if (type === "textarea") input = `<textarea name="${k}" rows="4" ${r}>${esc(v)}</textarea>`;
      else if (type === "select") input = `<select name="${k}">${extra.map(([ov, ot]) => `<option value="${ov}" ${String(v) === ov ? "selected" : ""}>${ot}</option>`).join("")}</select>`;
      else if (type === "ref") {
        const blank = req ? (v === "" ? '<option value="" disabled selected>Choisir...</option>' : "") : "<option value=\"\">- aucun -</option>";
        if (k === "contact_id" && !editId) hint = " (vide = vous)";
        input = `<select name="${k}" ${r}>${blank}${options(extra, refs[extra], v)}</select>`;
      } else input = `<input name="${k}" type="${type}" ${type === "number" ? 'min="1"' : ""} value="${type === "password" ? "" : esc(v)}" ${r}>`;
      return `<label>${esc(label(k))}${hint}${input}</label>`;
    }).join("") + `<div class="actions"><button class="btn solid">Enregistrer</button><button type="button" class="btn" id="cancel">Annuler</button></div>`;
  editor.hidden = false;
  editor.elements[0].focus();
}

editor.addEventListener("submit", async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(editor));
  if (!body.password) delete body.password;
  try {
    await api(editId ? `/${table}/${editId}` : `/${table}`, { method: editId ? "PUT" : "POST", body });
    delete lookups[table]; // a company / person / ad / category changed: refresh the dropdowns
    editor.hidden = true; say(editId ? "Enregistrement mis à jour." : "Enregistrement créé.", "ok"); load();
    if (table === "applications") fillAdFilter();
  } catch (err) { say(err.message, "err"); }
});
editor.addEventListener("click", e => { if (e.target.id === "cancel") editor.hidden = true; });

// ---------- application detail + status ----------
function closeDetail() { detail.hidden = true; viewId = null; }

function renderDetail(a) {
  viewId = a.id;
  detail.innerHTML = `<header><div><h2>${esc(a.ad_title)}</h2>
      <p class="who"><strong>${esc(a.person_name)}</strong> - <a href="mailto:${esc(a.person_email)}">${esc(a.person_email)}</a>${a.person_phone ? " - " + esc(a.person_phone) : ""}<br>
      Envoyée le ${esc(day(a.created_at))} - e-mail de notification ${a.email_sent ? "envoyé" : "non envoyé"}</p></div>${badge(a.status)}</header>
    <blockquote>${esc(a.message)}</blockquote>
    <div class="seg" role="group" aria-label="Changer le statut"><span class="seg-label">Changer le statut :</span>${
      STATUS_OPTIONS.map(([v, t]) => `<button class="btn sm" data-set="${v}" aria-pressed="${v === a.status}">${t}</button>`).join("")}
      <button class="btn sm danger" data-del-detail="${a.id}" style="margin-left:auto">Supprimer</button>
      <button class="btn sm" data-close>Fermer</button></div>`;
  detail.hidden = false;
  detail.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function viewApplication(id) {
  say(""); editor.hidden = true;
  renderDetail(await api("/applications/" + id));
  load(); // highlights the open row
}

async function setStatus(id, value) {
  try {
    const row = await api(`/applications/${id}`, { method: "PATCH", body: { status: value } });
    say(`Candidature n°${id} : statut « ${STATUS_FR[value] || value} ».`, "ok");
    if (viewId === id) renderDetail(await api("/applications/" + id));
    load();
    return row;
  } catch (err) { say(err.message, "err"); load(); }
}

// ---------- events ----------
async function remove(id) {
  if (!confirm(`Supprimer l'enregistrement n°${id} ? Cette action est irréversible.`)) return;
  await api(`/${table}/${id}`, { method: "DELETE" });
  delete lookups[table];
  if (viewId === id) closeDetail();
  say("Enregistrement supprimé.", "ok"); load();
  if (table === "applications") fillAdFilter();
}

grid.addEventListener("click", async e => {
  const ed = e.target.closest("[data-edit]"), del = e.target.closest("[data-del]"), view = e.target.closest("[data-view]"), apps = e.target.closest("[data-apps]");
  try {
    if (ed) { say(""); await openEditor(await api(`/${table}/${ed.dataset.edit}`)); }
    if (del) await remove(+del.dataset.del);
    if (view) await viewApplication(+view.dataset.view);
    if (apps) { // jump to the applications of one advertisement
      appFilter.ad = apps.dataset.apps; appFilter.status = "";
      switchTab("applications");
    }
  } catch (err) { say(err.message, "err"); }
});
grid.addEventListener("change", e => {
  const s = e.target.closest("[data-status]");
  if (s) setStatus(+s.dataset.status, s.value);
});
detail.addEventListener("click", async e => {
  const set = e.target.closest("[data-set]"), del = e.target.closest("[data-del-detail]");
  if (e.target.closest("[data-close]")) { closeDetail(); load(); }
  if (set) await setStatus(viewId, set.dataset.set);
  if (del) { try { await remove(+del.dataset.delDetail); } catch (err) { say(err.message, "err"); } }
});

function switchTab(t) {
  table = t; page = 1; q = ""; $("#aq").value = ""; editor.hidden = true; closeDetail(); say("");
  history.replaceState(null, "", "#" + t);
  tabs(); if (t === "applications") fillAdFilter(); load();
}
$("#tabs").addEventListener("click", e => {
  const t = e.target.closest("[data-t]");
  if (t) { if (t.dataset.t !== "applications") { appFilter.ad = ""; appFilter.status = ""; } switchTab(t.dataset.t); }
});
$("#f-ad").addEventListener("change", e => { appFilter.ad = e.target.value; page = 1; closeDetail(); load(); });
$("#f-status").addEventListener("change", e => { appFilter.status = e.target.value; page = 1; closeDetail(); load(); });
pager.addEventListener("click", e => { const g = e.target.closest("[data-go]"); if (g) { page = +g.dataset.go; load(); } });
$("#asearch").addEventListener("submit", e => { e.preventDefault(); q = $("#aq").value.trim(); page = 1; load(); });
$("#new").addEventListener("click", async () => { say(""); try { await openEditor(null); } catch (err) { say(err.message, "err"); } });

loadNav().then(u => { if (!u || u.role !== "admin") location.href = "/login"; });
const start = location.hash.slice(1);
if (TABLES[start]) table = start;
tabs(); if (table === "applications") fillAdFilter(); load();
