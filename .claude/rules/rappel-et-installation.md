---
paths:
  - "server/src/core/{rappels,pousser}.ts"
  - "client/public/sw.js"
  - "client/src/{rappel,installation}.ts"
  - "client/src/components/{RappelDuJour,Installer}.tsx"
  - "server/test/{rappel,installation}.test.ts"
---

# Le rappel du soir et l'application installée

## Les fichiers

- `shared/jour.ts` (`HEURE_DU_RAPPEL`) · `core/rappels.ts` · `core/pousser.ts` · `client/public/sw.js` · `client/src/rappel.ts` · `components/RappelDuJour.tsx` — le rappel du soir du quiz du jour : dans l'application installée seulement (`estInstallee`, `installation.ts`), une petite cloche en haut de la page du jour, à côté de la sortie (`BarreDuJour`, `ClocheVue`), abonne le téléphone au service de push de son navigateur, et la coupe d'un second toucher — au toucher même, rien d'attendu avant : l'iPhone ne demande la permission qu'au geste (`activerLeRappel`) ; pas de bouton en pleine page (le choix du 4 octobre 2026) ; vers 18 h à Paris (`HEURE_DU_RAPPEL`, jusqu'à `FIN_DU_RAPPEL`), une notification, une seule par téléphone et par jour, à qui n'a pas fini sa partie (`JourStore.pourLeRappel`), réservée en base avant l'envoi (`dernier_jour`) — un redémarrage ou un second serveur ne la renvoie pas. Attachée à la session qui l'a demandée (une déconnexion la défait, la page du jour la rattache à chaque visite), cinq téléphones par profil, et seulement vers les services de push des navigateurs (`serviceDePushConnu`). Le Web Push sans bibliothèque (`pousser.ts` : VAPID et aes128gcm, prouvés sur l'exemple de la RFC 8291), les clés du serveur tirées au premier démarrage et gardées dans Turso (`jour_rappels_cles`) ; `/healthz` dit la dernière tournée (`rappel.test.ts`)
- `client/src/installation.ts` · `components/Installer.tsx` — l'application sur l'écran d'accueil : au pied de l'accueil d'un téléphone (`telephoneDe` : l'iPhone et l'iPad ensemble, Android ; rien sur un ordinateur, rien dans l'application installée — `estInstallee`, que le rappel du soir lit aussi), une ligne repliée — l'icône, « Installer l'application », une flèche — qu'un toucher déroule : ce qu'elle apporte, les gestes de chaque téléphone, un onglet chacun, le sien d'abord ; sur Android, l'invitation de Chrome (`beforeinstallprompt`), gardée dès le démarrage de chaque page hors de l'écran commun (`ecouterLInstallation`, `main.tsx`) — elle ne surgit plus d'elle-même en pleine soirée —, s'offre d'un toucher (`installer`, une fois) ; « Ne plus afficher » la masque sur ce téléphone. Petite, exprès (le choix du 4 octobre 2026). Sans profil, elle passe sous les trois gros boutons (`ProfilForm`, `pied`), qui restent visibles sans défiler (`installation.test.ts`)

## Les pièges

- **Le service worker (`client/public/sw.js`) ne fait que le rappel du
  soir** : ni cache, ni `fetch`. Inscrit depuis l'application installée, il
  couvre toute l'origine, onglets compris : un cache servirait une vieille
  application à toute une salle, et un `fetch` qui échoue ferait une page
  blanche. Il s'écrit à la main, hors du paquet (son adresse décide de ce
  qu'il couvre), et se rejoue sans navigateur (`rappel.test.ts`, dans un bac
  à sable `vm`).
