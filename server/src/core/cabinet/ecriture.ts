// Les lots d'écriture du Cabinet, chacun gardé par la base même (D9) : deux
// onglets, deux serveurs pendant une mise en ligne, une réponse HTTP perdue
// puis rejouée — rien ne compte deux fois. Un départ ne pose sa partie que si
// le profil n'en a aucune en cours et s'il a encore le droit du jour, recompté
// dans l'instruction même ; un geste s'insère à son rang avec un `uid` tiré par
// ce serveur pour ce lot (`ON CONFLICT DO NOTHING`), et chaque autre
// instruction n'agit que si ce geste-là est en base (`gesteEcrit`). Le geste
// est toujours la première instruction de son lot : la fin d'une partie se dit
// écrite sur sa ligne (`FinDUnePartie.ecrite`, la porte de la campagne).
//
// Le seul fichier qui écrit la colonne `joker` : elle porte le pouvoir qui a
// aidé une pièce (`pouvoir:eclairer`, `pouvoir:temps`), jamais la clé d'une
// carte-bonus — Bastion et Cuirasse sont aussi des cartes du second essai de
// l'Expédition, que le carnet lit (D6).
//
// Aucun `UPDATE` ni `DELETE` de `campagne_reponses`, aucun `DELETE` de
// `campagne_series` hors de la suppression d'un profil : les déclencheurs des
// tranches du journal les effaceraient toutes, et le réveil suivant relirait
// toute la base (`DECLENCHEURS_DES_TRANCHES`, règle `campagne.md`).
import type { InStatement } from '@libsql/client'
import { CHASSES_PAR_JOUR, LIBRES_QUI_PAIENT } from '../../../../shared/cabinet/bareme'
import type { BilanDUnePartie, DepartDUnePartie, GesteDuCabinet, PieceJugee } from '../../../../shared/cabinet/partie'
import type { CleDeSaison } from '../../../../shared/saisons'
import { champDuDepart, gesteEcrit, partiesDuJour } from './tables'

// ── Le départ ─────────────────────────────────────────────────────────────

export interface DepartAEcrire {
  profileId: string
  serie: string
  depart: DepartDUnePartie
  /** L'heure d'arrivée de la requête, prise avant le verrou : le zéro du chrono de la première manche. */
  t: number
  /** Le jour de Paris du départ, la veille, et minuit : la série et le recompte du jour s'y lisent. */
  jour: string
  veille: string
  minuit: number
  /** Les visites que `cabinet_profils.visites` garde, celle du jour en tête (`visitesAGarder`) : elle s'y fige si elle ne l'est pas. */
  visites: string
  /** Le geste qui ouvre la première manche ; null sous une carte de Miser, qui décide avant de voir. */
  ouverture: { geste: GesteDuCabinet; uid: string } | null
}

/**
 * Le lot du départ, d'un seul aller-retour (la conception, § 2.3). Trois
 * instructions, chacune sous la précédente :
 *
 * 1. la ligne du profil prend la partie — seulement s'il n'en a pas en cours,
 *    qu'il lui reste une chasse, ou que sa case de la visite n'est pas déjà
 *    commencée aujourd'hui, recomptés par la base même : la mémoire d'un
 *    serveur ne sait pas ce que l'autre vient d'écrire. La série compte le
 *    jour d'un départ en visite ou en chasse ; la visite du jour se fige au
 *    premier lot du jour qui écrit (D17). La première fois, la ligne naît ;
 * 2. la partie, seulement si la ligne la nomme — une partie libre parmi les
 *    cinq du jour qui paient, comptée là aussi (elle se relit par `RETURNING`) ;
 * 3. l'ouverture de la première manche, seulement si la partie est née.
 *
 * Rendu : la ligne du profil a-t-elle pris la partie (`rowsAffected` de la
 * première), et la partie est-elle née (une ligne rendue par la seconde).
 */
export function lotDuDepart(d: DepartAEcrire): InStatement[] {
  const compte = d.depart.origine === 'libre' ? 0 : 1
  const casDeLaSerie = `CASE WHEN ?3 = 0 OR serie_jour >= ?4 THEN serie WHEN serie_jour = ?5 THEN serie + 1 ELSE 1 END`
  // Ses parties du jour d'une origine, par l'index du profil et de la date ; le profil et minuit nommés par leur place.
  const duJour = (origine: string, profil: string, minuit: string) =>
    `SELECT COUNT(*) FROM campagne_series WHERE ${partiesDuJour(profil, minuit)} AND ${champDuDepart('origine')} = '${origine}'`
  const profil: InStatement = {
    sql: `INSERT INTO cabinet_profils (profile_id, partie, serie, serie_jour, serie_record, visites, cree_le, maj_le)
          VALUES (?1, ?2, ?3, CASE WHEN ?3 = 1 THEN ?4 END, ?3, ?6, ?7, ?7)
          ON CONFLICT (profile_id) DO UPDATE SET
            partie = excluded.partie,
            maj_le = excluded.maj_le,
            serie = ${casDeLaSerie},
            serie_jour = CASE WHEN ?3 = 0 THEN serie_jour ELSE MAX(COALESCE(serie_jour, ''), ?4) END,
            serie_record = MAX(serie_record, ${casDeLaSerie}),
            visites = CASE WHEN json_valid(visites) AND json_extract(visites, '$[0].jour') = ?4 THEN visites ELSE ?6 END
          WHERE cabinet_profils.partie IS NULL
            AND (?8 <> 'chasse' OR (${duJour('chasse', '?1', '?9')}) < ${CHASSES_PAR_JOUR})
            AND (?8 <> 'visite' OR (${duJour('visite', '?1', '?9')} AND ${champDuDepart('visite')} = ?10) = 0)`,
    args: [d.profileId, d.serie, compte, d.jour, d.veille, d.visites, d.t, d.depart.origine, d.minuit, d.depart.visite ?? -1],
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
      args: [d.serie, JSON.stringify(d.ouverture.geste), d.t, d.ouverture.uid, d.serie],
    })
  }
  return lot
}

