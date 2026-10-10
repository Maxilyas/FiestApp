---
name: peindre
description: Refaire ou ajouter une image peinte de FiestApp — un portrait des avatars du savoir, un légendaire, un Divin, un décor de thème ou une page du calendrier des Heures — par la chaîne de server/scripts/anime/ (Nano Banana) : générer en lot, juger la planche, livrer sous empreinte. À utiliser avant de toucher server/scripts/anime/ ou un fichier peint de client/public/.
---

# Peindre

Chaque image peinte a sa chaîne : une consigne, un lot payé (le journal des
coûts le garde), une planche à juger à l'œil, puis une livraison qui pose les
fichiers sous leur empreinte et réécrit le module qui les cite. Rien ne se
retouche à la main, et une image payée ne se jette pas.

## Les chaînes

- `server/scripts/anime/styles.ts` · `gemini.ts` · `consignes.ts` · `athena-croquis.svg` — un style d'image par branche, essayé sur sa forme ultime en illustration complète — la planche dans le cadre du sixième palier, le coût estimé de chaque image (`journal-styles.json`, pour tenir le budget), Athéna d'après le prototype de l'artifact (`athena-croquis.svg`) ; le client Nano Banana (un appel, ou un lot à moitié prix qui se reprend par son nom) ; et les consignes : le style de chaque branche et son échelle, les sujets, ce que chaque découpe garde et retire
- `server/scripts/anime/portraits.ts` · `pixels.ts` · `livrer.ts` — la chaîne des portraits peints : le visage sur un fond uni (magenta pour qui porte du vert), puis une illustration entière par palier, et sa découpe — le personnage repeint sur un fond uni, qui en donne la forme — ; la forme ultime est l'image validée par l'essai des styles. Deux passes en lot, un journal des coûts (`journal-portraits.json`), un `⚠` sur la découpe qui ne retombe pas sur son illustration ; `--regenerer` et `--redecouper` repaient, l'ancienne image mise de côté. `pixels.ts` détoure, aligne et assemble dans Chromium ; `livrer.ts` pose les fichiers sous leur empreinte et réécrit le module de la branche. Le filtre de Google refuse ce qui ressemble à un personnage protégé (`PROHIBITED_CONTENT`, Thor) : la consigne en garde la trace
- `server/scripts/anime/legendaires.ts` · `server/scripts/planche-medaillons.ts` — la chaîne des légendaires et des Divins peints : pour chaque légendaire, son illustration (une créature colossale dans sa scène, la feuille d'or que la pellicule attrape), sa version rare repeinte sur la même pose et sa découpe ; pour chaque Divin, son bijou sur un fond uni (magenta pour l'Arbre-Monde et ses feuilles d'émeraude). En lot, un journal des coûts (`journal-legendaires.json`), un `⚠` sur la découpe douteuse ; `--regenerer`, `--rare` et `--redecouper` repaient, l'ancienne image mise de côté ; `--livrer` pose les fichiers sous leur empreinte et réécrit `legendaires-peints.ts` et `divins-peints.ts`. Le modèle peint parfois un cadre de carte autour de l'illustration : le disque le laisse dehors, et la consigne du Fantôme le lui interdit en toutes lettres. La planche les photographie tous, dans tous leurs états et sur le podium, sous la vraie feuille de style, en Velours et en Ivoire
- `server/scripts/anime/decors.ts` · `client/src/components/calendrier-peint.ts` · `server/scripts/rendu-themes.ts` — les décors peints : les douze pages du Calendrier des Heures et leur dorée (repeinte sur la même composition), les quatre thèmes peints (l'Horloge astronomique — un cadran repeint en deux temps, ses aiguilles et ses engrenages détourés et recentrés sur leur pivot —, le Ciel du jour en quatre lumières du même paysage, le folio des Très Riches Heures, le Sommet et ses drapeaux) et les fonds du Triomphe et du Cadran solaire. Rien ne se paie sans `--groupe`, `--seulement` ou `--tout` ; un journal des coûts (`journal-decors.jsonl`) et un budget (`BUDGET`) ; `--livrer` pose les fichiers dans `client/public/decors` sous leur empreinte (`/decors`, servis un an), écrit `calendrier-peint.ts` et réécrit le bloc de chaque feuille qui les cite. L'heure de Paris que lisent l'Horloge, le Ciel et les Heures (`data-ciel`, `data-mois`, les angles des aiguilles) vient de `themeJoueur.ts`, une fois par minute, seulement sous ces trois thèmes (`decors-peints.test.ts`). `rendu-themes.ts` photographie un thème dans l'application à l'heure voulue et mesure le contraste de chaque ligne sur ce qui est peint derrière elle

## Refaire une image

- **Un portrait peint se refait par la chaîne, jamais à la main** :
  `portraits.ts <branche> --lot --regenerer=br:x` (l'image d'avant mise de
  côté, jamais jetée : elle a été payée), un coup d'œil à sa planche
  (`planche-portraits.ts`), puis `livrer.ts`, qui pose ses fichiers sous
  leur nouvelle empreinte, retire les anciens et réécrit le module de sa
  branche — `branches.test.ts` refuse un fichier que plus personne ne cite.
  Une découpe se juge à l'œil : le modèle garde parfois le décor (le papier
  découpé de la forêt, les vagues, les montagnes du low poly) — le champ
  `retirer` de sa consigne le lui nomme, `--redecouper` la repaie seule. Et
  le sujet se relit sur l'ancien dessin (sa référence, `ref-*.png`) : de
  longs cheveux blancs lus comme une barbe avaient fait de la mage un vieux
  magicien. Les originaux (1024 px) restent dans `export/`, hors du dépôt.
  Un légendaire ou un Divin de même : `legendaires.ts --lot
  --regenerer=lg:x`, un coup d'œil à sa planche (`planche-medaillons.ts`),
  puis `--livrer` — `medaillons-peints.test.ts` refuse un fichier que plus
  personne ne cite.
