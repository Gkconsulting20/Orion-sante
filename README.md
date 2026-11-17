# Orion Santé

**Gestion des patients, des soins et des finances des cliniques au Togo.**

Orion Santé s’inscrit dans l’univers **ComptaOrion**. Le logiciel relie le dossier patient aux consultations, à la facturation, aux règlements et aux reçus, dans une interface en français avec des montants en **francs CFA — XOF**.

> **Statut : version pilote.** La démonstration utilise des données fictives. L’utilisation avec de vrais dossiers médicaux nécessite une validation des exigences locales de sécurité, de confidentialité, d’hébergement et de comptabilité.

## Fonctionnalités disponibles

- **Patients** : création et modification des dossiers, recherche, coordonnées, contact d’urgence, allergies et historique associé.
- **Consultations** : suivi de la file d’attente, constantes, notes, ordonnances et statuts de prise en charge.
- **Rendez-vous** : planification, modification, arrivée du patient et annulation.
- **Facturation** : factures à plusieurs lignes, rattachement au patient et à une consultation, suivi des soldes et des impayés.
- **Règlements et reçus** : paiements complets ou partiels, reçus numérotés et documents imprimables ; export PDF depuis le dialogue d’impression du navigateur.
- **Caisse** : ouverture, clôture, entrées, dépenses et solde théorique en espèces.
- **Rapports** : suivi financier par période, service et mode de paiement, exports CSV.
- **Paramètres** : établissement, tarifs des actes et praticiens.
- **Authentification** : connexion avec Clerk et espace de clinique isolé par compte.

Les règlements en espèces, TMoney, Flooz et banque sont **enregistrés manuellement**. Cette version ne déclenche aucun encaissement auprès de ces opérateurs.

## Limites actuelles

- Chaque compte possède son propre espace ; les invitations d’équipe et les droits d’accès collaborateurs par rôle ne sont pas encore disponibles.
- Les rapports sont des états de gestion opérationnels, pas une comptabilité générale certifiée.
- La pharmacie, les stocks, la paie, le multi-sites et les transmissions aux assurances ne font pas partie de cette première version.
- Le rattachement à un sous-domaine ne constitue pas une certification de conformité.

## Architecture

| Partie | Technologies |
| --- | --- |
| Interface | React, TypeScript, Vite, Tailwind CSS |
| Accès aux données | TanStack Query, client généré avec Orval |
| API | Express 5, validation Zod |
| Base de données | PostgreSQL, Drizzle ORM |
| Authentification | Clerk |
| Gestion des dépendances | **pnpm 10.26.1** |

Le projet est un monorepo pnpm :

```text
artifacts/
  orion-sante/          Interface web
  api-server/           API et contrôles financiers
  mockup-sandbox/       Outil de conception, hors application métier
lib/
  api-spec/             Contrat OpenAPI
  api-client-react/     Client et hooks générés
  api-zod/              Validateurs générés
  db/                   Schéma et accès PostgreSQL
scripts/                Utilitaires du projet
```

Les factures et règlements émis ne sont pas modifiables ni supprimables dans cette version. Les écritures financières utilisent une transaction avec verrouillage de la clinique ; les demandes de paiement sont idempotentes pour éviter un double enregistrement lors d’une nouvelle tentative.

## Installation

Utiliser Node.js compatible avec les dépendances du projet et **pnpm 10.26.1**, déclaré dans le champ `packageManager` du `package.json` racine.

```bash
pnpm --version
# Version attendue : 10.26.1

pnpm install --frozen-lockfile
```

Ne pas supprimer le fichier de verrouillage ni désactiver les contrôles de dépendances pour contourner une différence de version de pnpm.

### Configuration

Configurer les valeurs dans le gestionnaire de secrets de l’environnement cible, **jamais dans le dépôt Git** :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL utilisée par le serveur |
| `CLERK_SECRET_KEY` | Clé serveur Clerk, confidentielle |
| `CLERK_PUBLISHABLE_KEY` | Clé publique utilisée par le serveur Clerk |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clé publique Clerk intégrée à l’interface lors du build |
| `VITE_CLERK_PROXY_URL` | URL du proxy Clerk lorsque cette configuration est nécessaire |
| `PORT` | Port d’écoute de chaque service, fourni par son environnement d’exécution |
| `BASE_PATH` | Préfixe de l’interface Vite ; `/` lorsque l’interface est à la racine |

