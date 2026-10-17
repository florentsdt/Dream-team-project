<?php
// Remplit la BDD EN PASSANT PAR L'API (demandé par le sujet, Step 04).
// Usage : lance d'abord l'API (php -S ...), puis dans un autre terminal : php seed.php
declare(strict_types=1);

$base = getenv('API_URL') ?: 'http://localhost:3000';

if (!function_exists('curl_init')) {
    fwrite(STDERR, "L'extension PHP curl est nécessaire pour le seed.\n");
    exit(1);
}

function api(string $method, string $path, ?array $body = null): array
{
    global $base;
    $ch = curl_init($base . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 10,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    $raw = curl_exec($ch);
    if ($raw === false) {
        fwrite(STDERR, "Impossible de joindre l'API ($base). Est-elle lancée ?\n");
        exit(1);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

    $data = $raw === '' ? [] : (json_decode($raw, true) ?? []);
    if ($status >= 400) {
        fwrite(STDERR, "$method $path -> $status " . ($data['error'] ?? '') . "\n");
        exit(1);
    }
    return $data;
}

$existing = api('GET', '/companies?limit=100');
if ($existing['pagination']['total'] > 2) {
    echo "La BDD semble déjà remplie, on ne fait rien.\n";
    exit(0);
}

$cat = [];
foreach (['Data & IA', 'Support', 'Ressources humaines'] as $name) {
    $cat[$name] = api('POST', '/categories', ['name' => $name])['id'];
}

$companyIds = [];
foreach ([
    ['name' => 'GreenLoop', 'description' => 'Solutions pour la transition énergétique.', 'website' => 'https://greenloop.example', 'location' => 'Nantes'],
    ['name' => 'DataForge', 'description' => 'Conseil et ingénierie de la donnée.', 'website' => 'https://dataforge.example', 'location' => 'Toulouse'],
    ['name' => 'CloudNine', 'description' => 'Hébergement et infrastructure cloud.', 'website' => 'https://cloudnine.example', 'location' => 'Remote'],
] as $company) {
    $companyIds[] = api('POST', '/companies', $company)['id'];
}
[$green, $forge, $cloud] = $companyIds;

$ads = [
    ['title' => 'Data Analyst', 'short_description' => 'Analyse et visualisation de données.', 'full_description' => 'Tu construiras des tableaux de bord (SQL, Python) pour accompagner les décisions métier.', 'salary_min' => 36000, 'salary_max' => 44000, 'location' => 'Toulouse', 'contract_type' => 'CDI', 'company_id' => $forge, 'category_id' => $cat['Data & IA']],
    ['title' => 'Alternance Data Engineer', 'short_description' => 'Alternance de 12 mois sur nos pipelines.', 'full_description' => 'Tu participeras à la mise en place de pipelines de données (Airflow, SQL).', 'salary_min' => 1100, 'salary_max' => 1300, 'location' => 'Toulouse', 'contract_type' => 'apprenticeship', 'company_id' => $forge, 'category_id' => $cat['Data & IA']],
    ['title' => 'Ingénieur DevOps', 'short_description' => 'Automatise notre infrastructure.', 'full_description' => 'Docker, CI/CD, Terraform : tu garantiras la fiabilité de notre plateforme cloud.', 'salary_min' => 45000, 'salary_max' => 55000, 'location' => 'Remote', 'contract_type' => 'CDI', 'company_id' => $cloud, 'category_id' => 1],
    ['title' => 'Support Technique N1', 'short_description' => 'Accompagne nos clients au quotidien.', 'full_description' => 'Tu répondras aux tickets clients et documenteras les solutions.', 'salary_min' => 28000, 'salary_max' => 32000, 'location' => 'Remote', 'contract_type' => 'CDD', 'working_time' => 'part_time', 'company_id' => $cloud, 'category_id' => $cat['Support']],
    ['title' => 'Chargé de recrutement', 'short_description' => 'Recrute les talents de demain.', 'full_description' => 'Tu piloteras le sourcing et les entretiens pour nos équipes techniques.', 'salary_min' => 32000, 'salary_max' => 38000, 'location' => 'Nantes', 'contract_type' => 'CDI', 'company_id' => $green, 'category_id' => $cat['Ressources humaines']],
    ['title' => 'Stage Marketing Digital', 'short_description' => 'Stage de 6 mois, communication en ligne.', 'full_description' => 'Tu animeras nos réseaux et analyseras les performances de nos campagnes.', 'salary_min' => 1000, 'salary_max' => 1000, 'location' => 'Nantes', 'contract_type' => 'internship', 'company_id' => $green, 'category_id' => 3],
];
foreach ($ads as $ad) {
    api('POST', '/ads', $ad);
}

echo 'OK : ' . count($cat) . ' catégories, ' . count($companyIds) . ' entreprises, ' . count($ads) . " annonces créées via l'API.\n";
