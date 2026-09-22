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

⚠️ **Le mot de passe d'amorçage ne sert qu'une fois.** Au premier démarrage, le serveur crée ton compte avec ; ensuite il ne le relit plus. Connecte-toi, change-le depuis **Mon compte**, puis retire `ADMIN_PASSWORD` des variables de Render. Choisis autre chose que `romane` : en ligne, le serveur refuse de démarrer avec le mot de passe par défaut. Rien ne passe jamais par la barre d'adresse : tu peux projeter l'écran commun sans crainte.

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
| `QUIZ_DB_URL` | l'URL Turso de l'étape 2 |
| `QUIZ_DB_TOKEN` | le jeton de l'étape 2 |

Deux à trois minutes de construction, et Render t'affiche ton adresse publique. Au premier démarrage, le serveur crée ton compte et, si la base contenait déjà des quiz ou des soirées d'avant les comptes, il te les rattache — regarde le journal : « administrateur créé », « lignes d'avant les comptes rattachées ». L'adresse apparaîtra automatiquement dans le QR code, suivie du nom de ton espace — rien à configurer de plus.

**Ensuite, tout de suite :** ouvre `https://TON-ADRESSE.onrender.com/connexion`, connecte-toi, va dans **Mon compte**, change ton mot de passe, puis retire `ADMIN_PASSWORD` des variables de Render.

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

⚠️ **Ne lance jamais ce test contre la base Turso de production.** Il simule vingt invités, et le miroir écrit toutes les deux secondes : le quota gratuit y passerait en une session. Vise la préproduction, ou reste en local sur fichier.

### Étape 7 — La préproduction

Le développement local ne peut pas éprouver six choses, et ce sont celles qui mordent : le miroir Turso avec sa vraie latence, le disque effacé au redémarrage, le réveil après veille, les cookies `Secure`, l'adresse du client derrière le proxy, et la politique de sécurité du contenu en conditions réelles.

Une soirée est un coup unique — on ne débogue pas pendant la fête. D'où un second service, identique au premier, sur sa propre base.

**Ce que ça donne :**

```
                   déploiement automatique       déploiement MANUEL
  main  ───────────────────────────────►  PRÉPROD  ─────────────►  PRODUCTION
                                     fiestapp-preprod          quizz-romane-30
                                            │                        │
                                   Turso fiestapp-preprod    Turso quizz-romane
```

**Pour la créer :**

1. **Une seconde base Turso**, à côté de la première : `quizz-preprod`. Récupère son URL et crée-lui un jeton. Turso sait aussi dupliquer une base existante, si tu veux éprouver une migration sur de vraies données — sache seulement que ça copie aussi les comptes.
2. **Crée le service**, et lis d'abord l'encadré ci-dessous : la façon de s'y prendre dépend de qui a créé la production.
3. **Renseigne ses variables** dans l'interface Render : `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` vers la base de **préproduction**, et un `ADMIN_PASSWORD` **différent** de celui de la production. `APP_ENV=preprod` est déjà dans le fichier.

