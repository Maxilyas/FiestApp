// Le calibrage du Cabinet de curiosités : combien de jours il faut pour tout
// posséder et tout dorer, ce qu'une journée rapporte de poussière d'or, de
// confettis et d'expérience — comparé à une série de la campagne, à la
// minute —, quand les gardiens se réveillent, et ce que vaut chaque jeu, joué
// par qui sait et par qui répond au hasard. Le Cabinet l'attend avant
// d'ouvrir : les chiffres de la maquette (`retours/2026-10-24/maquette/jeu.js`)
// se remesurent ici sur le vrai code, et le troisième des choix délégués —
// les parties libres paient-elles plus qu'une série ? — se mesure ici, à la
// minute, avant que le propriétaire le tranche (`docs/architecture/decisions.md`,
// « Les sept choix laissés au propriétaire »). Ses chiffres datés :
// `docs/reference/baremes.md`.
//
// Des joueurs inventés jouent les règles partagées — aucune n'est recopiée.
// Chaque partie part d'un départ que le serveur relirait (`lireLeDepart` en
// relit des centaines), et chaque geste passe par le vrai pli
// (`jouerUnGeste`) à l'heure où il arrive : le chrono, la grâce, les
// pouvoirs, le verdict de chaque jeu, les pièces justes, le bilan, l'issue et
// la poussière sont ceux du code. La visite du jour, les refus d'un départ,
// le solde, les achats, les dorures et les gardiens dus passent par le musée
// (`shared/cabinet/musee.ts`) ; l'expérience par celle de la campagne
// (`xpDuJourDeCampagne`) ; la série de comparaison par l'ordre des marches
// d'une vraie série (`ordreDeSerie`, `VIES`). Ne s'invente que ce qui ne
// s'écrit pas en règle : le contenu des questions de la base (synthétique ;
// les lieux, les fiches, les répliques et les frises sont ceux qu'on livre),
// ce que chaque joueur sait (`MODELE`), le temps qu'il met (`SECONDES`), et
// ses choix — la carte-bonus, l'œuvre qu'il chasse, ce qu'il achète. Les
// quelques reflets que le serveur tient en SQL (la série du profil, la visite
// figée, les lignes d'œuvres d'un bilan, d'un achat) s'y tiennent comme le
// lot qui les écrit — celui du départ, celui de la fin.
//
// Le savoir : celui de la campagne pour les questions de la base — un joueur
// moyen trouve ce que trouve le calibrage des sentiers (`TAUX_DU_CALIBRAGE`),
// un plus fort ou plus faible est décalé d'un logit, comme dans
// `calibrage-sentiers.ts` —, et pour le reste un modèle, faute de parties
// jouées à mesurer : la tablée, puis les vraies parties de la préproduction,
// le corrigeront. Chaque part du modèle se décale de la force du joueur, le
// rang où il reconnaît compris (`rangSelonLaForce`), et ce qu'il sait d'une
// question de la base, de sa marche — au Filet aussi : jusqu'au 25 octobre
// 2026, le complétionniste reconnaissait une personne des Indices au même
// indice que l'occasionnel, et un Filet difficile se savait comme un facile.
// Le joueur au hasard répond au hasard partout où il faut savoir (une
// réponse, une épingle, un ordre, un nom), et choisit ailleurs ce qui
// l'approche le plus de son but — le filet à lancer, garder ou parier au
// Pari, reculer au Détail, vers le seuil qu'il vise ; la zone d'Éclairer, où
// il plante le mieux sans rien savoir du lieu ; la manche à miser, et la
// manche misée, qu'il joue pour ses trois étoiles : c'est le plancher de
// chaque jeu. Le Mot mystère tient au modèle plus qu'aux règles : il n'y tape
// jamais le mot au premier essai (une chance sur douze millions à cinq
// lettres), mais il lit les couleurs comme le joueur moyen, et le déduit à sa
// chance dès le deuxième — à zéro jusqu'au 26 octobre 2026, quand la tablée
// du jour trouvait le mot sans savoir à toutes ses manches.
//
// Ce qu'il choisit vers un but — garder ou parier, le filet, reculer, miser —
// se décide sur une seule programmation dynamique (`Avenir`) : la chance
// d'atteindre son seuil, les manches qui restent comprises, et la mise qu'il
// garde pour l'une d'elles. Chaque jeu y dit ce qu'il saura d'une manche et ce
// qu'il pourra y choisir (`MODELES`) ; un jeu où rien ne se choisit, la loi de
// ses étoiles, mesurée manche par manche (`Allure`).
//
// Une mesure tire ses départs et son hasard du joueur, du jeu et du rang de la
// partie, jamais de la carte-bonus ni du but : sans carte et avec, vers cinq
// étoiles et pour dorer, un jeu se compare sur les mêmes parties, et le bruit
// de deux tirages ne passe plus pour l'effet d'un pouvoir.
//
// Les sections : chaque jeu sans carte-bonus ; chaque jeu avec les quatre
// œuvres de départ que tout profil emporte (le tableau des retouches du
// 25 octobre 2026 ne les comptait pas) ; chaque pouvoir à chaque force, jeu
// par jeu ; la zone d'Éclairer à l'Épingle, la règle du code et ses pistes,
// pour qui ne sait rien ; les confettis à la minute ; le musée, jour après
// jour. Sept joueurs : l'occasionnel, le chasseur (le même, qui chasse dans la
// salle du prochain gardien), le moyen, le bon, le complétionniste, le joueur
// au hasard, et le joueur « tablée », aussi fort que les agents d'une tablée,
// pour que sa synthèse compare chaque jeu à sa ligne.
//
// Un barème s'essaie sans toucher au fichier (`--essai NOM=…`) : la constante
// de `shared/cabinet/bareme.ts` prend une autre valeur en mémoire, avant que
// les règles ne se chargent — d'où leurs `import()` plus bas —, et ce sont
// les règles du code qui la lisent. Un tableau ou une table seulement : un
// nombre exporté ne se réécrit pas, il s'essaie dans le fichier ; et ce que
// `bareme.ts` tire lui-même d'un tableau à son chargement ne suit pas l'essai
// (`DERIVEES`).
//
//   npx tsx scripts/calibrage-cabinet.ts [--parcours 4] [--jours 365] [--parties 1000] [--mesures 100]
//     [--joueurs moyen,bon] [--jeux pari,detail] [--pouvoirs miser,changer] [--graine cabinet] [--sans-musee]
//     [--sections jeux,oeuvres,cartes,epingle,confettis,musee]
//     [--essai ERREURS_DE_LA_FRISE=0/1/2] [--essai SEUILS_DES_RARETES=commun:6/rare:7]
//     [--essai MARCHES_DU_PARI=pari:moyen+difficile] [--essai MARCHES_DES_ENJEUX=epique:/dorer:]
//
// Deux minutes environ d'office, une minute et demie `--sans-musee` (tout sauf
// le musée) ; `--sections` ne joue que ce qu'elle nomme, `--jeux`
// les jeux des sections qui les mesurent un à un — les confettis et le musée
// choisissent toujours parmi les neuf —, `--pouvoirs` ceux de la section des
// cartes.
import type { Niveau } from '../../shared/campagne'
import type { Lieu, Fiche, Replique, FriseATheme } from '../../shared/cabinet/contenu'
import type { ContenuTire } from '../../shared/cabinet/jeux/index'
import type { CleDeJeu } from '../../shared/cabinet/jeux/regle'
import type { QuestionTiree } from '../../shared/cabinet/jeux/outils'
import type { PariMontre, PariTire } from '../../shared/cabinet/jeux/pari'
import type { EclairMontre, EclairTire } from '../../shared/cabinet/jeux/eclair'
import type { MotMontre, MotTire } from '../../shared/cabinet/jeux/mot'
import type { FiletMontre, FiletTire, TailleDuFilet } from '../../shared/cabinet/jeux/filet'
import type { DetailMontre, DetailTire, TableauDuCabinet } from '../../shared/cabinet/jeux/detail'
import type { FriseMontree, FriseTiree } from '../../shared/cabinet/jeux/frise'
import type { DecalageDeLaZone, EpingleMontree, EpingleTiree } from '../../shared/cabinet/jeux/epingle'
import type { IndicesMontres, IndicesTires } from '../../shared/cabinet/jeux/indices'
import type { RepliqueMontreeAQui, RepliqueMontreeAuMot, RepliqueTiree } from '../../shared/cabinet/jeux/replique'
import type { QuizMontre, QuizTire } from '../../shared/cabinet/jeux/quiz'
import type { Point } from '../../shared/cabinet/france'
import type { CleDePouvoir, Force } from '../../shared/cabinet/pouvoirs'
import type { CleDOeuvre } from '../../shared/cabinet/oeuvres'
import type { CadreDuDepart, LigneDOeuvre, LigneDuProfil, Musee, PartieDuJour, VisiteDuJour } from '../../shared/cabinet/musee'
import type { CarteDuDepart, DepartDUnePartie, EnjeuDuTirage, EtatDeLaPartie, GesteDuCabinet, IssueDUnePartie, Manche, OrigineDUnePartie, ReponseDUnJeu } from '../../shared/cabinet/partie'
// Avant l'essai, rien qui lise le barème : `bareme.ts` n'importe que des types, la campagne et les nombres rien du Cabinet.
import * as BAREME from '../../shared/cabinet/bareme'
import { NIVEAUX } from '../../shared/campagne'
import { lireNombre } from '../../shared/nombres'

