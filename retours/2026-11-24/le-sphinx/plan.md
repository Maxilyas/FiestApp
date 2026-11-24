# Le Sphinx de l'accueil : le plan

Le 24 novembre 2026, après la maquette (`README.md`, `sphinx.html`) et les
énigmes résolues à l'aveugle (`enigmes-candidates.json`). Ce document dit ce
qu'on construit, ce qui reste secret, où chaque morceau vit dans le code, et
ce que le propriétaire doit trancher avant la première ligne.

## Ce qu'on construit

Parfois, sur l'accueil d'un habitué, le Sphinx apparaît. Il présente les
Divins, nomme **le Divin du moment** — le même pour tout le serveur — et
propose une énigme. Résolue, elle dévoile à ce joueur un mot de la phrase de
ce Divin : un mot que personne n'avait encore, si possible. Chacun voit ses
mots, et combien tous les habitués en ont trouvé ensemble, jamais lesquels :
pour lire la phrase entière, il faut se parler. Refusée, la visite attend
jusqu'à minuit, le Sphinx épinglé au bas de l'accueil.

Pour les profils seulement : un invité anonyme ne voit rien (invariant 8).
Aucun avantage de jeu : un mot est une connaissance, pas un bonus.

## Ce qui reste secret

**La phrase d'un Divin est sa légende** (`core/divins.ts`, `DivinDescendu.legende`) :
ce que le serveur raconte à celui sur qui il descend, et qui « en dit presque
autant que la règle ». Les dix-huit en comptent de 10 à 21 mots ; 149 à
trouver, 101 de trois lettres ou moins. **Parmi ces petits mots, 14 sont des
nombres** (« six », « dix »…) : offerts, ils donneraient le seuil d'une règle
pour rien. Un nombre, quelle que soit sa longueur, se cache donc toujours —
environ 9 mots à trouver par Divin.

**L'invariant 21 change, et il faut l'écrire.** Aujourd'hui : « les règles des
Divins ne quittent jamais le serveur… le récit à leur seul porteur ». Proposé :

> 21. **Les règles des Divins ne quittent jamais le serveur, et leurs légendes
> ne le quittent que mot à mot.** Elles vivent dans `core/divins.ts` ; ni
> `shared/` ni `client/` ne l'importent ni n'en recopient une ligne, la
> documentation non plus. Le serveur envoie la légende entière au seul porteur
> du Divin ; à un habitué, les mots que le Sphinx lui a soufflés, la forme de
> la phrase (la longueur des mots cachés, les petits mots offerts, jamais un
> nombre) et combien tous en ont trouvé, jamais lesquels. [Si la décision 2
> le veut : une phrase reconstituée par tous se montre à tous.]

**Les réponses des énigmes ne quittent pas le serveur avant le verdict.**
Elles vivent dans `server/content/sphinx/enigmes.json`, jamais dans `shared/`
(le paquet du navigateur les emporterait). La page reçoit les vers, la
source, les essais qui restent ; la solution seulement une fois l'énigme
résolue, perdue ou abandonnée. Le QG ne la montre jamais sans un geste :
l'administrateur joue aussi.

## Côté serveur

**Qui est un habitué** : au moins 4 jours joués sur les 7 derniers, jour de
Paris, tous modes confondus — quiz du jour, campagne (séries, sentiers,
parcours, défi, duels, révisions), Cabinet, soirées qui comptent. C'est ce
que les missions lisent déjà (`activiteDesJours`, `shared/missions.ts`) : la
visite se décide dans la même lecture, sans un aller-retour de plus
(`missions-charge.test.ts` compte ceux qui se suivent).

**La visite du jour** : tirée d'une graine `profil|jour` (`hasardDe`, comme
les missions), une chance sur trois, au plus une par jour, et **figée** à la
première lecture (une ligne `ON CONFLICT DO NOTHING`, comme
`tirerLesMissions`) — deux serveurs pendant une mise en ligne tirent la même.
Pas de visite si le Divin du moment n'a plus de mot à lui donner, ou s'il le
porte déjà (il en connaît la légende).

