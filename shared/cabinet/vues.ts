// Ce que la page du Cabinet reçoit du serveur : la traversée, une partie, le
// bouton de l'accueil — et, du musée d'avant la traversée, que le serveur sert
// encore, sa page, le cartel d'une œuvre, les murs. Des types, que la page lit
// en `import type` — elle ne juge rien —, et deux fonctions pures : les vues
// dépliées (`vuesDuCabinet`), que le tirage du serveur lit ; des réveils fondus
// en un (`fondreLesReveils`), que le serveur et la page lisent tous deux.
//
// La vue du serveur (`core/cabinet/vue.ts`) choisit chaque champ un à un, et
// délègue le corps d'une manche à `montrer` du jeu, sa révélation à `reveler`
// (invariant 1) : un champ neuf du plan n'y part jamais de lui-même — le piège
// `montree` de l'Expédition. Ce qui ne part jamais avant le verdict de sa
// manche, et `cabinet-secret.test.ts` le cherche dans chaque vue : les
// coordonnées, la commune et le département d'un lieu ; l'ordre et l'année
// d'un nouveau venu de la frise, sauf celle qu'Éclairer dévoile ; le mot ; le
// tableau, son titre et l'index du bon ; la valeur du Filet ; la bonne réponse
// du Pari, et sa seconde question avant « Parier » ; le vrai ou faux d'une
// affirmation ; la réponse, les clés et les indices cachés d'une fiche ; le mot
// et « qui » d'une réplique, et si le mot choisi était bon. Jamais les
// rechanges de Changer, jamais la graine, jamais l'œuvre visée d'une case de
// la visite tant qu'elle n'est pas gagnée.
//
// Ces types naissent complets (lot B3) : la chaîne du serveur les remplit,
// celle de la page les lit, sans y toucher. Deux champs s'y sont ajoutés
// depuis, du côté du serveur : l'indice du tirage d'une manche
// (`VueDeLaPartie.tirage`, `RevelationVue.tirage`), sans lequel la page ne
// compose pas l'adresse d'une image du Détail (`adresseDUnCadrage`) ; et ce
// que la partie d'un cartel a fait à son œuvre (`Cartel.partie.issue`) : une
// œuvre achetée puis dorée en jouant ne l'a pas gagnée, et son cartel n'a pas
// à le dire. Et ce qu'un achat ou une dorure réveille (`PageDuCabinet.reveil`,
// lot C4) : la fin d'une partie le dit dans son bilan, une dépense n'avait que
// la page d'après. Et si la fin a fait de la partie le cartel de son œuvre
// (`BilanVu.devientSonCartel`, lot C7) : dorée ou doublée, une œuvre ne le
// prend que si elle n'en avait pas, et le bilan n'en disait rien — la page
// promettait « Son cartel » d'une manche que l'œuvre ne montrerait pas.
// Puis ce que la tablée du 25 octobre 2026 n'a pas su lire à l'écran, tous
// facultatifs — les vues écrites à la main des épreuves de la page s'en
// passent : le seuil d'une case (`CaseVue.seuil`, `seuilDuDouble`), que la
// page redérivait du barème ; « Retenter » une case manquée, par la case et
// sans l'œuvre (`CaseVue.retenter`, `BilanVu.retenter`) ; les libres qui
// paient encore (`BilanVu.libresQuiPaientEncore`) ; ce que vaudrait la partie
// quittée (`VueDeLaPartie.siTuQuittes`). Puis, de la tablée du 26 : le jeu que
// donnerait l'échange (`VisiteVue.echange.jeu`, requis quand il est possible),
// la mise d'une manche révélée (`RevelationVue.misee`) et le temps en plus de
// Prendre son temps (`VueDeLaPartie.chrono.enPlusMs`).

