# AGENTS.md — Règles de collaboration Claude "cerveau" / Antigravity (Gemini) "codeur"

Ce fichier vit dans le repo pour éviter de re-expliquer le contexte à chaque nouvelle session, que ce soit à Claude ou à l'agent qui code (Antigravity/Gemini). Toute IA qui travaille sur ce repo doit lire ce fichier en premier.

---

## 1. Contexte du projet

- **Nom du projet :** TRIBU (Notre Tribu)
- **Repo GitHub :** `DavidBworld/tribu`, branche principale : `main`
- **Chemin local :** `C:\Users\david\Desktop\NotreTribu`
- **Terminal principal :** Windows / PowerShell (⚠️ syntaxe `;` pour enchaîner des commandes, pas `&&`)
- **Objectif de l'appli en une phrase :** App familiale PWA en français avec sections Flux, Agenda, Courses, Cuisine, Docs, palette de couleurs "Sanctuaire"

### Architecture réelle actuelle (vérifiée sur le repo, pas une supposition)
tribu/
├── .gitignore              (exclut node_modules/, .env — pas de secrets exposés)
├── package.json            (dépendances : express, cors, dotenv, @google/generative-ai)
├── package-lock.json
├── database.json           (~600 Ko — base de données à plat en JSON)
├── src/
│   └── server.js           (backend Express, ~65 lignes)
└── public/
└── index.html          (~264 Ko — frontend monolithique HTML/CSS/JS)

