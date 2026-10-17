<?php
declare(strict_types=1);

// Une "ressource" = une table exposée par l'API (ads, companies...).
// Elle sait lister (pagination, filtres, recherche), lire, créer, modifier, supprimer.
final class Resource
{
    private array $c;

    public function __construct(array $config)
    {
        // name, table, columns, fields : obligatoires. Le reste a une valeur par défaut.
        $this->c = $config + [
            'listColumns' => $config['columns'],  // colonnes de la liste
            'from' => $config['table'],           // FROM (avec JOIN éventuels)
            'idColumn' => 'id',                   // colonne id dans le SELECT (ex: "a.id")
            'required' => [],                     // champs obligatoires à la création
            'filters' => [],                      // ['param_url' => 'colonne SQL']
            'search' => [],                       // colonnes pour ?q=
            'orderBy' => $config['idColumn'] ?? 'id',
        ];
    }

    public function find(int $id): ?array
    {
        return Db::one(
            "SELECT {$this->c['columns']} FROM {$this->c['from']} WHERE {$this->c['idColumn']} = ?",
            [$id]
        );
    }

    public function mustExist(int $id): array
    {
        return $this->find($id) ?? throw new HttpError(404, "{$this->c['name']} $id not found");
    }

    // $extra permet d'imposer un filtre depuis une route imbriquée (ex: /companies/1/ads)
    public function list(array $query, array $extra = []): array
    {
        ['page' => $page, 'limit' => $limit, 'offset' => $offset] = pagination($query);
        $where = [];
        $params = [];

        foreach ($this->c['filters'] as $param => $column) {
            $value = $extra[$param] ?? ($query[$param] ?? null);
            if ((is_string($value) || is_int($value)) && $value !== '') {
                $where[] = "$column = ?";
                $params[] = $value;
            }
        }
        $q = $query['q'] ?? null;
        if ($this->c['search'] && is_string($q) && $q !== '') {
            $where[] = '(' . implode(' OR ', array_map(fn ($col) => "$col LIKE ?", $this->c['search'])) . ')';
            foreach ($this->c['search'] as $_) {
                $params[] = "%$q%";
            }
        }

        $whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $total = (int) Db::one("SELECT COUNT(*) AS total FROM {$this->c['from']} $whereSql", $params)['total'];
        $rows = Db::all(
            "SELECT {$this->c['listColumns']} FROM {$this->c['from']} $whereSql
             ORDER BY {$this->c['orderBy']} LIMIT ? OFFSET ?",
            [...$params, $limit, $offset]
        );

        return [
            'data' => $rows,
            'pagination' => ['page' => $page, 'limit' => $limit, 'total' => $total, 'pages' => (int) ceil($total / $limit)],
        ];
    }

    public function create(array $body): array
    {
        $data = pick($body, $this->c['fields']);
        $miss = missing($data, $this->c['required']);
        if ($miss) {
            throw new HttpError(400, 'Missing required field(s): ' . implode(', ', $miss));
        }
        $columns = array_keys($data);
        Db::run(
            "INSERT INTO {$this->c['table']} (" . implode(', ', $columns) . ') VALUES ('
            . implode(', ', array_fill(0, count($columns), '?')) . ')',
            array_values($data)
        );
        return $this->find((int) Db::pdo()->lastInsertId());
    }

    // $full = true : PUT (champs obligatoires requis) / false : PATCH (partiel)
    public function update(int $id, array $body, bool $full): array
    {
        $this->mustExist($id);
        $data = pick($body, $this->c['fields']);

        if (!$data) {
            throw new HttpError(400, 'No updatable field provided. Allowed: ' . implode(', ', $this->c['fields']));
        }
        $bad = $full
            ? missing($data, $this->c['required'])
            : array_values(array_filter(
                $this->c['required'],
                fn ($f) => array_key_exists($f, $data) && trim((string) ($data[$f] ?? '')) === ''
            ));
        if ($bad) {
            throw new HttpError(400, 'Missing or empty required field(s): ' . implode(', ', $bad));
        }

        $set = implode(', ', array_map(fn ($col) => "$col = ?", array_keys($data)));
        Db::run("UPDATE {$this->c['table']} SET $set WHERE id = ?", [...array_values($data), $id]);
        return $this->find($id);
    }

    public function delete(int $id): void
    {
        $stmt = Db::run("DELETE FROM {$this->c['table']} WHERE id = ?", [$id]);
        if ($stmt->rowCount() === 0) {
            throw new HttpError(404, "{$this->c['name']} $id not found");
        }
    }
}
