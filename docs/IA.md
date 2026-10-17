# Usage de l'IA pendant le développement

Ce document dit **où**, **comment** et **pourquoi** une IA a été utilisée sur le Job Board, et ce que nous avons vérifié nous-mêmes. Il sera complété pour la défense finale.

> Les parties marquées **[À COMPLÉTER]** sont à remplir par l'équipe : elles décrivent notre propre usage, que nous seuls connaissons.

## 1. Outils utilisés

| Outil | Pour quoi faire |
|---|---|
| Claude Code (Anthropic), dans VS Code | relecture du projet face au sujet, corrections ciblées (voir section 3) |
| **[À COMPLÉTER]** (ChatGPT, Copilot, autre ?) | **[À COMPLÉTER]** |

## 2. Nos règles d'utilisation

- L'IA propose, **nous décidons** : chaque modification est relue, comprise et testée avant d'être gardée.
- Nous devons pouvoir **expliquer chaque ligne** du code rendu. Si un passage généré est trop abstrait, nous le réécrivons plus simplement ou nous l'apprenons (voir section 5).
- Aucune donnée personnelle réelle ni secret (mot de passe, clé) n'est envoyé à l'IA.
- Toute modification est vérifiée par les tests automatiques (`python -m unittest discover -s tests -v`) et par le parcours manuel du README.

## 3. Journal des utilisations

| Date | Outil | Demande | Ce que l'IA a fait | Ce que nous avons vérifié / changé |
|---|---|---|---|---|
| **[À COMPLÉTER]** | | | | |
| 13/10/2026 | Claude Code | Comparer le projet au sujet, aux attendus de la Mid Terms Defense 2 et aux retours du relecteur | Liste de ce qui est fait, manquant ou incorrect | **[À COMPLÉTER]** |
| 13/10/2026 | Claude Code | Rendre la catégorie obligatoire | `category_id NOT NULL` + `ON DELETE RESTRICT` dans `schema.sql`, champ obligatoire dans l'API et le formulaire admin, messages d'erreur clairs (409 si une catégorie est encore utilisée), tests ajoutés | **[À COMPLÉTER]** |
| 13/10/2026 | Claude Code | Réécrire les 3 requêtes de `queries.sql` | Annonces par entreprise, annonce la plus demandée, candidats d'une annonce | **[À COMPLÉTER]** |
| 13/10/2026 | Claude Code | Commencer ce document | Structure du document et lignes du 13/10 | **[À COMPLÉTER]** |

## 4. Ce que l'IA a bien fait / mal fait

- **Utile** : **[À COMPLÉTER]**
- **Erreurs ou limites rencontrées** : **[À COMPLÉTER]** (ex. code trop « malin » à expliquer, suggestions non conformes au sujet…)

## 5. Passages de `app.py` à savoir expliquer

Ces passages sont concis mais abstraits ; nous devons savoir les justifier à l'oral :

- **Le dictionnaire `TABLES`** : décrit chaque table (champs modifiables, champs obligatoires, qui peut lire, colonnes renvoyées). Quatre routes génériques (`GET`, `POST`, `PUT/PATCH`, `DELETE` sur `/api/<table>`) s'en servent pour les 5 tables au lieu de 25 routes écrites à la main.
- **Le SQL construit avec des f-strings** (`f"SELECT {t['cols']} FROM {t['frm']} ..."`) : ce n'est pas une injection SQL, car les noms de tables et de colonnes viennent du dictionnaire `TABLES`, jamais de l'utilisateur (une table inconnue renvoie 404). Les **valeurs** venant de l'utilisateur passent toujours par des paramètres `?`.
- **`-(-total // per)`** : division arrondie au supérieur (nombre de pages). Exemple : 8 offres, 6 par page → `-(-8 // 6)` = `-(-2)` = 2 pages.
- **La boucle avec `lambda`** (pages `/login`, `/register`, `/account`) : crée une route par nom de page. `n=_name` fige la valeur à chaque tour ; sans cela, les trois routes serviraient la dernière page de la boucle.
