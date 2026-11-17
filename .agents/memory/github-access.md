---
name: Accès GitHub
description: Distinguer la connexion de l’intégration API et le transport Git natif de Replit.
---

Une intégration API GitHub non utilisable n’implique pas que le projet ne peut pas accéder au dépôt par Git.

**Why:** L’attachement du connecteur n’a pas fourni de connexion et sa carte d’autorisation a échoué, alors que le transport Git natif du projet pouvait lire et envoyer le dépôt via le proxy sécurisé de Replit.

**How to apply:** Pour relier ou synchroniser le code, vérifier les remotes puis tester un accès Git en lecture avant de demander une nouvelle autorisation ou un secret. Préserver les remotes de sauvegarde et ne jamais forcer un envoi sur une branche existante.
