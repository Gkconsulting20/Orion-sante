# Orion Santé — préparation Cloudflare

## État vérifié et limites

Cette configuration vise **l'application complète**, pas un export statique :
interface React, API Express, authentification Clerk et persistance PostgreSQL.

- Le frontend et le bundle Workers se construisent depuis la racine du dépôt.
- TypeScript a été vérifié.
- Le moteur local Cloudflare (`workerd`, via Miniflare) a exécuté le circuit API
  patient → facture → règlement → reçu persistant, le rejeu idempotent et le refus
  d'un dépassement de solde, avec des données fictives d'une démonstration isolée.
- **La base de développement présente dans cet environnement est privée/locale,
  sans TLS : elle n'est pas directement joignable depuis un Worker distant.**
- La version de prévisualisation est chargée dans le **Worker principal existant
  `orion-sante`**, sans activer cette version sur le trafic principal.
- La connexion distante Neon fonctionne avec TLS vérifié. Le circuit API
  patient → facture → règlement → reçu persistant, l'idempotence et le refus
  de surpaiement ont été exécutés avec succès depuis cette version distante.
- La recette navigateur patient → facture → règlement → reçu est également
  passée sur cette URL distante : facture soldée de 1 500 FCFA, reçu persistant
  après rechargement, rendu imprimable et appel d'impression vérifiés.
- Les essais utilisent les clés Clerk de développement. La configuration live
  et son proxy restent à valider avec les clés de production avant ouverture.
- La connexion Clerk par ticket officiel a été vérifiée sur l'origine Cloudflare :
  session persistante, clinique privée vide et distincte de la démonstration,
  retour à la démonstration après déconnexion. Aucun compte réel n'a été utilisé.
  Le changement de session remplace immédiatement les données, formulaires et
  documents imprimables en mémoire ; le correctif a été vérifié sans rechargement.

Le succès du test local ne prouve pas la connectivité d'un Worker distant.
Les tests distants ci-dessus ont été faits avec des dossiers et règlements
entièrement fictifs ; aucun transfert d'argent n'a été effectué.
Ne pas utiliser de vraies données médicales tant que les prérequis d'hébergement,
de confidentialité, de sauvegarde et de restauration n'ont pas été validés.

### Base existante identifiée

Après le choix du créateur de réutiliser une base existante, le projet Neon
`orion-sante` a été identifié en lecture seule. Sa base `neondb` possède déjà
la table `public.clinics`, avec les colonnes et la clé primaire attendues ;
elle était vide au moment du contrôle. Aucune création de table, copie de
données ou modification de configuration Neon n'a été effectuée.

La branche existante porte le nom `production`. Ce nom ne constitue pas une
autorisation de publication : seule une version de prévisualisation du Worker
principal est visée. Aucun second Worker n'est requis pour cette configuration.
La connexion SQL via l'intégration Neon ne prouve ni la connectivité TCP/TLS
depuis Cloudflare ni le fonctionnement du parcours distant.
Fournir sa connexion via un secret distinct `ORION_PREVIEW_DATABASE_URL` permet
de préparer ce contrôle sans remplacer la base locale gérée par Replit.

## Synchronisation GitHub sans publication automatique

Le contrôle automatique de la branche `main` dans Workers Builds utilise :

- Répertoire racine : `/`
- Commande de build : `pnpm run build`
- Commande de déploiement : `pnpm --filter @workspace/api-server run cf:check`

Malgré le libellé « déploiement », cette seconde commande exécute uniquement
`wrangler deploy --dry-run` : elle vérifie le bundle sans téléverser ni activer
de version. Un contrôle vert ne prouve donc ni une mise à jour de la
prévisualisation ni une publication de production.

Le script distinct `pnpm run cf:deploy:preview:secure` construit les assets
avec les bonnes clés publiques, contrôle PostgreSQL puis utilise
`wrangler versions upload`. Il exige les autorisations d’envoi des assets
et les secrets de l’environnement sécurisé. Il n’est pas la commande
automatique de Workers Builds. Les secrets de Replit ne sont pas copiés
automatiquement dans les variables de build Cloudflare.

