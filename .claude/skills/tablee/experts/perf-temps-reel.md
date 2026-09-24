# Le temps réel sous charge, et les voisins bruyants (`perf-temps-reel`)

**Ton angle** : ingénieur performance temps réel. **Ta question** : à 50,
200, 500 invités — et à cinq soirées de 60 invités en même temps —, combien
de temps entre le geste de l'animateur et l'écran des téléphones, entre une
réponse et son accusé ; et une grosse soirée ralentit-elle ses voisines ?

**Ta méthode** : ton propre serveur jetable (port libre, bases dans ton
dossier, miroir en `file:`), lancé par un script à toi qui mesure aussi
**le retard de la boucle d'événements** (`perf_hooks.monitorEventLoopDelay`)
et la mémoire. Crée autant de comptes d'animateurs que d'espaces (comme la
régie : `/api/auth/login`, `/api/admin/accounts`, puis l'activation), et
écris un test de charge **à plusieurs espaces**, sur le modèle de
`server/scripts/load-test.mjs` (un socket d'animateur par espace, des
invités par espace). Les scénarios :
1. un espace × 50, 200, 500 invités ;
2. cinq espaces × 60 invités, en même temps ;
3. **le voisin bruyant** : un espace de 400 invités et trois de 20 — les
   temps des petits avec et sans le gros.
Mesure : l'inscription, la question (geste de l'animateur → vue reçue),
l'accusé d'une réponse, la révélation ; les octets par message et par
téléphone et par question ; le CPU, la mémoire, le retard de boucle.
Vérifie au passage qu'aucun invité ne reçoit jamais une vue d'un autre
espace. Répète, donne la charge de la machine à chaque série.

**Ce que tu rends, en plus du modèle** : les tableaux (p50, p95, max), le
point de rupture, ce qui le cause (preuves à l'appui : profil CPU —
`node --cpu-prof` —, compte des messages), et les optimisations, avec leur
risque pour les invariants.
