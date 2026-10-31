// Les lots d'écriture du Cabinet, chacun gardé par la base même (« Chaque lot
// d'écriture est gardé par son geste », `docs/architecture/decisions.md`) :
// deux onglets, deux serveurs pendant une mise en ligne, une réponse HTTP
// perdue puis rejouée — rien ne compte deux fois. Un départ ne pose sa partie
// que si le profil n'en a aucune en cours et s'il a encore le droit du jour,
// recompté dans l'instruction même ; un geste s'insère à son rang avec un
// `uid` tiré par ce serveur pour ce lot (`ON CONFLICT DO NOTHING`), et chaque
// autre instruction n'agit que si ce geste-là est en base (`gesteEcrit`). Le
// geste est toujours la première instruction de son lot : la fin d'une partie
// se dit écrite sur sa ligne (`FinDUnePartie.ecrite`, la porte de la
// campagne). Un achat et une dorure ne paient que si le solde, relu dans
// l'instruction même, les couvre, et qu'aucune partie n'attend — et la
// première dépense du jour fige la visite, comme un départ, si elle passe ; un
// échange ne change la visite que si la base la dit pas encore échangée, et sa
// case pas encore jouée ; une case de la visite ne part qu'au jeu que la base
// lui garde.
//
// Le seul fichier qui écrit la colonne `joker` : elle porte le pouvoir qui a
// aidé une pièce (`pouvoir:eclairer`, `pouvoir:temps`), jamais la clé d'une
// carte-bonus — Bastion et Cuirasse sont aussi des cartes du second essai de
// l'Expédition, que le carnet lit : écrite en clé, une juste du Cabinet y
// passerait pour ratée.
//
// Aucun `UPDATE` ni `DELETE` de `campagne_reponses`, aucun `DELETE` de
// `campagne_series` hors de la suppression d'un profil : les déclencheurs des
// tranches du journal les effaceraient toutes, et le réveil suivant relirait
// toute la base (`DECLENCHEURS_DES_TRANCHES`, règle `campagne.md`).
import type { InStatement } from '@libsql/client'
import { CHASSES_PAR_JOUR, LIBRES_QUI_PAIENT } from '../../../../shared/cabinet/bareme'
import type { RecordDeLaTour } from '../../../../shared/cabinet/montee'
import type { BilanDUnePartie, DepartDUnePartie, GesteDuCabinet, PieceJugee } from '../../../../shared/cabinet/partie'
import type { CleDeSaison } from '../../../../shared/saisons'
import { COLONNES_D_UNE_OEUVRE, champDuDepart, gesteEcrit, partiesDuJour } from './tables'

// ── Le départ ─────────────────────────────────────────────────────────────

export interface DepartAEcrire {
  profileId: string
  serie: string
  depart: DepartDUnePartie
  /** L'heure d'arrivée de la requête, prise avant le verrou : la date de la partie et de la ligne du profil. */
  t: number
  /**
   * Le zéro du chrono de la première manche : l'heure du serveur une fois le
   * plan tiré, juste avant ce lot — la manche ne court pas pendant le verrou,
   * le lot froid et le tirage.
   */
  ouverteLe: number
  /** Le jour de Paris du départ, et minuit : la visite figée et le recompte du jour s'y lisent. */
  jour: string
  minuit: number
  /** Les visites que `cabinet_profils.visites` garde, celle du jour en tête (`visitesAGarder`) : elle s'y fige si elle ne l'est pas. */
  visites: string
  /** Le geste qui ouvre la première manche ; null sous une carte de Miser, qui décide avant de voir. */
  ouverture: { geste: GesteDuCabinet; uid: string } | null
}

