// Erreur avec un code HTTP : on la lance, le handler la transforme en réponse JSON
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Erreurs MySQL -> codes HTTP propres (au lieu d'un 500 générique)
const MYSQL_ERRORS = {
  ER_DUP_ENTRY: [409, 'This value already exists (duplicate entry)'],
  ER_NO_REFERENCED_ROW_2: [400, 'A referenced id does not exist (company_id, category_id...)'],
  ER_ROW_IS_REFERENCED_2: [409, 'Cannot delete: other records still depend on this one'],
  ER_BAD_NULL_ERROR: [400, 'A required field is null'],
  ER_DATA_TOO_LONG: [400, 'A value is too long'],
  WARN_DATA_TRUNCATED: [400, 'Invalid value for a field (check enum values)'],
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: [400, 'Invalid value for a field'],
  ER_WRONG_VALUE_FOR_FIELD: [400, 'Invalid value for a field'],
};

export function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const mapped = MYSQL_ERRORS[err.code];
  if (mapped) {
    return res.status(mapped[0]).json({ error: mapped[1] });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
