# Le Cabinet de curiosités : l'équilibre (`cabinet-equilibre`)

**Ton angle** : concepteur de systèmes de jeu et d'économies de jeux
mobiles (collection, quotidien, monnaies). **Ta question** : le Cabinet
est-il **bien équilibré** — chaque jeu ni trop facile au hasard, ni
impossible à un joueur occasionnel ; les cinq pouvoirs tous utiles, aucun
indispensable ; la poussière d'or qui récompense sans tout donner ; une
collection qui se finit en quelques semaines pour un fidèle, sans décourager
l'occasionnel ; rien qui rapporte plus de confettis ou d'expérience que le
reste de FiestApp pour le même temps — et **ce qu'il promet est-il vrai**
(les barèmes que dit l'annonce, les règles de « Comment ça marche ? », le
glossaire, la documentation) ? Consignes : `consignes-audit.md`.

**Où regarder** : `shared/cabinet/bareme.ts` (tous les chiffres),
`pouvoirs.ts`, `musee.ts`, `partie.ts` (les étoiles, l'issue, la poussière),
`jeux/*.ts` (le jugement de chaque jeu), `jeux/regle.ts` (les barèmes dits) ;
`server/scripts/calibrage-cabinet.ts` (les joueurs simulés : lance-le,
`cd server && nice -n 10 npx tsx scripts/calibrage-cabinet.ts`, et ses
essais), `server/test/cabinet-calibrage.test.ts` (ce qu'il joue du code) et
`cabinet-calibrage-modele.test.ts` (son modèle des joueurs) ; `docs/reference/baremes.md`
(la section du Cabinet, ses chiffres datés), `docs/architecture/decisions.md`
(« Le Cabinet de curiosités », et le calibrage du 25 octobre 2026),
`docs/produit/le-cabinet.md` ; la proposition validée
`retours/2026-10-24/le-cabinet.md`, et la maquette
`retours/2026-10-24/maquette/` ; ce que paie une série de la campagne
(`core/campagne.ts`, `shared/`) pour comparer.

**Ce que tu cherches** :
- **Les biais du calibrage** : ses joueurs simulés jouent-ils comme de vrais
  joueurs (le temps par geste, les stratégies, l'usage des cartes) ? Ses
  chiffres résistent-ils à un autre modèle raisonnable ? Écris tes propres
  simulations dans ton dossier, en important les règles partagées — jamais
  en les recopiant.
- **Jeu par jeu** : le taux de communes, de rares, de cadres dorés au hasard
  et pour chaque profil de joueur ; un jeu qui domine les autres pour le
  temps passé (le complétionniste n'y jouerait plus qu'à lui) ; une manche
  où la meilleure stratégie est absurde (ne rien faire, attendre l'échéance,
  quitter).
- **Les pouvoirs** : ce que chacun fait aux étoiles et à la poussière ; lequel
  on emporterait toujours ; Miser et Protéger ensemble ; Changer qui fuit
  toute manche difficile.
- **L'économie** : la poussière par jour, les prix, les jours pour tout
  posséder, tout dorer ; les cinq libres payées ; les confettis et
  l'expérience à la minute face à une série (la question 3 de la
  conception, la parade des libres non posée : est-ce tenable ?).
- **Les promesses** : chaque chiffre dit à l'écran (barèmes de l'annonce,
  règles, glossaire, cartel) contre ce que le code fait vraiment.

**Ce que tu rends, en plus du modèle** : un tableau jeu par jeu (au hasard,
occasionnel, bon, complétionniste) et tes recommandations chiffrées —
quelle constante, quelle valeur, ce que la simulation donne avec, ce que ça
coûte —, du plus utile au moins utile.

**Hors de ton angle** : la triche (`cabinet-triche`), la sobriété
(`cabinet-sobriete`), la tenue du code (`cabinet-code`).
