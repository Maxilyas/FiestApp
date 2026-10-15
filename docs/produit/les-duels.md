# Les duels

> Deux joueurs à profil sur la même série de questions — ou un joueur et Automate, l'adversaire simulé —, chacun à son heure. Cette page dit comment un duel se joue, ce qu'il met en jeu (la cote, les ligues, les confettis du lundi) et ce que les amis y changent, puis où vit le code.

**Dans cette page** : [Le dé](#le-duel-au-dé-contre-automate) · [Défier quelqu'un](#défier-quelquun) · [La cote](#la-cote) · [Les ligues](#les-ligues-et-leurs-bordures) · [Le lundi](#ce-que-paie-le-lundi) · [Le classement](#le-classement) · [Les amis](#les-amis-et-les-joueurs-croisés) · [Les défis entre amis](#les-défis-entre-amis) · [Masqué ou supprimé](#un-profil-masqué-ou-supprimé) · [Le code](#comment-cest-construit)

## Trois sortes de duels

Un duel est une série de la campagne — trois vies, sans chronomètre, des faciles aux expertes — que deux adversaires jouent sur les mêmes questions : le plus de bonnes réponses gagne. **Rien ne se joue en direct** : chacun joue à son heure, sur son téléphone. Et rien ne sonne : aucune notification, c'est l'accueil qui dit ce qui t'attend.

| | Le duel au dé | Le duel contre quelqu'un | Le défi entre amis |
|---|---|---|---|
| Contre qui | Automate 🤖, simulé | un joueur à profil, ami ou non | tes amis, ou qui a le lien |
| Quand | tout de suite | toi d'abord, l'autre ensuite, sous 7 jours | sous 7 jours |
| Sur quoi | toujours toutes les catégories | des catégories ou un sujet, au choix | des catégories ou un sujet |
| La cote | la tienne bouge | les deux bougent | jamais : il est amical |
| Se lance encore | oui | oui | non, il finit sa vie |

Le dé faisait autrefois rejouer la série finie d'un autre joueur, un inconnu. Il ne joue plus que contre Automate : sur un serveur de quelques amis, on les avait vite tous affrontés, et la série d'un absent, sous son prénom, laissait croire qu'on l'affrontait. Ces rencontres d'avant restent dans ton historique, les réponses de l'autre recopiées.

Les duels demandent un profil, où restent ta cote, ta ligue et tes confettis : sans lui, la page propose « Me connecter » ou « Créer mon profil », et la connexion ramène au lien d'un défi. Une soirée, elle, se joue toujours sans compte, et l'invité anonyme n'y porte ni ligue ni bordure.

## Où les trouver

**À l'accueil**, la tuile « Les duels », sous « Le quiz du jour » dans la section « Seul » — des épées, puis le blason de ta ligue —, dit d'abord ce qui t'attend : un résultat (« Hugo a joué ton duel », la tuile allumée d'or), un duel reçu (« Léa te défie : à toi de jouer »), ton duel au dé laissé en route ; sinon ta ligue, ta cote et ta semaine (« Ligue de bronze · cote 1017 · encore 2 duels pour ta récompense »). Un chiffre blanc sur rouge additionne les résultats à voir et les duels à relever, et une bannière « Duel terminé » tombe une fois en haut de l'accueil quand un résultat arrive.

**La page `/duels`** : le cadran des six ligues autour de ta cote ; ta semaine en trois losanges ; « Défier », en grand, et le dé à côté ; trois onglets, « En cours », « Historique », « Classement » ; en haut, « Comment ça marche ? » et tes amis. « En cours » range d'abord les résultats que tu n'as pas vus, puis ce qui est à toi de jouer (« À toi »), puis ce qui attend l'autre, avec le temps restant.

## Le duel au dé, contre Automate

