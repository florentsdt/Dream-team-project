# DT Job — Job Board

Projet d'école : site d'offres avec une API Express, MySQL et interface web.

## Installer la base
Dans MySQL Workbench, exécuter `database/schema.sql`. Attention : le script supprime et recrée les tables.

## Lancer l'API
Dans le terminal VS Code :
```bash
cd backend
npm install express mysql2 dotenv cors argon2 jsonwebtoken
```
Copier `.env.example` en `.env`, compléter les paramètres MySQL et le secret JWT, puis :
```bash
npm run dev
```
L'API est sur `http://localhost:3000`.

## Lancer le site
Ouvrir `frontend/index.html` avec l'extension Live Server de VS Code. Régler `FRONTEND_ORIGIN` dans `.env` sur l'origine donnée par Live Server.

## Pages
`index.html` annonces ; `register.html` inscription ; `login.html` connexion ; `account.html` compte ; `admin.html` administration.

## Routes
- `POST /auth/register` inscription (rôle user attribué par le serveur).
- `POST /auth/login` connexion (renvoie jeton et rôle).
- `GET /auth/me`, `PUT /auth/me` compte connecté.
- `GET /ads`, `GET /ads/:id` annonces.
- `POST /ads/:id/applications` candidature avec connexion.
- `GET /admin/ads`, `POST /admin/ads`, `PUT /admin/ads/:id`, `DELETE /admin/ads/:id`, `GET /admin/applications` : admin seulement.

## Créer un admin de test
Créer d'abord un compte sur le site, puis dans MySQL exécuter en remplaçant l'email :
```sql
UPDATE people SET role='admin' WHERE email='ton.email@example.com';
```
Se déconnecter et se reconnecter. Ne jamais publier `.env` ni le secret JWT.
