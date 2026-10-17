-- Step 01 - hand-written inserts and the 3 required queries.
-- Run it on a throw-away database so it never mixes with real data:
--     python run_sql.py queries.sql demo.db
-- (run_sql.py applies schema.sql first, then executes this file and prints the result of each SELECT.
--  With the sqlite3 command-line tool: sqlite3 demo.db < schema.sql && sqlite3 -header -column demo.db < queries.sql)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------- inserts made by hand
INSERT INTO categories (name) VALUES ('Development'), ('Data & AI'), ('Security');

INSERT INTO companies (name, website, location, description) VALUES
  ('Nimbus Cloud',  'https://example.com/nimbus', 'Paris', 'Cloud infrastructure for European start-ups.'),
  ('Orbit Bank',    'https://example.com/orbit',  'Lille', 'Neo-bank with 2M customers.'),
  ('Lumen Health',  'https://example.com/lumen',  'Bordeaux', 'Medical imaging software.'),
  ('Pixel Forge',   'https://example.com/pixel',  'Lyon',     'Indie game studio, no open position yet.');  -- shows 0 in query 1

-- recruiters and applicants are all rows of `people` (password_hash stays NULL: no site account)
INSERT INTO people (first_name, last_name, email, phone) VALUES
  ('Camille', 'Durand', 'camille.durand@example.com', '+33 1 00 00 00 01'),   -- recruiter
  ('Alice',   'Moreau', 'alice.moreau@example.com',  '06 00 00 00 03'),        -- applicant
  ('Karim',   'Benali', 'karim.benali@example.com',  NULL);                    -- applicant

-- ids are looked up by name instead of being typed by hand
INSERT INTO advertisements (title, short_description, full_description, wage, location, working_time, contract_type, company_id, contact_id, category_id)
VALUES
  ('Backend Developer Intern (Python)', 'Join the API team.', 'Flask/PostgreSQL services, tests and code reviews.', 'EUR 1,300 / month', 'Paris', 'Full-time, 6 months', 'Internship',
     (SELECT id FROM companies  WHERE name  = 'Nimbus Cloud'),
     (SELECT id FROM people     WHERE email = 'camille.durand@example.com'),
     (SELECT id FROM categories WHERE name  = 'Development')),
  ('DevOps Apprentice', 'Automate deployments with a friendly platform team.', NULL, 'EUR 1,500 / month', 'Paris', '35h / week, 24 months', 'Apprenticeship',
     (SELECT id FROM companies  WHERE name  = 'Nimbus Cloud'),
     (SELECT id FROM people     WHERE email = 'camille.durand@example.com'),
     (SELECT id FROM categories WHERE name  = 'Development')),
  ('Security Engineer Intern', 'Test our mobile app like an attacker would.', NULL, 'EUR 1,400 / month', 'Lille', 'Full-time, 6 months', 'Internship',
     (SELECT id FROM companies  WHERE name  = 'Orbit Bank'), NULL,
     (SELECT id FROM categories WHERE name  = 'Security')),
  ('Machine Learning Engineer', 'Computer vision for radiologists.', NULL, 'EUR 50-62k / year', 'Bordeaux', 'Full-time, permanent', 'Full-time',
     (SELECT id FROM companies  WHERE name  = 'Lumen Health'), NULL,
     (SELECT id FROM categories WHERE name  = 'Data & AI'));

INSERT INTO applications (advertisement_id, person_id, message, status) VALUES
  ((SELECT id FROM advertisements WHERE title = 'Backend Developer Intern (Python)'),
   (SELECT id FROM people WHERE email = 'alice.moreau@example.com'), 'I built a Flask API for my last project.', 'reviewed'),
  ((SELECT id FROM advertisements WHERE title = 'Backend Developer Intern (Python)'),
   (SELECT id FROM people WHERE email = 'karim.benali@example.com'), 'Python and Git are part of my daily work.', 'pending'),
  ((SELECT id FROM advertisements WHERE title = 'Security Engineer Intern'),
   (SELECT id FROM people WHERE email = 'alice.moreau@example.com'), 'I play CTFs every month.', 'accepted');

-- ---------------------------------------------------------------- query 1
-- Number of advertisements per company.
-- LEFT JOIN: a company without any ad must still appear, with 0 (COUNT(a.id) ignores the NULLs).
SELECT c.id, c.name AS company, COUNT(a.id) AS ads_count
FROM companies c
LEFT JOIN advertisements a ON a.company_id = c.id
GROUP BY c.id, c.name
ORDER BY ads_count DESC, c.name;

-- ---------------------------------------------------------------- query 2
-- Most requested advertisement: the one that received the most applications.
SELECT a.id, a.title, COUNT(*) AS applications
FROM applications ap
JOIN advertisements a ON a.id = ap.advertisement_id
GROUP BY a.id, a.title
ORDER BY COUNT(*) DESC
LIMIT 1;

-- ---------------------------------------------------------------- query 3
-- Applicants of one advertisement (here the ad with id 1): who applied, when, with which message.
SELECT p.first_name, p.last_name, p.email, p.phone, ap.status, ap.created_at, ap.message
FROM applications ap
JOIN people p ON p.id = ap.person_id
WHERE ap.advertisement_id = 1
ORDER BY ap.created_at;
