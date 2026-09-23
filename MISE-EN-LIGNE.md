# Mise en ligne — mode d'emploi

Tout ce qu'il faut pour mettre l'application en ligne, l'animer, et en faire profiter des amis. Rien de ce qui suit ne coûte d'argent, et aucune carte bancaire n'est demandée.

---

## 1. Les trois sites (+ GitHub)

| Site | À quoi il sert | Carte bancaire | Compte à créer |
|---|---|---|---|
| [github.com](https://github.com) | héberge le code ; Render y lit le dépôt `Maxilyas/FiestApp` | non | déjà fait |
| [turso.tech](https://turso.tech) | la base qui garde tes quiz, tes comptes et tes soirées **pour toujours** | non | oui |
| [render.com](https://render.com) | le serveur qui fait tourner le jeu | non | oui |

---

## 2. À noter quelque part (tu en auras besoin plusieurs fois)

Garde ces valeurs sous la main — un fichier texte, un gestionnaire de mots de passe, ce que tu veux. **Ne les mets pas dans le dépôt.**

| Quoi | Où tu l'obtiens | Exemple |
|---|---|---|
| URL Turso | page de ta base Turso | `libsql://quizz-romane-xxx.turso.io` |
| Jeton Turso | bouton de création de token, **affiché une seule fois** | `eyJhbGciOi…` |
| Identifiant administrateur (`ADMIN_LOGIN`) | tu le choisis | `antoine` |
| Mot de passe d'amorçage (`ADMIN_PASSWORD`) | tu l'inventes ; il ne sert qu'au premier démarrage | `salsa2026!` |
| Nom de ton espace (`ADMIN_SLUG`) | tu le choisis : minuscules, chiffres, tirets | `romane` |
| Adresse publique | donnée par Render après le déploiement | `https://quizz-romane-30.onrender.com` |
| Adresse des invités | l'adresse publique + `/` + ton espace — c'est le QR | `https://quizz-romane-30.onrender.com/romane` |
| Adresse de l'écran commun | l'adresse publique + `/host`, une fois connecté | |

⚠️ **Le mot de passe d'amorçage ne sert qu'une fois.** Au premier démarrage, sur une base encore vide, le serveur crée ton compte avec ; ensuite il ne le relit plus. Connecte-toi, change-le depuis **Mon compte**, puis retire `ADMIN_PASSWORD` des variables de Render : les démarrages suivants s'en passent — et sur l'offre gratuite, chaque réveil en est un. Pas avant que cette version tourne sur le service, en revanche : les précédentes refusaient de démarrer sans. Choisis autre chose que `romane` : en ligne, tant que la base n'a aucun compte, le serveur refuse de démarrer sans mot de passe ou avec celui par défaut. Rien ne passe jamais par la barre d'adresse : tu peux projeter l'écran commun sans crainte.

---

## 3. Le déploiement, dans l'ordre

### Étape 1 — Pousser le code sur GitHub

Render déploie depuis GitHub, pas depuis ton PC.

```bash
git push
```

### Étape 2 — Créer la base Turso

Sur [turso.tech](https://turso.tech) : crée un compte (connexion GitHub possible), puis une base — nomme-la `quizz-romane`, emplacement en Europe. Sur sa page, récupère **l'URL** (`libsql://…`) et crée un **jeton**.

En ligne de commande si tu préfères :

```bash
turso db create quizz-romane
```

```bash
turso db show quizz-romane --url
```

```bash
turso db tokens create quizz-romane
```

### Étape 3 — Déployer sur Render

Sur [render.com](https://render.com) : crée un compte, puis **New → Blueprint**, connecte le dépôt `Maxilyas/FiestApp`. Render lit `render.yaml` et te demande les valeurs :

| Variable | Ce que tu mets |
|---|---|
| `ADMIN_LOGIN` | ton identifiant |
| `ADMIN_PASSWORD` | ton mot de passe d'amorçage |
| `ADMIN_SLUG` | le nom de ton espace (`romane`) |
| `QUIZ_DB_URL` | l'URL Turso de l'étape 2 — sans elle, le serveur refuse de démarrer : le disque de Render s'efface à chaque réveil, et tout ce qui y serait écrit disparaîtrait |
| `QUIZ_DB_TOKEN` | le jeton de l'étape 2 |

Le blueprint règle aussi les deux commandes du service. Si tu le crées à la main (**New → Web Service**), recopie-les depuis `render.yaml` :

| Réglage | Valeur |
|---|---|
| Build Command | `npm ci && npm run build` |
| Start Command | `cd server && exec node --import tsx src/index.ts` |

Surtout pas `npm start` : npm garde pour lui le signal d'arrêt de Render, et l'arrêt propre — celui qui recopie les dernières réponses dans Turso avant de s'éteindre — ne s'exécute jamais.

Deux à trois minutes de construction, et Render t'affiche ton adresse publique. Au premier démarrage, le serveur crée ton compte et, si la base contenait déjà des quiz ou des soirées d'avant les comptes, il te les rattache — regarde le journal : « administrateur créé », « lignes d'avant les comptes rattachées ». L'adresse apparaîtra automatiquement dans le QR code, suivie du nom de ton espace — rien à configurer de plus.

**Ensuite, tout de suite :** ouvre `https://TON-ADRESSE.onrender.com/connexion`, connecte-toi, va dans **Mon compte**, change ton mot de passe, puis retire `ADMIN_PASSWORD` des variables de Render. Le redémarrage qui suit se fait très bien sans.

### Étape 4 — Transférer tes quiz vers Turso

Une fois le serveur démarré en ligne (c'est lui qui crée ton compte, et les quiz vont dans ton espace) :

```bash
npm run migrate -- --to libsql://TON-URL.turso.io --token TON-JETON
```

Ça copie **tout** ce que contient ta bibliothèque locale : quiz terminés, brouillons, photos. Fais le ménage dans `/edit` avant si nécessaire. Les deux quiz d'exemple, s'ils traînent encore en ligne, se suppriment dans `/edit`.

La commande se relance autant de fois que tu veux : un quiz déjà en ligne est mis à jour, un nouveau est ajouté. Elle n'efface jamais rien à destination.

### Étape 5 — Savoir que le serveur dort, et le réveiller à la main

Sans trafic pendant 15 minutes, l'offre gratuite de Render endort le serveur, et le réveil prend environ une minute. **Ce n'est pas un problème, à condition de le savoir** : il suffit d'ouvrir l'adresse publique **cinq minutes avant** l'arrivée des invités.

Ensuite, la veille ne menace plus la soirée : tant qu'un écran commun ou un téléphone est connecté, le trafic des websockets tient le serveur éveillé. La seule fenêtre de risque est le tout premier scan, et c'est précisément celle que ce geste couvre.

Mets-le dans ta routine du soir J (section 6) — c'est la seule chose à ne pas oublier.

> Un service de ping extérieur (cron-job.org, UptimeRobot…) appelant `/healthz` toutes les dix minutes ferait le même travail sans y penser. Ce dépôt ne s'en sert pas : avec **deux services gratuits** (production et préproduction), les 750 heures mensuelles de l'offre ne suffisent de toute façon pas à en garder deux allumés en permanence. Laisser dormir les deux est le choix cohérent.

### Étape 6 — Vérifier pour de vrai

Ouvre l'écran commun, puis **scanne le QR avec ton téléphone en 4G, wifi coupé**. C'est le seul test qui prouve que le soir J fonctionnera.

```bash
ADMIN_LOGIN=antoine ADMIN_PASSWORD=ton-mot-de-passe npm run load -- https://TON-ADRESSE.onrender.com 20 --slug romane
```

Simule 20 invités sur le serveur en ligne et mesure les temps de réponse réels.

⚠️ **Ne lance jamais ce test contre la base Turso de production.** Ses vingt invités s'inscrivent pour de vrai dans la soirée de ton espace, et il y joue un quiz entier : c'est la vraie soirée qu'il remplit — classement, miroir, et l'archive que « Nouvelle soirée » en fera. Vise la préproduction, ou reste en local sur fichier. Pour mesurer la production sans y inscrire personne, `--sonde` ne fait que connecter les téléphones.

### Étape 7 — La préproduction

Le développement local ne peut pas éprouver six choses, et ce sont celles qui mordent : le miroir Turso avec sa vraie latence, le disque effacé au redémarrage, le réveil après veille, les cookies `Secure`, l'adresse du client derrière le proxy, et la politique de sécurité du contenu en conditions réelles. Pour cette dernière, ouvre la console du navigateur (F12) sur l'écran commun comme sur un téléphone : la politique ne laisse le temps réel parler qu'à l'hôte de la page — en `wss://` derrière le proxy de Render —, et aucune violation de `connect-src` ne doit s'y lire.

Une soirée est un coup unique — on ne débogue pas pendant la fête. D'où un second service, identique au premier, sur sa propre base.

**Ce que ça donne :**

```
                   déploiement automatique       déploiement MANUEL
  main  ───────────────────────────────►  PRÉPROD  ─────────────►  PRODUCTION
                                 fiestapp-quizz-preprod       fiestapp-quizz
                                            │                        │
                                   Turso fiestapp-preprod    Turso quizz-romane
```

**Pour la créer :**

1. **Une seconde base Turso**, à côté de la première : `quizz-preprod`. Récupère son URL et crée-lui un jeton. Turso sait aussi dupliquer une base existante, si tu veux éprouver une migration sur de vraies données — sache seulement que ça copie aussi les comptes.
2. **Crée le service**, et lis d'abord l'encadré ci-dessous : la façon de s'y prendre dépend de qui a créé la production.
3. **Renseigne ses variables** dans l'interface Render : `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` vers la base de **préproduction**, et un `ADMIN_PASSWORD` **différent** de celui de la production. `APP_ENV=preprod` est déjà dans le fichier.

> ⚠️ **Ne crée pas un second Blueprint.** Render n'adopte pas un service qu'il n'a pas créé lui-même depuis CE blueprint : il en fabrique une copie, et comme le nom est déjà pris, il y colle un suffixe au hasard — `quizz-romane-30-ljwa`, `fiestapp-preprod-ljwa`, sous les noms d'alors. Les deux copies portent le même suffixe, signe qu'une seule synchronisation les a créées ; les vraies, elles, n'ont pas bougé.
>
> C'est arrivé. Ce qu'il faut savoir pour s'en sortir :
>
> - **Supprime les copies, et le blueprint qui les a créées** — sinon la synchronisation suivante les refait.
> - **Ce qui décide du service à garder, c'est l'adresse déjà partagée — et elle ne tient pas au nom.** L'adresse `onrender.com` d'un service se fixe à sa création : le renommer ne la change pas, mais une copie suffixée, ou un service recréé, en reçoit une autre. `jour-j/qr-tables-*.pdf` encodent `https://quizz-romane-30.onrender.com` : tant qu'un QR imprimé ou un lien circule, garde le service qui répond à cette adresse — renomme-le si tu veux, ne le recrée pas.
> - **Le service, lui, est jetable.** Tout le précieux vit dans Turso ; en supprimer un et le recréer ne perd rien tant que `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` repointent sur la même base. La seule chose à ne jamais supprimer, c'est la base Turso.
> - **Regarde `QUIZ_DB_URL` des copies avant de les supprimer.** Si l'une pointe vers la base Turso de production, elle a pu y écrire : c'est la seule chose vraiment fâcheuse ici. Si le formulaire du blueprint a été passé sans rien remplir, elles n'ont même pas démarré — le serveur refuse de se lancer en ligne sans `QUIZ_DB_URL`, et leur journal dit « ❌ QUIZ_DB_URL manquant ». Rien n'a alors été touché.
> - **Sans blueprint, `render.yaml` est de la documentation.** Les deux services se règlent alors chacun sur son tableau de bord : déploiement automatique **activé** en préproduction, **désactivé** en production (*Settings → Auto-Deploy*), les variables saisies à la main, et les deux commandes recopiées dans *Settings* — `npm ci && npm run build` dans **Build Command** (rubrique *Build*), `cd server && exec node --import tsx src/index.ts` dans **Start Command** (rubrique *Deploy*). Change-les d'abord sur la préproduction : un déploiement, un réveil, une partie ; la production ensuite. Le fichier reste la référence de ce qu'ils doivent contenir.

> 🚨 **La règle absolue : jamais la même base Turso pour les deux.** Un « Nouvelle soirée » ou une suppression de compte en préproduction effacerait de vraies soirées archivées — c'est le seul geste sans retour de l'application. Pour qu'on ne s'y trompe jamais, la préproduction affiche un **bandeau rouge « PREPROD »** en bas à gauche de toutes ses pages, et le préfixe dans l'onglet du navigateur.

**Promouvoir en production.** La production ne se déploie pas toute seule : sur son tableau de bord Render, **Manual Deploy → Deploy latest commit**. On regarde la préproduction tourner, puis on promeut — la veille de la fête, pas le soir même.

**Et le dormir ?** Les deux services s'endorment après quinze minutes sans trafic. C'est assumé : les 750 heures mensuelles de l'offre gratuite ne suffiraient pas à en garder deux éveillés. On réveille celui dont on a besoin en ouvrant son adresse, cinq minutes avant (voir l'étape 5).

---

## 4. Créer un compte à un ami

L'application sert plusieurs soirées : chaque ami a son compte, son espace et son adresse, et ne voit rien des tiens.

1. Sur `https://TON-ADRESSE.onrender.com/admin` (toi seul y as accès), remplis **Créer un compte** : son prénom, son identifiant de connexion, le nom de son espace dans l'adresse (`chez-bob`). L'adresse de ses invités s'affiche au fur et à mesure.
2. L'application te donne un **lien d'activation**. Envoie-le-lui comme tu veux (message, mail…). Il vaut **sept jours** et ne sert **qu'une fois**.
3. Il ouvre le lien, choisit son mot de passe, et arrive sur **Mon compte** : le titre de sa soirée, l'adresse de ses invités à copier, ses réglages. Il écrit ses quiz dans **Mes quiz**, anime depuis **Écran commun**, retrouve ses soirées passées sur `/chez-bob/soirees`.

**Mot de passe oublié :** il n'y a pas d'e-mail. Sur `/admin`, le bouton **Lien** de son compte refait un lien d'activation ; il choisit un nouveau mot de passe en l'ouvrant. Ses anciens liens ne valent plus rien.

**Désactiver un compte** ferme ses sessions et ses écrans communs sur-le-champ ; ses quiz et ses soirées restent, et ses pages publiques restent lisibles. **Réactiver** rouvre la porte ; il se reconnecte avec son mot de passe.

**Supprimer un compte** — le bouton n'apparaît qu'une fois le compte désactivé — efface tout ce qu'il a laissé : quiz, photos, soirées archivées, soirée en cours, sauvegarde distante comprise, et libère son identifiant et son adresse. Sans retour : exporte ses soirées avant si tu veux les garder (`npm run export -- https://TON-ADRESSE.onrender.com --slug chez-bob`). Ton propre compte ne se supprime pas.

Tu ne vois ni les quiz ni les soirées des autres : seulement la liste des comptes.

---

## 5. Toutes les commandes

### Écrire et tester chez toi

```bash
npm install
```

```bash
npm run dev
```

| Page | Adresse en local |
|---|---|
| Jeu (téléphone) | http://localhost:5173/romane |
| Écran commun | http://localhost:5173/host |
| Mes quiz | http://localhost:5173/edit |
| Mon compte | http://localhost:5173/compte |
| Les comptes | http://localhost:5173/admin |

En local, le compte est `antoine` / `romane` et l'espace `romane` (sauf si tu définis `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SLUG`, `ADMIN_NAME` avant le premier démarrage). En ligne, c'est le tien.

### Vérifier que rien n'est cassé

```bash
npm run check
```

```bash
npm test
```

```bash
npm run smoke
```

`check` contrôle le code ; `test` lance les tests ciblés de `server/test/` — base distante en panne, clics qui se croisent, messages malformés, réveils sur disque effacé —, chaque fichier sur son propre serveur jetable quand il lui en faut un ; `smoke` rejoue une soirée entière (comptes et leur suppression, isolation des espaces, inscription, quiz, scores, reconnexion, bibliothèque, photos, estimation, retardataire, historique, mise à jour d'une base d'avant les comptes). `npm run verify` enchaîne les trois, construction du client comprise : c'est ce que refait l'intégration continue à chaque proposition de modification.

### Simuler des invités

```bash
node server/scripts/fake-player.mjs http://localhost:3001 Testeur 300 --slug romane
```

Un invité fantôme qui répond au hasard pendant 300 secondes. Lance la commande plusieurs fois pour en avoir plusieurs.

```bash
npm run load -- http://localhost:3001 50 --slug romane
```

Test de charge complet : 50 invités, un quiz joué de bout en bout, et les temps mesurés. Le script se connecte comme l'animateur : `ADMIN_LOGIN` / `ADMIN_PASSWORD` s'ils ne sont pas ceux par défaut.

### Transférer les quiz

```bash
npm run migrate -- --to libsql://TON-URL.turso.io --token TON-JETON
```

Vers un autre espace que le tien : ajoute `--slug chez-bob`. Tes quiz restent à toi : si tu les as déjà transférés chez toi, Bob en reçoit des copies, photos comprises, et relancer la commande met ses copies à jour sans en créer d'autres.

### Exporter la soirée (le lendemain)

```bash
npm run export -- https://TON-ADRESSE.onrender.com --slug romane
```

Écrit dans `export/romane/` le bilan complet (`bilan.json`) et trois fichiers Excel : une ligne par invité avec une colonne par question, une ligne par question, une ligne par équipe. Si le serveur ne répond plus : `npm run export -- --db libsql://TON-URL.turso.io --token TON-JETON --slug romane`.

### Sauvegarder la base permanente

Tout le précieux tient dans une seule base Turso : comptes, quiz, photos, soirées archivées, profils. Une fausse manœuvre — un « Nouvelle soirée » sur la mauvaise base, un compte supprimé — et c'est sans retour. D'où une copie chez toi, à faire **la veille de chaque fête et le lendemain** :

```bash
npm run sauvegarde -- libsql://TON-URL.turso.io --token TON-JETON
```

Écrit dans `export/sauvegardes/` un fichier SQL daté (`quizz-romane-xxx-2026-09-19-231502.sql`) : toutes les tables, chaque ligne, les photos comprises. Il contient les comptes — mots de passe hachés, mais tout de même : garde-le comme un secret, jamais dans le dépôt (`export/` est ignoré par git). Lance-la hors soirée : elle lit la base table après table, pas d'un seul instantané.

**Restaurer**, toujours dans une base **neuve**, jamais par-dessus l'ancienne :

```bash
turso db create quizz-restauree
```

```bash
turso db shell quizz-restauree < export/sauvegardes/quizz-romane-xxx-2026-09-19-231502.sql
```

Puis crée-lui un jeton, et pointe `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` du service dessus. Sans Turso, `sqlite3 restauree.db < export/sauvegardes/….sql` en fait un fichier qu'un PC sert tel quel (`QUIZ_DB_URL=file:` suivi de son chemin complet). Ces deux commandes se tapent dans un terminal bash — WSL ou Git Bash sous Windows : PowerShell ne connaît pas `<`.

**Turso garde aussi un historique**, sans fichier à faire : il sait recréer la base telle qu'elle était à un instant donné, dans une base neuve.

```bash
turso db create quizz-restauree --from-db quizz-romane --timestamp 2026-09-19T22:00:00+02:00
```

Jusqu'où il remonte dépend du forfait : relève-le sur [turso.tech/pricing](https://turso.tech/pricing), ligne « Point-in-Time Recovery ». Au-delà de cette fenêtre, il ne reste que les fichiers de `npm run sauvegarde`.

### Repli : tout faire tourner sur ton PC

Si la salle ne capte pas ou si l'hébergeur fait des siennes.

```bash
npm run build
```

```bash
npm start
```

Tout est alors servi sur `http://IP-DE-TON-PC:3001` (l'adresse s'affiche au démarrage ; les invités ouvrent `http://IP-DE-TON-PC:3001/romane`). Les téléphones doivent être sur le **même wifi**. À faire une seule fois, dans un PowerShell **administrateur** :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Avec un routeur wifi sans internet, renseigne `WIFI_SSID` et `WIFI_PASS` : l'écran commun affiche alors deux QR codes (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

En HTTP, les téléphones ne savent pas garder leur écran allumé tout seuls — il y faut HTTPS : un bandeau « Garde ton écran allumé pendant le quiz » le demande aux invités. Rappelle-le à voix haute avant le premier quiz : un téléphone qui s'endort en pleine question la rate.

---

## 6. Le soir J

1. **La veille** : ouvre l'adresse publique pour confirmer que tout répond (elle mettra une minute : le serveur dormait). Dans **Mon compte**, vérifie le titre de la soirée et la date : ce sont eux que voient les invités.
2. **5 minutes avant — le geste à ne pas oublier** : connecte-toi et ouvre l'écran commun sur le vidéoprojecteur. C'est lui qui réveille le serveur, et tant qu'un écran est connecté il ne se rendort pas. Sans ça, le premier invité qui scanne attend une minute devant une page blanche.
3. Vérifie le bouton 🔊 en haut de l'écran commun (les sons ne sortent que de là, jamais des téléphones).
4. Les invités scannent le QR de l'écran commun — il mène à `/romane` — : « Me connecter » pour qui a un profil, « Jouer sans compte » pour les autres, puis un prénom et un avatar. Les QR imprimés des tables (`jour-j/qr-tables-*.pdf`) mènent, eux, à la racine, l'accueil : on y touche « Rejoindre une soirée », puis on tape `romane`.
5. **Lancer un quiz** → choisis **points normaux, ×2 ou ×3**, puis le quiz → le 3-2-1 démarre. Annonce le multiplicateur à la salle : c'est ce qui garde tout le monde dans la course.
6. Pendant une question : **Révéler la réponse** sans attendre le chronomètre, ou **⏸ Pause** pour un discours. **Terminer**, collé à « Manuel », demande confirmation en pleine question : la fin d'un quiz ne se rattrape pas.
7. Après la révélation : **↺ Reposer** la question, ou **✖ Annuler les points** si la bonne réponse était fausse — l'écran commun et les téléphones affichent alors « Points annulés ». Un clic de trop ne casse rien : Révéler, Question suivante, Reposer et Annuler les points disent quelle question ils visaient, et celui qui arrive après que la partie a avancé est ignoré.
8. **⏩ Manuel / Auto 5 s / Auto 10 s** : en automatique, tu ne cliques plus entre les questions.
9. Un pseudo malheureux ? Clique dessus dans la liste des invités pour le renommer, ou sur la croix pour exclure.
10. À la fin : **🏆 Podium de la soirée** — il affiche aussi le plus beau coup, le plus régulier et le vainqueur de chaque quiz, de quoi remettre plusieurs cadeaux. Des ex æquo partagent leur marche, et les vainqueurs ex æquo d'un quiz leur carte : ils ont gagné ensemble, prévois un cadeau pour chacun. Fais scanner le QR de la page souvenir.
11. Entre deux quiz, le classement de la soirée reste affiché et **se cumule**.
12. **En fin de fête, avant de partir — Sauvegarder** : sur l'écran commun, **Sauvegarder** range la soirée dans l'historique sous son nom, sans rien effacer. N'attends pas le lendemain : le dernier invité parti, Render s'endort et son disque s'efface, et le bilan du lendemain se reconstruit alors depuis le miroir — sans la copie exacte des quiz joués, qui ne vivait que sur ce disque. Un quiz retouché depuis s'y lirait de travers. Et les badges des profils ne se décernent qu'au rangement — chaque rangement remplace les prix de soirée du précédent, c'est le dernier qui fait foi. L'expérience, elle, est déjà créditée : dès le podium de chaque quiz.
13. **Le lendemain** : poste le lien `https://TON-ADRESSE.onrender.com/romane/bilan` dans le groupe — chacun y relit ses réponses question par question, et « La soirée » raconte le reste ; le fil sous le titre mène au souvenir (podium, palmarès et tous les chiffres) et à l'historique. `/romane/bilan/fiches` imprime une fiche par invité, `npm run export` garde tout en fichiers.
14. **La soirée rangée** se relit ensuite pour toujours sur `/romane/soirees`, souvenir (chiffres compris) et bilan compris — même après **🧹 Nouvelle soirée** pour la fête suivante, qui l'archive de toute façon avant d'effacer. Ne retouche pas les quiz joués avant de l'avoir rangée.

Les retardataires rejoignent en cours de partie : ils jouent les questions suivantes, sans rattraper les précédentes.

---

## 7. Si ça coince

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| Page blanche ~1 min au premier scan | serveur endormi (offre gratuite, 15 min sans trafic) | attendre le réveil ; la prochaine fois, ouvrir l'écran commun cinq minutes avant |
| « Le serveur redémarre — patiente une minute, puis réessaie » | c'est l'hébergeur qui répond à la place de l'application (502, 503, 504) : un déploiement ou un réveil en cours | patienter une minute ; ne pas déployer pendant la fête — la production ne se déploie qu'à la main (étape 7) |
| « Identifiant ou mot de passe incorrect » | faute de frappe, ou le mot de passe d'amorçage a été changé depuis « Mon compte » | réessayer ; pour un ami, refaire un lien d'activation depuis `/admin` |
| « Trop d'essais — réessaie dans un quart d'heure » | cinq échecs de suite sur un même identifiant — les portes qui vérifient le même mot de passe (connexion, rattachement d'un profil, changement de mot de passe) se ferment ensemble —, ou vingt essais depuis une même adresse, toutes portes confondues (puis vingt par minute) : le wifi de la salle n'est qu'une adresse | attendre : un quart d'heure pour un mot de passe verrouillé, une minute suffit à l'adresse ; c'est le garde-fou contre la force brute |
| Le serveur refuse de démarrer : « ADMIN_PASSWORD manquant » | premier démarrage sur une base Turso sans aucun compte, et mot de passe absent ou laissé à celui par défaut | définir `ADMIN_PASSWORD` sur Render le temps de ce démarrage ; une fois le compte créé, la variable peut partir |
| Le serveur refuse de démarrer : « QUIZ_DB_URL manquant » | le service n'a pas de base permanente : il écrirait sur un disque qui s'efface à chaque réveil | renseigner `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` — la base de CE service, production ou préproduction |
| Le serveur refuse de démarrer : « Base permanente injoignable » | adresse ou jeton faux, jeton révoqué, base supprimée, Turso en panne — le détail suit le message | vérifier `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` sur la page de la base Turso ; au besoin, un jeton neuf (étape 2) |
| L'écran commun demande de se connecter | pas de session sur ce navigateur, ou session fermée (déconnexion, mot de passe changé, compte désactivé ou supprimé) | se reconnecter |
| « Cette adresse ne mène à aucune soirée » | le nom d'espace de l'adresse n'existe pas (faute de frappe, compte désactivé ou supprimé) | vérifier l'adresse dans « Mon compte » ; scanner le QR de l'écran |
| Aucun quiz proposé au lancement | la bibliothèque de cet espace est vide | écrire un quiz dans `/edit`, ou relancer la migration (étape 4) pour le tien |
| « Aucun quiz prêt à jouer » | toutes les questions sont des brouillons | dans `/edit`, compléter ce qui porte un ⚠️ |
| Un invité ne voit rien après avoir répondu | c'est normal | la question est sur l'écran commun ; son téléphone attend la révélation |
| Un téléphone affiche « Connexion perdue — reconnexion… » (en salle d'attente : « reconnexion… ») | réseau du téléphone : wifi coupé, 4G perdue, mode avion | il se reconnecte tout seul — au retour du réseau ou au rallumage de l'écran, en deux secondes —, son score est conservé |
| Un téléphone affiche « On ne te retrouve plus dans cette soirée — rejoins-la » | son invité n'existe plus : exclu pendant que le téléphone dormait, ou **🧹 Nouvelle soirée** | rien : l'entrée s'ouvre, pré-remplie de son prénom |
| Quiz modifié en ligne puis écrasé | migration relancée après coup | une fois en ligne, n'écris plus qu'en ligne |
| Les scores des essais sont encore là | la sauvegarde distante les a gardés | **🧹 Nouvelle soirée** sur l'écran commun — elle archive d'abord ; retire ensuite l'archive des essais sur `/romane/soirees` |
| « La soirée est complète » | plus d'inscrits que le réglage de l'espace (150 par défaut ; les essais comptent) | **🧹 Nouvelle soirée**, ou relever « Invités au plus » dans « Mon compte » — mais sur l'offre gratuite, pas au-delà de 150 environ : le coût des diffusions grandit plus vite que la salle, sur une instance qui n'a qu'un dixième de processeur (voir le test de charge du README). `MAX_PLAYERS=150` dans les variables de Render l'impose à tous les espaces |
| « Trop d'inscriptions d'un coup » | plus de 60 arrivées d'un coup depuis une même adresse (puis 60 par minute), plus de trois identités créées par une même connexion, ou plus de dix profils créés d'un coup depuis une même adresse (puis cinq par minute) | attendre une minute ; c'est le garde-fou contre les robots — une salle de 150 derrière la box de la fête entre en moins de deux minutes |
| Le bilan dit « intitulé non retrouvé » ou « quiz modifié depuis » | le quiz joué a été supprimé, renommé ou retouché dans `/edit` avant que la soirée soit rangée dans l'historique | remettre le quiz comme il était (même titre, mêmes questions dans le même ordre) ; les points et les numéros, eux, sont intacts |
| Une soirée manque sur `/romane/soirees` | elle n'a pas été sauvegardée avant **🧹 Nouvelle soirée** (versions antérieures) | rien à récupérer côté serveur ; les fichiers de `npm run export`, s'ils ont été faits, la gardent |
| Un vieux lien `/bilan` ou `/soirees/…` | l'adresse d'avant les comptes | elle redirige toute seule vers ton espace ; rien à faire |
| « Erreur serveur — réessaie dans un instant » sur l'écran commun, « Le serveur a un souci — réessaie dans un instant » sur une page | une panne interne — base distante qui refuse, archive abîmée… Son détail ne s'affiche jamais, ni aux invités ni sur l'écran projeté : il part au journal | réessayer ; si ça dure, chercher `[http]` ou `[socket]` dans les journaux du service (Render → *Logs*) : la ligne nomme la requête ou le geste qui a échoué, et la vraie erreur |
| « Sauvegarde en retard — la soirée continue », à côté du titre de l'écran commun | la base Turso refuse les écritures depuis une dizaine de secondes : Turso en panne, jeton révoqué, base supprimée… | la soirée continue, et rien n'est perdu tant que le serveur tourne : la file réessaie jusqu'au succès, et la pastille s'en va d'elle-même au rétablissement. D'ici là, garde un écran connecté et ne déploie pas — un serveur qui s'endort ou redémarre perd son disque, et la file avec. `/healthz` dit depuis quand ça dure et combien d'écritures attendent (bloc `miroir`) ; vérifie la base et son jeton sur turso.tech |

Un redémarrage du serveur en pleine partie n'est pas grave : la partie en cours est recopiée dans la base distante à chaque question posée ou révélée — avec ses gains, d'un seul tenant : une révélation ne se paie jamais deux fois au réveil —, et au plus toutes les deux secondes pendant qu'on répond. Elle reprend là où elle en était (au pire, deux secondes de réponses en moins), ses chronomètres réarmés à leur heure, les scores sont intacts et les téléphones se reconnectent seuls — pour chaque espace. À une condition : que la sauvegarde ait suivi. Si l'écran commun affichait « Sauvegarde en retard », ce qui attendait encore d'être écrit part avec le disque.

### Le serveur tombe en pleine partie, et ne revient pas

Render en panne, ou un redémarrage qui échoue en boucle : la soirée n'est pas perdue, elle est dans Turso. Elle repart d'un PC, dans cet ordre :

1. **Suspendre le service Render** (tableau de bord → *Settings* → *Suspend Web Service*). Jamais deux serveurs qui écrivent dans la même base : celui de Render, s'il revenait tout seul, repartirait d'une soirée que le PC aurait déjà fait avancer.
2. **Lancer le serveur sur le PC avec la base de production** — le client compilé (`npm run build`), puis, dans PowerShell :

   ```powershell
   $env:QUIZ_DB_URL="libsql://TON-URL.turso.io"; $env:QUIZ_DB_TOKEN="TON-JETON"; $env:DB_PATH="$env:TEMP\quizz-secours.db"; npm start
   ```

   Il recharge invités, points et partie en cours depuis le miroir — à condition de partir d'une base locale **vide** : c'est pour ça que `DB_PATH` pointe vers un fichier neuf, et non vers celle de tes essais, qui ferait autorité.
3. **Faire rescanner le QR de l'écran commun** : ouvre `http://localhost:3001/host` sur le vidéoprojecteur, connecte-toi, et le QR montre la nouvelle adresse (celle du PC, sur le wifi de la salle — voir « Repli » plus haut pour le pare-feu). Qui a un profil le retrouve en s'y connectant, points compris ; un invité anonyme, lui, repart sous une nouvelle identité — ses points restent au classement, sous l'ancienne.

La fête finie, **Sauvegarder** depuis l'écran du PC, puis relance le service Render : il repartira du miroir, où le PC a tout écrit.