1. Touche le dé : un duel neuf contre Automate est tiré — sa série et sa partie —, et une feuille dit ce qu'il met en jeu, en deux jetons, « +19 victoire » et « +2 défaite » ([la cote](#la-cote)) : l'enjeu se lit contre son score, et n'est exact qu'une fois tiré. « Jouer le duel » le commence. Fermée (« Pas maintenant ? Il t'attend dans tes duels. »), la feuille le laisse dans « En cours », et le dé le reprend, la feuille avec, tant que tu n'as pas répondu : le dé finit toujours le précédent avant d'en tirer un autre — on ne le relance pas pour un enjeu plus doux. Un duel déjà commencé reprend tout de suite. « Un autre duel », sous un verdict, passe par la même feuille.
2. Au-dessus de chaque question : « Toi 7 – Automate 6 » (son score sur les questions déjà jouées), « simulé, de ton niveau », et l'enjeu, « En jeu : +17 si tu gagnes, +2 même si tu perds » ([la cote](#la-cote)). Après ta réponse, ce qu'il en avait fait (« Automate l'avait trouvée. », ou « ratée ») — ou « Automate n'avait pas joué celle-ci. » si sa série s'était arrêtée à sa troisième faute.
3. Le duel finit dès que tu dépasses son score total (tu as gagné : plus rien à jouer), à ta troisième faute, ou au bout des questions. « Voir qui a gagné » mène à la carte du verdict, qui se retourne d'elle-même : victoire, défaite ou égalité, les deux scores, ce que ta cote a gagné ou perdu, ta ligue et ta place. Dessous, ta semaine, puis ce que le duel a fait tomber, par l'écran des gains de toute la campagne : « Nouveaux trophées » et « À porter » ; « Ce que tu gagnes » n'y paraît qu'à un niveau gagné — la carte dit déjà ce que le duel a fait. Enfin « Un autre duel », « Accueil », « Réponses ».

« ← Partir » ne perd rien : le duel t'attend. Il ne s'abandonne pas, ne ferme jamais, et ne compte qu'une fois fini.

**Automate** joue comme toi, tel que tes réponses de campagne te décrivent : il rate où tu rates (le modèle du savoir, [plus bas](#comment-cest-construit)). Sa force : pendant tes 10 premiers duels, ton niveau de campagne — le score que tes réponses font attendre de toi, 7 sans aucune réponse ; ensuite, celui de ta cote cachée, 7 + (cote cachée − 1 000) ÷ 50 — jamais celle qu'on voit, qui monte au-dessus de ton niveau. Ses réponses sont tirées au départ, et son score se tient à 2 bonnes réponses au plus de ce qu'on attend de lui sur la série (`ECART_D_AUTOMATE`) : sa partie se retire jusqu'à 50 fois, la plus proche est gardée. Libre, il s'en écartait de quatre ou plus un duel sur cinq : des défaites de dix réponses.

## Défier quelqu'un

**Toi, qui défies.**

1. Ouvre « Défier quelqu'un » : « Défier » sur la page ou sur une ligne « À ta portée », « Défier Tom » au pied de la carte d'un joueur — dessous, ce que le duel mettrait en jeu, « En jeu : +21 si tu gagnes, +4 même si tu perds » —, ou « Revanche » sous un verdict.
2. « Contre qui ? » : un prénom, « Tes amis » ou « Joueurs croisés », « Choisir » à côté. Choisi, ce qu'il met en jeu se voit sous lui, en deux jetons, ta part de lanceur comprise : « +21 victoire », « +4 défaite » — rouge quand la défaite coûte. Sans ta cote sous la main (une revanche, le lien de la préparation), la page la relit avec la sienne avant de le dire. « Sur quoi ? » : « Toutes les catégories », ou « Changer » pour des catégories ou un sujet.
3. Tu joues d'abord, trois vies, sans chrono : « Tom jouera après toi ».
4. À ta dernière réponse, le duel part chez lui — aucun lien à envoyer : « Duel envoyé », « Chez Tom, ton score caché », « Verdict quand Tom aura joué », tes confettis et ton expérience, et ce que la partie a fait tomber, comme sous un verdict. Laissé avant, il ne part à personne.
5. Il attend dans « En cours ». Quand Tom l'a joué, la tuile de l'accueil s'allume, la bannière tombe, et la carte du verdict se retourne la première fois que tu ouvres le duel.

**Toi, quand Léa te défie.** Rien n'arrive tant qu'elle n'a pas fini. Ensuite ton accueil le dit (« Léa te défie : à toi de jouer ») et « En cours » le range sous « À toi ». La page du duel montre sa carte face cachée, un cadenas sur son score (« Sa carte se retourne à ta dernière réponse. »), ce que tu gagnes ou perds, et « Relever le duel ». Tu joues les mêmes questions sans connaître le score à battre ; ta partie s'arrête dès que tu le dépasses.

**Les règles.**

- **Un seul duel ouvert par paire**, dans les deux sens, tant qu'il n'est pas joué des deux côtés ni fermé. Le refus dit quoi faire : « Tom t'a déjà défié : relève son duel d'abord, en tête de tes duels ». Au-delà, aucun plafond : autant de duels en attente que d'adversaires.
- **Les questions** sont tirées comme une série, d'abord parmi celles que ni l'un ni l'autre n'a vues.
- **Sept jours** pour le jouer (`DUREE_D_UN_DUEL_MS`). Il compte quand les deux l'ont fini, daté de la seconde partie ; à la fermeture, s'ils l'ont tous deux commencé, sur ce qu'ils ont atteint ; jamais commencé par l'un, il ne compte pas : « Ce duel est fermé : il ne compte plus. » Personne ne perd de points en dormant. L'administrateur peut aussi annuler, depuis le QG, un duel que l'adversaire n'a pas commencé : il se ferme tout de suite, comme à son expiration, et ne compte pour personne.
- **La correction** s'ouvre quand le duel est joué des deux côtés, ou fermé. Ses erreurs n'entrent au [carnet](la-campagne.md) qu'à la fermeture : ouvert, il soufflerait ses réponses.
- Personne d'autre ne le voit, même avec son code.

## Ce que rapporte un duel

Chaque partie paie comme une série de la campagne : un confetti et l'expérience d'une bonne réponse par bonne réponse, les hauts faits de série — le Funambule, Sans une égratignure, la Grande Série si elle est de toutes les catégories — et les étapes de L'Érudit et du Marathonien. Ni record des séries, ni laurier, ni Éclat. Voir [la campagne](la-campagne.md) et [les récompenses](les-recompenses.md).

## La cote

Tout le monde part de **1 000** (`COTE_DE_DEPART`), et chacun a **deux cotes** depuis le 14 octobre 2026 — la montée, après une joueuse qui lançait beaucoup de duels et « ne faisait que reculer » :

- **la cote qu'on voit** — celle des ligues, du classement, des bordures et des confettis du lundi — avance pour qui joue ;
- **la cote cachée**, l'ELO seul, dit ton niveau : Automate se règle sur elle. Elle ne se montre nulle part.

Un duel se gagne au nombre de bonnes réponses — gagné vaut 1, égalité 0,5, perdu 0. **Tes chances** contre une force d'en face : E = 1 ÷ (1 + 10^((force − cote) ÷ 400)), soit 0,5 à égalité et 0,24 contre 200 points de plus. **La force d'en face** : contre Automate, la cote de son score, 1 000 + 50 × (bonnes réponses − 7) (`POINTS_PAR_BONNE_REPONSE`, `SCORE_DE_REFERENCE` : sept, la médiane des séries allées au bout) ; contre quelqu'un, **ses cotes au lancement du duel** — celle qu'on voit contre ta cote qu'on voit, sa cachée contre ta cachée —, jamais son score : un second profil qui rejouerait les questions, réponses connues, choisirait son score, pas sa cote.

**La cote qu'on voit** avance d'un écart en points entiers :

- **sous l'Or**, chaque duel rapporte 5 (`PARTICIPATION_SOUS_L_OR`), plus 24 × (1 − E) s'il est gagné ; perdu, il ne coûte que le quart de ce que l'ELO ferait payer, 24 × E × 0,25 (`PERTE_SOUS_L_OR`) : au pire un point. Une égalité rapporte, contre plus fort, ce que l'ELO lui donnerait ; contre plus faible, elle coûte la moitié d'une défaite ;
- **dès l'Or**, chaque duel rapporte 1 (`PARTICIPATION_AU_DESSUS`), et l'enjeu suit l'écart : une défaite coûte 24 × E² — presque rien contre plus fort, beaucoup contre plus faible ;
- **qui lance un défi** gagne 1 de plus, quelle qu'en soit l'issue (`PART_DU_LANCEUR`) : provoquer paie ;
- **l'Argent et l'Or**, une fois atteints, ne se perdent plus (`LIGUES_GARDEES`) : ta cote ne redescend plus sous leur seuil.

Ce qui se joue, gagné / égalité / perdu :

| En face | À 1 000 | À 1 000, qui a lancé le défi | À 1 300 |
|---|---|---|---|
| 200 de moins | +11 / +3 / 0 | +12 / +4 / +1 | +7 / −6 / −13 |
| 100 de moins | +14 / +3 / +1 | +15 / +4 / +2 | +10 / −4 / −9 |
| autant | +17 / +4 / +2 | +18 / +5 / +3 | +13 / −2 / −5 |
| 100 de plus | +20 / +8 / +3 | +21 / +9 / +4 | +16 / +4 / −2 |
| 200 de plus | +23 / +11 / +4 | +24 / +12 / +5 | +19 / +7 / 0 |

Sous l'Or, même une défaite fait avancer — la page le dit, « +2 même si tu perds », jamais en rouge, et « rien à perdre » quand elle ne coûte rien. Contre Automate, réglé sur ton niveau, chacun gagne à peu près quatre duels sur dix : qui joue monte en Or, même pas très fort — un joueur qui n'en gagne qu'un sur trois y arrive en moins de cent duels (`server/test/duels-montee.test.ts`). Dès l'Or, c'est ton niveau qui parle : battre plus fort que soi rapporte gros, s'acharner sur plus faible ne paie pas.

**La cote cachée** suit l'ELO tel qu'il était avant la montée : le poids du duel × (résultat − chances), arrondi ; 48 pendant tes 10 premiers duels, qui comptent double (`POIDS_DU_PLACEMENT`, `DUELS_DE_PLACEMENT`), puis 24 (`POIDS_D_UN_DUEL`). Réglé sur la cote qu'on voit, qui monte au-dessus du niveau, Automate se renforcerait, et l'on perdrait plus souvent.

Rien ne passe d'un profil à l'autre, et contre Automate seules tes cotes bougent.

> [!NOTE]
> **Seules les cotes d'en face sont figées.** Les tiennes sont celles que tu as quand le duel compte : l'enjeu dit au lancement peut différer de l'écart final. Lancé à 1 190 contre 1 100, un duel annonce « +15 si tu gagnes, +2 même si tu perds » ; qu'un duel au dé te fasse passer l'Or — 1 207 — avant que l'autre joue, et la victoire ne rapporte plus que +10, la défaite en coûte 7.

Les cotes ne sont écrites nulle part : elles se relisent de tout ton journal de duels, du plus ancien au plus récent, à chaque lecture. Une règle changée vaut donc aussitôt, pour tout le monde et pour tout le passé — la montée comprise : ceux qui avaient reculé l'ont regagné le jour même —, sauf les cotes figées des duels déjà lancés ; un duel lancé avant la montée n'a figé qu'une cote, et ta cachée bouge contre elle. Ces valeurs sont des choix de produit, dans le code (aucun réglage au QG), mesurés sur les vrais duels (`server/scripts/calibrage-duels.ts`) : voir [les barèmes](../reference/baremes.md).

## Les ligues et leurs bordures

Une ligue tous les 100 points, deux bonnes réponses de mieux en moyenne (`LIGUES`, voir [les barèmes](../reference/baremes.md)) ; l'argent et l'or, une fois atteints, ne se perdent plus :

| Ligue | Dès la cote | Confettis chaque lundi | Blason | Sa bordure |
|---|---|---|---|---|
| Ligue de bronze | ton premier duel | 10 | une étoile | Le Moletage |
| Ligue d'argent | 1 100 | 20 | deux étoiles | Le Perlé |
| Ligue d'or | 1 200 | 30 | trois étoiles | Les Fleurons |
| Ligue de platine | 1 300 | 40 | une gemme | Le Givre |
| Ligue de diamant | 1 400 | 50 | une gemme taillée | La Couronne de brillants |
| Ligue des maîtres | 1 500 | 60 | une couronne | Le Soleil noir |

**La bordure** est un anneau cranté autour de ton avatar. Dès ton premier duel, chaque ligue jusqu'à la plus haute que ta cote ait atteinte t'ouvre la sienne, et une chute ne la reprend pas. Chaque duel gagné y sertit un cran — dans la ligue où tu étais avant lui —, 12 au plus (`CRANS_D_UNE_BORDURE`). Tu portes d'office la plus haute qui a un cran ; dans la loge, tu en choisis une autre de tes ligues, même vide, ou aucune. Elle se voit là où ton avatar de profil paraît — l'accueil, ta carte, les classements, et en soirée sur les téléphones et l'écran commun —, jamais sous un Divin, ni dans le souvenir ou le bilan d'une soirée.

Dans « Ma collection », la page « Duels » de l'album des trophées range les six ligues, chacune avec sa bordure, puis les six bordures et leurs crans sertis (« 7/12 ») — même avant ton premier duel : elles t'attendent.

## Ce que paie le lundi

Une semaine va du lundi au dimanche, heure de Paris ; un duel appartient à celle où il a compté. Chaque semaine **finie** où tu as joué au moins 3 duels (`DUELS_POUR_LA_RECOMPENSE`) te rapporte les confettis de **la meilleure ligue qu'elle a vue** — celle où tu es entré dans la semaine comprise : un duel perdu en route ne reprend pas la récompense. La semaine en cours ne paie qu'une fois finie, sa meilleure ligue pouvant encore monter.

Rien ne tourne le lundi : ton solde se relit, et la récompense y est. Ta semaine se lit en trois losanges, « +30 🎊 lundi » ; tant que la nouvelle n'a pas de duel, la page et l'accueil disent ce que la passée a versé. Changer une ligue ou ce seuil change d'un coup le solde de tout le monde, semaines passées comprises. Les confettis se dépensent à [la boutique](la-boutique.md).

## Le classement

Il range ceux dont le dernier duel date de moins de 28 jours (`JOURS_DU_CLASSEMENT`) : un ancien premier ne tient pas la tête pour toujours. Ta cote, elle, se garde — ni saison ni remise à zéro. Les ex æquo partagent leur rang : 1 + le nombre de joueurs strictement devant.

L'onglet « Classement » montre deux places côte à côte : « Parmi tous » — ton rang, « sur N », et les places gagnées ou perdues depuis lundi — et « Entre amis », ton rang parmi tes amis classés. Parmi tous, « À ta portée » : les 3 joueurs juste au-dessus de ta cote (`JOUEURS_A_PORTEE`), chacun avec ce qu'il te rapporterait et ce qu'une défaite te ferait (« +18 si tu gagnes » et, sous l'Or, « +3 même si tu perds » ; au-dessus, « −4 si tu perds », en rouge) et « Défier », ou « En cours » si un duel est déjà ouvert entre vous ; en tête, « Ils te talonnent ». Puis le « Top 3 », et « Tout voir › » : les 50 premiers (`LIGNES_DU_CLASSEMENT`) sous le nom de leur ligue, ta ligne à part si tu es plus loin ; un nom touché ouvre sa carte.

Les places depuis lundi comparent ton rang du jour à celui que donnaient les cotes du début de semaine, parmi ceux qui jouaient déjà avant. Deux homonymes se distinguent par « (2) », pour le second arrivé aux duels.

## L'historique

L'onglet « Historique » relit tous tes duels : « Ton bilan » (victoires, défaites, égalités, et tes records — « Meilleure série », où une égalité rompt la série, « Plus haute cote », « Plus belle victoire ») ; ta courbe sur tes 30 derniers duels ; « Face-à-face », tes 6 adversaires les plus affrontés, Automate compris ; tes 10 derniers duels en barres, puis ceux du mois en lignes — chacune ouvre le duel ou sa correction —, « Voir plus » remontant jusqu'à 30 jours ; enfin tes défis entre amis. Un résultat que tu n'as pas encore vu n'y compte nulle part tant que sa carte ne s'est pas retournée.

## Les amis et les joueurs croisés

**La feuille des amis** (« Amis » sur l'accueil, ou son icône sur la page des duels) tient un champ, « Un prénom… », puis « Ils t'ont ajouté », « Tes amis » rangés par cote, et « Joueurs croisés ». Chaque ligne ouvre la carte du joueur, ses gestes à son pied : « Défier Tom », « Ajouter à mes amis », ou « Dans tes amis » et « Retirer ».

- **Ajouter est à sens unique** : ni demande ni acceptation — ta liste, comme un carnet d'adresses. L'autre te voit dans « Ils t'ont ajouté ».
- **Être ami ne donne aucun droit de plus** : tu défies n'importe quel profil, ami ou non. Un ami, c'est un nom dans ta liste, ta place « Entre amis », et le point vert « en ligne » (passé ces 5 dernières minutes), montré seulement entre amis réciproques : sinon un inconnu guetterait quand tu te connectes.
- **Retirer est le seul blocage** : « Ses duels ne te parviendront plus ». Il ne l'apprend pas — sa fin dit quand même « Duel envoyé » et « Chez » ton prénom — jusqu'à ce que tu le rajoutes (le duel retenu t'arrive alors) ou que vous rejouiez un duel ensemble. On ne bloque pas un joueur absent de sa liste.

**La recherche** part de 2 lettres (`LETTRES_POUR_CHERCHER`) et rend 12 joueurs au plus : un prénom qui contient le texte, sans accents ni majuscules, ou un identifiant de connexion qui commence par lui — l'identifiant n'est jamais montré. **Les joueurs croisés** (6 au plus) viennent de tes 5 dernières soirées, de tes duels, du défi de la semaine, puis de ta cote — chacun dit pourquoi, « en soirée avec toi » ou « de ton niveau » ; jamais un ami, un retiré, ni Automate.

## Les défis entre amis

L'ancêtre amical du duel : un tirage figé sous un code de 6 caractères (sans 0, O, 1, I ni L), à l'adresse `/duels#duel-<code>`, que chacun de ceux qui ont le lien joue une fois sous 7 jours, profil en main. Il part aux amis choisis à la dernière réponse de son auteur, aux autres par le lien ; il a son classement, comme le défi de la semaine, et sa correction s'ouvre à sa fermeture. Il ne touche **jamais** la cote et n'a ni laurier, ni haut fait à lui, ni Éclat — mais chaque partie paie ses confettis, son expérience et ses hauts faits de série : le Funambule, Sans une égratignure, la Grande Série.

La page ne le lance plus — « Jouer le duel » demande un adversaire —, mais les défis ouverts se jouent jusqu'au bout, et le serveur en accepte encore d'une page d'avant, 5 ouverts au plus (`DUELS_OUVERTS_MAX`). Ceux avec qui tu en as joué un restent dans ta liste d'amis.

## Un profil masqué ou supprimé

**Masqué** par l'administrateur (voir [administrer](../guides/administrer.md)), un joueur disparaît de tout ce que les duels montrent aux autres — classement, recherche, joueurs croisés, listes d'amis, duels reçus, sa carte — et ne peut plus être défié ni ajouté (« Ce joueur est introuvable : cherche-le de nouveau »). Ses duels passés ne le nomment plus : « Un joueur » 🎲. Les siens comptent toujours, et il se voit encore au classement.

**Supprimé**, un profil emporte ses parties et leurs réponses, ses envois et toutes les lignes d'amis qui le nomment. Ses duels contre quelqu'un sortent donc du journal de ses adversaires : leur cote, leurs semaines — et ce qu'elles ont payé — et leurs crans se relisent sans eux. Les rencontres d'avant, contre sa série, gardent ses réponses recopiées et disent « Un joueur » 🎲.

## Comment c'est construit

- `shared/duels.ts`, pur : la cote, la montée, les ligues, les bordures, le bilan, et `releverLesDuels`, qui relit un journal de duels — les deux cotes, chaque semaine et ses confettis, les crans.
- `server/src/core/campagne.ts` (`CampagneStore`, sa moitié duels) : Automate, les duels, les amis, les joueurs croisés, le classement et toutes leurs requêtes. Une partie de duel est une série de la campagne d'un autre mode (`campagne_series.mode` : `rencontre` pour le dé, `duel` sinon) ; à côté, `campagne_duels` (le tirage, les cotes figées de chacun — celle qu'on voit et la cachée), les envois et les listes d'amis, dans la base permanente.
- `server/src/core/modeleDuSavoir.ts`, le modèle du savoir, qu'Automate lit — et la page des sentiers, pour dire à chacun sa chance (voir [les sentiers du savoir](les-sentiers-du-savoir.md#ta-chance-sentier-par-sentier)) : la chance de trouver une question suit la force du joueur, plus son écart dans la catégorie, moins la difficulté de la question (un modèle de Rasch), ajustés sur la première réponse de chacun à chaque question ; ce que vaut chaque difficulté estimée à l'écriture s'y apprend en bloc. Il se refait en fond, jamais sur le chemin du dé.
- `server/src/campagne.ts` : les routes, derrière une session de profil (voir [l'API HTTP](../reference/api-http.md)) ; `client/src/views/Duels.tsx` et `client/src/views/Duel.tsx`, la page ; les parties se jouent dans `client/src/views/CampagneApp.tsx`, qui sert `/duels`. Ce qu'un duel met en jeu se dit d'une seule façon — sa phrase, ses jetons, et quand le dé demande avant de jouer — dans `client/src/views/Rencontre.tsx`, que la partie, la page, la préparation d'un défi et la carte d'un joueur partagent.

**Ce qui se relit** : tout, sauf les cotes figées d'un duel contre quelqu'un — rien n'écrit les cotes, les ligues, les semaines, les crans ni le modèle. Le serveur n'en garde qu'une copie en mémoire : toutes les cotes, dix minutes au plus, et le modèle, refait au plus toutes les trente minutes. Voir [les données](../architecture/donnees.md).

## Pour aller plus loin

- [Les barèmes](../reference/baremes.md) — chaque constante des duels et sa valeur
- [La campagne](la-campagne.md) — la série dont un duel est fait, et le carnet où vont ses erreurs
- [Les récompenses](les-recompenses.md) — les hauts faits de série, l'expérience, les pistes
- [Le profil](le-profil.md) — la loge, où se choisit la bordure, et la carte d'un joueur
- [Les données](../architecture/donnees.md) — le journal, la base permanente, ce qui se relit
- `.claude/rules/duels.md` — les fichiers et les pièges du domaine, pour qui modifie le code