L’administration de Builds utilise un **jeton personnel** distinct, avec
**Workers Builds Configuration / Edit** et **Workers Scripts / Read**.
Un jeton de compte ne convient pas pour cette API. Ce jeton d’administration
n’est ni un secret du Worker ni une variable du frontend.

## Architecture retenue

Un seul **Cloudflare Worker avec Static Assets**, et non Cloudflare Pages seul :

| Chemin | Traitement |
| --- | --- |
| `/`, `/patients`, `/facturation`, `/sign-in`, etc. | Assets Vite, repli SPA vers `index.html` |
| `/api` et `/api/*` | Worker Node-compatible → Express, sans retirer `/api` |
| `/api/__clerk/*` | Proxy Clerk avant le décodage JSON Express |

`artifacts/api-server/wrangler.jsonc` configure le runtime `nodejs_compat`,
l'entrée `src/worker.ts` et les assets `../orion-sante/dist/public`.
L'entrée Node habituelle `src/index.ts` reste inchangée pour Replit.
Le port `3000` de l'entrée Worker est uniquement une clé de routage interne
`handleAsNodeRequest`, pas un serveur Node hébergé ailleurs.

Les connexions PostgreSQL sont propres à chaque requête Worker, puis fermées :
les sockets d'une requête ne doivent pas être réutilisées par une autre.
Les transactions et verrous financiers existants sont conservés.
Pino utilise son implémentation navigateur sur Workers ; un adaptateur de
journalisation HTTP sélectionné par Wrangler évite les symboles privés Node de
`pino-http`. L'exécution Node conserve sa journalisation habituelle.
Les logs ne contiennent ni corps métier, ni cookies, ni paramètres d'URL.

**Aucune conversion D1/SQLite, migration de données ou modification de schéma
n'est effectuée par les commandes ci-dessous.**

## 1. Préparer les accès sans secrets dans Git

Depuis le dépôt `https://github.com/Gkconsulting20/Orion-sante` :

1. Utiliser Node.js 24 et pnpm 10.26.1, puis `pnpm install --frozen-lockfile`.
2. Autoriser le dépôt dans Cloudflare Workers Builds ou utiliser Wrangler
   depuis une machine autorisée. Ne pas connecter la branche principale à un
   déploiement automatique en production avant l'accord du créateur.
3. Pour le CLI, s'authentifier avec `wrangler login`, ou stocker
   `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` dans le coffre de secrets
   de l'environnement d'exécution/CI. Limiter les permissions aux Workers et
   aux ressources nécessaires. Ne jamais placer leurs valeurs dans une commande
   versionnée, un fichier de configuration suivi ou une conversation.

L'identifiant de compte n'est pas un mot de passe, mais il n'a pas besoin d'être
versionné. Les fichiers `.env*`, `.dev.vars*`, `.wrangler/` et les bundles générés
sont exclus de Git. Seuls les exemples sans valeurs réelles sont versionnés.

### Variables de build du frontend

| Nom | Valeur/usage |
| --- | --- |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clé publique de l'instance Clerk correspondant au serveur |
| `VITE_CLERK_PROXY_URL` | Avec les clés live : URL HTTPS absolue de la cible + `/api/__clerk` ; avec les clés test : laisser absent |

`pnpm run cf:build` impose `NODE_ENV=production`, `BASE_PATH=/` et
`VITE_CLERK_USE_CONFIGURED_KEY=true` uniquement pour le build Cloudflare.
Contrairement au mode Replit, le domaine `clerk.<hôte>` n'est alors pas déduit
automatiquement : la clé explicitement fournie est utilisée.
Les variables `VITE_*` sont **publiques et incluses dans le JavaScript**.
Ne jamais y placer une clé secrète ni une connexion PostgreSQL.
Changer ces variables demande de reconstruire le frontend.
`PORT` et `BASE_PATH` restent obligatoires pour le serveur Vite de développement
Replit, mais pas pour un build Vite.

