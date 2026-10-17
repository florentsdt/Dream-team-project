# DT Job Board

## Présentation

DT Job Board est une plateforme de recherche d'emploi spécialisée dans le secteur de la tech. Elle permet aux utilisateurs de consulter des offres d'emploi, de stage et d'alternance, de rechercher des opportunités et de déposer des candidatures.

Le site propose une interface moderne et responsive, avec une navigation simple et des filtres pour faciliter la recherche.

## Fonctionnalités

### Recherche d'offres
- Consultation des offres disponibles
- Recherche par mots-clés
- Filtres par type de contrat, lieu, date de publication et durée
- Consultation des détails d'une offre
- Pagination des résultats

### Comptes utilisateurs
- Création de compte et connexion
- Gestion du profil utilisateur
- Candidature aux offres
- Consultation de ses candidatures et de leur statut

### Administration
- Gestion des offres, entreprises, catégories et utilisateurs
- Consultation et gestion des candidatures
- Modification des informations et des statuts des candidatures
- Accès réservé aux administrateurs

## Technologies utilisées

- **Backend :** Python et Flask
- **Base de données :** SQLite
- **Frontend :** HTML, CSS et JavaScript
- **API :** API REST utilisant JSON
- **Tests :** Python `unittest`

## Structure du projet

```text
Dream-team-project/
├── app.py
├── schema.sql
├── seed.py
├── queries.sql
├── run_sql.py
├── requirements.txt
├── pages/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── account.html
│   ├── admin.html
│   └── 404.html
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── common.js
│       ├── index.js
│       ├── auth.js
│       └── admin.js
├── tests/
│   └── test_api.py
└── docs/
    ├── architecture.dot
    ├── architecture.png
    ├── database.dot
    ├── database.png
    └── IA.md
```

## Installation et lancement

Prérequis : Python 3.10 ou une version plus récente.

1. Cloner le dépôt :

   ```bash
   git clone https://github.com/florentsdt/Dream-team-project.git
   cd Dream-team-project
   ```

2. Créer un environnement virtuel :

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Installer les dépendances :

   ```bash
   pip install -r requirements.txt
   ```

4. Lancer le serveur :

   ```bash
   python app.py
   ```

5. Ouvrir le site dans le navigateur :

   http://127.0.0.1:5000

Pour ajouter les données de démonstration, exécuter `python seed.py` après le premier démarrage, conformément aux instructions du projet.

## Tests

Pour lancer les tests automatisés :

```bash
python -m unittest discover -s tests -v
```

## Base de données

La base de données utilise SQLite. Le fichier `schema.sql` définit sa structure et `queries.sql` contient des requêtes SQL liées au projet.

## Documentation

Les fichiers du dossier `docs/` présentent l'architecture de l'application, le schéma de la base de données et la documentation relative à l'utilisation de l'IA.
