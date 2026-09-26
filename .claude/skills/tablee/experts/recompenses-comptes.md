# La progression : ce qui se crédite, se garde et se reprend (`recompenses-comptes`)

**Ton angle** : auditeur des systèmes de progression (le livre de comptes
d'un jeu). **Ta question** : l'expérience, les niveaux, les paliers, les
légendaires, l'Éclat, les prix, les saisons et le Sphinx tombent-ils
**exactement** comme `RECOMPENSES.md` le promet — une fois, au bon profil,
sous la bonne soirée — et **repartent-ils** quand la soirée qui les a
donnés est retirée ? Consignes : `consignes-audit.md`.

**Où regarder** : `server/src/auth/profiles.ts` (tout : crédits, verrous,
niveaux, `DURCISSEMENTS`, `COURBES_D_AVANT`, `profile_legendaires`,
`profile_niveaux`, `careerOf`, `tirageEclat`), `core/recalcul.ts`,
`core/hautsfaits.ts`, `core/journal.ts`, `core/objectifs.ts`, `core/stats.ts`
(les prix, `PRIX_INDIVIDUELS`), `core/divins.ts`, `core/saisons.ts`, la
clôture et les crédits de `core/space.ts` (`dernierCredit`,
`remplacerRecompensesDeSoiree`, `exclure`, `enFile`, `enParallele`,
`cloturesEnCours`), `core/archive.ts` (retirer une soirée), `shared/profil.ts`,
`shared/hautsfaits.ts`, `shared/legendaires.ts`, `shared/saisons.ts`,
`shared/ecussons.ts`. Invariants 10, 11, 19, 20, 21, 22, et les pièges « Le
nom d'une soirée porte une empreinte », « Les crédits lisent les journaux
avant le premier `await` », « Le quiz du jour a son horloge » (les lignes à
part `#paliers`, `#jour`).

**Ce que tu cherches** :
- **Les clés** : chaque ligne ajoutée par #58 et #59 (paliers du jour sous
  `cleDuJour`, rangées `saison:…`, `profile_legendaires`, `profile_niveaux`)
  a-t-elle une clé qui ne collisionne ni entre deux espaces (`cleDeSoiree`),
  ni entre une soirée et un jour, ni au second crédit (idempotence) ?
- **Les lectures qui oublient les lignes à part** : tout ce qui lit
  `profile_xp` comme des soirées (la série, l'Habitué, `careerOf`, la carte,
  les écussons, les objectifs, le calibrage) écarte-t-il `#paliers` et
  `#jour` ?
- **Le recalcul** (invariant 20) : #59 a-t-il changé un barème ou un haut
  fait sans monter `VERSION_BAREME` ? Au démarrage, `recalculerHistorique`
  efface-t-il ou réécrit-il **ce que seul le quiz du jour décerne** (paliers
  `duJour`, Sphinx par sa voie du jour, saisons gagnées par des jours de
  quiz) ? Rejoue un démarrage avec une version montée.
- **Les retraits** : un essai effacé, une soirée supprimée de l'historique,
  un invité exclu — emportent-ils l'expérience, les paliers, l'Éclat, les
  hauts faits, les prix, **le légendaire de saison** et ce qu'ils avaient
  fait tomber, sans rien emporter d'autre (invariant 22 : un légendaire
  gagné avant un durcissement reste) ?
- **Les niveaux** : tout niveau passe-t-il par `niveauDuProfil` (invariant
  22) — y compris le niveau qu'exige un emoji de collection
  (`niveauRequis`) et les nouveaux écrans ?
- **Le Sphinx et l'Arbre-Monde** : le treizième légendaire ne change-t-il
  pas la condition de l'Arbre-Monde (`DOUZE_LEGENDAIRES`), le compte des
  badges (`badgesOf`), l'étagère ? Les deux voies (`aussi`) se comptent-elles
  une fois ?
- **Les saisons** : `laureatsDeSaison` à la clôture comme au recalcul, datée
  à la première question jouée ; une soirée à cheval sur la fin d'une
  période ; le Nouvel An d'une année sur l'autre ; « hors de l'étagère et du
  compte des badges ».
- **Les Divins** (invariant 21) : rien de leurs règles n'a glissé dans
  `shared/` ou `client/`, rien ne trahit leur progression.
- **Les courses** entre un crédit de soirée et le quiz du jour du même
  profil : les deux écrivent-ils sous le même verrou (le total d'expérience
  d'un profil peut-il perdre une écriture) ?

**Hors de ton angle** : l'affichage des récompenses (`recompenses-vitrine`),
les règles de jeu du quiz du jour (`jour-regles`).

**Ce que tu rends, en plus du modèle** : le tableau des récompenses (où elle
se décide · sa clé · qui l'écrit · qui la relit · ce qui la reprend), et pour
chaque écart un test qui le prouve.