// ── Les options ───────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2)
const valeursDe = (nom: string): string[] => ARGS.flatMap((a, i) => (a === `--${nom}` && ARGS[i + 1] !== undefined ? [ARGS[i + 1]] : []))
function entier(nom: string, defaut: number): number {
  const brut = valeursDe(nom).at(-1)
  if (brut === undefined) return defaut
  const n = lireNombre(brut)
  if (n === null || !Number.isInteger(n) || n < 1) arreter(`--${nom} attend un entier positif, pas « ${brut} »`)
  return n
}
function liste(nom: string): string[] | null {
  const brut = valeursDe(nom).at(-1)
  return brut === undefined ? null : brut.split(',').map(x => x.trim()).filter(Boolean)
}
function arreter(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Les parcours de chaque joueur : un musée rempli jour après jour, de son premier matin — les quatre œuvres de départ — à la fin. */
const PARCOURS = entier('parcours', 4)
/** L'horizon d'un parcours, en jours de calendrier : au-delà, « plus d'un an ». */
const JOURS = entier('jours', 365)
/** Les parties de chaque jeu, par joueur, pour ce qu'il vaut sans carte-bonus. */
const PARTIES = entier('parties', 1000)
/** Les parties qui mesurent une carte-bonus à un jeu, quand un joueur se demande laquelle emporter. */
const MESURES = entier('mesures', 100)
const GRAINE = valeursDe('graine').at(-1) ?? 'cabinet'
/**
 * Les sections à jouer : chaque jeu un à un sans carte-bonus, puis avec les
 * œuvres de départ, chaque carte-bonus, la zone d'Éclairer à l'Épingle, les
 * confettis à la minute, le musée. Toutes d'office ; `--sans-musee`, toutes
 * sauf la dernière, la plus longue.
 */
const SECTIONS = ['jeux', 'oeuvres', 'cartes', 'epingle', 'confettis', 'musee'] as const
const sectionsDemandees = liste('sections')
for (const s of sectionsDemandees ?? []) if (!(SECTIONS as readonly string[]).includes(s)) arreter(`--sections : « ${s} » n'en est pas une (${SECTIONS.join(', ')})`)
const SANS_MUSEE = ARGS.includes('--sans-musee')
const enSection = (s: (typeof SECTIONS)[number]) => (sectionsDemandees ? sectionsDemandees.includes(s) : !(SANS_MUSEE && s === 'musee'))

// ── Un barème à l'essai, avant que les règles ne se chargent ──────────────

/**
 * La constante prend la valeur essayée en mémoire — le fichier ne change pas.
 * Les règles se chargent après (leurs `import()`) : ce qu'un module en tire à
 * son chargement (les étoiles gardées du Pari et leurs mots, le recul d'une année
 * du Filet) se tire alors de la valeur essayée.
 */
function essayer(texte: string): string {
  const egal = texte.indexOf('=')
  const nom = texte.slice(0, egal)
  if (egal < 1 || !Object.hasOwn(BAREME, nom)) arreter(`--essai ${texte} : « ${nom} » n'est pas une constante de shared/cabinet/bareme.ts`)
  const cible: unknown = (BAREME as Record<string, unknown>)[nom]
  if (typeof cible !== 'object' || cible === null) arreter(`--essai ${nom} : un nombre exporté ne se réécrit pas en mémoire — essaie-le dans shared/cabinet/bareme.ts, le temps de la mesure`)
  const morceaux = texte.slice(egal + 1).split('/')
  if (Array.isArray(cible)) {
    // Un barème chiffré garde sa forme — trois paliers restent trois ; une liste de marches peut s'allonger.
    const marches = typeof cible[0] === 'string'
    if (!marches && morceaux.length !== cible.length) arreter(`--essai ${nom} : ${cible.length} valeurs attendues, séparées par « / »`)
    const essai = morceaux.map(x => valeurEssayee(nom, cible[0], x))
    const refus = DERIVEES.get(nom)?.(essai)
    if (refus) arreter(`--essai ${nom} : ${refus}`)
    cible.splice(0, cible.length, ...essai)
  } else {
    const table = cible as Record<string, unknown>
    for (const m of morceaux) {
      const [cle, valeur] = m.split(':')
      if (!Object.hasOwn(table, cle) || valeur === undefined) arreter(`--essai ${nom} : « ${cle} » n'en est pas une clé (${Object.keys(table).join(', ')})`)
      table[cle] = valeurEssayee(nom, table[cle], valeur)
    }
  }
  return `${nom} = ${JSON.stringify(cible)}`
}
/**
 * Ce que `bareme.ts` tire lui-même d'un tableau, à son chargement — donc de la
 * valeur d'avant l'essai —, et que le contenu livré suit : un essai qui
 * changerait l'un sans l'autre jouerait une règle à moitié essayée, et
 * s'arrêterait au premier départ en accusant le serveur. Les frises à thème
 * comptent les événements que leurs vagues posent (`EVENEMENTS_D_UNE_FRISE_A_THEME`) :
 * d'autres vagues, d'une autre somme, ne s'essaient qu'en récrivant les frises.
 */
const DERIVEES = new Map<string, (essai: readonly unknown[]) => string | null>([
  [
    'VAGUES_DE_LA_FRISE',
    vagues => {
      const posees = (vagues as readonly number[]).reduce((n, v) => n + v, 0)
      const livrees = BAREME.EVENEMENTS_D_UNE_FRISE_A_THEME
      return posees === livrees
        ? null
        : `ces vagues posent ${posees} événements, et les frises livrées en comptent ${livrees} (EVENEMENTS_D_UNE_FRISE_A_THEME, que bareme.ts tire des vagues à son chargement) — essaie des vagues qui en posent ${livrees}, ou récris les frises`
    },
  ],
])
/**
 * Une valeur essayée, de la forme de celle qu'elle remplace : un nombre, une marche (`facile`), ou des marches
 * (`moyen+difficile`). Une liste vide — une rareté qui n'ajoute rien à la marche (`MARCHES_DES_ENJEUX`) — est une liste de
 * marches, qu'un essai vide garde vide (`commun:`) : les seules listes d'un barème du Cabinet à pouvoir l'être.
 */
function valeurEssayee(nom: string, avant: unknown, texte: string): number | string | string[] {
  if (Array.isArray(avant)) return texte === '' ? [] : texte.split('+').map(x => valeurEssayee(nom, avant[0] ?? NIVEAUX[0], x) as string)
  if (typeof avant === 'string') return (NIVEAUX as readonly string[]).includes(texte) ? texte : arreter(`--essai ${nom} : « ${texte} » n'est pas une marche (${NIVEAUX.join(', ')})`)
  return lireNombre(texte) ?? arreter(`--essai ${nom} : « ${texte} » n'est pas un nombre`)
}
const ESSAIS = valeursDe('essai').map(essayer)

// ── Les règles, chargées après l'essai ────────────────────────────────────

const { CLES_DES_JEUX, JEUX } = await import('../../shared/cabinet/jeux/regle')
const { regleDe } = await import('../../shared/cabinet/jeux/index')
const P = await import('../../shared/cabinet/partie')
const { lireLeDepart } = await import('../../shared/cabinet/lecture')
const M = await import('../../shared/cabinet/musee')
const { OEUVRES, OEUVRES_DE_DEPART, JEU_DE_L_OEUVRE, oeuvre } = await import('../../shared/cabinet/oeuvres')
const { POUVOIRS, pouvoirDe, forceDe, etoilesApresLesPouvoirs } = await import('../../shared/cabinet/pouvoirs')
const { AUTRES_GARDIENS, pouvoirDuGardien, GARDIENS, GARDIENS_DE_SAISON, conditionDuGardien } = await import('../../shared/cabinet/salles')
/** Le gardien de la série, qui se réveille aux jours d'affilée, pas au musée. */
const SCARABEE = AUTRES_GARDIENS.find(g => 'serie' in g.reveil)!.legendaire
const { echeanceDe } = await import('../../shared/cabinet/chrono')
const { DANS_LA_FRANCE, dansLaFrance, distanceKm } = await import('../../shared/cabinet/france')
const { affirmationDe } = await import('../../shared/cabinet/jeux/eclair')
// La question du pari plus haute que la première : la règle du tireur, importée — recopiée ici, elle s'en serait écartée.
const { marchesDuPari } = await import('../../shared/cabinet/jeux/pari')
const { pisteDuFilet } = await import('../../shared/cabinet/jeux/filet')
const { detailTire } = await import('../../shared/cabinet/jeux/detail')
const { estUneFriseSerree, friseEnVagues } = await import('../../shared/cabinet/jeux/frise')
const { REGLE_DE_L_EPINGLE, epingleTiree, etoilesDeLaDistance, pointADistance, zoneDEclairer } = await import('../../shared/cabinet/jeux/epingle')
// La carte que voit le joueur : où il peut planter, et la terre où le lieu peut être (des données, sans React).
// Et ce que la page fait d'une épingle hors du cadre : elle la ramène au bord (`dansLeCadre`, celui de `pointDuToucher`).
const { CONTOUR_DE_LA_FRANCE, CONTOUR_DE_LA_CORSE, dansLeCadre } = await import('../../client/src/views/cabinet/contourDeLaFrance')
const { repliqueTiree } = await import('../../shared/cabinet/jeux/replique')
const { battre, auHasard } = await import('../../shared/cabinet/jeux/outils')
const { decimales } = await import('../../shared/classement')
const { hasardDe } = await import('../../shared/missions')
const { jourAvant, jourDe } = await import('../../shared/jour')
const { minuitDe } = await import('../../shared/qg')
// La visite telle que la page la reçoit, de la lecture que le magasin bâtit : l'échange s'y choisit sur ce que la page montre — le
// jeu que « Changer » nomme, le seuil de chaque case —, jamais sur la règle des échanges, que la page n'a pas.
const { lectureDeLaVisite } = await import('../src/core/cabinet/magasin')
const { visiteVue } = await import('../src/core/cabinet/vue')
const { formatNumber } = await import('../../shared/typographie')
const { TAUX_DU_CALIBRAGE } = await import('../../shared/sentiers')
const { JUSTES_DOUBLEES_PAR_JOUR, QUESTIONS_PAR_SERIE, VIES, ordreDeSerie, xpDuJourDeCampagne } = await import('../../shared/campagne')
const { contenuDuCabinet } = await import('../src/core/cabinet/contenu')
const { Budget } = await import('../src/core/budget')
const { tronquer } = await import('../../shared/avatars')

const {
  CASES_DE_LA_VISITE,
  CHANGEMENTS_PAR_PARTIE,
  CHASSES_PAR_JOUR,
  DECALAGE_DE_LA_ZONE_KM,
  DEPARTS_PAR_HEURE,
  ECART_D_UNE_FRISE_EPIQUE,
  ECLAIRAGES_PAR_PARTIE,
  ESSAIS_DU_MOT,
  ETOILES_AU_CADRAGE,
  ETOILES_DU_FILET,
  ETOILES_DU_PARI,
  ETOILES_D_UNE_JUSTE,
  ETOILES_D_UNE_PARTIE,
  ETOILES_PAR_MANCHE,
  FORCES_DES_RARETES,
  LARGEURS_DU_FILET,
  LIBRES_QUI_PAIENT,
  MANCHES_PAR_PARTIE,
  MARCHES_DE_L_ECLAIR,
  MARCHES_DU_FILET,
  MARCHES_DU_MOT,
  MARCHES_DU_PARI,
  MARCHES_DU_QUIZ,
  PRIX_D_UNE_DORURE,
  PRIX_D_UNE_OEUVRE,
  RAYON_D_ECLAIRER_KM,
  SEUILS_DES_RARETES,
  TITRES_DU_DETAIL,
  ZONE_DU_FILET,
} = BAREME

/** Les jeux des sections qui les mesurent un à un ; les confettis et le musée choisissent toujours parmi les neuf. */
const jeuxDemandes = liste('jeux')
for (const jeu of jeuxDemandes ?? []) if (!(CLES_DES_JEUX as readonly string[]).includes(jeu)) arreter(`--jeux : « ${jeu} » n'en est pas un (${CLES_DES_JEUX.join(', ')})`)
const JEUX_MESURES = jeuxDemandes ? CLES_DES_JEUX.filter(jeu => jeuxDemandes.includes(jeu)) : CLES_DES_JEUX
/** Les pouvoirs que mesure la section des cartes : une épreuve qui n'en lit qu'un ne paie pas les quatre autres. */
const pouvoirsDemandes = liste('pouvoirs')
for (const p of pouvoirsDemandes ?? []) if (!Object.hasOwn(POUVOIRS, p)) arreter(`--pouvoirs : « ${p} » n'en est pas un (${Object.keys(POUVOIRS).join(', ')})`)
const POUVOIRS_MESURES = (Object.keys(POUVOIRS) as CleDePouvoir[]).filter(p => !pouvoirsDemandes || pouvoirsDemandes.includes(p))

/** Les quatre œuvres de départ, chacune sa carte-bonus : tout profil les emporte dès sa première partie. */
const OFFERTES = OEUVRES_DE_DEPART.map(cle => ({ nom: oeuvre(cle)!.nom, carte: { pouvoir: pouvoirDe(cle)!, force: forceDe(cle)! } }))

// ── Les joueurs ───────────────────────────────────────────────────────────

interface Joueur {
  nom: string
  /** Ce qu'il sait de plus qu'un joueur moyen, en logit ; null : il répond au hasard. */
  theta: number | null
  /** Le temps qu'il met, au regard du joueur moyen. */
  vitesse: number
  /** La part des jours où il vient. */
  assiduite: number
  chasses: number
  libres: number
  /** Il change le jeu d'une case de la visite qui lui va mal. */
  echange: boolean
  /** Ses chasses vont d'abord à la salle du prochain gardien, que la page lui dit (« encore 2 œuvres dans la salle… »). */
  versLeGardien?: true
  /**
   * Le joueur dont il est la variante : mêmes jours, même visite, même hasard
   * jusqu'à ce qu'il joue autrement — ses jeux sont ceux de ce joueur, et ne se
   * mesurent pas deux fois.
   */
  comme?: string
}

/**
 * Le moyen et le complétionniste suivent le rythme des simulations de la
 * maquette — une visite, deux chasses, cinq parties libres —, l'un au savoir
 * du calibrage, l'autre une marche plus haut ; le bon sait autant que le
 * complétionniste, mais ne joue pas de partie libre ; l'occasionnel vient un
 * jour sur deux à peu près, pour sa visite et une chasse. Le chasseur est cet
 * occasionnel, qui chasse vers le prochain gardien : l'occasionnel attendait
 * le premier au 36ᵉ jour au calibrage du 25 octobre 2026 (au 21ᵉ depuis
 * qu'une case de la visite vise chaque jour sa salle, le 26), la visite
 * remplissant les neuf salles à la fois.
 * Le joueur « tablée » sait ce que savent les agents d'une tablée — deux
 * marches et demie au-dessus du moyen, le diapason de John Shore à l'année —,
 * sans aller plus vite que lui : un agent répond en quelques secondes ; la
 * synthèse d'une tablée compare chaque jeu à sa ligne.
 */
const OCCASIONNEL: Joueur = { nom: 'occasionnel', theta: -0.5, vitesse: 1.3, assiduite: 4 / 7, chasses: 1, libres: 0, echange: false }
const TOUS_LES_JOUEURS: readonly Joueur[] = [
  OCCASIONNEL,
  { ...OCCASIONNEL, nom: 'chasseur', versLeGardien: true, comme: OCCASIONNEL.nom },
  { nom: 'moyen', theta: 0, vitesse: 1, assiduite: 1, chasses: 2, libres: 5, echange: true },
  { nom: 'bon', theta: 1, vitesse: 0.9, assiduite: 1, chasses: 2, libres: 0, echange: true },
  { nom: 'complétionniste', theta: 1, vitesse: 0.9, assiduite: 1, chasses: 2, libres: 5, echange: true },
  { nom: 'hasard', theta: null, vitesse: 0.6, assiduite: 1, chasses: 2, libres: 5, echange: false },
  { nom: 'tablée', theta: 2.5, vitesse: 1, assiduite: 1, chasses: 2, libres: 5, echange: true },
]
const filtre = liste('joueurs')
for (const nom of filtre ?? []) if (!TOUS_LES_JOUEURS.some(j => j.nom === nom)) arreter(`--joueurs : « ${nom} » n'en est pas un (${TOUS_LES_JOUEURS.map(j => j.nom).join(', ')})`)
const JOUEURS = filtre ? TOUS_LES_JOUEURS.filter(j => filtre.includes(j.nom)) : TOUS_LES_JOUEURS
if (JOUEURS.length === 0) arreter(`--joueurs : aucun de ${TOUS_LES_JOUEURS.map(j => j.nom).join(', ')}`)
/** Deux joueurs qui savent autant et vont aussi vite jouent chaque partie pareil : leurs mesures se partagent. */
const cleDuSavoir = (j: Joueur) => `${j.theta}:${j.vitesse}`

/**
 * Ce que chaque joueur sait, hors des questions de la base : un modèle — la
 * part d'un joueur moyen, décalée de son logit, le rang où il reconnaît
 * compris (`rangSelonLaForce`). Chaque part dit ce qu'elle suppose ; la
 * tablée et les vraies parties la remplaceront.
 */
const MODELE = {
  /**
   * Le Mot mystère : sans savoir le mot, il le déduit de ses couleurs, une
   * fois sur trois — mieux à chaque lettre soufflée (en logit). Le joueur au
   * hasard aussi, à la chance du moyen : il lit les couleurs comme tout le
   * monde. Un chiffre posé sans mesure, à remesurer en préproduction sur les
   * manches dont le premier essai est faux.
   */
  motDeduit: 0.35,
  motParLettre: 0.8,
  /**
   * … et le trouve alors du deuxième au cinquième essai (`ESSAIS_DU_MOT`) :
   * les six manches jouées sans savoir à la tablée du 26 octobre 2026 l'ont
   * trouvé une fois au deuxième, trois au troisième, une au quatrième, une au
   * cinquième. Le modèle d'avant n'y déduisait jamais avant le troisième, et
   * jamais au hasard : le Mot y était le seul jeu à zéro commune.
   */
  motAuxEssais: [0.2, 0.4, 0.2, 0.2],
  /**
   * Le Filet : il sait la valeur, à un centième et demi de piste près, d'une
   * question moyenne ; d'une autre marche, décalée du logit que la campagne lui
   * trouve (`filetSait`) — 45 % d'une facile, 6 % d'une difficile : 30 % en
   * moyenne aux deux marches que le Filet tire au barème du 25 octobre 2026,
   * la part que le modèle d'avant donnait à toutes, et qu'un essai des marches
   * ne faisait pas bouger d'un chiffre.
   */
  filetSait: 0.15,
  filetPrecis: 0.015,
  /** … sinon il l'estime, à tant de piste près (un écart type). */
  filetFlou: 0.12,
  /** Le Détail : il reconnaît le tableau, au premier, deuxième ou troisième cadrage — le moyen ; un plus fort, plus tôt. */
  detailReconnu: 0.45,
  detailAuCadrage: [0.45, 0.35, 0.2],
  /**
   * La Frise : il sait l'année d'un événement ; sinon il l'estime, à tant
   * d'années près au joueur moyen (un écart type), plus serré au plus fort
   * (× e^(−0,3θ), comme le Filet). Jusqu'au 26 octobre 2026, à un quart de
   * l'étendue de la frise : une frise serrée, plus courte, y devenait plus
   * facile, quand quatre ans entre la tour Eiffel et les funérailles de Hugo ne
   * se rangent pas « à l'époque » (la tablée du jour) — et la frise serrée de
   * l'épique n'avait aucune prise sur le modèle.
   */
  friseSait: 0.45,
  friseFlouAns: 25,
  /**
   * L'Épingle : il sait le lieu (à une quinzaine de kilomètres) ; sinon sa
   * région (de 40 à 220 km) ; sinon rien. La zone d'Éclairer, il la lit — où
   * le lieu peut être, sur la terre que la carte dessine (`ouPeutEtreLeLieu`) :
   * qui ne sait rien plante au point qui lui rapporte le plus, qui sait la
   * région, au plus près de ce qu'il en croit.
   */
  epingleSait: 0.3,
  epinglePresKm: 15,
  epingleRegion: 0.55,
  epingleRegionKm: [40, 220],
  /** Les Indices : il reconnaît la personne, au premier, au deuxième… au cinquième indice — le moyen ; un plus fort, plus tôt. */
  indicesReconnu: 0.7,
  indicesAuRang: [0.1, 0.15, 0.2, 0.25, 0.3],
  /** La Réplique : il sait le mot ; qui l'a dite, s'il savait le mot, ou sinon. */
  repliqueMot: 0.5,
  repliqueQuiSiMot: 0.8,
  repliqueQui: 0.33,
}

/** Une question de série au joueur moyen, lecture de l'anecdote comprise — le chiffre de `calibrage-sentiers.ts`… */
const SECONDES_PAR_QUESTION_DE_SERIE = 20
/** … dont l'anecdote, que le Cabinet lit à la révélation : le même temps. */
const SECONDES_D_UNE_REVELATION = 6
/**
 * Le temps de chaque geste, en secondes, pour un joueur moyen — lire, chercher,
 * toucher ; un tirage de plus ou moins un tiers s'y ajoute. Hors des manches,
 * l'annonce (la carte-bonus, « Commencer »), chaque révélation et le bilan.
 * Une question du Pari se lit et se répond comme une question de série,
 * l'anecdote à part : à 9 s contre 14, le Pari payait ses confettis plus vite
 * que la série au seul temps posé, et c'est sur lui que se jugeait le
 * troisième choix délégué (les parties libres paient-elles plus ?).
 */
const SECONDES = {
  pariQuestion: SECONDES_PAR_QUESTION_DE_SERIE - SECONDES_D_UNE_REVELATION,
  // Une question du Quiz se lit et se répond comme celle du Pari : un QCM de la base, l'anecdote à la révélation.
  quizQuestion: SECONDES_PAR_QUESTION_DE_SERIE - SECONDES_D_UNE_REVELATION,
  pariChoix: 2,
  eclairAffirmation: 5,
  motEssai: 12,
  filet: 14,
  detailRegard: 6,
  friseBase: 8,
  friseParVenu: 6,
  epingle: 18,
  indiceLu: 7,
  indiceNom: 9,
  repliqueEtape: 8,
  pouvoir: 2,
  annonce: 10,
  revelation: SECONDES_D_UNE_REVELATION,
  bilan: 8,
}
/**
 * … et à chacun la sienne : la réponse à son allure, comme ses gestes au
 * Cabinet, l'anecdote au temps d'une révélation, comme au Cabinet. Vingt
 * secondes pour tous, la série du joueur rapide se lisait à l'allure du moyen
 * quand son Cabinet allait à la sienne — de quoi lui faire passer la série.
 */
const secondesDUneQuestion = (j: Joueur) => (SECONDES_PAR_QUESTION_DE_SERIE - SECONDES.revelation) * j.vitesse + SECONDES.revelation

// ── Le hasard ─────────────────────────────────────────────────────────────

type Hasard = () => number
const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))
/** Un tirage d'une loi normale centrée réduite, d'un hasard qui se rejoue. */
const normale = (r: Hasard) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
/** Un rang tiré selon des poids. */
function selon(poids: readonly number[], r: Hasard): number {
  let x = r() * poids.reduce((a, b) => a + b, 0)
  for (let i = 0; i < poids.length; i++) if ((x -= poids[i]) < 0) return i
  return poids.length - 1
}
/** La fonction d'erreur (Abramowitz et Stegun, 7.1.26) : la chance qu'une estimation tombe dans un filet. */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return x < 0 ? -y : y
}

/** La chance d'un joueur, d'une part de base décalée de son logit. */
const chance = (base: number, theta: number) => sigmoide(logit(base) + theta)
/** Ce qu'il trouve d'une question de la base à cette marche — devinette comprise, comme le calibrage des sentiers. */
const trouve = (j: Joueur, n: Niveau, propositions = 4) => (j.theta === null ? 1 / propositions : chance(TAUX_DU_CALIBRAGE[n], j.theta))
/** Ce qu'il sait vraiment, sans deviner, d'une question à tant de propositions. */
const sait = (j: Joueur, n: Niveau, propositions = 4) => (j.theta === null ? 0 : Math.max(0, (trouve(j, n, propositions) - 1 / propositions) / (1 - 1 / propositions)))
/**
 * Quand il ne sait pas, la chance que sa réponse tombe juste : une sur quatre
 * d'ordinaire, moins à une marche que la salle trouve moins qu'au hasard — une
 * experte se trouve à 10 % : ses mauvaises réponses attirent. Ainsi il trouve,
 * Éclairer à part, exactement ce que trouve la campagne (`trouve`).
 */
const devineJuste = (j: Joueur, n: Niveau, propositions = 4) => {
  const k = sait(j, n, propositions)
  return Math.min(1 / propositions, (trouve(j, n, propositions) - k) / Math.max(1e-9, 1 - k))
}
const part = (j: Joueur, base: number) => (j.theta === null ? 0 : chance(base, j.theta))

/**
 * Le rang où il reconnaît — l'indice, le cadrage —, selon sa force : un logit
 * ordinal sur les parts cumulées du modèle, P(rang ≤ k) = sigmoïde(logit(F_k)
 * + θ). Le joueur moyen (θ = 0) garde les parts du modèle, au même tirage ; un
 * plus fort reconnaît plus tôt. Tiré sans la force, le rang plafonnait tout
 * joueur des Indices à 6,45 étoiles sur neuf, même à reconnaître toujours,
 * quand la tablée du 25 octobre 2026 en faisait 8,75 — et ce modèle avait
 * servi à élargir leur barème.
 */
function partsSelonLaForce(parts: readonly number[], j: Joueur): number[] {
  const theta = j.theta ?? 0
  let cumul = 0
  let avant = 0
  return parts.map((p, k) => {
    cumul += p
    const jusquIci = k === parts.length - 1 ? 1 : sigmoide(logit(Math.min(1 - 1e-12, cumul)) + theta)
    const x = jusquIci - avant
    avant = jusquIci
    return x
  })
}
/** Le rang tiré, de 1 au dernier. */
const rangSelonLaForce = (parts: readonly number[], j: Joueur, r: Hasard) => 1 + selon(partsSelonLaForce(parts, j), r)

/** Le Filet : la part des valeurs qu'il sait d'une question de cette marche, décalée comme la campagne la décale d'une question moyenne. */
const filetSait = (j: Joueur, n: Niveau) => (j.theta === null ? 0 : chance(MODELE.filetSait, j.theta + logit(TAUX_DU_CALIBRAGE[n]) - logit(TAUX_DU_CALIBRAGE.moyen)))

// ── Le contenu ────────────────────────────────────────────────────────────

const CONTENU = contenuDuCabinet()
if (CONTENU.lieux.length < 3 || CONTENU.fiches.length < 3 || CONTENU.repliques.length < 3 || CONTENU.frises.length < 1) arreter('server/content/cabinet/ ne se lit pas : le calibrage joue le contenu livré')
const LIEUX: readonly Lieu[] = CONTENU.lieux
const FICHES: readonly Fiche[] = CONTENU.fiches
const REPLIQUES: readonly Replique[] = CONTENU.repliques
const FRISES: readonly FriseATheme[] = CONTENU.frises

/**
 * Des tableaux d'essai, d'années voisines : le Détail ne se joue ici qu'au
 * cadrage où il reconnaît, et ce que ses titres disent n'y change rien — les
 * cent vrais tirent `shared/expedition.ts` avec eux.
 */
const TABLEAUX: readonly TableauDuCabinet[] = Array.from({ length: 40 }, (_, i) => ({ qid: `Q${1000 + i}`, titre: `Le tableau ${i}`, peintre: `Le peintre ${i % 13}`, annee: 1420 + i * 13 }))