**L'énigme** : jamais une qu'il a déjà vue ; faciles d'abord, puis mêlées
(`difficulte`, mesurée à l'aveugle). Les huit que le propriétaire a déjà vues
— les trois de la maquette, cinq réponses dites dans la conversation —
comptent pour vues dès la mise en route (un drapeau dans `meta`).

**Le mot** : parmi les mots cachés qu'il n'a pas, d'abord un que personne n'a
encore, sinon au hasard de sa graine. Tiré quand l'énigme est résolue, pas
avant : deux joueurs qui résolvent ensemble le dernier mot inconnu de tous
reçoivent l'un ce mot, l'autre un mot déjà trouvé — personne ne repart les
mains vides.

**La réponse** : trois essais, une réponse qui « brûle » n'en coûte pas, lue
sans accents ni article (`normaliser`, une fonction pure partagée avec les
tests) ; « Je donne ma langue au chat » clôt la visite. Une écriture à la fois
par profil (`unALaFois`, comme les missions), un accusé à chaque geste.

**Le Divin du moment** : une liste ordonnée, écrite dans `core/sphinx.ts`
(`ORDRE_DU_SPHINX`, décision 3). Le Divin du moment est le premier dont les
habitués n'ont pas encore trouvé tous les mots — une dérivation de leurs
lignes, rien d'écrit à côté. Le compte de tous se lit d'une requête
(`COUNT(DISTINCT mot)`), gardé en mémoire jusqu'au mot suivant.

**La base permanente** (invariant 2 : ça doit survivre) :
- `profile_sphinx` — une ligne par visite : profil, jour, énigme, Divin,
  état (`proposee`, `plus-tard`, `resolue`, `perdue`, `abandonnee`), essais,
  mot gagné, dates. Ses mots, ses énigmes vues et le compte de tous s'en
  dérivent.
- Aucune table du Divin du moment : il se déduit des lignes et de l'ordre.

**Les routes** :
- `GET /api/joueur/sphinx` — la visite, demandée quand elle s'ouvre : les
  répliques, la vitrine, la forme de la phrase, ses mots, le compte de tous,
  l'énigme (ses vers, sa source, ses essais).
- `POST /api/joueur/sphinx` — un geste (`ecouter`, `plus-tard`, `repondre`,
  `chat`) et son verdict.
- `MissionsDuJour.sphinx` — un seul champ de plus à ce que l'accueil lit
  déjà : une visite attend, ou il est épinglé.

**L'ouverture** : une page de plus dans la maintenance (`PAGES_EN_MAINTENANCE`,
`'sphinx'`), avec ses trois états et ses testeurs (règle `qg.md`) : d'abord
« bientôt » et ouverte aux testeurs, puis à tous — sans un drapeau dans le
code.

## Côté écran

- `client/src/components/Sphinx.tsx`, chargé à la demande : seul un accueil
  où une visite attend le télécharge, avec la découpe et le médaillon du
  Sphinx (déjà peints, `client/public/medaillons`) et la police pixel,
  hébergée avec sa licence comme Cormorant et Figtree — aucune dépendance de
  plus.
- Posé **par-dessus** l'accueil, jamais dedans : l'accueil est réglé au pixel
  en 360 × 640 (`accueil-compact.test.ts`, `rendu-accueil.ts`). L'épingle du
  « plus tard » ne passe ni sur un bouton ni sous la niche du compagnon.
- **Muet par défaut** : l'application ne fait jamais sonner un téléphone
  (`client/src/sound.ts` : « cinquante téléphones qui bipent… »), et une
  visite surprise dans un transport ne doit pas bipper. Un haut-parleur dans
  la boîte l'allume, retenu sur le téléphone. La vibration de l'arrivée reste.
- L'album : la fiche du Divin du moment montre sa phrase — ses mots, ses
  traits, le compte de tous — **à tout profil**, habitué ou non, avec « Le
  Sphinx ne parle qu'aux habitués : joue 4 jours sur 7 ». Ce qui donne envie
  de revenir.