/**
 * Le lot du départ, d'un seul aller-retour : la page qui commence attend sa
 * première manche, et chaque aller-retour coûte des dixièmes de seconde au
 * dixième de cœur de l'hébergeur. Trois instructions, chacune sous la
 * précédente :
 *
 * 1. la ligne du profil prend la partie — seulement s'il n'en a pas en cours,
 *    qu'il lui reste une chasse, que sa case de la visite n'est pas déjà
 *    commencée aujourd'hui, ou que l'étage de sa montée n'a pas déjà sa
 *    partie — deux onglets sur la même porte —, recomptés par la base même : la mémoire d'un
 *    serveur ne sait pas ce que l'autre vient d'écrire. Une case d'une visite
 *    déjà figée en base part au jeu que la base lui garde, ou ne part pas :
 *    l'autre serveur a pu l'échanger, et la mémoire d'ici l'aurait lancée à son
 *    jeu d'avant. La visite du jour se fige au premier lot du jour qui écrit
 *    (« La visite du jour se dérive, puis se fige au premier départ »,
 *    `docs/architecture/decisions.md`). La première fois, la ligne naît. La
 *    série ne se compte plus ici, mais à la première manche répondue
 *    (`lotDuGeste`, `jourCompte`) :
 *    comptée au départ, une visite quittée d'emblée tenait trente jours
 *    d'affilée — et réveillait le Scarabée — sans une réponse (l'arbitrage du
 *    26 octobre 2026) ;
 * 2. la partie, seulement si la ligne la nomme — une partie libre parmi les
 *    cinq du jour qui paient, comptée là aussi (elle se relit par `RETURNING`) ;
 * 3. l'ouverture de la première manche, seulement si la partie est née.
 *
 * Rendu : la ligne du profil a-t-elle pris la partie (`rowsAffected` de la
 * première), et la partie est-elle née (une ligne rendue par la seconde).
 */
export function lotDuDepart(d: DepartAEcrire): InStatement[] {
  // Ses parties du jour d'une origine, par l'index du profil et de la date ; le profil et minuit nommés par leur place.
  const duJour = (origine: string, profil: string, minuit: string) =>
    `SELECT COUNT(*) FROM campagne_series WHERE ${partiesDuJour(profil, minuit)} AND ${champDuDepart('origine')} = '${origine}'`
  const profil: InStatement = {
    sql: `INSERT INTO cabinet_profils (profile_id, partie, visites, cree_le, maj_le)
          VALUES (?1, ?2, ?4, ?5, ?5)
          ON CONFLICT (profile_id) DO UPDATE SET
            partie = excluded.partie,
            maj_le = excluded.maj_le,
            visites = CASE WHEN json_valid(visites) AND json_extract(visites, '$[0].jour') = ?3 THEN visites ELSE ?4 END
          WHERE cabinet_profils.partie IS NULL
            AND (?6 <> 'chasse' OR (${duJour('chasse', '?1', '?7')}) < ${CHASSES_PAR_JOUR})
            AND (?6 <> 'visite' OR (${duJour('visite', '?1', '?7')} AND ${champDuDepart('visite')} = ?8) = 0)
            AND (?6 <> 'montee' OR (${duJour('montee', '?1', '?7')} AND ${champDuDepart('montee.n')} = CAST(?10 AS INTEGER) AND ${champDuDepart('montee.etage')} = CAST(?11 AS INTEGER)) = 0)
            AND CASE WHEN ?6 = 'visite' AND json_valid(cabinet_profils.visites) AND json_extract(cabinet_profils.visites, '$[0].jour') = ?3
                     THEN json_extract(cabinet_profils.visites, '$[0].cases[' || CAST(?8 AS INTEGER) || '].jeu') = ?9
                     ELSE 1 END`,
    // Le jeu ne sert qu'à la garde de la case. Un `CASE`, et non un `OR` : le chemin d'une case −1 (une chasse, une
    // libre) ne se lit jamais, et une visite pas encore figée — `NULL` au jour — n'a rien à garder. L'indice se lie en
    // réel (`1.0`), que le chemin d'un tableau refuse : il se coupe en entier.
    args: [d.profileId, d.serie, d.jour, d.visites, d.t, d.depart.origine, d.minuit, d.depart.visite ?? -1, d.depart.jeu, d.depart.montee?.n ?? -1, d.depart.montee?.etage ?? -1],
  }
  // La partie libre se dit payée ou non par la base : deux onglets qui partent ensemble ne paient pas six fois.
  const cabinet =
    d.depart.origine === 'libre'
      ? `json_set(?4, '$.payee', json(CASE WHEN (${duJour('libre', '?2', '?5')}) < ${LIBRES_QUI_PAIENT} THEN 'true' ELSE 'false' END))`
      : '?4'
  const partie: InStatement = {
    sql: `INSERT INTO campagne_series (id, profile_id, mode, commencee_le, questions, position, vies, justes, cabinet)
          SELECT ?1, ?2, 'cabinet', ?3, '[]', 0, 0, 0, ${cabinet}
           WHERE (SELECT partie FROM cabinet_profils WHERE profile_id = ?2) = ?1
          RETURNING CASE WHEN json_extract(cabinet, '$.payee') THEN 1 ELSE 0 END AS payee`,
    // Minuit ne sert qu'au recompte des libres : un paramètre de trop se refuse.
    args: [d.serie, d.profileId, d.t, JSON.stringify(d.depart), ...(d.depart.origine === 'libre' ? [d.minuit] : [])],
  }
  const lot = [profil, partie]
  if (d.ouverture) {
    lot.push({
      sql: 'INSERT INTO cabinet_gestes (serie_id, rang, geste, fait_le, uid) SELECT ?, 1, ?, ?, ? WHERE EXISTS (SELECT 1 FROM campagne_series WHERE id = ?)',
      args: [d.serie, JSON.stringify(d.ouverture.geste), d.ouverteLe, d.ouverture.uid, d.serie],
    })
  }
  return lot
}