let numero = 0
/** Une question de la base, synthétique : ce qu'un jeu en lit — ses quatre réponses, sa bonne, sa marche. */
function question(niveau: Niveau, r: Hasard): QuestionTiree {
  numero++
  return { id: `q-${numero}`, texte: `La question ${numero} ?`, reponses: ['Riga', 'Vilnius', 'Tallinn', 'Minsk'], bonne: Math.floor(r() * 4), categorie: 'Géographie', anecdote: 'Le savais-tu ?', niveau }
}
/**
 * La marche d'une question, parmi celles que le tireur de ce jeu prend
 * (`MARCHES_DU_PARI`, `MARCHES_DE_L_ECLAIR`…), chacune autant : la fraîcheur
 * du tirage ne préfère aucune marche.
 */
const uneMarche = (marches: readonly Niveau[], r: Hasard): Niveau => auHasard(marches, r)
/** Ce qu'il trouve, en moyenne, d'une question tirée parmi ces marches. */
const surLesMarches = (j: Joueur, marches: readonly Niveau[]) => marches.reduce((n, k) => n + trouve(j, k), 0) / marches.length
const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const motAuHasard = (n: number, r: Hasard) => Array.from({ length: n }, () => LETTRES[Math.floor(r() * LETTRES.length)]).join('')

/** Des éléments distincts, tirés d'une liste. */
const distincts = <T>(tas: readonly T[], n: number, r: Hasard): T[] => battre(tas, r).slice(0, n)

/**
 * Ce qu'un départ tire, comme le tireur du serveur : les trois manches, puis les rechanges de Changer — aux marches que
 * l'enjeu de l'œuvre visée y ajoute (`marchesDeLEnjeu`), une frise serrée pour une épique (`estUneFriseSerree`), la
 * question du pari plus haute que la première.
 */
function tirer(jeu: CleDeJeu, n: number, r: Hasard, anneeDuDepart: number, enjeu: EnjeuDuTirage): ContenuTire[] {
  const aLEnjeu = (marches: readonly Niveau[]) => P.marchesDeLEnjeu(marches, enjeu)
  switch (jeu) {
    case 'pari':
      return Array.from({ length: n }, (): PariTire => {
        const q1 = question(uneMarche(aLEnjeu(MARCHES_DU_PARI.question), r), r)
        return { jeu, q1, q2: question(uneMarche(marchesDuPari(q1.niveau), r), r) }
      })
    case 'eclair':
      return Array.from({ length: n }, (): EclairTire => ({ jeu, affirmations: Array.from({ length: BAREME.AFFIRMATIONS_DE_L_ECLAIR }, () => affirmationDe(question(uneMarche(aLEnjeu(MARCHES_DE_L_ECLAIR), r), r), r)!) }))
    case 'mot':
      return Array.from({ length: n }, (): MotTire => {
        const lettres = motAuHasard(BAREME.LETTRES_DU_MOT_MIN + Math.floor(r() * (BAREME.LETTRES_DU_MOT_MAX - BAREME.LETTRES_DU_MOT_MIN + 1)), r)
        return { jeu, question: question(uneMarche(aLEnjeu(MARCHES_DU_MOT), r), r), lettres, affiche: lettres[0] + lettres.slice(1).toLowerCase() }
      })
    case 'filet':
      return Array.from({ length: n }, (): FiletTire => {
        for (;;) {
          // Trois sur cinq des années, le reste des estimations, de dix à cent mille.
          const annee = r() < 0.6
          const valeur = annee ? 1100 + Math.floor(r() * 870) : Math.round(10 ** (1 + 4 * r()))
          const piste = pisteDuFilet(valeur, annee, r, anneeDuDepart)
          if (piste) return { jeu, question: question(uneMarche(aLEnjeu(MARCHES_DU_FILET), r), r), valeur, annee, piste }
        }
      })
    case 'detail':
      return distincts(TABLEAUX, n, r).map(t => detailTire(t, TABLEAUX, r, { anecdote: null, categorie: 'Arts & lettres' })!)
    case 'frise': {
      // Une frise se construit d'un bout à l'autre : ses trois manches, jamais de rechange. Pour une épique, une serrée.
      const serrees = enjeu.friseSerree ? FRISES.filter(x => estUneFriseSerree(x.evenements.map(e => e.annee))) : []
      const f = auHasard(serrees.length > 0 ? serrees : FRISES, r)
      return friseEnVagues({ sorte: 'theme', cle: f.id, theme: f.theme, evenements: f.evenements, savais: f.savais, categorie: f.categorie }, r)!
    }
    case 'epingle':
      return distincts(LIEUX, n, r).map(l => epingleTiree(l, r))
    case 'indices':
      return distincts(FICHES, n, r).map((fiche): IndicesTires => ({ jeu, fiche }))
    case 'replique':
      return distincts(REPLIQUES, n, r).map(x => repliqueTiree(x, r))
    case 'quiz':
      return Array.from({ length: n }, (): QuizTire => ({ jeu, theme: null, questions: Array.from({ length: BAREME.QUESTIONS_DU_QUIZ }, () => question(uneMarche(aLEnjeu(MARCHES_DU_QUIZ), r), r)) }))
  }
}

/**
 * L'enjeu qui a tiré chaque départ : une mesure joue en partie libre — sans œuvre visée — ce qu'elle tire à l'enjeu
 * de son but (`enjeuDuBut`), et ce que le joueur y attend de ses manches suit les marches tirées (`MODELES`).
 */
const ENJEUX_DES_DEPARTS = new WeakMap<DepartDUnePartie, EnjeuDuTirage>()
const enjeuDuDepart = (d: DepartDUnePartie): EnjeuDuTirage => ENJEUX_DES_DEPARTS.get(d) ?? P.enjeuDuTirage(d)

/** Les départs relus comme le serveur les relirait, par jeu : un plan qu'il refuserait ferait mentir tout le calibrage. */
const RELUS = new Map<CleDeJeu, number>()
const RELUS_PAR_JEU = 40

/**
 * Un départ, du cadre que le musée accepte : le plan entier, son chrono, sa
 * graine — celle d'Éclairer, nommée par la mesure ou le parcours qui la joue et
 * son rang : tirée d'un compteur commun, la même mesure changeait d'un
 * lancement à l'autre selon les joueurs simulés avant elle.
 */
function departDu(cadre: CadreDuDepart, jour: string, r: Hasard, graine: string, enjeu: EnjeuDuTirage = P.enjeuDuTirage(cadre)): DepartDUnePartie {
  const changer = cadre.carte?.pouvoir === 'changer' && JEUX[cadre.jeu].changeable
  const rechanges = changer ? CHANGEMENTS_PAR_PARTIE[cadre.carte!.force] : 0
  const d: DepartDUnePartie = {
    ...cadre,
    v: P.VERSION_DU_DEPART,
    jour,
    chrono: P.chronoDuDepart(cadre.jeu, cadre.carte),
    graine,
    tirages: tirer(cadre.jeu, MANCHES_PAR_PARTIE + rechanges, r, P.anneeDuDepart({ jour }), enjeu),
  }
  ENJEUX_DES_DEPARTS.set(d, enjeu)
  const relus = RELUS.get(d.jeu) ?? 0
  if (relus < RELUS_PAR_JEU) {
    if (!lireLeDepart(JSON.stringify(d))) arreter(`Le calibrage a tiré un départ ${d.jeu} que le serveur ne relirait pas : ${tronquer(JSON.stringify(d), 300)}…`)
    RELUS.set(d.jeu, relus + 1)
  }
  return d
}

/** Un point de la carte de France tiré au hasard : dans le cadre, et à moins de 60 km d'un lieu livré — la terre, à peu près. */
function pointDeFrance(r: Hasard): Point {
  const { latMin, latMax, lonMin, lonMax } = DANS_LA_FRANCE
  for (;;) {
    const p = { lat: latMin + r() * (latMax - latMin), lon: lonMin + r() * (lonMax - lonMin) }
    if (LIEUX.some(l => distanceKm(p, l) < 60)) return p
  }
}
// ── L'Épingle éclairée, pour qui ne sait pas le lieu ──────────────────────

/** La terre que la carte de France dessine, la métropole ou la Corse — `CONTOUR_DE_LA_FRANCE` écrit la longitude, puis la latitude. */
function dansLeContour(p: Point, contour: readonly (readonly [number, number])[]): boolean {
  let dedans = false
  for (let i = 0, k = contour.length - 1; i < contour.length; k = i++) {
    const [loni, lati] = contour[i]
    const [lonk, latk] = contour[k]
    if (lati > p.lat !== latk > p.lat && p.lon < ((lonk - loni) * (p.lat - lati)) / (latk - lati) + loni) dedans = !dedans
  }
  return dedans
}
const surLaTerre = (p: Point) => dansLeContour(p, CONTOUR_DE_LA_FRANCE) || dansLeContour(p, CONTOUR_DE_LA_CORSE)

/**
 * Comment le centre d'une zone se décale du lieu, dans une direction tirée :
 * d'une distance tirée entre deux bornes (`partout` faux : la règle du code),
 * ou de sorte que le lieu soit partout aussi probable entre ces deux
 * distances du centre (`partout` vrai : un disque, ou une couronne) ; et le
 * rayon que la zone dessine. Celle du code se lit au barème, essai compris ;
 * un joueur qui a vu quelques zones la sait, sans qu'on la lui dise.
 */
interface LoiDeLaZone {
  de: number
  a: number
  partout: boolean
  rayonKm: number
}
const LOI_DU_CODE = (): LoiDeLaZone => ({ de: DECALAGE_DE_LA_ZONE_KM[0], a: DECALAGE_DE_LA_ZONE_KM[1], partout: false, rayonKm: RAYON_D_ECLAIRER_KM })
/** Le lieu partout dans le disque : jusqu'à tant du rayon, qu'il ne passe jamais — le lieu reste dans la zone. */
const DANS_LE_DISQUE = 0.98
const leDisque = (rayonKm: number, de = 0): LoiDeLaZone => ({ de, a: Math.round(rayonKm * DANS_LE_DISQUE), partout: true, rayonKm })
/** La distance au quantile `q` de la loi : partout aussi probable, un tirage dans le carré de la distance. */
const decalageDansLaLoi = (loi: LoiDeLaZone, q: number) => (loi.partout ? Math.sqrt(loi.de ** 2 + q * (loi.a ** 2 - loi.de ** 2)) : loi.de + q * (loi.a - loi.de))
/** Un décalage tiré à cette loi, comme le tireur du serveur tire le sien : la direction, puis la distance. */
const decalageTire = (loi: LoiDeLaZone, r: Hasard): DecalageDeLaZone => {
  const cap = r() * 360
  return { cap, km: decalageDansLaLoi(loi, r()), rayonKm: loi.rayonKm }
}
/**
 * Les pistes que la section de l'Épingle mesure à côté de la règle du code —
 * des propositions, pas des règles : celle du 25 octobre 2026 ; la piste de
 * l'expert de l'équilibre, une couronne de 120 à 165 km — le centre n'y vaut
 * plus que ★, mais la couronne se lit ; le lieu partout dans un disque, de
 * plus en plus grand — plus de couronne à lire ; et les deux qui tiennent la
 * règle posée au nom du propriétaire après la tablée du 25 octobre 2026 :
 * trois zones ne font pas gagner une commune plus d'une fois sur trois à qui
 * ne sait rien, et chacune lui rapporte encore une étoile de plus qu'une
 * épingle plantée n'importe où — un disque de 310 km, ou, sans changer la
 * façon de tirer, un décalage de 120 à 294 km dans une zone de 300. La
 * relecture du 26 octobre 2026 en a essayé une douzaine, de 100 à 160 km pour
 * le plus court, de 260 à 300 pour le plus long : celui-là, et de 140 à
 * 280 km, tiennent les deux bornes, de justesse — plus loin, la zone ne
 * rapporte plus une étoile ; plus près, le tiers des communes se passe, et de
 * 100 à 300 km dans une zone de 310, gardé ici, le frôle.
 */
const PISTES_DE_LA_ZONE: readonly LoiDeLaZone[] = [
  { de: 40, a: 140, partout: false, rayonKm: 170 },
  { de: 120, a: 165, partout: false, rayonKm: 170 },
  ...[170, 240, 300, 310].map(rayonKm => leDisque(rayonKm)),
  { de: 120, a: 294, partout: false, rayonKm: 300 },
  { de: 100, a: 300, partout: false, rayonKm: 310 },
]
/** La force qui donne une zone à chaque manche : celle que le joueur sans savoir emporte, à la section de l'Épingle. */
const FORCE_DES_TROIS_ZONES = ([1, 2, 3] as const).find(f => ECLAIRAGES_PAR_PARTIE[f] >= MANCHES_PAR_PARTIE) ?? 3

/**
 * Où le lieu peut être, la zone vue : des points d'égale chance à la loi du
 * décalage — six distances à ses quantiles, dix-huit directions —, sur la
 * terre seule, que le joueur voit. Une grille plutôt qu'un tirage : où il
 * plante ne tient qu'à la zone, et la mesure ne dépend pas d'un hasard de plus.
 */
function ouPeutEtreLeLieu(centre: Point, loi: LoiDeLaZone): Point[] {
  const DISTANCES = 6
  const DIRECTIONS = 18
  const points: Point[] = []
  for (let i = 0; i < DISTANCES; i++) {
    const km = decalageDansLaLoi(loi, (i + 0.5) / DISTANCES)
    for (let k = 0; k < DIRECTIONS; k++) {
      const x = pointADistance(centre, km, ((k + (i % 2) / 2) * 360) / DIRECTIONS)
      if (surLaTerre(x)) points.push(x)
    }
  }
  return points
}

const KM_PAR_DEGRE = distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
/**
 * Des points à plat autour d'un centre, en kilomètres — à quelques pour cent
 * près au bord d'une zone de 300 km : de quoi choisir où planter sans une
 * trigonométrie par paire ; le vrai jugement mesure ensuite à vol d'oiseau.
 */
const aPlat = (centre: Point) => {
  const cosinus = Math.cos((centre.lat * Math.PI) / 180)
  return (p: Point) => ({ x: (p.lon - centre.lon) * cosinus * KM_PAR_DEGRE, y: (p.lat - centre.lat) * KM_PAR_DEGRE })
}
const auMilieu = (points: readonly Point[]): Point => ({ lat: points.reduce((n, p) => n + p.lat, 0) / points.length, lon: points.reduce((n, p) => n + p.lon, 0) / points.length })

/**
 * Le point qui rapporte le plus d'étoiles, en moyenne, là où le lieu peut
 * être — un possible sur deux, le centre ou leur milieu : deux possibles
 * voisins ne valent pas une étoile d'écart, et chaque candidat se pèse contre
 * tous les possibles.
 */
function auMeilleurPoint(possibles: readonly Point[], centre: Point): Point {
  const plat = aPlat(centre)
  const xy = possibles.map(plat)
  const candidats = [...possibles.filter((_, k) => k % 2 === 0), centre, auMilieu(possibles)]
  const vaut = (c: Point) => {
    const a = plat(c)
    return xy.reduce((n, b) => n + etoilesDeLaDistance(Math.hypot(a.x - b.x, a.y - b.y)), 0)
  }
  return meilleurDes(candidats, vaut)
}

/**
 * Où planter, la zone vue, sans savoir le lieu : au plus près de la région
 * qu'il croit — là même, si le lieu peut y être —, ou, sans rien savoir, au
 * point qui lui rapporte le plus. Ramené dans le cadre de la carte : la page ne
 * plante pas hors d'elle.
 */
function ouPlanter(zone: Point, loi: LoiDeLaZone, region: Point | null, possibles = ouPeutEtreLeLieu(zone, loi)): Point {
  if (possibles.length === 0) return dansLeCadre(zone)
  if (!region) return dansLeCadre(auMeilleurPoint(possibles, zone))
  const km = distanceKm(zone, region)
  if (surLaTerre(region) && km >= loi.de && km <= loi.a) return region
  return dansLeCadre(meilleurDes(possibles, x => -distanceKm(x, region)))
}

// ── Une partie, geste à geste ─────────────────────────────────────────────

/**
 * Ce que veut le joueur de cette partie : atteindre un seuil, dorer, les
 * étoiles (une partie libre qui paie sa poussière), ou les confettis — une
 * partie libre au-delà de la cinquième ne paie plus que ses pièces justes, et
 * qui la joue pour elles parie toujours au Pari (chaque pari ajoute une pièce),
 * lance au Filet celui qui prend le plus souvent une pièce juste.
 */
interface Objectif {
  seuil: number | null
  dorer: boolean
  confettis?: true
}
/** Ce que vaut une partie finie sur tant d'étoiles, à qui vise ce but : atteint ou non — dorer, c'est la partie parfaite —, sinon ses étoiles. */
const butDe = (o: Objectif): ((etoiles: number) => number) => {
  const vise = o.seuil ?? (o.dorer ? ETOILES_D_UNE_PARTIE : null)
  return vise === null ? s => Math.min(ETOILES_D_UNE_PARTIE, s) : s => (s >= vise ? 1 : 0)
}

/** La loi des étoiles d'une manche : chaque compte possible, et sa chance — leur somme fait un. */
type Loi = readonly (readonly [etoiles: number, chance: number])[]
/**
 * Ce qu'il saura d'une manche avant d'y choisir, et ce qu'il pourra y choisir :
 * chaque état, sa part, et ses lancers — chacun sa loi, en étoiles naturelles.
 */
type ModeleDeManche = readonly { part: number; lancers: readonly Loi[] }[]

/**
 * Ce qu'une mesure sans carte dit d'un jeu où rien ne se choisit vers un but :
 * la loi des étoiles naturelles de chaque manche — la première d'une Frise,
 * sans ancre, ne vaut pas les deux autres. Misée, une telle manche se joue
 * pareil, et seule sa part parfaite compte.
 */
interface Allure {
  parManche: readonly Loi[]
}

/**
 * Ce qu'il attend d'une partie au seuil de chaque manche — la chance
 * d'atteindre son seuil, ou la partie parfaite pour dorer ; sinon ses étoiles
 * en moyenne —, selon les étoiles faites et la mise qu'il garde encore :
 * chaque manche, ce qu'il en saura, puis le lancer qui l'en approche le plus ;
 * avant elle, miser ou non, par la règle de Miser (`etoilesApresLesPouvoirs`).
 * Le Pari, le Filet, le Détail et la mise se décident sur elle seule. La mise
 * se jugeait avant sur des manches tirées l'une après l'autre d'une loi
 * moyenne, quand le Filet adapte son filet à la partie : miser y faisait moins
 * que ne jamais miser (la relecture du 26 octobre 2026).
 */
class Avenir {
  private readonly attentes = new Map<string, number>()
  private readonly modeles = new Map<number, ModeleDeManche>()
  constructor(
    private readonly modele: (manche: number) => ModeleDeManche,
    private readonly but: (etoiles: number) => number,
    private readonly carte: CarteDuDepart | null,
  ) {}

