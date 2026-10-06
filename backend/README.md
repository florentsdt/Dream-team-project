# DT Job : Backend (API REST + base de données)

Projet **Job Board** de l'équipe *Dream Team Job*.
Stack : **Node.js + Express 5**, **MySQL** (driver `mysql2`).

## Step 01 : Base de données

Base `dtjob` (MySQL), créée par `schema.sql` (à la racine du dépôt) :

| Table          | Rôle |
|----------------|------|
| `companies`    | Entreprises qui publient des annonces |
| `categories`   | Catégories (une annonce = exactement une catégorie) |
| `people`       | Candidats, recruteurs, admins (`role`). `password_hash` est vide pour un candidat « invité » |
| `ads`          | Annonces (titre, descriptions, salaire, lieu, contrat, temps de travail, entreprise, catégorie, contact) |
| `applications` | Candidatures (annonce, personne, message, date, statut, email envoyé). Une personne ne peut postuler qu'une fois à une annonce |

```bash
mysql -u root < schema.sql      # crée la base + données de test
mysql -u root < queries.sql     # les 3 requêtes d'exemple
```

## Step 04 : API CRUD

### Lancer l'API

```bash
cd backend
npm install
npm start            # http://localhost:3000   (npm run dev = rechargement auto)
npm run seed         # remplit la BDD VIA l'API (à lancer une fois l'API démarrée)
```

La config par défaut (MySQL en local, `root` sans mot de passe, base `dtjob`) fonctionne sans fichier `.env`.
Pour changer : `cp .env.example .env` puis modifier les valeurs.

### Routes

Chaque ressource (`companies`, `categories`, `ads`, `people`, `applications`) expose :

| Verbe | URL | Action | Succès |
|-------|-----|--------|--------|
| GET | `/{ressource}` | Liste paginée | 200 |
| GET | `/{ressource}/:id` | Détail | 200 |
| POST | `/{ressource}` | Créer | 201 |
| PUT | `/{ressource}/:id` | Modifier (champs obligatoires requis) | 200 |
| PATCH | `/{ressource}/:id` | Modifier partiellement | 200 |
| DELETE | `/{ressource}/:id` | Supprimer | 204 |

Exception : `applications` n'a pas de `POST /applications` (on postule via la route ci-dessous).

Routes imbriquées :

| Verbe | URL | Action |
|-------|-----|--------|
| GET | `/companies/:id/ads` | Annonces d'une entreprise |
| GET | `/ads/:id/applications` | Candidatures reçues par une annonce |
| POST | `/ads/:id/applications` | **Postuler** (Step 05 backend) |

**Postuler** : corps `{ "person_id": 1, "message": "..." }` (utilisateur connu)
ou `{ "first_name", "last_name", "email", "phone"?, "message" }` (invité : la personne est créée, ou retrouvée via son email).

### Pagination, filtres, recherche

- `?page=2&limit=10` (limit max 100). Réponse : `{ "data": [...], "pagination": { page, limit, total, pages } }`
- `?q=texte` : recherche texte
- Filtres : `/ads?company_id=1&category_id=2&contract_type=CDI&working_time=full_time&is_active=1`,
  `/applications?ad_id=1&status=pending`, `/people?role=admin`

La **liste** des annonces renvoie un résumé (titre, description courte...). Le **détail** `GET /ads/:id`
renvoie tout (description complète, salaire, lieu...) : c'est la route du bouton « en savoir plus ».

### Codes de statut

| Code | Quand |
|------|-------|
| 200 / 201 / 204 | Succès / création / suppression |
| 400 | Champ obligatoire manquant, valeur invalide (enum), id référencé inexistant, JSON invalide, id non numérique |
| 404 | L'id de l'URL n'existe pas, ou route inconnue |
| 409 | Doublon (email, candidature déjà envoyée), suppression impossible car des données en dépendent, annonce inactive |
| 500 | Erreur serveur inattendue |

Format d'erreur : `{ "error": "message" }`

### Exemples (curl)

```bash
curl http://localhost:3000/ads
curl http://localhost:3000/ads/1
curl -X POST http://localhost:3000/ads -H "Content-Type: application/json" \
  -d '{"title":"Dev JS","short_description":"Court","full_description":"Long","contract_type":"CDI","company_id":1,"category_id":1}'
curl -X POST http://localhost:3000/ads/1/applications -H "Content-Type: application/json" \
  -d '{"first_name":"Zoe","last_name":"Lemaire","email":"zoe@example.com","message":"Bonjour !"}'
```

### Structure

```
backend/
  src/server.js        point d'entrée
  src/db.js            connexion MySQL
  src/lib/crud.js      fabrique de routes CRUD (pagination, filtres, validation)
  src/lib/errors.js    erreurs -> codes HTTP
  src/routes/*.js      une ressource par fichier
  seed.js              remplit la BDD via l'API
```

### À faire aux étapes suivantes

- **Step 06/07 : sécuriser.** Pour l'instant **toutes les routes sont publiques** (y compris `/people`, qui expose
  les emails, et le champ `role` qu'on peut modifier). Elles devront être réservées à l'admin.
- `ON DELETE CASCADE` : supprimer une entreprise supprime ses annonces et leurs candidatures.
