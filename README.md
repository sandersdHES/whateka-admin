# Whateka Admin

Frontend d'administration pour la plateforme Whateka. Stack : **React 18 + Vite + TypeScript + Tailwind + Supabase**.

Hébergé sur **admin.whateka.ch** via GitHub Pages (branche `gh-pages`, déployée par Actions).

## Développement local

```bash
npm install
cp .env.example .env   # puis vérifie les clés
npm run dev            # http://localhost:5173
```

## Build & déploiement

- `npm run build` produit `dist/`.
- Un push sur `main` déclenche `.github/workflows/deploy.yml` qui build puis push `dist/` sur `gh-pages`.

## Contrôle d'accès

Le rôle est lu depuis la table `admin_users` via l'email de la session Supabase :
- `super_admin` : tout + la page `/users`
- `admin` : tout sauf `/users`
- `editor` ou autres : accès refusé

## Edge Functions Supabase

Dans `supabase/functions/` :
- `admin-manage-questions` : CRUD sur `feedback_questions` (admins)
- `admin-list-users` : liste des utilisateurs + stats (super_admins)

Déployer :

```bash
supabase functions deploy admin-manage-questions
supabase functions deploy admin-list-users
```

Les secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement par Supabase à l'Edge runtime.
