---
name: Outils de build Cloudflare
description: Installation des dépendances avant la compilation dans Workers Builds.
---

Cloudflare Workers Builds installe les dépendances avant d’exécuter la commande de compilation. La version de pnpm doit être alignée sur celle qui interprète les réglages du workspace et produit son lockfile.

**Why:** Le premier journal Cloudflare utilisait pnpm 9 alors que le projet utilisait pnpm 10, et échouait sur `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` concernant `overrides`, avant toute compilation.

**How to apply:** Épingler la version dans `packageManager` ou définir la variable de build `PNPM_VERSION` selon la documentation Cloudflare actuelle. Ne pas désactiver l’installation figée ni supprimer les protections de dépendances pour masquer cette incompatibilité. Corriger cette phase ne prouve pas que le serveur, la base et l’authentification sont prêts pour Cloudflare.
