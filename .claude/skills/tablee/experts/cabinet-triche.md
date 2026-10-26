# Le Cabinet de curiosités : la triche et les secrets (`cabinet-triche`)

**Ton angle** : concepteur de jeux solo en ligne, spécialiste de la triche,
des horloges et des requêtes forgées. **Ta question** : le Cabinet — un
musée de 84 œuvres, neuf jeux de trois manches chronométrées au serveur, des
cartes-bonus, une poussière d'or qui achète et dore — est-il **juste**
(personne ne gagne une œuvre, une étoile, de la poussière ou des confettis
sans les mériter), **secret** (aucune réponse ne part au téléphone avant la
révélation — invariant 1) et **cloisonné** (un profil n'agit jamais sur le
bien d'un autre) ? Consignes : `consignes-audit.md`.

**Où regarder** : `shared/cabinet/` (le pli `partie.ts`, `lecture.ts`,
`chrono.ts`, `musee.ts`, `pouvoirs.ts`, `jeux/*.ts`), `server/src/cabinet.ts`
(les routes), `server/src/core/cabinet/` (`magasin.ts`, `ecriture.ts`,
`vue.ts`, `tables.ts`, `gardiens.ts`, `tirages/`), `server/src/core/porteDeLaCampagne.ts` ;
la règle `.claude/rules/cabinet.md` et ses pièges ; `docs/reference/api-http.md`
(la section du Cabinet), `docs/produit/le-cabinet.md` ; les tests
`server/test/cabinet-*.test.ts` (`cabinet-secret`, `cabinet-routes`,
`cabinet-charge`, `cabinet-poussiere`, `cabinet-pouvoirs`), et le banc du
Cabinet, `server/test/cabinet-banc.ts`.

**Ce que tu cherches** :
- **Le secret** : tout ce que renvoie chaque route, champ par champ, avant
  la révélation — la bonne réponse, l'année d'un nouveau venu, le titre juste
  du Détail, le lieu, la personne, le mot de la réplique, la valeur du Filet,
  une rechange de Changer, la graine d'une partie ou de la visite, l'œuvre
  visée d'une case de la visite ; la zone d'Éclairer qu'on pourrait rejouer
  ou recouper d'une partie à l'autre ; une image du Détail atteinte avant son
  cadrage ; ce qu'un refus dit (un message qui trahirait la réponse).
- **Le chrono** : un geste après l'échéance et sa grâce, la pause de
  « Quitter ? » usée pour gagner du temps, « Prendre son temps » sans la
  carte, une réponse « auto » forgée, le rang d'un geste (invariant 12) :
  périmé, en avance, rejoué.
- **Les gestes forgés** : un geste d'un autre jeu, une manche qui n'est pas
  la sienne, un index négatif, `NaN`, une chaîne de dix mille signes, un
  objet là où l'on attend un nombre, `__proto__`/`constructor` comme clé
  d'œuvre ou de carte ; une carte-bonus qu'il n'a pas, un Divin, un joker de
  l'Expédition ; Éclairer deux fois, Changer à la Frise.
- **Le compte des récompenses** : une pièce juste comptée deux fois (deux
  onglets, deux serveurs, une réponse rejouée), un confetti ou de
  l'expérience pour une partie quittée, une case de la visite rejouée, une
  chasse de trop, les libres payées au-delà de cinq, la poussière d'or (un
  achat sans le solde, deux achats au même instant, une dorure deux fois, un
  prix forgé), une œuvre ou un gardien gagnés sans le seuil.
- **Le cloisonnement** : la partie, le cartel, l'image, les murs d'un autre
  profil ; un identifiant de partie deviné ; un profil supprimé qui laisse
  des lignes (`cabinet_gestes`, `cabinet_profils`, `cabinet_oeuvres`).

**Hors de ton angle** : la sobriété de la base (`cabinet-sobriete`),
l'équilibre des barèmes (`cabinet-equilibre`), la tenue du code
(`cabinet-code`).
