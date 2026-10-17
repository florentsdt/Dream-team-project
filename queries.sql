USE dtjob;

-- 1) Combien d'annonces chaque entreprise a-t-elle publiées ?
SELECT c.name AS company, COUNT(a.id) AS nb_ads
FROM companies c
LEFT JOIN ads a ON a.company_id = c.id
GROUP BY c.id, c.name;

-- 2) Quelle annonce a reçu le plus de candidatures ?
SELECT a.title, COUNT(ap.id) AS nb_applications
FROM ads a
LEFT JOIN applications ap ON ap.ad_id = a.id
GROUP BY a.id, a.title
ORDER BY nb_applications DESC
LIMIT 1;

-- 3) Lister les candidats d'une annonce donnée (ici l'annonce 1), avec leur message
SELECT p.first_name, p.last_name, p.email, ap.message, ap.applied_at
FROM applications ap
JOIN people p ON p.id = ap.person_id
WHERE ap.ad_id = 1;
