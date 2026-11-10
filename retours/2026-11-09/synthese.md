# La tablée de soirée du 9 novembre 2026 — le salon ouvert depuis un profil

La dernière tablée d'une vraie soirée datait du 24 septembre, et son
animatrice arrivait par un compte à activer : le chemin d'avant le 3 octobre.
Celle-ci rejoue la soirée de la première tablée — « Les 40 ans de Sam », les
mêmes sept invités — par le chemin d'aujourd'hui : Nadia se crée un profil,
touche « Créer un salon », branche la télé par son code et anime depuis la
barre de son téléphone, en jouant (`npm run tablee -- --sans-animateur`, skill
`tablee`, « Le salon ouvert depuis un profil »).

Huit agents, chacun dans son Chromium, de 20 h 23 à 20 h 55 : 32 minutes,
926 gestes, deux quiz (dix questions composées par l'application, quatre
écrites par Nadia), sept joueurs. La chronologie : `chronologie.md`. Les
retours, tels quels : `nadia.md`, `jeanne.md`, `lucas.md`, `sofia.md`,
`camille-d.md`, `camille-m.md`, `karim.md`, `hugo.md`.

## En bref

- **Le chemin tient.** De l'accueil à la salle ouverte : dix minutes, sans
  aide, un profil et deux quiz compris. Nadia ne s'est levée vers la télé
  qu'une fois. Ses notes : 4, 3, 4, 4 sur 5 ; celles des invités qui ont
  joué : 4 ou 5 pour entrer.
- **Deux incidents ont marqué la soirée**, que six retours sur huit donnent
  pour des bugs. Vérifiés un à un : la question reposée « qui ne revient
  pas » vient du banc, pas de l'application ; les équipes « qui n'existent
  pas » sont un vrai trou du produit, que le banc a aggravé.
- **Trois frictions confirmées dans le code** viennent derrière : « Révéler »
  sans garde-fou, la préparation du salon qui se perd, la soirée qu'on ne
  peut pas nommer.

Chaque axe dit son statut : **confirmé** (rejoué, ou lu dans le code),
**probable** (cohérent avec le code, pas rejoué), **non vérifié**, ou
**écarté**.

## Les axes, du plus important au moins important

### 1. Les équipes ne rattrapent pas ceux qui sont déjà dans la salle — confirmé

**Ce qui se passe.** « Brancher » la télé ouvre la salle : le QR paraît, les
invités entrent. Nadia, elle, est encore sur « Nouveau salon », ses équipes
pas choisies. Quatre invités sont entrés en trente secondes (20 h 29 min 12) ;
les équipes n'ont été posées qu'à « Ouvrir le salon » (20 h 29 min 41). Les
deux arrivés ensuite ont choisi la leur à l'entrée ; les quatre premiers
sont restés « sans équipe » jusqu'à la clôture.

**Rejoué** (`reproductions/equipes-apres-coup.mts`) : pour un invité déjà en
salle d'attente quand les équipes arrivent, le téléphone montre bien la
carte « Les équipes » et un bouton « Choisir mon équipe ». Mais :

- rien ne l'y invite : une carte de plus, sous le classement, sans un mot ;
- le bouton disparaît dès qu'un quiz est lancé — à la révélation, la carte
  reste sans lui ; au podium, il n'y a plus rien ;
- il ne revient qu'une fois le quiz terminé. Nadia a enchaîné son second
  quiz depuis le podium du premier (« Quiz suivant ») : il n'est jamais
  revenu ;
- la barre du chef sait renommer ou ajouter une équipe, pas y ranger
  quelqu'un.

**La part du banc.** Les quatre invités attendaient la première question dans
un geste qui ne rend pas la main (`question 540`) : aucun n'a regardé son
téléphone entre la création des équipes et le lancement, treize minutes plus
tard (le journal n'a pas un geste d'eux dans cet intervalle). Un humain
aurait peut-être vu la carte. Leurs retours disent « aucun bouton, jamais » :
c'est faux pour la salle d'attente, vrai ensuite.