// ── La visite figée hors d'un départ ──────────────────────────────────────

/** La visite du jour à figer d'un lot qui n'est ni un départ ni un échange : son jour, et les visites que la ligne garde (`visitesAGarder`). */
export interface VisiteAFiger {
  profileId: string
  jour: string
  visites: string
}

/**
 * La visite du jour figée dans la ligne du profil, si aucun lot ne l'a encore
 * fait — et rien d'écrit sinon : une instruction qui ne change rien ne coûte
 * pas une ligne écrite. Un départ et un échange la figent dans leur propre
 * instruction ; la première dépense du jour et la fin d'une partie d'un jour
 * d'avant passent par celle-ci. Toutes deux font entrer une œuvre que
 * minuit n'avait pas, et la case du prochain gardien ne sait pas, d'un gardien
 * qui veille sur une salle complétée depuis, s'il dormait à minuit : venu
 * d'ailleurs, l'achat de la dernière œuvre de sa salle changeait la visite
 * (la relecture du 26 octobre 2026). La ligne existe déjà — un solde, une
 * partie à clore en ont une —, et `IS` lit une visite d'un autre jour comme
 * une visite vide : `NULL` ne vaut jamais le jour.
 *
 * Gardée, comme toute instruction d'un lot qui n'est pas la première :
 * par le geste qui finit la partie (`gesteEcrit`), par la ligne que la dépense
 * vient d'écrire (`depenseEcrite`). Sans garde, une dépense que la base
 * refusait — la poussière que l'autre serveur d'une mise en ligne venait de
 * dépenser — figeait quand même la visite d'un musée que le magasin oubliait,
 * faux, l'instant d'après (la deuxième tablée, le 26 octobre 2026).
 */
export function instructionQuiFigeLaVisite(v: VisiteAFiger, garde: { sql: string; args: readonly (string | number)[] }): InStatement {
  return {
    sql: `UPDATE cabinet_profils SET visites = ?
           WHERE profile_id = ? AND NOT (json_valid(visites) AND json_extract(visites, '$[0].jour') IS ?) AND ${garde.sql}`,
    args: [v.visites, v.profileId, v.jour, ...garde.args],
  }
}

