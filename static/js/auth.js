// Step 06 (+ 08 feedback): login, register and account pages.
(async () => {
  const form = $("form[data-mode]"), mode = form.dataset.mode, msg = $(".msg", form), btn = $("button", form);
  await loadNav();
  if (mode === "account") {
    if (!me) return (location.href = "/login");
    for (const k of ["first_name", "last_name", "email", "phone"]) form.elements[k].value = me[k] ?? "";
    showMyApplications();
  } else if (me) {
    return (location.href = me.role === "admin" ? "/admin" : "/");
  }

  async function showMyApplications() {
    const box = $("#mine");
    try {
      const { items } = await api("/auth/me/applications");
      box.innerHTML = items.length
        ? `<ul>${items.map(a => `<li><div><strong>${esc(a.ad_title)}</strong><small>${esc(a.company_name)} - envoyée le ${esc(day(a.created_at))}</small></div>${badge(a.status)}</li>`).join("")}</ul>`
        : '<p class="hint">Vous n\'avez pas encore postulé. <a href="/">Voir les offres</a>.</p>';
    } catch (e) { box.innerHTML = `<p class="notice err" role="alert">${esc(e.message)}</p>`; }
  }

  const labels = { login: ["Se connecter", "Connexion..."], register: ["Créer mon compte", "Création du compte..."], account: ["Enregistrer", "Enregistrement..."] };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    msg.className = "msg"; msg.textContent = "";
    if (mode !== "login" && form.elements.password.value && form.elements.password.value.length < 8) {
      msg.textContent = "Le mot de passe doit contenir au moins 8 caractères."; msg.className = "msg err"; return;
    }
    const data = Object.fromEntries(new FormData(form));
    btn.disabled = true; btn.textContent = labels[mode][1];
    try {
      if (mode === "account") {
        await api("/auth/me", { method: "PUT", body: data });
        msg.textContent = "Modifications enregistrées."; msg.className = "msg ok"; form.elements.password.value = "";
        await loadNav();
      } else {
        const u = await api("/auth/" + mode, { method: "POST", body: data });
        location.href = u.role === "admin" ? "/admin" : "/"; // admins land on the database page
        return;
      }
    } catch (err) { msg.textContent = err.message; msg.className = "msg err"; }
    btn.disabled = false; btn.textContent = labels[mode][0];
  });
})();
