# Les quiz

> La bibliothèque d'un animateur : écrire un quiz ou le faire écrire, l'importer, le partager, partir d'un modèle ou d'un quiz tout prêt, préparer les quiz du soir. Pour qui anime — et tout profil peut animer.

**Dans cette page** : [La liste](#la-liste-et-la-fiche-dun-quiz) · [Créer](#créer-un-quiz) · [L'éditeur](#léditeur) · [Les sortes](#les-sortes-de-questions) · [Coller une liste](#coller-une-liste) · [Exporter](#exporter-et-importer) · [Partager](#partager) · [Les modèles](#les-modèles) · [Le quiz tout prêt](#le-quiz-tout-prêt) · [La mémoire](#la-mémoire-des-quiz) · [Le programme](#le-programme-de-la-soirée) · [Comment c'est construit](#comment-cest-construit)

## Qui écrit des quiz

Tout se passe dans « Mes quiz » (`/edit`). Chaque espace a sa bibliothèque, que les autres ne voient pas. Un animateur y entre avec son compte, un joueur à profil par « Mes quiz » de son menu — son espace naît à sa première visite. Les invités n'ont besoin de rien : un quiz se joue sans compte.

## La liste et la fiche d'un quiz

Chaque quiz est une carte : sa pastille (l'emoji de son titre, sinon l'initiale), son nom, « 10 questions · ≈ 10 min · joué 2 fois », ce qui reste à compléter, et « Des modifications attendent dans ce navigateur » s'il y a lieu. Son ▶ ouvre un salon sur ce quiz ; la toucher ouvre **sa fiche** : son contenu, ses catégories, quand il a été joué et modifié, « Lancer » et « Modifier les questions » en grand, puis sous « Plus » : « Dupliquer », « Partager par un code », « Exporter en fichier », « Proposer au catalogue », « Archiver ». « Supprimer ce quiz », seul en bas, suggère d'archiver plutôt : archivé, un quiz quitte la liste et le choix de la soirée sans rien perdre.

« Chercher un quiz » lit les titres, les intitulés et les réponses — jamais l'anecdote ni la note —, sans casse ni accent, et dit quelle question l'a fait trouver. « Trier » ouvre « Trier et filtrer » : Tous, À compléter, Jamais joués, Avec photos, Avec estimations, les six catégories les plus présentes, Archivés ; puis « Les plus récents », « Les derniers joués » ou « De A à Z », que le navigateur retient. « Exporter tous mes quiz » paraît dès deux quiz non vides.

## Créer un quiz

| Rubrique | Choix | Ce qu'il fait |
|---|---|---|
| Sans rien écrire | « Un quiz tout prêt » | compose un quiz dans la base de la campagne |
| Écrire | « Un quiz vide » | crée « Nouveau quiz » et l'ouvre |
| Écrire | « Coller une liste » | le même, ouvert sur le panneau de la liste |
| Récupérer | « Partir d’un modèle » | les modèles et le catalogue du serveur |
| Récupérer | « Recevoir par un code » | la copie qu'un animateur de ce serveur te partage |
| Récupérer | « Importer un fichier » | un quiz exporté, ou toute une bibliothèque |

Tant qu'aucun quiz n'est prêt, la bibliothèque s'ouvre sur « Ton premier quiz » : le quiz tout prêt, les modèles, le catalogue, puis de quoi coller une liste, importer le quiz d'un ami ou « Créer mon quiz ». Un quiz créé puis quitté sans question ni titre s'efface.

## L'éditeur

**L'en-tête** reste collé en haut : « ← Mes quiz », le titre (80 caractères), « 2 à compléter ↓ » — qui mène à la prochaine question incomplète — ou « 8/10 prêtes », la durée estimée et « Enregistrer ». « Annuler » y défait le dernier déplacement, la dernière suppression, ou le temps et la catégorie donnés à tout le quiz. L'éditeur prévient d'un emoji que Windows 10 dessine en carré, d'un quiz de moins de cinq questions prêtes — son podium ne rapportera pas d'expérience —, et d'une bonne réponse trop souvent la première (60 % des QCM, dès quatre), avec « Mélanger les réponses à chaque partie ».

**Chaque carte** porte « Question 3 », qui se touche pour taper un autre numéro, son type (« QCM », « Estimation », « Qui dans la salle ? »), ↑ ↓, « + » (une question vide juste après), sa copie, « Aperçu » — la question telle que l'écran commun la projettera — et « Supprimer ». Une question neuve prend le temps et la catégorie de sa voisine ; une photo se colle ou se glisse sur sa carte.

**« Régler tout le quiz »** donne le même temps ou la même catégorie à toutes les questions, et règle le hasard : les réponses « Dans l’ordre écrit » ou « Mélangées à chaque partie », les questions « Dans l’ordre écrit » ou « Tirées dans un autre ordre », « Toutes les questions » ou « Un tirage au hasard » de N questions — cinq au moins (`TIRAGE_MIN`), les jamais posées d'abord. Le hasard se tire une fois au lancement, le même pour toute la salle ; « Garder cet ordre », sur une carte, en exempte une question. Un quiz neuf, une copie de modèle et un quiz tout prêt mélangent leurs réponses d'office.

### Enregistrer

L'éditeur n'envoie rien pendant qu'on écrit : seul « Enregistrer » envoie. Si le serveur dormait, il attend son réveil jusqu'à deux minutes (« Réveil du serveur… ») ; on continue d'écrire, et la réponse n'écrase rien de ce qu'on a tapé depuis. Au-delà de cent questions, il refuse en le disant.

Le navigateur garde une copie de ce qui n'est pas enregistré. Onglet fermé ou page rechargée, la liste le signale, et le quiz rouvert propose « Reprendre mes modifications » ou « Les effacer » — en prévenant s'il a été enregistré ailleurs depuis, et en retirant, avec un mot, une pièce que le serveur n'a plus. Partir sans enregistrer demande « Quitter », « Rester » ou « Effacer mes modifications ».

Enregistré depuis un autre appareil pendant qu'on écrivait, un quiz n'est jamais écrasé : « Rien n’est écrasé : choisis la version à garder. » — « Garder la mienne » ou « Prendre l’autre version ».

> [!NOTE]
> Pourquoi : sur l'offre gratuite de l'hébergeur, le serveur s'endort sans visite. Le premier « Enregistrer » qui suivait échouait, poussait à recharger la page, et tout ce qu'on avait écrit partait.

## Les sortes de questions

Ce qu'on écrit pour chacune ; comment elle se joue et se note : [Les questions](les-questions.md).

| Sorte | Dans l'éditeur | Dans une liste collée | Pour se jouer |
|---|---|---|---|
| QCM | « QCM » : 2 à 4 réponses, la bonne cochée | une réponse par ligne, `*` devant la bonne | deux réponses, la bonne désignée |
| Vrai ou faux | un QCM aux deux réponses « Vrai » et « Faux » | `* Vrai` puis `Faux` | comme un QCM ; garde son ordre |
| Plusieurs bonnes réponses | « Plusieurs bonnes réponses » : des cases à cocher | `Type : plusieurs réponses`, `*` devant chaque bonne | une bonne cochée au moins |
| À remettre dans l'ordre | « À remettre dans l’ordre » : 3 ou 4 éléments, dans le bon ordre | `Type : dans l'ordre` | trois éléments ; toujours montrés mélangés |
| Estimation | « Estimation » : « Bonne réponse » et « Unité » (12 caractères) | `= 8 849 m` | une bonne réponse qui se lit |
| Estimation en direct | « En direct » : la bonne réponse se tape à la révélation | `= ? g` | rien de plus |
| Qui dans la salle ? | rien à écrire : les invités sont les réponses | `Type : qui dans la salle` | un intitulé ; aucun point |

Une question incomplète s'enregistre telle quelle, dit sur sa carte ce qui lui manque (« Choisis la bonne réponse »…), et la partie la saute. Un nombre se tape comme on l'écrit — « 35 000 », « 0,8 », « −40 » (`lireNombre`) ; un temps se borne en quittant son champ.

### Ce qui entoure une question

Toute sorte peut porter ceci ; les quatre derniers se replient sous « Anecdote, note, intertitre » tant qu'ils sont vides.

| Élément | Ce qu'on écrit | Qui le voit |
|---|---|---|
| Photo | « Ajouter une photo » : le navigateur la réduit à 1 280 px et la recompresse | l'écran et les téléphones |
| Photo à mémoriser | « La photo disparaît avant la question » : 2 à 30 s, 5 d'office | l'écran et les téléphones, seule ; elle disparaît, puis revient à la révélation, sur l'écran commun |
| Extrait (blind test) | « Ajouter un son » : 1,5 Mo au plus, envoyé tel quel — MP3, M4A, AAC, OGG, WAV ou WebM | l'écran commun seul, pendant la question |
| Anecdote | « Le saviez-vous ? », 280 caractères | à la révélation : écran, téléphones |
| Note pour toi | 280 caractères | ta télécommande seulement |
| Intertitre | une diapo avant la question, 80 caractères | toute la salle |
| Photo de la révélation | « Photo de la révélation — le bébé, puis l’adulte » | l'écran commun, à la révélation |

« Mise de côté » garde une question écrite sans la jouer. Les bornes vivent dans `shared/library.ts` — 100 questions (`MAX_QUESTIONS`), 300 caractères par intitulé (`MAX_TEXT`), 120 par réponse (`MAX_ANSWER_TEXT`), 5 à 120 s par question, 20 d'office (`MIN_DURATION`, `MAX_DURATION`, `DEFAULT_DURATION`) — et chacune a sa ligne dans [les barèmes](../reference/baremes.md).

## Coller une liste

Une ligne vide sépare deux questions ; la première ligne est l'intitulé.

```
Titre : Le tour du monde

# Géographie

Quelle est la capitale de l'Australie ?
Sydney
* Canberra
Melbourne

Quelle est l'altitude du mont Everest ?
= 8 849 m
Temps : 30 s
Anecdote : Elle grandit encore de quelques millimètres par an.
```

- `*` marque la bonne réponse — devant, derrière, ou « Réponse : B » sous les choix ; `=` fait une estimation, `= ?` une estimation en direct. Sans étoile, ou avec plusieurs hors « plusieurs réponses », la question attend qu'on choisisse sur sa carte.
- `# Musique` range les questions suivantes dans une catégorie (son début suffit : « # Cinéma ») ; `#` seul les en sort. « Temps : 30 s » vaut pour sa question et les suivantes. Sans ces lignes, la liste prend le temps et la catégorie de sa voisine.
- Sous l'intitulé, dans n'importe quel ordre : `Photo`, `Observation`, `Ordre : fixe`, `Type`, `Anecdote`, `Note`, `Intertitre`, `De côté : oui`. « Titre : » en tête nomme un quiz qui n'en a pas.
- La mise en forme d'une IA se retire seule (gras, puces, numéros, « A) », coches ✅, bloc de code). Un nombre ambigu (« = 10 93 ») fait un bloc ignoré, nommé par son début ; chaque estimation lue s'affiche avant d'ajouter.

La liste arrive à la fin du quiz, ou « à partir du n° » qu'on tape. **Les photos annoncées** (« Photo : tour-eiffel.jpg ») se joignent d'un coup par « Joindre les photos », chacune à sa question par son nom de fichier. Celle qui manque reste « Photo attendue : … », avec « Ajouter la photo » et « Sans photo » : la question ne se joue pas sans elle.

**Faire écrire un quiz.** « Copier le format complet » copie les règles, les bornes, les catégories et un exemple de chaque possibilité, que les tests relisent : il ne promet rien que la liste ne sache lire. « Préparer la demande pour une IA » y ajoute la commande — thème, nombre de questions, public (Adultes, Famille, Enfants), niveau, part d'estimations — et « Copier la demande et le format ».

**« Copier en liste »** écrit le quiz dans ce format, pour le passer dans un message ou le faire compléter. Il se recolle à l'identique, sauf ce qui ne voyage pas en texte : une photo revient attendue, la photo de la révélation se perd, un blind test revient « De côté : oui », sans son extrait.

## Exporter et importer

« Exporter en fichier » télécharge un `.quiz.json` : les questions, leurs photos et leurs extraits en clair — une adresse de photo ne voudrait rien dire ailleurs. « Exporter tous mes quiz » emporte la bibliothèque en un fichier `.bibliotheque.json`.

« Importer un fichier » prend l'un ou l'autre, d'ici ou d'un autre serveur, par les portes habituelles : chaque pièce par l'envoi d'image, puis le quiz par sa création — bornes comprises, réglages gardés. Un titre déjà pris devient « (2) ». Un fichier qui n'est pas un quiz de l'application, d'une version plus récente ou sans question se refuse en une phrase ; une pièce d'un autre format est laissée de côté et comptée, sa question arrive sans elle.

## Partager

Jamais un quiz public : vivant, il bougerait sous les pieds des autres ; public, il livrerait ses réponses aux invités qui animent aussi. On partage **une copie**, prise au moment du geste : tes retouches d'après ne la suivent pas.

- **Par un code.** « Partager par un code » donne un code de six caractères — « K7X-2QF », sans 0, O, 1, I ni L —, valable sept jours ; « Annuler ce code » ne s'offre que dans la boîte qui le donne. L'ami le tape dans « Créer un quiz → Recevoir par un code », et la copie arrive dans son espace, photos et extraits recopiés. Trente codes en cours au plus par espace ; dix codes manqués en un quart d'heure ferment la porte.
- **Au catalogue.** « Proposer au catalogue » envoie une copie et une phrase qui dit à quoi sert le quiz. L'administrateur la relit dans le QG — pas de prénoms d'invités, pas de photos de proches —, la publie, la refuse ou la retire ([Administrer](../guides/administrer.md)). Publiée, elle paraît dans « Partir d’un modèle » de chaque espace, sous « Le catalogue de ce serveur », avec le nom de son auteur ; une nouvelle version publiée remplace l'ancienne.

## Les modèles

Onze quiz livrés avec l'application, en deux rayons :

| Rayon | Modèles (questions) |
|---|---|
| « Pour une fête — tu écris les réponses » | ⭐ Qui connaît le mieux [Prénom] ? (8) · 🎂 L'anniversaire de [Prénom] · 💍 Le mariage de [Prénom 1] et [Prénom 2] · 🎉 L'enterrement de vie de [Prénom] · 🥂 Le pot de départ de [Prénom] · 🎄 Noël en famille (10 chacun) |
| « Pour jouer tout de suite » | 🌍 Culture générale (10) · 📏 Les estimations folles (13) · ✅ Vrai ou faux express (15) · 📸 Le quiz de mémoire (8, à photo qui disparaît) · 🧒 Le quiz des 8-12 ans (14) |

« Partir de ce modèle » range une copie à toi, réponses mélangées à chaque partie, et l'ouvre. Les modèles de fête n'ont aucune question prête : leurs réponses, marquées ✏️, sont à écrire — toi seul les connais. Sur les cinq à prénoms, « Pour qui ? » remplit le reste d'un geste : le prénom de la personne fêtée et l'accord (« Elle », « Il », « Sans accord »), ou les deux prénoms d'un couple ; « Créer le quiz » remplace chaque « [Prénom] », titre compris. « Copier sans personnaliser » prend le modèle tel quel.

Au premier démarrage d'une base, seuls Culture générale et Qui connaît le mieux [Prénom] ? entrent dans la bibliothèque de l'administrateur ; les autres espaces partent vides. Les modèles restent des fichiers (`server/content/quiz/`), relus à chaque demande : un modèle ajouté au dépôt se propose dès sa mise en ligne.

## Le quiz tout prêt

Pour qui n'a pas le temps d'écrire : un quiz composé dans la base de la campagne — des milliers de questions relues, presque toutes avec leur anecdote. Il se propose dans « Créer un quiz », dans « Ton premier quiz », dans « Ajouter un quiz » du salon, et à l'écran commun (« Choisis un quiz »), où il se lance aussitôt composé.

La feuille, réglée d'office : « Sur quoi ? » — des catégories, ou un sujet de la campagne (une époque, un fil rouge, un thème) ; « La difficulté » : Facile, Progressive ou Corsée ; « Combien de questions ? » : 10, 15, 20 ou 30 ; « Des estimations » : une question sur cinq, trente secondes chacune (`UNE_ESTIMATION_SUR`, `DUREE_D_UNE_ESTIMATION`) ; « Des enfants jouent » : rien qu'un enfant de dix ans ne puisse comprendre, et d'abord ce qu'il sait. Une ligne dit d'avance ce que la base donnera vraiment (« 12 questions seulement », « aucune estimation ici »), et l'appareil retient le dernier choix.

Le tirage ne reprend **rien de ta bibliothèque**, archivés compris, et pose d'abord ce que tes soirées n'ont jamais posé. Les questions montent avec la difficulté choisie, les catégories à tour de rôle, sans deux questions jumelles quand il y a mieux. Une estimation n'est jamais la première et vient d'une vraie réponse chiffrée : ni un numéro, ni un petit nombre que toute la salle sait. Le quiz — des QCM et des estimations, sans photo — rejoint ta bibliothèque comme une copie de modèle, sous un titre comme « Les années 80 · 10 questions faciles · en famille ».

Dans l'éditeur, chaque question tirée de la base porte sa difficulté à côté de son numéro, et **« Une autre »** la remplace par une voisine — même catégorie, même difficulté, même sorte —, qui garde son temps et son intertitre ; quand il n'en reste plus : « La base n’a plus rien de semblable : écris-en une toi-même ».

## La mémoire des quiz

La carte dit « joué 3 fois », la fiche « Joué 3 fois, la dernière le 14 mars » ; le filtre « Jamais joués » et le tri « Les derniers joués » en viennent. Au pied de chaque question : « Posée le 14 mars : trouvée par 3 sur 13 (23 %). » — ou, pour une estimation, jamais « trouvée » : « Posée le 14 mars, à 13 invités. » De quoi savoir, en rejouant un quiz, laquelle était trop facile.

La mémoire suit chaque question par son identifiant : « Dupliquer » le garde — la copie partage la mémoire de l'original —, un quiz importé d'un fichier repart de zéro.

## Le programme de la soirée

Il se prépare au salon : « Lancer » et le ▶ d'une carte ouvrent « Nouveau salon » (`/salon`) sur ce quiz. « Ajouter un autre quiz » y propose tes quiz prêts, le quiz tout prêt et les modèles jouables tels quels ; « Réglages » donne à chacun ses points (×1, ×2 ou ×3) ; « Ouvrir le salon » enregistre l'ordre de ce soir, que la console propose ensuite quiz après quiz. Un salon s'ouvre avec un profil : un compte d'animateur sans profil lance ses quiz à l'écran commun.

## Les catégories

Une liste fixe, la même chez tous les animateurs : Culture générale, Histoire, Géographie, Sciences, Nature, Cinéma & séries, Musique, Arts & lettres, Sport, Cuisine, Jeux & pop culture, Autour de la fête (`shared/categories.ts`). C'est ce qui permet à la carrière d'un joueur de les additionner d'une soirée et d'un hôte à l'autre. L'écran commun et les téléphones l'affichent au-dessus de la question, la bibliothèque en tire ses filtres ; rien n'oblige à classer.

## Comment c'est construit

- **La bibliothèque** vit dans la base permanente (`QuizStore`, `server/src/core/quizStore.ts`), une ligne par quiz, cloisonnée par espace ; ses routes sont dans `server/src/api.ts` et `server/src/partages.ts`, derrière la session de compte ([l'API HTTP](../reference/api-http.md)). À chaque écriture, le serveur relit chaque question (`normalizeQuestions`, `shared/library.ts`) : il borne, et n'accepte une photo que sous une adresse à lui.
- **La bibliothèque en mémoire.** Le moteur de jeu lit une copie des quiz jouables de chaque espace — ni archivés, ni sans question prête —, relue après chaque écriture ; de deux relectures qui se croisent, seule la dernière partie compte. Une partie lancée garde sa propre copie.
- **Les pièces d'une question** — la photo, celle de la révélation, l'extrait — vivent à part, chacune sous une adresse `/media/image/…` publique : les téléphones les chargent sans session, et l'identifiant, impossible à deviner, tient lieu de permission. Ce qui emporte une question — l'export, un code, le catalogue — les emporte toutes.
- **Le ménage**, après chaque enregistrement ou suppression d'un quiz, n'efface une pièce qu'une heure après qu'aucun quiz ne la cite plus, et jamais celle qu'une partie encore sur le disque, une soirée archivée ou un partage vivant cite : le bilan d'une soirée passée garde ses photos.

Le détail des deux bases et des archives : [Les données](../architecture/donnees.md).

## Pour aller plus loin

- [Les questions](les-questions.md) — comment chaque sorte se joue et se note
- [La soirée](la-soiree.md) — de la salle d'attente au podium
- [Animer une soirée](../guides/animer-une-soiree.md) — le salon, la console
- [Les barèmes](../reference/baremes.md) — chaque borne et sa constante
- [Les données](../architecture/donnees.md) — la base permanente, les archives