// ── Un geste, ses pièces, sa fin ──────────────────────────────────────────

/** Ce qu'une fin écrit de plus : son bilan, la poussière au reflet, l'œuvre qu'elle fait entrer, dorer ou garder en cartel, et le record de la tour qu'elle bat. */
export interface FinAEcrire {
  profileId: string
  bilan: BilanDUnePartie
  /** L'œuvre, telle que la fin la touche ; rien pour une partie qui n'en change aucune. */
  oeuvre: OeuvreAEcrire | null
  /** La montée telle que cette fin la laisse, quand elle bat le record que la mémoire connaît ; rien sinon. */
  record?: RecordDeLaTour | null
}

export interface OeuvreAEcrire {
  cle: string
  /** `partie` pour une œuvre gagnée, `depart` pour une œuvre de départ sans ligne qui prend un cartel ou un cadre ; une œuvre déjà là garde la sienne. */
  origine: 'partie' | 'depart'
  /** La fête du jour de son départ, pour une œuvre gagnée en jouant (`calendrierDuCabinet`) ; jamais pour une dorure ni un cartel. */
  saison: CleDeSaison | null
  /** Le cartel de cette partie, si elle en garde un et que l'œuvre n'en a pas. */
  cartel: boolean
  /** Dorée par cette partie : trois manches parfaites, sans qu'un pouvoir ait servi. */
  doree: boolean
}

export interface GesteAEcrire {
  serie: string
  rang: number
  geste: GesteDuCabinet
  faitLe: number
  uid: string
  /** Les pièces que ce geste vient de trancher, dans l'ordre de leur verdict. */
  pieces: readonly PieceJugee[]
  /** Le compagnon de sa niche, que chaque réponse retient. */
  compagnon: string | null
  /**
   * Le jour que ce geste fait compter à la série — la première manche
   * répondue d'une visite ou d'une chasse (`laPartieARepondu`) : le jour de
   * Paris de son départ, et sa veille. Null pour tout autre geste.
   */
  jourCompte: { profileId: string; jour: string; veille: string } | null
  /**
   * La visite du jour de ce geste à figer avant la fin qu'il écrit — celle
   * d'une partie d'un jour d'avant, que son départ n'a pas figée : son œuvre
   * entre après minuit (`instructionQuiFigeLaVisite`). Null pour tout autre
   * geste, ou une visite déjà figée.
   */
  visite: VisiteAFiger | null
  fin: FinAEcrire | null
}

/**
 * La série d'après un jour joué, dans l'instruction même : un jour déjà
 * compté ne compte pas deux fois, la veille la prolonge, tout autre la
 * recommence ; un jour d'avant le dernier compté — la partie d'hier close
 * aujourd'hui — ne la fait pas reculer. SQLite lit chaque membre d'un `SET`
 * sur la ligne d'avant : le record se lit sur la série d'avant ce geste. La
 * mémoire suit la même règle (`serieApresUnJour`, `shared/cabinet/musee.ts`).
 * Ses paramètres, anonymes : le jour, puis la veille. L'instruction ne
 * touche la ligne que pour un jour plus récent que le dernier compté (`WHERE`,
 * `lotDuGeste`) : le premier membre du `CASE` n'y sert plus, et il reste — la
 * règle se lit entière ici, comme dans la mémoire.
 */
const SERIE_APRES_LE_JOUR = `CASE WHEN serie_jour >= ? THEN serie WHEN serie_jour = ? THEN serie + 1 ELSE 1 END`

