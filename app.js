
const fakeAds = [
    {
        id: 1,
        title: "Développeur Frontend",
        short_description: "Rejoignez notre équipe pour créer des interfaces modernes.",
    },
    {
        id: 2,
        title: "Chef de projet digital",
        short_description: "Pilotez des projets web de A à Z dans une équipe dynamique.",
    },
    {
        id: 3,
        title: "Stage Marketing Digital",
        short_description: "Participez à nos campagnes et à notre stratégie réseaux sociaux.",
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
                    <button class="btn btn-outline-primary learn-more-btn" data-id="${ad.id}">
                        En savoir plus
                    </button>
                </div>
            </div>
        `;
        container.appendChild(col);
    });
}

renderAds(fakeAds);