import type { CleDeCompagnon } from '../compagnons'
import { PREFIXE_DE_LA_FRISE } from '../frise'
import type { PalierTombe } from '../jour'
import type { CleDeSaison } from '../saisons'
import type { CleDOeuvre, Rarete } from './oeuvres'
import { deplier } from './pieces'
import type { CleDePouvoir, Force } from './pouvoirs'
import type { CleDeSalle } from './salles'
import type { EnjeuDUneCase, OrigineDUneOeuvre } from './musee'
import type { BilanDUnePartie, ButinDUnePorte, FinDUneManche, IssueDUnePartie, Manche, OrigineDUnePartie, PhaseDeLaPartie } from './partie'
import type { MancheMontree, RevelationDUneManche } from './jeux/index'
import type { CleDeJeu } from './jeux/regle'
import type { BilanDEpreuve, CleDeCarte, DepartDeLaTraversee, EpreuveEnCours, EtatDeLaTraversee, FinDeLaTraversee } from './traversee'
import type { DefisTenus } from './sceaux'

// ── La page du musée — `GET /api/cabinet` ─────────────────────────────────

/** Une œuvre, telle qu'une salle la montre : possédée, sa peinture ; un cadre vide, où la trouver et ce qu'il faut. */
export interface OeuvreVue {
  cle: CleDOeuvre
  nom: string
  rarete: Rarete
  possedee: boolean
  doree: boolean
  /** Comment elle est entrée : son cartel le dit (« Achetée avec ta poussière d'or ») ; `depart` pour les quatre offertes. */
  origine?: OrigineDUneOeuvre
  /** Le jeu où elle se trouve (« Elle se trouve au Filet »), et s'il est livré (« bientôt » sinon). */
  jeu: CleDeJeu
  bientot?: true
  /** Les étoiles qu'il faut sur neuf, à sa rareté. */
  seuil: number
  /** Ce que coûte de l'acheter, manquante, ou de la dorer, à lui et pas dorée. */
  prix?: number
}

/** Un gardien, réveillé ou non, et par quelle voie : par le Cabinet, ou déjà à lui d'ailleurs — « Le Phénix veillait déjà ». */
export interface GardienVu {
  legendaire: string
  reveille: boolean
  voie?: 'cabinet' | 'ailleurs'
  /**
   * « La salle du Rempart complète », « Tous les cadres du Devin dorés », « 30 jours d’affilée à répondre à une manche de visite
   * ou de chasse » (`conditionDuGardien`).
   */
  condition: string
  pouvoir: CleDePouvoir
}

export interface SalleVue {
  cle: CleDeSalle
  nom: string
  devise: string
  oeuvres: OeuvreVue[]
  complete: boolean
  doree: boolean
  /** Ses deux gardiens : le premier à la salle complète, le second à tous ses cadres dorés. */
  gardiens: [GardienVu, GardienVu]
  /** Une œuvre peinte arrivée dans une salle qu'il avait complète : « Une œuvre nouvelle est arrivée ». Son gardien reste réveillé. */
  nouvelle?: true
}

/** « Retenter », tel que la page le montre sous une case ou un bilan : il part, ou sa raison, dans les mots du serveur. */
export interface RetenteVue {
  possible: boolean
  refus?: string
}

/** Une case de la visite du jour : son jeu, son enjeu — jamais l'œuvre visée d'une case pas gagnée. */
export interface CaseVue {
  jeu: CleDeJeu
  enJeu: EnjeuDUneCase
  faite: boolean
  issue?: IssueDUnePartie
  /** Gagnée ou dorée : l'œuvre, maintenant qu'elle est à lui. */
  oeuvre?: CleDOeuvre
  bientot?: true
  /**
   * Les étoiles qu'il faut sur neuf pour gagner son œuvre, celles que son
   * départ figera (`seuilDeLaCase`) : la page les lit ici, elle ne relit pas le
   * barème. Une case pour dorer dit `seuilDuDouble` à la place ; une case pour
   * la poussière d'or, ni l'un ni l'autre. Toujours posé par le serveur ;
   * facultatif pour les vues écrites à la main des épreuves de la page.
   */
  seuil?: number
  /** Une case pour dorer : les étoiles qui, sans le cadre doré — toutes les manches parfaites —, font son double. */
  seuilDuDouble?: number
  /** Manquée aujourd'hui : « Retenter cette œuvre au même jeu, pour une chasse », possible ou sa raison (`retenteDeLaCase`). */
  retenter?: RetenteVue
}