/**
 * Le lot d'un geste, d'un seul aller-retour, son verdict et sa fin compris :
 * le geste à son rang d'abord — `rowsAffected` dit tout —, puis, sous lui,
 * chaque pièce jugée — sa réponse, et la pièce au bout de la partie
 * (`json_insert`, jamais réécrite en entier) —, le jour de la série à la
 * première manche répondue d'une visite ou d'une chasse (`jourCompte`), la
 * visite du jour figée quand il finit une partie d'un jour d'avant
 * (`visite`), et, au dernier geste, la fin : le bilan, la poussière au
 * reflet et la partie rendue, l'œuvre en une seule instruction pour le gain,
 * la dorure et le cartel. Une œuvre déjà là — achetée, offerte — prend son
 * cartel et sa dorure sans changer d'origine ni de saison, et rien de ce
 * qu'elle avait ne s'efface (`COALESCE`). L'œuvre vient en dernier, et rend sa
 * ligne telle que la base l'a gardée (`RETURNING`) : la mémoire d'un serveur
 * peut ne pas savoir que l'autre lui a déjà donné un cartel, et seule la base
 * dit lequel elle garde (`BilanVu.devientSonCartel`).
 */
export function lotDuGeste(g: GesteAEcrire): InStatement[] {
  const garde = gesteEcrit(g.serie, g.rang, g.uid)
  const lot: InStatement[] = [
    {
      sql: 'INSERT INTO cabinet_gestes (serie_id, rang, geste, fait_le, uid) VALUES (?, ?, ?, ?, ?) ON CONFLICT (serie_id, rang) DO NOTHING',
      args: [g.serie, g.rang, JSON.stringify(g.geste), g.faitLe, g.uid],
    },
  ]
  for (const p of g.pieces) {
    lot.push(
      {
        sql: `INSERT INTO campagne_reponses (serie_id, position, reserve_id, choix, juste, repondue_le, compagnon, forme, joker, composee)
              SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${garde.sql}`,
        args: [g.serie, p.position, p.piece.id, p.choix, p.juste ? 1 : 0, p.repondueLe, g.compagnon, p.piece.forme ?? null, p.joker, p.composee, ...garde.args],
      },
      {
        sql: `UPDATE campagne_series SET questions = json_insert(questions, '$[#]', json(?)), position = position + 1, justes = justes + ? WHERE id = ? AND ${garde.sql}`,
        args: [JSON.stringify(p.piece), p.juste ? 1 : 0, g.serie, ...garde.args],
      },
    )
  }
  if (g.jourCompte) {
    const { profileId, jour, veille } = g.jourCompte
    // Un jour déjà compté — la deuxième case de la visite, la chasse d'après — ne réécrit pas la ligne : sans cette
    // garde, chaque partie répondue du jour la réécrivait à l'identique, jusqu'à cinq lignes par jour et par joueur au
    // quota de Turso pour rien (la deuxième tablée, le 26 octobre 2026). Sa voisine, la visite figée, se garde de même.
    lot.push({
      sql: `UPDATE cabinet_profils SET serie = ${SERIE_APRES_LE_JOUR}, serie_jour = MAX(COALESCE(serie_jour, ''), ?), serie_record = MAX(serie_record, ${SERIE_APRES_LE_JOUR})
             WHERE profile_id = ? AND (serie_jour IS NULL OR serie_jour < ?) AND ${garde.sql}`,
      args: [jour, veille, jour, jour, veille, profileId, jour, ...garde.args],
    })
  }
  if (g.visite) lot.push(instructionQuiFigeLaVisite(g.visite, garde))
  if (g.fin) {
    const { bilan, oeuvre, profileId } = g.fin
    lot.push(
      {
        sql: `UPDATE campagne_series SET finie_le = ?, issue = ?, bilan = ? WHERE id = ? AND finie_le IS NULL AND ${garde.sql}`,
        args: [g.faitLe, bilan.issue, JSON.stringify(bilan), g.serie, ...garde.args],
      },
      {
        // La poussière sous le seul geste, qui ne s'écrit qu'une fois ; la partie rendue si c'est encore la sienne.
        // Gardée par `partie = ?`, elle se perdait quand un serveur avait rendu la ligne d'une partie qu'il ne relit pas
        // (`rendreLaPartieIllisible` : un départ d'une version que l'autre serveur d'une mise en ligne connaît déjà) —
        // le bilan disait la poussière, le solde ne l'avait pas.
        sql: `UPDATE cabinet_profils SET poussiere = poussiere + ?, partie = CASE WHEN partie = ? THEN NULL ELSE partie END, maj_le = ? WHERE profile_id = ? AND ${garde.sql}`,
        args: [bilan.poussiere, g.serie, g.faitLe, profileId, ...garde.args],
      },
    )
    if (g.fin.record) {
      // Le record ne redescend jamais : la base garde le plus haut, même si l'autre serveur d'une mise en ligne en a écrit un
      // meilleur entre-temps. Avant l'œuvre, qui reste la dernière instruction et rend sa ligne.
      lot.push({
        sql: `INSERT INTO cabinet_records (profile_id, etage, etoiles, serie_id, bat_le)
              SELECT ?, ?, ?, ?, ? WHERE ${garde.sql}
              ON CONFLICT (profile_id) DO UPDATE SET etage = excluded.etage, etoiles = excluded.etoiles, serie_id = excluded.serie_id, bat_le = excluded.bat_le
              WHERE excluded.etage > cabinet_records.etage OR (excluded.etage = cabinet_records.etage AND excluded.etoiles > cabinet_records.etoiles)`,
        args: [profileId, g.fin.record.etage, g.fin.record.etoiles, g.serie, g.faitLe, ...garde.args],
      })
    }
    if (oeuvre) {
      lot.push({
        sql: `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, saison, serie_id, doree_le, dorure, serie_doree)
              SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${garde.sql}
              ON CONFLICT (profile_id, oeuvre) DO UPDATE SET
                serie_id = COALESCE(cabinet_oeuvres.serie_id, excluded.serie_id),
                doree_le = COALESCE(cabinet_oeuvres.doree_le, excluded.doree_le),
                dorure = COALESCE(cabinet_oeuvres.dorure, excluded.dorure),
                serie_doree = COALESCE(cabinet_oeuvres.serie_doree, excluded.serie_doree)
              RETURNING ${COLONNES_D_UNE_OEUVRE}`,
        args: [
          profileId,
          oeuvre.cle,
          oeuvre.origine,
          g.faitLe,
          oeuvre.origine === 'partie' ? oeuvre.saison : null,
          oeuvre.cartel ? g.serie : null,
          oeuvre.doree ? g.faitLe : null,
          oeuvre.doree ? 'partie' : null,
          oeuvre.doree ? g.serie : null,
          ...garde.args,
        ],
      })
    }
  }
  return lot
}

