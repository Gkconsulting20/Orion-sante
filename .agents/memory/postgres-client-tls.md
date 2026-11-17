---
name: TLS PostgreSQL avec un pooler
description: Distinguer le chiffrement client du lien interne entre pooler et serveur PostgreSQL.
---

Ne pas utiliser `pg_stat_ssl` comme preuve du chiffrement entre l'application et un endpoint PostgreSQL poolé.

**Why:** Sur Neon, ce contrôle peut refléter le lien interne pooler → PostgreSQL et indiquer faux alors que la connexion cliente est bien chiffrée.

**How to apply:** Exiger la vérification du certificat côté client et contrôler le transport de la connexion cliente effectivement établie. Vérifier aussi une requête depuis le runtime cible, pas seulement depuis l'intégration ou la machine de développement.