export interface VisiteVue {
  jour: string
  cases: CaseVue[]
  /**
   * « Changer pour … », une fois par jour, une case pas encore jouée : la seule
   * règle des refus le dit. Possible, le jeu que la case prendra
   * (`jeuDeLEchange`), quelle qu'elle soit : le bouton partait à l'aveugle, et
   * Ophélie, devant un Détail qu'elle ne savait pas jouer, n'a pas osé (la
   * tablée du 26 octobre 2026). Ce n'est pas un secret : l'élément suivant de
   * l'ordre des jeux du jour, dont la page voit déjà les trois premiers, tiré
   * d'un autre fil que les œuvres visées (`:visite:` contre `:cibles:`).
   */
  echange: { possible: true; jeu: CleDeJeu } | { possible: false; refus?: string }
}

/** Ce qu'une fête fait au Cabinet, pendant elle seulement : son nom, et son gardien tant qu'il dort. */
export interface FeteVue {
  cle: CleDeSaison
  nom: string
  /** « Gagne une œuvre, et la Citrouille se réveillera. » */
  gardien?: { legendaire: string; dit: string }
}

export interface PageDuCabinet {
  /** L'heure du serveur : la page mesure son horloge (invariant 6). */
  maintenant: number
  /** La réponse est partie sans `X-Requested-With` — le préchargement (`shared/depart.ts`) : sa mesure ne vaut pas. */
  prechargee?: true
  salles: SalleVue[]
  gardiens: { tous: GardienVu[]; prochain?: { legendaire: string; dit: string } }
  visite: VisiteVue
  /** Ce qui reste aujourd'hui : « elles reviennent à minuit ». */
  chasses: { restent: number; parJour: number }
  libres: { paientEncore: number; parJour: number }
  /** « 12 jours de visite d'affilée : réponds à une manche aujourd'hui pour garder ta série. » — un jour ne compte qu'à sa première manche répondue. */
  serie: { jours: number; aJouer: boolean; record: number }
  /** Le solde de poussière d'or. */
  poussiere: number
  /** La partie ouverte, telle que le pli la dit à `maintenant`. */
  enCours: VueDeLaPartie | null
  fete: FeteVue | null
  /** Une expédition l'attend encore : « Ton expédition t'attend : la finir ». */
  expedition: 'en-route' | null
  /** Les jeux livrés : un cadre vide d'un autre jeu dit « bientôt ». */
  jeux: CleDeJeu[]
  /** La tour : la montée du jour, l'étage à jouer et ses portes, le record. */
  tour: TourVue
  /**
   * Ce que la dépense qui rend cette page vient de réveiller — l'achat qui
   * complète une salle, ou le Cabinet entier, la dorure qui dore une salle
   * entière : la réponse de ce seul geste le porte, une fois ; la page le dit
   * comme le bilan d'une partie (`BilanVu.gardiens`, `GainsDuCabinet`). Rien
   * de réveillé : absent. Une page lue, un échange, une dépense rejouée ne le
   * portent que pour la partie d'un jour d'avant que le serveur vient de clore
   * — à cette page, ou au départ ou à la dépense d'avant : sa fin n'avait
   * personne à qui le dire, la première page qui suit le dit, une fois.
   */
  reveil?: ReveilDesGardiens
}

/**
 * La tour telle que la page la montre (`shared/cabinet/montee.ts`) : la montée
 * du jour la plus récente, l'étage que « Monter » ou « Continuer » ouvre — ses
 * portes, chacune son jeu, ce qu'elle promet et l'œuvre qu'elle garde, nommée :
 * la porte dit ce qu'on gagne, le cadre vide du musée continue de la taire —,
 * et le record. Ce qui juge — le seuil d'une porte, le cœur perdu — vient du
 * serveur ; la page ne refait aucune règle.
 */
