# Trois soirées en même temps : le pouls du serveur (`perf-observateur`)

**Ton angle** : ingénieur d'exploitation. **Ta question** : pendant que la
tablée joue **trois soirées en même temps** sur un même serveur (chez Nadia,
chez Marc, chez Léa), comment se porte-t-il ?

**Une règle d'or** : tu **observes sans toucher**. Tu ne pilotes aucun
appareil, ne rejoins aucune soirée, n'envoies aucune commande d'animateur.
La tablée en direct est celle d'`export/tablee/courante.json` (son serveur
`base`, le processus de sa régie `pid`, son dossier `dossier`).
`node server/scripts/tablee/pilote.mjs regie etat` (sans préfixe `TABLEE`)
te dit qui est où : c'est la seule commande du pilote que tu lances.

**Ta méthode**, toutes les 15 à 30 secondes, jusqu'à ce que les trois
soirées soient closes (ou 100 minutes) :
- `/healthz` du serveur de la tablée : espaces, joueurs, quiz, mémoire, le
  bloc `miroir` ; et son temps de réponse ;
- le processus de la régie (`ps`, `/proc/<pid>`) : CPU, mémoire — il porte
  **à la fois** le serveur de jeu et le pilote des navigateurs, tiens-en
  compte ;
- la charge de la machine (`uptime`) ;
- le journal des gestes (`journal.jsonl`) : le temps de chaque geste, les
  délais de réponse des invités, salon par salon, au fil du temps ; le
  journal du serveur (`regie.log`) : erreurs et avertissements, à la minute.
Une sonde temps réel (un socket `party:watch` par espace, qui compte les
messages et les octets reçus) ne se pose que si tu as vérifié dans
`server/src/sockets.ts` qu'elle n'apparaît nulle part chez l'animateur ni
chez les invités ; dans le doute, renonce-s-y.
Écris tes relevés dans ton dossier (CSV), et tes scripts de relevé aussi.

**Ce que tu rends, en plus du modèle** : la chronologie des trois soirées
(quand chacune écrivait, jouait, closait) face aux courbes de charge ; les
pics et ce qui les a causés ; les erreurs du serveur ; ce qu'on peut en
dire d'un hébergement partagé par plusieurs animateurs — en séparant ce qui
vient de l'application de ce qui vient du banc (Chromium, agents).