  /** La manche `m` jouée, misée ou non, `s` étoiles faites avant elle : ce qu'il en saura, son meilleur lancer, puis la suite. */
  manche(m: number, misee: boolean, s: number, garde: boolean): number {
    if (!this.modeles.has(m)) this.modeles.set(m, this.modele(m))
    const vaut = (k: number) => (misee ? etoilesApresLesPouvoirs([k], this.carte, 0, [true], [false])[0]! : k)
    const apres = (loi: Loi) => loi.reduce((n, [k, chance]) => n + chance * this.attente(m + 1, s + vaut(k), garde), 0)
    return this.modeles.get(m)!.reduce((n, etat) => n + etat.part * Math.max(...etat.lancers.map(apres)), 0)
  }

  /** Ce qu'il attend de la partie à l'ouverture de la manche `m`, `s` étoiles faites, la mise encore gardée ou non. */
  attente(m: number, s: number, garde: boolean): number {
    if (m >= MANCHES_PAR_PARTIE) return this.but(s)
    const cle = `${m}:${s}:${garde}`
    let x = this.attentes.get(cle)
    if (x === undefined) {
      x = Math.max(this.manche(m, false, s, garde), garde ? this.manche(m, true, s, false) : -Infinity)
      this.attentes.set(cle, x)
    }
    return x
  }
}

/**
 * Ce que le joueur sait d'avance d'une manche des jeux où il choisit, et ce
 * qu'il y choisit — les parts mêmes de ses manches jouées : le Pari, garder ou
 * parier, sa première réponse vue ; le Filet, le filet, sa valeur sue ou
 * estimée, sa marche pas encore lue ; le Détail, le cadrage où il cessera de
 * reculer pour deviner — reculer ne lui apprend que de n'avoir pas reconnu, et
 * ce choix vaut toutes les façons de reculer. Les autres jeux n'y choisissent
 * rien : leur loi mesurée (`Allure`).
 */
const MODELES: Partial<Record<CleDeJeu, (j: Joueur, enjeu: EnjeuDuTirage) => ModeleDeManche>> = {
  pari: (j, enjeu) => {
    // La première à l'une de ses marches, chacune autant — celles que l'enjeu ajoute comprises ; juste, il garde, ou
    // parie sur une question plus haute qu'elle (`marchesDuPari`). Facile ou moyenne, la même : le modèle d'avant l'enjeu.
    const marches = P.marchesDeLEnjeu(MARCHES_DU_PARI.question, enjeu)
    const justes = marches.map(m => ({ part: trouve(j, m) / marches.length, p2: surLesMarches(j, marchesDuPari(m)) }))
    return [
      ...justes.map(({ part, p2 }) => ({ part, lancers: [[[ETOILES_DU_PARI.garder, 1]], [[ETOILES_DU_PARI.parier, p2], [0, 1 - p2]]] as Loi[] })),
      { part: 1 - justes.reduce((n, x) => n + x.part, 0), lancers: [[[0, 1]]] },
    ]
  },
  filet: (j, enjeu) => {
    const marches = P.marchesDeLEnjeu(MARCHES_DU_FILET, enjeu)
    const sait = marches.reduce((n, k) => n + filetSait(j, k), 0) / marches.length
    return [
      { part: sait, ecart: MODELE.filetPrecis },
      { part: 1 - sait, ecart: flouDuFilet(j) },
    ].map(a => ({ part: a.part, lancers: TAILLES.map((t): Loi => [[ETOILES_DU_FILET[t], prise(t, a.ecart)], [0, 1 - prise(t, a.ecart)]]) }))
  },
  detail: j => {
    const reconnu = part(j, MODELE.detailReconnu)
    const auCadrage = partsSelonLaForce(MODELE.detailAuCadrage, j)
    const lancers = ETOILES_AU_CADRAGE.map((etoiles, k): Loi => {
      const avant = auCadrage.slice(0, k + 1).map((x, a): readonly [number, number] => [ETOILES_AU_CADRAGE[a], reconnu * x])
      const sinon = 1 - avant.reduce((n, [, chance]) => n + chance, 0)
      return [...avant, [etoiles, sinon / TITRES_DU_DETAIL], [0, sinon * (1 - 1 / TITRES_DU_DETAIL)]]
    })
    return [{ part: 1, lancers }]
  },
}
/** Ce qu'il saura de chaque manche de ce jeu : son modèle, ou la loi que la mesure en a faite. */
function modeleDesManches(j: Joueur, jeu: CleDeJeu, allure: Allure | null, enjeu: EnjeuDuTirage): (manche: number) => ModeleDeManche {
  const explicite = MODELES[jeu]
  if (explicite) {
    const x = explicite(j, enjeu)
    return () => x
  }
  if (!allure) throw new Error(`${jeu} : la loi de ses manches manque à la mise`)
  return m => [{ part: 1, lancers: [allure.parManche[m]] }]
}

/** Une partie qu'un joueur mène, à l'heure du serveur : chaque geste arrive après le temps qu'il met, et le vrai pli le juge. */
class Partie {
  e: EtatDeLaPartie = P.ETAT_DU_DEPART
  t: number
  readonly debut: number
  readonly savoirs = new Map<number, unknown>()
  enRetard = 0
  private avenirDeLaPartie: Avenir | null = null
  constructor(
    readonly d: DepartDUnePartie,
    readonly j: Joueur,
    readonly r: Hasard,
    t0: number,
    readonly objectif: Objectif,
    private readonly allure: Allure | null,
  ) {
    this.t = t0
    this.debut = t0
  }

  /** Ce qu'il sait d'un contenu, tiré la première fois qu'il le voit : Changer en montre un autre. */
  savoir<T>(tirage: number, tirer: () => T): T {
    if (!this.savoirs.has(tirage)) this.savoirs.set(tirage, tirer())
    return this.savoirs.get(tirage) as T
  }
  oui = (p: number) => this.r() < p

  get manche() {
    return P.mancheEnCours(this.e)!
  }
  tiree<T>(): T {
    return this.d.tirages[this.manche.tirage] as T
  }
  vue<T>(): T {
    const m = this.manche
    return regleDe(this.d.jeu).montrer(this.d.tirages[m.tirage], m.etat) as T
  }
  tranchee = () => this.e.fin !== null || this.manche.verdict !== null

  /** Il garde la mise pour une manche à venir : sa carte-bonus mise, pas encore servie. Pour dorer, nul pouvoir ; pour les confettis, une mise ne paie pas une pièce. */
  get miseGardee(): boolean {
    return this.d.carte?.pouvoir === 'miser' && this.e.misee === null && !this.objectif.dorer && !this.objectif.confettis
  }
  private get avenir(): Avenir {
    return (this.avenirDeLaPartie ??= new Avenir(modeleDesManches(this.j, this.d.jeu, this.allure, enjeuDuDepart(this.d)), butDe(this.objectif), this.d.carte))
  }

  /**
   * Ce qu'il attend de la partie s'il finit la manche `m` sur `k` étoiles de
   * plus — après les pouvoirs (`vautDans`) —, la mise qu'il garde comprise :
   * la chance du seuil qu'il vise, que seuls lisent les jeux qui le déclarent
   * (`MANCHES`). Les autres se jouent pareil vers cinq, six ou sept étoiles,
   * et se mesurent une fois pour les trois : un jeu qui le lirait sans le dire
   * fausserait ses trois parts sans un mot — il s'arrête ici.
   */
  attente(m: Manche, k: number): number {
    if (!MANCHES[this.d.jeu].viseLeSeuil) throw new Error(`${this.d.jeu} lit le but visé sans le déclarer (MANCHES) : ses parts se mesureraient sur les parties d'un autre seuil`)
    return this.avenir.attente(m + 1, this.etoilesAvant(m) + k, this.miseGardee)
  }

  /**
   * Miser la manche qui s'ouvre, avant de la voir ? Si elle l'approche plus de
   * son but que de la jouer d'ordinaire en gardant la mise pour une autre — la
   * même programmation que ses choix dans la manche (`Avenir`).
   */
  miserIci(m: Manche): boolean {
    if (!this.miseGardee || !this.peut('miser')) return false
    const s = this.etoilesAvant(m)
    return this.avenir.manche(m, true, s, false) > this.avenir.manche(m, false, s, true) + 1e-9
  }

  /** Le geste tel que la page l'envoie, joué par le vrai pli : un refus serait une erreur du calibrage. */
  private jouer(g: GesteDuCabinet) {
    const apres = P.jouerUnGeste(this.d, this.e, g, Math.round(this.t))
    if (typeof apres === 'string') throw new Error(`${this.d.jeu}, manche ${'manche' in g ? g.manche : '?'} : ${JSON.stringify(g)} refusé — ${apres}`)
    this.e = apres
  }

  /**
   * Un geste, après le temps qu'il met à le faire. S'il arrive après
   * l'échéance et sa grâce, la page a envoyé d'elle-même, à l'échéance, ce
   * qu'elle avait sous les yeux (`aLEcheance`) : l'épingle posée, la frise
   * rangée, le curseur — ou rien. Faux s'il est arrivé trop tard.
   */
  geste(g: GesteDuCabinet, secondes: number, aLEcheance?: (echeance: number) => ReponseDUnJeu | undefined): boolean {
    const m = P.mancheEnCours(this.e)
    // Une manche déjà tranchée — l'échéance passée pendant un geste d'avant — ne prend plus rien.
    if (g.quoi !== 'ouvrir' && 'manche' in g && (this.e.fin !== null || m?.verdict)) return false
    const arrivee = this.t + secondes * 1000 * this.j.vitesse * Math.exp(0.3 * normale(this.r))
    if (m && m.verdict === null && 'manche' in g && P.leChronoCourt(m)) {
      const etape = P.etapeEnCours(m)
      const echeance = echeanceDe(etape, arrivee)
      if (arrivee > echeance + etape.graceMs) {
        this.t = echeance + 300
        const reponse = aLEcheance?.(echeance)
        this.jouer({ quoi: 'repondre', manche: g.manche, auto: true, ...(reponse && { reponse }) })
        this.enRetard++
        return false
      }
    }
    this.t = arrivee
    this.jouer(g)
    return true
  }
  repondre(m: Manche, reponse: ReponseDUnJeu, secondes: number, gardee = false): boolean {
    return this.geste({ quoi: 'repondre', manche: m, reponse }, secondes, gardee ? () => reponse : undefined)
  }

  /** Un pouvoir se joue-t-il maintenant ? La règle du pli, jamais une recopie (`pouvoirMaintenant`). */
  peut(pouvoir: CleDePouvoir): boolean {
    if (this.d.carte?.pouvoir !== pouvoir || this.objectif.dorer) return false
    return P.pouvoirMaintenant(this.d, this.e, Math.round(this.t))?.jouable === true
  }
  eclairer(m: Manche, affirmation?: number) {
    this.geste({ quoi: 'eclairer', manche: m, ...(affirmation !== undefined && { affirmation }) }, SECONDES.pouvoir)
  }
  /**
   * Changer, s'il voit qu'il ne sait pas : vrai si la manche a changé de
   * contenu. Ce qu'il a lu pour le voir se paie avec le geste, le chrono qui
   * court — la question, le récit, le premier cadrage, le premier indice, les
   * affirmations jusqu'à la troisième qu'il ignore —, au temps que le jeu lui
   * donne pour le lire et y répondre (`SECONDES`). Seuls les Indices la
   * payaient : au Détail, reconnaître le tableau au premier cadrage ne coûtait
   * rien, et « le Détail, Changer 3 », le meilleur gardien du complétionniste,
   * le faisait passer au-dessus de la série de ce temps-là (la relecture du
   * 26 octobre 2026). Pas de lecture d'office : chaque jeu dit la sienne.
   */
  changer(m: Manche, neSaitPas: boolean, lecture: number): boolean {
    if (!neSaitPas || !this.peut('changer')) return false
    return this.geste({ quoi: 'changer', manche: m }, SECONDES.pouvoir + lecture)
  }
  /**
   * Ce que vaut dans cette manche une réponse de tant d'étoiles naturelles :
   * autant, sauf misée — parfaite, trois et le bonus, sinon rien, par la règle
   * de Miser (`etoilesApresLesPouvoirs`). Le Pari, le Filet et le Détail se
   * jouent alors pour la manche parfaite : garder, un filet plus large ou
   * reculer y valaient leurs étoiles d'ordinaire, et la mise se perdait.
   */
  vautDans(m: Manche, naturel: number): number {
    return this.e.misee === m ? etoilesApresLesPouvoirs([naturel], this.d.carte, 0, [true], [false])[0]! : naturel
  }
  /** Une proposition parmi celles qui ne sont pas effacées. */
  parmi(n: number, effacees: readonly number[]): number {
    return auHasard(
      Array.from({ length: n }, (_, k) => k).filter(k => !effacees.includes(k)),
      this.r,
    )
  }
  /**
   * Sa réponse à une question de la base qu'il ne sait pas : juste à la chance
   * de sa marche (`devineJuste`), que chaque réponse effacée par Éclairer
   * relève d'autant — deux restantes, deux fois plus de chances qu'à quatre.
   */
  devine(q: QuestionTiree, effacees: readonly number[]): number {
    const restantes = q.reponses.length - effacees.length
    if (this.oui(Math.min(1, (devineJuste(this.j, q.niveau, q.reponses.length) * q.reponses.length) / restantes))) return q.bonne
    return auHasard(
      q.reponses.map((_, k) => k).filter(k => k !== q.bonne && !effacees.includes(k)),
      this.r,
    )
  }
  /** Les étoiles déjà gagnées, après les pouvoirs : le Pari en lit son choix. */
  etoilesAvant(m: Manche): number {
    return P.etoilesDesManches(this.d, this.e)
      .slice(0, m)
      .reduce((n, x) => n + (x.etoiles ?? 0), 0)
  }
}

/** Le Pari : sa réponse, puis garder ou parier — le choix qui l'approche le plus de son seuil. */
function mancheDuPari(p: Partie, m: Manche): void {
  const t = p.tiree<PariTire>()
  const s = p.savoir(p.manche.tirage, () => ({ q1: p.oui(sait(p.j, t.q1.niveau)), q2: p.oui(sait(p.j, t.q2.niveau)) }))
  if (p.changer(m, !s.q1, SECONDES.pariQuestion)) return mancheDuPari(p, m)
  if (!s.q1 && p.peut('eclairer')) p.eclairer(m)
  const choix1 = s.q1 ? t.q1.bonne : p.devine(t.q1, p.vue<PariMontre>().effacees)
  if (!p.repondre(m, { pari: { choix: choix1 } }, SECONDES.pariQuestion) || p.tranchee()) return
  if (!parier(p, m)) {
    p.geste({ quoi: 'garder', manche: m }, SECONDES.pariChoix)
    return
  }
  p.geste({ quoi: 'parier', manche: m }, SECONDES.pariChoix)
  if (!s.q2 && p.peut('eclairer')) p.eclairer(m)
  const choix2 = s.q2 ? t.q2.bonne : p.devine(t.q2, p.vue<PariMontre>().effacees)
  p.repondre(m, { pari: { choix: choix2 } }, SECONDES.pariQuestion)
}

/**
 * Garder ou parier : pour dorer, parier toujours (trois parfaites), et pour les
 * confettis aussi (une pièce de plus) ; sinon, le choix qui l'approche le plus
 * de son but (`Partie.attente`) — en partie libre, quand le pari rapporte plus
 * que les étoiles gardées ; vers un seuil, les manches qui restent comprises :
 * garder trois fois ne fait que trois étoiles. La manche misée vaut ce que la
 * mise en fait (`vautDans`) : gardée, rien.
 */
function parier(p: Partie, m: Manche): boolean {
  if (p.objectif.dorer || p.objectif.confettis) return true
  // La question du pari est plus haute que la première, qu'il vient de lire : difficile ou experte, experte après une difficile.
  const p2 = surLesMarches(p.j, marchesDuPari(p.tiree<PariTire>().q1.niveau))
  const { garder, parier: pari } = ETOILES_DU_PARI
  return p2 * p.attente(m, p.vautDans(m, pari)) + (1 - p2) * p.attente(m, 0) > p.attente(m, p.vautDans(m, garder))
}

/** L'Éclair : cinq affirmations ; il dit ce qu'il sait, devine le reste, et souffle d'abord ce qu'il ignore. */
function mancheDeLEclair(p: Partie, m: Manche): void {
  const t = p.tiree<EclairTire>()
  const s = p.savoir(p.manche.tirage, () => t.affirmations.map(a => p.oui(sait(p.j, a.question.niveau))))
  // Il les lit dans l'ordre, et change à la troisième qu'il ignore : la lecture de celles d'avant se paie.
  const troisieme = s.map((x, i) => (x ? -1 : i)).filter(i => i >= 0)[2]
  if (troisieme !== undefined && p.changer(m, true, SECONDES.eclairAffirmation * (troisieme + 1))) return mancheDeLEclair(p, m)
  for (let i = 0; i < s.length; i++) if (!s[i] && p.peut('eclairer')) p.eclairer(m, i)
  const soufflees = new Map(p.vue<EclairMontre>().soufflees.map(x => [x.affirmation, x.vraie]))
  const reponses = t.affirmations.map((a, i) => soufflees.get(i) ?? (s[i] ? a.proposee === a.question.bonne : p.r() < 0.5))
  const parAffirmation = SECONDES.eclairAffirmation * p.j.vitesse * 1000
  // À l'échéance, la page envoie celles qu'il a eu le temps de dire.
  p.geste({ quoi: 'repondre', manche: m, reponse: { eclair: { reponses } } }, SECONDES.eclairAffirmation * reponses.length, echeance => {
    const dites = Math.max(0, Math.min(reponses.length, Math.floor((echeance - p.manche.etapes[0].ouverteLe) / parAffirmation)))
    return { eclair: { reponses: reponses.map((x, i) => (i < dites ? x : null)) } }
  })
}

/**
 * Le Quiz : chaque question, il la sait ou la devine parmi celles qui restent ; il change à la troisième qu'il ignore,
 * comme à l'Éclair — la lecture de celles d'avant se paie —, et éclaire celles qu'il ignore.
 */