// ── La poussière d'or : acheter, dorer ────────────────────────────────────

/**
 * Le solde de poussière d'or d'un profil, relu par la base dans l'instruction
 * qui le dépense : ce qu'il a gagné (le reflet `cabinet_profils.poussiere`),
 * moins ce que ses œuvres ont coûté, chacune au prix qu'elle a payé — 84 lignes
 * au plus, par la clé. Sans ligne du profil, rien : `NULL` n'est jamais assez.
 * La mémoire du serveur ne suffit pas à le dire : l'autre serveur d'une mise en
 * ligne, ou un autre onglet, a pu dépenser la même poussière l'instant d'avant.
 * Aucune `CHECK` ne le garde : elle lèverait une erreur de la base, un 500, là
 * où le refus doit se dire en mots (« Il te manque 120 poussières d'or »).
 */
const SOLDE = `(SELECT poussiere FROM cabinet_profils WHERE profile_id = ?)
             - (SELECT COALESCE(SUM(COALESCE(prix, 0) + COALESCE(prix_dorure, 0)), 0) FROM cabinet_oeuvres WHERE profile_id = ?)`

/**
 * Aucune partie n'attend, dit la base : ce qu'une partie fait à son œuvre se
 * décide à sa fin, et l'autre serveur d'une mise en ligne a pu en commencer une
 * que la mémoire d'ici ne connaît pas encore (`refusDeLAchat` le dit en mots,
 * une fois relue). Par la clé du profil, la même ligne que le solde.
 */