// ── Un geste, ses pièces, sa fin ──────────────────────────────────────────

/** Ce qu'une fin écrit de plus : son bilan, la poussière au reflet, et l'œuvre qu'elle fait entrer, dorer ou garder en cartel. */
export interface FinAEcrire {
  profileId: string
  bilan: BilanDUnePartie
  /** L'œuvre, telle que la fin la touche ; rien pour une partie qui n'en change aucune. */
  oeuvre: OeuvreAEcrire | null
}

export interface OeuvreAEcrire {
  cle: string
  /** `partie` pour une œuvre gagnée, `depart` pour une œuvre de départ sans ligne qui prend un cartel ou un cadre ; une œuvre déjà là garde la sienne. */
  origine: 'partie' | 'depart'
  /** La fête du jour de sa fin, pour une œuvre gagnée en jouant (`calendrierDuCabinet`) ; jamais pour une dorure ni un cartel. */
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
  fin: FinAEcrire | null
}

/**
 * Le lot d'un geste (la conception, § 2.4 et § 2.6) : le geste à son rang
 * d'abord — `rowsAffected` dit tout —, puis, sous lui, chaque pièce jugée — sa
 * réponse, et la pièce au bout de la partie (`json_insert`, jamais réécrite
 * en entier) — et, au dernier geste, la fin : le bilan, la poussière au
 * reflet et la partie rendue, l'œuvre en une seule instruction pour le gain,
 * la dorure et le cartel. Une œuvre déjà là — achetée, rapportée — prend son
 * cartel et sa dorure sans changer d'origine ni de saison, et rien de ce
 * qu'elle avait ne s'efface (`COALESCE`).
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
  if (g.fin) {
    const { bilan, oeuvre, profileId } = g.fin
    lot.push(
      {
        sql: `UPDATE campagne_series SET finie_le = ?, issue = ?, bilan = ? WHERE id = ? AND finie_le IS NULL AND ${garde.sql}`,
        args: [g.faitLe, bilan.issue, JSON.stringify(bilan), g.serie, ...garde.args],
      },
      {
        sql: `UPDATE cabinet_profils SET poussiere = poussiere + ?, partie = NULL, maj_le = ? WHERE profile_id = ? AND partie = ? AND ${garde.sql}`,
        args: [bilan.poussiere, g.faitLe, profileId, g.serie, ...garde.args],
      },
    )
    if (oeuvre) {
      lot.push({
        sql: `INSERT INTO cabinet_oeuvres (profile_id, oeuvre, origine, gagnee_le, saison, serie_id, doree_le, dorure, serie_doree)
              SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${garde.sql}
              ON CONFLICT (profile_id, oeuvre) DO UPDATE SET
                serie_id = COALESCE(cabinet_oeuvres.serie_id, excluded.serie_id),
                doree_le = COALESCE(cabinet_oeuvres.doree_le, excluded.doree_le),
                dorure = COALESCE(cabinet_oeuvres.dorure, excluded.dorure),
                serie_doree = COALESCE(cabinet_oeuvres.serie_doree, excluded.serie_doree)`,
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

// ── La suppression d'un profil ────────────────────────────────────────────

/**
 * Ce que la suppression d'un profil efface du Cabinet, **avant** que la
 * campagne efface ses séries : ses gestes, par la sous-requête de ses parties
 * — la table n'a pas de `profile_id`, comme `expedition_gestes` —, puis ses
 * reflets et ses œuvres.
 */
export function lotDeLOubli(profileId: string): InStatement[] {
  return [
    { sql: 'DELETE FROM cabinet_gestes WHERE serie_id IN (SELECT id FROM campagne_series WHERE profile_id = ?)', args: [profileId] },
    { sql: 'DELETE FROM cabinet_profils WHERE profile_id = ?', args: [profileId] },
    { sql: 'DELETE FROM cabinet_oeuvres WHERE profile_id = ?', args: [profileId] },
  ]
}