- **Backend :** Express (`src/server.js`)
  - `GET/POST /api/data` → lit/écrit `database.json` sur disque (c'est toute la persistance)
  - `POST /api/gemini` → appelle l'API Google Generative AI (`gemini-1.5-flash`) via `GEMINI_API_KEY` (`.env`)
  - Sert `public/` en statique
  - Payload JSON/urlencoded limité à 50mb (pour les images en base64)
  - Port : `process.env.PORT || 3000`
- **Frontend :** un seul fichier `public/index.html`, pas de build, pas de framework, pas de bundler
- **Base de données :** aucune vraie BDD — un fichier `database.json` lu/écrit en entier à chaque requête
- **Pas de TypeScript, pas d'ESLint/Prettier, pas de CI/CD, pas de tests**

### Bugs connus non résolus (au 05/07/2026)

1. **`public/index.html` ligne ~177** : `fetch('http://localhost:3000/api/gemini', ...)` est en dur. Ça casse dès que l'app n'est pas servie sur `localhost:3000` (déploiement, autre port, etc.). Doit être remplacé par un chemin relatif `/api/gemini`.
2. **`package.json` n'a pas de script `start`** : impossible de faire `npm start`, il faut lancer `node src/server.js` manuellement.
3. **Historique des bugs tactiles iOS** (contexte pour ne pas les réintroduire) : les boutons dans des écrans `.scr` (`position: fixed`, `overflow-y: auto`) n'étaient pas cliquables tant que ces trois choses n'étaient pas toutes réunies : `display:none` **+** `visibility:hidden` **+** `pointer-events:none` par défaut sur `.scr, avec les valeurs inverses sur `.scr.on`. Un défaut de zoom iOS sur focus input a aussi causé des décalages horizontaux, réglé via `user-scalable=no` dans le meta viewport (à vérifier que ce correctif est toujours en place avant de le "redécouvrir").

### Historique des commits (pour contexte, ne pas réécrire cet historique)
c0b3037  fix(backend): limite payload 200mb pour images base64 (le message dit 200mb, le code montre 50mb — écart connu)
acfcede  feat: création API persistante et base de données JSON
43415a8  feat(courses): catégories dynamiques, suppression, fix SVG
b10ee05  fix: agenda création et conflits IDs
a9e978c  build: init backend Express et isolation du frontend
e4301d8  init: sauvegarde du prototype monolithique

---

## 2. Rôle de Claude

Claude agit comme couche de validation et architecte de prompts entre l'utilisateur et Antigravity (agent Gemini), qui exécute le code. **Claude ne code pas directement le projet.** Il :

1. Lit le code réel depuis GitHub avant de rédiger tout prompt — jamais d'hypothèse basée sur la mémoire ou un clone local périmé.
2. Rédige des prompts précis et scopés à destination d'Antigravity, un chantier à la fois.
3. **Exige systématiquement** qu'Antigravity présente un plan d'implémentation détaillé et **attend une validation explicite** (de Claude et/ou de l'utilisateur) avant qu'une seule ligne de code ne soit écrite — à chaque étape, sans exception.
4. Relit le résultat produit by Antigravity (via ce que l'utilisateur copie-colle) avant tout push GitHub.
5. Surveille la cohérence entre ce qui est demandé et ce qui est livré.

---

## 3. Règles non négociables

- Ne jamais rédiger un prompt à partir de code obsolète. Toujours redemander/relire le contenu actuel des fichiers concernés (via GitHub) avant d'écrire un prompt.
- Toute précision donnée par l'utilisateur avant l'envoi = le prompt précédent n'est pas encore parti. Intégrer la correction avant diffusion.
- **Chaque prompt envoyé à Antigravity doit imposer explicitement** : présenter un plan d'implémentation et **attendre une validation explicite** avant d'écrire du code. Aucune exception, même pour un changement qui semble mineur.
- Les changements sur `database.json` (structure des données) sont toujours manuels ou validés explicitement par l'utilisateur — Antigravity n'y touche jamais sans confirmation préalable.
- Ne jamais `git push --force`. Toujours un `git push` standard.
- Vérifier 0 erreur (exécution/lint) avant tout push — l'exiger explicitement dans chaque prompt (pas de compilateur TypeScript pour l'instant, donc au minimum : le serveur démarre sans erreur, le HTML se charge sans erreur console).
- Les données existantes dans `database.json` ne doivent jamais être écrasées ou perdues par une opération d'Antigravity.
- **Risque de perte de code lors de réécritures de fichiers** : Antigravity peut supprimer silencieusement de larges portions de code lors d'une réécriture de fichier (surtout sur `public/index.html`, monolithique et volumineux). Pattern de récupération : demander la restauration du fichier (git) puis réappliquer proprement les changements ciblés (diff minimal, pas de réécriture complète du fichier).
- **PowerShell** : ne jamais fournir de commandes avec `&&` — utiliser `;` pour enchaîner, ou des lignes séparées.
- Comme Gemini is utilisé pour limiter les coûts, **les prompts de Claude doivent être denses et complets** (fichiers concernés nommés, contexte clair, résultat attendu explicite, cas limites mentionnés) pour éviter les allers-retours inutiles.
- Ne jamais réintroduire une régression déjà corrigée par le passé sans vérifier l'historique des bugs connus (section 1) — notamment le pattern `.scr`/`.scr.on` et le viewport `user-scalable=no`.

---

## 4. Séquence de travail

1. Claude lit le code pertinent (via GitHub).
2. Claude rédige un prompt précis et scopés pour Antigravity, incluant l'exigence d'un plan préalable.
3. L'utilisateur envoie le prompt à Antigravity (Gemini).
4. Antigravity présente un plan d'implémentation.
5. L'utilisateur copie ce plan à Claude, qui le valide (ou demande des ajustements) avant tout codage.
6. Antigravity code, une fois le plan validé.
7. L'utilisateur teste en local (`node src/server.js`, tant qu'il n'y a pas de script `start`).
8. L'utilisateur copie le résultat produit à Claude pour relecture.
9. Push vers GitHub (`git push`, jamais `--force`).
10. Déploiement (à préciser — pas encore d'hébergement de production confirmé).

---

## 5. Principes d'approche

- Un chantier à la fois, étapes séquentielles et scopées pour éviter de casser l'existant.
- Test local systématique avant push.
- L'utilisateur intervient directement si Antigravity boucle, hallucine, ou tente une opération dangereuse.
- Éviter les questions redondantes sur des éléments déjà montrés (captures d'écran, messages clairs, ou déjà présents dans ce fichier).
- Vu le coût token de Gemini, privilégier des prompts denses en information plutôt que des échanges itératifs multiples.

---

## 6. Outils & ressources

- **Agent de codage :** Antigravity, modèle Gemini
- **Base de données :** aucune vraie BDD — fichier `database.json` à plat (candidat à une vraie migration Supabase/Firebase/SQLite si le volume de données grandit)
- **Hébergement / déploiement :** non confirmé à ce jour — à préciser
- **Repo :** `github.com/DavidBworld/tribu` (branche `main`)
- **Terminal principal :** Windows, PowerShell
- **API externes :** Google Generative AI (`gemini-1.5-flash`) via `@google/generative-ai`, clé dans `.env` (`GEMINI_API_KEY`, jamais commitée)

---

## 7. À trancher / zones grises

- Hébergement de production : où et comment le serveur Express tourne-t-il en dehors du poste local ?
- Faut-il migrer `database.json` vers une vraie BDD avant ou après la résolution des bugs iOS ?
- Migration future vers Vite + Svelte/Vue : reportée tant que les bugs tactiles iOS ne sont pas définitivement réglés et confirmés sur device réel.

*Dernière mise à jour de ce fichier : 05/07/2026, après audit direct du repo (clone + lecture de `server.js`, `package.json`, `public/index.html`).*

---

## 8. État actuel de la migration moderne (Supabase)

### Stack technique du dossier `app/`
- **Frontend** : Vite + React 18 + TS + Tailwind CSS v3 + shadcn-ui (Radix primitives).
- **Routage** : React Router v6.
- **Requêtes & Cache** : TanStack Query (React Query).
- **Formulaires & Validation** : react-hook-form + zod.
- **Backend & Auth** : Supabase.
- Note : L'ancien code à la racine (`src/server.js`, `public/index.html`) est conservé comme filet de sécurité et référence fonctionnelle, mais il est totalement indépendant de `app/`.

### Schéma de la base de données Supabase
- **`families`** (table des familles) :
  - `id` : uuid (Primary Key, default: `gen_random_uuid()`)
  - `name` : text (nom de la famille)
  - `created_at` : timestamptz (default: `now()`)
- **`family_members`** (rattachement des utilisateurs aux familles) :
  - `id` : uuid (Primary Key, default: `gen_random_uuid()`)
  - `family_id` : uuid (Foreign Key references `families(id)`)
  - `user_id` : uuid (Foreign Key references `auth.users(id)`)
  - `role` : text (default: `'member'`, values: `'admin'` | `'member'`)
  - `created_at` : timestamptz (default: `now()`)
  - contrainte unique sur `(family_id, user_id)`
- **`agenda_events`** (événements du calendrier familial) :
  - `id` : uuid (Primary Key, default: `gen_random_uuid()`)
  - `family_id` : uuid (Foreign Key references `families(id)`)
  - `title` : text (titre de l'événement, obligatoire)
  - `event_date` : date (date de l'événement, au format `YYYY-MM-DD`)
  - `all_day` : boolean (vrai si l'événement dure toute la journée)
  - `start_time` : text (heure de début, optionnelle, ex: `"10:30"`)
  - `end_time` : text (heure de fin, optionnelle, ex: `"13:00"`)
  - `location` : text (lieu de l'événement, optionnel)
  - `phone` : text (téléphone, optionnel)
  - `notes` : text (notes / observations, optionnel)
  - `assigned_member_id` : uuid (Foreign Key references `family_members(id)`, optionnel, désigne le membre assigné)
  - `created_by` : uuid (Foreign Key references `auth.users(id)`)
  - `created_at` : timestamptz (default: `now()`)
  - `updated_at` : timestamptz (default: `now()`)

### RLS (Row Level Security)
Toutes les tables possèdent le RLS activé. La sécurité repose sur l'appartenance à la famille connectée via la fonction SQL `is_member_of_family(family_id)`. Un utilisateur ne peut lire ou modifier que les lignes associées à son `family_id`.

### Suivi des chantiers
- **Chantier 1 (Terminé)** : Initialisation, configuration de l'import alias `@/`, shadcn-ui, Supabase Auth (Login/Signup), AuthGuard, et onboarding de famille (créer / rejoindre).
- **Chantier 2 (En cours)** : Migration de l'Agenda (liste chronologique d'événements, CRUD, assignation de membres, formulaires typés Zod).

### Règle d'or
**Avant toute question ou script de diagnostic sur le schéma de la base de données, relire impérativement `AGENTS.md`.** Ce fichier contient la structure à jour des tables et colonnes.

