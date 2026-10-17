-- Step 01: database schema (SQLite)
-- 5 tables: companies, people, categories, advertisements, applications.
-- Relations: advertisements -> companies (N:1), -> people (contact, N:1), -> categories (N:1);
--            applications  -> advertisements (N:1), -> people (N:1). One person can apply once per ad.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS companies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  website     TEXT,
  location    TEXT,
  description TEXT,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- People: recruiters in charge of ads, applicants, and site accounts (password_hash is NULL for guests)
CREATE TABLE IF NOT EXISTS people (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Job categories (Development, Data, Security...). An ad has exactly one category.
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS advertisements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT NOT NULL,
  short_description TEXT NOT NULL,
  full_description  TEXT,
  wage              TEXT,
  location          TEXT,
  working_time      TEXT,
  duration_months   INTEGER CHECK (duration_months IS NULL OR duration_months > 0),  -- contract length, used by the duration filter
  contract_type     TEXT NOT NULL DEFAULT 'Full-time'
                    CHECK (contract_type IN ('Internship','Apprenticeship','Full-time','Part-time','Freelance')),
  company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id        INTEGER REFERENCES people(id) ON DELETE SET NULL,  -- person in charge of the ad
  category_id       INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,  -- exactly one category; a used category cannot be deleted
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  advertisement_id INTEGER NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  person_id        INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  message          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','accepted','rejected')),
  email_sent       INTEGER NOT NULL DEFAULT 0 CHECK (email_sent IN (0,1)),
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (advertisement_id, person_id)
);

CREATE INDEX IF NOT EXISTS idx_ads_company ON advertisements(company_id);
CREATE INDEX IF NOT EXISTS idx_ads_category ON advertisements(category_id);
CREATE INDEX IF NOT EXISTS idx_apps_ad ON applications(advertisement_id);
CREATE INDEX IF NOT EXISTS idx_apps_person ON applications(person_id);