### Secrets d'exécution du Worker

Les secrets de test sont attachés à la version téléversée du Worker principal.
Les futures versions de production doivent recevoir leurs propres valeurs :

| Nom | Usage |
| --- | --- |
| `DATABASE_URL` | Connexion PostgreSQL joignable depuis Cloudflare, avec TLS vérifié |
| `CLERK_SECRET_KEY` | Clé serveur de la même instance Clerk que le frontend |
| `CLERK_PUBLISHABLE_KEY` | Même clé publique que celle du build |

Exemples interactifs **sans valeur de secret dans la ligne de commande** :

```sh
# Ne pas activer une nouvelle version en ajoutant un secret isolément :
# utiliser le téléversement groupé de version décrit ci-dessous.
pnpm run cf:deploy:preview:secure
```

Ce script lit `ORION_PREVIEW_DATABASE_URL` et les clés Clerk depuis les secrets
de l'environnement. Il vérifie Neon, impose TLS `verify-full`, construit puis
exécute **`wrangler versions upload`**, jamais `wrangler deploy`.
`scripts/cloudflare/preview-secrets.env` ne contient que des références aux
variables ; aucune valeur secrète n'est écrite dans ce fichier.
Wrangler développe ces références en mémoire et les téléverse comme secrets
chiffrés avec la nouvelle version.
L'adresse principale `workers.dev` conserve son état et la version active
est contrôlée avant/après l'opération. Seules les URL de version sont activées
pour les essais.

Ne pas utiliser `wrangler secret put` ou la validation **Deploy** d'un secret
dans le tableau de bord avant l'accord de publication : ces opérations peuvent
activer une version immédiatement. Pour la production ultérieure, fournir les
valeurs appropriées à sa nouvelle version, seulement après validation.
Les secrets Cloudflare ne sont pas hérités automatiquement de Replit.
`NODE_ENV`, `LOG_LEVEL` et `CLERK_USE_CONFIGURED_KEY` sont des paramètres non
secrets configurés dans Wrangler.

## 2. Conserver PostgreSQL, débloquer son accessibilité

Le code actuel utilise `pg` et Drizzle, sans service de stockage alternatif.
Le diagnostic suivant ne modifie rien :

```sh
pnpm run cf:preflight
```

Il affiche seulement : réseau public/privé, succès SQL, présence du schéma et TLS.
Il ne révèle pas l'hôte, la connexion ni les identifiants.
Un échec est attendu ici : la base actuelle n'est accessible que localement.

Avant une prévisualisation distante, le créateur doit approuver une solution :

- obtenir un point d'accès PostgreSQL **existant** accessible depuis Cloudflare
  et une connexion TLS avec validation du certificat ; ou
- approuver séparément le choix d'un hébergement PostgreSQL accessible.
  La création du schéma et l'éventuel transfert des données sont des opérations
  distinctes, hors des scripts de build et soumises à validation.

Ne pas exposer le PostgreSQL local sur Internet, désactiver la validation TLS,
changer de base silencieusement ou exécuter `db push` pendant un build.
Pour la prévisualisation, préférer une base de test autorisée, pas celle contenant
des patients réels. La présence du schéma doit être vérifiée avant le test.

La connexion directe `pg` est retenue pour ne pas imposer de nouvelle ressource.
Pour une charge importante, Hyperdrive peut être évalué séparément, sans changer
le moteur PostgreSQL. Ne pas ajouter une liaison Hyperdrive sans adapter et
retester la gestion des connexions.

Le contrôle décisif reste un accès réussi à `/api/workspace` **depuis l'URL de
version du Worker principal**, puis un enregistrement relu lors d'une autre requête.
Un `SELECT 1` depuis Replit ou un `/api/healthz` réussi ne suffit pas.

## 3. Configurer Clerk hors Replit

