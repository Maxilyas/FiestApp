# Les décisions

> Pourquoi FiestApp est construite comme elle l'est : 145 décisions structurantes, domaine par domaine, chacune avec son contexte, ce qui a été décidé et ce que cela implique aujourd'hui. Pour qui s'apprête à changer une règle et veut savoir ce qu'elle protège.

Le dépôt garde le *pourquoi* de chaque choix au plus près du code : dans ses commentaires, dans les règles de `.claude/rules/`, dans l'[historique](../contribuer/historique.md). Cette page les rassemble, à la manière des « Architecture Decision Records » : un contexte, une décision, ses conséquences, et les fichiers où elle vit. Les invariants de `CLAUDE.md` en sont la forme la plus courte — [la vue d'ensemble de l'architecture](vue-d-ensemble.md) les explique un par un.

**Dans cette page** : [L'ensemble](#lensemble) · [Le quiz](#le-quiz) · [La salle et le temps réel](#la-salle-et-le-temps-réel) · [La fin de soirée et les archives](#la-fin-de-soirée-et-les-archives) · [Les données et la mise en ligne](#les-données-et-la-mise-en-ligne) · [Les comptes, la sécurité et le QG](#les-comptes-la-sécurité-et-le-qg) · [La page](#la-page) · [L'expérience et les récompenses](#lexpérience-et-les-récompenses) · [Le profil](#le-profil) · [Les confettis et la boutique](#les-confettis-et-la-boutique) · [Les quiz](#les-quiz) · [Le quiz du jour](#le-quiz-du-jour) · [La campagne](#la-campagne) · [Les sentiers du savoir](#les-sentiers-du-savoir) · [Les duels](#les-duels) · [L'Expédition](#lexpédition) · [L'outillage](#loutillage)

## L'ensemble

Le détail : [la vue d'ensemble de l'architecture](../architecture/vue-d-ensemble.md).

### Un seul processus sert l'API, le temps réel et le client
**Contexte** : FiestApp s'héberge sur une instance gratuite, ou sur le PC d'une soirée, et chaque invité arrive par l'adresse d'un QR.

**Décision** : Express et Socket.io partagent un même serveur HTTP (`createServer(app)`), qui sert aussi le client compilé ; en développement seulement, Vite sert les pages et relaie le reste.

**Conséquence** : une seule chose à héberger et une seule origine : la politique de contenu n'ouvre le temps réel qu'à l'hôte demandé, et en ligne une connexion temps réel ou une écriture de l'API qui annonce une autre origine que l'origine publique est refusée.

*Fichiers : `server/src/server.ts`, `server/src/auth/http.ts`, `client/vite.config.ts`*

### La soirée en local, le reste dans une base permanente, un miroir entre les deux
**Contexte** : le disque de l'offre gratuite s'efface à chaque réveil, et une réponse d'invité ne doit jamais attendre une base distante.

**Décision** : la soirée en cours vit dans une base SQLite locale, jetable et synchrone ; tout ce qui doit survivre vit dans libSQL (Turso en ligne) ; chaque écriture de la soirée — sauf son nom, qui part sur-le-champ — rejoint une file par espace qui la recopie au miroir (`party_*`), et le démarrage recharge le miroir dans une base locale vide (`restoreInto`).

**Conséquence** : un réveil en pleine soirée la reprend ; la file insiste jusqu'au succès, et ses gains et réponses portent un `uid` tiré à l'écriture locale pour un rejeu sans doublon ; l'état d'une partie part avec ses gains, en une transaction ; la clôture efface le miroir avant la base locale ; jamais la même base Turso pour la production et la préproduction.

*Fichiers : `server/src/core/db.ts`, `server/src/core/backup.ts`, `server/src/core/distante.ts`*

### Un moteur sans règles, un module de jeu sans base ni réseau
**Contexte** : la bonne réponse ne doit jamais atteindre un téléphone avant la révélation, et une partie doit survivre à un redémarrage.

**Décision** : `GameEngine` route réponses, commandes et chronomètres, persiste l'état avec les échéances et rediffuse ; le module (`quizModule`) porte toutes les règles, n'agit que par le `GameContext` qu'on lui prête et ne rend que des vues filtrées (`playerView`, `hostView`).

**Conséquence** : une partie à la fois par espace ; les chronomètres se réarment au redémarrage (`restore`) ; le module promet `vueDependDesAutres: false`, et une simple réponse ne recalcule que la vue de son auteur et celle de l'écran commun.

*Fichiers : `server/src/core/engine.ts`, `server/src/core/types.ts`, `server/src/games/quiz.ts`*

### Tout se dérive des journaux, par des fonctions pures
**Contexte** : le souvenir, le bilan, le palmarès et l'expérience se lisent sur la soirée en cours comme sur les soirées passées, et un barème finit toujours par changer.

**Décision** : les journaux (gains, réponses) font foi, et tout le reste s'en dérive par des fonctions pures, dans `shared/` et `server/src/core/` ; la soirée en cours et une archive passent par les mêmes (`liveRecap` et `recapOfArchive` appellent `buildRecap`).

**Conséquence** : une amélioration profite aux soirées passées ; l'expérience de tout l'historique se recalcule au démarrage quand `VERSION_BAREME` monte ; ces règles se testent sans serveur.

*Fichiers : `server/src/core/recap.ts`, `server/src/core/review.ts`, `server/src/core/archive.ts`, `server/src/core/recalcul.ts`*

### Un compte est un espace, cloisonné par son identifiant
**Contexte** : plusieurs animateurs partagent un serveur, et aucun ne doit voir les soirées, les quiz ni les archives d'un autre.

**Décision** : l'identifiant d'un compte est le `space_id` de chaque ligne de la soirée, du miroir, de la bibliothèque et de l'historique ; une route d'animateur lit l'espace dans la session, jamais dans la requête — une page publique, dans son adresse ; une connexion temps réel s'attache à un espace une fois pour toutes ; la personne, elle, est un profil, dans une autre table.

**Conséquence** : un identifiant d'un autre espace vaut « introuvable », et le voisin n'en sait rien ; `accounts.id` ne bouge jamais, et comptes et profils ne se fusionnent pas (`accounts.profile_id` dit qui tient l'espace).

*Fichiers : `server/src/auth/store.ts`, `server/src/api.ts`, `server/src/sockets.ts`*

### Chaque réveil est un démarrage : démarrer vite, et sans tsx
**Contexte** : l'offre gratuite endort le service après un quart d'heure sans trafic, et le premier invité qui scanne le QR attend la fin du démarrage.

**Décision** : après les comptes, les magasins s'ouvrent de front (`deFront`, treize branches aujourd'hui) ; le serveur part en un seul fichier construit par esbuild (`server/dist/index.mjs`), lancé par `exec node` ; tout chemin se compte depuis `SERVEUR`.

**Conséquence** : soixante allers-retours en série (trois secondes) et la traduction du TypeScript par tsx (0,8 à 1 s de processeur, 40 Mo) disparaissent du réveil ; `SIGTERM` atteint le serveur, qui éteint ses chronomètres et vide son miroir ; un chemin compté depuis l'`import.meta.url` d'un module casserait le paquet sans une erreur.

*Fichiers : `server/src/server.ts`, `server/scripts/empaqueter.ts`, `server/src/racine.ts`, `render.yaml`*

### Rien ne tourne à heure fixe
**Contexte** : l'hébergeur gratuit dort la nuit et entre deux soirées : une tâche planifiée à minuit ne tournerait pas.

**Décision** : ce qui se fait à une heure se fait à la première demande qui suit — la nuit du quiz du jour (`clorePasses`), les semaines passées du défi, l'ajustement du modèle d'Automate quand il a vieilli ; seul le rappel du soir regarde l'heure, chaque minute, et il compte sur un service externe qui garde la production éveillée en journée en appelant `/healthz`.

**Conséquence** : aucun planificateur dans le dépôt ; `/healthz` répond toujours 200, sans quoi l'hébergeur redémarrerait l'instance, disque et file du miroir perdus.

*Fichiers : `server/src/core/jour.ts`, `server/src/core/rappels.ts`, `server/src/server.ts`*

### Une panne ne doit éteindre qu'elle-même
**Contexte** : toutes les soirées de tous les espaces vivent dans un seul processus, et une exception dans un écouteur Socket.io — un `player:action` sans charge, un `party:watch` sans accusé — l'arrêtait.

**Décision** : chaque message passe par `ecouter()` (la charge en objet, l'accusé en fonction, l'exception au journal avec un accusé de panne) ; un chronomètre attrape ses propres exceptions ; une fois le serveur prêt, le filet d'`index.ts` garde le processus en vie ; une erreur faite pour être lue est un `new Error('…')` nu, et toute autre devient une réponse neutre.

**Conséquence** : un message malformé ne coûte qu'un accusé de panne, une route en panne qu'un 500 sans pile ; un démarrage raté, lui, s'arrête net, code 1, pour que l'hébergeur le voie.

*Fichiers : `server/src/sockets.ts`, `server/src/core/engine.ts`, `server/src/core/http.ts`, `server/src/index.ts`*

## Le quiz

Le détail : [les questions](../produit/les-questions.md).

### Toute la logique au serveur, des vues filtrées
**Contexte** : la bonne réponse, l'anecdote, la photo de la révélation, les bonnes cases de « plusieurs » et le bon ordre trahissent une question s'ils arrivent au téléphone avant la révélation ; la note de l'animateur, l'extrait d'un blind test et le programme n'ont rien à faire chez les invités.

**Décision** : le module de jeu tient seul l'état de la partie ; chaque écran reçoit une vue calculée pour lui (`playerView`, `hostView`), et pendant une question celle d'un téléphone ne porte que sa propre réponse (`vueDependDesAutres: false`).

**Conséquence** : une réponse ne recalcule que deux vues — la sienne et celle de l'écran commun —, ce qui tient une salle de cinq cents ; un champ de plus dans une vue se décide au regard de l'invariant 1.

*Fichiers : `server/src/games/quiz.ts`, `shared/games/quiz.ts`, `server/src/core/engine.ts`*

### Le temps de lire est offert au QCM
**Contexte** : le bonus de rapidité fondait dès l'affichage, alors que toute la salle lit d'abord la question et ses réponses : ce temps-là coûtait des points, et davantage à qui lit moins vite ou joue loin de l'écran.

**Décision** : le bonus ne fond qu'après un temps de lecture — 1 s, plus 55 ms par caractère, plus 1,5 s pour une photo, jamais plus de la moitié du chrono — et une bonne réponse vaut de 100 à 200 points, la part de Kahoot.

**Conséquence** : la seconde moitié du chrono reste une course ; le quiz du jour paie avec la même formule ; un retardataire qui n'a plus le temps de lire joue à partir de la question suivante.

*Fichiers : `server/src/games/quiz.ts`, `server/src/core/jour.ts`*

### L'estimation se paie à la distance, à l'échelle de la salle
**Contexte** : au rang, à deux joueurs, le plus proche touchait 200 points et l'autre 30, qu'il ait tapé 8,2 ou 800 pour 8 ; en échelle linéaire, une seule faute de frappe (« 19940 » pour 1994) donnait le plein de points à toute la salle ; et la virgule flottante mettait 0,7 et 0,9 à des distances différentes de 0,8.

**Décision** : 30 points pour avoir proposé, plus 170 × 2^(−écart ÷ écart typique) ; l'écart typique est la médiane des écarts, jamais sous deux crans du dernier chiffre de la réponse ni au-dessus de la réponse ; l'écart se compte sur les nombres tapés (`ecartEstimation`).

**Conséquence** : la même distance vaut les mêmes points de part et d'autre de la réponse ; trois ans sur une date ne pèsent pas trois kilomètres ; la valeur d'une proposition aberrante ne déplace pas la médiane.

*Fichiers : `server/src/games/quiz.ts`, `shared/classement.ts`*

### Le dernier envoi fait foi, heure comprise
**Contexte** : un doigt qui glisse sur un téléphone tenu dans le noir ne doit pas coûter la question ; mais une première réponse tapée au hasard ne doit pas réserver le bonus de rapidité.

**Décision** : on change d'avis jusqu'à la révélation, et la dernière réponse compte avec son heure ; la même réponse renvoyée — un double appui, un accusé perdu — est confirmée sans rien réécrire.

**Conséquence** : se raviser coûte du bonus, ce qui est le compromis voulu ; retoucher une réponse perdue en route ne coûte rien.

*Fichiers : `server/src/games/quiz.ts`*

### La marge, le souffle, et la salle vide qui attend
**Contexte** : avec 400 ms de marge, les réponses de dernière seconde en 4G mouraient en route ; une révélation déclenchée à l'instant de la dernière réponse jetait celle d'un voisin arrivée une fraction après ; le 24 septembre 2026, une coupure a fait jouer trois questions et un podium à personne.

**Décision** : la question reste ouverte 1,5 s après l'échéance (`GRACE_MS`) ; la dernière réponse attendue révèle 0,7 s plus tard, délai relancé par un changement d'avis (`SETTLE_MS`) ; une question close d'elle-même sans une seule réponse suspend l'enchaînement (`autoNextSuspendu`), et un téléphone en veille reste attendu — seul l'animateur décide de ne plus attendre un téléphone mort (`dispenses`).

**Conséquence** : le chronomètre reste la borne qui tranche ; rien ne se révèle dans le dos d'un réseau qui hoquette, ni devant une salle vide.

*Fichiers : `server/src/games/quiz.ts`*

### Un geste dit ce qu'il visait
**Contexte** : « Suivant » se lisait selon la phase du moment : un « Révéler » parti juste avant la révélation automatique arrivait après elle et passait à la question suivante — la salle avait vu la bonne réponse 96 ms ; une annulation confirmée après que la partie avait avancé retirait les points de la question suivante.

**Décision** : `next`, `cancel`, `replay` et `cible` portent la phase, la question et le tour (`round`) que l'animateur avait sous les yeux, une réponse la question et le tour ; périmé, un geste est ignoré en silence, une réponse reçoit `too-late` ; un champ absent (une page d'avant) garde l'ancien comportement. La console ignore en plus les gestes une demi-seconde après chaque changement de phase (`GARDE_APRES_PHASE_MS`) : le second clic d'un double-clic vise bien l'écran qu'il a sous les yeux.

**Conséquence** : une commande de plus qui change la phase se range dans `perimee`, sinon un double clic la joue deux fois.

*Fichiers : `server/src/games/quiz.ts`, `shared/console.ts`, `client/src/games/quiz/HostView.tsx`*

### Les équipes à la moyenne, question par question, chaque ligne gardant son équipe
**Contexte** : diviser le total par les membres du moment faisait tomber une moyenne de 1 280 à 640 à l'arrivée d'Inès après le quiz, et donnait à l'autre équipe la victoire qu'on venait d'annoncer ; Malik, qui changeait d'équipe, emportait ses points ; les points au rang (6, 5, 4…) faisaient valoir 6 points à 1 400 de moyenne ; un prix à 100 points renversait la victoire au moment de la remise.

**Décision** : pour chaque question, la moyenne des lignes du journal écrites pour l'équipe — chaque ligne fige l'équipe de son joueur —, sommée puis arrondie à la fin ; les points d'équipe sont cette moyenne plus les prix, et un prix vaut 0 point d'office (`POINTS_D_UN_PRIX`, le 12 octobre 2026).

**Conséquence** : un retardataire ou un déménagement ne change plus un verdict ; la salle, le souvenir, le bilan et l'historique lisent la même règle, archives comprises.

*Fichiers : `shared/teams.ts`, `server/src/core/teams.ts`*

### Le retardataire ne compte jamais pour une question close
**Contexte** : compté pour une question révélée, en mesure, que toute la salle avait finie, ou qu'il n'avait pas le temps de lire, un invité qui arrivait entrait au journal d'une question jamais vue, baissait la moyenne de son équipe et lisait « Pas de réponse » au lieu de « Bienvenue » (l'arbitrage du 27 septembre 2026).

**Décision** : il joue à partir de la question suivante dès que la sienne est close (`playFrom`, `onPlayerJoin`) ; « Reposer » la lui rend ; tant qu'il n'a rien joué, il n'a pas de place au classement.

**Conséquence** : l'attente (`awaited`), le journal (`logQuestion`), le classement et les candidats d'un sondage appliquent tous le même filtre — un compte de plus qui l'oublierait ferait attendre la salle pour un fantôme.

*Fichiers : `server/src/games/quiz.ts`*

## La salle et le temps réel

Le détail : [le temps réel](../architecture/temps-reel.md).

### La fiche du serveur fait foi, et un jeton périmé n'est jamais recréé
**Contexte** : un téléphone qui se réveille renvoyait le prénom qu'il avait retenu, et le surnom que l'animateur venait de donner à « GrosLourd » retombait ; un jeton que la soirée ne connaissait plus recréait un invité en silence — l'exclu revenait, l'habitué d'avant la clôture atterrissait sans équipe ; et une tablette connectée au profil de celle qui jouait déjà sur son téléphone lui faisait une seconde fiche, l'expérience de l'une écrasant celle de l'autre (50 au lieu de 128).

**Décision** : un `player:join` qui porte un jeton reconnu est une re-présentation — prénom et avatar envoyés sont ignorés ; la fiche du profil présent ce soir l'emporte sur le jeton (un profil, une fiche par soirée) ; un jeton qui ne désigne plus personne est refusé (`unknown-token`), jamais recréé, et le téléphone repasse par l'entrée, pré-remplie.

**Conséquence** : le serveur doit savoir dire pourquoi un jeton ne vaut plus — il retient les fins de la dernière clôture (`soiree-close`) et les jetons effacés (exclusion, essai), et propose la dernière soirée close après un redémarrage (`derniere`) ; le prénom d'une fiche ne se redéclare jamais, pas même depuis le second appareil d'un profil.

*Fichiers : `server/src/sockets.ts`, `server/src/core/party.ts`, `client/src/views/PlayerApp.tsx`*

### Une place se rend par le code de l'animateur, avec un jeton neuf
**Contexte** : un téléphone mort emporte son jeton ; le nouveau ne pouvait qu'inscrire un second « Rachid », dont les points ne rejoignent jamais ceux du premier. Rendre la place sur parole — un prénom retapé — la donnerait à quiconque tape « Rachid ».

**Décision** : l'animateur, qui voit l'invité en face, fait paraître un code de six chiffres, valable trois minutes, une seule fois, et seulement après « Montrer le code » : sa console est peut-être projetée. La reprise donne un **jeton neuf** ; jamais de code pour une fiche à profil, que le téléphone recevrait ensuite avec son identifiant, son expérience et les récits de ses Divins — se connecter au profil la rend. Un code faux est refusé, jamais puni d'une coupure (coupée par le serveur, une connexion ne se reconnecte plus) ; les essais se comptent par connexion et par espace, et la console est prévenue d'une rafale.

**Conséquence** : l'ancien téléphone, rallumé, ne désigne plus personne ; le second Rachid s'efface s'il n'a rien joué, reste sinon avec ses points, et la reprise attend la révélation s'il a une réponse en suspens.

*Fichiers : `server/src/core/places.ts`, `server/src/sockets.ts`, `server/src/core/space.ts`, `client/src/components/Absents.tsx`*

### Deux instantanés, dédoublonnés et regroupés à la taille de la salle
**Contexte** : chaque veille d'écran basculait un `connected` et renvoyait la salle entière à chaque téléphone — un gigaoctet pour une vague d'arrivées à 300 invités ; chaque envoi aux téléphones coûte à proportion de la salle, et une vague d'arrivées une par une en faisait autant de diffusions.

**Décision** : deux versions de l'instantané — les téléphones sans `connected` (l'entrée compte les inscrits, un homonyme hors ligne se demande au serveur par `player:horsLigne`), les écrans d'animateur avec, plus le wifi, la santé du miroir, la scène, la télécommande, la fin en route ; chacune ne repart que si elle a changé, regroupée en 120 ms pour les écrans et 120 ms plus 2 ms par inscrit pour les téléphones ; l'auteur d'un geste reçoit la sienne sur-le-champ (à 500 invités, « tu entres à la prochaine question » restait une seconde en pleine question) ; un filet renvoie tout, forcé, toutes les cinq minutes.

**Conséquence** : un champ qui change à chaque tick n'entre jamais dans l'instantané (invariant 4), ce qui ne regarde que l'animateur va dans `enPlusPourLesEcrans`, et `sendSnapshot`, qui part sans attendre et annule le regroupement, reste réservé aux changements rares.

*Fichiers : `server/src/core/space.ts`, `server/src/sockets.ts`, `server/src/server.ts`*

### La scène des écrans de fin est tenue par le serveur
**Contexte** : le podium de la soirée, la remise des prix et l'écran de victoire étaient un état de la page : ouverte à la télécommande, la remise des prix ne passait pas à la télé ; et une autre console qui ouvrait le podium pendant une question le posait sur la télé, pendant que les téléphones répondaient à une question que la salle ne voyait plus.

**Décision** : `host:scene` pose la scène de tous les écrans d'animateur de l'espace, et elle voyage dans leur instantané ; le geste dit l'écran qu'il quittait (`depuis`) ; rien ne s'ouvre par-dessus une partie ouverte ; la clôture ne se pose que par la fin de soirée, et ne se quitte que vers la salle d'attente.

**Conséquence** : « Remise des prix », au podium d'un quiz, referme d'abord la partie (`host:endSession`) ; la scène vit en mémoire, et un redémarrage ramène la salle d'attente.

*Fichiers : `server/src/core/space.ts`, `server/src/sockets.ts`, `client/src/views/HostApp.tsx`*

### Deux liaisons pour le chef d'un salon
**Contexte** : le chef joue et anime sur le même téléphone ; une seule liaison recevrait les vues de partie en double, sans dire à quel rôle elles s'adressent, et une session d'animateur qui tombe couperait aussi le joueur.

**Décision** : la barre du chef ouvre une seconde liaison, celle de l'animateur, chargée à la demande sur le seul téléphone qui a ouvert le salon ; elle se présente par la session de son cookie et se déclare télécommande à chaque connexion ; de la vue d'animateur, elle ne lit rien de la question.

**Conséquence** : le serveur n'a rien à apprendre — deux poignées de main ; la télé branchée garde ses coulisses pour la barre. Les gestes de la barre partent sans attendre leur accusé ni se renvoyer, à la différence de ceux de la console (`envoyerCommande`).

*Fichiers : `client/src/socketDuChef.ts`, `client/src/components/BarreDuChef.tsx`, `client/src/chef.ts`*

### Le code du salon remplace le prénom dans l'adresse, et vit dans la base permanente
**Contexte** : chaque animateur ayant son salon, les adresses au prénom devenaient « chez-antoine-2 », un prénom s'écrivait dans une adresse publique, et le téléphone ouvrait le clavier des lettres.

**Décision** : un code de six chiffres, tiré à l'ouverture du salon, qu'on tape dans « Rejoindre une soirée » ou qu'on suit par `/<code>`, redirigé vers l'adresse de l'espace ; gardé dans la base permanente — l'hébergeur efface le disque à chaque réveil, et le code d'un salon ouvert doit survivre à un redémarrage en pleine soirée — et en mémoire ; valable encore trente minutes après la clôture ; vingt codes manqués par adresse, puis deux par minute.

**Conséquence** : six chiffres ne sont jamais le nom d'un espace (`isValidSlug`) ; un écran d'animateur qui se présente pendant le sursis rouvre le même code ; passé le sursis, la photo d'un QR de la veille ne mène plus nulle part.

*Fichiers : `server/src/core/salons.ts`, `server/src/server.ts`, `server/src/core/apercus.ts`, `shared/space.ts`*

### Une liaison muette se sonde avant qu'on renvoie
**Contexte** : avec les réglages par défaut, une liaison morte se voyait en 43,6 secondes — plus qu'une question entière ; un téléphone qui sort de veille garde souvent une liaison que socket.io croit vivante (un wifi sans internet), et ce qui s'y écrit se perd sans un mot ; renvoyé aussitôt, le message repartait dans la même liaison morte. Et socket.io rejoue ce qu'on a émis hors ligne avant l'événement `connect`, donc avant que la page se re-présente.

**Décision** : un battement de cœur de 10 + 8 secondes ; une sonde (`time:sync`, deux secondes) au retour au premier plan, au retour du réseau et quand un accusé tarde, qui rouvre la liaison muette ; la réponse sans accusé (4 s) et le geste de console (3 s) sont renvoyés une fois, après la sonde ; une réponse porte son espace et son jeton, et chaque geste d'animateur relit la session de la poignée de main.

**Conséquence** : un renvoi n'est sûr que parce que chaque geste dit ce qu'il vise et qu'une réponse identique est confirmée sans rien réécrire ; `demander` n'émet qu'une fois, sur une liaison et un réseau présents — confiée à une liaison coupée, une inscription partait deux fois, « Camille » et « Camille (2) ».

*Fichiers : `client/src/socket.ts`, `server/src/server.ts`, `server/src/sockets.ts`, `server/test/liaison-morte.test.ts`*

### Les chronomètres se lisent à l'heure du serveur, et l'horloge peut sauter
**Contexte** : les échéances sont des instants du serveur, et chaque écran les comparait à sa propre horloge ; un téléphone en retard de cinq secondes affichait du temps qui n'existait plus, et ses réponses arrivaient après la clôture — toujours les mêmes personnes. Au quiz du jour, un recalage de l'horloge de trente secondes fermait ensuite chaque question dès son affichage.

**Décision** : l'écart se mesure à chaque connexion, trois fois, et l'on garde la mesure à l'aller-retour le plus court ; mais deux mesures incompatibles — au-delà de la demi-somme de leurs allers-retours, plus 500 ms — disent que l'horloge a sauté, et la plus récente gagne, même plus lente (`bestSample`).

**Conséquence** : tout chronomètre lit `serverNow()`, jamais `Date.now()` (invariant 6) — la barre de temps, le décompte, la régie, les codes de la télé et de « Rendre sa place », et le renvoi d'une réponse.

*Fichiers : `shared/clock.ts`, `client/src/clock.ts`, `client/src/socket.ts`*

## La fin de soirée et les archives

Le détail : [après la soirée](../produit/apres-la-soiree.md).

### Une soirée archivée est une copie brute, relue avec le code du jour
**Contexte** : le souvenir, le bilan, les chiffres et les prix ne disent rien que les journaux ne disent déjà ; un précalcul figerait les erreurs du soir où il a été fait.

