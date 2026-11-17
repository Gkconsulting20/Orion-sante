---
name: Versions de l'outillage Cloudflare
description: Pièges de compatibilité Miniflare, transmission de secrets et tests Clerk hors Replit.
---

La version bêta de Miniflare 5 distribuée avec Wrangler en novembre 2026 conserve un README montrant l'ancienne API de configuration v4. Lire les déclarations de types réellement installées avant de reprendre ses exemples.

**Why:** Les exemples du README sont rejetés par le validateur v5, même si le moteur Workers fonctionne. Le convertisseur de configuration v4 exporté par la bibliothèque permet la compatibilité ; les chemins de modules doivent aussi rester dans leur racine déclarée.

**How to apply:** Lors d'une évolution du banc de test Workers, vérifier la version résolue et son API effective plutôt que copier les exemples embarqués ou supposer que le build Wrangler suffit à prouver le démarrage du Worker.

Ne pas supposer qu'un outil acceptant un chemin de fichier peut lire `/dev/stdin` lorsqu'il est lancé par un sous-processus Node avec une entrée pipée.

**Why:** L'entrée de ce sous-processus peut être une socket Unix impossible à rouvrir comme fichier ; Wrangler échoue alors avec ENXIO avant l'installation des secrets.

**How to apply:** Pour les secrets de version Wrangler, préférer un fichier contenant uniquement des références aux variables d'environnement, développées par Wrangler en mémoire. Ne pas écrire les valeurs dans un fichier suivi ou les passer en arguments.

Pour tester Clerk sur l'origine Cloudflare, consommer le véritable ticket de test via la méthode `ticket` du SDK Clerk chargé sur cette origine.

**Why:** L'aide de connexion Replit génère une redirection vers l'origine Replit : la suivre ne valide pas la session Cloudflare. Le ticket reste valide pour l'instance Clerk correspondante et son SDK propose un flux officiel sans cette redirection.

**How to apply:** Utiliser exclusivement un ticket authentique de l'instance de test, le garder hors des sorties et activer la session via le SDK officiel. Ne pas modifier les contrôles d'identité ni inventer des jetons.