function mancheDuQuiz(p: Partie, m: Manche): void {
  const t = p.tiree<QuizTire>()
  const s = p.savoir(p.manche.tirage, () => t.questions.map(q => p.oui(sait(p.j, q.niveau))))
  const troisieme = s.map((x, i) => (x ? -1 : i)).filter(i => i >= 0)[2]
  if (troisieme !== undefined && p.changer(m, true, SECONDES.quizQuestion * (troisieme + 1))) return mancheDuQuiz(p, m)
  for (let i = 0; i < s.length; i++) if (!s[i] && p.peut('eclairer')) p.eclairer(m, i)
  const effacees = p.vue<QuizMontre>().effacees
  const choix = t.questions.map((q, i) => (s[i] ? q.bonne : auHasard(q.reponses.map((_, k) => k).filter(k => !(effacees[i] ?? []).includes(k)), p.r)))
  const parQuestion = SECONDES.quizQuestion * p.j.vitesse * 1000
  // À l'échéance, la page envoie celles qu'il a eu le temps de dire.
  p.geste({ quoi: 'repondre', manche: m, reponse: { quiz: { choix } } }, SECONDES.quizQuestion * choix.length, echeance => {
    const dites = Math.max(0, Math.min(choix.length, Math.floor((echeance - p.manche.etapes[0].ouverteLe) / parQuestion)))
    return { quiz: { choix: choix.map((x, i) => (i < dites ? x : null)) } }
  })
}

/** Le Mot mystère : le mot s'il le sait ; sinon des essais, et le mot trouvé aux couleurs, s'il le déduit. */
function mancheDuMot(p: Partie, m: Manche): void {
  const t = p.tiree<MotTire>()
  const s = p.savoir(p.manche.tirage, () => p.oui(sait(p.j, t.question.niveau)))
  if (p.changer(m, !s, SECONDES.motEssai)) return mancheDuMot(p, m)
  const faux = () => {
    for (;;) {
      const x = motAuHasard(t.lettres.length, p.r)
      if (x !== t.lettres) return x
    }
  }
  if (s) {
    p.geste({ quoi: 'essai', manche: m, lettres: t.lettres }, SECONDES.motEssai)
    return
  }
  if (p.peut('eclairer')) p.eclairer(m)
  const soufflees = p.vue<MotMontre>().soufflees.length
  // Le joueur au hasard déduit à la chance du moyen : il ne sait rien de la question, mais les couleurs, il les lit.
  const deduit = p.oui(chance(MODELE.motDeduit, (p.j.theta ?? 0) + MODELE.motParLettre * soufflees))
  const trouveA = deduit ? ESSAIS_DU_MOT - MODELE.motAuxEssais.length + 1 + selon(MODELE.motAuxEssais, p.r) : 0
  for (let essai = 1; essai <= BAREME.ESSAIS_DU_MOT && !p.tranchee(); essai++) {
    if (!p.geste({ quoi: 'essai', manche: m, lettres: essai === trouveA ? t.lettres : faux() }, SECONDES.motEssai)) return
  }
}

/** Le meilleur d'un tas à cette aune ; à égalité, à un milliardième près, à la seconde. */
function meilleurDes<T>(tas: readonly T[], aune: (x: T) => number, departage: (x: T) => number = () => 0): T {
  return tas.reduce((a, b) => {
    const d = aune(b) - aune(a)
    return d > 1e-9 || (d > -1e-9 && departage(b) > departage(a)) ? b : a
  })
}

const TAILLES = Object.keys(LARGEURS_DU_FILET) as TailleDuFilet[]
/**
 * La chance qu'il prenne la réponse dans ce filet, à l'écart type — en part de
 * la piste — qu'il se sait de son estimation ; sans rien savoir, un curseur
 * posé au hasard la prend à la part de piste que le filet couvre.
 */
const prise = (taille: TailleDuFilet, ecart: number) => (Number.isFinite(ecart) ? erf(LARGEURS_DU_FILET[taille] / (ecart * Math.SQRT2)) : 2 * LARGEURS_DU_FILET[taille])
/** Son écart quand il estime sans savoir : plus fort, plus serré. */
const flouDuFilet = (j: Joueur) => (j.theta === null ? Infinity : MODELE.filetFlou * Math.exp(-0.3 * j.theta))

/**
 * Le filet qu'il lance, à ce qu'il sait de son estimation. Pour ses confettis,
 * celui qui prend le plus souvent une pièce juste ; sinon, celui qui
 * l'approche le plus de son but (`Partie.attente`) : vers un seuil — ou pour
 * dorer, trois manches parfaites —, les manches qui restent comprises, comme
 * au Pari ; en partie libre, le plus d'étoiles en moyenne, qui départage aussi
 * le reste — le seuil déjà tenu, ou hors d'atteinte. Viser la moyenne seule,
 * c'était lancer le grand filet sans savoir : une étoile par manche, jamais
 * une commune, jamais une pièce juste — la stratégie, pas la règle. La manche
 * misée vaut ce que la mise en fait (`vautDans`) : le petit filet seul y
 * rapporte.
 */
function filetLance(p: Partie, m: Manche, ecart: number): TailleDuFilet {
  const ici = (t: TailleDuFilet) => p.vautDans(m, ETOILES_DU_FILET[t])
  const moyenne = (t: TailleDuFilet) => ici(t) * prise(t, ecart)
  if (p.objectif.confettis) return meilleurDes(TAILLES, t => (ETOILES_DU_FILET[t] >= ETOILES_D_UNE_JUSTE ? prise(t, ecart) : 0), moyenne)
  return meilleurDes(TAILLES, t => prise(t, ecart) * p.attente(m, ici(t)) + (1 - prise(t, ecart)) * p.attente(m, 0), moyenne)
}

/** Le Filet : son estimation, puis le filet qui l'approche le plus de son but (`filetLance`). */
function mancheDuFilet(p: Partie, m: Manche): void {
  const t = p.tiree<FiletTire>()
  const s = p.savoir(p.manche.tirage, () => p.oui(filetSait(p.j, t.question.niveau)))
  if (p.changer(m, !s, SECONDES.filet)) return mancheDuFilet(p, m)
  if (!s && p.peut('eclairer')) p.eclairer(m)
  const { piste, zone } = p.vue<FiletMontre>()
  const longueur = piste.max - piste.min
  const flou = s ? MODELE.filetPrecis : flouDuFilet(p.j)
  let x = p.j.theta === null ? piste.min + p.r() * longueur : t.valeur + normale(p.r) * flou * longueur
  // Éclairé, il garde son estimation dans la zone dorée ; elle y borne son écart.
  const ecart = zone ? Math.min(flou, ZONE_DU_FILET / Math.sqrt(12)) : flou
  if (zone) x = Math.min(Math.max(x, zone.de), zone.a)
  const surLePas = Number((piste.min + Math.round((Math.min(Math.max(x, piste.min), piste.max) - piste.min) / piste.pas) * piste.pas).toFixed(decimales(piste.pas)))
  const lance = Math.min(Math.max(surLePas, piste.min), piste.max)
  p.repondre(m, { filet: { x: lance, taille: filetLance(p, m, ecart) } }, SECONDES.filet, true)
}

/**
 * Le Détail : il répond au cadrage où il reconnaît ; sinon il recule tant que
 * reculer l'approche plus de son but que deviner (`reculer`). Misée, la manche
 * ne vaut qu'au premier cadrage : il y devine plutôt que de reculer vers rien.
 */
function mancheDuDetail(p: Partie, m: Manche): void {
  const t = p.tiree<DetailTire>()
  const s = p.savoir(p.manche.tirage, () => ({ reconnu: p.oui(part(p.j, MODELE.detailReconnu)), au: rangSelonLaForce(MODELE.detailAuCadrage, p.j, p.r) }))
  if (p.changer(m, !(s.reconnu && s.au === 1), SECONDES.detailRegard)) return mancheDuDetail(p, m)
  let eclaire = false
  while (!p.tranchee()) {
    const v = p.vue<DetailMontre>()
    if (s.reconnu && v.cadrage >= s.au) {
      p.repondre(m, { detail: { titre: t.bonne } }, SECONDES.detailRegard)
      return
    }
    if (!eclaire && p.peut('eclairer')) {
      p.eclairer(m)
      eclaire = true
      continue
    }
    if (!v.peutReculer || !reculer(p, m, v.cadrage, v.titres.filter(x => !x.efface).length)) {
      p.repondre(m, { detail: { titre: p.parmi(v.titres.length, v.titres.flatMap((x, k) => (x.efface ? [k] : []))) } }, SECONDES.detailRegard)
      return
    }
    if (!p.geste({ quoi: 'reculer', manche: m }, SECONDES.detailRegard)) return
  }
}

/**
 * Reculer d'un cadrage, ou deviner ici parmi les titres qui restent ? Ce qu'il
 * attend de chacun (`Partie.attente`), à sa force : reculer, c'est reconnaître
 * au cadrage suivant, sachant qu'il n'a pas reconnu jusqu'ici, ou y décider
 * encore — jusqu'au tableau entier, qui ne vaut rien. Le Détail se joue ainsi
 * vers son seuil : en partie libre, il reculait vers ce qui rapporte le plus
 * d'étoiles en moyenne, et perdait la partie parfaite — plus de parties à neuf
 * étoiles sur neuf, jouées pour dorer, qu'à sept ou plus.
 */
function reculer(p: Partie, m: Manche, cadrage: number, restants: number): boolean {
  const reconnu = part(p.j, MODELE.detailReconnu)
  const auCadrage = partsSelonLaForce(MODELE.detailAuCadrage, p.j)
  const rien = p.attente(m, 0)
  const ici = (c: number) => p.attente(m, p.vautDans(m, ETOILES_AU_CADRAGE[c - 1] ?? 0))
  const deviner = (c: number) => (ici(c) + (restants - 1) * rien) / restants
  /** Reconnaître au cadrage `c`, sachant qu'il n'a pas reconnu avant. */
  const reconnaitAu = (c: number) => (reconnu * (auCadrage[c - 1] ?? 0)) / Math.max(1e-9, 1 - reconnu * auCadrage.slice(0, c - 1).reduce((a, b) => a + b, 0))
  const apresLeRecul = (c: number): number => {
    const suivant = c + 1
    const sinon = suivant < ETOILES_AU_CADRAGE.length ? Math.max(deviner(suivant), apresLeRecul(suivant)) : deviner(suivant)
    return reconnaitAu(suivant) * ici(suivant) + (1 - reconnaitAu(suivant)) * sinon
  }
  return apresLeRecul(cadrage) > deviner(cadrage) + 1e-12
}

/** La Frise : chaque nouveau venu à l'année qu'il lui prête — la vraie s'il la sait —, parmi les ancres. */
function mancheDeLaFrise(p: Partie, m: Manche): void {
  const t = p.tiree<FriseTiree>()
  const annees = t.evenements.map(e => e.annee)
  // Une seule frise pour les trois manches : ce qu'il en sait vaut pour toute la partie. Ce qu'il ignore, il le situe à
  // quelques décennies près, quelle que soit la frise : deux voisins à quatre ans se rangent à pile ou face.
  const estimees = p.savoir(0, () => annees.map(a => (p.j.theta !== null && p.oui(part(p.j, MODELE.friseSait)) ? a : a + normale(p.r) * MODELE.friseFlouAns * Math.exp(-0.3 * (p.j.theta ?? 0)))))
  const nouveaux = t.vagues[t.vague]
  if (p.j.theta !== null && nouveaux.some(rg => estimees[rg] !== annees[rg]) && p.peut('eclairer')) p.eclairer(m)
  const v = p.vue<FriseMontree>()
  let ordre: number[]
  if (p.j.theta === null) {
    ordre = v.ancres.map(a => a.jeton)
    for (const n of battre(v.nouveaux, p.r)) ordre.splice(Math.floor(p.r() * (ordre.length + 1)), 0, n.jeton)
  } else {
    const poses = [
      ...v.ancres.map(a => ({ jeton: a.jeton, annee: a.annee, ancre: 0 })),
      ...v.nouveaux.map((n, i) => ({ jeton: n.jeton, annee: n.annee ?? estimees[nouveaux[i]], ancre: 1 })),
    ]
    ordre = poses.sort((a, b) => a.annee - b.annee || a.ancre - b.ancre).map(x => x.jeton)
  }
  p.repondre(m, { frise: { ordre } }, SECONDES.friseBase + SECONDES.friseParVenu * v.nouveaux.length, true)
}

/**
 * L'Épingle : le lieu s'il le sait ; sinon, la zone éclairée lue (`ouPlanter`)
 * — au plus près de sa région s'il la sait, au point qui lui rapporte le plus
 * s'il ne sait rien ; sans zone, sa région, ou n'importe où. Planter au seul
 * centre de la zone, c'était ignorer la carte qu'il voit : la terre, et où
 * le lieu peut être autour du centre.
 */
function mancheDeLEpingle(p: Partie, m: Manche): void {
  const t = p.tiree<EpingleTiree>()
  const s = p.savoir(p.manche.tirage, () => ({ lieu: p.oui(part(p.j, MODELE.epingleSait)), region: p.oui(part(p.j, MODELE.epingleRegion)) }))
  if (p.changer(m, !s.lieu && !s.region, SECONDES.epingle)) return mancheDeLEpingle(p, m)
  if (!s.lieu && p.peut('eclairer')) p.eclairer(m)
  const { zone } = p.vue<EpingleMontree>()
  const autour = (km: () => number): Point => {
    for (let essai = 0; essai < 30; essai++) {
      const x = pointADistance(t.lieu, km(), p.r() * 360)
      if (dansLaFrance(x)) return x
    }
    return pointDeFrance(p.r)
  }
  const [pres, loin] = MODELE.epingleRegionKm
  const sansLeLieu = (): Point => {
    const region = p.j.theta !== null && s.region ? autour(() => pres + p.r() * (loin - pres)) : null
    return zone ? ouPlanter(zone, LOI_DU_CODE(), region) : (region ?? pointDeFrance(p.r))
  }
  const epingle = p.j.theta !== null && s.lieu ? autour(() => -MODELE.epinglePresKm * Math.log(1 - p.r())) : sansLeLieu()
  p.repondre(m, { epingle }, SECONDES.epingle, true)
}

/**
 * Les Indices : un indice de plus jusqu'à reconnaître la personne ; au hasard,
 * des noms d'autres fiches. Changer se décide au premier indice, le plus
 * obscur, sur ce qu'il en lit : décidé sur ce qu'il ne saurait qu'au cinquième
 * — reconnaîtra-t-il la personne ? —, Changer 3 menait le moyen à une commune
 * 87 fois sur 100, contre 53 sans carte.
 */
function mancheDesIndices(p: Partie, m: Manche): void {
  const t = p.tiree<IndicesTires>()
  const s = p.savoir(p.manche.tirage, () => ({ reconnu: p.oui(part(p.j, MODELE.indicesReconnu)), au: rangSelonLaForce(MODELE.indicesAuRang, p.j, p.r) }))
  if (p.changer(m, !(s.reconnu && s.au === 1), SECONDES.indiceLu)) return mancheDesIndices(p, m)
  if (p.j.theta !== null && p.peut('eclairer')) p.eclairer(m)
  const essayes = new Set<string>()
  const unAutreNom = () => {
    const restants = FICHES.filter(f => !essayes.has(f.reponse) && (p.j.theta === null || f.id !== t.fiche.id))
    const nom = auHasard(restants, p.r).reponse
    essayes.add(nom)
    return nom
  }
  while (!p.tranchee()) {
    const v = p.vue<IndicesMontres>()
    const ok =
      p.j.theta === null
        ? p.geste({ quoi: 'nom', manche: m, texte: unAutreNom() }, SECONDES.indiceNom)
        : s.reconnu && v.indices.length >= s.au
          ? p.geste({ quoi: 'nom', manche: m, texte: t.fiche.reponse }, SECONDES.indiceNom)
          : v.caches > 0
            ? p.geste({ quoi: 'indice', manche: m }, SECONDES.indiceLu)
            : p.geste({ quoi: 'nom', manche: m, texte: unAutreNom() }, SECONDES.indiceNom)
    if (!ok) return
  }
}

/** La Réplique : le mot, puis qui l'a dite — ce qu'il sait, ou parmi ce qu'Éclairer laisse. */
function mancheDeLaReplique(p: Partie, m: Manche): void {
  const t = p.tiree<RepliqueTiree>()
  const s = p.savoir(p.manche.tirage, () => {
    const mot = p.oui(part(p.j, MODELE.repliqueMot))
    return { mot, qui: p.j.theta !== null && p.oui(mot ? MODELE.repliqueQuiSiMot : part(p.j, MODELE.repliqueQui)) }
  })
  if (p.changer(m, !s.mot, SECONDES.repliqueEtape)) return mancheDeLaReplique(p, m)
  // Changer, sa lecture payée, a pu arriver après l'échéance du mot — Éclairer aussi : la page a envoyé le mot vide, et
  // « Qui l'a dit ? » s'est ouvert.
  const auMot = () => p.vue<RepliqueMontreeAuMot | RepliqueMontreeAQui>()
  if (!s.mot && auMot().etape === 1 && p.peut('eclairer')) p.eclairer(m)
  const vue = auMot()
  if (vue.etape === 1) {
    const choix = s.mot ? t.bonMot : p.parmi(t.mots.length, vue.mots.flatMap((x, k) => (x.efface ? [k] : [])))
    p.geste({ quoi: 'mot', manche: m, choix }, SECONDES.repliqueEtape)
  }
  if (p.tranchee()) return
  if (!s.qui && p.peut('eclairer')) p.eclairer(m)
  const aQui = p.vue<RepliqueMontreeAQui>()
  const qui = s.qui ? t.bonneQui : p.parmi(t.personnes.length, aQui.personnes.flatMap((x, k) => (x.efface ? [k] : [])))
  p.repondre(m, { replique: { qui } }, SECONDES.repliqueEtape)
}

/**
 * Chaque jeu, et s'il se joue autrement selon le seuil visé : le Pari (garder
 * ou parier), le Filet (quel filet lancer) et le Détail (reculer ou deviner)
 * le lisent (`Partie.attente`), les autres non — leurs parts à cinq, six et
 * sept étoiles se lisent alors sur les mêmes parties, et ne se contredisent
 * plus au seul bruit du tirage. Un jeu qui le lit a son modèle (`MODELES`).
 */
const MANCHES: { readonly [J in CleDeJeu]: { jouer: (p: Partie, m: Manche) => void; viseLeSeuil: boolean } } = {
  pari: { jouer: mancheDuPari, viseLeSeuil: true },
  eclair: { jouer: mancheDeLEclair, viseLeSeuil: false },
  mot: { jouer: mancheDuMot, viseLeSeuil: false },
  filet: { jouer: mancheDuFilet, viseLeSeuil: true },
  detail: { jouer: mancheDuDetail, viseLeSeuil: true },
  frise: { jouer: mancheDeLaFrise, viseLeSeuil: false },
  epingle: { jouer: mancheDeLEpingle, viseLeSeuil: false },
  indices: { jouer: mancheDesIndices, viseLeSeuil: false },
  replique: { jouer: mancheDeLaReplique, viseLeSeuil: false },
  quiz: { jouer: mancheDuQuiz, viseLeSeuil: false },
}

