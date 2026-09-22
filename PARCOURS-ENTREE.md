# Le parcours d'entrée — le brief

Ce document est un **prompt** : il décrit, de bout en bout, le parcours qu'un
invité traverse entre le scan du QR et sa première question. Il se lit seul et
se colle tel quel dans une session de travail.

Il ne remplace pas `CLAUDE.md` (les invariants du dépôt) ni `README.md` (le
produit expliqué à un humain) : il les prolonge sur un point précis, **la porte
d'entrée**, parce que c'est là que se joue la valeur de l'application et que
c'est là qu'il reste deux questions non résolues :

1. **Un écran de connexion qui ne retient personne.** L'entrée demande de se
   connecter *avant* le prénom et l'avatar — et « Jouer sans compte » passe
   outre, en un bouton aussi large que le premier.
2. **Les homonymes.** À cinquante invités, deux Camille sont une certitude. On
   ne peut ni refuser l'un, ni demander à celui qui a un profil de se
   rebaptiser : son prénom, il l'a choisi une fois pour toutes.

---

## 1. Ce qui existe déjà (lis ça avant de toucher quoi que ce soit)

| Ce que c'est | Où | Ce qu'il faut savoir |
|---|---|---|
| L'écran d'inscription | `client/src/views/PlayerApp.tsx` | machine à trois étapes `me` → `team` → (`profil`), 439 lignes, elle fait déjà beaucoup |
| Le formulaire de profil | `client/src/components/ProfilForm.tsx` | connexion **ou** inscription, l'avatar vient du `prefill` de l'écran d'inscription |
| La page profil | `client/src/views/ProfilApp.tsx` | niveau, finitions, éclats, badges — on n'y vient pas pour jouer |
| Le registre des invités | `server/src/core/party.ts` | identité par jeton, `bindProfile()`, `findByProfile()` |
| L'arrivée à la soirée | `server/src/sockets.ts`, `party:watch` / `player:join` | le cookie du profil est lu **dans la poignée de main**, pas dans la charge utile |
| Les profils | `server/src/auth/profiles.ts`, `auth/profileRoutes.ts` | base permanente, session d'un an, code de secours, pas d'e-mail |
| Le contrat socket | `shared/events.ts` | typé des deux côtés, à mettre à jour en premier |
| Prénoms et avatars | `shared/avatars.ts` | `cleanName`, `cleanAvatar`, 24 emojis, tous < Unicode 13 |

Ce qui marche déjà et qu'il ne faut pas casser :

- **Le cookie de profil est reconnu avant même de rejoindre** : `party:watch`
  rend le `PublicProfile`, et l'écran d'inscription salue (« Content de te
  revoir, Alice »).
- **Un profil ne tient qu'un joueur par soirée** : un second téléphone reprend
  la même identité (`findByProfile`), sinon l'expérience du soir compterait deux
  fois.
- **Un téléphone prêté ne vole pas l'identité de son propriétaire** : un jeton
  qui porte le joueur d'un autre profil est ignoré.
- **Créer un profil en cours de soirée rattache le joueur déjà inscrit** — les
  points du soir suivent. Le socket est rouvert exprès après la connexion, parce
  que le cookie arrive **après** la poignée de main.

Ce qui manque, et qu'on veut :

- Rien ne propose le compte **avant** l'écran prénom+avatar.
- Un profil reconnu doit quand même **retaper son prénom et retoucher son
  avatar** : c'est exactement ce qu'on ne veut plus.
- Les homonymes ne sont traités que par un avertissement en bas d'écran
  (« ajoute une initiale »), qui demande du travail à l'invité et ne change rien
  à ce que le vidéoprojecteur affiche.
- Le code de secours a une route (`/api/joueur/secours`) et une fonction cliente
  (`api.joueur.secours`) **mais aucun écran** : un mot de passe oublié est
  aujourd'hui une impasse.

---

## 2. Les trois personnes qu'on sert

Tout le reste du document se juge à l'aune de ces trois-là.

**Léa, 34 ans, arrive pour la première fois.** Elle ne connaît rien, elle est
debout, dans le noir, avec un verre dans une main. Elle scanne, elle veut
jouer. Elle ne sait pas ce qu'est un « profil » et elle s'en moque. Elle tombe
sur un écran de connexion et n'a rien à y taper : *« Jouer sans compte » doit
lui sauter aux yeux sans qu'elle défile, et la faire entrer en un geste.* C'est
à elle que se mesure cet écran — pas à ceux qui ont un identifiant.

**Alice, 29 ans, revient pour la quatrième fois.** Elle a un profil, niveau 7,
un renard Or qui a éclaté. Son téléphone s'en souvient. *Elle ne doit plus rien
choisir : elle doit voir son renard, son niveau, et un seul bouton.*

