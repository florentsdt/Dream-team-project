import { createCrud } from '../lib/crud.js';

// TODO Step 06/07 : ces routes devront être réservées à l'admin.
// Le mot de passe (password_hash) n'est jamais renvoyé ni modifiable ici :
// il sera géré uniquement par les routes d'authentification.
export const people = createCrud({
  name: 'Person',
  table: 'people',
  columns: 'id, first_name, last_name, email, phone, role, created_at',
  fields: ['first_name', 'last_name', 'email', 'phone', 'role'],
  required: ['first_name', 'last_name', 'email'],
  filters: { role: 'role', email: 'email' },
  search: ['first_name', 'last_name', 'email'],
});

export default people.router;
