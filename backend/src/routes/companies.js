import express from 'express';
import { createCrud, parseId } from '../lib/crud.js';
import { ads } from './ads.js';

export const companies = createCrud({
  name: 'Company',
  table: 'companies',
  columns: 'id, name, description, website, location, created_at',
  fields: ['name', 'description', 'website', 'location'],
  required: ['name'],
  search: ['name', 'location'],
});

const router = express.Router();

// GET /companies/:id/ads : les annonces publiées par une entreprise
router.get('/:id/ads', async (req, res) => {
  const id = parseId(req.params.id);
  await companies.mustExist(id);
  return ads.list(req, res, { company_id: id });
});

router.use('/', companies.router);

export default router;