**Camille, 41 ans, a joué une fois et a aimé.** Elle veut garder sa
progression. *On doit le lui proposer clairement, une fois, au bon moment — et
la laisser repartir en un geste si elle change d'avis.*

---

## 3. Les règles non négociables

Les dix invariants de `CLAUDE.md` s'appliquent. Ceux qui mordent ici :

> **La logique de jeu est 100 % serveur.** **Tout est cloisonné par
> `space_id`.** **L'instantané est dédoublonné et regroupé.** **Un profil ne
> donne aucun avantage de jeu, et un invité anonyme n'affiche rien.** **Les
> dérivations restent pures.**

Et les quatre règles propres à ce chantier :

1. **Passer coûte un geste, et ce geste est un bouton pleine largeur.**
   L'entrée est un écran de connexion — c'est voulu — mais « Jouer sans compte »
   a le format de « Me connecter », se voit sans défiler, et n'est jamais un
   lien gris en bas de page. Et l'écran ne se remontre pas à un téléphone qui a
   déjà choisi ici.
2. **Un profil reconnu ne choisit plus rien.** Ni prénom, ni avatar, ni
   finition. Il les a choisis une fois, dans son profil ; l'entrée les lit.
3. **On ne demande jamais à quelqu'un de changer son prénom.** Ni à
   l'inscription, ni après. Les homonymes se règlent par ce qu'on **affiche**,
   pas par ce qu'on **exige**.
4. **Aucune impasse.** Chaque écran de la branche « compte » a une sortie qui
   mène au jeu, en un geste, sans perdre ce qui a déjà été tapé.

---

## 4. Le parcours, écran par écran

### 4.0 Ce que le téléphone porte en arrivant

Trois mémoires indépendantes, à ne pas confondre :

| Mémoire | Où | Ce qu'elle dit |
|---|---|---|
| `qz_joueur` | cookie, un an, résolu côté serveur | « ce téléphone est connecté au profil d'Alice » |
| `quizz.me.<slug>` | `localStorage` | « ce téléphone est déjà inscrit à **cette** soirée » (jeton) |
| `quizz.profile.<slug>` | `localStorage` | « le prénom et l'avatar utilisés ici la dernière fois » |

> ⚠️ **Piège de nommage.** La clé `quizz.profile.<slug>` et le type `Profile` de
> `client/src/state.ts` n'ont **rien à voir** avec le profil joueur
> (`PublicProfile`) : ce sont juste le prénom et l'emoji retenus localement.
> Renomme-les (`ChoixLocal`, `quizz.choix.<slug>`) au passage — la confusion coûtera
> une bêtise à quelqu'un un jour.

**La table de décision, à l'arrivée sur `/<espace>` :**

| Le téléphone porte | Ce qu'on affiche |
|---|---|
| un jeton de joueur de cette soirée | **rien** : la salle d'attente, directement (comportement actuel) |
| un cookie de profil | **Écran B′** « Content de te revoir » — un bouton |
| un choix local pour cet espace | **Écran B** pré-rempli — l'entrée a déjà été vue ici |
| rien du tout | **Écran A** — l'entrée, c'est-à-dire la connexion |

### 4.1 Écran A — L'entrée

Le seul écran vraiment nouveau, et c'est bien **un écran de connexion** : deux
champs, un bouton, posés avant tout le reste. C'est un choix assumé, et il
règle d'un coup trois choses pour tous ceux qui reviennent — le prénom,
l'avatar et la progression.

Ce qu'il n'est pas, c'est un péage. **Passer est un bouton pleine largeur**, au
même format que « Me connecter », visible sans défiler.

```
        LA SOIRÉE DE
        Romane
        Le quiz de la soirée
        ─────────────────────────────
        Ton identifiant
        [_________________________]
        Ton mot de passe
        [_________________________]

        ╔═══════════════════════════╗
        ║       ME CONNECTER        ║  ← btn-primary btn-big btn-block
        ╚═══════════════════════════╝
        J'ai oublié mon mot de passe

        ──────────── ou ────────────

        ╔═══════════════════════════╗
        ║     JOUER SANS COMPTE     ║  ← btn-big btn-block, en contour
        ╚═══════════════════════════╝
        ╭───────────────────────────╮
        │      Créer un profil      │  ← btn-ghost btn-block
        ╰───────────────────────────╯
        Un profil retient ton niveau et tes
        prix d'une soirée à l'autre. Il ne
        change rien aux points de ce soir.

        12 invité·e·s déjà là
```

- **« Jouer sans compte » a exactement la largeur et la hauteur de « Me
  connecter ».** Seul le style diffère : plein contre contour. C'est la règle
  qui tient tout l'écran — si quelqu'un doit chercher comment passer, c'est
  raté, et ça se vérifie à l'œil (§9).
- **Aucun champ n'est mis au point automatiquement.** Pas d'`autoFocus` ici :
  le clavier qui s'ouvre tout seul pousse les boutons hors de l'écran, et c'est
  précisément ce qu'on ne veut pas cacher. Le clavier vient quand on touche un
  champ, pas avant.
