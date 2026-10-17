# DT Job Board

## 1. Présentation du projet

DT Job Board est une application web permettant de consulter des offres d'emploi et de déposer des candidatures. Elle comprend une API REST, un système d'authentification, un espace personnel et une interface d'administration.

Le projet repose sur un serveur Flask, une base de données SQLite et une interface développée en HTML, CSS et JavaScript.

## 2. Fonctionnalités principales

### Offres d'emploi
- Consulter les offres disponibles.
- Rechercher des offres par mots-clés.
- Filtrer les offres par type de contrat, localisation, entreprise, catégorie, durée et date de publication.
- Consulter les détails d'une offre sans recharger la page.
- Parcourir les résultats grâce à la pagination.
- Déposer une candidature accompagnée d'un message.

### Comptes utilisateurs
- Créer un compte et se connecter.
- Modifier ses informations personnelles et son mot de passe.
- Consulter ses candidatures et leur statut.
- Empêcher les candidatures en double pour une même offre.

### Administration
- Gérer les entreprises, les catégories, les offres, les personnes et les candidatures.
- Créer, consulter, modifier et supprimer des enregistrements via l'API REST.
- Consulter les candidatures et modifier leur statut.
- Réserver les opérations d'administration aux administrateurs authentifiés.

### Notifications par e-mail
Des notifications peuvent être envoyées aux recruteurs via SMTP. Si SMTP n'est pas configuré, les e-mails sont simulés et affichés dans le terminal.

## 3. Technologies utilisées

- **Backend :** Python et Flask
- **Base de données :** SQLite
- **Frontend :** HTML, CSS et JavaScript
- **API :** API REST renvoyant des données au format JSON
- **Authentification :** sessions Flask et hachage des mots de passe avec Werkzeug
- **Tests :** module `unittest` de Python

## 4. Structure du projet

```text
.
├── app.py                  # Application Flask et API REST
├── schema.sql              # Schéma de la base de données
├── seed.py                 # Initialisation des données de démonstration
├── run_sql.py              # Script utilitaire SQL
├── queries.sql             # Requêtes SQL
├── requirements.txt        # Dépendances Python
├── pages/
│   ├── index.html          # Page principale des offres
│   ├── login.html          # Page de connexion
│   ├── register.html       # Page d'inscription
│   ├── account.html        # Espace personnel
│   ├── admin.html          # Interface d'administration
│   └── 404.html            # Page d'erreur 404
├── static/
│   ├── css/
│   │   └── style.css       # Feuille de style
│   └── js/
│       ├── index.js        # Interactions de la page principale
│       ├── auth.js         # Authentification
│       ├── admin.js        # Interactions d'administration
│       └── common.js       # Fonctions JavaScript communes
├── tests/
│   └── test_api.py         # Tests de l'API
└── docs/
    ├── architecture.dot
    ├── architecture.png
    ├── database.dot
    ├── database.png
    └── IA.md
```

## 5. Installation et lancement

### Prérequis

- Python 3.10 ou version ultérieure recommandé.
- pip.

### Étape 1 : Cloner le dépôt

```bash
git clone https://github.com/florentsdt/Dream-team-project.git
cd Dream-team-project
```

### Étape 2 : Créer un environnement virtuel

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Sous Windows, utiliser :

```powershell
.venv\Scripts\activate
```

### Étape 3 : Installer les dépendances

```bash
pip install -r requirements.txt
```

### Étape 4 : Charger les données de démonstration

```bash
python seed.py
```

Le schéma de la base de données est initialisé automatiquement au démarrage de l'application. Le script `seed.py` ajoute ensuite des données de démonstration en utilisant l'API.

Le script s'arrête si la base de données contient déjà des entreprises.

### Étape 5 : Démarrer l'application

```bash
python app.py
```

Ouvrir ensuite l'adresse suivante dans un navigateur :

http://127.0.0.1:5000

## 6. Comptes de démonstration

Les comptes locaux par défaut sont les suivants :

