<?php
declare(strict_types=1);

// Erreur avec un code HTTP : on la lance, index.php la transforme en réponse JSON
final class HttpError extends Exception
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}

// ---------- configuration (.env) ----------

function env(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function load_env(string $file): void
{
    if (!is_file($file)) {
        return;
    }
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        if (getenv($key) === false) {
            putenv($key . '=' . trim($value, " \t\"'"));
        }
    }
}

// ---------- lecture de la requête ----------

function parse_id(mixed $value): int
{
    if (is_int($value) && $value >= 1) {
        return $value;
    }
    if (is_string($value) && preg_match('/^[1-9][0-9]*$/', $value)) {
        return (int) $value;
    }
    throw new HttpError(400, 'Invalid id');
}

function request_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new HttpError(400, 'Invalid JSON body');
    }
    if (!is_object($data)) {
        throw new HttpError(400, 'Request body must be a JSON object');
    }
    return get_object_vars($data);
}

// Ne garde que les champs autorisés (évite qu'on envoie "id" par erreur)
function pick(array $body, array $fields): array
{
    $out = [];
    foreach ($fields as $field) {
        if (!array_key_exists($field, $body)) {
            continue;
        }
        if (is_array($body[$field]) || is_object($body[$field])) {
            throw new HttpError(400, "Field $field must be a simple value");
        }
        $out[$field] = $body[$field];
    }
    return $out;
}

function missing(array $data, array $required): array
{
    return array_values(array_filter(
        $required,
        fn ($f) => !array_key_exists($f, $data) || $data[$f] === null || trim((string) $data[$f]) === ''
    ));
}

function pagination(array $query): array
{
    $page = max(1, is_scalar($query['page'] ?? null) ? (int) $query['page'] : 1);
    $limit = is_scalar($query['limit'] ?? null) ? ((int) $query['limit'] ?: 10) : 10;
    $limit = min(100, max(1, $limit));
    return ['page' => $page, 'limit' => $limit, 'offset' => ($page - 1) * $limit];
}

// ---------- réponses ----------

function respond(mixed $body, int $status = 200, array $headers = []): array
{
    return ['status' => $status, 'body' => $body, 'headers' => $headers];
}

// Erreurs MySQL -> codes HTTP propres (au lieu d'un 500 générique)
function mysql_error_to_http(PDOException $e): ?array
{
    return match ($e->errorInfo[1] ?? null) {
        1062 => [409, 'This value already exists (duplicate entry)'],
        1452 => [400, 'A referenced id does not exist (company_id, category_id...)'],
        1451 => [409, 'Cannot delete: other records still depend on this one'],
        1048 => [400, 'A required field is null'],
        1406 => [400, 'A value is too long'],
        1264 => [400, 'A numeric value is out of range'],
        1265, 1292, 1366 => [400, 'Invalid value for a field (check enum values)'],
        default => null,
    };
}