**Ce que ça coûte.** « L'équipe qui l'emporte : Les Randonneurs » — Nadia
seule. Le souvenir répète « sans équipe — aucun point à donner » sous quatre
prénoms. C'était son envie pour mélanger les générations.

**Pistes.**
- Ne montrer le QR qu'à « Ouvrir le salon », ou poser les équipes dès
  qu'elles sont choisies, avant que la télé n'ouvre la porte.
- Quand des équipes paraissent, le dire à ceux qui sont en salle d'attente
  (le choix ouvert de lui-même, là seulement).
- Laisser le chef ranger un invité depuis sa barre.
- **Tension avec un parti pris** : le choix ne s'ouvre plus seul après un
  podium, parce que rejoindre une équipe à ce moment retournait le vainqueur
  annoncé (`PlayerApp.tsx`). Rouvrir le choix entre deux quiz se décide avec
  cela en tête.

**Depuis (le 9 novembre 2026).** Deux des pistes sont faites : tant que
personne n'a marqué, la carte « Choisis ton équipe » monte en tête de la
salle d'attente, son choix ouvert (`choixDEquipeOuvert`) ; et le chef range
un invité depuis « ⋯ », sous « Sans équipe », même en plein quiz. La télé
branchée ouvre toujours la salle avant « Ouvrir le salon », et le choix ne
se rouvre pas de lui-même entre deux quiz : le parti pris tient.

### 2. « Révéler » part au premier toucher, même à une réponse sur sept — confirmé

**Ce qui se passe.** À la question 6, Nadia a touché « Révéler » alors
qu'elle seule avait répondu : la question est partie pour toute la salle. Le
bouton occupe la place exacte de « Question suivante » de l'écran d'avant —
elle redoute le double toucher (`captures/nadia-revele-trop-tot.png`).
`BarreDuChef.tsx` confirme « Annuler les points » et « Terminer ce quiz »,
pas « Révéler ».

Le même défaut au dernier podium : le gros bouton doré devient « Terminer la
soirée », à la place où se trouvait « Quiz suivant », et clôt d'un toucher
(`onClick={clore}`) — quand le même geste, pris dans le menu « ⋯ », demande
« Terminer la soirée ? ».

**Ce que ça coûte.** C'est l'origine de l'incident de la soirée : près de
trois minutes perdues, une question annulée. Et une soirée close par un
doigt qui glisse ne se rouvre pas.

**Piste.** Une confirmation sur « Révéler » tant que moins de la moitié a
répondu, ou une seconde de garde sur ce bouton après « Question suivante » ;
la confirmation du menu sur le gros « Terminer la soirée ».

**Depuis (le 9 novembre 2026).** Fait, les trois : « Révéler » demande tant
que moins de la moitié a répondu (`revelationPrecoce`), les gestes qui
avancent la partie attendent la demi-seconde de la console après un
changement d'écran (`gesteAccepte`), et le gros « Terminer la soirée »
demande comme celui du menu.

### 3. Quitter « Nouveau salon » efface la préparation — confirmé

**Ce qui se passe.** Le quiz composé se joue à vingt secondes la question ;
rien dans le salon ne le dit ni ne le règle. Pour le changer : « Mes quiz »,
la fiche, « Modifier les questions », « Régler tout le quiz ». Au retour, le
salon était vide — ni quiz, ni équipes
(`captures/nadia-salon-brouillon-perdu.png`). `SalonApp.tsx` n'écrit le
programme et les réglages qu'à « Ouvrir le salon ». Après une première
soirée, la même page se souvient de tout.

**Ce que ça coûte.** Cinq minutes sur dix de préparation, tout refait.