Les clés Clerk, les utilisateurs et la configuration du domaine doivent correspondre à l’environnement cible. Les comptes de développement ne doivent pas être considérés comme des comptes de production.

### Développement dans Replit

Utiliser les workflows configurés pour l’API et l’interface : ils fournissent les ports et le routage nécessaires. L’interface est à la racine et l’API sous `/api`.

Pour un hébergement différent, prévoir le routage de ces deux services sur la même origine ; démarrer uniquement Vite ne fournit pas l’API.

### Commandes utiles

```bash
# Vérification TypeScript de tous les packages
pnpm run typecheck

# Compilation de l’API et de l’interface métier, sans l’outil de maquette
pnpm run build

# Régénération du client et des validateurs après modification d’OpenAPI
pnpm --filter @workspace/api-spec run codegen

# Application du schéma à la base de développement configurée
pnpm --filter @workspace/db run push
```

La commande de schéma doit viser une base de développement vérifiée. Ne pas l’utiliser comme migration de production sans procédure validée.

## GitHub et Cloudflare

Le circuit de publication prévu est :

**GitHub → Cloudflare → sous-domaine de `comptaorion.com`.**

Le sous-domaine envisagé est **`sante.comptaorion.com`** ; cette adresse n’est pas présentée ici comme déjà active.

### État de la préparation Cloudflare

**La configuration complète pour Cloudflare reste à finaliser.** Ce dépôt ne contient pas encore de point d’entrée Worker ni de configuration Wrangler déployable pour l’ensemble de l’application. La version actuellement développée utilise un serveur Node.js/Express et PostgreSQL.

Un simple `npx wrangler deploy` à la racine ne suffit donc pas à publier le logiciel complet. Il faut préparer et vérifier :

1. La compilation de l’interface avec ses paramètres et sa clé publique Clerk.
2. L’exécution de l’API sur une cible compatible, et son routage sous `/api`.
3. L’accès sécurisé à PostgreSQL depuis l’environnement cible, sans convertir ni déplacer automatiquement les données.
4. La configuration Clerk et son proxy pour le domaine de publication.
5. Le circuit patient → facture → règlement → reçu sur l’environnement de prévisualisation.
6. Le raccordement DNS, une fois le déploiement validé.

### Erreur `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`

Le premier build Cloudflare utilisait pnpm 9.10.0 alors que la configuration du workspace et son fichier de verrouillage ont été préparés avec pnpm 10.26.1.

La version est maintenant épinglée dans le `package.json` racine :

```json
"packageManager": "pnpm@10.26.1"
```

Cloudflare Workers Builds doit sélectionner cette version. Si nécessaire, vérifier également la variable de **build** `PNPM_VERSION=10.26.1`, le répertoire racine sélectionné et le commit utilisé.

La correction de cette erreur d’installation ne prouve pas que la compilation ou le déploiement complet réussit.

### Compilation sans `PORT`

La commande racine `pnpm run build` compile uniquement l’API et l’interface Orion Santé après vérification TypeScript. Elle ne compile pas l’outil de maquette, qui n’est pas une partie du logiciel publié.

La compilation Vite d’Orion Santé n’exige pas de port d’écoute. Sans `BASE_PATH`, elle produit une interface à la racine (`/`). Les serveurs de développement continuent d’exiger leurs paramètres explicites. Cela ne fournit pas, à lui seul, un point d’entrée Cloudflare Worker.

### Si un nouveau commit ne déclenche pas de build

Dans le projet Cloudflare, vérifier :

- Le dépôt connecté : `Gkconsulting20/Orion-sante`.
- La branche suivie : `main`.
- L’activation des builds automatiques et les éventuels filtres de chemins.
- Le commit effectivement sélectionné pour la nouvelle tentative.
- Les droits de l’intégration GitHub de Cloudflare sur ce dépôt.

Un envoi sur GitHub confirme la présence du code dans le dépôt ; seul le journal Cloudflare confirme qu’un nouveau build a été lancé et son résultat.

## Sécurité

- Ne jamais versionner les secrets, les fichiers `.env`, les exports de base ou les données de patients.
- Utiliser exclusivement les données fictives pour la démonstration publique.
- Faire valider les accès, la confidentialité, les exigences d’hébergement, la traçabilité et les procédures de récupération avant une mise en service réelle.
- Ne pas modifier les entrées DNS du site principal ou de la messagerie pour raccorder uniquement le sous-domaine santé.
