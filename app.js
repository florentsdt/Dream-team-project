
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

                    <button class="btn btn-outline-primary learn-more-btn" data-id="${ad.id}">
                        En savoir plus
                    </button>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

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

renderAds(fakeAds);