/** Une partie jouée : son état final, ce qu'elle a duré, ses pièces justes. */
interface PartieJouee {
  depart: DepartDUnePartie
  etat: EtatDeLaPartie
  secondes: number
  justes: number
  enRetard: number
}

/**
 * Une partie entière : chaque manche ouverte — misée avant d'être vue, si la
 * mise l'approche plus de son but (`Partie.miserIci`) —, jouée, révélée. Un jeu
 * où rien ne se choisit dit à la mise la loi de ses manches (`allure`).
 */
function jouerLaPartie(d: DepartDUnePartie, j: Joueur, r: Hasard, t0: number, objectif: Objectif, allure: Allure | null): PartieJouee {
  const p = new Partie(d, j, r, t0 + SECONDES.annonce * 1000, objectif, allure)
  for (let m = 0 as Manche; m < MANCHES_PAR_PARTIE; m = (m + 1) as Manche) {
    const miser = p.miserIci(m)
    p.geste({ quoi: 'ouvrir', manche: m, ...(miser && { miser: true as const }) }, 0)
    MANCHES[d.jeu].jouer(p, m)
    if (!P.mancheEnCours(p.e)?.verdict) throw new Error(`${d.jeu} : la manche ${m} ne s'est pas tranchée`)
    p.t += SECONDES.revelation * 1000
  }
  if (!p.e.fin) throw new Error(`${d.jeu} : la partie ne s'est pas finie`)
  return { depart: d, etat: p.e, secondes: (p.t - t0) / 1000 + SECONDES.bilan, justes: p.e.pieces.filter(x => x.juste).length, enRetard: p.enRetard }
}

// ── Ce que vaut un jeu, et chaque carte-bonus à ce jeu ────────────────────

/** Ce que des parties d'un jeu ont donné : les totaux, les cadres dorés, les justes, le temps, et chaque manche par ses étoiles naturelles. */
interface Mesure {
  parties: number
  totaux: number[]
  dorees: number
  justes: number
  secondes: number
  enRetard: number
  parManche: number[][]
}

const MESURES_FAITES = new Map<string, Mesure>()
const T_MESURE = Date.UTC(2027, 1, 1, 18)
const JOUR_MESURE = jourDe(T_MESURE)
type CarteMesuree = { pouvoir: CleDePouvoir; force: Force } | null

/** La carte-bonus d'une mesure : une œuvre, ou un gardien, qui a ce pouvoir à cette force — le pli ne lit que les deux. */
function carteDe(c: CarteMesuree): CarteDuDepart | null {
  if (!c) return null
  const cle = [...OEUVRES.map(o => o.cle as string), ...GARDIENS].find(k => pouvoirDe(k) === c.pouvoir && forceDe(k) === c.force)
  if (!cle) throw new Error(`aucune carte-bonus ne ${c.pouvoir} à la force ${c.force}`)
  return { cle, pouvoir: c.pouvoir, force: c.force }
}

/** Les trois objectifs d'une partie qu'on mesure : un seuil, dorer, ou les étoiles (`LIBRE`). */
const LIBRE: Objectif = { seuil: null, dorer: false }
const DORER: Objectif = { seuil: null, dorer: true }
const CONFETTIS: Objectif = { seuil: null, dorer: false, confettis: true }
const versLeSeuil = (seuil: number): Objectif => ({ seuil, dorer: false })
/** Une épique, pour lui demander son enjeu : la règle le lit de la rareté de l'œuvre visée (`enjeuDuTirage`). */
const UNE_EPIQUE = OEUVRES.find(o => o.rarete === 'epique')!.cle
/**
 * L'enjeu d'une mesure, de ce qu'elle vise : jouée en partie libre, elle n'a pas d'œuvre — le seuil d'une épique, ou
 * dorer, la dit. Les autres seuils tirent comme une partie libre.
 */
const enjeuDuBut = (o: Objectif): EnjeuDuTirage =>
  o.dorer ? P.enjeuDuTirage({ cible: null, but: 'dorer' }) : o.seuil !== null && o.seuil === SEUILS_DES_RARETES.epique ? P.enjeuDuTirage({ cible: UNE_EPIQUE, but: 'gagner' }) : P.ENJEU_ORDINAIRE

/**
 * Ce que vaut un jeu pour ce joueur, avec cette carte, vers cet objectif : des
 * parties libres, jouées comme il les jouerait — le Pari ne se joue pas pareil
 * vers cinq étoiles ou vers sept, le Détail pas pareil pour dorer. Gardée : un
 * joueur qui choisit sa carte-bonus relit ce qu'il a déjà mesuré. La partie de
 * rang i tire son départ et son hasard du seul joueur, du jeu et de i : sans
 * carte et avec chaque carte, vers chaque but, le jeu se mesure sur les mêmes
 * parties — tirées d'une graine par mesure, une carte se comparait à « sans
 * carte » sur d'autres parties, et le bruit des deux passait pour son effet
 * (sept points d'écart type à cent parties, pour une part de moitié).
 */
function mesurer(j: Joueur, jeu: CleDeJeu, c: CarteMesuree, vise: Objectif, n = MESURES, enjeu = enjeuDuBut(vise)): Mesure {
  // L'enjeu de ce qu'il vise, avant tout (`enjeuDuBut`) : une épique et une dorure tirent plus haut, que le jeu lise le
  // seuil ou non ; la loi des manches que Miser lit (`allureDe`) se mesure au même enjeu, en partie libre.
  // Un jeu qui ne lit pas le seuil se joue vers lui comme en partie libre : les mêmes parties pour tous les seuils —
  // sauf sous Miser, qui se décide vers le seuil (`Partie.miserIci`).
  const objectif = vise.seuil !== null && !MANCHES[jeu].viseLeSeuil && c?.pouvoir !== 'miser' ? LIBRE : vise
  const sonEnjeu = `${enjeu.marchesEnPlus.join('+') || '-'}${enjeu.friseSerree ? ':serree' : ''}`
  const cle = `${cleDuSavoir(j)}|${jeu}|${c ? `${c.pouvoir}${c.force}` : '-'}|${objectif.dorer ? 'dorer' : objectif.confettis ? 'confettis' : (objectif.seuil ?? 'libre')}|${sonEnjeu}|${n}`
  const deja = MESURES_FAITES.get(cle)
  if (deja) return deja
  const racine = `${GRAINE}:mesure:${cleDuSavoir(j)}|${jeu}`
  const carte = carteDe(c)
  const allure = carte?.pouvoir === 'miser' && !objectif.dorer && !objectif.confettis && !MODELES[jeu] ? allureDe(j, jeu, enjeu) : null
  const x: Mesure = { parties: 0, totaux: Array(ETOILES_D_UNE_PARTIE + 1).fill(0), dorees: 0, justes: 0, secondes: 0, enRetard: 0, parManche: Array.from({ length: MANCHES_PAR_PARTIE }, () => Array(ETOILES_PAR_MANCHE + 1).fill(0)) }
  for (let i = 0; i < n; i++) {
    const d = departDu({ jeu, origine: 'libre', cible: null, but: null, seuil: null, payee: false, carte }, JOUR_MESURE, hasardDe(`${racine}:depart:${i}`), `${racine}:${i}`, enjeu)
    const jouee = jouerLaPartie(d, j, hasardDe(`${racine}:jeu:${i}`), T_MESURE, objectif, allure)
    const res = P.resultatDe(d, jouee.etat)
    x.parties++
    x.totaux[res.total]++
    if (res.cadreDore) x.dorees++
    x.justes += jouee.justes
    x.secondes += jouee.secondes
    res.naturel.forEach((k, m) => x.parManche[m][k]++)
    x.enRetard += jouee.enRetard
  }
  MESURES_FAITES.set(cle, x)
  return x
}
/**
 * Ce que la mise lit d'un jeu où rien ne se choisit : la loi des étoiles
 * naturelles de chaque manche, sans carte, en partie libre — mille parties, de
 * quoi la lire manche par manche. Misée, une telle manche se joue pareil. À
 * l'enjeu de la partie : une épique tire plus haut.
 */
const allureDe = (j: Joueur, jeu: CleDeJeu, enjeu: EnjeuDuTirage = P.ENJEU_ORDINAIRE): Allure => {
  const x = mesurer(j, jeu, null, LIBRE, PARTIES, enjeu)
  return { parManche: x.parManche.map(compte => compte.map((k, etoiles): readonly [number, number] => [etoiles, k / x.parties])) }
}
const auMoins = (x: Mesure, seuil: number) => x.totaux.slice(seuil).reduce((a, b) => a + b, 0) / x.parties
const moyenneDe = (x: Mesure) => x.totaux.reduce((n, k, total) => n + k * total, 0) / x.parties

// ── Le musée d'un joueur, jour après jour ─────────────────────────────────

/**
 * Chaque joueur arrive neuf : les quatre œuvres de départ, rien d'autre. Le
 * calibrage du 25 octobre 2026 mesurait aussi un explorateur qui rapportait les
 * trente ou soixante œuvres de son codex : la migration s'est abandonnée le
 * même jour (la décision du propriétaire, chacun commence à zéro), et ces
 * arrivées avec elle. Le nom de l'arrivée reste dans la graine de chaque
 * parcours : ils se rejouent tels qu'ils ont été mesurés.
 */
const ARRIVEE = 'neuf'

interface Parcours {
  toutPossede: number | null
  toutDore: number | null
  /** Le jour où chaque gardien s'est réveillé — 0 : dès l'arrivée. */
  gardiens: number[]
  joursJoues: number
  poussiere: number
  /** Les parties, leurs justes et leurs minutes, par origine. */
  parOrigine: Record<OrigineDUnePartie, { parties: number; justes: number; secondes: number }>
  xp: number
  gagnees: number
  achetees: number
  doreesEnJouant: number
  doreesALaPoussiere: number
  /** Jusqu'à tout posséder : la poussière et les jours joués, ce que la page promet d'abord. */
  poussiereAvant: number
  joursAvant: number
}

const JOUR_MS = 24 * 3_600_000
/** Le premier soir de chaque parcours : un lundi de février, loin des fêtes — le calendrier des saisons n'y joue pas. */
const T0 = Date.UTC(2027, 1, 1, 18)

function parcourir(j: Joueur, k: number): Parcours {
  // Une variante joue les jours, les visites et le hasard de son modèle : la seule différence est ce qu'elle choisit.
  const qui = j.comme ?? j.nom
  const r = hasardDe(`${GRAINE}:parcours:${qui}:${ARRIVEE}:${k}`)
  const graineDeLaVisite = `${GRAINE}:visite:${qui}:${ARRIVEE}:${k}`
  const lignes = new Map<string, LigneDOeuvre>()
  const ligne = (cle: string, o: Partial<LigneDOeuvre> & Pick<LigneDOeuvre, 'origine' | 'gagneeLe'>): LigneDOeuvre => ({
    oeuvre: cle,
    saison: null,
    serieId: null,
    prix: null,
    doreeLe: null,
    dorure: null,
    prixDorure: null,
    serieDoree: null,
    ...o,
  })
  let profil: LigneDuProfil | null = null
  const legendaires = new Set<string>()
  let parties: PartieDuJour[] = []
  let jour = jourDe(T0)
  const musee = (): Musee => M.museeDe({ jour, profil, oeuvres: [...lignes.values()], parties, legendaires, enCours: null })
  const x: Parcours = {
    toutPossede: null,
    toutDore: null,
    gardiens: [],
    joursJoues: 0,
    poussiere: 0,
    parOrigine: {
      visite: { parties: 0, justes: 0, secondes: 0 },
      chasse: { parties: 0, justes: 0, secondes: 0 },
      libre: { parties: 0, justes: 0, secondes: 0 },
      montee: { parties: 0, justes: 0, secondes: 0 },
      traversee: { parties: 0, justes: 0, secondes: 0 },
    },
    xp: 0,
    gagnees: 0,
    achetees: 0,
    doreesEnJouant: 0,
    doreesALaPoussiere: 0,
    poussiereAvant: 0,
    joursAvant: 0,
  }
  let jourDuParcours = 0
  /** La réconciliation : chaque gardien dû et pas encore réveillé se réveille — rien ne se reprend. */
  const reconcilier = () => {
    for (const g of M.gardiensDus(musee())) {
      if (legendaires.has(g.legendaire)) continue
      legendaires.add(g.legendaire)
      x.gardiens.push(jourDuParcours)
    }
  }
  reconcilier()

  // Ce qu'il sait de ses chances, d'une carte-bonus à l'autre : la mesure, gardée.
  const cartesDe = (m: Musee): CarteMesuree[] => {
    const vues = new Map<string, CarteMesuree>([['-', null]])
    for (const cle of [...M.possedees(m), ...[...legendaires].filter(l => pouvoirDuGardien(l))]) {
      const pouvoir = pouvoirDe(cle)
      const force = forceDe(cle)
      if (pouvoir && force) vues.set(`${pouvoir}${force}`, { pouvoir, force })
    }
    return [...vues.values()]
  }
  const meilleure = (m: Musee, jeu: CleDeJeu, but: 'gagner' | 'dorer' | 'libre', seuil: number | null): { carte: CarteMesuree; vaut: number } => {
    let mieux: { carte: CarteMesuree; vaut: number } = { carte: null, vaut: -1 }
    for (const c of cartesDe(m)) {
      // Pour dorer, seul ce qui n'ôte pas le cadre doré : Protéger et le temps en plus n'agissent qu'à une manche imparfaite, ou au-delà du temps normal.
      if (but === 'dorer' && c && c.pouvoir !== 'proteger' && c.pouvoir !== 'temps') continue
      const mesure = mesurer(j, jeu, c, but === 'dorer' ? DORER : but === 'libre' ? LIBRE : versLeSeuil(seuil!))
      const vaut = but === 'dorer' ? mesure.dorees / mesure.parties : but === 'libre' ? moyenneDe(mesure) : auMoins(mesure, seuil!)
      if (vaut > mieux.vaut + 1e-9) mieux = { carte: c, vaut }
    }
    return mieux
  }
  const cleDeLaCarte = (m: Musee, c: CarteMesuree): string | null => {
    if (!c) return null
    return [...M.possedees(m), ...legendaires].find(cle => pouvoirDe(cle) === c.pouvoir && forceDe(cle) === c.force) ?? null
  }

  /**
   * Le premier lot du jour qui écrit, comme celui du départ : la ligne du profil, la visite figée. La série attend la
   * première manche répondue de la partie (`serieApresUnJour`, après `jouerLaPartie`), comme au serveur.
   */
  const premierLotDuJour = (v: VisiteDuJour) => {
    const gelees = M.visitesAGarder(v, profil?.visites ?? [])
    if (!profil) {
      profil = { poussiere: 0, serie: 0, serieJour: null, serieRecord: 0, visites: gelees, partie: null }
      return
    }
    profil = { ...profil, visites: profil.visites[0]?.jour === jour ? profil.visites : gelees }
  }

  /** Une partie, de la demande à son bilan : le cadre que le musée accepte, le plan, le jeu, puis ce que le lot de fin écrit. */
  const jouer = (demande: Parameters<typeof M.cadreDuDepart>[1], v: VisiteDuJour, t: number, objectif: Objectif): number => {
    const m = musee()
    const cadre = M.cadreDuDepart(m, demande, v, CLES_DES_JEUX)
    if (typeof cadre === 'string') throw new Error(`${j.nom} : départ refusé (${JSON.stringify(demande)}) — ${cadre}`)
    premierLotDuJour(v)
    const d = departDu(cadre, jour, r, `${GRAINE}:parcours:${qui}:${ARRIVEE}:${k}:${jourDuParcours}:${parties.length}`)
    const allure = d.carte?.pouvoir === 'miser' && !objectif.dorer && !MODELES[d.jeu] ? allureDe(j, d.jeu, enjeuDuDepart(d)) : null
    const jouee = jouerLaPartie(d, j, r, t, objectif, allure)
    // La série compte le jour d'une visite ou d'une chasse où il a répondu à une manche — ici, toujours : il ne quitte pas.
    if (cadre.origine !== 'libre' && P.laPartieARepondu(jouee.etat)) profil = { ...profil!, ...M.serieApresUnJour(profil!, d.jour) }
    const apres = musee()
    const cible = d.cible as CleDOeuvre | null
    const aLui = cible ? { possedee: M.possedees(apres).has(cible), doree: M.dorees(apres).has(cible) } : null
    const bilan = P.bilanDe(d, jouee.etat, aLui)
    const fin = t + jouee.secondes * 1000
    const id = `${GRAINE}:${numero++}`
    const ecrire = (issue: IssueDUnePartie) => {
      if (!cible) return
      const avant = lignes.get(cible)
      if (issue === 'gagnee' || issue === 'gagnee-doree') {
        const doree = issue === 'gagnee-doree'
        lignes.set(cible, ligne(cible, { origine: 'partie', gagneeLe: fin, serieId: id, ...(doree && { doreeLe: fin, dorure: 'partie' as const, serieDoree: id }) }))
        x.gagnees++
        if (doree) x.doreesEnJouant++
      } else if (issue === 'doree') {
        lignes.set(cible, { ...(avant ?? ligne(cible, { origine: 'depart', gagneeLe: fin })), doreeLe: fin, dorure: 'partie', serieDoree: id })
        x.doreesEnJouant++
      }
    }
    ecrire(bilan.issue)
    profil = { ...profil!, poussiere: profil!.poussiere + bilan.poussiere }
    parties = [...parties, { id, commenceeLe: t, finieLe: fin, issue: bilan.issue, origine: d.origine, visite: d.visite ?? null, jeu: d.jeu, cible: d.cible, payee: d.payee, total: bilan.total }]
    x.poussiere += bilan.poussiere
    if (x.toutPossede === null) x.poussiereAvant += bilan.poussiere
    const o = x.parOrigine[d.origine]
    o.parties++
    o.justes += jouee.justes
    o.secondes += jouee.secondes
    reconcilier()
    return fin + 20_000
  }

  const seuilDe = (cle: CleDOeuvre) => SEUILS_DES_RARETES[oeuvre(cle)!.rarete]
  for (jourDuParcours = 1; jourDuParcours <= JOURS; jourDuParcours++) {
    let t = T0 + (jourDuParcours - 1) * JOUR_MS
    if (r() > j.assiduite) continue
    jour = jourDe(t)
    parties = []
    x.joursJoues++
    if (x.toutPossede === null) x.joursAvant++
    const minuit = minuitDe(t)
    const graine = { graine: graineDeLaVisite, jour, minuit, jeux: CLES_DES_JEUX }
    let v = M.visiteDuJour(musee(), graine)
    const avantLaJournee = x.parOrigine.visite.justes + x.parOrigine.chasse.justes + x.parOrigine.libre.justes

    // L'échange : la case dont le jeu lui va le plus mal, si le jeu que « Changer » nomme lui va mieux — lus sur la visite que la
    // page reçoit : son seuil (pour dorer, celui du double ; pour la poussière, aucun), le jeu proposé, et si l'échange se peut.
    if (j.echange) {
      const m = musee()
      const page = visiteVue(lectureDeLaVisite(m, v, graineDeLaVisite, CLES_DES_JEUX))
      const vaut = (jeu: CleDeJeu, seuil: number | undefined) => (seuil === undefined ? 1 : meilleure(m, jeu, 'gagner', seuil).vaut)
      const seuilMontre = (i: number) => page.cases[i].seuil ?? page.cases[i].seuilDuDouble
      const pire = page.cases
        .map((c, i) => ({ i, faite: c.faite, vaut: vaut(c.jeu, seuilMontre(i)) }))
        .filter(c => !c.faite)
        .sort((a, b) => a.vaut - b.vaut)[0]
      if (page.echange.possible && pire && vaut(page.echange.jeu, seuilMontre(pire.i)) > pire.vaut + 0.05) {
        v = M.visiteEchangee(v, pire.i as Manche, page.echange.jeu)
        premierLotDuJour(v)
      }
    }

    // La visite : ses trois cases, chacune vers son seuil — ou pour dorer, la poussière d'un double sinon.
    for (let c = 0; c < v.cases.length; c++) {
      const m = musee()
      const kase = v.cases[c]
      const seuil = kase.cible ? seuilDe(kase.cible) : null
      const but = kase.cible === null ? 'libre' : 'gagner'
      const { carte } = meilleure(m, kase.jeu, but, seuil)
      t = jouer({ origine: 'visite', case: c, carte: cleDeLaCarte(m, carte) }, v, t, { seuil, dorer: false })
    }

    // Les chasses : ce qui lui rapporte le plus en moyenne — une œuvre qui lui manque, « Retenter » une visite manquée, ou une dorure.
    // Le chasseur va d'abord à la salle du prochain gardien, que la page lui montre : une œuvre qui y manque, la meilleure à gagner.
    for (let c = 0; c < j.chasses; c++) {
      const m = musee()
      if (M.chassesRestantes(m) === 0) break
      const a = M.possedees(m)
      const dor = M.dorees(m)
      const salleDuGardien = j.versLeGardien ? (M.prochainGardien(m)?.salle ?? null) : null
      type Proposee = { vaut: number; demande: Parameters<typeof M.cadreDuDepart>[1]; objectif: Objectif }
      let mieux: Proposee | null = null
      let versLui: Proposee | null = null
      const proposer = (vaut: number, demande: Parameters<typeof M.cadreDuDepart>[1], objectif: Objectif) => {
        if (!mieux || vaut > mieux.vaut) mieux = { vaut, demande, objectif }
        // Une retente vise sa case, pas une œuvre nommée (`DemandeDeRetente`) : seule une chasse à une œuvre se range vers le gardien.
        const dansSaSalle = demande.origine === 'chasse' && 'oeuvre' in demande && objectif.seuil !== null && salleDuGardien !== null && oeuvre(demande.oeuvre)?.salle === salleDuGardien
        if (dansSaSalle && (!versLui || vaut > versLui.vaut)) versLui = { vaut, demande, objectif }
      }
      for (const o of OEUVRES) {
        if (!a.has(o.cle)) {
          const b = meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'gagner', seuilDe(o.cle))
          proposer(b.vaut * PRIX_D_UNE_OEUVRE[o.rarete], { origine: 'chasse', oeuvre: o.cle, carte: cleDeLaCarte(m, b.carte) }, { seuil: seuilDe(o.cle), dorer: false })
        } else if (!dor.has(o.cle)) {
          const b = meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'dorer', null)
          proposer(b.vaut * PRIX_D_UNE_DORURE[o.rarete], { origine: 'chasse', oeuvre: o.cle, carte: cleDeLaCarte(m, b.carte) }, { seuil: null, dorer: true })
        }
      }
      for (const manquee of parties.filter(pp => pp.origine === 'visite' && pp.issue === 'manquee' && pp.cible && !a.has(pp.cible as CleDOeuvre))) {
        const cle = manquee.cible as CleDOeuvre
        const b = meilleure(m, manquee.jeu, 'gagner', seuilDe(cle))
        // « Retenter » par sa case, comme la page : il sait l'œuvre qu'elle visait pour en juger le prix, la demande ne la nomme pas.
        proposer(b.vaut * PRIX_D_UNE_OEUVRE[oeuvre(cle)!.rarete], { origine: 'chasse', case: manquee.visite!, retente: true, carte: cleDeLaCarte(m, b.carte) }, { seuil: seuilDe(cle), dorer: false })
      }
      const choisie = (versLui ?? mieux) as Proposee | null
      if (!choisie) break
      t = jouer(choisie.demande, v, t, choisie.objectif)
    }

    // Les parties libres : le jeu qui lui rapporte le plus d'étoiles, donc de poussière.
    for (let l = 0; l < j.libres; l++) {
      const m = musee()
      const choix = CLES_DES_JEUX.map(jeu => ({ jeu, ...meilleure(m, jeu, 'libre', null) })).sort((a, b) => b.vaut - a.vaut)[0]
      t = jouer({ origine: 'libre', jeu: choix.jeu, carte: cleDeLaCarte(m, choix.carte) }, v, t, { seuil: null, dorer: false })
    }

    // Les achats : ce qu'il a le moins de chances de gagner en jouant, tant que sa poussière le paie ; puis les dorures.
    for (;;) {
      const m = musee()
      const solde = M.soldeDe(m)
      const a = M.possedees(m)
      const manquantes = OEUVRES.filter(o => !a.has(o.cle))
      const sorte = manquantes.length > 0 ? 'achat' : 'dorure'
      const candidates = (sorte === 'achat' ? manquantes : OEUVRES.filter(o => !M.dorees(m).has(o.cle))).filter(o => M.prixDe(o.cle, sorte)! <= solde)
      if (candidates.length === 0) break
      const chanceDe = (o: (typeof OEUVRES)[number]) =>
        sorte === 'achat' ? meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'gagner', seuilDe(o.cle)).vaut : meilleure(m, JEU_DE_L_OEUVRE[o.cle], 'dorer', null).vaut
      const o = candidates.map(c => ({ c, p: chanceDe(c) })).sort((a1, b1) => a1.p - b1.p || M.prixDe(b1.c.cle, sorte)! - M.prixDe(a1.c.cle, sorte)!)[0].c
      const prix = M.prixDe(o.cle, sorte)!
      const refus = M.refusDeLAchat(m, o.cle, prix, sorte)
      if (refus) throw new Error(`${j.nom} : ${sorte} de ${o.cle} refusé — ${refus}`)
      if (sorte === 'achat') {
        lignes.set(o.cle, ligne(o.cle, { origine: 'achat', gagneeLe: t, prix }))
        x.achetees++
      } else {
        lignes.set(o.cle, { ...(lignes.get(o.cle) ?? ligne(o.cle, { origine: 'depart', gagneeLe: t })), doreeLe: t, dorure: 'poussiere', prixDorure: prix })
        x.doreesALaPoussiere++
      }
      reconcilier()
    }

    const justes = x.parOrigine.visite.justes + x.parOrigine.chasse.justes + x.parOrigine.libre.justes - avantLaJournee
    x.xp += xpDuJourDeCampagne(justes)
    const m = musee()
    if (x.toutPossede === null && M.possedees(m).size === OEUVRES.length) x.toutPossede = jourDuParcours
    if (x.toutDore === null && M.dorees(m).size === OEUVRES.length) x.toutDore = jourDuParcours
    // Tout doré, il ne reste que le Scarabée : qui vient chaque jour l'attend encore, l'occasionnel jamais.
    if (x.toutDore !== null && (legendaires.has(SCARABEE) || j.assiduite < 1)) break
  }
  return x
}