const SANS_PARTIE = '(SELECT partie FROM cabinet_profils WHERE profile_id = ?) IS NULL'

export interface DepenseAEcrire {
  profileId: string
  oeuvre: string
  /** Le prix du jour, que la page a montré : il s'écrit avec la ligne, et l'achat le garde. */
  prix: number
  t: number
}

/**
 * La garde de ce que le lot d'une dépense écrit après elle — la visite du jour
 * qu'elle fige (`instructionQuiFigeLaVisite`) : la ligne que la dépense vient
 * d'écrire, à son heure — l'œuvre achetée à `t`, le cadre doré à la poussière à
 * `t` —, par la clé de l'œuvre. Refusée par la base, la dépense n'a rien écrit,
 * et rien ne s'écrit derrière elle ; comme un départ, qui ne fige la visite que
 * s'il part (`partie IS NULL`).
 */
export function depenseEcrite(d: DepenseAEcrire, sorte: 'achat' | 'dorure'): { sql: string; args: [string, string, number] } {
  const ecrite = sorte === 'achat' ? "origine = 'achat' AND gagnee_le = ?" : "dorure = 'poussiere' AND doree_le = ?"
  return { sql: `EXISTS (SELECT 1 FROM cabinet_oeuvres WHERE profile_id = ? AND oeuvre = ? AND ${ecrite})`, args: [d.profileId, d.oeuvre, d.t] }
}

/**
 * Un achat, une seule instruction : la ligne de l'œuvre, seulement si le solde
 * la paie, qu'aucune partie n'attend et qu'elle n'est pas déjà là.
 * `rowsAffected = 0` dit l'un ou l'autre, sans rien écrire — le magasin relit
 * et dit lequel. Rejoué (la réponse perdue en route, `auReveil`), il ne paie
 * pas deux fois : la clé de la ligne le garde.
 */
export function instructionDeLAchat(a: DepenseAEcrire): InStatement {
  return {
    sql: `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, prix)
          SELECT ?, ?, 'achat', ?, ? WHERE ${SOLDE} >= ? AND ${SANS_PARTIE}
          ON CONFLICT (profile_id, oeuvre) DO NOTHING`,
    args: [a.profileId, a.oeuvre, a.t, a.prix, a.profileId, a.profileId, a.prix, a.profileId],
  }
}

/**
 * Une dorure à la poussière, une seule instruction, sous le solde, sans partie
 * qui attende, et sous un cadre pas encore doré. Une œuvre de départ n'a pas
 * toujours de ligne — elle est à tous par règle : la sienne naît ici, d'origine
 * `depart`, ou prend sa dorure si un cartel la lui a déjà donnée. Toute autre
 * œuvre à lui a sa ligne, qui garde son origine et son prix : rien ne s'y
 * efface.
 */
export function instructionDeLaDorure(d: DepenseAEcrire & { deDepart: boolean }): InStatement {
  if (d.deDepart) {
    return {
      sql: `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, doree_le, dorure, prix_dorure)
            SELECT ?, ?, 'depart', ?, ?, 'poussiere', ? WHERE ${SOLDE} >= ? AND ${SANS_PARTIE}
            ON CONFLICT (profile_id, oeuvre) DO UPDATE SET doree_le = excluded.doree_le, dorure = excluded.dorure, prix_dorure = excluded.prix_dorure
             WHERE cabinet_oeuvres.doree_le IS NULL`,
      args: [d.profileId, d.oeuvre, d.t, d.t, d.prix, d.profileId, d.profileId, d.prix, d.profileId],
    }
  }
  return {
    sql: `UPDATE cabinet_oeuvres SET doree_le = ?, dorure = 'poussiere', prix_dorure = ?
           WHERE profile_id = ? AND oeuvre = ? AND doree_le IS NULL AND ${SOLDE} >= ? AND ${SANS_PARTIE}`,
    args: [d.t, d.prix, d.profileId, d.oeuvre, d.profileId, d.profileId, d.prix, d.profileId],
  }
}

