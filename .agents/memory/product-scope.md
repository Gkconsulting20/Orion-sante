---
name: Positionnement Orion Santé
description: Demandes métier et limites de périmètre exprimées par le créateur.
---

Le logiciel s’ajoute à l’univers de ComptaOrion et cible les cliniques et hôpitaux en Afrique. Le premier pays indiqué par le créateur est le Togo.

**Why:** Le créateur souhaite une nouvelle application simple mais moderne adaptée à ce domaine.

**How to apply:** Garder une terminologie de santé (patients, dossiers, soins) et relier le dossier patient à la facturation, aux paiements et aux reçus.

Orion Santé doit reprendre le logo original de ComptaOrion.

**Why:** Le créateur a demandé de récupérer le logo dans son application ComptaOrion pour le mettre ici.

**How to apply:** Réutiliser le logo de la marque sans le redessiner ; un cadrage du symbole est adapté aux petits emplacements, en conservant ses formes et ses couleurs.

Le créateur possède le domaine `comptaorion.com`. Il ne veut pas acheter de nouveau domaine et souhaite un sous-domaine du domaine existant.

Le domaine est géré chez Namecheap ; le sous-domaine envisagé est `sante.comptaorion.com`, pas une adresse déjà raccordée.

**Why:** Le créateur l’a demandé explicitement.

**How to apply:** Préparer un sous-domaine de `comptaorion.com` et demander les informations de configuration appropriées au moment du raccordement, sans présenter une adresse proposée comme déjà active.

Orion Santé doit être relié au dépôt GitHub que le créateur va créer, puis publié sur Cloudflare, et non sur l’hébergement Replit.

**Why:** Le créateur a précisé que GitHub puis Cloudflare est le schéma de ses applications.

**How to apply:** Préparer le raccordement GitHub et vérifier la compatibilité du serveur, de la base et de l’authentification avec la cible Cloudflare avant toute publication. Ne pas effectuer de bascule ni de migration de données sans préciser les conséquences.

Le créateur a validé Neon PostgreSQL pour la base de production d’Orion Santé, séparée de la base de développement Replit.

**Why:** Le créateur n’avait pas de base PostgreSQL de production et a choisi « Utiliser Neon ».

**How to apply:** Raccorder la cible Cloudflare à une base Neon dédiée ; ne pas remplacer la base de développement ni copier les données fictives ou des dossiers patients sans accord. Ne pas activer d’option payante sans accord.

Pour Orion Santé, utiliser le Worker principal existant, pas un Worker supplémentaire pour les essais. Le créateur précise que son Worker n'est pas encore publié.

**Why:** Le créateur a rejeté la création d'un Worker séparé et demandé de mettre l'application dans le Worker principal.

**How to apply:** Charger les versions de prévisualisation sur le Worker existant sans activer leur publication ; ne pas créer un autre Worker ni raccorder le domaine sans accord.

La liste de fonctionnalités hospitalières trouvée sur internet est une référence, pas une demande de tout implémenter. Le créateur précise : « le but n'est pas d'implementer toutes les fonctionnalité mais de faire un logiciel moderne et complet pour le domaine de la santé surtout en afrique ».

**Why:** Éviter une accumulation de modules hospitaliers peu adaptés au besoin initial.

**How to apply:** Privilégier un circuit de travail cohérent et complet avant d’élargir aux stocks, à la paie, aux assurances ou au multi-sites.
