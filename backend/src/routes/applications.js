import { createCrud } from '../lib/crud.js';

// La création passe par POST /ads/:id/applications (voir ads.js),
// donc ici : lecture, modification (statut...) et suppression.
export const applications = createCrud({
  name: 'Application',
  table: 'applications',
  columns: `ap.id, ap.ad_id, a.title AS ad_title, ap.person_id,
            p.first_name, p.last_name, p.email, p.phone,
            ap.message, ap.applied_at, ap.status, ap.email_sent`,
  from: `applications ap
         JOIN ads a ON a.id = ap.ad_id
         JOIN people p ON p.id = ap.person_id`,
  idColumn: 'ap.id',
  fields: ['message', 'status', 'email_sent'],
  filters: { ad_id: 'ap.ad_id', person_id: 'ap.person_id', status: 'ap.status' },
  search: ['p.first_name', 'p.last_name', 'p.email', 'ap.message'],
  orderBy: 'ap.applied_at DESC, ap.id DESC',
  allowCreate: false,
});

export default applications.router;