export interface TourVue {
  montee: MonteeVue | null
  /** Null tant qu'une partie de la montée attend : « Reprendre » la rouvre. */
  aJouer: { n: number; etage: number; coeurs: number; portes: PorteVue[] } | null
  record: { etage: number; etoiles: number } | null
  /** Les cœurs d'une montée neuve (`COEURS_D_UNE_MONTEE`). */
  coeurs: number
}

/** Une montée du jour : ses cœurs, ses étoiles, ses étages joués, sa carte-bonus. */
export interface MonteeVue {
  n: number
  carte: string | null
  coeurs: number
  etoiles: number
  hauteur: number
  enCours: boolean
  finie: boolean
  sommet: boolean
  etages: EtageVu[]
}

/** Un étage joué : sa porte, et si elle s'est ouverte (null : sa partie se joue). */
export interface EtageVu {
  etage: number
  jeu: CleDeJeu
  butin: ButinDUnePorte
  oeuvre: string | null
  seuil: number
  total: number | null
  ouverte: boolean | null
  etoiles: number
}

/** Une porte de l'étage à jouer. */
export interface PorteVue {
  porte: number
  jeu: CleDeJeu
  butin: ButinDUnePorte
  /** L'œuvre qu'elle garde, nommée — sa peinture se montre. */
  oeuvre: string | null
  seuil: number
  coffre: boolean
}

/**
 * Ce qu'un changement du musée vient de réveiller : une salle complète, tous
 * ses cadres dorés, les quatre-vingt-quatre œuvres, trente jours d'affilée,
 * une œuvre gagnée en jouant pendant une fête. Jamais un Divin (invariant 21).
 */
export interface ReveilDesGardiens {
  /**
   * Chaque gardien que ce changement a rangé, dans l'ordre des salles :
   * `neuf`, le légendaire est à lui de ce jour — il s'annonce en grand ;
   * sinon il veillait déjà, gagné ailleurs (« Salle complète ! Le Phénix
   * veillait déjà sur elle. »).
   */
  gardiens: { legendaire: string; neuf: boolean }[]
  /** La luciole, à la première salle complète. */
  compagnon?: CleDeCompagnon
}

/**
 * Des réveils fondus en un : chaque gardien une fois, dans leur ordre, neuf
 * s'il l'est dans l'un ; la première luciole. Le serveur fond la partie d'hier
 * qu'il a close et la dépense qui rend la page ; la page, deux pages qui en
 * portent un avant qu'on ait lu le premier — la réponse d'une dépense, puis
 * celle du retour au premier plan. Une seule règle pour les deux côtés : ils
 * en avaient chacun sa copie, et l'une pouvait évoluer sans l'autre. Rien :
 * absent ; un seul : lui-même, tel quel.
 */
export function fondreLesReveils(...reveils: (ReveilDesGardiens | null | undefined)[]): ReveilDesGardiens | undefined {
  const tous = reveils.filter((r): r is ReveilDesGardiens => !!r)
  if (tous.length <= 1) return tous[0]
  const neufs = new Map<string, boolean>()
  for (const r of tous) for (const g of r.gardiens) neufs.set(g.legendaire, (neufs.get(g.legendaire) ?? false) || g.neuf)
  const compagnon = tous.find(r => r.compagnon)?.compagnon
  return { gardiens: [...neufs].map(([legendaire, neuf]) => ({ legendaire, neuf })), ...(compagnon && { compagnon }) }
}

// ── Une partie — `POST /api/cabinet/partie`, son geste, sa relecture ──────

/** La carte-bonus emportée : son pouvoir, sa force, ce qu'il en reste, ce qu'elle fait à ce jeu. */
export interface CarteVue {
  cle: string
  pouvoir: CleDePouvoir
  force: Force
  /** Les usages qui restent : Éclairer, Changer, la mise ; les deux autres agissent seuls. */
  reste: number
  /** « Éclairer : dévoile l'année d'un nouveau venu — 2 indices par partie ». */
  dit: string
}

