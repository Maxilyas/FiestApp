# Le jeu solo au téléphone : jouer son quiz du jour (`jour-ecran`)

**Ton angle** : designer et testeur d'applications mobiles de jeu. **Ta
question** : sur un petit Android, en 4G, entre deux stations de métro, le
quiz du jour se joue-t-il sans accroc — du premier toucher au classement du
soir — et que voit-on quand ça coince ? Consignes : `consignes-audit.md`.

**Où regarder** : `client/src/views/JourApp.tsx`,
`client/src/components/AdminDuJour.tsx`, les appels du jour dans
`client/src/api.ts`, `shared/jour.ts` (ce que le serveur envoie), les règles
`.jour-…` de `client/src/styles.css`, et les portes qui y mènent (l'accueil
`ProfilApp.tsx`, les onglets `Trophees.tsx`, `Carriere.tsx`).

**Ta méthode** : ton propre serveur jetable qui sert le client construit dans
ton dossier (`consignes-audit.md`, « Un navigateur »), avec une horloge du
jour que ton script avance (`horlogeDuJour`) ; Playwright en 360 × 640 et
412 × 915, texte agrandi une fois ; deux ou trois profils, pour avoir un
classement. Joue des journées entières :
- la partie normale, chaque sorte de question que le jour sait poser ; une
  question qu'on laisse expirer ; la correction ; le classement du jour et
  du mois ; le laurier le lendemain ; un signalement ;
- **les chemins de travers** : recharger en pleine question (le chronomètre
  repart-il de zéro ou reprend-il ?), deux onglets, le réseau coupé au
  moment de répondre (`context.setOffline`), un double toucher, l'onglet
  caché une minute, un serveur qui redémarre, une réponse qui arrive après
  l'échéance, revenir après minuit, un invité sans profil qui ouvre `/jour` ;
- l'administration (`/admin`) : la réserve, les signalements, garder,
  annuler, masquer — ce que l'administrateur comprend et ce qu'il risque.

**Ce que tu évalues** : le chronomètre affiché face à l'échéance du serveur
(invariant 6 : une horloge de téléphone qui dérive — essaie une horloge
décalée de 30 s, `page.clock` ou `Date` surchargé), les états bloqués (une
roue qui tourne sans fin, un bouton mort), les messages d'erreur (courts, en
français, disent quoi faire), les cibles tactiles (44 px), ce qui passe sous
le clavier ou sous le pli, les annonces au lecteur d'écran (question qui
s'ouvre, résultat, chrono : `aria-live`, focus), les mots, la cohérence avec
les écrans d'une soirée.

**Hors de ton angle** : la justesse des règles et la triche côté serveur
(`jour-regles`).

**Ce que tu rends, en plus du modèle** : le parcours d'une journée en
captures (chaque écran, chaque état d'erreur), le tableau des chemins de
travers (ce qui arrive · ce qu'il faudrait), et les défauts classés.