L'application actuelle utilise une instance Clerk gérée par Replit.
Le déploiement externe ne bénéficie pas du remplacement automatique des clés
développement/production propre à la publication Replit.

Avant tout usage distant :

1. Confirmer que l'instance gérée autorise l'usage de l'hôte Cloudflare choisi,
   ou décider explicitement d'une autre instance. Ne pas recréer les utilisateurs
   ni changer de fournisseur sans accord.
2. Pour la prévisualisation, utiliser des clés de test correspondantes et
   laisser `VITE_CLERK_PROXY_URL` absent. Le proxy n'est pas destiné aux instances
   de développement ; Clerk utilise alors directement son domaine de test.
3. Pour les clés live, configurer l'hôte autorisé, les retours de connexion,
   `/sign-in`, `/sign-up` et le proxy dans l'instance Clerk appropriée.
   Définir `VITE_CLERK_PROXY_URL` au build et `CLERK_PROXY_URL` à l'exécution à la
   **même URL HTTPS absolue**, par exemple, après autorisation de ce domaine :
   `https://sante.comptaorion.com/api/__clerk`.
4. En prévisualisation live, définir `CLERK_PROXY_URL` dans les variables
   Cloudflare de cette cible. Ne pas réutiliser l'URL de production.
5. Vérifier réellement connexion, déconnexion, persistance de session après
   rechargement, et séparation des données de deux comptes.

Le proxy reste exécuté avant `express.json()`. Il transmet les en-têtes Clerk
serveur, conserve les cookies de réponse et renvoie `502` en cas d'indisponibilité
amont. Le Worker remplace les en-têtes forwarded du client par son URL effective.
Toutes les réponses API portent `Cache-Control: no-store`.

## 4. Construire et vérifier sans publier

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run cf:check
```

`cf:check` construit l'interface puis fait un `wrangler deploy --dry-run`.
Malgré le nom de cette commande Wrangler, **aucune publication n'est effectuée**.
Le bundle de diagnostic est placé dans `generated-artifacts/cloudflare/`, ignoré.

Avec les variables de la base de développement et de Clerk présentes :

```sh
pnpm --filter @workspace/api-server run cf:test:runtime
```

Ce test utilise le vrai moteur local Workers, pas Express démarré sous Node.
Il écrit des enregistrements fictifs dans une nouvelle démonstration anonyme ;
il ne supprime aucune donnée. Il ne vérifie pas les DNS, le TLS distant ni
l'interface de connexion Clerk.

Pour une prévisualisation locale manuelle : après le build, configurer les trois
variables d'exécution dans un `.dev.vars` non suivi à côté de `wrangler.jsonc`,
puis `pnpm --filter @workspace/api-server run cf:dev`.
Ne pas partager ce fichier. Ce serveur local ne remplace pas les workflows Replit.

## 5. Prévisualisation Cloudflare, après accès et base autorisés

Le créateur a demandé de conserver **un seul Worker, `orion-sante`**.
L'existence de ce Worker ne vaut pas autorisation de publication.
Utiliser les URL de version pour les essais, pas un Worker supplémentaire.

Pour Cloudflare Workers Builds :

- Répertoire racine : racine du dépôt, pas `artifacts/orion-sante`.
- Commande de build : `pnpm run cf:build`.
- Commande de **téléversement de version sans publication** :
  `pnpm --filter @workspace/api-server run cf:deploy:preview`.
- Aucun répertoire de sortie Pages à configurer : Wrangler associe les assets
  au Worker. Ne pas choisir un site Pages statique sans API.
- Aucun déploiement automatique de production n'est fourni.

Depuis Replit ou un environnement CLI autorisé disposant des secrets de test,
préférer `pnpm run cf:deploy:preview:secure`, qui contrôle les accès et fournit
les secrets à la version sans publier la version active.
Il refuse de continuer si le Worker principal n'existe pas.

Copier l'URL **réellement retournée par Cloudflare**. La version vérifiée utilise
l'alias `verification` ; son adresse est
`https://verification-orion-sante.gkconsulting20.workers.dev`.
Il s'agit d'une URL de version du Worker `orion-sante`, **pas d'un autre Worker**.
L'adresse principale `orion-sante.gkconsulting20.workers.dev` reste désactivée.
Utiliser des données fictives et une protection d'accès
de prévisualisation adaptée ; une URL `workers.dev` accessible n'est pas privée
par nature.