/** La révélation d'une manche tranchée : le corps de son jeu, et ce qu'en dit la partie. */
export interface RevelationVue {
  manche: Manche
  /**
   * L'indice, dans le plan figé, du contenu que la manche a joué — après
   * « Changer », une rechange : l'adresse du tableau entier du Détail le porte
   * (`adresseDUnCadrage`), jamais l'indice de la manche à sa place — le cache du
   * téléphone rendrait l'image d'avant. Toujours posé par la vue ; facultatif
   * pour les révélations écrites à la main des épreuves de la page.
   */
  tirage?: number
  fin: FinDUneManche
  /** Les positions de ses pièces que « Signaler une erreur » vise : les seules questions de la base — le Pari, le Mot, le Filet. */
  signalables: number[]
  corps: RevelationDUneManche
  /**
   * La manche était misée : parfaite, la mise est gagnée ; sinon, perdue, et
   * la manche ne vaut rien. Le titre du corps vient du jeu, qui ne sait rien de
   * la mise : « Reconnu » coiffait zéro étoile, « Trouvé en 3 essais » aussi
   * (Théo, à la tablée du 26 octobre 2026). Absent d'une manche pas misée. Sur
   * la révélation et pas sur `MancheVue` : seule la révélation se titre.
   */
  misee?: 'gagnee' | 'perdue'
}

/** Ce qu'une manche vaut, à présent : ses étoiles après les pouvoirs, et pourquoi elles diffèrent (« +3 : mise gagnée »). */
export interface MancheVue {
  etoiles: number | null
  naturel: number | null
  note?: string
  /** Comment elle s'est tranchée : la révélation d'une manche quittée le dit, même au bon mot. */
  fin?: FinDUneManche
  /**
   * Sa révélation, tranchée : « Mes réponses » d'une partie finie montre la
   * même vue que la partie en cours, chaque manche révélée (le même pli). La
   * partie en cours ne la porte pas ici : seule la manche qu'elle vient de
   * trancher se révèle, dans `VueDeLaPartie.revelation`.
   */
  revelation?: RevelationVue
}

/** Le cartel que garde la partie, en clair : la manche, sa question telle que la partie l'a lue, la réponse, « Le savais-tu ? ». */
export interface CartelDuBilan {
  manche: Manche
  sujet: string
  reponse: string
  anecdote: string | null
}

/** Ce que la fin d'une partie a rapporté : l'écran des gains de la campagne (`CeQueTuGagnes`, `NouveauxTrophees`, `APorter`). */
export interface GainsDuCabinet {
  /** L'expérience de ses bonnes réponses, créditée une fois à la fin. */
  xp: number
  confettis: number
  recompenses?: PalierTombe[]
  /** Les gardiens qu'elle a réveillés, à annoncer en grand ; déjà à lui par une autre voie, aucun. */
  legendaires?: string[]
  /** La luciole, à la première salle complète. */
  compagnon?: CleDeCompagnon
}

