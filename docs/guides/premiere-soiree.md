# Ta première soirée, en local

> De zéro à un quiz joué avec de vrais téléphones, sur ton ordinateur et le wifi de la maison — un quart d'heure environ. Pour qui découvre FiestApp et sait ouvrir un terminal. Pour que tes invités jouent en 4G, sans ton wifi, il faudra ensuite [la mettre en ligne](../exploitation/mise-en-ligne.md).

## Ce qu'il te faut

- Un ordinateur avec **Node.js 20 ou plus** et npm (`node --version` te le dit), et git.
- **Un téléphone branché sur le même wifi** que l'ordinateur. Deux, c'est mieux : un quiz se joue à plusieurs, et une soirée jouée seul ne rapporte rien. Faute de second téléphone, un invité fantôme fera l'affaire (étape 5).
- Un écran pour la salle : celui de l'ordinateur suffit pour essayer ; une télé ou un vidéoprojecteur branché dessus, c'est la vraie soirée.

Rien d'autre : ni compte à créer, ni base de données à installer. Chez toi, les deux bases de FiestApp sont des fichiers que le serveur crée lui-même.

## 1. Récupère le code et installe-le

```bash
git clone https://github.com/Maxilyas/FiestApp.git
cd FiestApp
npm install
```

`npm install` installe les deux parties de l'application : le serveur (`server/`) et la page que verront les écrans (`client/`).

**Vérifie** : la commande se termine sans erreur.

## 2. Lance l'application

```bash
npm run dev
```

Deux programmes démarrent ensemble : le serveur, sur le port 3001, et Vite, qui sert la page sur le port 5173 et la recharge à chaque retouche du code.

Au tout premier démarrage, le serveur crée ses deux bases dans `server/data/`, le compte de l'administrateur — identifiant `antoine`, mot de passe `demo`, son espace `demo` — et range deux quiz dans sa bibliothèque : « 🌍 Culture générale » et « ⭐ Qui connaît le mieux [Prénom] ? ».

**Vérifie** : le terminal écrit « 🎉 FiestApp — serveur prêt sur http://localhost:3001 », et `http://localhost:5173` ouvre l'accueil de FiestApp et ses trois gros boutons, « Jouer sans compte » en tête.

> [!TIP]
> Pour un autre compte que `antoine` / `demo`, pose `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SLUG` et `ADMIN_NAME` avant le tout premier démarrage ([la configuration](../reference/configuration.md)) ; ensuite, elles ne servent plus. Le mot de passe `demo` n'a de sens que chez toi : en ligne, le serveur refuse de créer le compte avec.

## 3. Ouvre l'écran commun

Sur l'ordinateur, ouvre `http://localhost:5173/host` : c'est l'écran que la salle regardera. Il demande l'animateur — « Identifiant » `antoine`, « Mot de passe » `demo` —, puis « Entrer ».

**Vérifie** : la salle d'attente paraît, avec le code du salon — six chiffres, tirés à l'ouverture de l'écran —, son QR, et l'adresse que les invités ouvriront : `http://<l'adresse de ton ordinateur>:3001/<le code>`, qui mène à l'espace `demo`. Son bouton, grisé, dit « En attente des invités… ».

> [!TIP]
> Lance le serveur avec le nom et le mot de passe de ton wifi — sous macOS ou Linux, `WIFI_SSID="MaBox" WIFI_PASS="…" npm run dev` — et l'écran commun montre deux QR : « 1 · Wi-Fi », qui fait rejoindre ton réseau d'un geste, puis « 2 · Le quiz ».

## 4. Évite le piège du QR

Le QR ne mène pas à Vite (5173) mais **au serveur** (3001) : c'est l'adresse qui marchera aussi en ligne, quand le serveur servira tout. Or le serveur ne sert que la page **construite** (`client/dist/`), et `npm run dev` ne construit rien : un téléphone qui scanne maintenant n'obtient qu'une erreur.

Construis la page une fois, puis relance — le serveur ne regarde `client/dist/` qu'à son démarrage :

```bash
# Ctrl+C arrête npm run dev, puis :
npm run build -w client
npm run dev
```

**Vérifie** : sur l'ordinateur, `http://localhost:3001/demo` ouvre l'entrée de la soirée, ses trois gros boutons ; l'adresse du code y mène aussi.

Les téléphones voient désormais la page telle qu'elle était au moment du build : après une retouche du client, reconstruis et relance. Pour suivre tes retouches au fil de l'eau sur un téléphone, ouvre plutôt à la main `http://<l'adresse de ton ordinateur>:5173/demo` — Vite écoute aussi sur le réseau. Et sans développer, `npm run build` puis `npm start` servent tout par le port 3001, sans Vite.