- **Tout tient sans défiler en 360 × 640**, clavier fermé. Si ça déborde, c'est
  la note explicative qui saute, jamais le bouton pour passer.
- **Une connexion réussie entre directement dans la soirée** (par l'écran E
  s'il y a des équipes) : pas d'écran de confirmation. Celui qui vient de taper
  son identifiant et son mot de passe sait très bien qui il est — l'écran B′ ne
  sert qu'à confirmer une reconnaissance *automatique*, par cookie, où le doute
  existe (téléphone prêté). Son prénom et son niveau l'accueillent dans la
  salle d'attente.
- **Une connexion refusée ne piège personne** : le message le dit, et les deux
  boutons du dessous sont toujours là. Un mot de passe oublié ne doit jamais
  être la fin du chemin. Les essais sont déjà limités côté serveur
  (`LoginBudget`, `auth/profileRoutes.ts`) : au-delà, c'est « Trop d'essais —
  réessaie dans un quart d'heure », et le chemin anonyme reste ouvert.
- **« Créer un profil » mène à l'écran B**, pas à un formulaire d'identifiant :
  on choisit d'abord son prénom et son avatar, on sécurise ensuite (§4.4).
- Le surtitre et le grand titre viennent des réglages de l'espace
  (`space.eyebrow`, `space.headline`) : après un scan, il faut d'abord savoir
  **où** on est arrivé.
- Le compteur d'invités est déjà dans l'instantané, il ne coûte rien, et il
  rassure : ça marche, il y a du monde.

**Quand on ne le montre pas** : dès que le téléphone porte un cookie de profil
(on passe à l'écran B′) ou un choix local pour cet espace (on passe à l'écran
B). Un écran de connexion qu'on repousse deux fois devient un péage.

### 4.2 Écran B — Moi (prénom + avatar)

L'écran d'aujourd'hui, **inchangé dans sa forme** — c'est lui qui marche. Trois
ajouts :

1. **Les avatars déjà portés par un homonyme sont marqués « pris »** et ne se
   sélectionnent plus (voir §5). Tu tapes « Camille », le 🦊 s'éteint parce que
   l'autre Camille l'a déjà. Aucun message d'erreur : on choisit le panda, et
   voilà.
2. **Si l'avatar tiré au sort devient pris pendant qu'on tape**, on en change
   tout seul, avant que l'invité s'en aperçoive. Le tirage au sort existe pour
   que ceux qui ne touchent à rien n'arrivent pas tous identiques ; qu'il évite
   aussi les collisions est dans sa nature.
3. **L'avertissement change de ton** : il ne demande plus de travail.
   - même prénom, avatar différent → « Il y a déjà un Camille — ton 🐼 vous
     distinguera. »
   - même prénom, avatar pris → rien à dire : l'emoji est éteint, c'est le
     message.

C'est aussi **l'étape 1 de la création de profil** : mêmes champs, même écran,
seul le bouton change (« Continuer » au lieu de « Rejoindre la soirée »). Un
invité qui crée un profil choisit donc son prénom et son avatar **une seule
fois**, et ce sont ceux de son profil.

### 4.3 Écran B′ — Content de te revoir (profil reconnu)

```
                 ╭─────────╮
                 │   🦊    │   ← gros, avec sa finition et son éclat
                 ╰─────────╯
        Content de te revoir,
              Alice
           Niv. 7 · 12 badges
        ─────────────────────────────

        ╔═══════════════════════════╗
        ║   ENTRER DANS LA SOIRÉE   ║
        ╚═══════════════════════════╝
        Jouer sous un autre prénom ce soir
        Ce n'est pas moi
```

- **Aucun champ. Aucune grille d'avatars.** C'est le cœur de la demande : ce
  qu'Alice a choisi en créant son profil, on s'en sert, on ne le redemande pas.
- « Entrer dans la soirée » envoie `player:join` **sans `name` ni `avatar`** :
  le serveur les prend dans le profil (§6.2). S'il y a des équipes, l'écran E
  s'intercale, comme pour tout le monde.
- « Jouer sous un autre prénom ce soir » mène à l'écran B pré-rempli. C'est
  rare et c'est volontaire : on peut vouloir être « Le Capitaine » ce soir sans
  renommer son profil. Le choix vaut pour la soirée, **jamais** pour le profil,
  et il est retenu localement pour survivre aux reconnexions.
- « Ce n'est pas moi » déconnecte le profil et renvoie à l'écran A. Discret,
  petit : c'est le cas du téléphone prêté, pas le cas courant.

### 4.4 Écran C — Sécuriser (création, étape 2)

Deux champs, pas un de plus, puisque le prénom et l'avatar sont déjà pris.

- **Ton identifiant** — pré-rempli à partir du prénom (`Camille` → `camille`),
  modifiable. Les règles sont dans `shared/space.ts` (`isValidLogin` : 2 à 32
  caractères, lettres, chiffres, point, tiret).
- **Ton mot de passe** — la règle s'affiche **avant** l'erreur : « au moins 8
  caractères » (`passwordProblem`, `server/src/auth/password.ts`).
- **La sortie** : « Plus tard — je joue » rejoint la soirée en anonyme, avec le
  prénom et l'avatar déjà choisis. On ne perd rien, on ne recommence rien.
- **Si l'identifiant est pris**, le serveur rend un message *et une
  proposition* : « « camille » est déjà pris — essaie « camille2 » », et la
  proposition se pose dans le champ d'un geste. Sans quoi une invitée non
  technique reste bloquée devant un refus qu'elle ne sait pas contourner.

> **Le compromis, assumé :** répondre « camille est pris » révèle qu'un profil
> `camille` existe. C'est une application de fête, un profil ne contient qu'un
> pseudo et de l'expérience, aucune donnée personnelle, et la route est déjà
> limitée à 10 inscriptions par adresse et par tranche de 5 minutes. Le confort
> vaut plus que ce secret-là. Écris-le en commentaire, pour que personne ne
> « corrige » ça par réflexe dans six mois.

### 4.5 Écran C′ — Le code de secours

Celui d'aujourd'hui, qui est bon. Deux ajouts :

- un bouton **Copier** (`navigator.clipboard`, silencieux en cas d'échec) ;
- après « C'est noté », on **entre directement dans la soirée** — pas de retour
  à un écran d'inscription qu'on vient de remplir.

### 4.6 Écran D — J'ai oublié mon mot de passe

La connexion elle-même a déménagé à l'écran A : il ne reste ici que la seule
chose qui manque vraiment.

- **Trois champs** — identifiant, code de secours, nouveau mot de passe — qui
  appellent `api.joueur.secours()`. La route existe, la fonction cliente
  existe, **l'écran n'existe pas** : aujourd'hui, un mot de passe oublié est
  une impasse, et c'est d'autant plus gênant qu'on met maintenant la connexion
  en premier.
- **Le code de secours perdu aussi ?** On le dit sans détour : le profil est
  irrécupérable, et on repart en anonyme ou avec un nouveau profil. Pas
  d'adresse e-mail dans cette application, donc pas de lien de secours — c'est
  le prix de n'héberger aucune donnée personnelle, et il se dit franchement.
- **Réussi, on entre dans la soirée** comme après une connexion ordinaire.

### 4.7 Écran E — L'équipe

Inchangé. Il n'apparaît que si l'animateur a créé des équipes, et il est le
dernier écran avant la salle d'attente, pour tout le monde — profil ou pas.

### 4.8 Le plan d'ensemble

```
   scan du QR → /<espace>
        │
        ├─ jeton de cette soirée ────────────────────────────► salle d'attente
        │
        ├─ cookie de profil ─► [B′ Content de te revoir] ───────────────┐
        │                           └─ autre prénom ─► [B Moi] ─────────┤
        │                                                               │
        ├─ choix local ─────────────────────────► [B Moi] ──────────────┤
        │                                                               │
        └─ rien ─► [A L'ENTRÉE — connexion]                             │
                     ├─ Me connecter ───────────────────────────────────┤
                     ├─ Mot de passe oublié ─► [D Secours] ─────────────┤
                     ├─ Jouer sans compte ──► [B Moi] ──────────────────┤
                     └─ Créer un profil ───► [B Moi] ─► [C Sécuriser]   │
                                                            │           │
                                                       [C′ Le code] ────┤
                                                                        │
                            ┌───────────────────────────────────────────┘
                            ▼
                   [E Équipe]  (seulement si l'animateur en a créé)
                            │
                            ▼
                     salle d'attente
```

Deux choses à lire dans ce schéma : **toutes les branches finissent au même
endroit**, et **l'écran B est le point de passage commun** — c'est pour ça
qu'il ne bouge pas, et que le prénom et l'avatar ne se demandent jamais deux
fois.

---

## 5. Les homonymes

### 5.1 Pourquoi les deux réponses évidentes sont mauvaises

**Refuser le doublon** (« ce prénom est déjà pris ») : inacceptable. Une invitée
dans le noir se retrouve devant un refus qu'elle n'a pas provoqué, et surtout,
un profil reconnu serait refoulé de la soirée à cause du prénom de quelqu'un
d'autre. Un profil ne doit jamais coûter quoi que ce soit.

**Renommer d'office** (« Camille B. ») : il faudrait une initiale, donc un champ
de plus pour tout le monde, pour un cas qui touche deux personnes sur cinquante.
Et on ne renomme pas quelqu'un sans le lui dire.

La bonne réponse est ailleurs : **le prénom n'a pas besoin d'être unique.** Ce
qui doit être distinguable, c'est la **ligne affichée** — et une ligne, c'est un
avatar *et* un prénom. Deux Camille avec deux animaux différents ne posent aucun
problème : personne ne confond 🦊 Camille et 🐼 Camille. Le seul vrai cas, c'est
**le même prénom avec le même avatar**.

### 5.2 Trois couches, de la plus douce à la plus rare

**Couche 1 — on l'évite à l'inscription (99 % des cas).** À l'écran B, les
avatars portés par un invité du même prénom sont éteints. Vingt-quatre emojis
pour, au pire, trois Camille : ça passe toujours, et ça ne demande rien à
personne. Zéro message, zéro erreur, un geste qu'on faisait de toute façon.

**Couche 2 — on ne la demande jamais à un profil.** Alice entre avec son renard
Or sans qu'on lui pose la moindre question, même si un renard Camille est déjà
là. Un profil entre tel qu'il est. (Et comme sa finition dessine un anneau
autour de l'emoji dès le niveau 3, il est déjà visuellement distinct.)

**Couche 3 — on la désambiguïse à l'affichage (le reste).** Course entre deux
téléphones, profil qui arrive après un homonyme, deux profils jumeaux : quand la
paire (prénom, avatar) reste partagée, **l'application ajoute une marque**, sans
rien demander ni rien modifier. Le premier arrivé garde son prénom nu, les
suivants sont `Camille (2)`, `Camille (3)`.

### 5.3 La dérivation pure

Nouveau fichier `shared/homonymes.ts` :

```ts
/**
 * Les prénoms tels qu'on les affiche quand plusieurs invités se ressemblent.
 *
 * On ne renomme personne et on n'écrit rien en base : deux Camille restent
 * deux Camille. C'est seulement la ligne projetée qui gagne une marque, et
 * seulement quand l'avatar ne suffit plus à distinguer — un même prénom sur
 * deux animaux différents n'a jamais gêné personne.
 *
 * Pure et partagée : la soirée en cours et une soirée archivée passent par
 * elle, donc une amélioration profite aussi aux souvenirs déjà rangés.
 */
export function nomsAffiches(
  joueurs: readonly { id: string; name: string; avatar: string }[],
): Map<string, string>
```

- **L'entrée est dans l'ordre d'arrivée** (`Party.all()` trie déjà par
  `createdAt`) : la marque est donc stable, et elle ne bouge pas quand un
  troisième Camille arrive.
- **La clé de regroupement** est `(prénom sans accent ni casse, avatar)` —
  `sansAccent()` existe déjà dans `PlayerApp.tsx`, remonte-la dans ce fichier.
- **La table rendue ne contient que ce qui change.** Un invité unique n'y est
  pas : rien à recopier, rien à diffuser.

Le champ qui la transporte, dans `shared/types.ts` :

```ts
export interface PublicPlayer {
  // …
  /**
   * Le prénom à afficher quand un homonyme porte le même avatar. Absent —
   * pas égal au prénom — dans l'immense majorité des cas : l'instantané part
   * à toute la salle, il ne porte que ce qui est vraiment différent.
   */
  nomAffiche?: string
}
```

**Le calcul vit dans `Party`**, qui est le seul à tenir la liste entière — et
c'est important, parce que les prénoms sortent par **trois** portes, pas une :

- `Party.publicPlayers()` (`server/src/core/party.ts`) — l'instantané de la
  soirée en cours ;
- `Party.publicOne()` — la ligne d'un seul joueur, celle que le moteur envoie
  dans les vues de partie ;
- `ViewContext.playerName` (`server/src/core/engine.ts:65`,
  `id => this.deps.party.get(id)?.name`) — **celle qu'on oublie** : c'est elle
  qui écrit « le plus rapide : Camille » sur le vidéoprojecteur. Elle doit
  passer par la même dérivation, sinon l'écran commun appellera « Camille » une
  joueuse que le classement juste en dessous appelle « Camille (2) ».

Expose donc un `Party.nomAffiche(playerId): string` et fais-le servir aux trois.

Et pour les soirées rangées, le même entonnoir unique :

- `archivePlayers()` (`server/src/core/archive.ts`) — d'où découlent le
  souvenir, le bilan, les statistiques et l'export, gratuitement.

Côté client, chaque endroit qui affiche un prénom devient
`p.nomAffiche ?? p.name`. La liste, vérifiée fichier par fichier :

| Fichier | Ce qu'il affiche |
|---|---|
| `components/Leaderboard.tsx:34` | le classement de la soirée |
| `components/Podium.tsx:20,47` | le podium et les suivants |
| `components/StatsTable.tsx:88` | le tableau des chiffres (et son tri par prénom, l. 56 et 60) |
| `components/AwardsBoard.tsx:56` | les prix de fin de soirée |
| `components/Trophies.tsx:26,42,58` | L'Éclair, Le Régulier, les vainqueurs de quiz |
| `components/BilanQuestion.tsx:32` | **`playerName(ctx, id)`** — le point de passage du bilan, à corriger en un seul endroit |
| `components/BilanPlayer.tsx:66` | la fiche d'un invité |
| `games/quiz/HostView.tsx:162,203` | le plus rapide, les estimations sur l'écran commun |
| `views/HostApp.tsx:124-134` | la liste des invités de la console (et son bouton renommer) |
| `views/PlayerApp.tsx` | son propre en-tête — un invité doit lire sur **son** téléphone pourquoi il est « Camille (2) » |

`TeamBoard.tsx` n'affiche que des noms d'équipes : il n'a rien à faire ici.

### 5.4 Ce que l'animateur voit

Il a déjà `host:renamePlayer`. Il lui manque de **savoir** : dans la console,
une ligne discrète « 2 invités s'appellent Camille », avec le bouton renommer à
portée. C'est lui qui lit le classement à voix haute — c'est à lui qu'on donne
la main, pas à l'invitée.

### 5.5 Les cas limites, un par un

| Situation | Ce qui se passe |
|---|---|
| Camille 🦊 puis Camille 🐼 | rien. Deux lignes distinctes, deux prénoms nus. |
| Camille 🦊 puis Camille 🦊 | le 🦊 est éteint à l'écran B ; si ça passe quand même (course), la seconde est `Camille (2)`. |
| Alice (profil) 🦊 alors qu'un Camille… | aucun rapport : prénoms différents, rien à faire. |
| Alice (profil) 🦊 alors qu'une Alice 🦊 anonyme est déjà là | le profil entre sans question ; la marque tombe sur la dernière arrivée, donc sur le profil. Rare, et sa finition l'en distingue déjà. |
| Deux profils, même prénom, même emoji | même règle. Ils peuvent changer d'avatar depuis `/profil` s'ils veulent. |
| Un invité est exclu, un homonyme reste | la marque disparaît toute seule : c'est une dérivation, pas une donnée. |
| L'animateur renomme | idem, recalculé à l'instantané suivant. |
| Une soirée archivée | mêmes marques, par `archivePlayers()`. |

---

## 6. Ce que ça change dans le code

### 6.1 `shared/`

- **`shared/homonymes.ts`** (nouveau) : `nomsAffiches()`, `sansAccent()`. Pur,
  testable sans serveur.
- **`shared/types.ts`** : `PublicPlayer.nomAffiche?: string`.
- **`shared/events.ts`** : `name` et `avatar` deviennent **optionnels** dans la
  charge utile de `player:join`, et `JoinAck` rend l'identité retenue.

```ts
'player:join': (
  payload: {
    slug: string
    /** Absents = « prends ceux de mon profil ». Un anonyme, lui, doit les donner. */
    name?: string
    avatar?: string
    token?: string
    teamId?: string | null
  },
  ack: (res: JoinAck) => void,
) => void

export type JoinAck =
  | { ok: true; playerId: string; token: string; name: string; avatar: string; profile?: PublicProfile }
  | { ok: false; error: string }
```

Rendre `name` et `avatar` dans l'accusé n'est pas du confort : c'est le
téléphone d'Alice qui apprend ainsi sous quelle identité il est entré, pour la
retenir localement et survivre à une reconnexion.

### 6.2 `server/`

- **`sockets.ts`, `player:join`** : le profil est déjà résolu avant tout le
  reste (il peut demander la base permanente). Il suffit de compléter :

```ts
// Un profil reconnu n'a rien à retaper : son prénom et son avatar sont ceux
// qu'il a choisis une fois pour toutes. Ce que le téléphone envoie l'emporte
// quand même — on peut vouloir s'appeler autrement ce soir.
const name = payload?.name ?? profile?.name ?? ''
const avatar = payload?.avatar ?? profile?.avatar ?? ''
```

  Et rien d'autre : `Party.join()` garde sa signature, `cleanName` refuse
  toujours le vide (« Il faut un prénom ! » reste la bonne erreur pour un
  anonyme qui n'a rien tapé).
- **`core/party.ts`** : `publicPlayers()` applique `nomsAffiches()`.
- **`core/archive.ts`** : `archivePlayers()` fait de même.
- **`auth/profileRoutes.ts`** : sur identifiant pris, rendre
  `{ error, suggestion }` (premier `<login><n>` libre, n de 2 à 99).

Rien d'autre ne bouge côté serveur. En particulier **le barème, l'expérience,
les badges et l'éclat ne sont pas touchés** : ce chantier est une porte
d'entrée, pas une règle de jeu.

### 6.3 `client/`

- **`components/Entree.tsx`** (nouveau) : toute la machine d'entrée — les sept
  écrans de la §4, de la connexion à l'équipe. Elle ne connaît que
  l'instantané et rend la main au parent une fois l'invité inscrit.
  `PlayerApp.tsx` redevient ce qu'il doit être : la soirée, pas le portail.
- **`components/ProfilForm.tsx`** : se réduit à l'identifiant et au mot de
  passe (connexion, finalisation d'inscription, code de secours). Le prénom et
  l'avatar viennent toujours de l'écran B.
- **`state.ts`** : `Profile`/`profileKey` → `ChoixLocal`/`choixKey`, et on y
  retient aussi « ce téléphone a vu l'entrée ici ».
- **`styles.css`** : l'écran d'entrée et son séparateur « ou », l'écran de
  retrouvailles, l'état « avatar pris » (opacité + `aria-disabled`, jamais une
  croix rouge), et un bouton pleine largeur en contour s'il n'en existe pas
  déjà un.

Et une fois que ça tourne, **le dépôt doit dire la vérité** : `CLAUDE.md`
(« Ce qu'il ne faut pas faire » parle encore d'un écran de connexion à ne pas
ajouter — il faudra écrire la règle telle qu'elle est désormais : la connexion
est le premier écran, et passer est un bouton) et `README.md` (« Les profils
joueurs », qui décrit l'ancienne entrée).

---

## 7. Les textes, mot pour mot

Ils sont lus debout, dans le noir, par quelqu'un qui tient un verre. Courts,
en français, ils disent quoi faire.

| Où | Texte |
|---|---|
| Entrée, champs | Ton identifiant · Ton mot de passe |
| Entrée, bouton de connexion | **Me connecter** |
| Entrée, lien sous le bouton | J'ai oublié mon mot de passe |
| Entrée, séparateur | ou |
| Entrée, bouton pour passer | **Jouer sans compte** |
| Entrée, bouton de création | **Créer un profil** |
| Entrée, note sous les boutons | Un profil retient ton niveau et tes prix d'une soirée à l'autre. Il ne change rien aux points de ce soir. |
| Entrée, connexion refusée | Identifiant ou mot de passe incorrect — tu peux aussi jouer sans compte. |
| Secours, code perdu | Sans le code, le profil ne se retrouve pas. Tu peux jouer sans compte, ou en créer un neuf. |
| Retrouvailles | Content de te revoir, **Alice** |
| Retrouvailles, bouton | **Entrer dans la soirée** |
| Retrouvailles, liens | Jouer sous un autre prénom ce soir · Ce n'est pas moi |
| Homonyme, avatar libre | Il y a déjà un Camille — ton 🐼 vous distinguera. |
| Sécuriser, aide | Ton identifiant te servira à revenir. Au moins 8 caractères pour le mot de passe. |
| Sécuriser, identifiant pris | « camille » est déjà pris — essaie « camille2 ». |
| Sécuriser, sortie | Plus tard — je joue |
| Secours, titre | Note ce code de secours |
| Connexion, lien | J'ai oublié mon mot de passe |

Deux mots à ne **pas** employer : « inscription » (on est déjà inscrit à la
soirée) et « obligatoire ».

Et une nuance sur « compte » : le mot se dit très bien côté invité là où il est
le plus clair — « Jouer sans compte » est plus parlant que « Jouer sans
profil ». C'est **« Mon compte »** qui ne doit jamais apparaître sur un écran
d'invité : celui-là est l'espace de l'animateur, et la confusion serait
sérieuse.

---

## 8. Ce qu'il ne faut pas faire

- **La connexion n'est jamais obligatoire.** L'écran de connexion est bien le
  premier écran — c'est le choix assumé de ce chantier — mais « Jouer sans
  compte » est un bouton pleine largeur, du même format que « Me connecter »,
  visible sans défiler. Jamais un lien gris en bas de page, jamais un
  « continuer en tant qu'invité » écrit petit.
- **Ne pas ouvrir le clavier tout seul** en arrivant sur l'entrée : il
  pousserait hors de l'écran précisément ce qu'on doit voir.
- **Ne pas remontrer l'entrée** à quelqu'un qui a déjà choisi sur ce téléphone.
- **Ne pas renommer un invité sans le lui dire**, jamais, pas même « pour son
  bien ».
- **Ne pas écrire la marque d'homonyme en base.** C'est une dérivation. Elle
  doit disparaître d'elle-même quand l'homonyme s'en va.
- **Ne pas faire porter un avantage au profil**, ni un désavantage à l'anonyme :
  toujours l'absence, jamais l'infériorité.
- **Ne pas toucher aux barèmes** (`CHOICE_POINTS`, `XP`, `CHANCE_ECLAT`) ni aux
  paliers de finition.
- **Ne pas ajouter de dépendance** pour un composant d'interface.
- **Ne pas désactiver une assertion du smoke** pour la faire passer.
- **Ne pas mettre `nomAffiche` dans l'instantané quand il est égal au prénom** :
  l'instantané part à toute la salle.

---

## 9. Comment on saura que c'est bon

### `npm run verify` passe

C'est la condition d'entrée, pas la preuve.

### Le smoke, section 34 — **à la fin du fichier, sur son propre serveur jetable**

`server/scripts/smoke.ts` est **stateful de bout en bout** : une soirée jouée
insérée au milieu casse les assertions d'après. Les sections 32 et 33 montrent
le motif à recopier.

1. Un profil rejoint **sans envoyer `name` ni `avatar`** → inscrit sous le
   prénom et l'avatar de son profil, et l'accusé les rend.
2. Un anonyme sans prénom → refusé, « Il faut un prénom ! ».
3. Un profil qui envoie un autre prénom → c'est le sien du soir qui s'applique,
   et le profil en base n'a pas bougé.
4. Deux invités « Camille » avec des avatars différents → **aucun**
   `nomAffiche` dans l'instantané.
5. Deux invités « Camille » avec le même avatar → le second est
   `Camille (2)`, le premier reste nu.
6. **Le même prénom dans la vue de l'écran commun** (« le plus rapide : … »,
   qui passe par `ViewContext.playerName`, pas par l'instantané) → même marque
   que le classement. C'est l'assertion qui rattrape l'oubli le plus probable.
7. Idem avec « camille » / « Camille » / « Camillé » → même groupe.
8. Le troisième homonyme identique → `Camille (3)`.
9. L'exclusion du premier → le `(2)` **disparaît** (dérivation, pas donnée).
10. Une soirée rangée puis relue par le souvenir → mêmes marques.
11. Un identifiant déjà pris → 400, avec `suggestion` utilisable.
12. Créer un profil **en cours de soirée** → le joueur déjà inscrit est
    rattaché, son score est intact, il n'y a pas de doublon, et son prénom du
    soir n'a pas changé.
13. Un invité anonyme traverse tout ça sans porter ni `profile`, ni `niveau`,
    ni `finition`, ni `nomAffiche`.

### À l'œil — obligatoire

> Trois bugs de cette base n'étaient visibles qu'à l'écran, pas au typecheck.

Chromium et Playwright sont là. À regarder, en 390 × 844 :

- **l'entrée, en 360 × 640** (le petit téléphone du fond de la salle), clavier
  fermé : « Jouer sans compte » est-il visible **sans défiler** ? C'est le test
  qui décide si cet écran est une entrée ou un péage — le seul de la liste qui
  peut renvoyer la maquette à la planche à dessin ;
- l'entrée, clavier ouvert après avoir touché un champ : peut-on encore
  atteindre le bouton pour passer, en refermant le clavier ou en défilant d'un
  pouce ?
- l'écran de retrouvailles : l'avatar est-il assez gros pour qu'Alice se
  reconnaisse en une demi-seconde ?
- la grille d'avatars avec trois emojis éteints : est-ce lisible, ou est-ce que
  ça ressemble à une panne ?
- le classement du vidéoprojecteur avec `Camille` et `Camille (2)` : lisible à
  cinq mètres ?
- **et en 1920 × 1080, sur fond sombre** : c'est là que ça se joue vraiment.

---

## 10. Les décisions de produit

Ce sont des choix de produit, pas des choix techniques : ils se tranchent avec
l'auteur, pas dans le code.

**Tranchées, et à traiter comme acquises :**

- ✅ **L'entrée est un écran de connexion.** Identifiant et mot de passe en
  premier, avant le prénom et l'avatar — avec « Jouer sans compte » en bouton
  pleine largeur juste en dessous. C'est ce qui règle d'un coup le prénom,
  l'avatar et la progression de tous ceux qui reviennent.
- ✅ **La marque des homonymes est `Camille (2)`.** Honnête, comprise de tous,
  lisible de loin, et dérivée — jamais écrite en base. Les autres pistes sont
  écartées : demander une initiale fait travailler l'invité, et le nom de
  l'équipe est absent la moitié du temps.

**Restent à confirmer :**

1. **Quand remontrer l'écran de connexion.** Proposition : une fois par espace
   et par téléphone — quelqu'un qui a déjà dit « sans compte » chez Romane n'a
   pas à le redire à la soirée suivante de Romane. Les variantes : à chaque
   nouvelle soirée (plus insistant, plus de profils créés), ou une fois pour
   toutes tous espaces confondus (plus discret, mais on ne repropose jamais
   rien).
2. **La proposition d'identifiant libre.** Proposition : oui, avec le compromis
   d'énumération assumé et écrit (§4.4). Sinon : un refus sec, et l'invitée non
   technique se débrouille.

---

## 11. Hors sujet pour cette fois

Notés pour ne pas les oublier, et **pas** à faire dans ce chantier : fusionner
deux profils créés par erreur par la même personne ; laisser l'animateur
pré-inscrire ses invités ; un avatar photo ; connexion par lien magique ;
choisir sa finition depuis l'écran d'entrée.