| Rôle | Adresse e-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@jobboard.local` | `admin1234` |
| Utilisateur de test | `user@jobboard.local` | `user12345` |

Le compte administrateur est créé automatiquement s'il n'existe pas. Le compte utilisateur de test est créé par le script `seed.py`.

**Sécurité :** ces identifiants sont destinés au développement local. Il est nécessaire de modifier le mot de passe administrateur et la clé secrète avant tout déploiement réel.

## 7. Conception de la base de données

L'application utilise SQLite et comporte cinq tables principales.

| Table | Description |
|---|---|
| `companies` | Informations sur les entreprises, leurs sites web et leurs localisations. |
| `people` | Recruteurs, candidats et comptes utilisateurs. |
| `categories` | Catégories d'offres, comme Development, Security ou Data & AI. |
| `advertisements` | Offres d'emploi, descriptions, contrats et informations associées. |
| `applications` | Candidatures déposées par les utilisateurs pour les offres. |

### Relations entre les tables

- Une entreprise peut publier plusieurs offres.
- Une personne peut être responsable de plusieurs offres.
- Chaque offre est associée à une entreprise et à une catégorie.
- Une offre peut recevoir plusieurs candidatures.
- Une personne peut candidater à plusieurs offres.
- Une personne ne peut déposer qu'une seule candidature pour une même offre.

Les clés étrangères garantissent la cohérence des relations. La suppression d'une entreprise entraîne celle de ses offres, tandis qu'une catégorie utilisée par une offre ne peut pas être supprimée.

Le schéma est défini dans `schema.sql`. La base de données est initialisée automatiquement au démarrage de l'application.

## 8. API REST

Les routes de l'API utilisent le format JSON lorsque cela est applicable. Les erreurs de l'API sont renvoyées au format JSON avec un champ `error`.

### Ressources publiques

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/advertisements` | Lister et rechercher les offres. |
| GET | `/api/advertisements/<id>` | Consulter une offre précise. |
| GET | `/api/companies` | Lister les entreprises. |
| GET | `/api/companies/<id>` | Consulter une entreprise. |
| GET | `/api/companies/<id>/ads` | Lister les offres d'une entreprise. |
| GET | `/api/categories` | Lister les catégories. |
| GET | `/api/categories/<id>` | Consulter une catégorie. |
| POST | `/api/advertisements/<id>/applications` | Déposer une candidature. |

### Recherche, filtres et pagination

La route des offres prend en charge la recherche par mots-clés et plusieurs filtres via des paramètres d'URL.

Exemple :

```text
/api/advertisements?q=developer&location=Paris&contract_type=Internship
```

Les autres filtres disponibles comprennent `category_id`, `company_id`, `min_duration`, `max_duration` et `date_from`.

La pagination utilise les paramètres `page` et `per_page`.

Exemple :

```text
/api/advertisements?page=1&per_page=10
```

### Authentification

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Créer un compte. |
| POST | `/api/auth/login` | Se connecter. |
| POST | `/api/auth/logout` | Se déconnecter. |
| GET | `/api/auth/me` | Consulter les informations du compte connecté. |
| PUT | `/api/auth/me` | Modifier son profil. |
| GET | `/api/auth/me/applications` | Consulter ses candidatures. |

L'authentification repose sur la gestion des sessions côté serveur.

### API d'administration

Les opérations suivantes nécessitent une authentification administrateur.

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/people` | Lister les personnes. |
| GET | `/api/applications` | Lister les candidatures. |
| POST | `/api/<table>` | Créer un enregistrement. |
| PUT / PATCH | `/api/<table>/<id>` | Modifier un enregistrement. |
| DELETE | `/api/<table>/<id>` | Supprimer un enregistrement. |

Les routes génériques prennent en charge les tables `companies`, `categories`, `people`, `advertisements` et `applications`. L'accès aux données des personnes et des candidatures est réservé aux administrateurs.

### Codes HTTP

L'API utilise notamment les codes HTTP suivants :

- `200 OK` : requête réussie.
- `201 Created` : création d'un enregistrement ou d'une candidature.
- `204 No Content` : suppression ou déconnexion réussie.
- `400 Bad Request` : données invalides.
- `401 Unauthorized` : authentification requise ou identifiants incorrects.
- `403 Forbidden` : droits insuffisants.
- `404 Not Found` : ressource introuvable.
- `409 Conflict` : doublon ou conflit lié à la base de données.

## 9. Configuration des e-mails

Sans configuration SMTP, les e-mails de candidature sont simulés et affichés dans le terminal.

Les variables d'environnement suivantes permettent de configurer l'envoi réel des e-mails :

| Variable | Description |
|---|---|
| `SMTP_HOST` | Adresse du serveur SMTP. |
| `SMTP_PORT` | Port SMTP, égal à `587` par défaut. |
| `SMTP_USER` | Identifiant SMTP, si nécessaire. |
| `SMTP_PASSWORD` | Mot de passe SMTP, si nécessaire. |
| `MAIL_FROM` | Adresse de l'expéditeur. |

## 10. Variables d'environnement

L'application prend en charge les variables suivantes :

| Variable | Description |
|---|---|
| `SECRET_KEY` | Clé secrète utilisée pour signer les sessions Flask. |
| `ADMIN_EMAIL` | Adresse de l'administrateur, par défaut `admin@jobboard.local`. |
| `ADMIN_PASSWORD` | Mot de passe administrateur, par défaut `admin1234`. |
| `DB_PATH` | Chemin de la base SQLite, par défaut `jobboard.db` dans le dossier du projet. |
| `PORT` | Port du serveur, égal à `5000` par défaut. |

En développement local, l'application peut démarrer sans définir ces variables. Pour un déploiement, il faut configurer des valeurs sécurisées.

## 11. Exécution des tests

Pour lancer les tests automatisés :

```bash
python -m unittest discover -s tests -v
```

Les tests se trouvent dans `tests/test_api.py`.

## 12. Documentation complémentaire

Le dossier `docs/` contient les diagrammes d'architecture et de base de données, disponibles aux formats `.dot` et `.png`, ainsi que le fichier `IA.md` qui documente l'utilisation de l'intelligence artificielle dans le projet.
