const API_URL = 'http://localhost:3000';

const fakeAds = [
    {
        id: 1,
        title: "Développeur Frontend",
        short_description: "Rejoignez notre équipe pour créer des interfaces modernes.",
        full_description: "Nous recherchons un développeur frontend passionné pour renforcer notre équipe produit. Vous travaillerez sur des interfaces React et Vue au quotidien.",
        wage: "35 000 - 42 000 €/an",
        location: "Paris, France",
        working_time: "Temps plein, 39h/semaine",
    },
    {
        id: 2,
        title: "Chef de projet digital",
        short_description: "Pilotez des projets web de A à Z dans une équipe dynamique.",
        full_description: "En tant que chef de projet digital, vous coordonnerez les équipes design, dev et marketing sur des projets variés pour nos clients.",
        wage: "40 000 - 48 000 €/an",
        location: "Lyon, France",
        working_time: "Temps plein, 35h/semaine",
    },
    {
        id: 3,
        title: "Stage Marketing Digital",
        short_description: "Participez à nos campagnes et à notre stratégie réseaux sociaux.",
        full_description: "Stage de 6 mois au sein de l'équipe marketing. Vous participerez à la création de contenus, au pilotage des campagnes publicitaires et à l'analyse des performances.",
        wage: "1 200 €/mois (gratification légale)",
        location: "Remote",
        working_time: "Temps plein, 35h/semaine",
    },
];

function renderAds(ads) {
    const container = document.getElementById('adsList');
    container.innerHTML = '';

    ads.forEach(function (ad) {
        const col = document.createElement('div');
        col.className = 'col-md-4';
        col.innerHTML = `
            <div class="card h-100 shadow-sm">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">${ad.title}</h5>
                    <p class="card-text flex-grow-1">${ad.short_description}</p>

                    <div class="ad-details d-none mb-3" id="details-${ad.id}">
                        <hr>
                        <p><strong>Description :</strong> ${ad.full_description}</p>
                        <p><strong>Salaire :</strong> ${ad.wage}</p>
                        <p><strong>Lieu :</strong> ${ad.location}</p>
                        <p><strong>Horaires :</strong> ${ad.working_time}</p>
                    </div>

                    <div class="d-flex gap-2 mb-3">
                        <button class="btn btn-outline-primary learn-more-btn" data-id="${ad.id}">
                            En savoir plus
                        </button>
                        <button class="btn btn-success apply-btn" data-id="${ad.id}">
                            Postuler
                        </button>
                    </div>

                    <form class="apply-form d-none" id="apply-form-${ad.id}" data-ad-id="${ad.id}">
                        <div class="mb-2">
                            <input type="text" class="form-control" name="first_name" placeholder="Prénom" required>
                        </div>
                        <div class="mb-2">
                            <input type="text" class="form-control" name="last_name" placeholder="Nom" required>
                        </div>
                        <div class="mb-2">
                            <input type="email" class="form-control" name="email" placeholder="Email" required>
                        </div>
                        <div class="mb-2">
                            <input type="tel" class="form-control" name="phone" placeholder="Téléphone (optionnel)">
                        </div>
                        <div class="mb-2">
                            <textarea class="form-control" name="message" rows="3" placeholder="Votre message" required></textarea>
                        </div>
                        <button type="submit" class="btn btn-primary btn-sm">Envoyer ma candidature</button>
                        <div class="apply-feedback mt-2"></div>
                    </form>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

// Affiche/masque le détail de l'annonce (step03)
document.getElementById('adsList').addEventListener('click', function (event) {
    if (!event.target.classList.contains('learn-more-btn')) {
        return;
    }
    const adId = event.target.dataset.id;
    const detailsBlock = document.getElementById('details-' + adId);
    const isHidden = detailsBlock.classList.contains('d-none');
    detailsBlock.classList.toggle('d-none', !isHidden);
    event.target.textContent = isHidden ? 'Réduire' : 'En savoir plus';
});

// Affiche/masque le formulaire de candidature (step05)
document.getElementById('adsList').addEventListener('click', function (event) {
    if (!event.target.classList.contains('apply-btn')) {
        return;
    }
    const adId = event.target.dataset.id;
    const form = document.getElementById('apply-form-' + adId);
    form.classList.toggle('d-none');
});

// Envoi du formulaire de candidature vers l'API
document.getElementById('adsList').addEventListener('submit', function (event) {
    if (!event.target.classList.contains('apply-form')) {
        return;
    }
    event.preventDefault();

    const form = event.target;
    const adId = form.dataset.adId;
    const feedback = form.querySelector('.apply-feedback');

    const payload = {
        first_name: form.first_name.value,
        last_name: form.last_name.value,
        email: form.email.value,
        message: form.message.value,
    };
    if (form.phone.value) {
        payload.phone = form.phone.value;
    }

    feedback.textContent = 'Envoi en cours...';
    feedback.className = 'apply-feedback mt-2 text-muted';

    fetch(`${API_URL}/ads/${adId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(function (response) {
            return response.json().then(function (data) {
                return { ok: response.ok, data: data };
            });
        })
        .then(function (result) {
            if (!result.ok) {
                feedback.textContent = result.data.error || 'Une erreur est survenue.';
                feedback.className = 'apply-feedback mt-2 text-danger';
                return;
            }
            feedback.textContent = 'Candidature envoyée avec succès !';
            feedback.className = 'apply-feedback mt-2 text-success';
            form.reset();
        })
        .catch(function () {
            feedback.textContent = 'Impossible de contacter le serveur.';
            feedback.className = 'apply-feedback mt-2 text-danger';
        });
});

renderAds(fakeAds);