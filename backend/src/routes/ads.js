import express from 'express';
import { pool } from '../db.js';
import { createCrud, parseId, getBody, missing } from '../lib/crud.js';
import { HttpError } from '../lib/errors.js';
import { applications } from './applications.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ads = createCrud({
  name: 'Ad',
  table: 'ads',
  columns: `a.id, a.title, a.short_description, a.full_description,
            a.salary_min, a.salary_max, a.location, a.contract_type, a.working_time,
            a.is_active, a.created_at,
            a.company_id, c.name AS company_name,
            a.category_id, cat.name AS category_name,
            a.contact_person_id`,
  // La liste n'envoie pas la description complète (c'est le rôle du bouton "en savoir plus")
  listColumns: `a.id, a.title, a.short_description,
                a.salary_min, a.salary_max, a.location, a.contract_type, a.working_time,
                a.is_active, a.created_at,
                a.company_id, c.name AS company_name,
                a.category_id, cat.name AS category_name`,
  from: `ads a
         JOIN companies c ON c.id = a.company_id
         JOIN categories cat ON cat.id = a.category_id`,
  idColumn: 'a.id',
  fields: [
    'title', 'short_description', 'full_description', 'salary_min', 'salary_max',
    'location', 'contract_type', 'working_time', 'is_active',
    'company_id', 'category_id', 'contact_person_id',
  ],
  required: ['title', 'short_description', 'full_description', 'contract_type', 'company_id', 'category_id'],
  filters: {
    company_id: 'a.company_id',
    category_id: 'a.category_id',
    contract_type: 'a.contract_type',
    working_time: 'a.working_time',
    is_active: 'a.is_active',
  },
  search: ['a.title', 'a.short_description', 'a.location', 'c.name'],
  orderBy: 'a.id DESC',
});

const router = express.Router();

// GET /ads/:id/applications : les candidatures reçues par une annonce
router.get('/:id/applications', async (req, res) => {
  const id = parseId(req.params.id);
  await ads.mustExist(id);
  return applications.list(req, res, { ad_id: id });
});

// POST /ads/:id/applications : postuler à une annonce
// Corps possible :
//   { "person_id": 1, "message": "..." }                                   (utilisateur connu)
//   { "first_name", "last_name", "email", "phone"?, "message": "..." }     (invité)
router.post('/:id/applications', async (req, res) => {
  const adId = parseId(req.params.id);
  const body = getBody(req);

  const [[ad]] = await pool.query('SELECT id, is_active FROM ads WHERE id = ?', [adId]);
  if (!ad) throw new HttpError(404, `Ad ${adId} not found`);
  if (!ad.is_active) throw new HttpError(409, 'This ad is no longer active');

  const miss = missing(body, ['message']);
  if (miss.length) throw new HttpError(400, `Missing required field(s): ${miss.join(', ')}`);

  let personId;
  if (body.person_id !== undefined) {
    personId = parseId(body.person_id);
    const [rows] = await pool.query('SELECT id FROM people WHERE id = ?', [personId]);
    if (!rows.length) throw new HttpError(400, `person_id ${personId} does not exist`);
  } else {
    const missPerson = missing(body, ['first_name', 'last_name', 'email']);
    if (missPerson.length) {
      throw new HttpError(400, `Provide person_id, or: ${missPerson.join(', ')}`);
    }
    const email = String(body.email).trim();
    if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Invalid email');

    // Si la personne existe déjà (même email) on la réutilise, sinon on la crée
    const [rows] = await pool.query('SELECT id FROM people WHERE email = ?', [email]);
    if (rows.length) {
      personId = rows[0].id;
    } else {
      const [created] = await pool.query('INSERT INTO people SET ?', [{
        first_name: body.first_name,
        last_name: body.last_name,
        email,
        phone: body.phone ?? null,
        role: 'candidate',
      }]);
      personId = created.insertId;
    }
  }

  let applicationId;
  try {
    const [result] = await pool.query(
      'INSERT INTO applications (ad_id, person_id, message) VALUES (?, ?, ?)',
      [adId, personId, body.message],
    );
    applicationId = result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'This person has already applied to this ad');
    }
    throw err;
  }

  res.status(201).location(`/applications/${applicationId}`).json(await applications.findById(applicationId));
});

router.use('/', ads.router);

export default router;