**Décision** : l'archive garde les invités, les équipes, les prix remis, les deux journaux (gains, réponses) et les quiz tels qu'ils ont été posés, sans rien de calculé ; chaque page se dérive à la lecture, par les mêmes fonctions pures que la soirée en cours (invariant 14).

**Conséquence** : une amélioration du bilan ou des prix profite aux soirées passées, et un prix redéfini change d'un coup le souvenir de toutes les soirées — l'étagère des profils, elle, ne suit qu'au prochain `VERSION_BAREME`. La liste de l'historique lit une fiche de faits bruts rangée à côté de l'archive, jamais l'archive entière.

*Fichiers : `server/src/core/archive.ts`, `server/src/core/recap.ts`, `server/src/core/review.ts`, `server/src/core/stats.ts`*

### Le nom d'une soirée se tire une fois, à sa première question jouée
**Contexte** : recalculé, le nom comptait l'expérience deux fois et dédoublait l'archive ; daté à l'arrivée d'un invité, il donnait à la soirée le jour où l'invitée revenait relire la veille, ou celui du QR testé la veille.

**Décision** : `soireeEnCours` le tire une fois, daté à l'heure de la révélation de la première réponse au journal (`soireeDesInvites`), avec une empreinte de l'espace (`archiveIdOf`) ; toute écriture permanente sous ce nom passe d'abord par `recopierSoiree` (invariant 11).

**Conséquence** : ni une exclusion ni un redémarrage ne le changent ; seules la clôture et l'essai effacé l'oublient (`viderSoiree`). Les soirées d'avant l'empreinte pouvant porter le même nom d'un espace à l'autre, toute soirée se désigne par `(espace, nom)` partout où l'on en compare plusieurs (`cleDeSoiree`).

*Fichiers : `server/src/core/archive.ts`, `server/src/core/space.ts`*

### Une seule fin à la fois, et rien ne s'efface avant d'être écrit au loin
**Contexte** : deux clôtures croisées recréditaient les profils, réannonçaient la soirée devant un podium vide et effaçaient l'invité entré entre les deux ; un miroir qui refusait d'effacer faisait lire « c'est fini » à une soirée qui continuait.

**Décision** : `finEnRoute` — un second « Clore » attend le premier et en reçoit l'issue, le geste contraire est refusé ; le miroir s'efface avant la base locale, et la fin de soirée ne part qu'une fois la soirée effacée (invariants 13 et 18). Toute porte de clôture passe par `cloreLaSoiree` — l'écran commun, la barre du chef, le QG.

**Conséquence** : un miroir muet laisse la soirée entière, et la console dit « Rien n'a été effacé : … » ; on réessaie. Une exception reste à ramener : « Terminer le quiz » sur le dernier quiz d'un programme clôt par `considererCloture`, hors de `cloreLaSoiree`.

*Fichiers : `server/src/sockets.ts`, `server/src/core/space.ts`, `server/src/core/backup.ts`*

### Ce qui ne se juge qu'une fois tout joué se décide à la clôture, en un seul lot
**Contexte** : le podium de la soirée changeait de mains d'un quiz à l'autre, l'expérience ne doit jamais redescendre en cours de soirée, et un prix change de lauréat quand un invité est exclu — ses réponses quittent le journal.

**Décision** : l'expérience d'un quiz se crédite à son verdict, ligne `(profil, soirée)` remplacée, jamais ajoutée ; à la clôture, le podium de la soirée et l'assiduité entrent dans cette ligne, puis prix, hauts faits, Divins et légendaires de saison sont remplacés en un seul lot (`remplacerRecompensesDeSoiree`), les paliers en dernier (`accorderPaliers`) — invariant 10.

**Conséquence** : recréditer ne paie jamais deux fois ; le recalcul du démarrage et le retrait d'une soirée passent par les mêmes lignes ; un invité exclu rend ce qu'il avait reçu.

*Fichiers : `server/src/core/space.ts`, `server/src/auth/profiles.ts`, `server/src/core/recalcul.ts`*

### Un prix se remet pour le plaisir
**Contexte** : un prix remis valait cent points ajoutés à la moyenne de l'équipe, et la remise renversait la victoire qu'on venait d'annoncer (le choix du propriétaire, le 12 octobre 2026).

**Décision** : un prix vaut d'office zéro point (`POINTS_D_UN_PRIX`), l'animateur peut lui en donner jusqu'à `PRIX_MAX`, en plus ou en moins, et la remise dit avant le clic ce qu'ils changeraient ; un prix ne rapporte jamais d'expérience (invariant 19) ; le palmarès se range sur l'étagère des profils à la clôture, remis ou non.

**Conséquence** : une animatrice qui épargne un prix à voix haute le retrouve au souvenir ; la console le dit (« Pour le plaisir : … »).

*Fichiers : `shared/teams.ts`, `server/src/core/stats.ts`, `client/src/views/HostApp.tsx`*

### Un seul lauréat par prix, et la carte dit comment il a été départagé
**Contexte** : départagés par le prénom seul, Alice à 3 sur 3 battait Zoé à 30 sur 30 parce que « A » vient avant « Z » ; sans départage, le prix changeait de mains à chaque rechargement.

**Décision** : à valeur égale, le volume (le prix tenu sur le plus de questions), puis l'ordre d'affichage commun (`ordreDAffichage`) ; les ex æquo départagés s'écrivent sur la carte (« Ex æquo avec Zoé — départagé par ordre alphabétique »).

**Conséquence** : le prix est stable d'une page à l'autre — une tension avec l'invariant 15 (« tous les ex æquo en tête gagnent »), notée dans le code, à arbitrer.

*Fichiers : `server/src/core/stats.ts`, `client/src/components/AwardsBoard.tsx`*

### Une estimation se juge au coup d'œil, et la précision ne compte que les QCM
**Contexte** : l'écart en pour cent mesurait la question plus que le joueur — trois ans sur 1994 font 0,15 %, trois sur 54 en font 6 % —, une faute de frappe triplait la moyenne d'une soirée, et compter les estimations au dénominateur faisait lire « 1/64 justes ».

**Décision** : le coup d'œil — la part de la salle qu'une estimation bat ou égale (`coupDOeil`) — juge les estimations ; la précision ne compte que les QCM et dit toujours sur combien (« 3 justes sur 4 QCM »).

**Conséquence** : les deux ne se fondent jamais en un seul chiffre ; Le Compas dans l'Œil se juge au coup d'œil, la fiche de carrière et la carte lisent le même.

*Fichiers : `server/src/core/journal.ts`, `server/src/core/stats.ts`, `client/src/format.ts`*

### Entre deux soirées, les pages de l'espace montrent la dernière close
**Contexte** : la clôture efface la soirée en cours, et l'invité qui rouvrait le lendemain le souvenir scanné au podium lisait « La soirée n'a pas encore commencé ».

**Décision** : tant que la suivante n'a rien joué, `recap.json` et `bilan.json` joignent la dernière soirée close et sa page (`derniere`), que le souvenir et le bilan montrent à sa place, sans redirection ; le téléphone, lui, rouvre sa fin au retour sur la page pendant douze heures et propose « La dernière soirée » sept jours.

**Conséquence** : le QR du podium mène encore à la soirée le lendemain, et la page revient d'elle-même à la suivante dès sa première question ; une base distante muette ne prive que de ce lien.

*Fichiers : `server/src/server.ts`, `shared/liens.ts`, `client/src/state.ts`*

## Les données et la mise en ligne

Le détail : [les données](../architecture/donnees.md).

### Deux bases : la soirée en local, tout le reste dans Turso
**Contexte** : l'offre gratuite de l'hébergeur efface le disque à chaque réveil, et le moteur d'une soirée doit écrire sans attendre le réseau au milieu d'une question.

**Décision** : la soirée en cours vit dans une base SQLite locale, synchrone et jetable ; tout ce qui doit survivre — comptes, profils, quiz, historique, quiz du jour, campagne — vit dans la base permanente (Turso), avec une copie de la soirée, le miroir.

**Conséquence** : un réveil sur disque effacé recharge la soirée du miroir, au démarrage, si la base locale est vide ; la clôture vide la base locale de l'espace ; en ligne, le serveur refuse de démarrer sans `QUIZ_DB_URL` — il démarrait sur un fichier local, et tout disparaissait au premier réveil.

*Fichiers : `server/src/core/db.ts`, `server/src/core/backup.ts`, `server/src/index.ts`*

### Le miroir ne perd rien tant que le processus vit
**Contexte** : le miroir abandonnait une écriture refusée après un avertissement — une panne pendant l'arrivée de Bob laissait, au réveil, Alice à zéro et Bob inconnu ; un identifiant tiré à l'envoi changeait à chaque recopie rejouée, et un gain comptait deux fois ; un processus tué entre une révélation et ses gains faisait payer la question deux fois.

**Décision** : une file par espace, ordonnée, qui réessaie jusqu'au succès ; l'`uid` de chaque gain et de chaque réponse tiré à l'écriture locale ; l'état de la partie envoyé dans la même transaction que ses gains et ses réponses (`ouvrirLot`, `fermerLot`) ; « Sauvegarde en retard » à l'écran commun après dix secondes d'échecs.

**Conséquence** : un rejeu ne double rien ; mais la file vit en mémoire — l'arrêt lui accorde dix secondes, et un arrêt net la perd.

*Fichiers : `server/src/core/backup.ts`, `server/src/core/scores.ts`, `server/src/core/answers.ts`, `server/src/core/engine.ts`*

### Effacer le miroir avant la base locale, et ne jamais effacer en resynchronisant
**Contexte** : la clôture vidait la base locale avant le miroir — un miroir qui refusait laissait l'écran dire « Rien n'a été effacé » devant une salle vide, et l'ancienne soirée ressuscitait au réveil ; et un PC de secours lancé sur de vieux essais, pointé sur la production, aurait vidé la vraie soirée par une resynchronisation qui efface.

**Décision** : la remise à zéro suspend la file, efface le miroir de l'espace, et ne laisse vider la base locale qu'une fois le miroir effacé ; la resynchronisation n'envoie que ce qui manque ou a changé, et n'efface jamais rien.

**Conséquence** : une clôture refusée par Turso laisse la soirée entière ; ce qu'un écart a laissé de trop au miroir y reste jusqu'à la clôture suivante.

*Fichiers : `server/src/core/backup.ts`, `server/src/core/space.ts`*

### `/healthz` répond toujours 200
**Contexte** : Render redémarre une instance dont la santé échoue, et un redémarrage, c'est le disque effacé et la file du miroir perdue ; sous `ulimit -n 64`, une simple mesure de la mémoire levait une exception.

**Décision** : `ok` reste vrai, la réponse est toujours un 200, et chaque mesure passe sous son propre filet ; la santé du miroir et la charge s'y lisent dans leurs blocs, agrégées, sans un nom ni une adresse, sans parcourir de journal ; la sonde de retard de boucle tourne à 100 ms de résolution, pour ne pas coûter le processeur qu'elle mesure.

**Conséquence** : la santé ne déclenche jamais de redémarrage ; c'est à qui la lit — la page « Le serveur » du QG, un humain — de juger ce qu'elle dit.

*Fichiers : `server/src/server.ts`, `server/src/core/pouls.ts`*

### Le serveur en un seul fichier, démarré par `exec node`
**Contexte** : chaque réveil de l'offre gratuite est un démarrage, et `tsx` y traduisait tout le TypeScript — 0,8 à 1 s de processeur et 40 Mo de plus sur un dixième de cœur ; lancé par `npm start`, le serveur ne recevait pas le signal d'arrêt de l'hébergeur, et l'arrêt propre ne vidait jamais le miroir.

**Décision** : `npm run build` construit aussi le serveur en un fichier (`server/dist/index.mjs`, esbuild, dépendances laissées dans `node_modules`) ; la commande de démarrage de Render est `cd server && exec node dist/index.mjs` ; tout chemin du serveur se compte depuis `SERVEUR`, jamais depuis l'emplacement d'un module.

**Conséquence** : un chemin compté depuis un module casserait dans le paquet sans une erreur — ni quiz livrés, ni modèles, ni réserve du jour — : `exploitation.test.ts` démarre le paquet ; `npm start` reste `tsx`, pour le développement et le repli.

*Fichiers : `server/scripts/empaqueter.ts`, `server/src/racine.ts`, `render.yaml`*

### Un délai de dix secondes sur la base permanente
**Contexte** : une base Turso muette faisait attendre plus de cinq minutes (301 s mesurées) : le démarrage restait suspendu, et vingt requêtes en attente gelaient tout, miroir compris.

**Décision** : chaque aller-retour vers la base permanente abandonne au bout de dix secondes (`DELAI_DISTANT_MS`), et se mesure ; une colonne ajoutée après coup lit le schéma au lieu de prendre tout refus pour « la colonne existe », et une panne pendant ce démarrage l'arrête.

**Conséquence** : une base qui hoquette fait échouer le démarrage — l'hébergeur le relance — au lieu de laisser une colonne absente ou une archive mal rattachée ; en marche, une requête échoue en dix secondes, et le miroir réessaie.