> ⚠️ **Ne crée pas un second Blueprint.** Render n'adopte pas un service qu'il n'a pas créé lui-même depuis CE blueprint : il en fabrique une copie, et comme le nom est déjà pris, il y colle un suffixe au hasard — `quizz-romane-30-ljwa`, `fiestapp-preprod-ljwa`. Les deux copies portent le même suffixe, signe qu'une seule synchronisation les a créées ; les vraies, elles, n'ont pas bougé.
>
> C'est arrivé. Ce qu'il faut savoir pour s'en sortir :
>
> - **Le nom fait l'adresse, et les QR sont imprimés.** `jour-j/qr-tables-*.pdf` encodent `https://quizz-romane-30.onrender.com` : sous un autre nom, chaque QR posé sur les tables ne mène nulle part. C'est ce qui tranche — on garde les services d'origine, on supprime les copies, **et le blueprint qui les a créées** (sinon la synchronisation suivante les refait).
> - **Regarde `QUIZ_DB_URL` des copies avant de les supprimer.** Si l'une pointe vers la base Turso de production, elle a pu y écrire : c'est la seule chose vraiment fâcheuse ici. Si le formulaire du blueprint a été passé sans rien remplir, elles n'ont même pas démarré — le serveur refuse de se lancer en ligne sans `ADMIN_PASSWORD`, et leur journal dit « ❌ ADMIN_PASSWORD manquant ». Rien n'a alors été touché.
> - **Sans blueprint, `render.yaml` est de la documentation.** Les deux services se règlent alors chacun sur son tableau de bord : déploiement automatique **activé** en préproduction, **désactivé** en production (*Settings → Auto-Deploy*), et les variables saisies à la main. Le fichier reste la référence de ce qu'ils doivent contenir.

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
npm run smoke
```

`check` contrôle le code, `smoke` rejoue une soirée entière (comptes et leur suppression, isolation des espaces, inscription, quiz, scores, reconnexion, bibliothèque, photos, estimation, retardataire, historique, mise à jour d'une base d'avant les comptes).

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

Vers un autre espace que le tien : ajoute `--slug chez-bob`.

### Exporter la soirée (le lendemain)

```bash
npm run export -- https://TON-ADRESSE.onrender.com --slug romane
```

Écrit dans `export/romane/` le bilan complet (`bilan.json`) et trois fichiers Excel : une ligne par invité avec une colonne par question, une ligne par question, une ligne par équipe. Si le serveur ne répond plus : `npm run export -- --db libsql://TON-URL.turso.io --token TON-JETON --slug romane`.

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

---

## 6. Le soir J

1. **La veille** : ouvre l'adresse publique pour confirmer que tout répond (elle mettra une minute : le serveur dormait). Dans **Mon compte**, vérifie le titre de la soirée et la date : ce sont eux que voient les invités.
2. **5 minutes avant — le geste à ne pas oublier** : connecte-toi et ouvre l'écran commun sur le vidéoprojecteur. C'est lui qui réveille le serveur, et tant qu'un écran est connecté il ne se rendort pas. Sans ça, le premier invité qui scanne attend une minute devant une page blanche.
3. Vérifie le bouton 🔊 en haut de l'écran commun (les sons ne sortent que de là, jamais des téléphones).
4. Les invités scannent le QR — il mène à `/romane` —, choisissent un prénom et un avatar.
5. **Lancer un quiz** → choisis **points normaux, ×2 ou ×3**, puis le quiz → le 3-2-1 démarre. Annonce le multiplicateur à la salle : c'est ce qui garde tout le monde dans la course.
6. Pendant une question : **Révéler la réponse** sans attendre le chronomètre, ou **⏸ Pause** pour un discours.
7. Après la révélation : **↺ Reposer** la question, ou **✖ Annuler les points** si la bonne réponse était fausse.
8. **⏩ Manuel / Auto 5 s / Auto 10 s** : en automatique, tu ne cliques plus entre les questions.
9. Un pseudo malheureux ? Clique dessus dans la liste des invités pour le renommer, ou sur la croix pour exclure.
10. À la fin : **🏆 Podium de la soirée** — il affiche aussi le plus beau coup, le plus régulier et le vainqueur de chaque quiz, de quoi remettre plusieurs cadeaux. Fais scanner le QR de la page souvenir.
11. Entre deux quiz, le classement de la soirée reste affiché et **se cumule**.
12. **Le lendemain** : poste le lien `https://TON-ADRESSE.onrender.com/romane/bilan` dans le groupe — chacun y relit ses réponses question par question, et « La soirée » raconte le reste ; le fil sous le titre mène au souvenir (podium, palmarès et tous les chiffres) et à l'historique. `/romane/bilan/fiches` imprime une fiche par invité, `npm run export` garde tout en fichiers.
13. **Ranger la soirée** : sur l'écran commun, **Sauvegarder** la met dans l'historique sous son nom, sans rien effacer. Elle se relit ensuite pour toujours sur `/romane/soirees`, souvenir (chiffres compris) et bilan compris — même après **🧹 Nouvelle soirée** pour la fête suivante, qui l'archive de toute façon avant d'effacer. Ne retouche pas les quiz joués avant de l'avoir rangée.

