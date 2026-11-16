---
name: Cache des dépendances Vite
description: Décalage entre les versions React installées et les dépendances précompilées servies par Vite.
---

Après une mise à jour React/React DOM dans le catalogue pnpm, Vite peut continuer à servir une ancienne version optimisée de React DOM même si les deux versions installées concordent et si le serveur a redémarré.

**Why:** Un aperçu affichait une incompatibilité React/React DOM alors que la résolution Node indiquait les mêmes versions installées.

**How to apply:** Comparer d’abord les versions réellement installées. Si elles concordent, supprimer uniquement le cache généré `.vite` de l’application concernée et redémarrer son workflow ; ne pas changer encore les versions pour corriger un cache périmé.
