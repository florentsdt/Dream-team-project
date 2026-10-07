<?php
declare(strict_types=1);

// Point d'entrée unique : toutes les requêtes passent par ici.
ini_set('display_errors', '0'); // les erreurs vont dans le log, jamais dans le JSON

require_once __DIR__ . '/../src/helpers.php';
require_once __DIR__ . '/../src/Db.php';
require_once __DIR__ . '/../src/Resource.php';
require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/../src/routes.php';

load_env(__DIR__ . '/../.env');

// CORS : autorise le front (autre port / autre origine) à appeler l'API
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { // "preflight" envoyé par le navigateur avant un POST JSON
    http_response_code(204);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if ($path !== '/') {
    $path = rtrim($path, '/');
}

try {
    $response = $path === '/'
        ? respond(['name' => 'DT Job API', 'status' => 'ok'])
        : build_router()->dispatch($method, $path);
} catch (HttpError $e) {
    $response = respond(['error' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    $mapped = mysql_error_to_http($e);
    if ($mapped) {
        $response = respond(['error' => $mapped[1]], $mapped[0]);
    } else {
        error_log((string) $e);
        $response = respond(['error' => 'Internal server error'], 500);
    }
} catch (Throwable $e) {
    error_log((string) $e);
    $response = respond(['error' => 'Internal server error'], 500);
}

http_response_code($response['status']);
header('Content-Type: application/json; charset=utf-8');
foreach ($response['headers'] as $name => $value) {
    header("$name: $value");
}
if ($response['status'] !== 204) {
    echo json_encode(
        $response['body'],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
    );
}
