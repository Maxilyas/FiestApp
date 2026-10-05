# Mise en ligne — mode d'emploi

Tout ce qu'il faut pour mettre l'application en ligne, l'animer, et en faire profiter des amis. Rien de ce qui suit ne coûte d'argent, et aucune carte bancaire n'est demandée.

---

## 1. Les trois sites (+ GitHub)

| Site | À quoi il sert | Carte bancaire | Compte à créer |
|---|---|---|---|
| [github.com](https://github.com) | héberge le code ; Render y lit le dépôt `Maxilyas/FiestApp` | non | déjà fait |
| [turso.tech](https://turso.tech) | la base qui garde tes quiz, tes comptes et tes soirées **pour toujours** | non | oui |
| [render.com](https://render.com) | le serveur qui fait tourner le jeu | non | oui |
| [cron-job.org](https://cron-job.org) | appelle le serveur toutes les dix minutes, de 7 h à minuit, pour qu'il ne s'endorme pas (étape 5) | non | oui |

---

## 2. À noter quelque part (tu en auras besoin plusieurs fois)

Garde ces valeurs sous la main — un fichier texte, un gestionnaire de mots de passe, ce que tu veux. **Ne les mets pas dans le dépôt.**

| Quoi | Où tu l'obtiens | Exemple |
|---|---|---|
| URL Turso | page de ta base Turso | `libsql://fiestapp-xxx.turso.io` |
| Jeton Turso | bouton de création de token, **affiché une seule fois** | `eyJhbGciOi…` |
| Identifiant administrateur (`ADMIN_LOGIN`) | tu le choisis | `antoine` |
| Mot de passe d'amorçage (`ADMIN_PASSWORD`) | tu l'inventes ; il ne sert qu'au premier démarrage | `salsa2026!` |
| Nom de ton espace (`ADMIN_SLUG`) | tu le choisis : minuscules, chiffres, tirets | `chez-antoine` |
| Adresse publique | donnée par Render après le déploiement | `https://fiestapp-xxxx.onrender.com` |
| Adresse des invités | l'adresse publique + `/` + ton espace — c'est le QR | `https://fiestapp-xxxx.onrender.com/chez-antoine` |
| Adresse de l'écran commun | l'adresse publique + `/host`, une fois connecté | |

⚠️ **Le mot de passe d'amorçage ne sert qu'une fois.** Au premier démarrage, sur une base encore vide, le serveur crée ton compte avec ; ensuite il ne le relit plus. Connecte-toi, change-le depuis **Mon compte**, puis retire `ADMIN_PASSWORD` des variables de Render : les démarrages suivants s'en passent — et sur l'offre gratuite, chaque réveil en est un. Pas avant que cette version tourne sur le service, en revanche : les précédentes refusaient de démarrer sans. Choisis autre chose que `demo` : en ligne, tant que la base n'a aucun compte, le serveur refuse de démarrer sans mot de passe ou avec celui par défaut. Rien ne passe jamais par la barre d'adresse : tu peux projeter l'écran commun sans crainte.

---

## 3. Le déploiement, dans l'ordre

### Étape 1 — Pousser le code sur GitHub

Render déploie depuis GitHub, pas depuis ton PC.

```bash
git push
```

### Étape 2 — Créer la base Turso

Sur [turso.tech](https://turso.tech) : crée un compte (connexion GitHub possible), puis une base — nomme-la `fiestapp`, emplacement en Europe. Sur sa page, récupère **l'URL** (`libsql://…`) et crée un **jeton**.

En ligne de commande si tu préfères :

```bash
turso db create fiestapp
```

```bash
turso db show fiestapp --url
```

```bash
turso db tokens create fiestapp
```

### Étape 3 — Déployer sur Render

Sur [render.com](https://render.com) : crée un compte, puis **New → Web Service**, et connecte le dépôt `Maxilyas/FiestApp`. Reprends les réglages de `render.yaml` :

| Réglage | Valeur |
|---|---|
| Region | Frankfurt |
| Instance Type | Free |
| Build Command | `npm ci && npm run build` |
| Start Command | `cd server && exec node dist/index.mjs` |
| Health Check Path (*Settings*) | `/healthz` |

Surtout pas `npm start` : npm garde pour lui le signal d'arrêt de Render, et l'arrêt propre — celui qui recopie les dernières réponses dans Turso avant de s'éteindre — ne s'exécute jamais.

`npm run build` construit le client **et** le serveur, en un seul fichier : `server/dist/index.mjs`. Chaque réveil de l'offre gratuite est un démarrage, et le serveur n'a plus à y traduire son TypeScript — une seconde de processeur et 35 Mo de mémoire en moins, quelques secondes de page blanche en moins pour le premier invité qui scanne le QR. L'ancienne commande, `cd server && exec node --import tsx src/index.ts`, marche toujours : c'est le repli si le paquet refusait de démarrer.

Puis ses variables (*Environment*) :

| Variable | Ce que tu mets |
|---|---|
| `ADMIN_LOGIN` | ton identifiant |
| `ADMIN_PASSWORD` | ton mot de passe d'amorçage |
| `ADMIN_SLUG` | le nom de ton espace (`chez-antoine`) |
| `QUIZ_DB_URL` | l'URL Turso de l'étape 2 — sans elle, le serveur refuse de démarrer : le disque de Render s'efface à chaque réveil, et tout ce qui y serait écrit disparaîtrait |
| `QUIZ_DB_TOKEN` | le jeton de l'étape 2 |
| `NODE_VERSION` | `22` |
| `MAX_PLAYERS` | `150` — le plafond d'invités d'une soirée, que le réglage d'un espace ne dépasse pas. Sans elle, le code laisse monter jusqu'à 500, et une salle de 300 fait céder le dixième de processeur de l'offre gratuite (mesuré). Il borne **chaque** espace, pas leur somme |

Deux variables que Render pose seul, et qu'ailleurs il faudrait poser : `NODE_ENV=production` met le serveur **en ligne** (il refuse alors de démarrer sans `QUIZ_DB_URL`, et exige un vrai `ADMIN_PASSWORD` sur une base vide) — sur Render, `RENDER=true` en tient lieu ; et `PUBLIC_URL`, l'adresse publique que portent les QR codes — sur Render, `RENDER_EXTERNAL_URL` en tient lieu.

Enfin, dans *Settings*, coupe **Auto-Deploy** : la production ne se déploie qu'à la main, une fois la préproduction vue tourner (étape 7).

> Pourquoi pas **New → Blueprint** ? Il lirait `render.yaml` et réglerait tout d'un coup — mais pour les **deux** services que le fichier décrit, production et préproduction, chacun avec sa base Turso. Et le choix est sans retour : Render n'adopte jamais un service qu'un blueprint n'a pas créé, il en fabrique des copies (étape 7).

Deux à trois minutes de construction, et Render t'affiche ton adresse publique. Chaque démarrage se dit au journal : `[serveur] prêt en … ms — au plus 150 invités par soirée` — si la ligne dit 500 et « MAX_PLAYERS non défini », la variable manque. Au premier démarrage, le serveur crée ton compte et, si la base contenait déjà des quiz ou des soirées d'avant les comptes, il te les rattache — regarde le journal : `[comptes] administrateur « … » créé`, et s'il y a lieu `[espaces] … lignes d'avant les comptes rattachées`. L'adresse apparaîtra automatiquement dans le QR code, suivie du nom de ton espace — rien à configurer de plus. Le premier démarrage d'une version qui connaît les sentiers du savoir rend à chacun ses avatars du savoir en paliers, une fois : `[sentiers] … portrait(s) de … profil(s) repris en paliers` (rien sur une base neuve).

**Ensuite, tout de suite :** ouvre `https://TON-ADRESSE.onrender.com/connexion`, connecte-toi, va dans **Mon compte**, change ton mot de passe, puis retire `ADMIN_PASSWORD` des variables de Render. Le redémarrage qui suit se fait très bien sans.

### Étape 4 — Transférer tes quiz vers Turso

Une fois le serveur démarré en ligne (c'est lui qui crée ton compte, et les quiz vont dans ton espace) :

```bash
npm run migrate -- --to libsql://TON-URL.turso.io --token TON-JETON
```

Ça copie **tout** ce que contient ta bibliothèque locale : quiz terminés, brouillons, photos. Fais le ménage dans `/edit` avant si nécessaire. Les deux quiz d'exemple, s'ils traînent encore en ligne, se suppriment dans `/edit`.

La commande se relance autant de fois que tu veux : un quiz déjà en ligne est mis à jour, un nouveau est ajouté. Elle n'efface jamais rien à destination.

### Étape 5 — Tenir le serveur éveillé de 7 h à minuit

Sans trafic pendant 15 minutes, l'offre gratuite de Render endort le serveur, et le réveil prend environ une minute : le premier invité qui scanne attendrait devant une page blanche, et le premier joueur du quiz du jour aussi. Les sondes de Render sur `/healthz` ne le tiennent pas éveillé. Et le rappel du soir du quiz du jour part du serveur lui-même, à 18 h : endormi, il ne l'enverrait qu'à son réveil, et plus du tout après 22 h. Il ne demande rien d'autre — ses clés se tirent au premier démarrage, dans Turso — ; `/healthz` dit sa dernière tournée (`rappels` : envoyés, échecs).

La production ne dort donc pas le jour : sur [cron-job.org](https://cron-job.org), crée une tâche qui l'appelle toutes les dix minutes — pas une routine Claude Code comme celle de l'étape 8 : elle ne passerait pas assez souvent, et chaque passage ouvrirait une session sur ton abonnement.

| Réglage | Valeur |
|---|---|
| Adresse | `https://TON-ADRESSE.onrender.com/healthz` : la route la plus légère, qui répond toujours 200 et ne nomme personne |
| Horaire | personnalisé : aux minutes 0, 10, 20, 30, 40 et 50, de 7 h à 23 h, tous les jours |
| Fuseau horaire | `Europe/Paris`, pour que le changement d'heure se fasse tout seul |

**Le réveil du matin, lui, ne vient pas de cron-job.org.** La tâche abandonne un appel au bout de trente secondes, et le réveil en prend près d'une minute : sa requête coupée ne réveille pas le serveur, et tous les appels de la journée échouaient derrière celui de 7 h. C'est la routine de la réserve du quiz du jour (étape 8) qui le lève, tous les jours à 6 h 55 : sa première requête attend jusqu'à deux minutes et insiste ; la tâche n'a plus qu'à tenir debout un serveur déjà levé. Un workflow GitHub planifié s'en chargeait avant : GitHub le lançait avec une demi-heure, parfois une heure de retard, et le serveur dormait encore aux premiers appels. Pas avant 6 h 45 : quinze minutes sans trafic avant le premier appel de la tâche, et il se rendort. Sur cron-job.org, coupe l'option qui désactive la tâche après plusieurs échecs.

Un appel en échec dans l'historique de la tâche (délai dépassé) veut dire que le serveur dormait : le réveil du matin a manqué, regarde la dernière exécution de la routine (étape 8). Après l'appel de 23 h 50, il s'endort vers minuit cinq. Pour vérifier que ça tient : en soirée, `/healthz` dit un `uptime` de plusieurs heures (il est en secondes) ; un serveur qui vient de se réveiller repart de zéro.

**Jamais 24 h/24, et jamais la préproduction.** Les 750 heures mensuelles de l'offre gratuite sont partagées par les deux services. De 7 h à minuit, la production en prend environ 530 sur un mois de 31 jours ; il en reste 220 pour la préproduction, que chaque fusion sur `main` réveille, et pour les soirées qui finissent après minuit. Allumée en permanence, la production en prendrait 744 à elle seule : le quota serait épuisé avant la fin du mois, et Render suspend alors **tous** les services gratuits jusqu'au 1er du mois suivant, production comprise. Un autre service de ping ferait l'affaire, pourvu qu'il sache s'arrêter la nuit.

La nuit, ou si la tâche s'arrête (compte fermé, service en panne), le serveur se rendort au bout de 15 minutes. Le geste de la section 6 reste donc : **ouvrir l'écran commun cinq minutes avant** l'arrivée des invités. Ensuite, la veille ne menace plus la soirée : tant qu'un écran commun ou un téléphone est connecté, le trafic des websockets tient le serveur éveillé, après minuit compris.

La veille ne menace pas davantage les quiz qu'on prépare : l'éditeur n'envoie rien pendant qu'on écrit, et le serveur peut s'endormir entre deux enregistrements — mais « Enregistrer » attend son réveil (« Réveil du serveur… », une minute), et le navigateur garde ce qui n'est pas encore enregistré, même si l'on recharge la page.

### Étape 6 — Vérifier pour de vrai

Ouvre l'écran commun, puis **scanne le QR avec ton téléphone en 4G, wifi coupé**. C'est le seul test qui prouve que les invités pourront jouer.

```bash
ADMIN_LOGIN=antoine ADMIN_PASSWORD=ton-mot-de-passe npm run load -- https://TON-ADRESSE.onrender.com 20 --slug TON-ESPACE
```

Simule 20 invités sur le serveur en ligne et mesure les temps de réponse réels.

⚠️ **Ne lance jamais ce test contre la base Turso de production.** Ses vingt invités s'inscrivent pour de vrai dans la soirée de ton espace, et il y joue un quiz entier : c'est la vraie soirée qu'il remplit — classement, miroir, et l'archive qu'elle se fait après chaque quiz. Vise la préproduction, ou reste en local sur fichier. Pour mesurer la production sans y inscrire personne, `--sonde` ne fait que connecter les téléphones.

### Étape 7 — La préproduction

Le développement local ne peut pas éprouver six choses, et ce sont celles qui mordent : le miroir Turso avec sa vraie latence, le disque effacé au redémarrage, le réveil après veille, les cookies `Secure`, l'adresse du client derrière le proxy, et la politique de sécurité du contenu en conditions réelles. Pour cette dernière, ouvre la console du navigateur (F12) sur l'écran commun comme sur un téléphone : la politique ne laisse le temps réel parler qu'à l'hôte de la page — en `wss://` derrière le proxy de Render —, et aucune violation de `connect-src` ne doit s'y lire.

Une soirée est un coup unique — on ne débogue pas devant la salle. D'où un second service, identique au premier, sur sa propre base.

**Ce que ça donne :**

```
                   déploiement automatique       déploiement MANUEL
  main  ───────────────────────────────►  PRÉPROD  ─────────────►  PRODUCTION
                                 fiestapp-quizz-preprod       fiestapp-quizz
                                            │                        │
                                   Turso fiestapp-preprod      Turso fiestapp
```

**Pour la créer :**

1. **Une seconde base Turso**, à côté de la première : `fiestapp-preprod`. Récupère son URL et crée-lui un jeton. Turso sait aussi dupliquer une base existante, si tu veux éprouver une migration sur de vraies données — sache seulement que ça copie aussi les comptes.
2. **Crée le service**, et lis d'abord l'encadré ci-dessous : la façon de s'y prendre dépend de qui a créé la production.
3. **Renseigne ses variables** dans l'interface Render : `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` vers la base de **préproduction**, et un `ADMIN_PASSWORD` **différent** de celui de la production. `APP_ENV=preprod` est déjà dans le fichier.

> ⚠️ **Ne crée pas un second Blueprint.** Render n'adopte pas un service qu'il n'a pas créé lui-même depuis CE blueprint : il en fabrique une copie, et comme le nom est déjà pris, il y colle un suffixe au hasard — `fiestapp-quizz-ljwa`, `fiestapp-quizz-preprod-ljwa`. Les deux copies portent le même suffixe, signe qu'une seule synchronisation les a créées ; les vraies, elles, n'ont pas bougé.
>
> C'est arrivé. Ce qu'il faut savoir pour s'en sortir :
>
> - **Supprime les copies, et le blueprint qui les a créées** — sinon la synchronisation suivante les refait.
> - **Ce qui décide du service à garder, c'est l'adresse déjà partagée — et elle ne tient pas au nom.** L'adresse `onrender.com` d'un service se fixe à sa création : le renommer ne la change pas, mais une copie suffixée, ou un service recréé, en reçoit une autre. Les QR imprimés et les liens déjà partagés portent cette adresse : tant qu'il en circule, garde le service qui y répond — renomme-le si tu veux, ne le recrée pas.
> - **Le service, lui, est jetable.** Tout le précieux vit dans Turso ; en supprimer un et le recréer ne perd rien tant que `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` repointent sur la même base. La seule chose à ne jamais supprimer, c'est la base Turso.
> - **Regarde `QUIZ_DB_URL` des copies avant de les supprimer.** Si l'une pointe vers la base Turso de production, elle a pu y écrire : c'est la seule chose vraiment fâcheuse ici. Si le formulaire du blueprint a été passé sans rien remplir, elles n'ont même pas démarré — le serveur refuse de se lancer en ligne sans `QUIZ_DB_URL`, et leur journal dit « ❌ QUIZ_DB_URL manquant ». Rien n'a alors été touché.
> - **Sans blueprint, `render.yaml` est de la documentation.** Les deux services se règlent alors chacun sur son tableau de bord : déploiement automatique **activé** en préproduction, **désactivé** en production (*Settings → Auto-Deploy*), les variables saisies à la main, et les deux commandes recopiées dans *Settings* — `npm ci && npm run build` dans **Build Command** (rubrique *Build*), `cd server && exec node dist/index.mjs` dans **Start Command** (rubrique *Deploy*). Change-les d'abord sur la préproduction : un déploiement, un réveil, une partie ; la production ensuite. Le fichier reste la référence de ce qu'ils doivent contenir.

> 🚨 **La règle absolue : jamais la même base Turso pour les deux.** Un « C'était un essai », une soirée retirée de l'historique ou une suppression de compte en préproduction effacerait de vraies soirées archivées — ce sont les seuls gestes sans retour de l'application. Pour qu'on ne s'y trompe jamais, la préproduction affiche un **bandeau rouge « PREPROD »** en bas à gauche de toutes ses pages, et le préfixe dans l'onglet du navigateur.

**Vérifier l'adresse des invités.** Chaque soirée a sa réserve de soixante inscriptions d'un coup par adresse — une salle derrière une seule box, ou des invités en 4G derrière celle de leur opérateur. Encore faut-il que l'adresse lue soit celle du téléphone. Le serveur lit la **dernière** entrée de l'en-tête `x-forwarded-for`, en supposant un seul proxy devant lui (`server.ts`, `trust proxy 1` ; `sockets.ts`, `clientIp`). Si Render en place plusieurs, cette dernière entrée est l'adresse d'un de ses proxys : tous les invités qui passent par lui partagent alors une seule réserve, et une salle de 150 prend des refus. Personne n'a pu le vérifier depuis la documentation de Render (inaccessible au moment d'écrire ces lignes) : c'est le journal du service qui le dira. Après une vraie soirée — en préproduction d'abord, avec quelques téléphones en 4G sur des opérateurs différents —, cherche dans les *Logs* du service :

- **`[inscriptions] soirée finie chez « … » : 12 invités ; 12 inscriptions depuis la dernière clôture de l'espace, sous 7 adresses distinctes ; x-forwarded-for : 1 entrée`**, une ligne à chaque clôture ou essai effacé. Des téléphones en 4G, sur plusieurs opérateurs, doivent donner **plusieurs** adresses. Une salle en 4G sous **une ou deux** adresses, soirée après soirée, veut dire qu'on lit l'adresse d'un proxy : c'est alors à corriger avant une grande soirée. (Une salle entière sur le wifi de la fête donne une adresse, et c'est normal : c'est celle de la box.) Seuls les invités vraiment entrés comptent. Un redémarrage en pleine soirée fait repartir le compte des inscriptions : la ligne le dit en en comptant moins que d'invités.

  La fin de la ligne dit combien d'adresses l'en-tête `x-forwarded-for` portait à l'entrée des invités — le moins et le plus vus ce soir-là (« 1 entrée », « 1 à 2 entrées »). C'est **la** ligne qui répond à la question, car une soirée normale ne prend aucun refus : **toujours 2 entrées ou plus**, soirée après soirée, même pour des téléphones qui n'ont pas de proxy à eux, veut dire qu'il y a plus d'un proxy devant le serveur, et que la dernière entrée — celle qu'il lit — est l'adresse d'un proxy. **1 entrée** partout, c'est ce qu'on attend d'un seul proxy. Un client peut envoyer son propre en-tête (d'où un maximum isolé plus haut) : c'est le minimum et la tendance qui comptent.
- **`[inscriptions] réserve de la soirée vide chez « … » pour l'adresse 3fa9c1d2e0 (x-forwarded-for : 2 entrées)`**, au plus une ligne par minute pour chaque couple (adresse, espace). L'adresse n'y paraît jamais, seulement une empreinte salée, qui change à chaque démarrage. Elle ne paraît qu'au refus : une soirée ordinaire n'en écrit aucune.

**Promouvoir en production.** La production ne se déploie pas toute seule : sur son tableau de bord Render, **Manual Deploy → Deploy latest commit**. On regarde la préproduction tourner, puis on promeut — la veille d'une soirée, pas le soir même.

**Passer au serveur empaqueté (une fois par service).** Un service créé avant le paquet démarre encore par `cd server && exec node --import tsx src/index.ts`, qui marche toujours. Pour gagner le réveil : une fois déployé un commit qui construit le paquet (la construction passe alors par `npm run build -w server`), change **Start Command** en `cd server && exec node dist/index.mjs`. La préproduction d'abord — un redémarrage, `[serveur] prêt en … ms` au journal, une partie —, la production ensuite. Si le service ne démarre plus et que le journal dit `Cannot find module '…/server/dist/index.mjs'`, le commit déployé ne construisait pas encore le paquet : remets l'ancienne commande le temps de le déployer.

**Les minutes de construction.** L'offre gratuite donne 500 minutes de construction par mois, pour tout l'espace de travail, et chaque fusion sur `main` construit la préproduction : 54 fusions en cinq jours fin septembre 2026, soit 650 à 970 minutes par mois à ce rythme. Épuisées sans moyen de paiement enregistré, plus aucune construction jusqu'au mois suivant — **production comprise**, veille de soirée comprise. Deux réglages :

- **Build Filters**, sur les deux services (*Settings*, rubrique *Build*) : dans **Ignored Paths**, `retours/**`, `**/*.md` et `.claude/**`. Une fusion qui ne touche que la documentation, les retours d'une tablée ou les consignes des agents ne construit plus rien — ni le serveur ni le client n'en lisent une ligne.
- **Auto-Deploy** de la préproduction, coupé les semaines chargées (*Settings → Auto-Deploy*) : quand les fusions se rapprochent, on la déploie à la main — **Manual Deploy → Deploy latest commit** — au moment de la regarder, comme la production. On le rallume ensuite : c'est lui qui fait qu'elle est toujours à jour.

Ce qui reste se lit en trente secondes : *Workspace → Billing*, les minutes de construction du mois. Les heures d'instance, elles, sont 750 par mois pour les deux services ensemble, et c'est pour elles qu'ils dorment (ci-dessous).

**Observer un déploiement pendant une partie (dix minutes, une fois).** Render peut faire tourner l'ancienne et la nouvelle instance ensemble pendant une bascule. Si c'est le cas, les deux écrivent au même miroir pendant ce temps-là, et au réveil suivant une question peut se retrouver payée deux fois — rejoué en local, jamais vu chez Render. Ne pas déployer pendant une soirée suffit à s'en garder (section 6) ; mais pour savoir s'il faut aller plus loin, il faut le voir une fois, en **préproduction** :

1. Ouvre son écran commun et deux téléphones (un téléphone et une fenêtre privée font l'affaire), lance un quiz aux questions longues, et fais répondre les téléphones.
2. Relève `/healthz` toutes les deux secondes, dans un terminal :

   ```bash
   while true; do echo "$(date +%T) $(curl -s https://TA-PREPROD.onrender.com/healthz | grep -oE '"(version|uptime)":[^,}]*' | tr '\n' ' ')"; sleep 2; done
   ```

   ou, dans PowerShell :

   ```powershell
   while ($true) { $h = Invoke-RestMethod https://TA-PREPROD.onrender.com/healthz; "{0}  version {1}  uptime {2}" -f (Get-Date -Format HH:mm:ss), $h.version, $h.uptime; Start-Sleep 2 }
   ```
3. Sur le tableau de bord de la préproduction, **Manual Deploy → Deploy latest commit**, et laisse les téléphones répondre pendant toute la bascule.
4. Regarde trois choses :
   - **le relevé** : si les lignes **alternent**, pendant la bascule, entre l'ancienne instance (un `uptime` qui continue de monter) et la nouvelle (un `uptime` de quelques secondes), les deux répondaient ensemble. Un `uptime` qui retombe une fois pour de bon, c'est une bascule nette ;
   - **le journal** (*Logs*) : l'heure de `[serveur] prêt en … ms` et de `[soirée] … rechargés après redémarrage` (la nouvelle), face à celle de `[serveur] extinction demandée` (l'ancienne). La nouvelle qui recharge la soirée **avant** que l'ancienne ne s'éteigne, c'est le chevauchement : l'ancienne écrivait encore au miroir que la nouvelle avait déjà relu ;
   - **les points** : le classement de l'écran commun avant et après — une question payée deux fois s'y voit.
5. Garde le relevé et ces lignes du journal. Avec un chevauchement, on pose un bail : la nouvelle instance prend la main, l'ancienne cesse d'écrire et renvoie les téléphones vers elle. Sans, on s'arrête là.

**Et le dormir ?** La préproduction s'endort après quinze minutes sans trafic, et aucun ping ne la réveille : les 750 heures mensuelles de l'offre gratuite tiennent la production éveillée de 7 h à minuit, pas deux services (voir l'étape 5). On la réveille en ouvrant son adresse, cinq minutes avant de s'en servir.

### Étape 8 — La réserve du quiz du jour, remplie par une routine

Le quiz du jour pose dix questions par jour : sa réserve se vide. Une **routine Claude Code** la remplit chaque matin, sur ton abonnement Claude — et réveille la production au passage (étape 5).

**À faire le jour même où le quiz du jour arrive en ligne, pas plus tard.** Au premier démarrage, la réserve prend les questions des quiz livrés : trente-huit, de quoi tenir quatre jours — ensuite, elles ne sortent plus qu'en dernier recours, puisqu'une soirée peut jouer ces quiz. Sans la routine, plus de quiz du jour du cinquième au trente et unième jour, le temps que ces questions redeviennent tirables — et Halloween (du 25 octobre au 1er novembre) en demande trois pour sa Citrouille. Le journal du service le dit dès qu'un jour manque de questions (`[jour] réserve à sec`). Le serveur ne détient aucune clé d'IA : il donne la consigne et reçoit les questions, derrière un jeton qui ne sait faire que ça. Mais la consigne rappelle les intitulés déjà en réserve — ceux des trois semaines à venir d'abord, pour que l'IA ne les réécrive pas : **qui tient le jeton peut lire les questions des prochains jours**, et chercher leurs réponses la veille. Garde-le donc comme un mot de passe ; s'il a fuité, change-le aussitôt des deux côtés (points 1 et 2) — deux minutes —, et retire à `/admin` ce qu'il aurait déposé.

1. **Le jeton, dans Render.** Sur la préproduction d'abord, pour essayer, puis sur la production — chacune le sien : *Environment → Add Environment Variable*, la clé `RESERVE_TOKEN`, et le bouton **Generate** pour la valeur. Enregistre : le service redémarre, et `/admin`, rubrique « Le quiz du jour », dit **Remplissage automatique ouvert**. Sous trente-deux caractères, la porte reste fermée, et le journal du démarrage le dit.
2. **Le même jeton, dans l'environnement Claude Code.** Sur claude.ai/code, le menu de l'environnement (en haut d'une session), puis **Edit** : ajoute les variables `RESERVE_TOKEN` (la valeur recopiée depuis Render) et `FIESTAPP_URL` (l'adresse du service qu'elle remplit, `https://….onrender.com`, sans `/` à la fin). Dans **Network access**, ajoute ce domaine aux domaines permis. Le jeton ne s'écrit jamais dans le dépôt, ni dans une conversation. Une fois la préproduction essayée, remplace les deux variables par celles de la production.
3. **La routine.** Demande-la à Claude dans une nouvelle session de cet environnement (« crée la routine de la réserve du quiz du jour, tous les jours à 6 h 55 »), ou crée-la toi-même : une nouvelle session à chaque passage, avec cette consigne. Elle sert deux fois : elle remplit la réserve, et elle **réveille la production** avant le premier appel de cron-job.org, à 7 h (étape 5) — d'où le passage quotidien, même quand la réserve est pleine (elle s'arrête alors en une ligne). C'est la patience de sa première requête qui réveille le serveur : elle attend jusqu'à deux minutes et insiste ; ensuite elle lit, écrit pendant plusieurs minutes, puis dépose, et la tâche de cron-job.org a pris le relais.

   ```
   Tu remplis la réserve du quiz du jour de FiestApp, avec les variables de
   l'environnement FIESTAPP_URL et RESERVE_TOKEN. N'écris rien dans le dépôt,
   n'ouvre aucune PR.

   1. Lis ce qu'il faut écrire. Le serveur dort peut-être : il met jusqu'à
      deux minutes à se réveiller.
      curl -sS --retry 6 --retry-delay 20 --retry-all-errors --max-time 90 \
        "$FIESTAPP_URL/api/jour/reserve" -H "Authorization: Bearer $RESERVE_TOKEN"
      La réponse donne aEcrire, parEnvoi et consigne. Si aEcrire vaut 0,
      dis-le en une ligne et arrête-toi.
   2. Écris aEcrire questions en suivant la consigne à la lettre, puis
      relis-les une à une comme elle le demande. Au moindre doute sur un
      fait, remplace la question.
   3. Envoie-les par lots de parEnvoi questions au plus : chaque lot dans
      lot.txt, au format de la consigne, puis
      jq -Rs '{liste: .}' lot.txt > lot.json
      curl -sS --max-time 90 -X POST "$FIESTAPP_URL/api/jour/reserve" \
        -H "Authorization: Bearer $RESERVE_TOKEN" -H "X-Requested-With: quizz" \
        -H "Content-Type: application/json" --data @lot.json
   4. Termine par une ligne : combien de questions ajoutées, combien
      écartées, et pourquoi.
   ```
4. **Vérifier.** Lance-la une fois à la main, depuis la liste des routines, puis regarde `/admin` : le journal des apports dit « Écrite par l'IA », avec ce qu'elle a ajouté et écarté, et **Voir les prochains jours** montre ses questions. Relis-en quelques-unes : c'est la première fois qu'un humain les lit.

5. **Décrire les questions (facultatif, par la même routine).** Chaque question de la réserve peut recevoir ses métadonnées — sous-thème, étiquettes, difficulté estimée, public, leurres, d'où la vérifier —, que les prochaines évolutions liront. (La campagne a sa propre base, déjà étiquetée : `server/content/campagne/`.) Même jeton, même porte : ajoute à la consigne de la routine, après le point 4, ce passage. Il ne coûte rien les jours où tout est déjà décrit.

   ```
   5. Décris ensuite les questions de la réserve qui ne le sont pas encore :
      curl -sS --max-time 90 "$FIESTAPP_URL/api/jour/reserve/etiquetage" \
        -H "Authorization: Bearer $RESERVE_TOKEN" > a-decrire.json
      La réponse donne consigne et questions (cinquante au plus). Si
      questions est vide, dis-le en une ligne. Sinon, décris-les en suivant
      la consigne à la lettre, écris le tableau JSON qu'elle demande dans
      etiquetage.json, puis
      jq '{etiquetage: .}' etiquetage.json > envoi.json
      curl -sS --max-time 90 -X POST "$FIESTAPP_URL/api/jour/reserve/etiquetage" \
        -H "Authorization: Bearer $RESERVE_TOKEN" -H "X-Requested-With: quizz" \
        -H "Content-Type: application/json" --data @envoi.json
      Termine par une ligne : combien décrites, combien refusées, et pourquoi.
   ```

   Le serveur relit chaque description au catalogue des étiquettes : une clé inconnue la refuse entière, et la question attend la passe suivante. La consigne du quiz du jour, elle, apprend d'elle-même ce que disent les joueurs — la difficulté mesurée des dernières questions posées — dès qu'il y en a assez.

6. **Agrandir la base de la campagne (par la même routine).** La campagne solo puise dans sa base à elle (`server/content/campagne/`), et les sentiers du savoir en consomment beaucoup, surtout des questions difficiles. Chaque matin, la routine y ajoute cinq questions par catégorie, soixante par jour, dans les sous-thèmes les moins fournis et aux difficultés qui manquent : le serveur fait la commande. Même jeton, même porte. Ajoute à la consigne de la routine, après le point 5, ce passage :

   ```
   6. Agrandis ensuite la base de la campagne. Travaille dans un dossier
      hors du dépôt (mktemp -d) : rien ne s'écrit dans le dépôt.
      curl -sS --max-time 120 "$FIESTAPP_URL/api/campagne/base" \
        -H "Authorization: Bearer $RESERVE_TOKEN" > commande.json
      La réponse donne aEcrire, parEnvoi et, pour chaque catégorie, aEcrire
      et sa consigne. Si aEcrire vaut 0, dis-le en une ligne et arrête-toi.
      Pour chaque catégorie dont aEcrire > 0, l'une après l'autre :
      a. Écris sa consigne dans un fichier, puis confie-la à l'agent
         redacteur-campagne : il écrit le lot dans lot.json et le vérifie
         (depuis le dossier server du dépôt :
         npx tsx scripts/base-campagne.ts verifier <dossier>/lot.json)
         jusqu'à zéro refus.
      b. Fais relire le lot par l'agent relecteur-campagne, sur sa fiche
         (npx tsx scripts/base-campagne.ts fiche <dossier>/lot.json) ; il
         écrit ses décisions dans <dossier>/decisions.json, que tu
         appliques : npx tsx scripts/base-campagne.ts appliquer <dossier>/decisions.json
      c. Envoie le lot relu, sous sa catégorie :
         jq --arg c "<la catégorie>" '{categorie: $c, entrees: .}' lot.json > envoi.json
         curl -sS --max-time 90 -X POST "$FIESTAPP_URL/api/campagne/base" \
           -H "Authorization: Bearer $RESERVE_TOKEN" -H "X-Requested-With: quizz" \
           -H "Content-Type: application/json" --data @envoi.json
      Termine par une ligne par catégorie : ajoutées, écartées, et pourquoi.
   ```

   Le serveur relit chaque question avec le juge de la base — une question peu sûre, une réponse dans l'intitulé, un leurre oublié : refusée —, écarte ce que la base, la réserve du quiz du jour ou un quiz livré a déjà, et ne prend pas plus de dix questions par catégorie et par jour. Le reste se range dans la base permanente et se joue tout de suite, sans déploiement. À `/admin#campagne`, « La routine du matin » montre ce qu'elle a déposé, et **Retirer** sort une question pour tous ; `/healthz` dit son dernier apport (`campagne.dernierApport`). Les deux agents du projet (`.claude/agents/`) écrivent et relisent sobrement : Sonnet pour écrire, Opus pour relire, à réflexion basse.

La routine vise trois semaines d'avance, et cent questions au plus par passage. Si elle s'arrête — abonnement, jeton changé d'un seul côté, domaine plus permis —, `/admin` le montre : plus de dépôt, puis l'alerte sous sept jours d'avance. En attendant, **Copier la consigne pour une IA** : la même consigne, pour trente questions, à coller dans le chatbot de ton choix ; sa réponse se recolle dans **Coller une liste**.

---

## 4. Créer un compte à un ami

L'application sert plusieurs soirées : chaque ami a son compte, son espace et son adresse, et ne voit rien des tiens.

1. Sur `https://TON-ADRESSE.onrender.com/admin` (toi seul y as accès), remplis **Créer un compte** : son prénom, son identifiant de connexion, le nom de son espace dans l'adresse (`chez-bob`). L'adresse de ses invités s'affiche au fur et à mesure.
2. L'application te donne un **lien d'activation**. Envoie-le-lui comme tu veux (message, mail…). Il vaut **sept jours** et ne sert **qu'une fois**.
3. Il ouvre le lien, choisit son mot de passe, et arrive sur **Mon compte** : le titre de sa soirée, l'adresse de ses invités à copier, ses réglages. Il écrit ses quiz dans **Mes quiz**, anime depuis **Écran commun**, retrouve ses soirées passées sur `/chez-bob/soirees`.

**Mot de passe oublié :** il n'y a pas d'e-mail. Sur `/admin`, le bouton **Lien** de son compte refait un lien d'activation ; il choisit un nouveau mot de passe en l'ouvrant. Ses anciens liens ne valent plus rien.

**Et le tien ?** Le bouton **Lien** n'existe pas pour ton propre compte : il changeait ton mot de passe sans demander l'actuel, et n'importe quelle session de ton compte — la télé branchée chez des amis, ton téléphone prêté en soirée — s'en serait servie pour te mettre dehors. Ton mot de passe se change dans **Mon compte**, en donnant l'actuel. Pour ne jamais rester à la porte, **rattache ton profil de joueur à ton espace** (Mon compte → Mon profil joueur) : se connecter à ton profil ouvre ta console, et son **code de secours** — affiché à son inscription — te rend l'accès si tu oublies tout.

**Désactiver un compte** ferme ses sessions et ses écrans communs sur-le-champ ; ses quiz et ses soirées restent, et ses pages publiques restent lisibles. **Réactiver** rouvre la porte ; il se reconnecte avec son mot de passe.

**Supprimer un compte** — le bouton n'apparaît qu'une fois le compte désactivé — efface tout ce qu'il a laissé : quiz, photos, soirées archivées, soirée en cours, sauvegarde distante comprise, et libère son identifiant et son adresse. Sans retour : exporte d'abord ce que tu veux garder de ses soirées, une à une (`npm run export -- https://TON-ADRESSE.onrender.com --slug chez-bob --soiree <id>`, voir « Exporter une soirée », plus bas). Ton propre compte ne se supprime pas.

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
| Jeu (téléphone) | http://localhost:5173/demo |
| Écran commun | http://localhost:5173/host |
| Mes quiz | http://localhost:5173/edit |
| Mon compte | http://localhost:5173/compte |
| Les comptes | http://localhost:5173/admin |

En local, le compte est `antoine` / `demo` et l'espace `demo` (sauf si tu définis `ADMIN_LOGIN`, `ADMIN_PASSWORD`, `ADMIN_SLUG`, `ADMIN_NAME` avant le premier démarrage). En ligne, c'est le tien. Le QR de l'écran commun, lui, mène au port du serveur (3001), qui ne sert que le client construit : pour jouer depuis un vrai téléphone, voir « Repli » plus bas.

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
node server/scripts/fake-player.mjs http://localhost:3001 Testeur 300 --slug demo
```

Un invité fantôme qui répond au hasard pendant 300 secondes. Lance la commande plusieurs fois pour en avoir plusieurs.

```bash
npm run load -- http://localhost:3001 50 --slug demo
```

Test de charge complet : 50 invités, un quiz joué de bout en bout, et les temps mesurés. Le script se connecte comme l'animateur : `ADMIN_LOGIN` / `ADMIN_PASSWORD` s'ils ne sont pas ceux par défaut.

### Transférer les quiz

```bash
npm run migrate -- --to libsql://TON-URL.turso.io --token TON-JETON
```

Vers un autre espace que le tien : ajoute `--slug chez-bob`. Tes quiz restent à toi : si tu les as déjà transférés chez toi, Bob en reçoit des copies, photos comprises, et relancer la commande met ses copies à jour sans en créer d'autres.

### Exporter une soirée

```bash
npm run export -- https://TON-ADRESSE.onrender.com --slug TON-ESPACE --soiree 2026-09-19-k7x2q-3fz81a
```

Écrit dans `export/TON-ESPACE/2026-09-19-k7x2q-3fz81a/` le bilan complet (`bilan.json`) et trois fichiers Excel : une ligne par invité avec une colonne par question, une ligne par question, une ligne par équipe. L'identifiant d'une soirée se lit dans son adresse, sur `/TON-ESPACE/soirees`. Sans `--soiree`, c'est la soirée en cours — vide dès qu'elle est close. Si le serveur ne répond plus : `npm run export -- --db libsql://TON-URL.turso.io --token TON-JETON --slug TON-ESPACE --soiree …`.

### Sauvegarder la base permanente

Tout le précieux tient dans une seule base Turso : comptes, quiz, photos, soirées archivées, profils. Une fausse manœuvre — un « C'était un essai » sur la mauvaise base, un compte supprimé — et c'est sans retour. D'où une copie chez toi, à faire **avant une soirée et le lendemain** :

```bash
npm run sauvegarde -- libsql://TON-URL.turso.io --token TON-JETON
```

Écrit dans `export/sauvegardes/` un fichier SQL daté (`fiestapp-xxx-2026-09-19-231502.sql`) : toutes les tables, chaque ligne, les photos comprises. Il contient les comptes — mots de passe hachés, mais tout de même : garde-le comme un secret, jamais dans le dépôt (`export/` est ignoré par git). Lance-la hors soirée : elle lit la base table après table, pas d'un seul instantané.

**Restaurer**, toujours dans une base **neuve**, jamais par-dessus l'ancienne :

```bash
turso db create quizz-restauree
```

```bash
turso db shell quizz-restauree < export/sauvegardes/fiestapp-xxx-2026-09-19-231502.sql
```

Puis crée-lui un jeton, et pointe `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` du service dessus. Sans Turso, `sqlite3 restauree.db < export/sauvegardes/….sql` en fait un fichier qu'un PC sert tel quel (`QUIZ_DB_URL=file:` suivi de son chemin complet). Ces deux commandes se tapent dans un terminal bash — WSL ou Git Bash sous Windows : PowerShell ne connaît pas `<`.

**Turso garde aussi un historique**, sans fichier à faire : il sait recréer la base telle qu'elle était à un instant donné, dans une base neuve.

```bash
turso db create quizz-restauree --from-db fiestapp --timestamp 2026-09-19T22:00:00+02:00
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

Tout est alors servi sur `http://IP-DE-TON-PC:3001` : le QR de l'écran commun montre de lui-même cette adresse, suivie du nom de ton espace (`http://IP-DE-TON-PC:3001/TON-ESPACE`). Les téléphones doivent être sur le **même wifi**. À faire une seule fois, dans un PowerShell **administrateur** :

```powershell
Set-NetConnectionProfile -NetworkCategory Private
```

```powershell
New-NetFirewallRule -DisplayName "Quizz" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001,5173
```

Avec un routeur wifi sans internet, renseigne `WIFI_SSID` et `WIFI_PASS` : l'écran commun affiche alors deux QR codes (1️⃣ rejoindre le wifi, 2️⃣ ouvrir le quiz).

En HTTP, les téléphones ne savent pas garder leur écran allumé tout seuls — il y faut HTTPS : un bandeau « Garde ton écran allumé pendant le quiz » le demande aux invités. Rappelle-le à voix haute avant le premier quiz : un téléphone qui s'endort en pleine question la rate.

---

## 6. Le jour de la soirée

1. **La veille** : ouvre l'adresse publique pour confirmer que tout répond. De 7 h à minuit, elle répond tout de suite ; si elle met une minute, le serveur dormait : regarde la routine du matin (étape 8) et la tâche de cron-job.org (étape 5). Dans **Mon compte**, vérifie le titre de la soirée et la date : ce sont eux que voient les invités.
2. **5 minutes avant — le geste à ne pas oublier** : connecte-toi et ouvre l'écran commun sur le vidéoprojecteur. Tant qu'un écran est connecté, le serveur ne s'endort pas, après minuit compris. De 7 h à minuit, il est déjà debout (étape 5) ; si le réveil du matin a manqué ou que la tâche de cron-job.org s'est arrêtée, c'est ce geste qui le réveille — sans lui, le premier invité qui scanne attendrait une minute devant une page blanche.
3. Vérifie le son : le haut-parleur, à droite de la console, en bas de l'écran commun (les sons ne sortent que de là, jamais des téléphones).
4. Les invités scannent le QR de l'écran commun — il mène à l'adresse de ton espace — : « Me connecter » pour qui a un profil, « Jouer sans compte » pour les autres, puis un prénom et un avatar. Qui ouvre l'accueil de l'application (l'adresse publique seule) y touche « Rejoindre une soirée », puis tape le nom de ton espace.
5. **Lancer un quiz** → choisis **points normaux, ×2 ou ×3**, puis le quiz → le 3-2-1 démarre. Annonce le multiplicateur à la salle : c'est ce qui garde tout le monde dans la course.
6. Pendant une question : **Révéler** sans attendre le chronomètre, ou **Pause** pour un discours. L'action principale est toujours à gauche de la console ; **Terminer**, à droite avec Reposer et Annuler les points, demande confirmation : la fin d'un quiz ne se rattrape pas.
7. Après la révélation : **Reposer** la question, ou **Annuler les points** si la bonne réponse était fausse — l'écran commun et les téléphones affichent alors « Points annulés ». L'un comme l'autre demande confirmation. Un clic de trop ne casse rien : Révéler, Question suivante, Reposer et Annuler les points disent quelle question ils visaient, et celui qui arrive après que la partie a avancé est ignoré.
8. **Suivante : au clic · 5 s · 10 s · 20 s** : en automatique, tu ne cliques plus entre les questions — 5 s pour enchaîner sans commenter, 20 s pour laisser rire la salle ; « au clic » reprend la main.
9. Un pseudo malheureux ? Entre deux quiz, clique dessus dans la liste des invités pour le renommer, ou sur la croix pour l'exclure.
10. À la fin : **Podium**, dans la console — avec des équipes, deux onglets, les équipes et les joueurs ; côté joueurs, le classement de la soirée, le plus beau coup, le plus régulier et le vainqueur de chaque quiz, de quoi remettre plusieurs cadeaux. **Prix** montre le palmarès de la soirée. Des ex æquo partagent leur marche, et les vainqueurs ex æquo d'un quiz leur carte : ils ont gagné ensemble, prévois un cadeau pour chacun. Fais scanner le QR de la page souvenir.
11. Entre deux quiz, le classement de la soirée reste affiché et **se cumule**.
12. **En fin de soirée — Clore la soirée** (sur l'accueil de l'écran commun, et après l'écran de victoire). La soirée s'est déjà rangée toute seule dans l'historique après chaque quiz ; la clôture la range une dernière fois, sous le titre que tu lui donnes, décide de ce qui ne se juge qu'à la fin — podium de la soirée, prix, hauts faits, paliers, avatars légendaires —, envoie à chaque téléphone sa fin de soirée, et prépare la suivante. Sans elle, la soirée reste « en cours », et la prochaine s'y ajouterait. **C'était un essai**, dans la même fenêtre, efface tout sans rien garder.
13. **Le lendemain** : la soirée close se relit pour toujours sur `https://TON-ADRESSE.onrender.com/TON-ESPACE/soirees` — souvenir (podium, palmarès, tous les chiffres) et bilan, où chacun relit ses réponses question par question. Le QR affiché à la clôture et le lien de la fin de soirée, sur chaque téléphone, y mènent déjà ; celui du podium aussi, jusqu'à la prochaine soirée : le souvenir et le bilan de ton espace montrent la dernière soirée close tant que la suivante n'a rien joué. Poste dans le groupe l'adresse de son bilan (`…/TON-ESPACE/soirees/<id>/bilan`) : chacun y choisit son prénom, et « Copier le lien de ce bilan » donne ensuite celle du sien. Les pages à imprimer, une par invité, sont à la même adresse, suivie de `/fiches`, et `npm run export` garde tout en fichiers (voir « Exporter une soirée »).

Les retardataires rejoignent en cours de partie : ils jouent les questions suivantes, sans rattraper les précédentes.

---

## 7. Si ça coince

| Symptôme | Cause probable | Quoi faire |
|---|---|---|
| Page blanche ~1 min au premier scan | serveur endormi (offre gratuite, 15 min sans trafic) ; entre 7 h et minuit, le réveil du matin a manqué ou la tâche de cron-job.org ne l'appelle plus | attendre le réveil ; regarder la dernière exécution de la routine de la réserve (étape 8) et l'historique de la tâche sur cron-job.org (étape 5) ; la prochaine fois, ouvrir l'écran commun cinq minutes avant |
| « Le serveur redémarre — patiente une minute, puis réessaie » | c'est l'hébergeur qui répond à la place de l'application (502, 503, 504) : un déploiement ou un réveil en cours | patienter une minute ; ne pas déployer pendant une soirée — la production ne se déploie qu'à la main (étape 7) |
| « Identifiant ou mot de passe incorrect » | faute de frappe, ou le mot de passe d'amorçage a été changé depuis « Mon compte » | réessayer ; pour un ami, refaire un lien d'activation depuis `/admin` |
| « Trop d'essais — réessaie dans un quart d'heure » | cinq échecs de suite sur un même identifiant — les portes qui vérifient le même mot de passe (connexion, rattachement d'un profil, changement de mot de passe) se ferment ensemble —, ou vingt essais depuis une même adresse, toutes portes confondues (puis vingt par minute) : le wifi de la salle n'est qu'une adresse | attendre : un quart d'heure pour un mot de passe verrouillé, une minute suffit à l'adresse ; c'est le garde-fou contre la force brute |
| Le serveur refuse de démarrer : « ADMIN_PASSWORD manquant » | premier démarrage sur une base Turso sans aucun compte, et mot de passe absent ou laissé à celui par défaut | définir `ADMIN_PASSWORD` sur Render le temps de ce démarrage ; une fois le compte créé, la variable peut partir |
| Le serveur refuse de démarrer : « QUIZ_DB_URL manquant » | le service n'a pas de base permanente : il écrirait sur un disque qui s'efface à chaque réveil | renseigner `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` — la base de CE service, production ou préproduction |
| Le serveur refuse de démarrer : « Base permanente injoignable » | adresse ou jeton faux, jeton révoqué, base supprimée, Turso en panne — le détail suit le message | vérifier `QUIZ_DB_URL` et `QUIZ_DB_TOKEN` sur la page de la base Turso ; au besoin, un jeton neuf (étape 2) |
| L'écran commun demande de se connecter | pas de session sur ce navigateur, ou session fermée (déconnexion, mot de passe changé, compte désactivé ou supprimé) | se reconnecter |
| « Cette adresse ne mène à aucune soirée » | le nom d'espace de l'adresse n'existe pas (faute de frappe, compte désactivé ou supprimé) | vérifier l'adresse dans « Mon compte » ; scanner le QR de l'écran |
| « Aucun quiz prêt à jouer — créez-en un dans l'espace animateur (/edit) » au lancement | la bibliothèque de cet espace est vide, ou ses quiz n'ont que des questions incomplètes | écrire un quiz dans `/edit` — ou en importer un —, compléter ce qui porte un ⚠️, ou relancer la migration (étape 4) pour le tien |
| « Pas de quiz aujourd'hui : la réserve de questions est vide » au quiz du jour | la routine qui remplit la réserve ne tourne pas, ou n'a jamais été créée (étape 8) : abonnement, jeton changé d'un seul côté, domaine plus permis. Le journal du service dit `[jour] réserve à sec` | pour aujourd'hui : `/admin`, « Copier la consigne pour une IA », puis sa réponse dans « Coller une liste » ; ensuite, réparer la routine (étape 8) |
| La routine lit « Le dépôt automatique n'est pas ouvert sur ce serveur » | `RESERVE_TOKEN` absent de ce service, ou plus court que trente-deux caractères | le poser sur Render, avec **Generate** (étape 8, point 1) |
| La routine lit « Jeton de la réserve refusé » | le jeton de Render et celui de l'environnement Claude Code ne sont plus les mêmes | recopier la valeur de Render dans l'environnement (étape 8, point 2) |
| Un invité ne voit rien après avoir répondu | c'est normal | la question est sur l'écran commun ; son téléphone attend la révélation |
| Un téléphone affiche « Connexion perdue — reconnexion… » (en salle d'attente : « reconnexion… ») | réseau du téléphone : wifi coupé, 4G perdue, mode avion | il se reconnecte tout seul — au retour du réseau ou au rallumage de l'écran, en deux secondes —, son score est conservé |
| Un téléphone affiche « On ne te retrouve plus dans cette soirée — rejoins-la » | son invité n'existe plus : exclu pendant que le téléphone dormait, ou essai effacé (**C'était un essai**) | rien : l'entrée s'ouvre, pré-remplie de son prénom |
| Quiz modifié en ligne puis écrasé | migration relancée après coup | une fois en ligne, n'écris plus qu'en ligne |
| Les scores des essais sont encore là | la sauvegarde distante les a gardés | **Clore la soirée → C'était un essai** sur l'écran commun : tout s'efface, archive et expérience comprises |
| « La soirée est complète » | plus d'inscrits que le réglage de l'espace (150 par défaut ; les essais comptent) | **Clore la soirée** (ou « C'était un essai »), ou relever « Invités au plus » dans « Mon compte » — mais sur l'offre gratuite, pas au-delà de 150 environ : le coût des diffusions grandit plus vite que la salle, sur une instance qui n'a qu'un dixième de processeur (voir le test de charge du README). `MAX_PLAYERS=150` dans les variables de Render l'impose à tous les espaces |
| « Trop d'inscriptions d'un coup » | plus de 60 arrivées d'un coup dans une même soirée depuis une même adresse (puis 60 par minute ; 300 sur tout le serveur), plus de trois identités créées par une même connexion, ou plus de dix profils créés d'un coup depuis une même adresse (puis cinq par minute) | attendre une minute ; c'est le garde-fou contre les robots — une salle de 150 derrière une seule box entre en moins de deux minutes |
| Le bilan dit « Le quiz a été modifié depuis la soirée », ou l'export « intitulé non retrouvé » | il n'avait pas la copie exacte du quiz joué — une soirée d'avant ces copies, ou un export `--db` de la soirée en cours — et a relu la bibliothèque, où le quiz a été supprimé, renommé ou retouché depuis | remettre le quiz comme il était (même titre, mêmes questions dans le même ordre), ou exporter par l'adresse du serveur plutôt que par `--db` ; les points et les numéros, eux, sont intacts |
| Une soirée manque sur `/TON-ESPACE/soirees` | elle est encore en cours — elle s'affiche à part, en tête de la liste —, ou elle a été effacée comme un essai | une soirée en cours se clôt depuis l'écran commun ; un essai effacé ne se récupère pas, les fichiers de `npm run export`, s'ils ont été faits, le gardent |
| Un vieux lien `/bilan` ou `/soirees/…` | l'adresse d'avant les comptes | elle redirige toute seule vers ton espace ; rien à faire |
| « Erreur serveur — réessaie dans un instant » sur l'écran commun, « Le serveur a un souci — réessaie dans un instant » sur une page | une panne interne — base distante qui refuse, archive abîmée… Son détail ne s'affiche jamais, ni aux invités ni sur l'écran projeté : il part au journal | réessayer ; si ça dure, chercher `[http]` ou `[socket]` dans les journaux du service (Render → *Logs*) : la ligne nomme la requête ou le geste qui a échoué, et la vraie erreur |
| « Sauvegarde en retard — la soirée continue », à côté du titre de l'écran commun | la base Turso refuse les écritures depuis une dizaine de secondes : Turso en panne, jeton révoqué, base supprimée… | la soirée continue, et rien n'est perdu tant que le serveur tourne : la file réessaie jusqu'au succès, et la pastille s'en va d'elle-même au rétablissement. D'ici là, garde un écran connecté et ne déploie pas — un serveur qui s'endort ou redémarre perd son disque, et la file avec. `/healthz` dit depuis quand ça dure et combien d'écritures attendent (bloc `miroir`) ; vérifie la base et son jeton sur turso.tech |

Un redémarrage du serveur en pleine partie n'est pas grave : la partie en cours est recopiée dans la base distante à chaque question posée ou révélée — avec ses gains, d'un seul tenant : une révélation ne se paie jamais deux fois au réveil —, et au plus toutes les deux secondes pendant qu'on répond. Elle reprend là où elle en était (au pire, deux secondes de réponses en moins), ses chronomètres réarmés à leur heure, les scores sont intacts et les téléphones se reconnectent seuls — pour chaque espace. À une condition : que la sauvegarde ait suivi. Si l'écran commun affichait « Sauvegarde en retard », ce qui attendait encore d'être écrit part avec le disque.

### Ce que dit `/healthz`

`https://TON-ADRESSE.onrender.com/healthz` répond toujours 200 (un échec ferait redémarrer l'instance, disque effacé), sans un nom ni une adresse, tous espaces confondus. « Par minute » et « sur la dernière minute » veulent dire ici : la minute en cours et la précédente, donc une à deux minutes selon l'instant où l'on lit.

| Champ | Ce qu'il dit | À surveiller |
|---|---|---|
| `espacesActifs`, `quizEnCours`, `podiumsAffiches` | les soirées qui vivent vraiment (`spaces` et `quizzes` comptent aussi ce qui dort) | ne pas déployer tant que `quizEnCours` n'est pas à 0 |
| `maxPlayers` | le plafond d'invités en vigueur (`MAX_PLAYERS`) | 150 sur l'offre gratuite |
| `charge.cpuPct` | le processeur du processus, en pour cent d'un cœur | l'offre gratuite n'en a qu'un dixième : au-delà de 10, le serveur est à son plafond |
| `charge.boucleOccupeePct`, `retardBoucleP99Ms`, `retardBoucleMaxMs` | la part du temps où le serveur travaille, et ce qu'attend un message d'invité | un retard de plusieurs centaines de ms se sent au téléphone |
| `charge.retardChronosMaxMs`, `charge.chronosMesures` | de combien une révélation a sonné en retard, et combien de chronomètres ont sonné (un retard de 0 sans aucun chronomètre ne dit rien) | au-delà d'une seconde, le journal le dit aussi (`[partie] chronomètre … en retard`) |
| `pages` | le souvenir et le bilan : servis, calculés, leur coût, ce qui est gardé en mémoire | une page de plus de 500 ms se dit au journal (`[pages]`) |
| `inscriptions.clesDistinctes` | les adresses distinctes vues par la réserve d'inscriptions | voir plus bas |
| `reponses.tropTardParMin` | des réponses refusées pour « trop tard » | en hausse avec la charge : le serveur prend du retard |
| `miroir` | la santé de la sauvegarde dans Turso, et la durée de ses envois | voir « Sauvegarde en retard » ci-dessus |
| `memoire`, `rssMo` | le tas, la mémoire du processus, les connexions ouvertes | 512 Mo sur l'offre gratuite |
| `version` | le commit qui tourne, sept caractères (`RENDER_GIT_COMMIT`) — la ligne `[serveur] prêt …` du journal le dit aussi | après un « Manual Deploy », que c'est bien le bon |
| `jour.joursDAvance`, `jour.dernierApport` | l'avance de la réserve du quiz du jour, et l'heure du dernier apport (en millisecondes) — relues au plus toutes les dix minutes, absentes juste après un réveil | sous sept jours, la routine ne dépose plus (étape 8) |
| `campagne.ajoutees`, `campagne.dernierApport` | ce que la routine du matin a déposé dans la base de la campagne, et quand (en millisecondes) — lus en mémoire | un dernier apport de plus d'un jour : la routine ne passe plus par son point 6 (étape 8) |

Chaque réveil de l'offre gratuite remet ces compteurs à zéro : ce qui compte part aussi au journal. À chaque clôture, `[soirée] close en … ms : N invités, … ; la réserve d'inscriptions a vu K adresses`. Une salle de téléphones en 4G sous une ou deux adresses veut dire que le serveur lit celle du proxy de Render, pas celle du téléphone — et que toute la salle partage une seule réserve d'inscriptions. Au premier refus d'une adresse dans la minute, `[inscriptions] réserve épuisée pour l'adresse …` donne une empreinte (jamais l'adresse) et le nombre d'entrées de `x-forwarded-for`.

### Le serveur tombe en pleine partie, et ne revient pas

Render en panne, ou un redémarrage qui échoue en boucle : la soirée n'est pas perdue, elle est dans Turso. Elle repart d'un PC, dans cet ordre :

1. **Suspendre le service Render** (tableau de bord → *Settings* → *Suspend Web Service*). Jamais deux serveurs qui écrivent dans la même base : celui de Render, s'il revenait tout seul, repartirait d'une soirée que le PC aurait déjà fait avancer.
2. **Lancer le serveur sur le PC avec la base de production** — le client compilé (`npm run build`), puis, dans PowerShell :

   ```powershell
   $env:QUIZ_DB_URL="libsql://TON-URL.turso.io"; $env:QUIZ_DB_TOKEN="TON-JETON"; $env:DB_PATH="$env:TEMP\quizz-secours.db"; npm start
   ```

   Il recharge invités, points et partie en cours depuis le miroir — à condition de partir d'une base locale **vide** : c'est pour ça que `DB_PATH` pointe vers un fichier neuf, et non vers celle de tes essais, qui ferait autorité.
3. **Faire rescanner le QR de l'écran commun** : ouvre `http://localhost:3001/host` sur le vidéoprojecteur, connecte-toi, et le QR montre la nouvelle adresse (celle du PC, sur le wifi de la salle — voir « Repli » plus haut pour le pare-feu). Qui a un profil le retrouve en s'y connectant, points compris ; un invité anonyme, lui, repart sous une nouvelle identité — ses points restent au classement, sous l'ancienne.

La soirée finie, **Clore la soirée** depuis l'écran du PC — elle se range dans Turso comme d'habitude —, arrête le PC, puis relance le service Render (*Resume Web Service*) : il repart de la base, où le PC a tout écrit.
