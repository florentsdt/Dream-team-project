const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- French wording ----------
// The database keeps English values (CHECK constraints); only what is displayed is translated.
const CONTRACT_FR = { Internship: "Stage", Apprenticeship: "Alternance", "Full-time": "Temps plein", "Part-time": "Temps partiel", Freelance: "Freelance" };
const STATUS_FR = { pending: "En attente", reviewed: "Examinée", accepted: "Acceptée", rejected: "Refusée" };
const ROLE_FR = { user: "Utilisateur", admin: "Administrateur" };
const LABELS = {
  id: "Id", title: "Titre", short_description: "Description courte", full_description: "Description complète", wage: "Salaire",
  location: "Lieu", working_time: "Temps de travail", duration_months: "Durée (mois)", contract_type: "Type de contrat", company_id: "Entreprise",
  category_id: "Catégorie", contact_id: "Contact", company_name: "Entreprise", category_name: "Catégorie", name: "Nom",
  website: "Site web", description: "Description", ads_count: "Nb d'offres", first_name: "Prénom", last_name: "Nom",
  email: "E-mail", phone: "Téléphone", role: "Rôle", has_account: "Compte", password: "Mot de passe",
  advertisement_id: "Offre", person_id: "Personne", message: "Message", status: "Statut", email_sent: "E-mail envoyé",
  advertisement: "Offre", applicant: "Candidat", sent: "Envoyée le",
};
const ERR_FR = {
  "This record already exists (duplicate value).": "Cet enregistrement existe déjà (valeur en double).",
  "Cannot delete: other records still use it (e.g. a category that still has offers).": "Suppression impossible : d'autres enregistrements l'utilisent encore (par exemple une catégorie qui a encore des offres).",
  "Unknown reference: the company, contact, category, advertisement or person does not exist.": "Référence inconnue : l'entreprise, le contact, la catégorie, l'offre ou la personne n'existe pas.",
  "A required field cannot be empty.": "Un champ obligatoire ne peut pas être vide.",
  "Invalid value for a restricted field (contract_type, status, role or email_sent).": "Valeur invalide pour un champ restreint (type de contrat, statut, rôle ou e-mail envoyé).",
  "Unknown resource.": "Ressource inconnue.",
  "Expected a JSON object body.": "Un corps JSON est attendu.",
  "Please log in.": "Veuillez vous connecter.",
  "Administrators only.": "Réservé aux administrateurs.",
  "Password must be at least 8 characters.": "Le mot de passe doit contenir au moins 8 caractères.",
  "Company not found.": "Entreprise introuvable.",
  "Not found.": "Introuvable.",
  "You cannot remove your own admin role.": "Vous ne pouvez pas retirer votre propre rôle d'administrateur.",
  "Nothing to update.": "Rien à mettre à jour.",
  "You cannot delete your own account.": "Vous ne pouvez pas supprimer votre propre compte.",
  "This offer no longer exists.": "Cette offre n'existe plus.",
  "Please write a message to the recruiter.": "Veuillez écrire un message au recruteur.",
  "First name, last name and a valid email are required.": "Le prénom, le nom et un e-mail valide sont obligatoires.",
  "You already applied to this offer.": "Vous avez déjà postulé à cette offre.",
  "An account with this email already exists.": "Un compte existe déjà avec cet e-mail.",
  "Wrong email or password.": "E-mail ou mot de passe incorrect.",
  "Not logged in.": "Vous n'êtes pas connecté.",
  "Duration must be a whole number of months.": "La durée doit être un nombre entier de mois.",
};
function errFr(m) {
  m = String(m ?? "");
  if (ERR_FR[m]) return ERR_FR[m];
  let x;
  if ((x = /^Missing required field\(s\): (.+)$/.exec(m))) return "Champ(s) obligatoire(s) manquant(s) : " + x[1].split(", ").map(k => (LABELS[k] || k).toLowerCase()).join(", ");
  if ((x = /^Invalid value: (.+)$/.exec(m))) return "Valeur invalide : " + x[1];
  if ((x = /^(\w+) cannot be empty\.$/.exec(m))) return "Le champ « " + (LABELS[x[1]] || x[1]).toLowerCase() + " » ne peut pas être vide.";
  return m;
}

// Thin fetch wrapper around the REST API: api("/advertisements/3"), api("/x", {method:"POST", body:{...}})
// Throws an Error carrying .status; messages are translated to French; network failures get a readable message.
async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch("/api" + path, {
      credentials: "same-origin",
      method: opts.method || "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : {},
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Impossible de joindre le serveur. Vérifiez qu'il est bien lancé, puis réessayez."), { status: 0 });
  }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(errFr(data?.error || res.statusText)), { status: res.status });
  return data;
}

// Every row of a paginated list endpoint (the API caps per_page at 100).
async function fetchAll(path) {
  const sep = path.includes("?") ? "&" : "?", out = [];
  for (let page = 1; ; page++) {
    const r = await api(`${path}${sep}per_page=100&page=${page}`);
    out.push(...r.items);
    if (page >= r.pages) return out;
  }
}

const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const badge = s => `<span class="badge" data-s="${esc(s)}">${esc(STATUS_FR[s] || s)}</span>`;
const day = s => { const d = String(s || "").slice(0, 10).split("-"); return d.length === 3 ? d.reverse().join("/") : ""; };

let me = null; // current user or null
async function loadNav() {
  try { me = await api("/auth/me"); } catch { me = null; }
  const nav = $("#nav");
  nav.innerHTML = me
    ? `<span class="hello">${esc(me.first_name)}</span>${me.role === "admin" ? '<a href="/admin">Administration</a>' : ""}<a href="/account">Mon compte</a><button class="link" id="logout">Se déconnecter</button>`
    : '<a href="/login">Se connecter</a><a class="pill" href="/register">Créer un compte</a>';
  $("#logout")?.addEventListener("click", async () => { await api("/auth/logout", { method: "POST" }); location.href = "/"; });
  return me;
}