/** Le bilan à l'écran : le bilan figé, l'œuvre et son cartel, et ce que la fin a rapporté (la fin seule le sait). */
export interface BilanVu extends Omit<BilanDUnePartie, 'v' | 'cartel'> {
  /** Le cartel de l'œuvre, en clair — le bilan figé n'en garde que la manche (`BilanDUnePartie.cartel`) ; null : aucune manche n'a d'anecdote. */
  cartel: CartelDuBilan | null
  seuil: number | null
  /** « Pas assez d'étoiles cette fois. Il en fallait 6. L'œuvre reste à gagner. » */
  dit: string
  oeuvre?: CleDOeuvre
  /**
   * La fin a fait de cette partie le cartel de son œuvre : gagnée, ou dorée
   * ou doublée quand elle n'en avait pas encore — la base garde le premier
   * (`cabinet_oeuvres.serie_id`) et le dit, jamais la mémoire d'un serveur.
   * La fin seule le sait, comme `gains` : posé quand elle a parlé, il manque
   * à un bilan relu sans elle — « Mes réponses », un geste rejoué dont la
   * réponse s'est perdue. La page y dit encore « Son cartel » d'une œuvre
   * gagnée, qui l'a pris à coup sûr (`titreAuBilan`), et ne promet rien d'une
   * dorée ou d'une doublée.
   */
  devientSonCartel?: true
  /** Une salle complète, un gardien qui veillait déjà : « Salle complète ! Le Phénix veillait déjà sur elle. » */
  gardiens?: { legendaire: string; neuf: boolean }[]
  gains?: GainsDuCabinet
  /**
   * Une partie de la visite manquée aujourd'hui : « Retenter » sa case, possible
   * ou sa raison — la même que sous la case (`CaseVue.retenter`), jamais
   * l'œuvre. Ce que le serveur sait du jour, de sa mémoire seule : un bilan
   * relu après un réveil, ou d'un jour d'avant, ne le porte pas.
   */
  retenter?: RetenteVue
  /**
   * Une partie libre qui payait et n'a rien rapporté : celles qui paient
   * encore aujourd'hui — `dit` le redit (« Encore 4 parties libres qui
   * paient aujourd'hui »). De la mémoire du jour seule, comme `retenter`.
   */
  libresQuiPaientEncore?: number
}

export interface VueDeLaPartie {
  id: string
  maintenant: number
  /** Le rang du prochain geste (invariant 12). */
  rang: number
  jeu: CleDeJeu
  origine: OrigineDUnePartie
  /**
   * Ce qui est en jeu, sans nommer l'œuvre visée d'une visite tant qu'elle
   * n'est pas gagnée : la forme même d'une case de la visite (`EnjeuDUneCase`),
   * que la page dessine d'une seule façon ; null en partie libre.
   */
  enJeu: EnjeuDUneCase | null
  seuil: number | null
  carte: CarteVue | null
  manche: Manche
  /**
   * L'indice, dans le plan figé, du contenu de la manche où il en est — la
   * sienne, ou la rechange que « Changer » a prise ; absent avant la première
   * manche. L'adresse d'une image du Détail le porte (`adresseDUnCadrage`) : il
   * ne désigne jamais deux tableaux, et le cache du téléphone ne rend pas
   * l'image d'avant. Rien d'une rechange à venir : seulement combien ont servi.
   */
  tirage?: number
  phase: PhaseDeLaPartie
  manches: MancheVue[]
  /** Sur neuf. */
  total: number
  /**
   * L'échéance de l'étape en cours, à l'heure du serveur ; sous la pause,
   * figée tant qu'il en reste. Sous Prendre son temps, ce que la carte-bonus
   * ajoute à l'étape (`enPlusMs`, figé au départ) : la page pose un repère où
   * il commence — Camille perdait son cadre doré sans le voir (la tablée du
   * 26 octobre 2026). La page n'y recopie aucun chiffre du barème ; le serveur
   * marque le temps en plus un peu après, sa grâce passée.
   */
  chrono?: { echeance: number; dureeMs: number; pauseResteMs?: number; enPlusMs?: number }
  /** Le pouvoir de la carte-bonus, maintenant : la page grise sans rien recopier. */
  pouvoir?: { jouable: boolean; refus?: string }
  /** La manche qui se joue, sans sa réponse. */
  enCours?: MancheMontree
  revelation?: RevelationVue
  bilan?: BilanVu
  /**
   * Ce que vaudrait la partie quittée à cet instant : son total sur neuf,
   * tous les pouvoirs comptés, et sa poussière d'or — le geste « Quitter » joué
   * par le pli sur l'état, rien d'écrit. « Quitter ? » promettait « les étoiles déjà
   * gagnées » quand Protéger relevait la manche quittée et qu'une partie
   * quittée d'emblée payait quatre poussières d'or (jusqu'au 26 octobre
   * 2026) ; quittée sans une réponse, elle ne vaut plus rien, et la vue le
   * dit — quitter n'est jamais meilleur que répondre faux. La page ne dit que
   * ces deux chiffres : elle en déduisait que Protéger avait compté, et une
   * manche quittée ne se relève plus. Absent
   * d'une partie finie, et d'une manche dont le temps est écoulé : sa
   * réponse part d'elle-même, et la révélation suit.
   */
  siTuQuittes?: { total: number; poussiere: number }
  /**
   * Les cartes d'une épreuve de traversée, chacune son pouvoir maintenant
   * (`pouvoirMaintenant`) : jusqu'à quatre à la fois, quand une partie du
   * musée n'en a qu'une (`carte`, nulle ici).
   */
  cartes?: CarteDEpreuveVue[]
  /** Ce que l'épreuve vaut déjà à sa traversée : les cœurs, l'or, le gardien, et sa fin (`epreuveEnCours`). */
  traversee?: EpreuveEnCours
}

