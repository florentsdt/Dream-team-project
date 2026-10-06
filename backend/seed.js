// Remplit la BDD EN PASSANT PAR L'API (demandé par le sujet, Step 04).
// Usage : lance d'abord l'API (npm start), puis dans un autre terminal : npm run seed
const BASE = process.env.API_URL || 'http://localhost:3000';

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${data?.error}`);
  return data;
}

const existing = await api('GET', '/companies?limit=100');
if (existing.pagination.total > 2) {
  console.log('La BDD semble déjà remplie, on ne fait rien.');
  process.exit(0);
}

const catIds = {};
for (const name of ['Data & IA', 'Support', 'Ressources humaines']) {
  catIds[name] = (await api('POST', '/categories', { name })).id;
}

const companyIds = [];
for (const c of [
  { name: 'GreenLoop', description: 'Solutions pour la transition énergétique.', website: 'https://greenloop.example', location: 'Nantes' },
  { name: 'DataForge', description: 'Conseil et ingénierie de la donnée.', website: 'https://dataforge.example', location: 'Toulouse' },
  { name: 'CloudNine', description: 'Hébergement et infrastructure cloud.', website: 'https://cloudnine.example', location: 'Remote' },
]) {
  companyIds.push((await api('POST', '/companies', c)).id);
}

const [green, forge, cloud] = companyIds;
const ads = [
  { title: 'Data Analyst', short_description: 'Analyse et visualisation de données.', full_description: 'Tu construiras des tableaux de bord (SQL, Python) pour accompagner les décisions métier.', salary_min: 36000, salary_max: 44000, location: 'Toulouse', contract_type: 'CDI', company_id: forge, category_id: catIds['Data & IA'] },
  { title: 'Alternance Data Engineer', short_description: 'Alternance de 12 mois sur nos pipelines.', full_description: 'Tu participeras à la mise en place de pipelines de données (Airflow, SQL).', salary_min: 1100, salary_max: 1300, location: 'Toulouse', contract_type: 'apprenticeship', company_id: forge, category_id: catIds['Data & IA'] },
  { title: 'Ingénieur DevOps', short_description: 'Automatise notre infrastructure.', full_description: 'Docker, CI/CD, Terraform : tu garantiras la fiabilité de notre plateforme cloud.', salary_min: 45000, salary_max: 55000, location: 'Remote', contract_type: 'CDI', company_id: cloud, category_id: 1 },
  { title: 'Support Technique N1', short_description: 'Accompagne nos clients au quotidien.', full_description: 'Tu répondras aux tickets clients et documenteras les solutions.', salary_min: 28000, salary_max: 32000, location: 'Remote', contract_type: 'CDD', working_time: 'part_time', company_id: cloud, category_id: catIds['Support'] },
  { title: 'Chargé de recrutement', short_description: 'Recrute les talents de demain.', full_description: 'Tu piloteras le sourcing et les entretiens pour nos équipes techniques.', salary_min: 32000, salary_max: 38000, location: 'Nantes', contract_type: 'CDI', company_id: green, category_id: catIds['Ressources humaines'] },
  { title: 'Stage Marketing Digital', short_description: 'Stage de 6 mois, communication en ligne.', full_description: 'Tu animeras nos réseaux et analyseras les performances de nos campagnes.', salary_min: 1000, salary_max: 1000, location: 'Nantes', contract_type: 'internship', company_id: green, category_id: 3 },
];
for (const ad of ads) await api('POST', '/ads', ad);

console.log(`OK : ${Object.keys(catIds).length} catégories, ${companyIds.length} entreprises, ${ads.length} annonces créées via l'API.`);