**Pistes.** Garder le brouillon. Ouvrir la carte d'un quiz depuis le salon :
ses questions sans les réponses (Nadia joue aussi, et l'éditeur les montre),
et son temps par question.

**Depuis (le 9 novembre 2026).** Le brouillon se garde : du premier
changement à « Ouvrir le salon », la page écrit sa préparation sur le
téléphone (`BrouillonDuSalon`, `client/src/chef.ts`) et la retrouve au
retour — le nom, les quiz et leurs points, l'écran, les équipes. Le crayon
d'une carte mène à ce quiz dans « Mes quiz ». Restent : voir les questions
sans leurs réponses depuis le salon (l'éditeur les montre toujours à qui
joue aussi), et régler le temps par question sans quitter la page.

### 4. Une soirée ouverte depuis un salon ne se nomme pas — confirmé

La télé dit « La soirée de Nadia », le souvenir et le bilan « Soirée du
9 novembre 2026 ». Nadia voulait « Les 40 ans de Sam » : son seul recours a
été l'intertitre d'une question. La barre du chef clôt sans titre
(`clore()`, `socketDuChef.ts`, envoie une charge vide), quand l'écran commun
en demande un. C'est le lien qu'on envoie à la famille.

**Depuis (le 9 novembre 2026).** « Nouveau salon » s'ouvre sur « Le nom de
la soirée » : écrit à « Ouvrir le salon », il fait le titre de l'entrée et
de la télé (`reglagesAuNom`), et une clôture sans titre — la barre du chef,
le dernier quiz d'un programme, le QG — range la soirée sous ce nom tant
que l'historique ne lui en connaît qu'un automatique. Le nom reste celui de
l'espace : il est proposé de nouveau à la soirée suivante.

### 5. Qui n'a pas répondu ? — idée

La barre dit « Révéler 5/7 », la télé « 5 / 7 ont répondu » : nulle part les
deux prénoms qui manquent. Nadia n'a su qu'à la révélation que Lucas n'avait
pas répondu.

**Depuis (le 9 novembre 2026).** La barre du chef les nomme, toute la
question, sur une ligne au-dessus de ses gestes : « On attend Lucas et
Mamie », trois prénoms au plus puis « et 4 autres », les téléphones éteints
d'abord, et « On n'attend plus que toi » quand c'est le chef que la salle
attend (`phraseDesAttendus`, `shared/console.ts`) ; « ⋯ » les donne tous. La
vue d'animateur les portait déjà, pour la console de l'écran commun ; aucun
téléphone d'invité ne les reçoit, et la télé ne les affiche pas. Au
passage : « Réponse enregistrée » se posait sous la barre, où le chef ne la
lisait jamais — elle est remontée au-dessus.

### 6. « Question suivante » n'affiche pas ce qui vaut au podium — probable

Passée de « Au clic » à « 10 s » pendant le premier quiz, Nadia a lu
« Au clic » coché au podium ; le second quiz a enchaîné seul, et sa première
révélation est partie avant la fin de son commentaire. Le menu lit le réglage
dans la vue de la partie (`v.autoNextSeconds ?? null`, `BarreDuChef.tsx`) et
un quiz neuf reprend celui du précédent (`lancement.autoNextSeconds`,
`games/quiz.ts`). Pas rejoué.

**Depuis (le 9 novembre 2026).** Confirmé, puis corrigé. La vue d'animateur
ne portait l'enchaînement que pendant une question : au podium, au choix du
quiz, au « Prêts ? » et pendant la mesure d'une estimation en direct, son
absence se lisait « au clic ». Elle le porte à chaque phase
(`enchainement.test.ts`), et le régler au podium vaut pour le quiz suivant.
Un second défaut, à l'inverse, se cachait derrière : la barre reposait à
chaque quiz — et à chaque rechargement de la page — le rythme choisi en
ouvrant le salon, et un chef passé « au clic » en cours de route retrouvait
ses cinq secondes au quiz d'après. Elle retient maintenant celui qu'il
choisit dans « ⋯ ». Rejoué dans Chromium : dix secondes réglées à la
première question, « 10 s » coché au podium, au second quiz, et page
rechargée.

### 7. Au retour du réseau, « +190 pts » et « Trop tard » ensemble — probable

Karim a répondu réseau coupé. Au retour : ses points, et l'alerte « Trop
tard — la question était finie » (`captures/karim-reseau-retabli.png`). La
réponse était comptée. Le renvoi d'une réponse arrive sans doute après la
révélation et dit son refus par-dessus l'accusé du premier envoi. Pas rejoué.

**Depuis (le 10 novembre 2026).** Rejoué, confirmé, corrigé
(`reproductions/reponse-reseau-coupe.mts`, qui écrit chaque trame). Hors
ligne, Chromium garde la réponse dans l'ancienne liaison et la livre au
retour du réseau : le serveur l'inscrit — Karim était le dernier attendu,
la question se clôt —, et son accusé repart vers une liaison que la page a
déjà abandonnée. Le renvoi arrive par la liaison neuve, après la
révélation, et recevait « trop tard ». Le serveur confirme maintenant le
renvoi de la réponse qu'il tient déjà, pour la même question et le même
tour (`dejaInscrite`, `games/quiz.ts`) : Karim lit « Ta réponse est bien
arrivée » et ses points. Une autre réponse que celle inscrite reste « trop
tard ». Le cas ne tient pas au banc : un téléphone qui sort d'un tunnel
laisse la même liaison à moitié morte derrière lui.

Reste de son retour, non traité : « Envoi… » en bas de l'écran lui a paru
trop discret pendant la coupure, et rien ne dit après une veille quelle
question on a manquée.

### 8. Sans le code, « c'est chez Nadia » ne mène nulle part — non vérifié

Un salon tire une adresse neutre (`s-6sxscz`) et un code à six chiffres. Sur
l'accueil, Camille M. n'a vu ni champ de code ni « Rejoindre » au premier
niveau — seulement les trois gros boutons. Elle n'a pas touché « Jouer sans
compte », où il se trouve peut-être. À regarder : où tape-t-on un code quand
on n'a ni profil ni QR ?

### 9. Jouer à son propre quiz — idée

« Je joue aussi » vaut pour toute la soirée. Nadia a fait 800 sur 800 au
quiz qu'elle avait écrit, et fini première de l'anniversaire de son frère.
Elle aurait voulu jouer le premier quiz et seulement animer le sien.

### 10. Le son de la télé — idée

« Activer le son » ne se touche que sur la télé. Rien sur le téléphone de
Nadia ne le lui a dit. Qu'il ait manqué à la soirée est sa déduction, pas un
constat.

### 11. Le lecteur d'écran — non vérifié, sauf les fragments

Hugo a joué les deux quiz et fini deuxième : question, révélation, podium et
bilan se lisent. Deux gênes :
- aucune annonce des changements d'écran dans ce que rend `lecteur`. Ce geste
  lit l'arbre, pas les annonces : à vérifier avec un vrai lecteur d'écran ;
- des textes en morceaux, lus tels quels dans l'arbre : « joueur » « s »,
  « + » puis « 200 pts », « 50 » « S ».

### 12. L'expérience écrite de trois façons — non vérifié

Sofia a lu « 7 XP → niv. 2 », puis « 7 / 180 XP vers le niveau 3 », puis
« 173 XP → niv. 3 » : le même « 7 » veut dire « il reste » puis « gagnés ».

### 13. L'estimation de Lucas — non confirmé, à rejouer

Une estimation sur trois, tapée 1,8 s après l'ouverture au profil iPhone,
n'a pas été enregistrée (« Pas de réponse »). Ma tentative de la rejouer n'a
rien conclu. Une réponse perdue serait grave : à reprendre.

### 14. Détails

- Les points d'équipe : « 2 membres · 2535 pts au total » à côté de
  « 1368 points d'équipe ». La moyenne ne s'explique que dans le bilan.
- Des pastilles se chevauchent : « +57 XP » sur l'équipe gagnante au
  téléphone, « En pause » sur le début d'une réponse à la télé.
- « Annuler les points de cette question ? » : deux boutons, « Annuler » et
  « Annuler les points ».
- Un pseudo de plus de 24 caractères est coupé sans un mot.
- « Culture générale », dans le quiz tout prêt, est une catégorie étroite ;
  ce qu'on appelle ainsi, c'est « Toutes ».
- « Ajouter un autre quiz » dit « Pas encore de quiz prêt à jouer » quand les
  deux quiz sont déjà dans le salon.
- « 13 questions » à la fin, quatorze posées : la question annulée ne se dit
  pas.
- « Créer un salon » est à moitié sous le menu du bas de l'accueil, et
  l'accueil d'avant le profil ne dit pas qu'on peut animer.
- L'éditeur prévient qu'un quiz de quatre questions ne rapporte pas
  d'expérience au podium, puis le podium affiche « +18 XP » : celle des
  réponses, sans doute, mais rien ne le dit.

## Écarté : ce qui vient du banc

- **« Reposer la question ne la repose que pour l'animatrice »** — six
  retours. Rejoué dans Chromium (`reproductions/question-reposee.mts`) : la
  question revient sur chaque téléphone, celui qui n'avait pas répondu
  compris. Le geste `question` de la régie ne rendait une question reposée
  qu'à l'agent qui y avait déjà répondu ; révélée à une réponse sur sept,
  elle est revenue deux fois, cinquante secondes chacune, sans qu'aucun
  invité l'apprenne. Le journal le montre : tous étaient dans ce geste
  pendant les deux fenêtres. **Corrigé dans la régie.**
- **Des lettres perdues dans l'éditeur, avec `React error #185`.** Rejoué
  (`reproductions/editeur-frappe.mts`) : seulement à 0 ms entre deux
  touches, la vitesse du pilote. À 10 ms et plus, rien. Pas un bug pour un
  doigt. L'exception dit tout de même qu'une frappe y déclenche une cascade
  de rendus : à regarder un jour, sans urgence.
- **Camille M. n'est jamais entrée.** Ma consigne du jour lui faisait guetter
  « Code » sur la télé, qui l'écrit en capitales : elle a attendu vingt-sept
  minutes. Son seul constat utile est l'axe 8.
- **« La bonne réponse : 2 » sans texte** — trois retours. La réponse
  s'écrivait « 2 » : c'était son texte.
- Nadia a répondu « un poumon » parce que `repondre "2"` vise la deuxième
  réponse ; son `voir` ne rendait pas de références.

## Ce qui plaît, et qu'il ne faut pas casser

- **Brancher la télé par un code** : une adresse à taper sur la télé, six
  lettres sur le téléphone. « Le meilleur moment de la préparation. »
- **« Nouveau salon »** : quatre questions, dans l'ordre où on se les pose.
- **Le quiz tout prêt** : trois touches, et le résumé avant de composer
  (« facile · ≈ 5 min · dont 2 estimations »). Les questions étaient
  faciles, variées, chacune avec son « Le saviez-vous ? ».
- **« Coller une liste »** et **« Régler tout le quiz »** dans l'éditeur, au
  téléphone.
- **La barre du chef** : « Révéler 5/7 » pendant qu'on joue, la pause, le
  code et son QR à lire à voix haute.
- **Le QR et le code restent sur la télé toute la soirée** : Karim est entré
  en retard sans rien demander.
- **« Annuler les points »** : la question ratée est sortie proprement des
  scores et du bilan.
- **Le lendemain** : le souvenir et son palmarès, un lien par invité, et le
  salon qui se souvient des quiz et des équipes.
- **L'entrée d'un invité** : « Jouer sans compte » en trois touchers ; un
  rechargement en pleine question rend la même question, au bon chrono.
- **Les formes des réponses** suffisent à Camille D., daltonienne.

## Ce que cette tablée a changé au banc

- La régie tient une télé branchée (`/tele`) pour un écran commun.
- Le geste `question` rend une question reposée à qui n'y avait pas répondu.
- Une fiche et des consignes pour ce chemin : `personas/nadia-salon.md`,
  `consignes-chef.md`.

## Les limites de cette tablée

- **Un agent qui attend ne regarde pas son téléphone.** Les deux plus gros
  « bugs » du jour en viennent. La prochaine fois : faire regarder la salle
  d'attente à intervalles (`question 60`, puis `voir`), plutôt qu'une seule
  attente de neuf minutes.
- Les agents ont répondu en deux secondes à des questions de cinquante : la
  durée d'une question n'a rien mesuré.
- Sept joueurs sur huit : Camille M. n'a pas joué, et le cas des deux
  Camille au même renard ne s'est pas présenté.
- Chromium seulement, sans son ; le clavier et la veille sont simulés.
- La console classique (`/host`) et l'éditeur à l'ordinateur n'ont pas été
  rejoués : c'était l'objet des tablées de septembre.