Le Worker supplémentaire initialement créé pour les essais a été retiré après
la correction demandée par le créateur. La configuration définit uniquement
le Worker principal. Ce retrait n'a supprimé aucune donnée PostgreSQL.

### Recette obligatoire sur l'URL distante

1. `/` et un accès direct à `/patients` renvoient l'interface et ses assets.
2. `/api/healthz` renvoie du JSON, pas `index.html`.
3. `/api/workspace` charge la démonstration : preuve de connexion PostgreSQL.
4. Créer un patient fictif, émettre sa facture de 1 500 FCFA, enregistrer un
   règlement de 1 500 FCFA, puis afficher et imprimer son reçu.
5. Recharger : patient, facture soldée et reçu restent visibles.
6. Rejouer une demande de paiement identique : pas de doublon.
   Tenter un surpaiement : refus.
7. Tester Clerk puis l'isolation des comptes. Pour les clés live, vérifier
   `/api/__clerk/v1/environment` et les retours de connexion dans le navigateur.
8. Une route `/api/inconnue` doit renvoyer `404`, jamais le HTML de la SPA.

Une recette API reproductible est disponible (aucun compte réel utilisé) :

```sh
# ORION_PREVIEW_URL : URL réelle de prévisualisation, jamais la production.
# ORION_SMOKE_APPROVED=yes autorise l'ajout des seules données fictives du test.
pnpm run cf:smoke
```

Cette commande attend les variables ci-dessus dans l'environnement.
Elle ne remplace pas le contrôle navigateur du reçu et de Clerk.

## 6. Production et domaine : étapes non exécutées

La cible envisagée est `sante.comptaorion.com`, domaine chez Namecheap.
Le dépôt ne contient **aucune route active ni déclaration de custom domain** :
une commande de build ne peut donc pas modifier les DNS.

Avant le raccordement, vérifier où se trouvent les serveurs DNS autoritaires :
Namecheap peut être le bureau d'enregistrement sans héberger les DNS.
La configuration standard d'un Custom Domain Workers demande une zone active
dans Cloudflare. Si les DNS autoritaires sont encore chez Namecheap, examiner
les options compatibles avec le compte Cloudflare et demander l'accord avant
tout changement des serveurs de noms. Préserver les entrées mail et les autres
services ComptaOrion. Ne pas créer un CNAME au hasard vers `workers.dev`.

Après validation écrite du créateur seulement :

1. Confirmer les exigences d'hébergement et les sauvegardes PostgreSQL.
2. Choisir/configurer les ressources de production et les clés Clerk live.
3. Reconstruire avec les variables frontend de production.
4. Publier la version approuvée dans le même Worker après son accord :
   `cf:deploy:production` requiert `ORION_PRODUCTION_APPROVED=yes`.
5. Autoriser séparément le raccordement du domaine dans Cloudflare et les
   éventuelles modifications DNS Namecheap.
6. Refaire la recette complète et définir la procédure de retour à la version
   précédente du Worker. Un retour de code ne restaure pas les données.

**Important :** le garde-fou du script empêche une publication accidentelle via
ce script, ce n'est pas une politique de contrôle d'accès Cloudflare.
Ne pas exécuter directement `wrangler deploy --env production` pour le contourner.

## Références officielles

- [Express sur Workers](https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/)
- [Adaptateur HTTP Node](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
- [Static Assets et routage](https://developers.cloudflare.com/workers/static-assets/routing/advanced/)
- [PostgreSQL et pg](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/)
- [Domaines personnalisés Workers](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