Les retardataires rejoignent en cours de partie : ils jouent les questions suivantes, sans rattraper les précédentes.

---

## 7. Si ça coince

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| Page blanche ~1 min au premier scan | serveur endormi (offre gratuite, 15 min sans trafic) | attendre le réveil ; la prochaine fois, ouvrir l'écran commun cinq minutes avant |
| « Identifiant ou mot de passe incorrect » | faute de frappe, ou le mot de passe d'amorçage a été changé depuis « Mon compte » | réessayer ; pour un ami, refaire un lien d'activation depuis `/admin` |
| « Trop d'essais — réessaie dans un quart d'heure » | cinq échecs de suite sur un identifiant, ou vingt depuis la même adresse | attendre quinze minutes ; c'est le garde-fou contre la force brute |
| Le serveur refuse de démarrer : « ADMIN_PASSWORD manquant » | mot de passe par défaut en ligne | définir `ADMIN_PASSWORD` sur Render (il ne sert qu'au premier démarrage) |
| L'écran commun demande de se connecter | pas de session sur ce navigateur, ou session fermée (déconnexion, mot de passe changé, compte désactivé ou supprimé) | se reconnecter |
| « Cette adresse ne mène à aucune soirée » | le nom d'espace de l'adresse n'existe pas (faute de frappe, compte désactivé ou supprimé) | vérifier l'adresse dans « Mon compte » ; scanner le QR de l'écran |
| Aucun quiz proposé au lancement | la bibliothèque de cet espace est vide | écrire un quiz dans `/edit`, ou relancer la migration (étape 4) pour le tien |
| « Aucun quiz prêt à jouer » | toutes les questions sont des brouillons | dans `/edit`, compléter ce qui porte un ⚠️ |
| Un invité ne voit rien après avoir répondu | c'est normal | la question est sur l'écran commun ; son téléphone attend la révélation |
| Téléphone bloqué sur « reconnexion… » | réseau du téléphone | il se reconnecte tout seul, son score est conservé |
| Quiz modifié en ligne puis écrasé | migration relancée après coup | une fois en ligne, n'écris plus qu'en ligne |
| Les scores des essais sont encore là | la sauvegarde distante les a gardés | **🧹 Nouvelle soirée** sur l'écran commun — elle archive d'abord ; retire ensuite l'archive des essais sur `/romane/soirees` |
| « La soirée est complète » | plus d'inscrits que le réglage de l'espace (150 par défaut ; les essais comptent) | **🧹 Nouvelle soirée**, ou relever « Invités au plus » dans « Mon compte » |
| « Trop d'inscriptions d'un coup » | plus de 25 inscriptions depuis une même adresse en quelques secondes | attendre une minute ; c'est le garde-fou contre les robots |
| Le bilan dit « intitulé non retrouvé » ou « quiz modifié depuis » | le quiz joué a été supprimé, renommé ou retouché dans `/edit` avant que la soirée soit rangée dans l'historique | remettre le quiz comme il était (même titre, mêmes questions dans le même ordre) ; les points et les numéros, eux, sont intacts |
| Une soirée manque sur `/romane/soirees` | elle n'a pas été sauvegardée avant **🧹 Nouvelle soirée** (versions antérieures) | rien à récupérer côté serveur ; les fichiers de `npm run export`, s'ils ont été faits, la gardent |
| Un vieux lien `/bilan` ou `/soirees/…` | l'adresse d'avant les comptes | elle redirige toute seule vers ton espace ; rien à faire |

Un redémarrage du serveur en pleine partie n'est pas grave : la partie en cours est recopiée toutes les deux secondes dans la base distante, elle reprend là où elle en était (au pire, deux secondes de réponses en moins), les scores sont intacts et les téléphones se reconnectent seuls — pour chaque espace.