// ── La série de la campagne, pour comparer ────────────────────────────────

/** Une série jouée par ce joueur : les marches dans l'ordre d'une vraie série, jusqu'à la troisième erreur. */
function serieDe(j: Joueur, r: Hasard): { justes: number; questions: number } {
  const parNiveau = Object.fromEntries(NIVEAUX.map(n => [n, Array<Niveau>(QUESTIONS_PAR_SERIE).fill(n)])) as Record<Niveau, Niveau[]>
  let vies = VIES
  let justes = 0
  let questions = 0
  for (const { niveau } of ordreDeSerie(parNiveau)) {
    questions++
    if (r() < trouve(j, niveau)) justes++
    else if (--vies === 0) break
  }
  return { justes, questions }
}

/** Ce qu'une partie du Cabinet dure et rapporte, en moyenne : ses minutes, ses pièces justes, et les deux à la minute. */
interface Debit {
  minutes: number
  justes: number
  parMinute: number
}

/**
 * Le plafond des départs, au seau que le serveur tient en mémoire (`Budget`) :
 * trente d'un coup, puis un toutes les deux minutes, comme `bareme.ts` le dit
 * de `DEPARTS_PAR_HEURE` — la recharge est celle de `Budget`, pas une recopie.
 * Il lit l'horloge de la machine : la séance lui tend la sienne, le temps
 * d'un départ.
 */
function departPermis(seau: InstanceType<typeof Budget>, t: number): boolean {
  const machine = Date.now
  Date.now = () => t
  try {
    return seau.take('profil')
  } finally {
    Date.now = machine
  }
}
/**
 * Une séance de tant de minutes, le seau plein au début : une partie dès qu'un
 * départ part, une série en attendant le suivant — par pas de six secondes —,
 * et la série jusqu'au bout quand une partie n'y tient plus. Ses confettis.
 */
function seance(minutes: number, partie: Debit, serieParMinute: number): number {
  const seau = new Budget(DEPARTS_PAR_HEURE, DEPARTS_PAR_HEURE / 60)
  const PAS = 0.1
  let t = 0
  let confettis = 0
  while (t < minutes - 1e-9) {
    if (t + partie.minutes <= minutes && departPermis(seau, T_MESURE + t * 60_000)) {
      confettis += partie.justes
      t += partie.minutes
    } else {
      const attente = Math.min(PAS, minutes - t)
      confettis += serieParMinute * attente
      t += attente
    }
  }
  return confettis
}

// ── L'affichage ───────────────────────────────────────────────────────────

const enPourcent = (x: number) => `${formatNumber(Math.round(x * 1000) / 10)} %`
const arrondi = (x: number, n = 1) => formatNumber(Math.round(x * 10 ** n) / 10 ** n)
const colonnes = (cases: readonly string[], largeurs: readonly number[]) => cases.map((c, i) => (i === 0 ? c.padEnd(largeurs[i]) : c.padStart(largeurs[i]))).join('  ')
function mediane(xs: readonly number[]): number {
  const t = [...xs].sort((a, b) => a - b)
  return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2
}
const jours = (xs: readonly (number | null)[]) => {
  const atteints = xs.filter((x): x is number => x !== null)
  if (atteints.length === 0) return `plus de ${JOURS} j`
  const tous = atteints.length === xs.length
  return `${formatNumber(mediane(atteints))} j (${formatNumber(Math.min(...atteints))}–${formatNumber(Math.max(...atteints))})${tous ? '' : `, ${xs.length - atteints.length} sur ${xs.length} au-delà de ${JOURS} j`}`
}

const debut = performance.now()
console.log(`Le calibrage du Cabinet de curiosités — graine « ${GRAINE} », ${PARTIES} parties par jeu et par joueur, ${PARCOURS} parcours de ${JOURS} jours au plus`)
for (const e of ESSAIS) console.log(`Essai : ${e}`)
// Le rayon est un nombre, qui ne s'essaie pas en mémoire ; il ne joue pas au modèle — qui a vu quelques zones lit où le
// lieu peut être au seul décalage —, mais le code le veut au-dessus du décalage (`cabinet-catalogue.test.ts`).
if (DECALAGE_DE_LA_ZONE_KM[1] >= RAYON_D_ECLAIRER_KM) {
  console.log(
    `  Le décalage essayé passe le rayon du code (${formatNumber(RAYON_D_ECLAIRER_KM)} km) : le modèle ne lit que le décalage ; la règle posée demanderait un rayon de plus de ${formatNumber(DECALAGE_DE_LA_ZONE_KM[1])} km (RAYON_D_ECLAIRER_KM), que la page dessine.`,
  )
}
console.log('')

/**
 * Ceux dont on mesure les jeux : un par savoir — le dernier nommé, comme le
 * complétionniste pour le bon. Une variante (`comme`) joue les jeux de son
 * modèle : elle ne se mesure pas deux fois, sauf seule.
 */
const SAVOIRS = [...new Map(JOUEURS.filter(j => !j.comme || !JOUEURS.some(k => k.nom === j.comme)).map(j => [cleDuSavoir(j), j])).values()]
const SEUILS_MONTRES = [...new Set(Object.values(SEUILS_DES_RARETES))].sort((a, b) => a - b)
/** Ce qu'un seuil fait gagner, en mots : « une rare ou une maudite ». */
const UNE: Readonly<Record<keyof typeof SEUILS_DES_RARETES, string>> = { commun: 'une commune', rare: 'une rare', maudit: 'une maudite', epique: 'une épique' }
const cequIlGagne = (seuil: number) =>
  (Object.keys(SEUILS_DES_RARETES) as (keyof typeof SEUILS_DES_RARETES)[])
    .filter(k => SEUILS_DES_RARETES[k] === seuil)
    .map(k => UNE[k])
    .join(' ou ')
const LARGEURS = [14, 16, 34, 6, 7, 8, 7]

/** « A, B et C ». */
const enMots = (xs: readonly string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} et ${xs.at(-1)}`)

// 1. Chaque jeu, sans carte-bonus : ce qu'il donne à chaque joueur, et au hasard.
if (enSection('jeux')) {
  console.log('Les jeux, un à un — sans carte-bonus')
  console.log(
    `  la part des parties à ${SEUILS_MONTRES.join(', ')} étoiles ou plus (les seuils des raretés), chacune jouée vers ce seuil — ${enMots(
      CLES_DES_JEUX.filter(jeu => MANCHES[jeu].viseLeSeuil).map(jeu => JEUX[jeu].nom),
    )} s'y jouent autrement, les autres pareil, sur les mêmes parties —, et à ${ETOILES_D_UNE_PARTIE}, la partie parfaite, jouée pour dorer ; puis, en partie libre, les étoiles en moyenne, les pièces justes, les minutes d'une partie, et les manches où l'échéance l'a pris de court`,
  )
  console.log('  ' + colonnes(['jeu', 'joueur', [...SEUILS_MONTRES.map(s => `≥ ${s}`), `= ${ETOILES_D_UNE_PARTIE}`].join(' · '), '★/9', 'justes', 'minutes', 'retard'], LARGEURS))
  const auHasard: { jeu: CleDeJeu; part: number }[] = []
  for (const jeu of JEUX_MESURES) {
    for (const j of SAVOIRS) {
      const x = mesurer(j, jeu, null, LIBRE, PARTIES)
      const parts = SEUILS_MONTRES.map(s => auMoins(mesurer(j, jeu, null, versLeSeuil(s), PARTIES), s))
      const parfaites = mesurer(j, jeu, null, DORER, PARTIES)
      if (j.theta === null) auHasard.push({ jeu, part: parts[0] })
      console.log(
        '  ' +
          colonnes(
            [
              JEUX[jeu].nom,
              j.nom,
              [...parts, parfaites.dorees / parfaites.parties].map(enPourcent).join(' · '),
              arrondi(moyenneDe(x)),
              arrondi(x.justes / x.parties, 2),
              arrondi(x.secondes / x.parties / 60, 2),
              enPourcent(x.enRetard / (MANCHES_PAR_PARTIE * x.parties)),
            ],
            LARGEURS,
          ),
      )
    }
  }
  if (auHasard.length > 0) console.log(`  Au hasard, une commune (${SEUILS_MONTRES[0]} étoiles) : ${auHasard.sort((a, b) => b.part - a.part).map(x => `${JEUX[x.jeu].nom} ${enPourcent(x.part)}`).join(' · ')}`)
  console.log('')

  // 1 ter. La Frise serrée, celle d'une épique, contre toute frise : la frise serrée « ne se mesurait toujours pas » (la
  // tablée du 26 octobre 2026) — le tableau d'au-dessus la joue vers sept étoiles, et toute frise vers les autres seuils et
  // pour la partie parfaite. Chaque seuil, ici, sur l'une et l'autre : de quoi décider d'une frise serrée à tout enjeu.
  if (JEUX_MESURES.includes('frise')) {
    const serree = (e: EnjeuDuTirage): EnjeuDuTirage => ({ ...e, friseSerree: true })
    const toute = (e: EnjeuDuTirage): EnjeuDuTirage => ({ ...e, friseSerree: false })
    console.log(
      `La Frise serrée — celle d'une épique, la moitié de ses voisins à ${formatNumber(ECART_D_UNE_FRISE_EPIQUE)} ans au plus (ECART_D_UNE_FRISE_EPIQUE) — contre toute frise à thème, sur les mêmes rangs de parties : à chaque seuil, puis la partie parfaite, la serrée d'abord`,
    )
    const largeurs = [16, ...SEUILS_MONTRES.map(() => 17), 17]
    console.log('  ' + colonnes(['joueur', ...SEUILS_MONTRES.map(s => `≥ ${s}`), `= ${ETOILES_D_UNE_PARTIE}`], largeurs))
    for (const j of SAVOIRS) {
      // La frise du but, serrée ou non : le reste de son enjeu — la marche d'une épique ou d'une dorure — ne touche pas la Frise.
      const versLe = (seuil: number) => (frise: typeof serree) => auMoins(mesurer(j, 'frise', null, versLeSeuil(seuil), PARTIES, frise(enjeuDuBut(versLeSeuil(seuil)))), seuil)
      const parfaites = (frise: typeof serree) => {
        const x = mesurer(j, 'frise', null, DORER, PARTIES, frise(enjeuDuBut(DORER)))
        return x.dorees / x.parties
      }
      const deuxParts = (part: (frise: typeof serree) => number) => [serree, toute].map(frise => enPourcent(part(frise))).join(' · ')
      console.log('  ' + colonnes([j.nom, ...SEUILS_MONTRES.map(s => deuxParts(versLe(s))), deuxParts(parfaites)], largeurs))
    }
    console.log('')
  }
}

// 1 bis. Chaque jeu avec la meilleure des quatre œuvres de départ : tout profil les emporte, et les retouches du
// 25 octobre 2026 se sont décidées sans elles.
if (enSection('oeuvres')) {
  console.log('Les jeux, un à un — avec les quatre œuvres de départ')
  console.log(
    `  ${OFFERTES.map(o => `${o.nom} (${POUVOIRS[o.carte.pouvoir].nom} ${o.carte.force})`).join(', ')} : chaque joueur emporte vers chaque seuil celle qui l'y mène le plus souvent — ou aucune —, sur ${formatNumber(PARTIES)} parties, les mêmes pour chacune ; puis la carte-bonus emportée, seuil par seuil`,
  )
  console.log('  ' + colonnes(['jeu', 'joueur', SEUILS_MONTRES.map(s => `≥ ${s}`).join(' · '), 'la carte-bonus'], [14, 16, 26, 0]))
  const auHasardAvec: { jeu: CleDeJeu; part: number }[] = []
  for (const jeu of JEUX_MESURES) {
    for (const j of SAVOIRS) {
      // Choisie sur cent parties et mesurée sur mille autres, la carte gardée au bruit près disait « aucune » vers la
      // commune et « Prudence » vers la rare, avec plus de rares que de communes.
      const choix = SEUILS_MONTRES.map(s => {
        const vers = versLeSeuil(s)
        const cartes = [null, ...OFFERTES.filter(o => o.carte.pouvoir !== 'changer' || JEUX[jeu].changeable)]
        const part = (o: (typeof cartes)[number]) => auMoins(mesurer(j, jeu, o?.carte ?? null, vers, PARTIES), s)
        const choisie = meilleurDes(cartes, part)
        return { choisie, part: part(choisie) }
      })
      if (j.theta === null) auHasardAvec.push({ jeu, part: choix[0].part })
      console.log('  ' + colonnes([JEUX[jeu].nom, j.nom, choix.map(c => enPourcent(c.part)).join(' · '), choix.map(c => c.choisie?.nom ?? 'aucune').join(' · ')], [14, 16, 26, 0]))
    }
  }
  if (auHasardAvec.length > 0) console.log(`  Au hasard, avec elles, une commune : ${auHasardAvec.sort((a, b) => b.part - a.part).map(x => `${JEUX[x.jeu].nom} ${enPourcent(x.part)}`).join(' · ')}`)
  console.log('')
}