**Sous Windows**, le pare-feu refuse d'abord ce qui arrive du réseau : accepte quand il propose d'autoriser Node.js sur un réseau privé, ou ouvre les deux ports une fois pour toutes, dans un PowerShell administrateur :

```powershell
New-NetFirewallRule -DisplayName "FiestApp" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

## 5. Rejoins la soirée depuis un téléphone

Sur le téléphone, scanne le QR de l'écran commun — l'appareil photo suffit, rien à installer —, puis :

1. « Jouer sans compte » ;
2. ton prénom, et un avatar ;
3. « Rejoindre la soirée ».

**Vérifie** : le téléphone montre la salle d'attente, ton prénom et ton avatar paraissent sur l'écran commun, et son bouton devient « Lancer un quiz ».

Pas de second téléphone ? Un invité fantôme rejoint la soirée et répond au hasard, depuis un second terminal :

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Robot 600
```

Il reste dix minutes (600 s) dans l'espace `demo`, sous l'avatar 📱.

Tout se joue sans compte. Un profil (« Créer un profil ») garde d'une soirée à l'autre l'expérience, les trophées et les avatars gagnés, mais ne donne aucun avantage de jeu.

## 6. Lance un quiz et joue

Sur l'écran commun :

1. **« Lancer un quiz »** ouvre « Choisis un quiz » : ta bibliothèque, et « Un quiz tout prêt » pour en composer un sur-le-champ, tiré de la base de questions de l'application — catégories, difficulté, nombre de questions.
2. Sur la carte « 🌍 Culture générale », **« C'est parti ! »**. Au-dessus, « Ce quiz vaut » le fait compter double ou triple.
3. **« Préparez vos téléphones… »** : trois secondes, puis la première question, à l'écran commun et sur chaque téléphone.

Puis :

- chacun répond sur son téléphone ; plus vite, plus de points ([les barèmes](../reference/baremes.md)) ;
- la question se révèle d'elle-même quand tout le monde a répondu ou que le temps est écoulé ; **« Révéler »** n'attend pas ;
- **« Question suivante »**, puis, après la dernière, **« Voir le podium »** ;
- au podium, **« Quiz suivant »** en lance un autre, **« Terminer le quiz »** ramène à la salle d'attente.

**Vérifie** : chaque téléphone a vu ses points à chaque révélation, et le podium nomme les meilleurs.

## 7. Clos la soirée

De retour en salle d'attente, **« Clore la soirée »** ouvre un choix :

- **« Clore la soirée »** la range dans l'historique sous le nom proposé — tu peux le changer —, et chaque téléphone reçoit sa fin de soirée : son rang, ses points, ses nouveaux trophées et, avec un profil, ce qu'il gagne. La suivante part de zéro.
- **« C'était un essai »**, puis « Tout effacer », l'efface sans rien garder : ni la soirée, ni l'expérience, ni les prix de ses invités. Les téléphones repassent par l'entrée.

**Vérifie** : après une clôture, `http://localhost:5173/demo/soirees` liste ta soirée, et `http://localhost:5173/demo/souvenir` en montre le podium et les chiffres.

## Si ça coince

| Ce que tu vois | Ce qui se passe | Que faire |
|---|---|---|
| Le téléphone n'obtient qu'une erreur en scannant | La page n'est pas construite : le serveur n'a rien à servir | L'étape 4 |
| Le téléphone attend sans fin | Il n'est pas sur le même wifi, le pare-feu de l'ordinateur refuse, ou le réseau isole ses appareils (un wifi d'invités) | Le même wifi, le pare-feu (étape 4), un autre réseau |
| « En attente des invités… » reste grisé | Aucun invité n'est connecté | L'étape 5 |
| L'écran commun refuse `antoine` / `demo` | Le compte a été créé, au premier démarrage, avec d'autres variables | Repars de zéro (ci-dessous) |
| Le port 3001 est déjà pris | Un autre programme l'écoute | Arrête-le : en développement, Vite relaie toujours vers le port 3001 |

**Repartir de zéro** : arrête le serveur et efface le dossier `server/data/`. Au démarrage suivant, tout est recréé — les bases, le compte, les deux quiz.

## Pour aller plus loin

- [Animer une soirée](animer-une-soiree.md) — avant, le jour J, pendant : la console et les imprévus
- [Jouer](jouer.md) — ce que vit un invité, de l'entrée à sa fin de soirée
- [Une soirée de bout en bout](../produit/la-soiree.md) — ce que fait FiestApp, sans le code
- [Mettre en ligne](../exploitation/mise-en-ligne.md) — pour que les invités jouent en 4G
- [Démarrer dans le code](../contribuer/demarrer.md) — pour le modifier
