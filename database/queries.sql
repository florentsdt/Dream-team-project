USE dtjob;
SELECT c.name AS company,COUNT(a.id) AS nb_ads FROM companies c LEFT JOIN ads a ON a.company_id=c.id GROUP BY c.id,c.name;
SELECT a.title,COUNT(ap.id) AS nb_applications FROM ads a LEFT JOIN applications ap ON ap.ad_id=a.id GROUP BY a.id,a.title ORDER BY nb_applications DESC LIMIT 1;
SELECT p.first_name,p.last_name,p.email,ap.message,ap.applied_at FROM applications ap JOIN people p ON p.id=ap.person_id WHERE ap.ad_id=1;