/** Une carte d'une épreuve de traversée, et son pouvoir maintenant : la page grise sans rien recopier. */
export interface CarteDEpreuveVue extends CarteVue {
  maintenant: { jouable: boolean; refus?: string }
}

/**
 * Une traversée telle que la page la reçoit : rien n'y est secret — la carte
 * des trois actes se voit dès le départ, et chaque épreuve tire ses questions
 * au serveur en y entrant (invariant 1). Son départ, son état replié, ce qui
 * s'atteint, les prix du marchand, ce qu'une amélioration sert encore, et la
 * partie de l'épreuve qui se joue, à reprendre.
 */
export interface VueDeLaTraversee {
  id: string
  /** Sa version : la page en lit le barème (`baremeDe`) — les points de vie d'un gardien, l'or d'une étoile, ce qu'offre un coffre. */
  v: DepartDeLaTraversee['v']
  /** Le rang du prochain geste (invariant 12). */
  rang: number
  maintenant: number
  jour: string
  actes: DepartDeLaTraversee['actes']
  acte: EtatDeLaTraversee['acte']
  position: string
  visitees: readonly string[]
  ou: EtatDeLaTraversee['ou']
  cartes: EtatDeLaTraversee['cartes']
  coeurs: number
  coeursMax: number
  or: number
  pv: EtatDeLaTraversee['pv']
  assauts: number
  ameliorations: number
  souffle: boolean
  vaincus: readonly string[]
  epreuves: number
  reussies: number
  derniere: BilanDEpreuve | null
  fin: FinDeLaTraversee | null
  atteignables: string[]
  /** Le marchand : un cœur, et l'amélioration de chaque carte qui monte encore, à son prix — vers la carte ++, bien plus chère. */
  prix: { coeur: number; cartes: Partial<Record<CleDeCarte, number>> }
  /** Les cartes qu'une amélioration offerte — le coffre, le gardien vaincu — peut prendre : la carte ++ ne s'offre pas. */
  offrables: CleDeCarte[]
  /** Ce que la Parade peut encore parer dans cet acte (`paradesDeLActe`) ; null sans Parade, ou sans plafond (jusqu'à la version 2). */
  parades: { restent: number; max: number } | null
  /**
   * Ce que cette traversée a fait tomber des défis de ses cartes et des épreuves de maître (`defisDeLaTraversee`,
   * `shared/cabinet/defis.ts`) : toutes ses clés, et celles de sa dernière épreuve conclue — son bilan les dit.
   */
  sceaux: { atteints: string[]; derniers: string[] }
  partie?: VueDeLaPartie
}

/** Ce que la page de la traversée lit : la dernière traversée — en route, ou finie —, et les légendaires qu'il a déjà. */
export interface PageDeLaTraversee {
  maintenant: number
  traversee: VueDeLaTraversee | null
  /** Ses légendaires : un gardien qu'il a déjà se dit « déjà à toi », au départ comme au choix final. */
  possedes: string[]
  /** Ce qu'il tient des défis de ses cartes, toutes traversées confondues — le rang de chaque carte, les gardiens vaincus en maître. */
  defis: DefisTenus
}

// ── Ce qu'on apprend ──────────────────────────────────────────────────────

