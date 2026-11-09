# Les légendaires du Cabinet — garder l'envie des autres voies

*Le 9 novembre 2026, d'après le retour du propriétaire : « Dans le cabinet, on
peut avoir les légendaires alors que certains sont super durs à avoir.
Pourrais-tu réfléchir pour avoir quand même envie de débloquer aussi via les
autres conditions d'obtention ? »*

Rien de ce qui suit n'est construit. Cette page est à valider : les choix
ouverts sont en fin de page.

## 1. Le constat, chiffré

- **Vingt et un légendaires se gagnent au bout d'une traversée** : les vingt
  de `LEGENDAIRES_DU_CABINET`, plus la Citrouille à Halloween. Chaque
  traversée gagnée en donne un, **choisi** parmi les trois gardiens vaincus.
- **Les gardiens sont tirés parmi ceux qu'il n'a pas** (`choisirLesGardiens`).
  Le Cabinet sert donc toujours un légendaire neuf.
- **Le gardien de l'acte III est le prix le plus évident**, et ce sont les plus
  durs ailleurs : la Comète (400 fois parmi les plus rapides), l'Ouroboros
  (cent jours d'affilée), la Chimère (les trois mondes à la fois), le Dragon,
  le Kraken, le Trou noir. Au moment du choix, on prend celui qu'on n'aurait
  jamais eu autrement.
- **Le temps qu'il faut** (calibrage de la version 3 : le moyen gagne 25
  traversées sur cent, le fort 84, une vingtaine de minutes chacune) :
  - le joueur fort a les vingt et un en **25 traversées environ, 8 à
    9 heures** ;
  - le joueur moyen en **85 traversées environ, une trentaine d'heures** ;
  - par leur voie d'origine, la Comète demande des dizaines de soirées,
    l'Ouroboros trois mois sans manquer un jour, le Lion huit soirées
    gagnées à huit joueurs au moins.
- **Une fois le légendaire en main, sa voie d'origine meurt.** L'album le
  montre en couleur. Sa jauge (« 212 sur 400 ») ne compte plus pour rien :
  rien ne la montre comme un but, et la finir ne rapporte rien.

Le problème ne vient pas du Cabinet, qui donne ce qu'il promet (« un
légendaire au bout »). Il vient de ce qu'**une seconde voie vers un même
légendaire ne vaut rien** une fois la première prise.

## 2. Le principe en une phrase

> **Le Cabinet te donne le gardien. Son exploit te donne son sceau.**

On ne retire rien au Cabinet : on y gagne toujours le légendaire et on le
porte. Mais la voie d'origine (en soirée, au quiz du jour, en campagne) garde
un prix à elle, **visible des autres**, qu'aucune traversée ne donne. Le
légendaire porté sans son sceau reste beau. Avec son sceau, il dit
« celui-là, je l'ai mérité à la loyale ».

Ça respecte les règles de la maison :

- **Rien n'est repris** (invariant 22) : qui a un légendaire du Cabinet le
  garde tel quel. Le sceau est un ajout.
- **Aucun avantage de jeu** (invariant 8) : un ornement, de l'expérience, un
  trophée. Rien qui joue.
- **Une dérivation pure** (invariants 14 et 20) : « tenir la voie d'origine »,
  c'est `conditionTenue` sur ses voies sans `cabinet:` ni `expedition:`, lu
  des hauts faits déjà rangés. Le passé se relit tout seul : qui tenait déjà
  la Comète en soirée a son sceau dès le premier démarrage.
- **Pas de cinquième notion au Cabinet** : la traversée ne change pas.

## 3. Ce que je propose, en trois étages

### A. La jauge reste vivante (le plus simple, à faire de toute façon)

Dans l'album, la fiche d'un légendaire qu'on a **par le Cabinet** garde sa
voie d'origine, avec sa jauge, sous un titre neuf : « Son sceau : 212 sur 400
fois parmi les plus rapides ». « Les plus proches » de l'album le compte comme
un but, au même titre qu'un trophée.

*Coût* : `shared/album.ts` (`voiesDeLAvatar`), la fiche de l'album. Aucun
écran neuf.

### B. Le sceau, visible partout (le cœur de la proposition)

