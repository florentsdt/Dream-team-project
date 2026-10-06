import { createCrud } from '../lib/crud.js';

export const categories = createCrud({
  name: 'Category',
  table: 'categories',
  columns: 'id, name',
  fields: ['name'],
  required: ['name'],
  search: ['name'],
});

export default categories.router;
