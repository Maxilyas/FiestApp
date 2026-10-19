---
paths:
  - "server/src/core/{rappels,pousser}.ts"
  - "client/public/{sw.js,manifest.webmanifest}"
  - "client/src/{rappel,installation}.ts"
  - "client/src/components/{RappelDuJour,Installer}.tsx"
  - "server/test/{rappel,installation}.test.ts"
  - "server/scripts/rendu-cloches.ts"
---

# Le rappel du soir et l'application installée

## Les fichiers

- `shared/jour.ts` (`HEURE_DU_RAPPEL`) · `core/rappels.ts` · `core/pousser.ts` · `client/public/sw.js` · `client/src/rappel.ts` · `components/RappelDuJour.tsx` — le rappel du soir du quiz du jour : dans l'application installée seulement (`estInstallee`, `installation.ts`), une petite cloche en haut de la page du jour, à côté de la sortie (`BarreDuJour`, `ClocheVue`), abonne le téléphone au service de push de son navigateur, et la coupe d'un second toucher — au toucher même, rien d'attendu avant : l'iPhone ne demande la permission qu'au geste (`activerLeRappel`) ; pas de bouton en pleine page (le choix du 4 octobre 2026) ; vers 18 h à Paris (`HEURE_DU_RAPPEL`, jusqu'à `FIN_DU_RAPPEL`), une notification, une seule par téléphone et par jour, à qui n'a pas fini sa partie (`JourStore.pourLeRappel`), réservée en base avant l'envoi (`dernier_jour`) — un redémarrage ou un second serveur ne la renvoie pas. Attachée à la session qui l'a demandée (une déconnexion la défait, la page du jour la rattache à chaque visite), cinq téléphones par profil, et seulement vers les services de push des navigateurs (`serviceDePushConnu`). Le Web Push sans bibliothèque (`pousser.ts` : VAPID et aes128gcm, prouvés sur l'exemple de la RFC 8291), les clés du serveur tirées au premier démarrage et gardées dans Turso (`jour_rappels_cles`) ; `/healthz` dit la dernière tournée (`rappel.test.ts`), et chaque soir garde son bilan pour le QG (`jour_rappels_tournees` : envoyés, déjà joué, échecs, abonnements défaits — une seconde tournée le même soir s'y ajoute, « déjà joué » garde le plus grand ; `RappelStore.suivi`, règle `qg.md`, `qg-jour.test.ts`)
- **Le rappel du soir est la seule notification d'un joueur.** (L'administrateur a la sienne depuis le 19 octobre 2026 : la panne d'un mode de jeu, sur son téléphone — le même service worker sous `/admin`, son abonnement à lui, ni session ni soir, règle `qg.md`.) Les duels et les défis d'amis ont eu la leur, du 11 au 13 octobre 2026 — leur cloche en haut de la page des duels, sur le même abonnement, sa colonne `defis` —, partie le 13 : « je ne veux pas que les gens reçoivent trop de notifications, uniquement le quiz du jour » (le propriétaire) ; l'accueil dit déjà, en arrivant, ce qui attend dans ses duels (`DuelsDAccueil`, règle `duels.md`). Ni un défi, ni un duel classé, ni son résultat ne sonnent, pas même chez qui l'avait allumée (`rappel.test.ts`). La colonne `defis` reste dans les bases d'alors, que plus rien ne lit ni n'écrit ; un téléphone qui n'avait allumé qu'elle y garde son soir éteint : la page du jour qui le rattache le lit éteint, et l'efface chez le serveur puis chez son service (`preparerLeRappel`) — gardé, sa session close l'aurait fait rattacher le soir allumé (un téléphone inconnu prend le soir). Une page d'avant, restée ouverte sur les duels, demande encore leur cloche (`quoi: 'defis'`) : rattachée ou coupée, elle ne change rien et lit le réglage du soir — le téléphone ne se désabonne pas de ce qui sonne encore —, et l'allumer est refusé (`quizDuJour.ts`). Les défis encore en route chez le service de push, gardés une semaine au plus, arrivent avec leur étiquette et leur adresse, que le service worker garde (`tag`, `navigate`)
- `client/src/installation.ts` · `components/Installer.tsx` — l'application sur l'écran d'accueil : au pied de l'accueil d'un téléphone (`telephoneDe` : l'iPhone et l'iPad ensemble, Android ; rien sur un ordinateur, rien dans l'application installée — `estInstallee`, que le rappel du soir lit aussi), une ligne repliée — l'icône, « Installer l'application », une flèche — qu'un toucher déroule : ce qu'elle apporte, les gestes de chaque téléphone, un onglet chacun, le sien d'abord ; sur Android, l'invitation de Chrome (`beforeinstallprompt`), gardée dès le démarrage de chaque page hors de l'écran commun (`ecouterLInstallation`, `main.tsx`) — elle ne surgit plus d'elle-même en pleine soirée —, s'offre d'un toucher (`installer`, une fois) ; « Ne plus afficher » la masque sur ce téléphone (`quizz.installer.masquee`, sous try/catch). Petite, exprès (le choix du 4 octobre 2026). Sans profil, elle passe sous les trois gros boutons (`ProfilForm`, `pied`), qui restent visibles sans défiler (`installation.test.ts`) ; avec un profil, sous ses gros boutons, et elle promet alors le rappel du soir (`avecProfil`). Ce qui s'installe, c'est la page, d'après son manifeste (`client/public/manifest.webmanifest` : `/`, plein écran, portrait)

## Les pièges

- **Le service worker (`client/public/sw.js`) ne fait que la
  notification** — l'afficher, ouvrir sa page au toucher, et rendre au
  serveur l'abonnement que son service renouvelle (`pushsubscriptionchange`,
  avec `ancien` : il en garde le réglage) : ni cache, ni `fetch`. Enregistré
  une seconde fois sous `/admin`, il est celui des alertes du QG : sa portée
  lui dit son texte par défaut, sa page et sa route (`DU_QG`), et le bac à
  sable de `rappel.test.ts` lui donne la sienne (`scope`), comme un
  navigateur. Inscrit depuis l'application installée, il
  couvre toute l'origine, onglets compris : un cache servirait une vieille
  application à toute une salle, et un `fetch` qui échoue ferait une page
  blanche. Il s'écrit à la main, hors du paquet (son adresse décide de ce
  qu'il couvre), et se rejoue sans navigateur (`rappel.test.ts`, dans un bac
  à sable `vm`).