Un légendaire tenu par sa voie d'origine porte **un petit sceau d'or** au bas
de son médaillon : une pastille dessinée en SVG, sans peinture neuve, comme la
bordure de ligue. Il se voit partout où l'avatar se voit : la salle, l'écran
commun, la carte du joueur, le classement du jour. C'est ce qui donne envie :
**les autres le voient**. À la soirée, la Comète scellée de Camille dit
« 400 réflexes », celle de Hugo dit « une traversée ».

- La fiche de la carte et de l'album le dit en mots : « Scellé : 400 fois
  parmi les plus rapides », ou « Gardien du Cabinet ».
- La loge peut le masquer, comme la version rare d'un Éclat (`eteint`) : on
  ne force personne à l'afficher.
- Il passe par le même chemin que l'Éclat (`ApparenceDeLAvatar`, `Avatar`,
  `badgeDe`) : une règle « un joueur n'a qu'un avatar » de plus à tenir, que
  `un-seul-avatar.test.ts` vérifie.
- Les légendaires sans voie d'origine — le Djinn, tout entier au Cabinet — et
  ceux qui ne se gagnent pas au Cabinet (la Licorne, l'Aigle, l'Éléphant, les
  fêtes sans gardien) sont tous scellés d'office : on n'a pu les avoir que
  « à la loyale ». Autre lecture possible : pas de sceau pour eux, puisqu'il
  n'y a rien à distinguer. *Choix ouvert n° 2.*

*Coût* : un champ de plus dans ce que la salle voit d'un avatar, un dessin
SVG, la loge (« Montrer le sceau »), la carte. Aucune peinture.

### C. Une piste pour les collectionneurs

**Le Conservateur** (nom à choisir) compte les légendaires scellés, en trois
métaux, par exemple **5 · 12 · 20**. Il paie ses paliers comme toute piste
(`XP_PALIER`) et peut ouvrir un titre (« Conservateur »), une gerbe ou un fond
au métal d'or. C'est un but à long terme qui donne une raison de jouer
**chaque** mode : pour les sceaux, le Cabinet ne suffit plus.

*Coût* : une piste de plus (`shared/hautsfaits.ts`, sa rareté dans
`PART_DES_JOUEURS`, sa ligne dans `baremes.md`). C'est un choix de produit :
ses seuils se mesurent d'abord (`calibrage.ts` pour les soirées, estimés pour
le reste).

## 4. Ce que je ne propose pas, et pourquoi

- **Rendre le Cabinet plus avare** : retirer l'acte III du choix, n'offrir
  qu'un légendaire par semaine, demander trois victoires sur le même gardien.
  Ça punit le joueur du Cabinet sans rendre le reste plus désirable, et ça
  revient sur « un légendaire au bout », que tu as validé le 31 octobre.
- **Une version « pétrifiée » du légendaire au Cabinet, que l’exploit
  « réveillerait »** : très désirable, mais il faudrait vingt et une peintures,
  et ceux qui l'ont déjà gagné au Cabinet seraient soit déclassés (interdit,
  invariant 22), soit laissés intacts (deux règles pour un même légendaire).
- **Un Éclat offert à la voie d'origine** : simple à brancher, mais un Éclat
  s'achète et se dépense sur n'importe quel avatar. Ce serait une monnaie, pas
  une marque d'honneur liée à *ce* légendaire.
- **Faire avancer la voie d'origine par la traversée** (un gardien vaincu
  vaut « +1 fois ») : ça brouille les deux voies au lieu de les distinguer.

## 5. Les choix ouverts

1. **Les étages** : A seul, A + B (ma recommandation), ou A + B + C ?
2. **Le Djinn et les légendaires sans gardien** : scellés d'office, ou sans
   sceau ?
3. **Le nom** : « le sceau », « Scellé », « à la loyale », « mérité » ?
4. **Masquable dans la loge**, ou toujours visible ?
5. **La piste C** : ses seuils (5 · 12 · 20 ?) et ce que l'or ouvre.

Une fois ces choix faits, la suite habituelle : la maquette du sceau sur une
planche (360 × 640 et l'écran commun), puis la règle, ses tests, la doc.