// ── L'échange d'un jeu de la visite ───────────────────────────────────────

export interface EchangeAEcrire {
  profileId: string
  t: number
  /** Le jour de Paris, et son minuit : la visite figée y vit, les parties du jour s'y recomptent. */
  jour: string
  minuit: number
  /** Les visites que la ligne garde, celle du jour en tête, telle qu'avant l'échange (`visitesAGarder`) : elle s'y fige si elle ne l'est pas. */
  visites: string
  case: number
  /** Le jeu que la case avait, et celui qu'elle prend (`jeuDeLEchange`). */
  avant: string
  jeu: string
}

/**
 * L'échange d'un jeu de la visite (« Changer pour … », une fois par jour, une
 * case pas encore jouée), d'un seul aller-retour — deux instructions :
 *
 * 1. la visite du jour se fige, si aucun lot ne l'a encore fait : la ligne
 *    du profil naît au besoin ;
 * 2. la case prend son jeu neuf, sous la base même : la visite figée est
 *    celle du jour, pas encore échangée, la case a toujours le jeu qu'on lui
 *    connaît et le jeu neuf n'y est pas déjà, et aucune partie n'a commencé
 *    sur elle aujourd'hui — l'autre serveur d'une mise en ligne, ou un autre
 *    onglet, a pu la jouer ou l'échanger l'instant d'avant.
 *
 * `rowsAffected` de la seconde dit si l'échange a eu lieu ; sinon le magasin
 * relit, et dit pourquoi en mots.
 */
export function lotDeLEchange(e: EchangeAEcrire): InStatement[] {
  const chemin = `$[0].cases[${e.case}].jeu`
  return [
    {
      sql: `INSERT INTO cabinet_profils (profile_id, visites, cree_le, maj_le) VALUES (?1, ?2, ?3, ?3)
            ON CONFLICT (profile_id) DO UPDATE SET
              visites = CASE WHEN json_valid(visites) AND json_extract(visites, '$[0].jour') = ?4 THEN visites ELSE ?2 END`,
      args: [e.profileId, e.visites, e.t, e.jour],
    },
    {
      sql: `UPDATE cabinet_profils SET visites = json_set(visites, ?2, ?3, '$[0].echange', ?4), maj_le = ?5
             WHERE profile_id = ?1 AND json_valid(visites) AND json_extract(visites, '$[0].jour') = ?6
               AND json_extract(visites, '$[0].echange') IS NULL
               AND json_extract(visites, ?2) = ?8
               AND NOT EXISTS (SELECT 1 FROM json_each(visites, '$[0].cases') WHERE json_extract(value, '$.jeu') = ?3)
               AND (SELECT COUNT(*) FROM campagne_series
                     WHERE ${partiesDuJour('?1', '?7')} AND ${champDuDepart('origine')} = 'visite' AND ${champDuDepart('visite')} = ?4) = 0`,
      args: [e.profileId, chemin, e.jeu, e.case, e.t, e.jour, e.minuit, e.avant],
    },
  ]
}

// ── La suppression d'un profil ────────────────────────────────────────────

/**
 * Ce que la suppression d'un profil efface du Cabinet, **avant** que la
 * campagne efface ses séries : ses gestes, par la sous-requête de ses parties
 * — la table n'a pas de `profile_id`, comme `expedition_gestes` —, puis ses
 * reflets, ses œuvres et son record de la tour.
 */
export function lotDeLOubli(profileId: string): InStatement[] {
  return [
    { sql: 'DELETE FROM cabinet_gestes WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
    { sql: 'DELETE FROM cabinet_profils WHERE profile_id = ?', args: [profileId] },
    { sql: 'DELETE FROM cabinet_oeuvres WHERE profile_id = ?', args: [profileId] },
    { sql: 'DELETE FROM cabinet_records WHERE profile_id = ?', args: [profileId] },
  ]
}