/** Le cartel d'une œuvre : ce que la partie qui l'a fait entrer lui a appris, ou un cartel d'office. */
export interface Cartel {
  oeuvre: CleDOeuvre
  origine: OrigineDUneOeuvre
  /** D'une partie : la manche qu'il garde, relue par le même pli que la partie en cours (invariant 14). */
  partie?: {
    id: string
    jeu: CleDeJeu
    /** « Les grands sièges » : le thème de la manche qu'il garde — à l'Épingle, une rechange de Changer vient d'un autre que la partie. */
    theme?: string
    /** « le 24 octobre 2026 ». */
    jour: string
    /** « 7 sur 9 ». */
    total: number
    /**
     * Ce que cette partie a fait à l'œuvre : la gagner (`gagnee`, `gagnee-doree`),
     * ou, l'œuvre déjà à lui — achetée, offerte, ou gagnée par une
     * partie sans rien à raconter —, la dorer ou la doubler (`doree`, `double`).
     * Le serveur le dit toujours ; facultatif pour les cartels écrits à la main
     * des épreuves de la page.
     */
    issue?: IssueDUnePartie
    sujet: string
    reponse: string
    anecdote: string | null
  }
  /** « Achetée avec ta poussière d'or… », « Offerte à ton arrivée… », « Entrée dans ton musée le …, gagnée en jouant. ». */
  dit?: string
  doree: boolean
}

/** Tes murs : ce qu'il a appris, d'où qu'il vienne — rien ne s'écrit pour eux. */
export interface MursDuCabinet {
  lieux: { id: string; nom: string; commune: string; departement: string; date: string; annee: number; lat: number; lon: number; vuLe: number }[]
  /** La frise personnelle, du plus ancien au plus récent. */
  dates: { libelle: string; annee: number; de: 'cabinet' | 'expedition'; vuLe: number }[]
}

/**
 * Le gros bouton de l'accueil (`ProfilDAccueil.cabinet`) : la traversée qu'il
 * a en route — « Acte 2 sur 3 · 4 cœurs », « En route ». Le serveur ne la dit
 * que d'une traversée qu'il a en mémoire : l'accueil ne lui paie pas son lot
 * froid — après chaque réveil, le bouton garde sa ligne de toujours jusqu'à la
 * première page du Cabinet. Finie, ou jamais partie : rien, la même ligne.
 */
export interface CabinetDAccueil {
  /** L'acte où il en est, de 1 à 3. */
  acte: number
  coeurs: number
}

// ── Les vues dépliées ─────────────────────────────────────────────────────

/**
 * Ce qu'il a vu, déplié pour le Cabinet : un composé de l'Éclair ou d'une
 * frise de sujet vaut une vue de chacune de ses questions, à la même heure —
 * une question vue à l'Éclair ne revient pas au Pari avant sept jours. Une
 * frise de l'Expédition aussi (`frise:<id>+<id>…`, une ligne pour toute la
 * frise) : elle a dit l'année de chacun de ses événements, et sans elle un
 * événement rangé hier là-bas repassait pour frais dans la Frise du Cabinet.
 * Le plus récent l'emporte. `vuesDe` déplie déjà l'Éclair, la frise d'un
 * sujet et le tableau du Détail pour toute la campagne
 * (`JournalDesReponses.vuesDe`) : ce qui n'est qu'au Cabinet ici, ce sont les
 * frises de l'Expédition (`frise:`) ; redéplier un composé ne change rien, le
 * plus récent l'emporte.
 */
export function vuesDuCabinet(vues: ReadonlyMap<string, number>): Map<string, number> {
  const depliees = new Map<string, number>()
  for (const [id, le] of vues) {
    const questions = id.startsWith(PREFIXE_DE_LA_FRISE) ? id.slice(PREFIXE_DE_LA_FRISE.length).split('+') : deplier(id)
    for (const q of questions) depliees.set(q, Math.max(le, depliees.get(q) ?? Number.NEGATIVE_INFINITY))
  }
  return depliees
}