- Moins de mouvement (texte d'un coup, sans mosaïque ni sable), lecteur
  d'écran (la réplique entière, pas lettre par lettre), texte agrandi à 130 %.

## Les tests (`server/test/`, chacun rouge avant le code)

- `sphinx.test.ts`, sur un serveur jetable (`banc.ts`) : seul un habitué est
  visité, une fois par jour, la même visite après un rechargement et sur un
  second serveur ; la réponse ne part jamais avant le verdict ; seuls ses
  mots et la forme de la phrase partent, jamais un nombre offert ; trois
  essais, le « brûlant » gratuit ; le mot va d'abord à qui personne n'a ; deux
  joueurs sur le dernier mot ; le Divin du moment passe au suivant ; une
  énigme ne revient jamais ; les huit du propriétaire comptent pour vues ;
  la page fermée répond 423, ouverte à ses testeurs seulement.
- `sphinx-pur.test.ts` : `normaliser`, le tirage, la forme de la phrase — les
  dérivations pures, directement.
- `divins.test.ts` étendu : `client/` et `shared/` n'importent toujours pas
  `core/divins.ts`, ni `server/content/sphinx/` ; la documentation ne cite
  aucune légende.
- `missions-charge.test.ts` : la visite ne coûte pas un aller-retour de plus.
- `server/scripts/rendu-sphinx.ts` : la visite au doigt, en 360 × 640 et
  390 × 844, l'Ivoire, le texte agrandi ; et `rendu-accueil.ts` relancé.

## La documentation, dans le même commit que le code

- `docs/architecture/decisions.md` : « Le Sphinx de l'accueil », et
  l'invariant 21 réécrit (`CLAUDE.md`, règle `recompenses.md`).
- `.claude/rules/sphinx.md`, et sa ligne dans la carte de `CLAUDE.md`.
- `docs/reference/` : les routes (`api-http.md`), la table
  (`base-de-donnees.md`), le barème (`baremes.md` : 4 jours sur 7, une chance
  sur trois, trois essais).
- `docs/produit/le-sphinx.md` — sans une réponse ni une légende
  (`divins.test.ts` relit `docs/`).

## Le rythme

Un mot trouvé à environ six énigmes sur dix (le joueur ordinaire : 25 sur 40
au premier lot). Avec une visite tous les trois jours, cinq habitués trouvent
environ un mot par jour : un Divin tous les neuf ou dix jours ; dix habitués,
tous les cinq jours. Les 86 pièces de départ (55 énigmes, 31 charades)
durent environ huit mois à un habitué ; la réserve grandira de même (le livre
a d'autres charades, et ses énigmes traduites de l'italien, de l'espagnol,
de l'anglais et de l'allemand). Une charade se présente comme telle :
« La charade n° 697 ».

## Les étapes

1. **Le serveur, sans écran** : le contenu, `core/sphinx.ts`, la table, les
   routes, le champ des missions, l'invariant 21, ses tests et sa
   documentation. `npm run verify`.
2. **Les écrans** : la visite (la maquette, en composant), l'épingle, l'album,
   la police, le haut-parleur ; `rendu-sphinx.ts` et `rendu-accueil.ts`.
3. **Le QG et l'ouverture** : le Divin du moment, le compte de tous, les
   visites et la réussite par énigme (les réponses sous un geste) ; la page
   « bientôt » ouverte aux testeurs en préproduction, puis en production, puis
   à tous.

## À trancher avant de commencer

1. **L'invariant 21 réécrit**, tel que proposé plus haut.
2. **Une phrase reconstituée par tous se montre-t-elle à tous ?** Recommandé :
   oui — l'affiche de nouveauté l'annonce (« La phrase de Chronos est
   reconstituée, grâce à Léa, Tom et Mamie »), l'album la montre entière, et
   le Sphinx passe au Divin suivant. C'est ton idée de départ, « dévoiler au
   serveur entier » ; sans elle, la légende ne circule que par la parole.
3. **L'ordre des Divins du moment.** Recommandé : d'abord celui dont la règle
   se tente le plus facilement, pour qu'une phrase dévoilée donne vite un
   premier Divin descendu.
4. **Le barème** : habitué à 4 jours sur 7, une chance sur trois par jour,
   trois essais.
5. **Muet par défaut**, la vibration gardée.
