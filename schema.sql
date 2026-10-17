-- =====================================================
--  DT JOB (Dream Team Job) - Step 01 : schéma de la BDD
--  Dialecte : MySQL / MariaDB
-- =====================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS dtjob
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE dtjob;

-- Pour pouvoir relancer le script sans erreur
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS ads;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS companies;

-- -----------------------------------------------------
-- COMPANIES : les entreprises qui publient des annonces
-- -----------------------------------------------------
CREATE TABLE companies (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  website     VARCHAR(255),
  location    VARCHAR(150),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- CATEGORIES : une annonce appartient à UNE catégorie
-- -----------------------------------------------------
CREATE TABLE categories (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE
);

-- -----------------------------------------------------
-- PEOPLE : candidats, recruteurs et admins
-- password_hash est NULL pour un candidat "invité"
-- (qui postule sans compte, cf. Step 05 vs Step 06)
-- -----------------------------------------------------
CREATE TABLE people (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  phone         VARCHAR(30),
  password_hash VARCHAR(255),
  role          ENUM('candidate', 'recruiter', 'admin') NOT NULL DEFAULT 'candidate',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- ADS : les annonces
-- -----------------------------------------------------
CREATE TABLE ads (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  title              VARCHAR(200) NOT NULL,
  short_description  VARCHAR(300) NOT NULL,
  full_description   TEXT NOT NULL,
  salary_min         INT,
  salary_max         INT,
  location           VARCHAR(150),
  contract_type      ENUM('CDI', 'CDD', 'internship', 'apprenticeship', 'freelance') NOT NULL,
  working_time       ENUM('full_time', 'part_time') NOT NULL DEFAULT 'full_time',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  company_id         INT NOT NULL,
  category_id        INT NOT NULL,
  contact_person_id  INT NULL,  -- la personne en charge de l'annonce
  FOREIGN KEY (company_id)        REFERENCES companies(id)  ON DELETE CASCADE,
  FOREIGN KEY (category_id)       REFERENCES categories(id),
  FOREIGN KEY (contact_person_id) REFERENCES people(id)     ON DELETE SET NULL
);

-- -----------------------------------------------------
-- APPLICATIONS : une personne postule à une annonce
-- UNIQUE(ad_id, person_id) = on ne postule qu'une fois
-- -----------------------------------------------------
CREATE TABLE applications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  ad_id      INT NOT NULL,
  person_id  INT NOT NULL,
  message    TEXT NOT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status     ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (ad_id)     REFERENCES ads(id)    ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE CASCADE,
  UNIQUE (ad_id, person_id)
);

-- =====================================================
--  DONNÉES DE TEST (juste pour vérifier le schéma)
--  Au Step 04, on remplira la BDD via le backend.
-- =====================================================

INSERT INTO categories (name) VALUES
  ('Développement'), ('Design'), ('Marketing');

INSERT INTO companies (name, description, website, location) VALUES
  ('TechNova', 'Startup spécialisée en applications web.', 'https://technova.example', 'Paris'),
  ('PixelWorks', 'Studio de design et de création digitale.', 'https://pixelworks.example', 'Lyon');

INSERT INTO people (first_name, last_name, email, phone, role) VALUES
  ('Alice', 'Martin', 'alice@example.com', '0600000001', 'candidate'),
  ('Bob',   'Durand', 'bob@example.com',   '0600000002', 'candidate'),
  ('Chloé', 'Petit',  'chloe@example.com', '0600000003', 'recruiter');

INSERT INTO ads (title, short_description, full_description, salary_min, salary_max, location, contract_type, working_time, company_id, category_id, contact_person_id) VALUES
  ('Développeur Full Stack', 'Rejoins notre équipe produit.', 'Tu participeras à la conception et au développement de notre plateforme web (Node.js, React).', 38000, 48000, 'Paris', 'CDI', 'full_time', 1, 1, 3),
  ('Stage Backend', 'Stage de 6 mois sur notre API.', 'Tu travailleras sur notre API REST et notre base de données SQL.', 1200, 1200, 'Paris', 'internship', 'full_time', 1, 1, 3),
  ('UI/UX Designer', 'Crée des interfaces qui plaisent.', 'Tu concevras les maquettes et le design system de nos clients.', 35000, 42000, 'Lyon', 'CDI', 'full_time', 2, 2, NULL);

INSERT INTO applications (ad_id, person_id, message) VALUES
  (1, 1, 'Bonjour, je suis très motivée par ce poste de développeuse.'),
  (1, 2, 'Bonjour, ce poste correspond tout à fait à mon profil.'),
  (2, 1, 'Je souhaite effectuer mon stage chez TechNova.'),
  (3, 2, 'Intéressé par le design, voici ma candidature.');
