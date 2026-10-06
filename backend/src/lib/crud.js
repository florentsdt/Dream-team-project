import express from 'express';
import { pool } from '../db.js';
import { HttpError } from './errors.js';

// ---------- petits helpers ----------

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid id');
  return id;
}

export function getBody(req) {
  const body = req.body ?? {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  return body;
}

// Ne garde que les champs autorisés (évite qu'on envoie "id" ou "role" par erreur)
export function pick(body, fields) {
  const out = {};
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f];
  return out;
}

export function missing(data, required) {
  return required.filter((f) => data[f] === undefined || data[f] === null || String(data[f]).trim() === '');
}

export function getPagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

const isScalar = (v) => typeof v === 'string' || typeof v === 'number';

// ---------- la "fabrique" de routes CRUD ----------
//
//  GET    /        liste paginée  (?page=1&limit=10, filtres, ?q=recherche)
//  GET    /:id     détail
//  POST   /        création       -> 201
//  PUT    /:id     modification complète (champs obligatoires requis)
//  PATCH  /:id     modification partielle
//  DELETE /:id     suppression    -> 204

export function createCrud({
  name,                      // "Ad" -> messages d'erreur
  table,                     // table d'écriture
  columns,                   // colonnes retournées (détail)
  listColumns = columns,     // colonnes retournées (liste)
  from = table,              // FROM (avec JOIN éventuels)
  idColumn = 'id',           // colonne id dans le SELECT (ex: "a.id")
  fields,                    // champs modifiables
  required = [],             // champs obligatoires à la création
  filters = {},              // { paramUrl: 'colonne SQL' }
  search = [],               // colonnes pour ?q=
  orderBy = idColumn,
  allowCreate = true,
}) {
  const router = express.Router();

  async function findById(id) {
    const [rows] = await pool.query(`SELECT ${columns} FROM ${from} WHERE ${idColumn} = ?`, [id]);
    return rows[0] ?? null;
  }

  async function mustExist(id) {
    const row = await findById(id);
    if (!row) throw new HttpError(404, `${name} ${id} not found`);
    return row;
  }

  // "extra" permet d'imposer un filtre depuis une route imbriquée (ex: /companies/:id/ads)
  async function list(req, res, extra = {}) {
    const { page, limit, offset } = getPagination(req.query);
    const where = [];
    const params = [];

    for (const [param, column] of Object.entries(filters)) {
      const value = extra[param] ?? req.query[param];
      if (isScalar(value) && value !== '') {
        where.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (search.length && isScalar(req.query.q) && req.query.q !== '') {
      where.push(`(${search.map((c) => `${c} LIKE ?`).join(' OR ')})`);
      params.push(...search.map(() => `%${req.query.q}%`));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${from} ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT ${listColumns} FROM ${from} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  }

  async function update(req, res, full) {
    const id = parseId(req.params.id);
    await mustExist(id);
    const data = pick(getBody(req), fields);

    if (Object.keys(data).length === 0) {
      throw new HttpError(400, `No updatable field provided. Allowed: ${fields.join(', ')}`);
    }
    const bad = full
      ? missing(data, required)
      : required.filter((f) => f in data && String(data[f] ?? '').trim() === '');
    if (bad.length) throw new HttpError(400, `Missing or empty required field(s): ${bad.join(', ')}`);

    await pool.query(`UPDATE ${table} SET ? WHERE id = ?`, [data, id]);
    res.json(await findById(id));
  }

  router.get('/', (req, res) => list(req, res));

  router.get('/:id', async (req, res) => {
    res.json(await mustExist(parseId(req.params.id)));
  });

  if (allowCreate) {
    router.post('/', async (req, res) => {
      const data = pick(getBody(req), fields);
      const miss = missing(data, required);
      if (miss.length) throw new HttpError(400, `Missing required field(s): ${miss.join(', ')}`);
      const [result] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);
      res.status(201).location(`${req.baseUrl}/${result.insertId}`).json(await findById(result.insertId));
    });
  }

  router.put('/:id', (req, res) => update(req, res, true));
  router.patch('/:id', (req, res) => update(req, res, false));

  router.delete('/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (!result.affectedRows) throw new HttpError(404, `${name} ${id} not found`);
    res.status(204).end();
  });

  return { router, list, findById, mustExist };
}