**Ajout du 19 octobre 2026** : le délai du `fetch` n'a pas suffi — en production, le 15 puis le 19 octobre, une lecture n'est jamais revenue, sans une erreur, et derrière un verrou (celui d'un profil, celui du tirage du défi) ou une lecture partagée (la mesure des difficultés de la campagne), elle figeait les duels, les épreuves des sentiers, les séries et le défi jusqu'au redémarrage — le 19, sur quatre démarrages de suite. Vers une base distante, chaque appel est donc borné de bout en bout, cinq secondes au-delà de son aller-retour (`clientBorne`, `MARGE_D_UN_APPEL_MS`) : il échoue comme une base muette, son verrou se libère, et l'appel suivant part d'un client neuf — le client libsql ne lance que vingt requêtes à la fois, et celle qui ne revient pas garderait sa place. Le début de la requête (jamais ses paramètres) part au journal et au relevé de l'heure : la cause, qu'on n'a pas su reproduire, se lira la prochaine fois.

*Fichiers : `server/src/core/distante.ts`*

### Un démarrage de front, et rien d'attendu après l'ouverture du port
**Contexte** : chaque réveil attendait soixante allers-retours en série avant d'ouvrir le port — trois secondes, pendant lesquelles le premier invité regardait une page blanche.

**Décision** : après les comptes, les magasins s'ouvrent ensemble, en treize branches aujourd'hui (`deFront`), et tous finissent avant qu'un échec remonte ; ce qui n'a pas à retarder la première page — l'écriture du démarrage au QG, la lecture de la base de la campagne — part une fois le port ouvert.

**Conséquence** : un magasin qui a besoin d'un autre s'ouvre après lui, dans la même branche ; ce qui relie deux magasins se branche après l'ouverture.

*Fichiers : `server/src/server.ts`*

### Le jeton de la routine : six routes, et pas une de plus
**Contexte** : le serveur ne détient aucune clé d'IA ; une routine Claude Code doit pouvoir lire une consigne et déposer des questions, sans être un animateur.

**Décision** : un seul jeton (`RESERVE_TOKEN`, trente-deux caractères au moins), comparé par empreinte en temps constant, vérifié avant la lecture du corps, ouvre la réserve du quiz du jour, son étiquetage et la base de la campagne ; il n'efface rien, n'ouvre aucune console, et chaque service a le sien.

**Conséquence** : l'étiquetage rend les questions à venir avec leur bonne réponse — le jeton se garde comme un mot de passe, et se change des deux côtés s'il fuit.

*Fichiers : `server/src/quizDuJour.ts`, `server/src/campagne.ts`, `server/src/index.ts`*

## Les comptes, la sécurité et le QG

Le détail : [la sécurité](../architecture/securite.md).

### Un compte est un espace, un profil une personne
**Contexte** : un animateur joue aussi ; son espace porte la clé de partition de vingt-trois tables et de toutes les archives, et un même compte servait à la fois de porte et de cloison.

**Décision** : deux tables — `accounts` (l'espace, dont l'`id` ne bouge jamais) et `profiles` (la personne) —, reliées par `accounts.profile_id` ; chaque session de console retient le profil qui l'a ouverte (`auth_sessions.profile_id`), pour que se déconnecter, changer de mot de passe ou perdre l'espace ne ferme que ce que ce profil avait ouvert (invariant 16).

**Conséquence** : ne jamais fusionner les deux tables ; remplacer ou détacher le titulaire demande une preuve fraîche, et jamais depuis une télé branchée.

*Fichiers : `server/src/auth/store.ts`, `server/src/auth/routes.ts`*

### Chacun ouvre son salon depuis son profil
**Contexte** : l'administrateur créait un compte à chaque ami, qui tenait ensuite deux identités — un compte pour animer, un profil pour jouer.

**Décision** : un seul profil par personne ; son espace naît au premier « Créer un salon », sans mot de passe, à une adresse neutre (`s-…`) — les invités entrent par le code à six chiffres —, et les comptes d'avant ont reçu, une fois, un profil au même identifiant.

**Conséquence** : plus de page de création de compte au QG ; une réserve par adresse (cinq salons d'un coup, puis un toutes les six minutes) arrête un script qui remplirait la base d'espaces ; un identifiant déjà pris se rattache à la main (« Rattacher à un profil »).

*Fichiers : `server/src/auth/profilUnique.ts`, `server/src/auth/profileRoutes.ts`*

### Pas d'adresse e-mail : un code de secours
**Contexte** : un profil ne contient qu'un pseudo et de l'expérience ; garder des adresses e-mail, c'était héberger des données personnelles et un service d'envoi pour un jeu de fête.

**Décision** : un code de secours de seize signes, montré une fois à l'inscription, consommé et renouvelé à chaque usage — atomiquement — ; l'administrateur peut en tirer un neuf pour un joueur, jamais un mot de passe provisoire ni un lien.

**Conséquence** : qui perd son mot de passe et son code ne retrouve son profil que par l'administrateur ; le chemin sans compte reste ouvert.

*Fichiers : `server/src/auth/profileRoutes.ts`, `server/src/auth/profiles.ts`, `server/src/profilsAdmin.ts`*

### Une seule réserve d'essais, un verrou par secret
**Contexte** : une réserve par routeur donnait deux fois plus d'essais à qui alternait les portes ; lu avant scrypt et compté après, le verrou laissait passer vingt essais partis ensemble ; sous une seule clé, cinq codes de secours faux fermaient la connexion à qui tapait le bon mot de passe.

**Décision** : une réserve par serveur (`loginBudgetOf`) — vingt essais d'un coup par adresse, puis vingt par minute —, un verrou par secret visé (`compte:`, `joueur:`, `secours:`, `appairage:<session>`), cinq échecs pour un quart d'heure, et un essai en vol compté comme un échec jusqu'à son jugement.

**Conséquence** : une porte de plus qui vérifie un secret puise dans `loginBudgetOf(app)` et juge chaque essai accepté (`failed`, `succeeded`, `abandon`) ; un jeton de 256 bits n'a que la réserve de l'adresse — cinq liens périmés, sous une clé commune, fermaient toutes les activations du serveur.

*Fichiers : `server/src/auth/http.ts`, `server/test/securite.test.ts`*

### La télé se branche par un code court et un jeton secret
**Contexte** : animer depuis son téléphone demandait de taper deux adresses et un mot de passe accentué à la télécommande ; et la télé est souvent celle de quelqu'un d'autre.

**Décision** : la télé affiche six signes, qu'une console déjà ouverte valide ; elle récupère sa session avec un jeton de 256 bits qu'elle seule connaît ; la session dure 24 heures sans glisser, hérite du profil de la console qui l'a validée, et n'administre rien.

**Conséquence** : deviner le code ne rapporte que le droit de céder sa propre session ; « périmé » se dit dans une réponse, pas dans une erreur, pour qu'une coupure du wifi ne jette pas un code déjà validé ; un minuteur coupe la connexion de la télé à l'heure dite.

*Fichiers : `server/src/auth/appairage.ts`, `server/src/sockets.ts`*

### L'administration est gardée d'un bloc, et chaque geste se note
**Contexte** : chaque route posait son `requireAdmin`, et en retirer un ne faisait rougir aucune épreuve — n'importe quel animateur aurait masqué un joueur ou lu les questions à venir.

**Décision** : `requireAccount`, `requireAdmin` et `refuserLesTeles` posés une fois sur `/api/admin`, puis `journaliser`, qui note chaque geste accepté avec la phrase de sa route ; deux tests lisent la liste des routes dans le routeur.

**Conséquence** : une route d'administration de plus est gardée et journalisée d'office, mais doit dire sa phrase (`noterLeGeste`) et être jouée dans `server/test/journal.test.ts`.

*Fichiers : `server/src/api.ts`, `server/src/core/journalDesGestes.ts`, `server/test/admin-seulement.test.ts`*

### Des soirées des autres, le QG ne voit que des chiffres
**Contexte** : l'administrateur doit voir ce qui se joue sur son serveur ; les quiz, les questions, les prénoms des invités et les titres des soirées appartiennent à leurs animateurs.

**Décision** : le direct et le bilan des soirées ne portent que des chiffres (`SoireeDuQg`, `SoireeRangeeDuQg`) — le salon, où en est la soirée, combien d'invités, depuis quand —, et un seul geste sur la soirée d'un autre : clore celle laissée en plan depuis six heures, par le même chemin que l'écran commun (`cloreLaSoiree`).

**Conséquence** : un champ de plus dans ces réponses ne porte jamais de contenu — `server/test/qg.test.ts` et `server/test/qg-soirees.test.ts` relisent les réponses entières.

*Fichiers : `server/src/qg.ts`, `shared/qg.ts`*

### Au QG, un duel classé s'annule tant que l'adversaire ne l'a pas commencé
**Contexte** : la page des duels du QG (`/admin#duels`, choisie sur maquettes le 13 octobre 2026) montre, à côté des duels par jour, des ligues et du classement, les duels classés partis que l'adversaire n'a pas commencés, les plus près d'expirer d'abord : sans réponse, un duel attend sa fermeture, sept jours après son lancement. Le propriétaire y a choisi « Annuler un duel pas joué ».

**Décision** : « Annuler », sur chacun d'eux (`POST /api/admin/duels/:code/annuler`, `CampagneStore.annulerUnDuel`), le ferme tout de suite, comme à son expiration : il ne compte pour personne, et l'adversaire ne peut plus le relever. Le geste passe sous le verrou de l'adversaire, qui ne peut pas le commencer entre la vérification et la fermeture ; commencé de son côté, le duel compte déjà et ne s'annule plus. Ni rouvrir un duel, ni en défaire un joué : la cote se relit des duels joués, et l'administrateur n'en choisit aucun.

**Conséquence** : annuler, c'est poser `ferme_le` à l'instant, rien d'autre — la ligne reste, fermée comme à son expiration, et un duel fermé que l'adversaire n'a jamais commencé ne compte pour personne (`lectureDesDuels`) ; le geste se note au journal du QG sous le profil qui l'avait lancé (« Duel classé annulé avant d'être joué : … »).

*Fichiers : `server/src/core/campagne.ts`, `server/src/campagne.ts`, `client/src/components/AdminDuels.tsx`, `server/test/qg-duels.test.ts`*

### Le QG ne touche aux règles que par le mélange d'un palier
**Contexte** : le QG agit sur le contenu, sur les joueurs et sur l'animation du serveur. Mais l'administrateur voyait sur les vraies épreuves des paliers trop durs, et chaque retouche de `PALIERS` attendait une mise en ligne (« Est-ce que ça serait possible de régler la difficulté des paliers en fonction de ce que je vois ? », le 13 octobre 2026).

**Décision** : les barèmes restent dans le code, à une exception près : le mélange de chaque palier des sentiers, réglé au QG pour les douze sentiers ensemble — seize questions, jamais d'experte —, avec la chance d'un essai estimée sur ce que les joueurs de ce palier trouvent vraiment. Ni le seuil, qui reste dix partout, ni l'expérience, ni un prix.

**Conséquence** : seules les épreuves qui commencent tirent un mélange réglé — une épreuve en cours garde ses questions, un palier validé ne se reprend jamais —, et les joueurs lisent la difficulté d'un palier sur son mélange réglé. Un réglage vit dans `sentier_melanges`, lu au démarrage puis tenu en mémoire ; chacun se note au journal, et « Revenir au mélange d'origine » efface sa ligne.

*Fichiers : `shared/sentiers.ts`, `server/src/core/campagne.ts`, `client/src/components/AdminCampagne.tsx`*

### L'économie se lit au QG, elle ne s'y règle pas
**Contexte** : après les pages des modes, le plan du QG prévoyait celle de l'économie ; mais les confettis ne s'écrivent nulle part — un solde se relit à chaque lecture —, et les étoiles des sentiers comme les ligues des duels ne laissent aucune ligne.

**Décision** : une page à lire, sans un geste (`/admin#economie`, `GET /api/admin/economie`), choisie sur maquettes le 13 octobre 2026 : les confettis gagnés et dépensés, jour par jour, d'où ils viennent (`SOURCES_DE_CONFETTIS` — les dons de l'administrateur y sont une source, « Tes dons ») et où ils partent (`DEPENSES_DE_CONFETTIS`), ce qui circule, les meilleures ventes, les Éclats tombés et les légendaires portés. Chaque source se relit à ses règles — les étoiles datées à l'épreuve qui atteint la note, les ligues au lundi qui paie la semaine. Les prix, les seuils et les barèmes restent dans le code : un choix de produit, dit au propriétaire, jamais un réglage du QG.

**Conséquence** : rien ne s'écrit pour la page ; tous les soldes se relisent une fois par jour, et la page dit l'heure de la lecture ; leur somme vaut celle des soldes des fiches, au confetti près (`qg-economie.test.ts`) — une source ou une dépense de confettis de plus s'y ajoute donc aussi (`economieDepuis`, `partsDesSoldes`). Les légendaires portés ne comptent ni les Divins — le QG n'en dit rien, pas même un compte —, ni les portraits, ni les compagnons.

*Fichiers : `shared/qgEconomie.ts`, `server/src/economie.ts`, `client/src/components/QgEconomie.tsx`, `server/test/qg-economie.test.ts`*

### Les signalements se relisent sur une page, et chaque geste dit ce qu'il en a fait
**Contexte** : les questions signalées se relisaient en bas de deux pages du QG — celle du quiz du jour, qui ne savait que garder, annuler et retirer, et celle de la campagne —, et rien ne gardait ce qui en avait été fait (« Est-ce que j'ai une page de monitoring pour les signalements, me permettant de reclasser la question, la modifier, la supprimer ? », le 14 octobre 2026). Au quiz du jour, chaque joueur répond par la place d'une réponse : corriger le jour joué comme la suite aurait changé ce qu'il avait répondu.

**Décision** : une page, choisie sur maquettes (`/admin#signalements`, « Une page qui remplace les sections »), les deux modes ensemble, avec les mêmes gestes — corriger, reclasser (la catégorie, le sous-thème, la difficulté estimée), retirer, garder, et au quiz du jour annuler ses points pour tous. Corriger une question du jour change sa version de la réserve ; le jour qui l'a posée la prend aussi quand la bonne réponse ne change pas, à la même place (« Même réponse : partout ; autre réponse : pour la suite », `corrigeAussiLeJour`), et une autre bonne réponse règle le jour joué en annulant ses points, dans le même geste. Un reclassement ne vaut que pour la suite. Chaque geste écrit son issue sur les signalements qu'il referme (`issue`, `detail`), dans son propre lot : l'historique de trente jours la relit (« Oui, trente jours, avec l'issue »), et le joueur dont la remarque a servi en est remercié sur son accueil, une fois (« Remercier le joueur »).

**Conséquence** : une question signalée de nouveau revient à relire, sans son issue d'avant ; une issue vide est un signalement relu avant le 14 octobre 2026. Reclasser en campagne se range comme une correction sur place, sous le même identifiant : réponses passées et difficulté mesurée la suivent, et les écussons de chacun ne bougent pas. Le merci se lit dans le lot de l'accueil, par un index de chaque table : pas un aller-retour de plus. « Garder » ne remercie personne.

*Fichiers : `shared/qgSignalements.ts`, `server/src/core/jour.ts`, `server/src/core/campagne.ts`, `server/src/qg.ts`, `client/src/components/AdminSignalements.tsx`, `client/src/components/QgSignalements.tsx`, `server/test/qg-signalements.test.ts`*

### Une panne ne se raconte qu'au journal
**Contexte** : une erreur de base ou de code lue à l'écran parle de tables et de chemins du serveur — rien qui aide un invité, tout ce qui renseigne un curieux.

**Décision** : seul un `Error` nu, sans `code`, parle à l'utilisateur (400) ; tout le reste devient « Erreur serveur — réessaie dans un instant », à la route comme au toast de l'écran commun, et son détail part au journal du serveur et au relevé de l'heure du QG.

**Conséquence** : un message fait pour être lu se lève avec `new Error('…')`, court, en français, qui dit quoi faire ; un 404 ou un 409 se répond à la main.

*Fichiers : `server/src/core/http.ts`*

### Les erreurs se trient, et seule la panne d'un mode fait sonner un téléphone
**Contexte** : la page du serveur détaillait chaque erreur de la semaine, mais rien n'y disait « vue », « réglée » ou « sans gravité » : la même liste revenait à chaque visite, et l'alerte rouge de la vue d'ensemble sonnait pour chacune, un hoquet de Turso connu compris (« je trouve que je peux pas très bien manager les erreurs que je vois », le 19 octobre 2026). Le même jour, le quiz du jour et les défis ne s'ouvraient plus en production, et seul un joueur l'a dit : « Je veux bien une notification sur mon téléphone quand une erreur tombe — importante, c'est-à-dire l'indisponibilité d'un mode de jeu ».

**Décision** : une page à elles (`/admin#erreurs`), où chaque erreur se trie — à regarder, réglée, ignorée — et dont seules celles à regarder allument la vue d'ensemble ; le tri vit à part du relevé (`qg_erreurs`) et se relit sur les versions de l'erreur : réglée, elle revient d'elle-même sous une version qui ne l'avait pas vue. Une erreur seule ne sonne pas : une veille en mémoire (`core/veille.ts`) lit chaque route et chaque message du temps réel, et un mode tombe quand une de ses sources échoue trois fois en dix minutes, et plus souvent qu'elle ne réussit ; il est rétabli quand chacune a réussi de nouveau, sans un échec pendant un quart d'heure. La panne, puis le retour, sonnent sur les téléphones de l'administrateur — le Web Push du rappel du soir, sous ses clés, sur un abonnement à part (le service worker enregistré sous `/admin`). Les plantages du client et le courriel, proposés, n'ont pas été retenus.

**Conséquence** : une panne dite se garde jusqu'à son retour (`qg_pannes`) : la mise en ligne de la réparation est un redémarrage, et le serveur neuf dit « Rétabli ». Les modes tombés ensemble se disent dans une notification — une base muette les fait tous tomber —, sans un prénom ni un message d'erreur. Un téléphone se montre par son empreinte, jamais son adresse, et ne tient à aucune session : une session du QG qui expire ne fait pas taire une panne. Le rappel du soir reste la seule notification d'un joueur.

*Fichiers : `shared/triDesErreurs.ts`, `shared/pannes.ts`, `server/src/core/veille.ts`, `server/src/core/alertes.ts`, `server/src/erreursDuQg.ts`, `client/src/components/QgErreurs.tsx`, `client/src/alertesDuQg.ts`, `server/test/qg-erreurs.test.ts`*

## La page

Le détail : [le client](../architecture/client.md).

### Une adresse se lit une seule fois, des deux côtés
**Contexte** : le client choisissait sa page, le serveur son statut, chacun à sa façon — et l'un ouvrait ce que l'autre déclarait introuvable.

**Décision** : `parseRoute` (`shared/adresses.ts`) range toute adresse en cinq sortes ; le client y choisit sa page (`client/src/main.tsx`), le serveur son statut et ses balises (`decrirePage`). Pas de routeur : changer de page, c'est charger une page ; les écrans d'une page vivent dans le fragment.

**Conséquence** : une page de plus se déclare dans `ACCOUNT_PAGES`, que le typecheck propage à `ACCOUNT` et `TITRES` — mais pas à `RESERVED_SLUGS`, qui reste à tenir à la main (`duels` y manque aujourd'hui).

*Fichiers : `shared/adresses.ts`, `shared/space.ts`, `client/src/main.tsx`, `server/src/core/apercus.ts`*

### Le serveur habille la page, il ne la rend pas
**Contexte** : toutes les adresses rendaient le même HTML en 200 — un lien collé dans une messagerie ne montrait rien, une adresse inconnue passait pour une page, la seconde qui suit le scan disait « Chargement… » sur un écran noir, et la page attendait son code pour demander ses données.

**Décision** : `servirPage` pose le statut et les balises d'aperçu (`decrirePage`, `habillerPage`, jamais un prénom), le nom de la soirée (`pageDEntree`), les données de départ (`prechargerDonnees`) et l'attente déjà écrite (`ecrireAttente`) ; React prend la main sans rendu côté serveur.

**Conséquence** : rien de cela sous `npm run dev` ; et une donnée préchargée doit être demandée à l'ouverture, par tout visiteur, à l'adresse exacte — le navigateur rend la réponse préchargée sans regarder son âge.

*Fichiers : `server/src/server.ts`, `server/src/core/apercus.ts`, `server/src/core/page.ts`, `shared/depart.ts`*

### Pas de `lazy` : le code de la page avant le premier rendu, le reste à la demande
**Contexte** : un composant paresseux suspend au moins une fois, même son code déjà en cache, et React retient alors trois dixièmes de seconde ce qui sort de l'attente : un joueur qui revenait attendait 120 à 265 ms de plus, la grille du profil paraissait 350 ms plus tard.

**Décision** : `main.tsx` charge le code de la route avant un rendu unique ; ce qui ne sert qu'après le premier écran passe par `aLaDemande`, qui rend tout de suite un module déjà là.

**Conséquence** : chaque chemin doit rester léger — ce qu'il ne télécharge pas, `server/test/medaillons.test.ts` le vérifie, et un import statique de plus suffit à l'y remettre.

*Fichiers : `client/src/main.tsx`, `client/src/aLaDemande.ts`*

### L'entrée paraît avant la liaison temps réel
**Contexte** : la poignée de main et deux échanges coûtaient une demi-seconde en 4G, une seconde en 4G lente, sur la page que toute la salle ouvre en même temps ; et « Connexion perdue » clignotait sur chaque téléphone qui scannait.

**Décision** : `/s/<espace>/entree.json` sert ce que `party:watch` dirait, préchargé avec la page ; l'entrée s'en sert quand le téléphone n'a rien à reprendre (`entreeUtilisable`), et le bandeau de coupure attend la première liaison.

**Conséquence** : un jeton attend toujours sa re-présentation — la fiche du serveur fait foi (invariant 9) —, et une fin de soirée gardée passe d'abord.

*Fichiers : `shared/depart.ts`, `server/src/server.ts`, `client/src/views/PlayerApp.tsx`*

### L'entrée est un écran de connexion, mais passer est un bouton
**Contexte** : les champs en tête, puis « ou », puis le reste ne se comprenaient pas d'un coup d'œil ; trois champs à la création troublaient — lequel la salle verrait-elle ? — ; et le clavier ouvert d'office poussait le bouton hors de l'écran.

**Décision** : trois gros boutons de même taille, « Jouer sans compte » d'abord et en accent ; les champs ne viennent qu'avec le choix, sans `autoFocus` ; un profil naît d'un prénom et d'un mot de passe, l'identifiant s'en déduit (`IdentifiantDiscret`). Le prénom et l'avatar retenus sur un téléphone valent « entrée déjà vue » : un écran de connexion qu'on repousse deux fois devient un péage.

**Conséquence** : le chemin anonyme reste le premier ; `server/test/connexion-claire.test.ts` garde l'ordre et le format des boutons, « sans défiler en 360 × 640 » se regarde à l'écran.

*Fichiers : `client/src/components/Entree.tsx`, `client/src/components/ProfilForm.tsx`, `client/src/components/IdentifiantDiscret.tsx`, `client/src/state.ts`*

### Pas d'`Intl` avant le premier écran
**Contexte** : le premier formateur `Intl` d'une page charge les données du français — 94 ms au processeur d'un téléphone moyen, sur l'accueil d'un profil —, et, retiré d'un endroit, il passe au suivant.

**Décision** : un nombre s'écrit à la main (`formatNumber`, le texte même de `toLocaleString('fr-FR')`), l'accueil reçoit le jour de Paris du serveur, et les formateurs de `shared/jour.ts` ne naissent qu'à leur première lecture.

**Conséquence** : `server/test/typographie.test.ts` compare `formatNumber` à `toLocaleString` sur des milliers de nombres ; les dates des pages d'animateur (`client/src/format.ts`) peuvent garder `toLocaleDateString`.

*Fichiers : `shared/typographie.ts`, `shared/jour.ts`*

### Le service worker ne fait que la notification
**Contexte** : installé par l'application, un service worker couvre toute l'origine, onglets compris : un cache servirait une vieille application à toute une salle, un `fetch` qui échoue ferait une page blanche.

**Décision** : `client/public/sw.js`, écrit à la main hors du paquet, affiche le rappel du soir, ouvre sa page au toucher et rend au serveur l'abonnement que son service renouvelle — ni cache, ni requête interceptée —, inscrit seulement par l'application installée qui prépare le rappel.

**Conséquence** : pas de mode hors ligne ; l'application est toujours celle que le serveur sert, à jour à chaque ouverture.

*Fichiers : `client/public/sw.js`, `client/src/rappel.ts`*

### Le navigateur ne garde qu'une commodité, toujours sous try/catch
**Contexte** : des cookies bloqués, le navigateur intégré d'une messagerie, Safari en navigation privée lèvent une exception à la moindre écriture : un stockage refusé au chargement d'un module donnait une page de jeu noire, et « Rejoindre la soirée » restait grisé alors que le serveur avait inscrit l'invité.

**Décision** : tout ce qui compte est au serveur ; l'appareil ne garde que de quoi se re-présenter et des préférences, chaque accès sous `try/catch` (`writeSafe`), une clé par espace ou par profil quand elle en dépend.

**Conséquence** : un stockage refusé ne coûte que la mémoire : un rafraîchissement ramène à l'entrée ; rien ne le vérifie partout, une clé de plus se relit à la main et rejoint la table de `docs/architecture/client.md`.

*Fichiers : `client/src/state.ts`, `client/src/main.tsx`*

## L'expérience et les récompenses

Le détail : [les récompenses](../produit/les-recompenses.md).

### L'expérience se mérite, et ne redescend pas en cours de soirée
**Contexte** : cinquante points pour une question jouée faisaient presque la moitié d'une soirée ; sous des seuils de trois ou quatre joueurs, les petites tablées ne gagnaient rien ; et recalculée d'un quiz à l'autre, l'expérience redescendait en silence.

**Décision** : rien pour la présence, rien seul — tout se gagne dès deux joueurs, et ce sont des seuils de questions (cinq pour le podium d'un quiz, quinze pour celui de la soirée) et un podium à une marche de moins que la salle qui ferment les parties fabriquées ; ce qu'un quiz rapporte se crédite à son verdict et ne bouge plus, et le podium de la soirée, l'assiduité et les trophées — hauts faits, prix, étapes des pistes, ces dernières en dernier — ne se décident qu'à la clôture, en un lot ; la ligne `(profil, soirée)` est remplacée, jamais ajoutée.

**Conséquence** : on recrédite sans payer deux fois ; une soirée jouée seul reste dans l'historique mais ne compte ni pour la carrière, ni pour l'Éclat (`soireeQuiCompte`) — dix « soirées » d'une question faisaient un légendaire ; un prix ne rapporte jamais d'expérience, un podium si.

*Fichiers : `shared/profil.ts`, `server/src/core/progress.ts`, `server/src/core/space.ts`*

### Les récompenses se dérivent des journaux, et l'historique se relit
**Contexte** : un barème ou un haut fait qui change laissait les soirées passées sous l'ancien.

**Décision** : tout ce qu'une soirée rapporte se déduit de ses journaux par des fonctions pures, archives comprises ; `VERSION_BAREME` monte à chaque changement, et `recalculerHistorique` relit l'historique au démarrage, avant d'ouvrir le port. Une version s'écrit en entier — liée en flottant, elle n'était jamais « du jour » et tout se relisait à chaque réveil ; une base injoignable fait échouer le démarrage plutôt que de passer des archives pour illisibles.

**Conséquence** : une amélioration profite aux soirées passées — un durcissement aussi : il reprend ce qu'elles ne donnent plus, titre, vitrine et légendaire compris. Le quiz du jour et la campagne ont leurs propres versions, qui n'ajoutent que.

*Fichiers : `server/src/core/recalcul.ts`, `server/src/auth/profiles.ts`*

### Durcir un légendaire ou la courbe ne reprend rien
**Contexte** : légendaires et niveaux se relisent à chaque lecture : relever un seuil reprenait le légendaire qu'on portait, et durcir la courbe — à 25, le joueur médian passait niveau 10 en six soirées — faisait redescendre de niveau, finitions comprises.

**Décision** : une règle qui se durcit ajoute une entrée à `DURCISSEMENTS` ou à `COURBES_D_AVANT`, sous un drapeau neuf, et n'en modifie jamais une ; au démarrage, chacun retient ce qu'il avait (`profile_legendaires`, `profile_niveaux`) ; tout niveau passe par `niveauDuProfil`.

**Conséquence** : ce qui était gagné reste tant que la règle d'alors le donne — une soirée retirée l'emporte encore. Un niveau gardé au-dessus de la courbe gelait toute montée (2 500 points gardaient le niveau 11, le douzième en demandait 7 260) : un rattrapage unique a versé ce qui manquait, dans une ligne jamais recalculée.

*Fichiers : `server/src/auth/profiles.ts`, `shared/profil.ts`*

### Un légendaire se mérite sur la durée, et se mesure
**Contexte** : tombés d'un seul haut fait, la plupart se gagnaient au premier soir.

**Décision** : des hauts faits répétés sur des soirées, des jours ou des séries différents, ou les étapes d'une piste — une vingtaine de quiz au premier de la bande, mesurés par `calibrage.ts` sur des bandes d'amis simulées ; une seconde voie au quiz du jour pour neuf d'entre eux, une voie « toutes » pour deux. Ni achat ni accélération.

**Conséquence** : un seuil se change en mesurant d'abord, et en ajoutant une entrée à `DURCISSEMENTS` ; le calibrage ne simule que des soirées, et ce qui se gagne ailleurs s'estime.

*Fichiers : `shared/legendaires.ts`, `server/scripts/calibrage.ts`*

### La rareté se mesure, elle ne se décrète pas
**Contexte** : l'expérience disait mal la rareté — L'Oracle paie 50, et trois joueurs sur quatre l'ont —, et la rareté de l'étagère se tait sous dix profils.

**Décision** : la carte range ses trois plus beaux sur `PART_DES_JOUEURS`, la part mesurée par `calibrage.ts` en moyenne de trois formats — à deux quiz par soirée, le Triplé est impossible —, estimée pour le quiz du jour et la campagne ; l'étagère dit la part des profils non suspendus (`rareteDe`), qui bouge avec la population.

**Conséquence** : un haut fait de plus prend sa part dans `PART_DES_JOUEURS`, sinon il ne paraît jamais sur une carte (`hautsfaits.test.ts` la réclame).

*Fichiers : `shared/hautsfaits.ts`, `shared/badges.ts`*

### L'Éclat : la même chance pour tous, une fois par soirée
**Contexte** : il fallait une récompense où le premier et le dernier de la salle soient à égalité ; tiré à chaque crédit, chaque quiz aurait donné une chance de plus ; et sous un légendaire, il tombait sur l'emoji caché que personne ne voyait.

**Décision** : un tirage par soirée qui compte (1/40), par partie du jour finie (1/40), par tentative finie du défi de la semaine (1/20) — le calendrier y tient lieu de garde-fou, d'où ni séries, ni sentiers, ni duels — sur ce qu'on porte, l'emoji sous un Divin.

**Conséquence** : un Éclat est définitif et ne part qu'avec sa soirée ; un test qui compte l'expérience au point près neutralise `ProfileStore.tirageEclat`.

*Fichiers : `server/src/core/space.ts`, `shared/profil.ts`, `shared/legendaires.ts`*

### Les Divins se taisent
**Contexte** : un récit lu dans le code d'une page en dirait presque autant que la règle.

**Décision** : leurs règles et leurs récits vivent au serveur seul, dans `server/src/core/divins.ts` ; `shared/divins.ts` n'a que la clé et le nom ; ni jauge, ni progression, ni ligne d'étagère, ni compte de badges ; le récit ne va qu'au porteur.

**Conséquence** : `divins.test.ts` vérifie qu'aucun fichier de `client/` ou de `shared/` n'importe ce module ni ne recopie un récit, et que la documentation n'écrit pas leurs règles ; la documentation dit qu'ils existent, leurs noms et comment ils s'annoncent, rien de plus.

*Fichiers : `server/src/core/divins.ts`, `shared/divins.ts`, `server/test/divins.test.ts`*

### Les trophées se rangent par mode, et se disent avec les mêmes mots
**Contexte** : « très confus, les trophées que les gens gagnent » — dix lignes les rangeaient selon la logique du code (« Paliers des soirées », « Paliers de toujours »…), un même exploit tombait sous deux noms (Le Laurier et le palier du Champion du jour, aux mêmes seuils), et chaque fin de partie montrait ses gains à sa façon.

**Décision** : un album dans « Ma collection », une page par mode — pistes en bronze, argent, or, chaque étape disant ce qu'elle ouvre (`shared/pistes.ts`), puis exploits, coups du sort, palmarès, ligues, maîtres, écussons (`shared/trophees.ts`) ; un seul écran des gains à la fin de chaque mode (`shared/gains.ts`) ; et des mots fixés : un trophée, tout ce qui se gagne par un exploit ; bronze, argent, or, les étapes d'une piste ; des étoiles, la note d'une partie ; un palier, l'étape d'un sentier. Aucun barème ne change.

**Conséquence** : une « médaille » ou un « badge » de plus rendrait l'écran confus que ce lexique a remplacé ; Le Laurier se compte dans la piste du Champion du jour (`ABSORBES`) ; le code garde ses anciens noms (`HAUTS_FAITS_DE_CARRIERE`, `clePalier`, `XP_PALIER`).

*Fichiers : `shared/pistes.ts`, `shared/trophees.ts`, `shared/gains.ts`, `client/src/components/Gains.tsx`*

## Le profil

Le détail : [le profil](../produit/le-profil.md).

### L'accueil, le profil et la boutique sont une seule page
**Contexte** : demander « quelle soirée ? » avant de savoir qui est là n'avait pas de sens pour qui revient ; mais la moitié d'une salle n'aura jamais de profil, et rien ne doit lui coûter un geste de plus.

**Décision** : `/`, `/profil` et `/boutique` sont la même page, qui lit son adresse ; sans profil, elle s'ouvre sur trois gros boutons du même format, « Jouer sans compte » d'abord, sans défiler en 360 × 640 ; `LandingApp`, malgré son nom, ne sert que les adresses inconnues.

**Conséquence** : les écrans du profil et leurs catalogues viennent à la demande, jamais sur l'accueil anonyme, qui partage le fichier.

*Fichiers : `client/src/views/ProfilApp.tsx`, `client/src/main.tsx`, `client/src/components/PanneauxDuProfil.tsx`*

### La loge essaie avant de porter
**Contexte** : six pages, une par pièce, enregistraient à chaque toucher — on portait pour de bon ce qu'on voulait seulement regarder, et l'on ne voyait pas le reste de sa tenue.

**Décision** : un toucher essaie, la carte en tête le montre, et « Porter » envoie tout l'essai d'un seul `PUT /api/joueur/moi`, que le serveur valide champ par champ avant d'écrire : tout passe, ou rien. Les règles de l'essai sont pures.

**Conséquence** : une pièce de plus se branche dans l'essai, la barre, le « Nouveau », la validation et l'annonce au lecteur d'écran (la recette « Ajouter une pièce à la loge »).

*Fichiers : `shared/loge.ts`, `client/src/components/Loge.tsx`, `server/src/auth/profiles.ts`, `server/test/loge.test.ts`*

### Ce qu'on porte se relit, il ne se fige pas
**Contexte** : jugé une fois au `player:join`, un emoji de collection restait à côté de « Niv. 1 » quand une soirée retirée faisait redescendre son porteur ; et l'archive ne gardait que l'emoji de l'inscription, si bien que le bilan montrait un emoji à qui portait un légendaire.

**Décision** : l'avatar se lit par `avatarPorte`, jamais dans la colonne ; la fiche d'une soirée se relit à chaque diffusion (`Party.relireAvatars`) ; ce que la salle voit d'un profil passe par une seule règle, `badgeDe`, lue en mémoire à chaque instantané et par les pages d'une soirée archivée.

**Conséquence** : un niveau perdu, un haut fait retiré, un fond plus mérité cessent de se voir sans rien réécrire, et reviennent avec ce qui les ouvrait.

*Fichiers : `server/src/auth/profiles.ts`, `server/src/core/party.ts`*

### Un seul avatar peint à la fois, dans une seule colonne
**Contexte** : légendaires, puis Divins, portraits du savoir et compagnons remplacent tous l'emoji.

**Décision** : une colonne, `profiles.legendaire`, dont la clé dit la sorte (`lg:`, `dv:`, `br:`, `cp:`) ; choisir un emoji l'ôte ; le serveur vérifie au choix, puis relit légendaires, Divins et formes de compagnon à chaque affichage, et croit les portraits ; ni un portrait ni une forme atteinte ne se perdent.

**Conséquence** : une sorte de plus se branche partout où la colonne se lit — la validation (`ProfileStore.update`), `legendairePorte`, la cible de l'Éclat, le chargement des dessins, `Avatar`, l'album, la grille et l'essai de la loge, l'annonce d'un choix ; c'est ce qu'ont demandé les compagnons.

*Fichiers : `server/src/auth/profiles.ts`, `shared/loge.ts`, `shared/album.ts`, `client/src/components/Avatar.tsx`*

### La métamorphose d'un compagnon est une forme de plus, qu'on choisit
**Contexte** : peintes le 13 octobre 2026, les métamorphoses de lumière que l'Éclat ouvre ne partaient pas — « quelqu'un a eu le loup compagnon en éclaté mais son avatar n'a pas changé ». Livrées d'abord à la place de la forme ultime éclatée, comme la version rare d'un légendaire, elles retiraient au joueur le loup des étoiles qu'il avait fait grandir : « je veux que ce soit un choix » (le propriétaire, le 19 octobre 2026).

**Décision** : chacune a sa clé (`cp:loup-tempete`, `Compagnon.lumiere`), hors des quatre formes où il grandit ; ouverte à sa forme ultime quand l'Éclat brille sur lui (`metamorphoseOuverte`), elle se porte comme une forme — une case de plus dans la loge — et se montre dans sa niche — `montree` à 4 —, deux choix séparés ; rien ne change d'office, et la loge comme « Ma niche » la marquent neuve tant qu'il ne l'a pas vue. L'Éclat ne change le dessin d'aucune forme : ses paillettes les annoncent.

**Conséquence** : partout où une forme se lit, elle passe — l'album, la grille, l'essai, la validation (`verifierLaForme`), `legendairePorte`, qui la referme avec l'Éclat ; et ce qui compte les formes où il grandit (`FORMES_DES_COMPAGNONS`, `JUSTES_DES_FORMES`, `prochaineForme`) ne la voit pas.

*Fichiers : `shared/compagnons.ts`, `server/src/auth/profiles.ts`, `client/src/components/Niche.tsx`, `client/src/components/Ouverts.tsx`*

### La luciole se gagne, et ne se montre que dans la collection
**Contexte** : peinte le 18 octobre 2026 pour l'Expédition — « que certains hauts faits récompensent de nouveaux compagnons, comme la luciole » —, elle n'était branchée nulle part ; la maquette la montrait en silhouette en boutique, « à gagner en Expédition ». Le 20 octobre, le propriétaire : « que dans la collection pas boutique ».

**Décision** : un compagnon du catalogue comme les autres, qui dit où il se gagne (`Compagnon.gagne`) ; la boutique, son achat, le coffre, « À la une » et « Adopter » ne lisent que ceux qui se vendent (`COMPAGNONS_DE_LA_BOUTIQUE`), l'album les lit tous. La Première traversée l'offre — la première expédition menée au bout —, à prix nul comme un compagnon du coffre, dans une niche vide seulement (`ProfileStore.offrirUnCompagnon`, appelé par `garderUnGardien` avant de clore) ; qui avait déjà mené une expédition au bout l'a reçue une fois au démarrage. Pas de trophée de plus : la Première traversée nomme sa voie, sans expérience ni rareté à mesurer.

**Conséquence** : un compagnon de plus « à gagner » prend `gagne` et son lieu, et rien de la boutique ne le montre ; `Compagnon.lumiere` est facultatif, et `metamorphoseOuverte` lit le compagnon — celui qui n'en a pas ne promet rien. Le solde et les ventes du QG l'ignorent (prix nul).

*Fichiers : `shared/compagnons.ts`, `shared/album.ts`, `server/src/auth/profiles.ts`, `server/src/core/campagne.ts`, `client/src/components/Ouverts.tsx`*

### La carte : une règle, trois portes
**Contexte** : la carte ne s'ouvrait qu'en soirée, sur un nom ; chacun composait sa tenue sans jamais la voir, et la carte d'un autre, hors soirée, était réduite à deux gestes.

**Décision** : `carteDuProfil` calcule la moitié profil pour la carte d'un invité, la sienne et celle de tout profil non masqué ; la vitrine n'a qu'une règle, `vitrineDeLaCarte` ; la vitrine d'office ne montre jamais un coup du sort ni un prix du palmarès — la carte se montre à la salle, et elle rangeait six fois L'Éclair.

**Conséquence** : un champ de plus sur la carte s'ajoute là, pas dans une route ; aucune porte ne rend d'identifiant de connexion.

*Fichiers : `server/src/core/carte.ts`, `shared/carte.ts`, `server/src/auth/profileRoutes.ts`*

### Un seul album des avatars, rangé par rareté
**Contexte** : trois lignes — le savoir, les légendaires et les Divins, les emojis de collection — rendaient les gens « confus » : on ne savait ni ce qu'un portrait valait à côté d'un légendaire, ni où chercher le suivant.

**Décision** : un album, une page par rareté comme les thèmes, chaque avatar disant où il se gagne et par quelles voies ; une dérivation pure de ce que la page reçoit déjà ; les Divins à part, sans voie, ni lieu, ni jauge.

**Conséquence** : un avatar ajouté au catalogue entre de lui-même dans l'album et dans les comptes de « Ma collection », que les tests fixent.

*Fichiers : `shared/album.ts`, `shared/collection.ts`, `client/src/components/AlbumDesAvatars.tsx`*

### La loge se range comme la collection, et ne montre que ce qu'on a
**Contexte** : la loge rangeait les avatars en quatre familles — légendaires, portraits, compagnons, emojis — quand l'album les rangeait par rareté, et l'on ne se retrouvait pas d'un écran à l'autre ; au bout de ses rangées, des cadenas, des finitions et des bordures éteintes montraient ce qu'on n'avait pas — les éteintes se prenaient pour des siennes —, et le propriétaire ne voulait plus y voir que ce qu'on a. Dans « Ma collection », trois listes cochées disaient ce qui manquait du style sans dire où l'on en était, et les bordures, qu'on porte dans la loge, n'y avaient pas de ligne, quand le propriétaire voulait un ensemble « homogène, cohérent et design » (le 13 octobre 2026).

**Décision** : « M'habiller » range les avatars comme l'album, en gemmes — les offerts à tous d'abord, puis chaque rareté où l'on a quelque chose, ouverte sur celle de ce qu'on porte (`pagesDeLaLoge`, `pageDuPorte`) ; chaque pièce n'y montre que ce qu'on a, et le reste se compte vers sa ligne de « Ma collection » : « +3 à gagner » au bout des finitions et des bordures, « 13 avatars communs à gagner : où ? » sous les avatars — de même sous les titres, les fonds, les gerbes et les thèmes (`AGagner`). Dans la collection, les fonds, les gerbes, les finitions et les bordures de ligue ont chacun leur petit album, fait comme celui des trophées (`objetsDuStyle`) : en couleur ce qu'on a, éteint le reste, et la fiche de chacun dit comment l'avoir et où l'on en est — avec, s'il est à soi, « Essayer », qui ouvre la loge avec lui sur la carte.

**Conséquence** : on choisit dans la loge et l'on découvre dans la collection, un toucher plus loin ; une adresse d'essai n'essaie rien qu'on n'ait (`essaiDemande`) ; un avatar ou un objet ajouté au catalogue prend de lui-même sa gemme, sa case et ses comptes, des dérivations pures de ce que la page reçoit déjà. Sous les Divins, rien ne se compte : ils ne disent pas comment.

*Fichiers : `client/src/components/Apparence.tsx`, `client/src/components/LigneDeCollection.tsx`, `shared/style.ts`, `client/src/components/AlbumDuStyle.tsx`*

### Les dessins viennent à la demande, sorte par sorte
**Contexte** : importés par le composant de l'avatar, les dessins partaient chez chaque téléphone qui scannait le QR, même si personne n'en portait.

**Décision** : ils se chargent sorte par sorte — légendaires, Divins, lumière, bordures, compagnons, une branche de portraits —, seulement quand un avatar de la page en a besoin ; un échec vaut pour toute la page, et l'emoji tient la place.

**Conséquence** : un import statique d'un dessin sur le chemin de l'invité anonyme le lui ferait télécharger ; `medaillons.test.ts` y veille.

*Fichiers : `client/src/components/medaillons.ts`, `server/test/medaillons.test.ts`*

### Une image peinte ne se refait jamais à la main
**Contexte** : chaque image se paie, et chaque fichier est servi un an sans revalider.

**Décision** : chaque famille a sa chaîne — consigne, images payées, planche jugée à l'œil, livraison qui pose les fichiers sous leur empreinte et réécrit le module qui les cite ; les originaux restent hors du dépôt.

**Conséquence** : un dessin repeint change d'adresse, et aucun téléphone ne garde l'ancien ; les tests refusent un fichier que plus personne ne cite.

*Fichiers : `server/scripts/anime/`, `.claude/skills/peindre/SKILL.md`*

## Les confettis et la boutique

Le détail : [la boutique](../produit/la-boutique.md).

### Le thème suit la personne, l'écran commun garde Velours ou Ivoire
**Contexte** : chaque page du menu avait son habit, et l'on changeait d'habit d'un toucher à l'autre ; l'écran commun, lui, est regardé par toute la salle.

**Décision** : le thème d'un profil habille toutes ses pages, sur tout appareil où il est connecté — l'accueil, ses quiz, son compte, la soirée au téléphone, le quiz du jour, le souvenir, le QG — ; l'écran commun et la télé restent en Velours ou en Ivoire, les fiches imprimées du bilan en Ivoire, et l'aperçu de l'écran commun dans « Mes quiz » prend l'habit de la salle.

**Conséquence** : l'animateur qui a acheté la Licorne anime en Velours. Une page qui lit le profil porte son thème elle-même, les autres le demandent seul (`GET /api/joueur/theme`) ; l'appareil retient le dernier porté, pour ouvrir la page déjà habillée ; la feuille se charge avant que l'attribut `data-theme` ne se pose, sinon ses couleurs passaient un instant sur les polices et le décor du Velours.

*Fichiers : `client/src/themeJoueur.ts`, `client/src/main.tsx`, `client/src/theme.ts`*

### Une bonne réponse, un confetti
**Contexte** : comptés en points, les confettis auraient payé trois fois plus, à une finale « ×3 », ceux qui étaient là ce soir-là, et un téléphone lent aurait perdu son bonus de rapidité ; seul devant son propre quiz, on connaît les réponses, et deux cents questions lancées pour soi rempliraient la tirelire.

**Décision** : un confetti par bonne réponse — un QCM juste, une estimation dans le tiers le plus proche de la salle —, seulement dans une soirée qui compte (`soireeQuiCompte`) ; un par bonne réponse aussi au quiz du jour et dans tous les modes de la campagne.

**Conséquence** : la monnaie ne dépend ni du barème des points, ni du multiplicateur, ni du réseau. Les étoiles des sentiers, les ligues des duels et les dons de l'administrateur s'y sont ajoutés comme des sources à part, chacune sa constante.

*Fichiers : `shared/themes.ts`, `shared/profil.ts`, `server/src/core/campagne.ts`*

### Un solde dérivé, des achats écrits avec leur prix
**Contexte** : les gains se relisent des journaux, comme l'expérience, et une soirée peut quitter l'historique.

**Décision** : le solde n'est écrit nulle part — `ProfileStore.boutiqueEtDons` le recompte à chaque lecture, gains moins dépenses — ; chaque achat s'écrit sur sa ligne avec le prix payé, que rien ne modifie.

**Conséquence** : tout est rétroactif. Une source nouvelle crédite d'un coup tout le passé ; une soirée retirée ou un essai effacé reprend ses confettis, et le solde peut passer sous zéro — il bloque alors les achats, rien d'autre ; une règle de gain changée change le solde de tous, sans version ni drapeau. Un achat ne se reprend jamais, et un prix changé ne rembourse ni ne refait payer personne.

*Fichiers : `server/src/auth/profiles.ts`, `shared/themes.ts`*

### Un achat à la fois, compté au serveur
**Contexte** : deux onglets, ou un double toucher, lisaient le même solde et le dépensaient deux fois.

**Décision** : le serveur compte chaque achat contre le solde relu à l'instant, un seul à la fois par profil (`unAchatALaFois`), et la page affiche le solde qu'il rend — jamais une soustraction faite dans le téléphone.

**Conséquence** : deux achats partis ensemble pour un solde qui n'en paie qu'un : un seul passe, l'autre reçoit son refus en clair. Une dépense de plus passe par le même verrou.

*Fichiers : `server/src/auth/profiles.ts`, `server/src/auth/profileRoutes.ts`*

### Toucher n'achète pas, toucher n'enregistre pas
**Contexte** : un thème se portait d'un toucher — le doigt qui voulait seulement le regarder habillait déjà toutes les pages, pour de bon.

**Décision** : dans la boutique, un toucher ouvre la fiche, et « L'acheter » propose « Acheter et porter » ou « L'acheter seulement » ; dans la loge, un toucher essaie — le thème sur toute la page, le fond derrière la carte, la gerbe qui éclate — et « Porter » enregistre tout l'essai d'un seul `PUT /api/joueur/moi`, validé champ par champ avant d'écrire.

**Conséquence** : on achète un thème de saison avant qu'il ne parte sans quitter le sien ; quitter la loge rend le thème porté ; l'aperçu de l'écran commun passe devant l'essai, l'essai devant le thème porté.

*Fichiers : `client/src/components/Boutique.tsx`, `client/src/components/Loge.tsx`, `client/src/themeJoueur.ts`*

### Des fonds à vendre, un trésor qui ne se vend pas
**Contexte** : les fonds de carte se gagnaient sur une piste ou sortaient du coffre de la semaine ; la boutique n'en vendait aucun, et qui avait des confettis n'avait rien pour habiller sa carte. Vendre ceux du trésor aurait vidé le coffre de ce qu'il est seul à donner.

**Décision** (le 15 octobre 2026) : douze fonds neufs, peints, un par catégorie de questions — les fonds des savoirs —, tous au même prix (`PRIX_D_UN_FOND`, 250 : celui d'un thème peu commun, car un fond se voit moins qu'un thème), dans un rayon « Fonds » où chacun se montre sous sa propre carte. Le trésor ne se vend pas, et la boutique n'en dit rien : « Ma collection » dit d'où vient chaque fond, et sa fiche y mène.

**Conséquence** : les fonds des savoirs n'entrent pas au coffre, dont les chances restent au trésor ; un achat de plus, écrit avec son prix (`profile_fonds`) et compté au QG ; `savoir` seul ouvre la vente, et un fond qui se gagne refuse d'être acheté en disant comment il se gagne.

*Fichiers : `shared/fonds.ts`, `server/src/auth/profiles.ts`, `client/src/components/RayonDesFonds.tsx`*

### Les polices et les décors voyagent avec l'application
**Contexte** : une soirée peut se jouer sur le repli du wifi local, sans internet, et la politique de contenu du serveur n'ouvre que sa propre origine (`default-src 'self'`).

**Décision** : Cormorant Garamond et Figtree (67 Ko environ), les polices des thèmes et leurs licences, les décors peints sous empreinte : tout est livré dans `client/public/`, rien n'est demandé à un tiers.

**Conséquence** : une feuille de thème ne cite que ses polices (`/fonts/themes/…`) et ses décors (`/decors/…`), et `design.test.ts` refuse toute autre adresse ; une police n'est téléchargée que par qui porte le thème qui la déclare.

*Fichiers : `client/src/styles.css`, `client/public/fonts/themes/LICENCES.txt`, `server/src/server.ts`*

### Aucun emoji d'Unicode 13 et au-delà
**Contexte** : l'écran commun tourne sous Windows 10, qui dessine les emojis récents en carré vide, devant toute la salle — et les animateurs écrivent leurs quiz avec le clavier de leur téléphone, où ils sont partout.

**Décision** : le code et les quiz livrés n'en ont aucun ; l'éditeur et la liste collée signalent ceux d'un animateur sans les refuser ; un avatar récent devient l'avatar par défaut.

**Conséquence** : un emoji récent dont le code de `shared/` a besoin s'écrit en points de code échappés ; une particule de gerbe, un emoji dans un `content:` du CSS suivent la même règle.

*Fichiers : `shared/emojis.ts`, `shared/avatars.ts`, `server/test/emojis.test.ts`*

### La carte à fond reste nocturne
**Contexte** : le `.card` du thème Héros repeignait en blanc la carte d'un joueur, sous l'encre claire de son fond ; l'or du décor, recopié huit fois en dur, ne suivait rien.

**Décision** : `.carte-fond` reprend les jetons du Velours sous tous les thèmes, toute règle de thème qui la peindrait s'en écarte par `:where(:not(.carte-fond, .carte-fond *))`, et l'or du décor se lit dans `--fond-or`.

**Conséquence** : un fond se voit pareil chez tous ceux qui ouvrent la carte, quel que soit leur thème ; `fonds.test.ts` relit chaque feuille, Ivoire comprise.

*Fichiers : `client/src/styles.css`, `shared/fonds.ts`, `server/test/fonds.test.ts`*

## Les quiz

Le détail : [les quiz](../produit/les-quiz.md).

### L'éditeur n'envoie rien pendant qu'on écrit
**Contexte** : sur l'offre gratuite de l'hébergeur, le serveur s'endort sans visite, souvent sous les doigts de l'animateur. Le premier « Enregistrer » qui suivait échouait, le message poussait à recharger la page, et tout ce qu'on avait écrit partait.

**Décision** : seul « Enregistrer » envoie, et il attend le réveil jusqu'à deux minutes en rejouant son essai (`auReveil`, `ATTENTE_REVEIL_MS`) ; le navigateur garde un brouillon de tout ce qui n'est pas enregistré, relu comme le serveur relit (`normalizeQuestions`) ; une réponse arrivée après l'attente ne remplace l'éditeur que si rien n'a bougé depuis.

**Conséquence** : un onglet fermé ou une page rechargée ne perd rien — la liste le signale, le quiz rouvert propose de reprendre. La photo ou l'extrait joint depuis une carte part tout de suite, et rejoint sa question par son identifiant (`changerParId`) : par sa position, il tombait sur la voisine déplacée entre-temps.

*Fichiers : `client/src/views/EditorApp.tsx`, `client/src/api.ts`, `client/src/brouillon.ts`, `shared/brouillon.ts`, `shared/reveil.ts`*

### Un enregistrement dit d'où il part
**Contexte** : le même quiz ouvert sur deux appareils, le second « Enregistrer » écrasait le premier en silence ; et l'essai d'un clic rejoué au réveil, dont la première réponse s'était perdue, se prenait pour un conflit avec lui-même.

**Décision** : `PUT /api/quizzes/:id` porte la version d'où part l'éditeur (`base`), un `jeton` par clic et le numéro de l'essai (`essai`) ; le serveur répond 409 si le quiz a été enregistré ailleurs depuis, jamais à un essai de son propre clic, fait passer les enregistrements d'un même quiz l'un après l'autre (`unParUn`), et un essai plus ancien que le dernier écrit ne réécrit rien.

**Conséquence** : « Rien n'est écrasé : choisis la version à garder » — « Garder la mienne » ou « Prendre l'autre version ». Le dernier essai (`derniers`) ne vit qu'en mémoire : après un redémarrage, un faux conflit reste possible, que le brouillon rattrape. Une page d'avant, sans `base`, écrit comme avant, bornée en silence.

*Fichiers : `server/src/api.ts`, `server/src/core/quizStore.ts`, `client/src/views/EditorApp.tsx`*

### On partage une copie, jamais un quiz public
**Contexte** : n'importe quel profil peut animer. Vivant, un quiz partagé bougerait sous les pieds de ceux qui le jouent ; public, il livrerait ses réponses aux invités qui animent aussi.

**Décision** : un code de partage ou une proposition au catalogue prend un instantané au moment du geste ; la copie reçue recopie toutes ses pièces dans l'espace qui la reçoit (`copierPhotos`), sous un titre libre ; le catalogue ne publie qu'après la relecture de l'administrateur.

**Conséquence** : les retouches d'après ne suivent pas, et supprimer l'original n'emporte rien chez le destinataire. Un partage vivant protège ses pièces du ménage (`photosProtegees`) ; dix codes manqués par quart d'heure et par espace mettent la devinette hors de portée.

*Fichiers : `server/src/core/partages.ts`, `server/src/partages.ts`, `shared/partage.ts`*

### Une question emporte toutes ses pièces, et le ménage attend
**Contexte** : la photo de la révélation, oubliée par l'export et la copie d'un partage, restait l'adresse de l'autre espace et partait au premier ménage du sien ; supprimer un quiz joué effaçait les photos du bilan de sa soirée ; et une grâce comptée depuis l'envoi laissait « Garder la mienne », sur l'autre appareil, citer une photo effacée.

**Décision** : `PIECES_DE_QUESTION` dit les pièces — la photo, celle de la révélation, l'extrait —, et tout ce qui emporte ou vérifie une question les parcourt toutes. Le ménage, après un enregistrement ou une suppression de quiz, n'efface qu'une pièce orpheline depuis une heure (`orpheline_depuis`, `IMAGE_GRACE_MS`), que ne citent ni un quiz, ni une partie encore sur le disque, ni une soirée archivée, ni un partage vivant ; une lecture qui échoue n'efface rien.

**Conséquence** : une quatrième pièce rejoint cette liste, ou elle se perd en route ; le bilan d'une soirée passée garde ses photos.

*Fichiers : `shared/library.ts`, `server/src/core/quizStore.ts`, `shared/echange.ts`, `server/src/api.ts`*

### Une question incomplète s'enregistre, et ne se joue pas
**Contexte** : une liste collée sans étoile prenait la première réponse pour la bonne, et le quiz se disait prêt : la salle le découvrait à la révélation.

**Décision** : rien de coché (`SANS_BONNE_REPONSE`) survit à l'enregistrement ; une question sans bonne réponse, avec un trou de modèle (✏️, « [Prénom] ») ou une photo attendue s'enregistre telle quelle et reste « à compléter » — on ne perd jamais une saisie —, et c'est `toPlayable` qui décide au lancement.

**Conséquence** : la carte dit ce qui manque (`questionProblem`), « 2 à compléter ↓ » mène de l'une à l'autre, et la partie les saute ; un quiz sans question prête ne se lance pas.

*Fichiers : `shared/library.ts`, `client/src/views/EditorApp.tsx`*

### Les modèles restent des fichiers
**Contexte** : les quiz livrés n'allaient qu'à l'espace de l'administrateur, et chaque ami découvrait « Lancer un quiz » par un refus.

**Décision** : les onze modèles vivent dans `server/content/quiz/`, relus du disque à chaque demande (`lireModeles`), et chacun se copie dans l'espace qui le choisit — une copie à soi, qu'on retouche sans rien changer chez les autres ; seuls les deux marqués `"amorce": true` entrent, une fois par base (drapeau `seeded`), dans la bibliothèque de l'administrateur.

**Conséquence** : un modèle ajouté ou corrigé se propose dès la mise en ligne, sans migration ; les copies déjà faites ne bougent pas. Leur dossier se compte depuis `SERVEUR` : le serveur empaqueté le cherchait hors du dépôt, sans une erreur.

*Fichiers : `server/src/core/seed.ts`, `shared/modeles.ts`, `server/src/api.ts`*

### Le quiz tout prêt tire hors de la bibliothèque
**Contexte** : les soirées n'avaient que les onze quiz livrés quand la base de la campagne compte des milliers de questions ; un animateur sans le temps d'écrire rejouait les mêmes.

**Décision** : le serveur compose dans `CampagneStore.pourLesSoirees` — ni questions retirées, ni réserve du quiz du jour —, rien de ce que la bibliothèque contient, archivés compris, par l'identifiant et par l'intitulé (un import change les identifiants), les jamais posées d'abord ; le quiz se range comme une copie de modèle, et l'aperçu du même tirage dit d'avance ce que la base donnera.

**Conséquence** : chaque question garde l'identifiant de la base (`idDansLeQuiz`, `base-…`), que la mémoire suit ; sa marche vient de la mémoire du quiz ; « Une autre » tire une voisine sans rien écrire.

*Fichiers : `server/src/core/quizToutPret.ts`, `shared/quizToutPret.ts`, `server/src/api.ts`*

### La bibliothèque en mémoire : la dernière relecture partie gagne
**Contexte** : le moteur joue une copie en mémoire des quiz de chaque espace, relue après chaque écriture. Deux écritures lançaient deux relectures, qui reviennent de Turso à leur rythme : la plus ancienne, arrivée la dernière, remettait la version d'avant la correction, et « Lancer » la jouait.

**Décision** : chaque relecture prend un numéro, et seule la dernière partie pose ce qu'elle a lu (`derniereRelecture`) ; une partie lancée garde sa propre copie (`st.pack`).

**Conséquence** : le programme de ce soir passe par la même porte ; une route qui écrit la bibliothèque relit avant de répondre (`onLibraryChanged`).

*Fichiers : `server/src/server.ts`, `server/src/games/quiz.ts`, `server/src/api.ts`*

## Le quiz du jour

Le détail : [le quiz du jour](../produit/le-quiz-du-jour.md).

### Rien ne tourne à minuit
**Contexte** : l'hébergeur gratuit endort le serveur la nuit ; un minuteur de minuit ne partirait pas.

**Décision** : le tirage d'un jour se fait à sa première demande, et la nuit — la veille close, son podium payé, ses hauts faits décernés, les mois finis, puis le laurier passé — à la première demande du lendemain, chacun sous son verrou (`#tirage`, `#nuit`), une fois.

**Conséquence** : un jour sans visite n'a pas de tirage ; tout chemin qui lit le jour (sa page, l'accueil, le profil léger, le classement, la correction, les lauriers d'une soirée) déclenche `clorePasses` ; seul le rappel du soir a un minuteur.

*Fichiers : `server/src/core/jour.ts`, `server/src/auth/profileRoutes.ts`*

### Le chronomètre est au serveur, sans minuteur
**Contexte** : l'horloge d'un téléphone dérive, et une partie commencée sur un téléphone se reprend sur un autre ; servie avant les paliers et la vue, la première question voyait son compte à rebours courir pendant cinq lectures.

**Décision** : une question est datée en base quand elle est servie (`servie_le`), toujours au dernier aller-retour ; une réponse vaut jusqu'à l'échéance plus 1,5 s (`GRACE_MS`), et une question échue se compte sans réponse à la lecture suivante (`expirer`), que la page demande d'elle-même ; le téléphone recale son horloge sur chaque partie que le serveur lui renvoie (`maintenant`).

**Conséquence** : ni liaison temps réel ni minuteur ; un chemin de lecture neuf passe par `aJour`, ou il montrerait ouverte une question expirée ; la marge est recopiée côté client (`APRES_ECHEANCE_MS`).

*Fichiers : `server/src/core/jour.ts`, `client/src/views/JourApp.tsx`*

### Les questions des quiz livrés en dernier recours
**Contexte** : l'amorce remplit la réserve avec les quiz livrés, qu'une soirée peut aussi jouer : le profil qui en aurait lu la correction y connaîtrait les réponses, pas l'invité anonyme (invariant 8).

**Décision** : ces questions ne sortent qu'un jour où la réserve n'a plus rien d'autre à poser, pas même ses anciennes — l'arbitrage du 27 septembre 2026.

**Conséquence** : tant que la routine nourrit la réserve, elles dorment ; elles sauvent seulement un jour à sec, et le journal du serveur dit le jour qu'elles ne suffisent pas à remplir (`[jour] réserve à sec`).

*Fichiers : `server/src/core/jour.ts`*

### Une partie fige son expérience
**Contexte** : l'expérience d'une partie était de 75 au plus ; qui ne faisait que le quiz du jour gagnait une quarantaine de points par jour — au niveau 10, vingt-cinq parties pour un seul niveau. Le propriétaire a voulu le barème « bien plus généreux » le 6 octobre 2026.

**Décision** : chaque partie écrit son expérience (`jour_parties.xp`, `xp_serie`) et chaque podium la sienne (`jour_podiums.xp`) ; le nouveau barème s'est appliqué au passé une seule fois, au démarrage qui l'apportait, sous un drapeau (`bareme-du-solo-2026-10-06`).

**Conséquence** : changer `XP_MAX_DU_JOUR`, `XP_PODIUM_DU_JOUR` ou le bonus de série ne touche que ce qui s'écrit ensuite ; recompter le passé demande un drapeau neuf — ni `VERSION_BAREME` ni `VERSION_DES_JOURS` ne relisent la ligne `#jour`.

*Fichiers : `shared/jour.ts`, `server/src/core/baremeDuSolo.ts`, `server/src/core/jour.ts`*

### Une partie commencée compte
**Contexte** : décernés à la fin seulement, le troisième jour d'Halloween commencé puis laissé — le téléphone qui sonne, minuit qui passe — affichait « 3 jours sur 3 » sans jamais ouvrir la Citrouille.

**Décision** : dès le « Commencer », la partie compte pour la série et son bonus, L'Assidu, L'Infatigable, la saison, le Dernier Métro et la page du calendrier ; la fin de la partie ne fait que les fêter.

**Conséquence** : une partie laissée paie son bonus de série, puis son Courant d'air à la nuit ; un test qui compte l'expérience au point près le compte aussi.

*Fichiers : `server/src/core/jour.ts`, `shared/jour.ts`*

### L'Éclat se tire une fois, dans l'écriture qui finit la partie
**Contexte** : les récompenses du jour se relisent des journaux — `relireLesJours` rejoue la fin de chaque partie (`decernerALaFin`) ; un tirage au sort placé là aurait été retiré à chaque relecture.

**Décision** : l'Éclat, une chance sur quarante (`CHANCE_ECLAT_DU_JOUR`), se tire dans `enregistrer`, l'écriture qui finit la partie et ne passe qu'une fois, jamais dans `decernerALaFin`.

**Conséquence** : un Éclat ne se rejoue ni ne se perd ; le défi de la semaine suit la même règle (tiré dans sa dernière réponse, jamais dans ce que la relecture des séries rejoue).

*Fichiers : `server/src/core/jour.ts`, `shared/profil.ts`*

### Une routine hors du serveur, et un jeton qui vaut les réponses à venir
**Contexte** : la réserve doit se nourrir chaque jour sans confier de clé d'IA au serveur.

**Décision** : une routine Claude Code, sur l'abonnement de l'administrateur, lit la consigne et dépose ses questions derrière `RESERVE_TOKEN` — trente-deux caractères au moins, comparé par empreinte SHA-256 avant toute lecture du corps. La consigne rappelle les intitulés déjà prêts, pour que l'IA ne les réécrive pas — le jeton les vaut donc, ce que l'arbitrage du 27 septembre 2026 a gardé tel quel. L'étiquetage, venu ensuite, lui rend en plus les questions à décrire avec leur bonne réponse.

**Conséquence** : le jeton n'efface rien et ne lit aucun profil, mais il lit les questions à venir et leurs réponses, et ouvre aussi la base de la campagne : il se garde comme un mot de passe et, s'il fuit, se change des deux côtés.

*Fichiers : `server/src/quizDuJour.ts`, `server/src/core/consigne.ts`, `server/src/index.ts`*

### Un rappel de moins vaut mieux qu'un de trop
**Contexte** : une tournée peut croiser un redémarrage, ou le second serveur d'un déploiement ; et le propriétaire ne veut pas « que les gens reçoivent trop de notifications, uniquement le quiz du jour » (13 octobre 2026).

**Décision** : le rappel du soir est la seule notification d'un joueur — l'administrateur a, depuis le 19 octobre 2026, celle d'un mode en panne (« Les erreurs se trient… ») ; chaque téléphone est réservé en base (`dernier_jour`) avant l'envoi, rien ne part à partir de 22 h, et un rappel perdu en route ne se rattrape pas. Le Web Push s'écrit sans bibliothèque (`node:crypto` seul) et ne vise que les services de push connus.

**Conséquence** : ni un défi ni un duel ne sonnent ; un téléphone ne reçoit jamais deux rappels le même soir ; une adresse de push inconnue est refusée à l'abonnement ; le bilan de chaque soir se garde pour le QG (`jour_rappels_tournees`), une seconde tournée s'y ajoutant sans rien compter deux fois.

*Fichiers : `server/src/core/rappels.ts`, `server/src/core/pousser.ts`*

## La campagne

Le détail : [la campagne](../produit/la-campagne.md).

### La campagne a sa propre base, disjointe de la réserve du quiz du jour
**Contexte** : la campagne tirait d'abord ses questions de la réserve du quiz du jour. Elle reposait donc des questions que les joueurs avaient vues, et dont ils avaient lu la correction le matin même.

**Décision** : la campagne a sa propre base, écrite et étiquetée d'avance dans le dépôt. Les deux bases restent disjointes par l'intitulé, dans les deux sens : la campagne écarte les intitulés de la réserve, et la réserve refuse ceux de la base.

**Conséquence** : il y a deux bases à faire grandir, et la routine du matin écrit pour les deux. La base de la campagne sert aussi le quiz tout prêt des soirées.

*Fichiers : `server/src/core/baseCampagne.ts`, `server/src/core/jour.ts`, `server/src/core/quizToutPret.ts`*

### Les marches se mesurent sur les réponses, avec la difficulté estimée comme point de départ
**Contexte** : sans mesure, une question jamais jouée passait pour moyenne, et une série où presque rien n'était mesuré ne montait pas. Avec seulement dix réponses fictives, une seule vraie réponse suffisait à faire quitter l'expert à une question.

**Décision** : la difficulté estimée à l'écriture (de 1 à 5) donne une part de réussite attendue, comptée comme vingt réponses fictives et mêlée aux vraies réponses de campagne, hors révisions. Le modèle du savoir, plus fin, ne sert qu'à Automate. Les marches des séries, des sentiers et du quiz tout prêt gardent ce lissage, sur lequel les mélanges et les seuils des sentiers ont été calibrés.

**Conséquence** : la marche d'une question bouge avec les réponses de tous, relue toutes les dix minutes au plus. Changer l'a priori déplace d'un coup toutes les questions peu jouées.

*Fichiers : `shared/campagne.ts`, `server/src/core/modeleDuSavoir.ts`*

### Le tirage tient compte de la fraîcheur, fait tourner les catégories et écarte les jumelles
**Contexte** : un joueur revoyait le soir même les questions qu'il venait de rater. Une série tirée au hasard reflétait la base : après l'arrivée des faits de Wikidata, quatre expertes sur dix venaient de l'art ou du cinéma. Une série du petit écran posait cinq « Qui a créé la série… » en vingt questions.

**Décision** : chaque marche tire d'abord les questions jamais vues, puis celles vues il y a le plus longtemps ; celles des dernières 24 heures ne viennent qu'en dernier recours. À fraîcheur égale, les catégories puis les sous-thèmes passent à tour de rôle, et les marches partagent leurs comptes. Deux jumelles s'évitent tant que la marche a d'autres questions aussi fraîches, après la rotation des catégories et des sous-thèmes, qui passe d'abord.

**Conséquence** : chaque tirage passe toute la base au crible, et la liste des questions jouables est gardée tant que rien ne change. Une retouche du tirage se vérifie au même hasard contre l'ancien tirage.

*Fichiers : `server/src/core/campagne.ts`, `server/src/core/jumelles.ts`*

### Le carnet se recalcule à partir du journal des réponses, avec des rendez-vous espacés
**Contexte** : un joueur voulait « un mode qui incite à l'apprentissage, où l'on gagne toujours quelque chose ». La série, elle, punit l'erreur d'une vie en moins.

**Décision** : une question ratée revient le lendemain, trois jours après, puis une semaine après, jusqu'à être apprise. Rien n'est stocké à côté : le carnet se recalcule à partir du journal des réponses à chaque lecture. Une révision paie ses bonnes réponses comme une série, mais ne compte ni pour la mesure des difficultés, ni pour la précision, ni pour L'Érudit, puisqu'elle repose des questions dont on a lu la réponse la veille.

**Conséquence** : une règle changée vaut aussitôt pour tout le passé. Le défi et les duels contre quelqu'un n'entrent au carnet qu'à leur clôture, pour ne pas souffler les réponses à ceux qui jouent encore.

*Fichiers : `shared/revision.ts`, `server/src/core/campagne.ts`*

### Le défi se tire quand le premier joueur le relève, et se clôt à la première demande
**Contexte** : le serveur peut dormir la nuit, et rien n'y tourne à heure fixe. Le défi doit pourtant être la même série pour tous, du lundi au dimanche.

**Décision** : les questions sont tirées au premier `POST /api/campagne/defi` de la semaine, puis figées dans `campagne_defis` ; si deux serveurs tirent en même temps, le premier tirage écrit l'emporte. La semaine passée se clôt à la première demande de la suivante. Il n'y a de vainqueur qu'avec deux joueurs au moins (seul, on n'a battu personne) et au moins une bonne réponse.

**Conséquence** : une semaine sans joueur n'a pas de tirage, et un tirage raté faute de questions se retente au relevé suivant. Les tentatives laissées en route s'arrêtent à la clôture.

*Fichiers : `server/src/core/campagne.ts`, `shared/campagne.ts`*

### L'Éclat du défi se tire à la fin de la tentative, jamais dans la relecture
**Contexte** : les hauts faits de série se recalculent au démarrage, quand `relireLesSeries` rejoue `recompenserLaSerie`. Un tirage placé à cet endroit serait refait à chaque relecture. Par ailleurs, la série et les sentiers se rejouent à volonté.

**Décision** : une chance sur vingt quand la tentative finit par sa dernière réponse, tirée dans `repondre`. Ni la série, ni la révision, ni les sentiers ne tirent l'Éclat ; au défi, c'est le calendrier, une tentative par semaine, qui sert de garde-fou.

**Conséquence** : une tentative arrêtée par la clôture ne tire pas l'Éclat. Un test qui compte l'expérience d'un défi doit neutraliser le tirage.

*Fichiers : `server/src/core/campagne.ts`, `shared/profil.ts`*

### Une correction qui change la bonne réponse change aussi l'identifiant
**Contexte** : les mesures d'une question (ses réponses, sa marche) sont attachées à son identifiant. Si la bonne réponse change, ces mesures décrivent une autre question.

**Décision** : une correction qui garde la bonne réponse, comparée sans casse, accents ni ponctuation, garde l'identifiant. Si la bonne réponse change, la correction tire un identifiant neuf et retire l'ancienne question, que ce soit à la main (`retirer`, puis `ranger`) ou à l'administration. Dans ce dernier cas, la correction est rangée dans `campagne_corrections` et remplace la ligne du fichier sans déploiement.

**Conséquence** : les parties déjà tirées gardent la version qu'elles ont lue. La production et la préproduction n'ont plus tout à fait la même base. Une correction ne repasse pas par le contrôle du même fait : après une correction faite hors d'un lot, il faut lancer `voisines`.

*Fichiers : `shared/campagne.ts`, `server/src/core/campagne.ts`*

### La base grandit grâce à l'abonnement Claude et à deux agents, sans l'API d'Anthropic
**Contexte** : l'API d'Anthropic écrirait tout d'un coup, à moitié prix, mais elle se facture à part, et le propriétaire n'en veut pas.

**Décision** : deux agents du projet font le travail avec une réflexion basse. Le rédacteur (Sonnet) écrit un lot et le vérifie jusqu'à zéro refus ; le relecteur (Opus) le relit et retire au moindre doute. Le script `generer-campagne.ts` fait le plan et la paperasse d'une génération en nombre. Le script `faits-wikidata.ts` fournit des faits sûrs, pour deux fois moins de jetons. Chaque lot est relu.

**Conséquence** : le dépôt n'a ni clé ni SDK — une seule exception, hors du dépôt : le crédit offert du 13 octobre 2026, qui a relu la base et l'a doublée (`retours/2026-10-13/credit-api.md`). Chaque vague consomme les limites du forfait que partage la routine du matin, si bien qu'aucune vague ne se lance dans l'heure qui la précède.

*Fichiers : `server/scripts/generer-campagne.ts`, `server/scripts/faits-wikidata.ts`, `.claude/agents/redacteur-campagne.md`, `.claude/agents/relecteur-campagne.md`*

### Une question part de sa famille, pas de son estimation seule
**Contexte** : une question partait de vingt réponses fictives à la part que son estimation d'écriture promettait, et la production n'avait jamais montré une même question à plus de sept joueurs. Le 15 octobre 2026, sur 5 801 questions jouées, 39 avaient changé de marche et aucune moyenne n'était devenue difficile ; pourtant, les 3 qui se répondent par une année ne se trouvaient qu'à 33 %, et une 2 du sport à 66 %.

**Décision** : de la difficulté 1 à la 3, ces vingt réponses fictives partent de la part mesurée sur la famille de la question — sa catégorie et sa difficulté, ou, pour une année, un autre nombre, un vrai ou faux, sa forme toutes catégories ensemble. La famille se compte sur la première réponse de chacun, sans les réponses de la question elle-même, et sans qu'une question y pèse plus de vingt réponses. La mesure les porte, jouées ou non : les tirages n'en savent rien. Les 4 et les 5 gardent leur estimation, parce que seuls les forts les atteignent.

**Conséquence** : une question jamais jouée profite de ce que sa famille a appris, et les dates passent difficiles d'elles-mêmes — une 3 qui se répond par une année part à 36 %, Lincoln devient difficile. Calculé ce jour-là sur la production avec ce code, 1 668 questions changeaient de marche (7 % de la base) : 1 458 faciles devenaient moyennes, surtout des 2 du sport, de la musique, des arts, de la géographie et de l'histoire ; 169 moyennes devenaient difficiles, surtout des dates ; 41 moyennes devenaient faciles. Les mélanges des sentiers, calibrés sur des moyennes trouvées à 55 %, redeviennent vrais d'une catégorie à l'autre. Le calcul prend quelques millisecondes toutes les dix minutes, et la famille de chaque question se lit une fois par base.

*Fichiers : `shared/campagne.ts`, `server/src/core/campagne.ts`, `server/test/campagne-familles.test.ts`*

## Les sentiers du savoir

Le détail : [les sentiers du savoir](../produit/les-sentiers-du-savoir.md).

### Les sentiers sont le seul chemin des avatars du savoir
**Contexte** : les soirées et le quiz du jour ouvraient un portrait aux bonnes réponses d'une catégorie (à 3, 20, 40, 75, 130 puis 200), presque à chaque partie : ils ne disaient plus rien.

**Décision** : un sentier par branche, un portrait tous les deux paliers ; les soirées et le quiz du jour n'en ouvrent plus. Chacun a gardé les siens, repris une fois en paliers validés — deux par portrait, sans étoiles —, sous un drapeau.

**Conséquence** : un portrait se mérite par une épreuve. Aucune table ne retient les portraits ouverts : ils se relisent des paliers, si bien que repousser le palier d'un portrait le reprendrait (invariant 22).

*Fichiers : `shared/branches.ts`, `server/src/core/repriseDesPortraits.ts`*

### Dix sur seize partout : ce sont les questions qui durcissent
**Contexte** : à douze bonnes réponses sur seize, les vraies épreuves butaient du cinquième au huitième palier — 38, 21, 9 puis 4 chances sur cent du premier coup pour un joueur moyen, au calcul.

**Décision** : un seul seuil, dix (neuf sur seize expertes au maître), et des mélanges qui montent d'un palier à l'autre, calculés par `calibrage-sentiers.ts`. Aucune experte avant le maître : moins d'un joueur sur cinq la trouve, et un palier à portrait qui en dépendrait se gagnerait à l'usure. Pas de vrai ou faux dès le cinquième palier : une chance sur deux au hasard.

**Conséquence** : la règle se retient en une phrase. Le seuil se fige dans chaque épreuve à son départ, et un palier validé ne se reprend jamais : un seuil ou un mélange changé ne vaut que pour les épreuves qui commencent. L'administration mesure chaque palier sur les vraies épreuves, pour régler sur des faits.

*Fichiers : `shared/sentiers.ts`, `server/scripts/calibrage-sentiers.ts`, `client/src/components/AdminCampagne.tsx`*

### Une épreuve est une série d'un autre mode, et rien ne se compte à côté
**Contexte** : paliers, étoiles, vies et confettis auraient pu être des compteurs, qu'un hoquet de la base fausserait.

**Décision** : une épreuve est une ligne de `campagne_series` (`mode = 'sentier'`, sa branche, son palier, son seuil, `rejeu`, `issue`). Paliers, étoiles, vies et confettis se relisent du journal à chaque lecture (`sentiersLus`, `lectureDesEchecs`, `viesDe`) ; seuls s'écrivent à part les vies achetées (`profile_vies`) et les paliers repris (`sentier_acquis`).

**Conséquence** : l'expérience, les confettis, la mesure des difficultés, les écussons et le carnet comptent une épreuve sans rien en savoir. Une règle de lecture changée vaut aussitôt pour le passé : les confettis des étoiles sont rétroactifs, pour tous. Une vie perdue, c'est `rejeu = 0` et `issue = 'ratee'` : ce qui ne doit rien coûter reste hors de `'ratee'`.

*Fichiers : `server/src/core/campagne.ts`, `shared/sentiers.ts`*

### Partir est gratuit, abandonner coûte une vie, rejouer est libre
**Contexte** : un palier raté coûte une vie, douze par jour pour tous les sentiers, sans cumul, et une réserve s'achète en confettis. Restait à dire ce que coûte une épreuve qu'on quitte.

**Décision** : abandonner une épreuve en jeu la compte ratée — une vie —, sinon on quitterait juste avant la faute de trop pour ne jamais rien perdre. « ← Partir » garde l'épreuve en jeu, sans rien coûter : on la reprend où on l'avait laissée. Un rejeu ne risque rien. Validée, la même pilule devient « Arrêter là · voir mon palier » et mène à la fin.

**Conséquence** : une seule épreuve en jeu à la fois — le serveur refuse les autres, rejeu compris, et la fiche d'un palier mène à celle qui attend. Abandonnée, une épreuve validée sautait la révélation de son portrait, la récompense même des sentiers : d'où « Arrêter là », qui rend sa fin.

*Fichiers : `server/src/core/campagne.ts`, `client/src/views/Sentiers.tsx`*

### Un chapitre change ce qu'on lit, jamais la difficulté
**Contexte** : le propriétaire voulait des sentiers « beaucoup plus orientés sur un thème précis », sans compliquer la règle ni fausser les mélanges calculés.

**Décision** : les huit premiers paliers vont par deux, chaque paire un chapitre nommé, fait d'un à trois sous-thèmes de la catégorie, chaque sous-thème dans un seul chapitre ; ses questions passent devant le reste de la catégorie, à la même marche. Du neuvième palier au maître, toute la catégorie, chaque sous-thème à son tour.

**Conséquence** : au tirage, le thème passe devant la fraîcheur — une question du thème déjà vue passe devant une jamais vue d'ailleurs —, sauf celles vues ces dernières vingt-quatre heures.

*Fichiers : `shared/chapitres.ts`, `server/src/core/campagne.ts`*

### Le tirage ne repose ni la veille ni deux jumelles, et une marche reste sa marche
**Contexte** : qui usait ses vies sur un palier revoyait le soir même les questions qu'il venait de rater ; une épreuve de la forêt posait quatre « Comment appelle-t-on le petit de… », mêmes leurres.

**Décision** : une question vue ces dernières vingt-quatre heures ne revient qu'en dernier recours (`VUE_RECENTE_MS`) ; pas deux jumelles — même forme d'intitulé, ou deux réponses proposées en commun — quand la marche en a d'aussi fraîches et que le tour des sous-thèmes le permet ; une marche épuisée de jamais vues reprend ses déjà vues plutôt que d'emprunter à la voisine, ce qui changerait la difficulté mesurée, et n'emprunte que vide.

**Conséquence** : la série, le défi, les duels et le quiz tout prêt partagent la règle des jumelles. Une marche vide emprunte d'abord à sa voisine plus dure (`EMPRUNTS`) : une catégorie maigre en difficiles poserait une experte à un palier à portrait.

*Fichiers : `server/src/core/campagne.ts`, `server/src/core/jumelles.ts`*

### Les étoiles et le palier paient
**Contexte** : la deuxième et la troisième étoile se jouaient pour rien, et l'épreuve qui ouvrait un portrait ne rapportait pas un point de plus que la série d'à côté.

**Décision** : un palier validé en épreuve paie une fois 50 XP, 100 s'il ouvre un portrait, 250 au maître, dans la ligne d'expérience de la campagne ; la meilleure note de chaque palier paie 10 confettis à deux étoiles, 25 à trois — le prix d'une vie —, et un progrès la différence.

**Conséquence** : les confettis des étoiles se relisent à chaque lecture du solde, rétroactivement pour tous ; l'expérience d'un palier se recompte avec la ligne `#campagne`, réécrite à chaque bonne réponse ; un palier repris des portraits d'avant ne paie qu'une fois rejoué et validé.

*Fichiers : `shared/sentiers.ts`, `server/src/core/campagne.ts`, `server/src/core/baremeDuSolo.ts`*

### Les parcours de thème : apprendre sans rien risquer, hors des sentiers
**Contexte** : monter un sujet de la campagne — un thème, une époque, un fil rouge — comme un sentier, mais pour apprendre, sans rien perdre. Rangés sous les douze sentiers, les parcours se prenaient pour eux, alors qu'ils n'en ont ni les vies ni les avatars.

**Décision** : un parcours par sujet qui a soixante questions jouables, six étapes de dix, sept pour passer, sans vies, sans abandon ni récompense d'étape ; dans l'onglet « Apprendre », sous le carnet ; la page dit « parcours » et « étape ».

**Conséquence** : le code, les tables et l'API gardent leurs noms d'avant (`sujet`, `palier`, `mode = 'sujet'`) ; leurs étoiles ne paient pas, seul `mode = 'sentier'` se lit ; le refus partagé du tirage dit encore « Ce sentier… ».

*Fichiers : `shared/sentiersDeSujets.ts`, `client/src/views/Parcours.tsx`, `server/src/core/campagne.ts`*

## Les duels

Le détail : [les duels](../produit/les-duels.md).

### La cote se relit du journal, elle ne s'écrit pas
**Contexte** : la cote, les ligues de chaque semaine, les confettis qu'elles paient et les crans des bordures pourraient se tenir dans des colonnes, mises à jour à chaque duel.

**Décision** : rien de tout cela ne s'écrit ; tout se relit à chaque lecture dans le journal des duels finis, du plus ancien au plus récent (`releverLesDuels` sur `lectureDesDuels`), comme les confettis des soirées.

**Conséquence** : un hoquet de la base ne fausse rien, et une règle changée vaut aussitôt pour tout ce qui a été joué — pour tous, solde de confettis compris : changer la cote ou les ligues est un choix de produit à annoncer (CLAUDE.md). Un profil supprimé emporte ses duels du journal de ses adversaires, et chaque duel fini relit toutes les cotes pour dire sa place.

*Fichiers : `shared/duels.ts`, `server/src/core/campagne.ts`*

### Contre quelqu'un, on bouge contre sa cote figée, pas contre son score
**Contexte** : au dé, la force d'en face est la cote du score d'Automate. Contre un vrai joueur, un second profil qui rejouerait les questions en connaissant les réponses choisirait son score — et perdre exprès nourrirait l'autre profil.

**Décision** : chacun bouge contre la cote de l'autre au lancement, écrite avec le duel (`campagne_duels.cote_auteur`, `cote_adversaire`), depuis sa propre cote au moment où le duel compte ; rien ne passe d'un profil à l'autre.

**Conséquence** : battre un profil neuf ne rapporte que ce qu'une cote de 1 000 vaut ; l'enjeu dit au lancement peut différer de l'écart final si d'autres duels comptent entre-temps ; ces deux cotes sont les seules valeurs figées, qu'un changement de barème ne relit pas.

*Fichiers : `shared/duels.ts`, `server/src/core/campagne.ts`*

### Personne ne perd de points en dormant
**Contexte** : un duel asynchrone peut rester sans réponse, et l'on ne choisit pas qui vous défie.

**Décision** : un duel contre quelqu'un ne compte que si ses deux tentatives existent — finies des deux côtés, ou commencées des deux côtés à sa fermeture, sept jours après son lancement ; au dé, seule la cote de qui joue bouge.

**Conséquence** : un duel jamais relevé ne compte pour personne ; une rencontre laissée en route ne compte pas et ne ferme jamais, si bien que la quitter en perdant gèle la défaite tant qu'on ne la reprend pas — le dé la reprend avant tout autre.

*Fichiers : `server/src/core/campagne.ts`*

### Le score d'en face reste caché jusqu'à sa dernière réponse
**Contexte** : « à battre : 8 » se lisait avant la première question d'un duel reçu, et un duel gagné continuait jusqu'à la troisième erreur sous « −36 si tu perds ».

**Décision** : aucun champ ne porte le score de l'auteur d'un duel contre quelqu'un avant la dernière réponse de qui le relève (`DuelEntreAmis.aBattre`, `DuelContre.sesJustes`, `AdversaireEnJeu`…) ; la partie s'arrête dès que le score à battre est dépassé. Au dé, le score courant d'Automate se dit après chaque réponse, et son total n'arrive qu'à la fin.

**Conséquence** : un champ neuf qui porterait un score d'en face attend comme les autres ; `duels-contre.test.ts` et `duels-page.test.ts` le gardent.

*Fichiers : `server/src/core/campagne.ts`, `client/src/views/CampagneApp.tsx`, `client/src/views/Duel.tsx`*

### Le dé ne joue que contre Automate, tenu à deux bonnes réponses
**Contexte** : le dé rejouait la série finie d'un autre joueur. Sur un serveur de quelques amis, on les avait vite toutes affrontées, et la série d'un ami absent, sous son profil, « c'est trompeur ». Puis Automate, libre, s'écartait de quatre bonnes réponses ou plus un duel sur cinq : des défaites de dix réponses, des victoires sans partie.

**Décision** : un adversaire simulé, dit simulé, toujours disponible, qui joue comme le joueur — au niveau de campagne pendant son placement, à celui de sa cote ensuite —, ses réponses tirées au départ et son score tenu à `ECART_D_AUTOMATE` de ce qu'on attend de lui (jusqu'à 50 tirages, la plus proche gardée).

**Conséquence** : des parties serrées dès le premier duel ; à un seul d'écart, tous les duels se ressembleraient et l'enjeu trahirait son score ; les rencontres d'avant gardent les réponses de l'autre, recopiées.

*Fichiers : `server/src/core/campagne.ts`, `shared/duels.ts`*

### Le modèle du savoir, pas pour les marches
**Contexte** : la part de ceux qui trouvent une question ne dit pas qui l'a jouée : seuls les forts atteignent les expertes, qui passaient pour faciles, et Automate ne savait pas où un joueur est faible.

**Décision** : un modèle de Rasch avec un écart par catégorie et par joueur, ajusté sur la première réponse de chacun à chaque question, refait en fond au plus toutes les trente minutes et jamais sur le chemin du dé, rendant la main par tranches (`CHANCES_PAR_TRANCHE`) ; Automate le lit, puis la page des sentiers pour dire à chacun sa chance (décision suivante) — les marches des séries, des sentiers et du quiz tout prêt gardent `tauxLisse`, sur lequel leurs mélanges ont été calibrés.

**Conséquence** : mesuré avec `server/scripts/calibrage-automate.ts`, les issues bougent à peine (44/13/43 % puis 45/13/42 %), mais ses chances collent à celles du joueur et le niveau de placement tombe deux fois plus près du vrai ; `/healthz` dit son état, sans un nom.

*Fichiers : `server/src/core/modeleDuSavoir.ts`, `server/src/core/campagne.ts`, `server/scripts/calibrage-automate.ts`*

### Dire à chacun sa chance, plutôt qu'adoucir les paliers
**Contexte** : les sentiers semblaient trop durs pour un avatar, et le mur se trouvait au septième palier — seize moyennes, dont un tiers des joueurs ne passaient pas. Le propriétaire a refusé, le 15 octobre 2026, d'adoucir les paliers ou de baisser la ligne d'or à mesure des vies perdues : « on donne en quelque sorte la victoire ». Les questions difficiles restent ; certains domaines sont plus durs que d'autres pour chacun.

**Décision** : la page des sentiers dit à chacun sa chance de valider du premier coup le palier qui l'attend, sentier par sentier — en couleur de piste sur chaque tuile, en clair dans le bloc du haut et dans la fiche du palier —, et ce qu'elle valait il y a une semaine, lue par le modèle du savoir sur ses premières réponses (`chanceDeLEpreuve`). Mesurée d'abord sur les vraies épreuves, hors échantillon : le modèle ajusté avant le 8 octobre, jugé sur les 215 épreuves du 8 au 15, annonçait 7 % à des épreuves qui se validaient une fois sur trois, et 0 % au maître, validé un essai sur trois. Deux corrections : le modèle apprend ce que vaut chaque difficulté estimée, en bloc (`ECART_DES_ESTIMATIONS` — les 5 se trouvaient à 42 %, pas à 10 %), la 3 tenant l'échelle ; et la chance d'une épreuve intègre la forme du jour (`FORME_D_UNE_EPREUVE`, 0,7 logit), qui fait varier un même joueur d'une épreuve à l'autre.

**Conséquence** : sur les mêmes épreuves, la perte (log) passe de 0,71 à 0,56, et chaque tranche tient : annoncées 16, 32, 56 et 86 %, elles se validaient à 9, 36, 51 et 87 %. Rien ne change aux paliers ni aux marches ; Automate lit le même modèle, mieux ajusté. Sous vingt premières réponses, ou avant le premier ajustement, la page ne dit rien.

*Fichiers : `server/src/core/modeleDuSavoir.ts`, `server/src/core/campagne.ts`, `shared/sentiers.ts`, `client/src/views/Sentiers.tsx`, `server/test/sentiers-pour-toi.test.ts`*

### Des trophées pour les sentiers, comptés en épreuve

**Contexte** : la campagne avait peu de trophées à gagner, et un portrait tous les deux paliers ne suffisait pas à revenir sur des sentiers durs (le propriétaire, le 15 octobre 2026). La page des sentiers de l'album ne montrait que les douze maîtres, que presque personne n'atteint. Adoucir restait exclu (la décision d'avant).

**Décision** : trois pistes et deux exploits, sur la page « Sentiers » de l'album, mesurés sur la production avant d'être fixés. Les pistes comptent ce qui s'use à jouer — Le Randonneur, les paliers validés en épreuve (12, 48, 120) ; La Constellation, leurs étoiles (25, 100, 250) ; Le Cartographe, les sentiers validés jusqu'au palier 8, le dernier des chapitres (3, 6, 12) — : quatre joueurs sur seize auraient eu les deux premières au bronze, un à l'argent. Les exploits disent un moment : L'Impeccable, seize sur seize dès le cinquième palier (personne ne l'a encore fait), et Contre toute attente, un palier validé du premier coup que sa chance annonçait en piste noire (un premier essai noir sur huit a été validé). Tout se compte en épreuve : un palier repris d'un ancien portrait n'y entre qu'une fois rejoué et validé, comme son expérience. Contre toute attente se juge à la chance **gardée au départ** de l'épreuve (`campagne_series.chance`) : recalculée à la fin, elle aurait lu un autre modèle et des réponses que la page n'annonçait pas.

**Conséquence** : l'album passe de 180 à 191 trophées. Les pistes tombent avec celles de la campagne, qui compte les épreuves ; une relecture à part (`relireLesEpreuves`, `VERSION_DES_EPREUVES`) les a données à qui les tenait déjà — un passage par joueur des sentiers, quand monter `VERSION_DES_SERIES` aurait relu les cinq cents séries au démarrage que l'hébergeur attend. Une seule règle dit désormais où se gagne un trophée (`origineDe`) : quatre fichiers la recopiaient. Rien n'est adouci, et rien n'ouvre encore d'avatar : les surprises viendront après.

*Fichiers : `shared/hautsfaits.ts`, `shared/sentiers.ts`, `shared/trophees.ts`, `server/src/core/campagne.ts`, `server/test/sentiers-trophees.test.ts`*

### Des amis sans demande, un seul blocage, un « en ligne » réciproque
**Contexte** : le propriétaire voulait « une liste d'amis avec leur classement et leur ligue, et pouvoir ajouter des amis » ; un « en ligne » montré à tous dirait à un inconnu quand on se connecte.

**Décision** : sa liste à soi, comme un carnet d'adresses — ajouter sans demande ni acceptation ; être ami ne donne aucun droit de plus, tout profil non masqué se défie ; retirer est le seul blocage, et l'autre ne l'apprend pas (sa fin dit « Parti à » quand même) ; « en ligne » ne se montre qu'entre amis réciproques.

**Conséquence** : un inconnu ne guette pas quand on se connecte ; un duel lancé par un retiré est retenu, et arrive si on le rajoute ; on ne bloque pas qui n'est pas dans sa liste.

*Fichiers : `server/src/core/campagne.ts`, `server/src/auth/profiles.ts`, `client/src/components/GestesDuJoueur.tsx`*

### Rien ne sonne : l'accueil dit ce qui attend, et la page le montre
**Contexte** : les duels envoyaient des notifications ; seul le quiz du jour garde son rappel du soir.

**Décision** : aucune notification pour les duels ; la tuile de l'accueil compte en rouge les résultats à voir et les duels à relever, une bannière annonce un résultat une fois, et ce que l'accueil compte, l'onglet « En cours » le montre — par la même règle (`sesDuelsContre`).

**Conséquence** : la page lit tous les duels en route, pas seulement les dix derniers (un duel plus ancien, compté en rouge, y était introuvable) ; la première lecture d'un résultat par son auteur l'écrit vu (`vu_le`), et la page d'un duel ne se précharge donc jamais.

*Fichiers : `client/src/components/AccueilDesRoles.tsx`, `server/src/core/campagne.ts`, `client/src/views/Duels.tsx`*

### Deux cotes : le niveau caché, la montée qu'on voit
**Contexte** : une joueuse qui lançait beaucoup de duels « ne faisait que reculer » ; le propriétaire, le 14 octobre 2026 : « je veux que tout le monde monte en Or s'il joue, même s'il n'est pas très bon ». Mesuré sur la production (`server/scripts/calibrage-duels.ts`, en lecture seule) : tout le monde en Bronze, les trois joueurs les plus actifs sous 1 000, une partie sur deux qui faisait reculer — l'ELO seul mesure un niveau, il ne récompense pas l'envie de jouer. Et l'échelle, posée sans mesure, mettait 1 000 à huit bonnes réponses quand la médiane des séries en fait sept.

**Décision** : deux cotes. La cachée, l'ELO d'avant, placement compris, dit le niveau et règle Automate. Celle qu'on voit — ligues, classement, bordures, confettis — suit la montée : sous l'Or, chaque duel rapporte cinq points et une défaite n'en coûte qu'un au plus ; dès l'Or, un point par duel, et l'enjeu suit l'écart (une défaite coûte 24 × E²) ; l'argent et l'or ne se perdent plus ; qui lance un défi gagne un point de plus. `SCORE_DE_REFERENCE` passe de 8 à 7. Des échelles plus larges (75 ou 100 points par bonne réponse), rejouées sur les vrais duels, ne changeaient presque rien : la montée l'emporte.

**Conséquence** : qui joue monte en Or, même en ne gagnant qu'un duel sur trois (`server/test/duels-montee.test.ts`), et au-dessus c'est le niveau qui parle ; Automate, réglé sur la cachée, ne se renforce pas avec la cote qu'on voit — réglé sur elle, on perdait la moitié des duels au lieu de quatre sur dix. La règle se relit du journal : le jour même, ceux qui avaient reculé l'ont regagné, et le duel d'avant la montée, qui n'a figé qu'une cote, sert aux deux. La cote cachée ne part jamais au téléphone. Depuis le 17 octobre 2026, la platine se garde aussi, et l'ELO commence à elle ([plus bas](#le-dé-à-chances-égales-sur-ce-quon-choisit--la-platine-où-lelo-commence)).

*Fichiers : `shared/duels.ts`, `server/src/core/campagne.ts`, `client/src/views/Duels.tsx`, `server/scripts/calibrage-duels.ts`*

### L'enjeu se dit partout où l'on choisit un adversaire, et le dé tire avant de demander
**Contexte** : l'échelle du classement ne disait que le gain (« +21 si tu gagnes ») ; la préparation d'un défi rangeait l'enjeu dans une phrase sous « Jouer le duel », hors de l'écran du téléphone, et le taisait sans sa propre cote — après une revanche ; le dé lançait la partie d'un toucher. Le propriétaire, le 14 octobre 2026 : « savoir aussi combien je perds si je défie quelqu'un et que je perds », « une confirmation avec le dé pour jouer contre l'automate : combien je gagne ou je perds si je joue », et « de manière globale, quand je lance un défi et que je choisis quelqu'un, voir ce que je gagne / perds ».

**Décision** : la victoire et la défaite, dites de la même règle que la cote (`enjeuContre`) et des mêmes pièces, là où l'on choisit : l'échelle du classement, la carte d'un joueur sous « Défier », deux jetons sous l'adversaire choisi d'une préparation — les deux cotes relues quand la sienne manque. Le dé tire d'abord la rencontre, puis une feuille dit son enjeu avant « Jouer le duel ».

**Conséquence** : l'enjeu du dé est exact — il se lit contre le score qu'Automate vient de jouer, quand une estimation d'avant le tirage aurait annoncé une autre valeur que la partie —, mais la rencontre existe dès le dé touché : fermée, la feuille la laisse dans « En cours », et le dé la reprend au lieu d'en tirer une autre — sinon on relancerait le dé jusqu'à un Automate plus faible. « Un autre duel », sous un verdict, passe par la même feuille. Depuis le 16 octobre 2026, l'enjeu du dé ne dépend plus du tirage, et le dé demande avant de tirer ([plus bas](#le-dé-à-chances-égales-sur-ce-quon-choisit--la-platine-où-lelo-commence)).

*Fichiers : `client/src/views/Rencontre.tsx`, `client/src/views/Duel.tsx`, `client/src/views/Duels.tsx`, `client/src/views/LancerUnDefi.tsx`, `client/src/components/GestesDuJoueur.tsx`*

### Un duel déjà ouvert se dit là où l'on choisit qui défier
**Contexte** : un seul duel classé ouvert par paire, et le serveur refusait le second — mais seulement à « Jouer le duel », au bout de la préparation. La carte d'un joueur disait « Défier » à qui l'on affrontait déjà, et le classement entier ne marquait personne. Le propriétaire, le 15 octobre 2026 : « on peut défier nos amis / global depuis la carte, mais potentiellement on a déjà un duel engagé et ça ne nous prévient pas » ; « dans le classement complet, c'est pareil : on n'a pas d'indication si on les combat ».

**Décision** : le refus et ce qu'on montre lisent la même règle (`duelOuvertEntre`), par la route qui dit un joueur touché (`FaceAFace.enCours`). Sa carte dit où en est le duel à la place de « Défier », et le rouvre s'il est à lui ; la préparation le dit sous l'adversaire choisi, et « Jouer le duel » attend ; le classement entier marque d'un sablier qui l'on affronte déjà, « Entre amis » et toute l'échelle disent « En cours ».

**Conséquence** : un duel lancé contre lui et pas encore parti se dit sur la carte, sans son code — `releverUnDuel` ne vérifie pas qu'un duel classé est parti, et ce code laisserait l'adversaire jouer d'abord ; le classement, qui lit « En cours », ne le marque pas : il n'existe pas encore pour lui. La préparation lit chaque adversaire qu'on y choisit, une requête de plus.

*Fichiers : `server/src/core/campagne.ts`, `shared/duels.ts`, `client/src/views/Rencontre.tsx`, `client/src/components/GestesDuJoueur.tsx`, `client/src/views/Duels.tsx`, `client/src/views/LancerUnDefi.tsx`*

### Le dé à chances égales, sur ce qu'on choisit ; la Platine, où l'ELO commence
**Contexte** : le propriétaire, le 16 octobre 2026, en ligue d'or, presque platine : « je veux jouer contre un automate, déjà ça lance le défi et il est toujours en cours même si j'ai pas lancé. Je peux pas choisir le thème. Et surtout je perds 17 pour gagner 4. C'est normal ? ». Mesuré sur la production (`server/scripts/calibrage-duels.ts`, en lecture seule) : les quatre joueurs en Or avaient une cote cachée de 969 à 1016 — six à sept bonnes réponses par série — pour une cote affichée de 1271 à 1298. Automate jouait à leur niveau (on le bat quatre fois sur dix), mais l'enjeu lisait son score contre la cote affichée : 85 à 88 % de chances pour la formule, « +4 / −17 », six points perdus par duel en moyenne, et cent duels ramenaient chacun au plancher de l'Or. Entre amis, cotes gonflées pareil, une défaite ne coûtait dès l'Or que 24 × E² : « +13 / −5 » à chances égales, et le haut montait de 2,3 points par duel. Les deux se contredisaient : les duels entre amis faisaient monter, Automate faisait redescendre.

**Décision** : quatre chemins proposés — l'enjeu sur les chances réelles, le niveau d'abord, rien qu'une phrase, des chances égales —, le propriétaire a choisi les chances égales. Sur la cote qu'on voit, Automate compte comme un adversaire de sa cote (`forceQuOnVoit`) : « +17 / +2 » sous l'Or, « +13 / −5 » en Or, « +13 / −11 » dès la Platine, quel que soit son score ; la cachée, elle, bouge toujours contre son score, et règle Automate. À chances égales, 24 × E² fait monter de quatre points par duel, et rien ne l'arrêtait : l'ELO dès l'Or, proposé le 16, rendait de 19 à 42 points aux joueurs en Or. Le propriétaire l'a refusé le 17 : « Je ne veux pas changer pour l'or la formule, je trouve que monter jusqu'en platine c'est bien comme ça. Je veux aussi ne pas pouvoir retomber en or en platine et à partir de platine c'est là que ça commence vraiment. » L'Or garde 24 × E², la Platine se garde (`LIGUES_GARDEES`), et l'ELO, 24 × E, ne commence qu'à elle (`LIGUE_DE_L_ELO`) : à ses vraies chances, un duel n'y rapporte plus que son point de participation. L'enjeu ne dépendant plus du tirage, le dé demande d'abord : sa feuille (`LeDe`, `FeuilleDuDe`) dit l'enjeu (`enjeuDuDe`) et sur quoi il jouera — la ligne du choix de la série, ses catégories ou un sujet, que `POST /api/campagne/rencontre` reçoit comme une série —, et ne tire qu'à « Jouer le duel ». Fermée, rien n'est tiré.

**Conséquence** : la règle se relit du journal, pour tous et pour le passé : le jour même, aucune cote de la production n'a baissé — trois joueurs en Platine ont gagné de 1 à 5 points, et celui qui en était retombé l'a retrouvée. Qui joue monte jusqu'en Platine, même en ne gagnant qu'un duel sur trois (`server/test/duels-montee.test.ts`) ; au-delà, le dé ne fait plus monter — on y gagne quatre duels sur dix, à « +13 / −11 » —, on monte en battant des joueurs. Relancer le dé ne choisit plus rien : on ne voit plus rien de la partie d'Automate avant de s'engager, et une rencontre tirée reprend, sans s'abandonner. Au dé, une victoire vaut autant contre un gros score que contre un petit : sous l'Or, cent points ne tiennent plus que six victoires, et seuls des duels contre plus faible sertissent les douze crans de l'argent (`server/scripts/duelsDEssai.ts`). Sur un thème, Automate se règle toujours sur une série de toutes les catégories : ses écarts de catégorie jouent, il est plus faible là où le joueur l'est. Ce qui précède — « le dé tire avant de demander » — ne vaut plus.

*Fichiers : `shared/duels.ts`, `server/src/core/campagne.ts`, `server/src/campagne.ts`, `client/src/views/Duel.tsx`, `client/src/views/Duels.tsx`, `client/src/views/CampagneApp.tsx`, `server/scripts/calibrage-duels.ts`, `server/test/duels-de.test.ts`, `server/test/duels-montee.test.ts`*

### Un adversaire plus bas compte à son plancher
**Contexte** : le propriétaire, le 17 octobre 2026 : « de jouer des joueurs qui jouent peu et qui sont en ligue bronze, ça fait perdre beaucoup à des platines, ça donne donc pas envie de jouer le duel. Comment on pourrait faire pour régler ce problème ? Ou c'est inévitable ? ». Sous la Platine, la cote qu'on voit dit surtout combien on a joué — la montée paie la participation —, mais la formule lisait l'écart comme un écart de niveau : à 1 330, un bronze à 1 030 laissait 85 % de chances au joueur en Platine, « +5 / −16 » sous 24 × E², « +5 / −19 » sous l'ELO. Mesuré sur la production, en lecture seule : 22 duels d'un joueur en Or contre un bronze, que la formule donnait gagnant à 75 % — 36 % gagnés, 14 % de nuls, 50 % perdus ; les cotes cachées disaient 49 %, les bronzes avaient le niveau des joueurs en Platine.

**Décision** : quatre chemins proposés — l'adversaire compté à son plancher, des chances égales contre plus bas, les vraies chances des cotes cachées, ne rien changer —, le propriétaire a choisi le premier. Sur la cote qu'on voit, un adversaire plus bas que les ligues qu'on garde compte à son plancher (`apresLeDuel`) : en Platine, un bronze vaut 1 300, la cote où chacun y entre — « +12 / −12 » à 1 330 ; en Or, « +11 / −7 ». La cote cachée, elle, bouge toujours contre la sienne.

**Conséquence** : en Or, une défaite ne coûte plus jamais plus qu'une victoire ne rapporte. Entre joueurs de la Platine, rien ne change ; un diamant à 1 450 reste favori contre qui vient d'y entrer (« +8 / −16 ») : battre des bronzes ne fait pas monter sans fin, comme des chances égales contre plus bas l'auraient permis. Les vraies chances, justes duel par duel, auraient fait de la cote au-dessus de la Platine un compte des duels joués — chacun y gagnant son point de participation en moyenne, fort ou pas —, et l'enjeu affiché aurait trahi les cotes cachées. Tout passe par `apresLeDuel` : le relevé, chaque enjeu dit (`enjeuContre`) et le rejeu de `calibrage-duels.ts`. Relue du journal, aucune cote de la production n'a baissé.

*Fichiers : `shared/duels.ts`, `client/src/views/Duels.tsx`, `server/test/duels-montee.test.ts`, `server/test/duels-page.test.ts`*

## L'Expédition

Le détail : [l'Expédition](../produit/l-expedition.md), et le brief de la V1, `retours/2026-10-17/expedition.md`.

### Ce qu'on a gagné sert enfin, mais seulement en expédition
**Contexte** : le propriétaire, le 17 octobre 2026 : « on fait que rajouter des choses mais on ne sait plus quoi choisir », et « les légendaires pourrait donner justement des pouvoirs pour aider à avancer ». Or un profil ne donnait aucun avantage de jeu (invariant 8) : en soirée, un niveau 30 et un invité arrivé ce soir jouent la même partie, et c'est ce qui laisse le chemin anonyme entier.

**Décision** : un mode à part, l'Expédition, où les légendaires se gagnent — au bout de l'acte 3, l'un des trois gardiens vaincus — et où ils servent, en jokers (l'étape 2). L'invariant 8 devient « aucun avantage de jeu face aux autres » : ni en soirée, ni au quiz du jour, ni au défi, ni en duel ; seule l'expédition, qu'on joue seul, fait servir ce qu'on a gagné, et ses jokers n'en sortent jamais. Elle n'a pas de classement. Les Divins n'ont ni joker ni gardien (invariant 21).

**Conséquence** : aucune route d'un autre mode n'accepte un joker. Chaque légendaire qui a son joker reçoit une voie de plus (`aussi`, `expedition:<légendaire>`), qui ne reprend rien à personne (invariant 22) ; ceux de saison n'en ont pas : ils ne se gagnent qu'à leur saison, par elle seule.

*Fichiers : `shared/expedition.ts`, `shared/jokers.ts`, `shared/legendaires.ts`, `CLAUDE.md`*

### Une expédition est une partie d'un autre mode, et son état le pli de son journal
**Contexte** : une expédition dure vingt à trente questions, se laisse et se reprend, et ses réponses doivent compter comme toutes les autres — l'expérience, les confettis, le carnet, « jamais vues d'abord ».

**Décision** : une ligne de `campagne_series` (`mode = 'expedition'`), qui garde son départ — ses trois cartes, la chance sur chaque escale, ses gardiens (`campagne_series.expedition`) —, ses réponses dans `campagne_reponses`, et ses gestes dans leur journal (`expedition_gestes`), chacun avec le rang qu'il suit. Rien d'autre ne s'écrit : l'état — l'acte, l'escale, les vies, le gardien, l'issue — se replie du départ, des gestes et des réponses (`pliDeLExpedition`), le même pour celle qu'on joue et pour une finie (invariant 14). Le hasard de la carte se rejoue de sa graine (`hasardDe`) ; seules les questions se tirent de la base, à chaque escale, dans le lot du geste qui y mène.

**Conséquence** : un double toucher, un second onglet ne jouent pas deux fois (invariant 12, porté au solo) ; recharger ne retire rien ; une retouche du générateur ne déplace pas une escale sous les pieds de qui joue. Toute requête des parties filtre son mode : l'expédition n'est ni une série — ni record, ni Grande Série, ni L'Alpiniste —, et Le Marathonien la compte.

*Fichiers : `shared/expedition.ts`, `server/src/core/campagne.ts`, `server/src/expedition.ts`, `server/test/expedition-pli.test.ts`, `server/test/expedition.test.ts`*

### Une source est une révision : sa réponse ne mesure rien
**Contexte** : une source de l'expédition repose une question du carnet, déjà ratée, réponse lue. Les révisions sont écartées de la mesure des difficultés, des écussons et de L'Érudit pour cette raison : comptées, elles feraient passer pour faciles les questions que tout le monde rate une fois, et trois expertes ratées exprès feraient L'Érudit.

**Décision** : la question qu'une source reprend du carnet le dit (`QuestionDeSerie.carnet`), et un seul fragment l'écarte (`HORS_DU_CARNET`) — de L'Érudit, de la précision et des écussons, des catégories des missions ; la mesure lit d'un coup les quelques questions des expéditions plutôt qu'une série par réponse. Le carnet, lui, la compte : retrouvée, elle avance comme en révision.

**Conséquence** : une source paie comme toute bonne réponse — un confetti, l'expérience, Le Marathonien —, et ne dit rien du savoir. Les premières réponses, que lit le modèle du savoir, n'en ont pas besoin : une question du carnet a toujours la sienne avant.

*Fichiers : `server/src/core/campagne.ts`, `server/test/expedition.test.ts`*

### L'expédition s'ouvre en production avec ses jokers
**Contexte** : le brief découpe la V1 en quatre étapes, chacune sa PR. La simulation, puis le calibrage sur le vrai code (`server/scripts/calibrage-expedition.ts`), disent qu'au bout sans jokers le joueur moyen n'arrive que quatre fois sur cent : les jokers font le mode.

**Décision** : jusqu'aux jokers, ses routes répondaient 404 en production — en ligne et sans `APP_ENV` (`EXPEDITION_EN_PRODUCTION`, `expeditionOuverte`) ; la préproduction, `npm run dev` et les tests la jouaient. Sa voie ne se montrait nulle part (`voiesMontrees`), et l'accueil n'avait pas son bouton. Les jokers venus (l'étape 2, le 17 octobre 2026), la constante l'ouvre : ses routes, le bouton « L’Expédition » de l'accueil d'un profil, sous les duels, et sa voie dans l'album.

**Conséquence** : rien ne s'y est gagné en production avant que le mode soit entier. La refermer, c'est repasser la constante ; les légendaires gardés restent. La voie montrée, la phrase de l'album se dit voie par voie (`ouIlSeGagne`) : un seul mot pour tous ses lieux disait que la Chimère se gagnait « en soirée, au quiz du jour, en campagne ou en expédition », quand il lui faut les trois premiers ensemble, ou l'expédition.

*Fichiers : `shared/jokers.ts`, `server/src/expedition.ts`, `shared/legendaires.ts`, `shared/album.ts`, `client/src/components/AccueilDesRoles.tsx`, `server/test/expedition-legendaires.test.ts`, `server/test/album-des-avatars.test.ts`*

### La main se garde, la défausse revient à l'acte suivant
**Contexte** : les maquettes tiraient deux jokers par question et jetaient ceux qu'on ne jouait pas : jouer ne coûtait rien, on jouait tout sans choisir, et un joker de carte, tiré devant une question, ne pouvait pas attendre la carte. Une défausse rendue dès le paquet vide laissait un seul Double chance repasser presque à chaque question : il portait le joueur moyen de 3 à 31 %, autant qu'une équipée entière.

**Décision** : un joker tiré par question, trois en main (`MAIN_MAX`) — quatre et deux tirés sous Trois têtes ; ce qu'on ne joue pas se garde. Un joker à jouer au plus par question ; joué, il va à la défausse, qui ne revient au paquet qu'à l'acte suivant ; un posé agit jusqu'au bout de l'acte. Le hasard — la pioche, les offres, la maison qu'on ouvre, les réponses effacées — vient de la graine et du rang du tirage, et le pli rejoue le tout (`pliDeLExpedition`).

**Conséquence** : chaque joker sert une fois par acte, et le paquet qui s'épuise avant le gardien est la tension du mode ; un paquet court tire plus souvent ses meilleurs — d'où le campement qui retire un joker, et l'offre qu'on peut laisser. Recharger ne retire ni une main ni une offre.

*Fichiers : `shared/expedition.ts`, `shared/jokers.ts`, `server/test/expedition-jokers.test.ts`*

### Un joker se joue en deux touchers, et une seule règle dit pourquoi pas
**Contexte** : un joker joué ne se reprend pas. Sur la maquette 4, toucher sa carte le jouait : un toucher perdu sous les réponses coûtait le meilleur joker de l'acte. Et un joker qui ne se joue pas — un second sur la même question, Sagesse sur un vrai ou faux, le Commandement face au gardien — se refusait sans dire pourquoi.

**Décision** : touchée, sa carte se lève — en grand, depuis le 18 octobre 2026 —, dit ce qu'il fait et le joue d'un bouton — ou dit pourquoi il ne se joue pas maintenant ; toucher à côté la repose. Ce pourquoi vient d'une seule règle pure (`refusDuJoker`) : le pli l'applique, le serveur la renvoie en refus, et la vue la porte pour chaque joker de la main (`JokersEnJeu.refus`) — la carte éteinte dans la main, la raison sur la carte levée. Un joker joué sur une question porte sa position : périmé, il est refusé, et le pli ne juge la question qu'après lui.

**Conséquence** : la page n'a aucune règle des jokers à recopier ; une règle changée vaut d'un coup pour le pli, le refus et l'écran.

*Fichiers : `shared/expedition.ts`, `server/src/core/campagne.ts`, `client/src/views/ExpeditionApp.tsx`*

### Ce qu'un joker montre se calcule au serveur, et une réponse aidée ne mesure rien
**Contexte** : Coup d'œil efface une mauvaise réponse, l'Énigme dit le siècle, l'Oracle dit « plus haut » : tous lisent la bonne réponse. Et une question trouvée avec deux réponses barrées n'a plus la difficulté qu'on mesure ; comptée, elle ferait passer pour faciles les questions où l'on joue ses jokers, et L'Érudit se gagnerait à coups de Double chance.

**Décision** : ce que montre un joker se calcule dans la vue que le serveur envoie (`reponsesEffacees`, `indiceDeLEnigme`, `sensDeLOracle`) : le téléphone ne reçoit que ce qu'il montre (invariant 1). Une réponse aidée porte la clé de son joker (`campagne_reponses.joker`, `JOKERS_QUI_AIDENT`) : la mesure des difficultés, le modèle du savoir, les écussons, la précision et L'Érudit ne lisent que les réponses nues (`REPONSE_NUE`) ; juste, elle ne retrouve rien au carnet — une erreur aidée y entre. Échange et La mue posent une autre question, nue ; Deux visages ne l'est plus : on prend celle qu'on sait.

**Conséquence** : elle paie comme toute bonne réponse — un confetti, l'expérience, Le Marathonien. Aucune route d'un autre mode n'accepte un joker (invariant 8). Une lecture neuve de `campagne_reponses` qui mesure un savoir écarte les réponses aidées.

*Fichiers : `server/src/core/campagne.ts`, `shared/expedition.ts`, `shared/jokers.ts`, `server/test/expedition-mesure.test.ts`*

### Une cible approchée, pas tenue
**Contexte** : la cible retenue le 17 octobre 2026 — avec une équipée de deux, le joueur moyen au bout une fois sur trois, le fort huit fois sur dix — venait d'une simulation faite avant tout code. Le calibrage sur le vrai code, avec les jokers, la remesure : le joueur sait ou ne sait pas chaque question, et joue son meilleur joker quand il ne sait pas.

**Décision** : ouverte aux règles du brief. Avec la Chouette et le Phénix, le moyen arrive au bout 26 fois sur cent, le fort 67 ; s'il garde ses jokers rares et légendaires pour le gardien, 29 et 72 — avec Janus et le Serpent, 28 et 79. La main de quatre tiendrait la cible (33 et 74 %) : un choix de produit, laissé au propriétaire, comme un quatrième Coup d'œil au départ, qui n'y change rien de mesurable.

**Conséquence** : les vraies expéditions diront le reste ; le calibrage se rejoue (`--garder` pour le joueur soigneux), et une règle changée ne vaut que pour les expéditions qui partent ensuite.

*Fichiers : `server/scripts/calibrage-expedition.ts`, `shared/jokers.ts`, `docs/reference/baremes.md`*

### L'expédition en route vit en mémoire, et le tirage d'une escale ne bat plus la base
**Contexte** : le propriétaire, le 17 octobre 2026 : « n'oublie pas le côté performance pour que ça soit rapide aussi niveau requête ». Une escale se jouait en trois allers-retours vers Turso l'un après l'autre — relire l'expédition, relire ce qu'il a vu, écrire —, une réponse en deux ou trois : 29 ms chacun sur une connexion gardée, 225 sur une connexion à rouvrir. Et le gardien battait les vingt-cinq mille questions de la base pour en prendre six : 15 ms de processeur, dix fois plus au dixième de cœur de l'hébergeur.

**Décision** : l'expédition en route se garde en mémoire après chaque écriture, avec ce que le joueur a vu, lu dans le lot du départ, sous le verrou du profil, comme la série en cours ; une écriture ratée l'oublie, et une réponse écrite ailleurs dans la campagne fait relire ce qu'il a vu (`vuAilleurs`). Le tirage d'une escale lit son tas dans un ordre tiré à mesure, et s'arrête à la première question qui ne peut être battue (`tirerPourUneEscale`).

**Conséquence** : partir coûte deux allers-retours, une escale, un joker ou une mauvaise réponse un, une bonne réponse deux, comme en série ; le gardien se tire en 0,1 ms. Une écriture neuve de l'expédition, ou une porte neuve qui écrit une réponse de campagne, tient la mémoire à jour — `expedition-charge.test.ts` compte.

*Fichiers : `server/src/core/campagne.ts`, `server/test/expedition-charge.test.ts`, `server/test/expedition-tirage.test.ts`*

### Les formes : le dévoilement s'écrit au fil des mots, et une autre forme ne mesure rien
**Contexte** : l'étape 3 du brief pose quatre formes — quatre choix, vrai ou faux, six choix, dévoilement. Un dévoilement envoyé entier, même caché par la page, donnerait l'intitulé au téléphone d'avance (invariant 1), et une heure lue au téléphone dériverait (invariant 6). Une question à six choix, en vrai ou faux tiré d'une autre ou lue à mi-mot n'a plus la difficulté qu'on mesure.

**Décision** : la forme se pose au serveur, au tirage (`aSaForme`) : six choix prend deux leurres de la question, un vrai ou faux propose une de ses réponses — la bonne une fois sur deux —, un dévoilement garde l'heure de son premier mot. Le dévoilement part par sa route, une réponse HTTP qui écrit chaque mot à son heure, celle du serveur ; la réponse lit les mots dits à l'heure où elle arrive. Arrêt sur image l'arrête cinq secondes ; Deux visages ne s'y joue pas. La réponse porte sa forme (`campagne_reponses.forme`) : ni la mesure, ni le modèle du savoir, ni la précision et les écussons, ni L'Érudit ne la lisent, et un vrai ou faux tiré d'une autre, trouvé, ne retrouve rien au carnet. Arrêt sur image, joker des offres, ne s'offre qu'aux expéditions parties depuis (`Joker.depuis`, le départ en version 3) : une offre se rejoue de la graine, et un joker de plus aurait changé celles d'avant.

**Conséquence** : la page ne reçoit d'un dévoilement que son compte de mots, puis ses mots, un à un ; rouverte, la route redit d'un coup ceux déjà dits. Une forme que le thème ne sait pas prendre se pose à quatre choix. Ce qui compare une question jouée à la base la lit à sa forme — un signalement en vrai ou faux n'est pas une version d'avant.

*Fichiers : `shared/expedition.ts`, `shared/jokers.ts`, `server/src/core/campagne.ts`, `server/src/expedition.ts`, `client/src/views/ExpeditionApp.tsx`, `server/test/expedition-formes.test.ts`*

### Les écus se comptent du journal, et l'inconnu ne part qu'une fois dévoilé
**Contexte** : l'étape 4 du brief donne sa monnaie à l'expédition : une escale trouvée paie selon la chance qu'elle annonçait, un dévoilement d'autant plus qu'on répond tôt, et l'échoppe dépense. Un solde tenu dans une colonne aurait coûté une écriture de plus à chaque réponse, et pu s'écarter du pli ; un achat relu au prix du jour aurait changé, à chaque retouche du barème, le solde des expéditions en route. Et l'inconnu — un marchand, un piège, un légendaire de passage — n'en serait plus un si la carte, envoyée entière au téléphone, le disait.

**Décision** : les écus ne s'écrivent nulle part : le pli les compte (`ecusDeLaReponse`), de la couleur de la chance annoncée — celle de la carte, ou du Commandement —, de la forme et du thème, et, au dévoilement, du mot où la réponse est arrivée, lu de l'heure que le serveur écrit déjà avec elle (`repondue_le`, `devoileA`). Un achat est un geste (`acheter`) qui écrit avec lui le prix payé, comme à la boutique. Ce que cache l'inconnu se tire de la graine (`contenuDeLInconnu`) et ne se garde pas sur la carte : la vue ne le dit qu'une fois dévoilé — par la boussole, par la lanterne pour les pièges, ou en y entrant (invariant 1). Les écus, Quitte ou double et les talismans ne valent que pour les expéditions parties depuis (le départ en version 4) : les offres se rejouent de la graine, et celles d'avant se rejouent sans écus.

**Conséquence** : ni colonne ni écriture de plus — une réponse coûte ce qu'elle coûtait, un achat un geste. Un prix changé ne vaut que pour les achats à venir. Les écus meurent avec l'expédition, et le solde de confettis n'en sait rien. Un piège peut finir l'expédition d'un geste : le serveur la clôt alors comme une réponse, ses gains compris.

*Fichiers : `shared/expedition.ts`, `shared/jokers.ts`, `server/src/core/campagne.ts`, `client/src/views/ExpeditionApp.tsx`, `server/test/expedition-ecus.test.ts`, `server/test/expedition-echoppe.test.ts`*

### Le passeport se relit du journal : un tampon par thème pointu trouvé
**Contexte** : la refonte des sujets de la campagne porte l'onglet des thèmes à quatre-vingt-douze sujets ; le propriétaire, le 18 octobre 2026 : « Est-ce que l'on ne peut pas faire quelque chose avec tous ces thèmes ? », puis, parmi quatre propositions, « Idée 1 2 stp ». Un passeport tenu dans une table à part aurait coûté une écriture de plus à chaque réponse, et pu s'écarter du journal.

**Décision** : la question tirée du tas d'un thème pointu le garde (`QuestionDeSerie.sujet`), et sa réponse l'écrit avec elle (`campagne_reponses.sujet`) — ni celle d'un Commandement, ni celle du tirage de secours dans toute la base, ni celle que La boucle repose. Le passeport est la liste des thèmes trouvés (`lectureDuPasseport`), lue dans le lot qui lit déjà l'expédition, la page ou le départ, puis tenue en mémoire avec l'expédition ; la vue signale sur la carte ce qui manque (`aTamponner`). Le Globe-trotter, une piste de la campagne, les compte dans le lot des paliers (`statsDe`) : bronze à dix, argent à quarante, or au passeport complet.

**Conséquence** : pas un aller-retour de plus. Un tampon ne donne aucun avantage de jeu (invariant 8) ; le Globe-trotter paie ses paliers comme les autres pistes — un barème de plus, dit (`docs/reference/baremes.md`). Un sujet ajouté à l'onglet arrive de lui-même sur les cartes et au passeport ; l'or reste à quatre-vingt-douze.

*Fichiers : `shared/expedition.ts`, `shared/hautsfaits.ts`, `server/src/core/campagne.ts`, `client/src/views/ExpeditionApp.tsx`, `server/test/expedition-passeport.test.ts`*

### La saison d'une fête : sa fête sur les cartes, son légendaire à l'acte 3
**Contexte** : la Citrouille, le Sapin et le Bouquet final ne se gagnaient qu'au quiz du jour ou en soirée, à leur saison ; leurs jokers, eux, agissaient toute l'année. La seconde idée retenue le 18 octobre 2026 — Halloween à une semaine.

**Décision** : une expédition partie à la saison d'une fête voit sa fête tenir la moitié de ses thèmes pointus (`PART_DE_LA_FETE`), et son légendaire garder l'acte 3 s'il ne l'a pas — ni s'il est l'invité du jour (`gardiensDe`, `deSaison`). La voie de l'expédition s'ouvre aux légendaires de saison (`avecLExpedition`) : ils ne gardent qu'alors, elle ne sert donc qu'à leur saison. La saison se lit au jour de Paris du départ (`calendrierDesExpeditions`), et le départ la garde (`DepartDExpedition.saison`). Hors saison, le générateur ne tire rien de plus.

**Conséquence** : partie à temps, l'expédition se finit quand on veut. Le banc et le smoke ferment le calendrier des expéditions comme celui des soirées : sans quoi chaque test d'expédition aurait sa Citrouille à l'acte 3 une semaine par an. Ce qu'une voie neuve change aux Divins se vérifie dans `core/divins.ts`, et ne s'écrit nulle part ailleurs (invariant 21).

*Fichiers : `shared/expedition.ts`, `shared/legendaires.ts`, `shared/album.ts`, `server/src/core/saisons.ts`, `server/src/core/campagne.ts`, `server/test/expedition-saison.test.ts`*

### La carte n'éclaire que l'escale où l'on est, et propose celles de devant
**Contexte** : la carte d'un acte dessinait le tracé le plus sûr jusqu'au campement — une dizaine d'escales et leurs liens dorés, l'escale où l'on était perdue parmi elles —, et chaque escale portait son nom et sa chance. Le propriétaire, le 18 octobre 2026 : « il faudrait uniquement illuminer la node sur laquelle on est et pas tout le chemin. Une fois vaincu ça nous proposerait uniquement les nodes de devant que l'on peut atteindre », et « le système de carte un peu fouillon et pas trop compréhensible. C'est pas très pratique non plus ».

**Décision** : seule l'escale où l'on est s'éclaire — le départ, au début. Les escales permises (`VueDeLExpedition.permises` : la suite de la sienne, ou ce qu'un joker de route ouvre) sont proposées, entourées, leur nom dessous et leur chance au-dessus ; le reste de la carte attend en retrait, plus petit, son emblème sans un mot, et dit dans le panneau ce qu'il cache quand on le touche. On touche une proposée — son trait se dore —, puis « Y aller » ; seule, elle l'est d'office (le gardien, au campement). Le tracé le plus sûr se compte encore, sans se dessiner : le panneau nomme la plus sûre des proposées, et son nom, touché, la choisit — deux proposées portent souvent le même. La légende passe dans une feuille, « La carte », qui dit aussi comment la lire ; le panneau dit l'escale touchée, sans les chances d'un tracé.

**Conséquence** : rien ne change au serveur ni au pli — ils ne vérifiaient déjà que le pas suivant. Un pas coûte deux touchers au lieu d'un : on choisit ce qu'on fait, au lieu de suivre ce qui s'allume. La chance d'arriver au gardien et le butin d'un tracé ne se lisent plus sur la carte ; le calibrage suit toujours le plus sûr, que le panneau conseille pas à pas.

*Fichiers : `client/src/views/ExpeditionApp.tsx`, `client/src/styles.css`, `server/scripts/rendu-expedition.ts`, `server/test/expedition-carte-ecran.test.ts`*

### L'acte en petit en haut, les escales et les jokers en vraies cartes en bas
**Contexte** : le même jour, la carte ne s'allumait plus que là où l'on était, mais ses escales restaient des ronds posés sur une carte qui défilait, que le panneau collé en bas couvrait à moitié ; la main, une ligne de noms dans le panneau, et sous une question des tuiles. Le propriétaire : « Je n'aime pas le design de comment sont matérialisé les cartes, ça serait possible que ce soit de vrais cartes en bas ? […] Pareil ma main c'est pas ouf ». Entre deux maquettes, il a choisi « la carte en haut, en petit et épurée, pour voir où tu es », les choix en vraies cartes en bas ; et les jokers en vraies cartes, au cadre de leur rareté, qui se lèvent quand on les touche.

**Décision** : l'écran de la carte tient en un écran. En haut, l'acte entier en petit, sans un mot — l'escale où l'on est, qui brille, les proposées entourées, la touchée en or —, ses rangées en pour cent de la hauteur qu'il lui reste ; touché, il s'ouvre en grand dans une feuille, où chaque escale dit ce qu'elle cache, avec la légende et « Abandonner l'expédition ». En bas, les escales proposées en cartes — sorte, emblème, nom, chance, ce qu'elles rapportent —, la plus sûre à son ruban ; une carte touchée se lève, puis « Y aller ». Les jokers sont des cartes au cadre de leur rareté, de la gemme de l'album (`gemmes.ts`) : posées au bas de l'écran sous une question, leur haut seul en vue, et en petit en tête du panneau sur la carte ; touchée, une carte se lève en grand, dit ce qu'elle fait, puis « Jouer » ou pourquoi pas. La pioche, au bout de la main, ouvre le paquet, la défausse, les posés et les talismans ; les posés se montrent aussi dans la barre du haut.

**Conséquence** : la page ne défile plus jusqu'à l'escale où l'on est — seule la carte en grand défile, dans sa feuille. Le panneau a un budget : ce qui le grandit rapetisse l'acte en petit, au moins 170 pixels ; posée au bas du panneau, la main en prenait 90, et elle vit en tête. La chance et les gains d'une escale se lisent sur sa carte, sa marche et à qui est la chance dans sa description. Une rareté n'a qu'une couleur dans toute l'application, et le maudit prend le pourpre de l'épique. Rien ne change au serveur ni au pli.

*Fichiers : `client/src/views/ExpeditionApp.tsx`, `client/src/styles.css`, `client/src/gemmes.ts`, `server/scripts/rendu-expedition.ts`, `server/test/expedition-carte-ecran.test.ts`*

### Un trophée que le serveur tait là où il ne se gagne pas
**Contexte** : le codex promettait le trophée L'Explorateur, une piste au niveau d'explorateur. Ce niveau ne se voit qu'en préproduction, où les rencontres s'ouvrent ; la production ne le montre nulle part, et le propriétaire ne veut pas l'ouvrir avant une semaine de jeu (le 19 octobre 2026). Or l'album bâtit ses pistes d'un catalogue fixe, et le même code sert les deux environnements : un drapeau du code, comme `voiesMontrees`, l'aurait caché en préproduction aussi.

**Décision** : le serveur décide, d'une seule source — `rencontresOuvertes`, calculée au démarrage. Là où les rencontres sont fermées, `statsDe` ne lit pas la renommée et le niveau vaut 0 (aucun palier ne tombe), et `hautsFaitsVus` ne cite pas le trophée ; l'album ne bâtit la case d'un trophée réservé (`montreParLeServeur`) que si le serveur la cite.

**Conséquence** : la collection d'un joueur de la production ne compte pas trois trophées d'un niveau qu'il ne voit pas, et la préproduction le montre et le décerne. La renommée, elle, s'écrit partout : le jour où les rencontres s'ouvriront, chacun aura ses paliers à sa partie suivante. Un trophée réservé de plus prend le même champ et passe par le même drapeau du serveur.

*Fichiers : `shared/hautsfaits.ts`, `shared/trophees.ts`, `server/src/core/campagne.ts`, `server/src/auth/profiles.ts`, `server/src/server.ts`, `server/test/expedition-codex.test.ts`, `server/test/trophees.test.ts`*

### L'Ascension du codex : des crans qu'on choisit, ouverts par les victoires
**Contexte** : au codex entier, le joueur fort allait au bout neuf fois sur dix, et plus rien ne restait à gagner pour qui gagne. Deux Ascensions étaient sur la table. Celle du brief de la V1 : un quatrième gardien, une seule vie, deux légendaires au bout, aucun ratée. Celle de la proposition du codex : des niveaux de difficulté après une première victoire. Le propriétaire a validé les recommandations du codex (« Go tout faire avec tes recommandations »), et veut attendre une semaine de jeu avant de durcir l'expédition de tous.

**Décision** : cinq crans, chacun ajouté à ceux d'en dessous — les adversaires ont 6 points de plus, ils frappent 3 de plus, le campement et la source rendent moitié moins de courage, 2 d'énergie à chaque question au lieu de 3, les gardiens moitié plus de points. La première expédition menée au bout ouvre le cran 1, une victoire à son plus haut cran le suivant ; les crans ouverts se relisent des bilans, comme la renommée, et les victoires d'avant comptent. On le choisit au départ parmi les siens, aucun d'office : l'Ascension ne durcit que qui la demande. Le départ le fige. Le serveur le borne à ceux qu'il a ouverts, sans refuser un départ. Ce qu'un cran change se dit d'une seule règle, que le pli applique et que la page annonce. L'Ascension du brief reste à trancher à côté.

**Conséquence** : mesuré au codex entier, le fort va au bout 93 fois sur cent sans cran, puis 88, 80, 75, 65 et 43 ; le moyen 56, puis 39, 23, 15, 7 et 0. Aux premiers chiffres, trois crans sur cinq ne retiraient presque rien au fort ; partir avec 30 de courage, rien du tout — le repos le remontait —, et ce cran est devenu une énergie de moins. Elle n'ouvre aucune carte et ne rapporte rien de plus que le cran suivant ; un cran de plus s'écrit dans `ASCENSION` et dans sa règle, et se mesure avant de se régler.

*Fichiers : `shared/codex.ts`, `shared/expedition.ts`, `server/src/core/campagne.ts`, `server/src/expedition.ts`, `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `server/scripts/calibrage-rencontres.ts`, `server/test/codex.test.ts`, `server/test/expedition-codex.test.ts`*

### Le jeu complet : une version du départ, et ce que chaque carte ajoute au verdict dit une seule fois
**Contexte** : le prototype n'avait que deux cartes par famille ; le propriétaire, le 19 octobre 2026 : « Il n'y a vraiment pas beaucoup de rare / épique dans le jeu comme carte, cela donne pas beaucoup de diversité. Tu pourrais pas donner un jeu complet ? », puis « on joue toute les cartes à tous les tours car ça coûte pas beaucoup d'énergie et du coup y'a aucune réflexion ». Quarante-deux cartes de plus touchent au pli de toutes parts — des écus et du courage sur une bonne réponse, une attaque de plus, un pari rendu, une riposte, ce qu'une bonne réponse laisse à la question suivante, des formes qui paient autrement —, et la carte levée doit promettre ce que le serveur fera. Les expéditions parties se rejouent de leur journal à chaque lecture : une carte de plus dans les offres changerait les leurs.

**Décision** : une version du départ, la 8. Chaque carte neuve porte `depuis` : les offres d'avant le codex ne la tirent pas, `refusDeLaCarte` la refuse à un départ d'avant elle, et l'énergie de chaque acte (2, puis 3) ne vaut que pour les départs du jeu complet. Ce que les cartes ajoutent au verdict se dit d'une seule fonction par effet — `siJuste`, `frappeEnPlus`, `pariPerdu`, `riposte`, `suiteDUneBonneReponse`, `enPlusDesPouvoirs`, `enPlusApresLaForme`, et `multiplicateurDeLaForme` qui reçoit les cartes —, que le pli et `apercuDuTour` appellent tous deux ; les cartes qui visent la question dès la préparation se rangent sur elle (`viseLaQuestion`), comme celles de pendant la question. Une rareté épique entre la rare et la légendaire, au pourpre de l'album ; la maudite, qui l'empruntait, prend un rouge à elle.

**Conséquence** : un test lève puis joue chacune des quarante-deux cartes, et compare la promesse de la page au pli. Une carte de plus s'écrit dans ces fonctions, jamais dans le pli seul ; une carte de plus au catalogue des offres monte la version. Le serveur ne lit que les versions qu'il connaît : la 8 oubliée dans `lireDepartDExpedition`, chaque départ du jeu complet se lisait illisible — un test des routes l'a trouvé. Une carte se mesure seule contre rien, ses offres isolées, avant d'entrer dans l'échelle : parmi soixante-cinq, une carte passait trop rarement pour qu'on lise ce qu'elle vaut. Mesurées ainsi, Représailles menait le joueur moyen au bout neuf fois sur dix, et la plupart des cartes à deux d'énergie ne valaient pas, à l'acte 1, Concentration et Prudence ensemble : retouchées avant la fusion, une version neuve n'ayant encore joué aucune expédition.

*Fichiers : `shared/rencontres.ts`, `shared/expedition.ts`, `shared/codex.ts`, `server/src/core/campagne.ts`, `client/src/views/RencontresDExpedition.tsx`, `client/src/views/ExpeditionApp.tsx`, `client/src/gemmes.ts`, `server/scripts/anime/cartes.ts`, `server/scripts/calibrage-rencontres.ts`, `server/test/expedition-jeu-complet.test.ts`*

### Les cartes améliorées : une clé « + », et une seule façon de reconnaître une carte
**Contexte** : le propriétaire, le 19 octobre 2026 : « Est-ce que l'on pourrait pas aussi avoir un système d'amélioration des cartes ? ». Une carte améliorée vit dans tous les tas — le paquet, la main, la pioche, la défausse, les épuisées, les jouées, celles posées pour la rencontre —, et le pli, les refus, la carte levée et le serveur — la colonne `joker`, Double chance, ce qui vise la question — reconnaissaient chaque carte à sa clé, tas par tas. Rien n'est encore en production : le propriétaire teste seul la préproduction (« Ne prend pas en compte les joueurs »).

**Décision** : un exemplaire amélioré porte la clé de sa carte suivie de « + » (`concentration+`) : une carte à part entière — son nom, « Concentration+ », ses chiffres, son coût —, bâtie de sa carte et de son amélioration (`AMELIORATIONS`), absente du codex et des offres de base. Une règle reconnaît une carte par `baseDe` ou `parmi`, et lit ses chiffres améliorés sur la carte (`amelioree`) ; un test relit le code pour qu'aucune clé qui s'améliore n'y soit plus cherchée seule. Les améliorations viennent avec la version 8, sans en ouvrir une autre : le jeu complet ne se joue encore qu'en préproduction, par lui seul. Une offre les tire sur son propre fil (`graine:amelioree:rang`) : les cartes offertes restent celles qu'elle tirait. Le campement propose trois choix exclusifs — le repos, une carte retirée, une carte améliorée —, l'échoppe un article de plus, et une seule règle dit pourquoi une carte ne s'améliore pas (`refusDeLAmelioration`), que le pli, le serveur et la page lisent.

**Conséquence** : le geste du journal ne change pas de forme — `jouer` porte la clé « + » —, et une carte améliorée se joue partout où sa carte se joue. Un test lève puis joue chacune des soixante et une, compare ce qu'elle annonce à ce que le pli fait, et vérifie qu'aucune ne fait moins que sa carte. Mesurées, six cents expéditions par case, elles rendent l'expédition plus facile : le joueur moyen va au bout 53 fois sur cent au niveau 1 et 89 au niveau 3, contre 47 et 66 au jeu complet d'avant elles ; le fort reste entre 95 et 99. Rien n'en est durci : la décision attend une semaine de jeu, comme celle du codex. Une carte de plus qui s'améliore prend son entrée dans `AMELIORATIONS` ; une amélioration retouchée une fois les rencontres ouvertes garderait ses chiffres d'avant, comme les cartes retouchées par le codex.

*Fichiers : `shared/rencontres.ts`, `shared/expedition.ts`, `server/src/core/campagne.ts`, `client/src/views/RencontresDExpedition.tsx`, `client/src/views/ExpeditionApp.tsx`, `server/scripts/calibrage-rencontres.ts`, `server/test/expedition-ameliorations.test.ts`, `server/test/expedition-journal.ts`*

### Le plan fondu dans l'écran : ses escales se touchent sur place, plus de feuille
**Contexte** : l'écran d'un acte montrait le plan en petit, un dessin sans un mot, et ses escales permises en cartes ; touché, le plan s'ouvrait en grand dans une feuille, la seule où une escale disait ce qu'elle cachait — un mélange, ses catégories. Le propriétaire, le 19 octobre 2026 : « est-ce que l'on pourrait pas avoir une fusion entre carte et l'interface, car là le zoom est séparé », et « lorsque l'on clique sur une des escales que l'on veut aller sans le mode carte, on ne peut pas voir le mélange ».

**Décision** : le plan reste en petit, tout l'acte d'un coup d'œil, et ses escales deviennent des boutons : touchée, une escale permise se choisit comme sa carte, une autre s'entoure de gris, et la ligne sous les cartes dit ce que cache la dernière touchée, sur le plan ou en carte — sans sa chance ni ses écus, que sa carte montre. Un mélange montre les emblèmes de ses catégories sur sa carte, et la ligne les nomme. La feuille du plan disparaît : sa légende rejoint le « ? », « Abandonner l'expédition » reste au départ. Le plan en grand, qui défilait, ne revient pas en place : l'écran tient en un écran, et le plan en petit, qui grandit avec la hauteur de l'écran, suffit à voir où l'on va.

**Conséquence** : une rangée d'escales fait une vingtaine de pixels en 360 × 640 : leur cible déborde de côté, où les voisines sont à quatre-vingts pixels. La ligne de l'escale touchée garde deux lignes, trois au plus, pour que le plan ne saute pas d'un toucher à l'autre. Les jokers de la production partagent l'écran : leur plan se touche de même.

*Fichiers : `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `client/src/styles.css`, `server/test/expedition-carte-ecran.test.ts`, `server/scripts/rendu-rencontres.ts`, `server/scripts/rendu-expedition.ts`*

### Les rencontres, le jeu : le départ ne les demande plus, et le drapeau reste
**Contexte** : les rencontres étaient un prototype de la préproduction, que le départ proposait d'un interrupteur, « prototype » à côté, retenu sur le téléphone — coupées, l'expédition partait aux jokers. Le propriétaire, le 19 octobre 2026 : « je pense que l'on part sur ça donc ne plus demander ça, c'est vraiment le jeu maintenant ». Rien n'est encore déployé en production, où il teste seul.

**Décision** : le départ ne demande plus rien — l'interrupteur, sa pastille et le choix retenu (`quizz.expedition.rencontres`) s'en vont, et un « non » d'avant ne coupe plus rien ; ne reste que la catégorie fétiche, une fois son niveau atteint. Leur drapeau (`RENCONTRES_EN_PRODUCTION`) passe à `true` : elles partent en production aussi. Il reste, plutôt que d'être retiré avec ses chemins : repassé à `false`, la production repartirait aux jokers d'une ligne — un filet tant qu'elles n'y ont pas été jouées. Le serveur les calcule une fois (`rencontresOuvertes`) et les donne à ses routes comme à L'Explorateur ; une option du serveur les ferme (`rencontres: false`), pour le test de ce filet et pour photographier les jokers.

**Conséquence** : les jokers ne partent plus que d'un serveur aux rencontres fermées : leur rendu (`rendu-expedition.ts`) démarre le sien ainsi, et une expédition aux jokers déjà partie finit à ses règles. Le code des jokers reste — il rejoue les expéditions d'avant (invariant 14). La préparation coûte encore un aller-retour par carte jouée, en production comme ailleurs : la regrouper avec le pari, en un seul geste, reste à faire avant d'y inviter du monde.

*Fichiers : `shared/rencontres.ts`, `server/src/server.ts`, `server/src/api.ts`, `server/src/expedition.ts`, `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `server/scripts/rendu-expedition.ts`, `server/test/expedition-rencontres-routes.test.ts`, `server/test/expedition-codex.test.ts`*

### Un style choisi au départ, et l'échelle qui ouvre la variété d'abord
**Contexte** : « Pour les cartes il faut vraiment plus de gameplay différents. Quitte à rajouter des communes aussi. Là aujourd'hui j'ai l'impression de piocher tout le temps la même chose et de pas avoir à choisir de style de jeu » (le propriétaire, le 19 octobre 2026). Au niveau 1, les offres tiraient parmi huit cartes, presque toutes neutres ; les familles n'arrivaient qu'aux niveaux 5 à 10 ; le paquet de départ, huit cartes de base sur dix, était le même pour tous ; et seul le poids des familles dans les offres laissait deviner, après coup, quelle façon de gagner on jouait.

**Décision** : un style se choisit au départ — une famille parmi celles que son niveau ouvre, retenue sur le téléphone. Ses deux cartes prennent la place de deux cartes de base de même nature — une attaque d'une Concentration, une protection d'une Prudence —, et chaque offre en propose une, une que le paquet n'a pas encore s'il en reste ; les deux autres viennent de partout, au même poids : le poids des familles du paquet s'efface avec le style. L'échelle ouvre la variété d'abord : trois styles entiers à leurs communes au niveau 1, un de plus avec sa règle à chacun des trois suivants ; la catégorie fétiche va avec l'Érudit, dès le niveau 1. Lancée et Échauffement partent avec l'Élan : leurs exploits ouvrent Génie et Inarrêtable. Le style est un champ neuf du départ, sans version : un départ d'avant lui se rejoue tel qu'il s'est joué, ses offres tirant leur hasard dans le même ordre.

**Conséquence** : mesuré (`calibrage-rencontres.ts --styles`), le style ne pèse rien sur qui choisit ses cartes — à dix points près du départ sans style —, mais suivi à la lettre, il sépare les familles : au niveau 10, le joueur moyen va au bout 94 fois sur cent avec le Rempart, 35 avec le Flambeur, 80 sans style. Les cartes qui ne font qu'attaquer valent moins que les boucliers ; les règles le disent (« un paquet qui ne fait qu'attaquer tombe vite »), et les aiguiser — une retouche de leurs chiffres, sous une version neuve du départ — attend la semaine de jeu. Le paquet d'un style se relit à chaque pli : changer ses cartes de départ changerait celui d'une expédition en route, et monte donc la version.

*Fichiers : `shared/rencontres.ts`, `shared/codex.ts`, `shared/expedition.ts`, `server/src/core/campagne.ts`, `server/src/expedition.ts`, `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `server/scripts/calibrage-rencontres.ts`, `server/test/expedition-styles.test.ts`*

### Les huit familles : le doute et le courage qu'on paie, chacun d'une seule règle
**Contexte** : « Ton style » donnait six styles, qui gagnaient tous de la même façon — frapper plus fort sur une bonne réponse, ou se protéger d'une mauvaise. Le propriétaire, le même 19 octobre 2026 : « Pour les cartes il faut vraiment plus de gameplay différents. Quitte à rajouter des communes aussi. » Deux mécaniques neuves touchent au verdict : un dégât qui ne dépend pas de la réponse, et un prix payé en courage — et la carte levée doit promettre ce que le serveur fera.

**Décision** : deux familles de plus, le Sophiste et le Téméraire, huit cartes chacune, sous une version neuve du départ, la 9 (`VERSION_DES_HUIT_FAMILLES`, `depuis`). Le doute est un état de la rencontre (`RencontreEnCours.doute`) : les cartes le sèment par leurs chiffres (`chiffresApresLaCarte`) ; le verdict le prend aux points de l'adversaire avant de juger la réponse (`rongeDuDoute`), puis le fait retomber — sauf sous Paranoïa — ou en sème pour la question suivante (`douteApresLaQuestion`, `douteDUneErreur`) ; le pli et `apercuDuTour` lisent les mêmes fonctions, et le coup porte le doute à part des points brisés (`CoupDeRencontre.doute`). Tombé de son doute, l'adversaire n'attaque pas. Le courage qu'une carte coûte se dit d'une seule fonction (`courageDeLaCarte`) : le pli le prend à la carte jouée, `refusDeLaCarte` refuse celle qui l'achèverait, la carte levée le dit ; ce qui frappe de ce qui manque lit le courage dans le contexte des chiffres (`ContexteDesChiffres.courage`). Les deux styles entrent dans l'échelle aux niveaux 5 et 6.

**Conséquence** : un dégât sûr vaut bien plus qu'un « +N si juste ». Aux premiers chiffres, le doute baissait de 1 par question et s'additionnait : mesurée seule, Insinuation menait le joueur moyen au bout neuf fois sur dix contre une sur deux. Il ne dure plus que sous Paranoïa, et ses chiffres partent du plus bas — 2, 1 par erreur, 1 par question —, pour six à huit points de plus par carte. Suivi à la lettre, le Téméraire est le style le plus risqué ; par qui choisit ses cartes, à dix points du départ sans style, comme les autres — parti avec deux cartes qui se paient, il laissait le joueur faible treize points derrière. L'en-tête de la révélation relisait les points de la vue d'avant moins les seuls points brisés, et gardait ce que le doute avait pris : une seule fonction relit désormais ce que la réponse a laissé (`adversaireALaRevelation`), et un test la rend. Les seize cartes se sont peintes au modèle Nano Banana 2, deux fois moins cher : 0,55 $.

*Fichiers : `shared/rencontres.ts`, `shared/expedition.ts`, `shared/codex.ts`, `server/src/core/campagne.ts`, `client/src/views/RencontresDExpedition.tsx`, `client/src/views/ExpeditionApp.tsx`, `client/src/components/Onglets.tsx`, `server/scripts/anime/cartes.ts`, `server/scripts/anime/gemini.ts`, `server/scripts/calibrage-rencontres.ts`, `server/scripts/rendu-rencontres.ts`, `server/test/expedition-huit-familles.test.ts`*

### Les cartes jouées sur place : la page applique la règle du pli, le serveur la rejoue en lot
**Contexte** : la phase d'optimisation de l'Expédition (le 19 octobre 2026 : « On peut peut être partir sur une phase d'optimisation des performances alors sur ce mode de jeu. Que ce soit chargement des images / requêtes etc ? »). Mesurée par une expédition jouée de bout en bout par l'API, chaque question coûtait 4,5 requêtes : chaque carte de préparation partait seule, et attendait le réseau du téléphone — 165 ms en 4G — puis une écriture de Turso. Les réponses pesaient 1,3 Ko compressées et le serveur y passait 7 à 10 ms : c'étaient les allers-retours qui coûtaient, pas leur poids.

**Décision** : une carte dont tout l'effet se lit de la vue — ni tirage, ni question reposée, ni courage rendu (`seJoueSurPlace`) — se joue dans la page, par les règles mêmes du pli (`jouerSurPlace`, `vueApresLaCarte` : ses chiffres, son courage, les refus de la main et des mises, l'annonce, l'aperçu), et part avec le geste suivant (`GesteAvecSesCartes.avant`). Le serveur la rejoue, une carte après l'autre, sur l'état que laisse la précédente, et écrit toutes les lignes du journal d'un lot, ou aucune. La vue en préparation porte ce que les règles des cartes lisent de la question qui attend (`questionDuTour`) — jamais son texte ni sa réponse. Écartés : laisser le serveur deviner la suite (un geste spéculatif rejoué au retour), qui aurait écrit au journal ce que le joueur n'avait pas encore choisi ; et envoyer tout le tour d'un coup à « Voir la question », qui aurait obligé la page à recopier aussi les cartes qui tirent.

**Conséquence** : 2,6 requêtes par question au lieu de 4,5 — « voir » et la réponse restent : la question ne part qu'une fois vue (invariant 1). Le journal ne change pas de format, aucune version du départ ne monte, et une expédition se rejoue comme avant. Mais la page applique une règle du serveur : une carte neuve qui touche la vue autrement que par ses chiffres doit l'y suivre, et `expedition-sur-place.test.ts` le garde — chaque carte jouée sur place, puis des expéditions entières au hasard, contre la vue que le pli rend ; il a trouvé L'écholocation, qui ôtait la chance de l'annonce sans le dire au calcul de la page. Les petites peintures du paquet se demandent d'avance, la grande d'une carte levée tout de suite, sur la petite.

*Fichiers : `shared/expedition.ts`, `server/src/core/campagne.ts`, `server/src/expedition.ts`, `client/src/api.ts`, `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `server/test/expedition-sur-place.test.ts`*

### La réponse à composer : des tuiles, et le serveur seul sait l'ordre
**Contexte** : l'étape 3 de « La question au centre » (le 19 octobre 2026), après un testeur : « des lettres présentes dans la réponse […] comme un pendu ». Une question sans choix doit pourtant se répondre au téléphone, sans clavier — il pousserait les boutons hors de l'écran —, et sa réponse ne doit jamais partir avant le verdict (invariant 1). Le propriétaire : « Jusqu'à deux mots, 12 lettres ».

**Décision** : une forme de plus, `lettres`, sous une version neuve du départ, la 11 (`VERSION_DES_COUPS_DE_POUCE`) : une escale sur cinq dès l'étage 2 (`POIDS_DES_FORMES_A_COMPOSER` — le même tirage que la version 10, seule la forme change). Ne se compose qu'une bonne réponse de deux mots au plus et de quatre à douze lettres, A à Z après ses accents, dont l'intitulé ne parle pas de ses choix (`seCompose`, `shared/lettres.ts`) ; le trait d'union, l'apostrophe et l'article de tête se posent d'office. Ses tuiles — ses lettres et trois de trop qu'elle n'a pas, jamais dans l'ordre de la réponse — se tirent au tirage de la question et se gardent avec elle (`QuestionDeSerie.tuiles`, `enTrop`) ; la vue n'envoie que les cases et les tuiles qui restent (`questionAComposer`), la page envoie ses lettres dans l'ordre de ses cases, et le serveur compare. Les cartes qui effacent y retirent les lettres de trop, au hasard de la graine et du rang (`effaceesDuTour`, `forme`) ; L'initiale et La lettre posent la leur (`casesPosees`). La réponse écrit sa composition (`campagne_reponses.composee`), et son `choix` vaut la bonne réponse si elle est juste, −1 sinon : les lectures qui comptent les réponses données la comptent sans rien en savoir. Écartés : un clavier ; un seul mot de dix lettres (un quart de la base au lieu de six sur dix) ; des tuiles tirées de la graine à chaque lecture, qui auraient lié leur ordre au code du jour.

**Conséquence** : la forme est plus dure — un sur dix de hasard au lieu d'un sur quatre (`chanceSelonLaForme`) — et rapporte deux crans, comme six choix : mesurées, les deux se compensent, et le joueur moyen va au bout comme en version 10. Une réponse composée ne mesure rien (`campagne_reponses.forme`), une aidée non plus (`campagne_reponses.joker`). Les trois coups de pouce lisent la bonne réponse : le serveur seul les calcule (`ceQueDitLInitiale`, `ceQueDitLaLettre`, `ceQueDitLeRepere`), et la vue les envoie en phrases (`pouces`). Le repère sans époque à dire efface, comme le Sphinx : ne dire que le domaine de la question, que l'escale dit déjà, le laissait mort six fois sur dix dans la main, et mesuré seul, il faisait perdre des points (`calibrage-rencontres.ts --cartes`). Une expédition de la version 10 finit à ses règles : ses cartes, gardées, n'ont aucune escale à composer, son codex figé aucune des trois cartes.

*Fichiers : `shared/lettres.ts`, `shared/rencontres.ts`, `shared/expedition.ts`, `shared/codex.ts`, `server/src/core/campagne.ts`, `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `server/scripts/calibrage-rencontres.ts`, `server/test/expedition-coups-de-pouce.test.ts`*

### Les curiosités : tirées sur leur propre fil, et un rébus qui n'est pas une question de la base
**Contexte** : l'étape 4 de « La question au centre » (le 19 octobre 2026), après le même testeur : « des trucs bonus sur le chemin qui te filent des récompenses cool » — l'origine d'un plat, « 4 images 1 mot ». Le propriétaire : le rébus à composer, cent plats écrits pour elle, une récompense au choix, une par acte. Une escale de plus au tirage des sortes (`POIDS_DES_ESCALES_DES_RENCONTRES`) aurait déplacé toutes les escales d'après sur chaque plan ; et un rébus n'a ni leurres, ni catégorie, ni difficulté mesurée : la base de la campagne n'en voudrait pas — `verifier` le refuserait, le carnet le reposerait, la mesure le lirait comme une question de culture.

**Décision** : une version neuve du départ, la 12 (`VERSION_DES_CURIOSITES`). Le plan se fait comme en version 11, puis une de ses escales à question des étages 2 à 6 devient une curiosité, tirée sur son propre fil (`graine:curiosite:acte`, `poserLaCuriosite`) : aucune autre escale ne bouge. Le plat est une question de la base, prise parmi ceux qu'une liste tenue à la main retient (`server/content/curiosites/plats.json` : ce que les « D'où vient… ? » de la cuisine ne disent pas d'eux-mêmes — un fromage, une sauce, une marque, l'origine d'un nom — se décide à l'œil). Le rébus vit à part (`server/content/curiosites/rebus.json`, `server/src/core/curiosites.ts`) : sa question se fabrique au tirage, à composer, et sa réponse s'écrit au journal sous `rebus:<id>` avec la forme `lettres` — l'expérience et les confettis la comptent comme une autre, la mesure l'écarte par sa forme, le carnet par son identifiant, en SQL (`suivisDe`), et le signalement la refuse. La récompense est une offre à part (`offre.curiosite`) : des rares de son codex (`RARETES_D_UNE_CURIOSITE`), la fiole et le talisman à leur règle, une seule place à prendre, du hasard de la graine et du rang de l'offre ; ni L'horizon, ni les écus d'un coffre laissé.

**Conséquence** : mesurée (`calibrage-rencontres.ts --version 12`), la curiosité fait gagner au joueur moyen quatre à six points d'aller au bout aux niveaux 1, 3 et 10 — un adversaire de moins sur les chemins qui passent par elle, une rare de plus en main —, et ne change presque rien au fort : le cadeau voulu. Un identifiant de `campagne_reponses` n'est plus toujours une question de la base : une lecture neuve qui joint la base, ou reprend une réponse pour la reposer, écarte `rebus:` (`PREFIXE_DU_REBUS`). Les rébus se relisent par un test, un à un — des emojis d'avant Unicode 13, sans drapeau, ni liant, ni couleur de peau, une réponse qui se compose —, et un rébus qui ne se pose pas est écarté au chargement (`refusDuRebus`). La liste des plats ne grandit pas d'elle-même : un plat neuf de la base n'est une curiosité qu'ajouté à la main.

*Fichiers : `shared/curiosites.ts`, `shared/rencontres.ts`, `shared/expedition.ts`, `server/src/core/curiosites.ts`, `server/src/core/campagne.ts`, `server/content/curiosites/plats.json`, `server/content/curiosites/rebus.json`, `client/src/views/ExpeditionApp.tsx`, `client/src/views/RencontresDExpedition.tsx`, `client/src/components/SerieCorrigee.tsx`, `server/scripts/calibrage-rencontres.ts`, `server/test/expedition-curiosites.test.ts`*

## L'outillage

Le détail : [les tests](../contribuer/tests.md).

### Un serveur jetable par fichier de test, et un smoke qui ne s'allonge plus
**Contexte** : le smoke rejoue une soirée entière dans un seul scénario. Une soirée jouée au milieu faussait tout ce qui suivait — statistiques, bilan, archives —, et le symptôme ne désignait jamais la section fautive : un chronomètre qui sonnait après la fermeture d'un serveur disait seulement « The database connection is not open ».

**Décision** : un nouveau comportement arrive avec son test dans `server/test/`, qui échoue avant la correction, sur un serveur à lui (le banc) ; le smoke garde le chemin normal.

**Conséquence** : rien n'est partagé, et `node --test` lance les fichiers en parallèle ; les sections 24 à 29 du smoke sont devenues des fichiers ; un fichier a deux minutes en tout et se coupe par thème quand il approche la minute et demie.

*Fichiers : `server/test/banc.ts`, `server/scripts/smoke.ts`, `server/scripts/tests.mjs`*

### Compter plutôt que chronométrer
**Contexte** : la suite tourne sur des machines partagées et chargées — trois fichiers à la fois chez soi, une CI plus lente — où un test qui mesure des millisecondes échouerait au hasard.

**Décision** : ce qui coûte se compte — les vues, les écritures, les messages, les allers-retours vers le fichier qui tient lieu de Turso. Les rares bornes de temps sont larges : le coût d'un calcul, pris au meilleur de trois essais, ou un délai qui doit tomber.

**Conséquence** : une régression de performance se voit comme un compte qui monte, pas comme un test qui clignote ; ce qui se mesure vraiment en temps passe par `npm run mesure`, avant et après une retouche.

*Fichiers : `server/test/grande-salle.test.ts`, `server/test/jour-charge.test.ts`, `server/test/protocole.test.ts`*

### Un compte rendu en points sous Claude Code
**Contexte** : d'une commande qui échoue, Claude Code ne rend que 10 000 caractères pris dans les 30 000 premiers ; le compte rendu TAP de toute la suite faisait 500 Ko, et l'épreuve en échec n'y était jamais — il fallait relancer neuf minutes de tests pour la trouver.

**Décision** : quand `CLAUDECODE` est posé, `tests.mjs` passe au compte rendu `dot` : un point par épreuve, les échecs en entier à la fin.

**Conséquence** : un terminal et la CI gardent le compte rendu de Node ; pour les journaux d'un fichier, on le relance seul avec `--test-reporter=spec`.

*Fichiers : `server/scripts/tests.mjs`*

### Une mémoire en deux étages pour Claude
**Contexte** : le 6 octobre 2026, `CLAUDE.md` faisait 126 Ko, relus à chaque requête de chaque session et de chaque agent ; la documentation de Claude Code vise moins de 200 lignes, au-delà desquelles il suit moins bien ses consignes.

**Décision** : une racine courte — commandes, invariants, conventions de tout le dépôt — et une règle par domaine dans `.claude/rules/`, chargée quand Claude ouvre un fichier que désigne son en-tête `paths:`.

**Conséquence** : le code se lit par l'outil Read, par où les règles arrivent ; une connaissance nouvelle va dans la règle de son domaine ; un test borne la racine et refuse un en-tête illisible — qui ferait charger la règle partout — ou un motif qui ne désigne plus rien.

*Fichiers : `CLAUDE.md`, `.claude/rules/`, `server/test/notes-pour-claude.test.ts`*

### Les agents du projet sans `CLAUDE.md`
**Contexte** : lancé en `general-purpose`, chaque convive de la tablée recevait tout `CLAUDE.md` — 122 000 caractères début octobre ; le 24 septembre, trente-cinq agents en parallèle avaient vidé en vingt-cinq minutes la réserve d'usage de cinq heures. Un personnage, de toute façon, ne doit pas connaître le code.

**Décision** : les agents du projet — le convive, le rédacteur et le relecteur de la campagne — s'en dispensent (`omitClaudeMd: true`), lisent leurs seules consignes, et les invités jouent sur un modèle rapide ; les experts du code, eux, gardent la mémoire.

**Conséquence** : tout ce qu'un convive doit savoir tient dans ses consignes et sa fiche ; les audits de code se lancent sept au plus à la fois.

*Fichiers : `.claude/agents/convive.md`, `.claude/agents/redacteur-campagne.md`, `.claude/skills/tablee/SKILL.md`*

### La tablée : de vrais navigateurs, des retours vérifiés
**Contexte** : les tests disent si le code fait ce qu'on a voulu, pas si la grand-mère trouve « Jouer sans compte », ni ce que devient l'écran d'un téléphone quand le clavier s'ouvre.

**Décision** : des agents jouent une soirée entière, chacun sur son appareil, dans un vrai Chromium, sur un vrai serveur aux bases jetables ; chaque bug annoncé se rejoue et se recoupe avec le journal avant d'entrer dans la synthèse, et un retour qui contredit un parti pris se note comme une tension.

**Conséquence** : la régie lit l'écran par ses classes et ses gestes visent des textes : un bouton renommé casse une consigne sans que le typecheck le voie ; la première tablée a écarté un « bug » qui venait du banc.

*Fichiers : `server/scripts/tablee/regie.ts`, `server/scripts/tablee/pilote.mjs`, `.claude/skills/tablee/SKILL.md`*

### Le pilote en JavaScript nu
**Contexte** : un agent répond à une question chronométrée geste après geste, et chaque geste est une commande.

**Décision** : le pilote est un module `.mjs` sans `tsx` qui ne fait que porter le geste à la régie par une porte HTTP locale ; la régie, elle, garde les navigateurs ouverts.

**Conséquence** : aucun geste ne paie une compilation ; un geste se dit à trois endroits — son cas dans la régie, l'aide du pilote, les consignes qui l'emploient.

*Fichiers : `server/scripts/tablee/pilote.mjs`, `server/scripts/tablee/regie.ts`*

### Les rendus et la mesure ne sont pas des tests
**Contexte** : plusieurs bugs n'étaient visibles qu'à l'écran ; mais une photo ne s'affirme pas, et un temps de chargement qui bouge de 10 % d'une fois à l'autre n'est pas une régression.

**Décision** : des scripts qui photographient (`rendu-*`, les planches) et mesurent (`mesure-pages.ts`) sur un serveur jetable, lancés à la main avant et après une retouche, Playwright pris parmi les modules globaux plutôt que dans les dépendances.

**Conséquence** : ni la suite ni la CI ne lancent de navigateur ; le client doit être construit avant un rendu ; la skill `regarder-le-rendu` dit quand regarder et à quelles tailles.

*Fichiers : `server/scripts/rendu-ecran.ts`, `server/scripts/mesure-pages.ts`, `.claude/skills/regarder-le-rendu/SKILL.md`*

## Pour aller plus loin

- [La vue d'ensemble de l'architecture](vue-d-ensemble.md) — les invariants, expliqués un par un
- [L'historique](../contribuer/historique.md) — quand chaque décision a été prise, lot après lot
- [Les recettes](../contribuer/recettes.md) — ce que ces décisions demandent quand on fait évoluer le code
