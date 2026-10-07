<?php
declare(strict_types=1);

// Déclare les 5 routes CRUD standard d'une ressource
function register_crud(Router $r, string $base, Resource $res, bool $allowCreate = true): void
{
    $r->add('GET', $base, fn () => respond($res->list($_GET)));
    $r->add('GET', "$base/{id}", fn ($p) => respond($res->mustExist(parse_id($p['id']))));

    if ($allowCreate) {
        $r->add('POST', $base, function () use ($res, $base) {
            $row = $res->create(request_body());
            return respond($row, 201, ['Location' => "$base/{$row['id']}"]);
        });
    }

    $r->add('PUT', "$base/{id}", fn ($p) => respond($res->update(parse_id($p['id']), request_body(), true)));
    $r->add('PATCH', "$base/{id}", fn ($p) => respond($res->update(parse_id($p['id']), request_body(), false)));
    $r->add('DELETE', "$base/{id}", function ($p) use ($res) {
        $res->delete(parse_id($p['id']));
        return respond(null, 204);
    });
}

// POST /ads/:id/applications : postuler à une annonce
// Corps possible :
//   { "person_id": 1, "message": "..." }                                (utilisateur connu)
//   { "first_name", "last_name", "email", "phone"?, "message": "..." }  (invité)
function apply_to_ad(int $adId, Resource $applications): array
{
    $body = pick(request_body(), ['person_id', 'first_name', 'last_name', 'email', 'phone', 'message']);

    $ad = Db::one('SELECT id, is_active FROM ads WHERE id = ?', [$adId]);
    if (!$ad) {
        throw new HttpError(404, "Ad $adId not found");
    }
    if (!$ad['is_active']) {
        throw new HttpError(409, 'This ad is no longer active');
    }

    $miss = missing($body, ['message']);
    if ($miss) {
        throw new HttpError(400, 'Missing required field(s): ' . implode(', ', $miss));
    }

    if (array_key_exists('person_id', $body)) {
        $personId = parse_id($body['person_id']);
        if (!Db::one('SELECT id FROM people WHERE id = ?', [$personId])) {
            throw new HttpError(400, "person_id $personId does not exist");
        }
    } else {
        $missPerson = missing($body, ['first_name', 'last_name', 'email']);
        if ($missPerson) {
            throw new HttpError(400, 'Provide person_id, or: ' . implode(', ', $missPerson));
        }
        $email = trim((string) $body['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(400, 'Invalid email');
        }

        // Si la personne existe déjà (même email) on la réutilise, sinon on la crée
        $existing = Db::one('SELECT id FROM people WHERE email = ?', [$email]);
        if ($existing) {
            $personId = (int) $existing['id'];
        } else {
            Db::run(
                'INSERT INTO people (first_name, last_name, email, phone, role) VALUES (?, ?, ?, ?, ?)',
                [$body['first_name'], $body['last_name'], $email, $body['phone'] ?? null, 'candidate']
            );
            $personId = (int) Db::pdo()->lastInsertId();
        }
    }

    try {
        Db::run(
            'INSERT INTO applications (ad_id, person_id, message) VALUES (?, ?, ?)',
            [$adId, $personId, $body['message']]
        );
    } catch (PDOException $e) {
        if (($e->errorInfo[1] ?? null) === 1062) {
            throw new HttpError(409, 'This person has already applied to this ad');
        }
        throw $e;
    }

    $id = (int) Db::pdo()->lastInsertId();
    return respond($applications->find($id), 201, ['Location' => "/applications/$id"]);
}

function build_router(): Router
{
    $r = new Router();

    $categories = new Resource([
        'name' => 'Category',
        'table' => 'categories',
        'columns' => 'id, name',
        'fields' => ['name'],
        'required' => ['name'],
        'search' => ['name'],
    ]);

    $companies = new Resource([
        'name' => 'Company',
        'table' => 'companies',
        'columns' => 'id, name, description, website, location, created_at',
        'fields' => ['name', 'description', 'website', 'location'],
        'required' => ['name'],
        'search' => ['name', 'location'],
    ]);

    // TODO Step 06/07 : ces routes devront être réservées à l'admin.
    // Le mot de passe (password_hash) n'est jamais renvoyé ni modifiable ici :
    // il sera géré uniquement par les routes d'authentification.
    $people = new Resource([
        'name' => 'Person',
        'table' => 'people',
        'columns' => 'id, first_name, last_name, email, phone, role, created_at',
        'fields' => ['first_name', 'last_name', 'email', 'phone', 'role'],
        'required' => ['first_name', 'last_name', 'email'],
        'filters' => ['role' => 'role', 'email' => 'email'],
        'search' => ['first_name', 'last_name', 'email'],
    ]);

    $ads = new Resource([
        'name' => 'Ad',
        'table' => 'ads',
        'columns' => 'a.id, a.title, a.short_description, a.full_description,
                      a.salary_min, a.salary_max, a.location, a.contract_type, a.working_time,
                      a.is_active, a.created_at,
                      a.company_id, c.name AS company_name,
                      a.category_id, cat.name AS category_name,
                      a.contact_person_id',
        // La liste n'envoie pas la description complète (c'est le rôle du bouton "en savoir plus")
        'listColumns' => 'a.id, a.title, a.short_description,
                          a.salary_min, a.salary_max, a.location, a.contract_type, a.working_time,
                          a.is_active, a.created_at,
                          a.company_id, c.name AS company_name,
                          a.category_id, cat.name AS category_name',
        'from' => 'ads a
                   JOIN companies c ON c.id = a.company_id
                   JOIN categories cat ON cat.id = a.category_id',
        'idColumn' => 'a.id',
        'fields' => [
            'title', 'short_description', 'full_description', 'salary_min', 'salary_max',
            'location', 'contract_type', 'working_time', 'is_active',
            'company_id', 'category_id', 'contact_person_id',
        ],
        'required' => ['title', 'short_description', 'full_description', 'contract_type', 'company_id', 'category_id'],
        'filters' => [
            'company_id' => 'a.company_id',
            'category_id' => 'a.category_id',
            'contract_type' => 'a.contract_type',
            'working_time' => 'a.working_time',
            'is_active' => 'a.is_active',
        ],
        'search' => ['a.title', 'a.short_description', 'a.location', 'c.name'],
        'orderBy' => 'a.id DESC',
    ]);

    // La création passe par POST /ads/:id/applications ; ici : lecture, modification, suppression.
    $applications = new Resource([
        'name' => 'Application',
        'table' => 'applications',
        'columns' => 'ap.id, ap.ad_id, a.title AS ad_title, ap.person_id,
                      p.first_name, p.last_name, p.email, p.phone,
                      ap.message, ap.applied_at, ap.status, ap.email_sent',
        'from' => 'applications ap
                   JOIN ads a ON a.id = ap.ad_id
                   JOIN people p ON p.id = ap.person_id',
        'idColumn' => 'ap.id',
        'fields' => ['message', 'status', 'email_sent'],
        'filters' => ['ad_id' => 'ap.ad_id', 'person_id' => 'ap.person_id', 'status' => 'ap.status'],
        'search' => ['p.first_name', 'p.last_name', 'p.email', 'ap.message'],
        'orderBy' => 'ap.applied_at DESC, ap.id DESC',
    ]);

    // Routes imbriquées
    $r->add('GET', '/companies/{id}/ads', function ($p) use ($companies, $ads) {
        $id = parse_id($p['id']);
        $companies->mustExist($id);
        return respond($ads->list($_GET, ['company_id' => $id]));
    });
    $r->add('GET', '/ads/{id}/applications', function ($p) use ($ads, $applications) {
        $id = parse_id($p['id']);
        $ads->mustExist($id);
        return respond($applications->list($_GET, ['ad_id' => $id]));
    });
    $r->add('POST', '/ads/{id}/applications', fn ($p) => apply_to_ad(parse_id($p['id']), $applications));

    // Routes CRUD standard
    register_crud($r, '/companies', $companies);
    register_crud($r, '/categories', $categories);
    register_crud($r, '/ads', $ads);
    register_crud($r, '/people', $people);
    register_crud($r, '/applications', $applications, allowCreate: false);

    return $r;
}