// 2. Chaque pouvoir, à chaque force, jeu par jeu : ce que la carte-bonus emportée fait à chacun.
if (enSection('cartes')) {
  const ordre = POUVOIRS_MESURES
  const FORCES: readonly Force[] = [1, 2, 3]
  const largeurs = [14, 16, 10, ...ordre.map(p => Math.max(12, POUVOIRS[p].nom.length))]
  console.log(
    `Les cartes-bonus, jeu par jeu — ${formatNumber(MESURES)} parties par mesure, les mêmes avec chaque carte et sans, à quelques points près ; la part des parties à chaque seuil, en pour cent, chaque pouvoir à la force ${FORCES.join(' · ')}`,
  )
  console.log("  chacune jouée comme il la jouerait vers ce seuil : Éclairer sur ce qu'il ne sait pas, la mise avant la manche où elle le mène le plus près, et jouée pour ses trois étoiles, Changer sur ce qu'il voit, la lecture payée")
  const pc = (x: number) => formatNumber(Math.round(x * 100))
  for (const seuil of SEUILS_MONTRES) {
    console.log(`  au moins ${seuil} étoiles sur ${ETOILES_D_UNE_PARTIE} — ${cequIlGagne(seuil)}`)
    console.log('  ' + colonnes(['jeu', 'joueur', 'sans carte', ...ordre.map(p => POUVOIRS[p].nom)], largeurs))
    for (const jeu of JEUX_MESURES) {
      for (const j of SAVOIRS) {
        const vers = versLeSeuil(seuil)
        const avec = ordre.map(pouvoir =>
          pouvoir === 'changer' && !JEUX[jeu].changeable ? '—' : FORCES.map(force => pc(auMoins(mesurer(j, jeu, { pouvoir, force }, vers), seuil))).join(' · '),
        )
        console.log('  ' + colonnes([JEUX[jeu].nom, j.nom, pc(auMoins(mesurer(j, jeu, null, vers), seuil)), ...avec], largeurs))
      }
    }
  }
  console.log('')
}

// 3. La zone d'Éclairer à l'Épingle, pour qui ne sait rien du lieu : la règle du code, et ses pistes.
if (enSection('epingle')) {
  const MANCHES_MESUREES = MANCHES_PAR_PARTIE * PARTIES
  const km = (n: number) => formatNumber(n)
  const dite = (loi: LoiDeLaZone) =>
    !loi.partout
      ? `de ${km(loi.de)} à ${km(loi.a)} km, rayon ${km(loi.rayonKm)} km`
      : loi.de === 0
        ? `partout dans le disque, rayon ${km(loi.rayonKm)} km`
        : `partout de ${km(loi.de)} à ${km(loi.a)} km, rayon ${km(loi.rayonKm)} km`
  const regles: { nom: string; loi: LoiDeLaZone; tirer: (lieu: Lieu, r: Hasard) => DecalageDeLaZone }[] = [
    { nom: `le code : ${dite(LOI_DU_CODE())}`, loi: LOI_DU_CODE(), tirer: (lieu, r) => epingleTiree(lieu, r).decalage },
    ...PISTES_DE_LA_ZONE.map(loi => ({ nom: dite(loi), loi, tirer: (_lieu: Lieu, r: Hasard) => decalageTire(loi, r) })),
  ]
  const [pres, loin] = MODELE.epingleRegionKm
  console.log(
    `Éclairer à l'Épingle, pour qui ne sait rien — ${formatNumber(MANCHES_MESUREES)} manches par règle, sur les ${formatNumber(LIEUX.length)} lieux livrés : le centre de la zone décalé du lieu, la zone de ce rayon ; une zone à chaque manche (Éclairer à la force ${FORCE_DES_TROIS_ZONES}), lue sur la terre que la carte dessine`,
  )
  console.log(
    `  une commune, en plantant au centre · au milieu de là où le lieu peut être · au point qui rapporte le plus ; les étoiles d'une manche, qui ne sait rien (n'importe où sans zone, puis au meilleur point) et qui sait la région (à ${formatNumber(pres)}–${formatNumber(loin)} km du lieu, puis au plus près d'elle dans la zone)`,
  )
  const largeurs = [44, 28, 14, 14]
  console.log('  ' + colonnes(['la zone', 'une commune avec trois zones', 'sans rien', 'avec la région'], largeurs))
  for (const regle of regles) {
    const r = hasardDe(`${GRAINE}:epingle:${regle.nom.replace(/^le code : /, '')}`)
    const etoiles = { centre: [] as number[], milieu: [] as number[], meilleur: [] as number[] }
    let sansZone = 0
    let regionSans = 0
    let regionAvec = 0
    const juger = (tiree: EpingleTiree, epingle: Point) => REGLE_DE_L_EPINGLE.juger(tiree, REGLE_DE_L_EPINGLE.ouvrir(tiree), { quoi: 'repondre', epingle }).naturel
    for (let i = 0; i < MANCHES_MESUREES; i++) {
      const lieu = auHasard(LIEUX, r)
      const tiree: EpingleTiree = { jeu: 'epingle', lieu, decalage: regle.tirer(lieu, r) }
      const centre = zoneDEclairer(lieu, tiree.decalage)
      const possibles = ouPeutEtreLeLieu(centre, regle.loi)
      etoiles.centre.push(juger(tiree, dansLeCadre(centre)))
      etoiles.milieu.push(juger(tiree, dansLeCadre(possibles.length > 0 ? auMilieu(possibles) : centre)))
      etoiles.meilleur.push(juger(tiree, ouPlanter(centre, regle.loi, null, possibles)))
      sansZone += juger(tiree, pointDeFrance(r))
      let region = pointADistance(lieu, pres + r() * (loin - pres), r() * 360)
      if (!dansLaFrance(region)) region = dansLeCadre(region)
      regionSans += juger(tiree, region)
      regionAvec += juger(tiree, ouPlanter(centre, regle.loi, region, possibles))
    }
    const commune = (xs: number[]) => {
      const parties = Array.from({ length: Math.floor(xs.length / MANCHES_PAR_PARTIE) }, (_, k) => xs.slice(k * MANCHES_PAR_PARTIE, (k + 1) * MANCHES_PAR_PARTIE).reduce((a, b) => a + b, 0))
      return parties.filter(t => t >= SEUILS_DES_RARETES.commun).length / parties.length
    }
    const parManche = (n: number) => arrondi(n / MANCHES_MESUREES, 2)
    console.log(
      '  ' +
        colonnes(
          [
            regle.nom,
            [etoiles.centre, etoiles.milieu, etoiles.meilleur].map(xs => enPourcent(commune(xs))).join(' · '),
            `${parManche(sansZone)} → ${parManche(etoiles.meilleur.reduce((a, b) => a + b, 0))}`,
            `${parManche(regionSans)} → ${parManche(regionAvec)}`,
          ],
          largeurs,
        ),
    )
  }
  console.log('')
}

// 4. Ce qu'une partie rapporte, à la minute, contre une série. La minute fait
// foi — « si leur débit dépasse celui d'une série », dit le troisième choix
// délégué : le plafond des départs arrête le Cabinet, pas la série, et le
// temps qu'il libère va à la série. Les séances le montrent : le Cabinet
// d'abord, tant que le seau du serveur laisse partir, la série le reste du
// temps. Borner l'heure à trente parties et compter le reste perdu faisait
// passer le Cabinet sous la série quand il la dépassait à la minute.
const DEBIT_DE_LA_SERIE = new Map<string, number>()
if (enSection('confettis')) {
  console.log("Les confettis et l'expérience, à la minute — une pièce juste est une bonne réponse de campagne")
  console.log(
    `  une partie libre jouée pour ses confettis (au-delà de la ${formatNumber(LIBRES_QUI_PAIENT)}ᵉ du jour, elle ne paie plus que ses pièces), sans carte-bonus, puis avec le meilleur gardien ; une série à ${formatNumber(SECONDES_PAR_QUESTION_DE_SERIE)} s la question au joueur moyen, dont ${formatNumber(SECONDES_D_UNE_REVELATION)} s d'anecdote ; une question du Pari à ${formatNumber(SECONDES.pariQuestion)} s, la même sans l'anecdote, que le Cabinet lit à la révélation ; la réponse à l'allure de chacun ; une séance d'une heure, de trois heures, le plafond des départs plein au début (${formatNumber(DEPARTS_PAR_HEURE)} d'un coup, puis un toutes les ${formatNumber(60 / DEPARTS_PAR_HEURE)} minutes) : le Cabinet d'abord, la série quand il ne laisse plus partir, contre la série seule`,
  )
  const SERIES = 4000
  const LARGEURS_2 = [16, 26, 11, 34, 16, 16]
  console.log('  ' + colonnes(['joueur', 'série : justes · questions', 'série /min', 'Cabinet /min, son meilleur jeu', 'une heure', 'trois heures'], LARGEURS_2))
  /** Les cinq pouvoirs à la force d'un gardien : ce qu'un joueur qui en a réveillé un emporte de mieux. */
  const LES_GARDIENS: CarteMesuree[] = (Object.keys(POUVOIRS) as CleDePouvoir[]).map(pouvoir => ({ pouvoir, force: FORCES_DES_RARETES.legendaire }))
  /** Les parties qui paient chaque jour sans partie libre de plus : la visite, les chasses, les libres qui paient leur poussière. */
  const PARTIES_QUI_PAIENT_PAR_JOUR = CASES_DE_LA_VISITE + CHASSES_PAR_JOUR + LIBRES_QUI_PAIENT
  for (const j of SAVOIRS) {
    const r = hasardDe(`${GRAINE}:serie:${j.nom}`)
    let justes = 0
    let questions = 0
    for (let i = 0; i < SERIES; i++) {
      const s = serieDe(j, r)
      justes += s.justes
      questions += s.questions
    }
    const parMinute = justes / ((questions * secondesDUneQuestion(j)) / 60)
    DEBIT_DE_LA_SERIE.set(cleDuSavoir(j), parMinute)
    const debit = (x: Mesure): Debit => {
      const minutes = x.secondes / x.parties / 60
      const justesParPartie = x.justes / x.parties
      return { minutes, justes: justesParPartie, parMinute: justesParPartie / minutes }
    }
    const parJeu = CLES_DES_JEUX.map(jeu => ({ jeu, ...debit(mesurer(j, jeu, null, CONFETTIS, PARTIES)) })).sort((a, b) => b.parMinute - a.parMinute)
    // Chaque gardien sur autant de parties que sans carte : garder le meilleur de quarante-cinq mesures de cent parties le tirait vers le haut.
    const avecUnGardien = CLES_DES_JEUX.flatMap(jeu =>
      LES_GARDIENS.filter(c => c!.pouvoir !== 'changer' || JEUX[jeu].changeable).map(c => ({ jeu, c, ...debit(mesurer(j, jeu, c, CONFETTIS, PARTIES)) })),
    ).sort((a, b) => b.parMinute - a.parMinute)
    const lignes = [
      { dit: 'sans carte', best: parJeu[0] },
      { dit: `${POUVOIRS[avecUnGardien[0].c!.pouvoir].nom} ${avecUnGardien[0].c!.force}`, best: avecUnGardien[0] },
    ]
    for (const { dit, best } of lignes) {
      const premiere = dit === 'sans carte'
      console.log(
        '  ' +
          colonnes(
            [
              premiere ? j.nom : '',
              premiere ? `${arrondi(justes / SERIES)} · ${arrondi(questions / SERIES)}` : '',
              premiere ? arrondi(parMinute, 2) : '',
              `${arrondi(best.parMinute, 2)} (${JEUX[best.jeu].nom}, ${dit})`,
              ...[60, 180].map(minutes => `${arrondi(seance(minutes, best, parMinute), 0)} contre ${arrondi(parMinute * minutes, 0)}`),
            ],
            LARGEURS_2,
          ),
      )
    }
    console.log('    sans carte : ' + parJeu.map(x => `${JEUX[x.jeu].nom} ${arrondi(x.parMinute, 2)}`).join(' · '))
    // Ce que la parade laisserait : la juste à zéro au-delà des libres qui paient, il ne reste chaque jour que les parties qui paient déjà.
    const mieux = lignes.reduce((a, b) => (b.best.parMinute > a.best.parMinute ? b : a)).best
    const enPlus = mieux.parMinute - parMinute
    console.log(
      enPlus > 0
        ? `    de plus qu'une série au même temps, au mieux : ${arrondi(enPlus, 2)} la minute, ${arrondi(enPlus * 60, 0)} à l'heure, autant d'heures qu'il en joue ; la juste à zéro au-delà de la ${formatNumber(LIBRES_QUI_PAIENT)}ᵉ libre du jour ne laisserait payer que ses ${formatNumber(PARTIES_QUI_PAIENT_PAR_JOUR)} parties du jour — au plus ${arrondi(PARTIES_QUI_PAIENT_PAR_JOUR * mieux.minutes * enPlus, 0)} de plus par jour`
        : `    moins qu'une série, à la minute comme à la séance : ${arrondi(-enPlus, 2)} de moins la minute, au mieux`,
    )
  }
  console.log(`  L'expérience suit les confettis : ${formatNumber(xpDuJourDeCampagne(1))} points pour chacune des ${formatNumber(JUSTES_DOUBLEES_PAR_JOUR)} premières bonnes réponses du jour, ${formatNumber(xpDuJourDeCampagne(JUSTES_DOUBLEES_PAR_JOUR + 1) - xpDuJourDeCampagne(JUSTES_DOUBLEES_PAR_JOUR))} ensuite — la série et le Cabinet les partagent.`)
  console.log('')
}

// 5. Le musée, jour après jour.
if (enSection('musee')) {
  console.log(`Le musée, jour après jour — ${PARCOURS} parcours par joueur ; la médiane, puis le plus court et le plus long`)
  console.log(`  chacun arrive neuf : les ${OEUVRES_DE_DEPART.length} œuvres de départ, rien de l'Expédition`)
  const SEMAINES = [1, 2, 4, 8, 13, 26, 52]
  for (const j of JOUEURS) {
    const parcours = Array.from({ length: PARCOURS }, (_, k) => parcourir(j, k))
    const parJour = (f: (x: Parcours) => number, sur: (x: Parcours) => number = x => x.joursJoues) => arrondi(mediane(parcours.map(x => f(x) / Math.max(1, sur(x)))), 0)
    const justes = (x: Parcours) => x.parOrigine.visite.justes + x.parOrigine.chasse.justes + x.parOrigine.libre.justes
    const minutes = (x: Parcours) => (x.parOrigine.visite.secondes + x.parOrigine.chasse.secondes + x.parOrigine.libre.secondes) / 60
    const nParties = (x: Parcours) => x.parOrigine.visite.parties + x.parOrigine.chasse.parties + x.parOrigine.libre.parties
    console.log(`  ${j.nom}`)
    console.log(`    tout posséder : ${jours(parcours.map(x => x.toutPossede))} · tout dorer : ${jours(parcours.map(x => x.toutDore))}`)
    const serie = DEBIT_DE_LA_SERIE.get(cleDuSavoir(j))
    const alaMinute = mediane(parcours.map(x => justes(x) / Math.max(1, minutes(x))))
    console.log(
      `    par jour joué : ${parJour(nParties)} parties, ${parJour(minutes)} min, ${parJour(x => x.poussiere)} poussières (${parJour(x => x.poussiereAvant, x => x.joursAvant)} avant de tout posséder), ${parJour(justes)} confettis — ${arrondi(alaMinute, 2)} la minute${serie ? `, ${arrondi(serie, 2)} en série` : ''} —, ${parJour(x => x.xp)} d'expérience`,
    )
    console.log(
      `    œuvres : ${arrondi(mediane(parcours.map(x => x.gagnees)), 0)} gagnées en jouant, ${arrondi(mediane(parcours.map(x => x.achetees)), 0)} achetées ; cadres dorés : ${arrondi(mediane(parcours.map(x => x.doreesEnJouant)), 0)} en jouant, ${arrondi(mediane(parcours.map(x => x.doreesALaPoussiere)), 0)} à la poussière`,
    )
    console.log(`    gardiens réveillés, semaine ${SEMAINES.join(', ')} : ${SEMAINES.map(s => arrondi(mediane(parcours.map(x => x.gardiens.filter(g => g <= s * 7).length)), 1)).join(' · ')} (sur ${GARDIENS.length - GARDIENS_DE_SAISON.length}, ceux de saison à part)`)
    console.log(`    le premier gardien réveillé en jouant : ${jours(parcours.map(x => x.gardiens.find(g => g > 0) ?? null))}`)
  }
  console.log(`  Les ${GARDIENS_DE_SAISON.length} gardiens de saison ne jouent pas : les parcours commencent en février, et leurs fêtes n'y comptent pas (${GARDIENS_DE_SAISON.map(conditionDuGardien).join(' ; ')}).`)
  console.log('')
}
console.log(`Fini en ${arrondi((performance.now() - debut) / 1000)} s.`)
