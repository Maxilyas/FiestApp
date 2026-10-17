// Des duels classés écrits au journal, pour les scripts de rendu : de quoi
// mener un profil jusqu'à sa ligue et sertir les crans de sa bordure, tels
// que `releverLesDuels` les relira. Ce n'est pas un test. Contre quelqu'un —
// un adversaire sans profil, qu'aucun classement ne nomme —, à la cote figée
// de son score : au dé, à chances égales depuis le 16 octobre 2026, chaque
// victoire vaut autant, et l'argent ne se sertissait plus.
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { VIES } from '../../shared/campagne'
import { LIGUES, coteDuScore, ligueDe, releverLesDuels, type CleDeLigue, type DuelJoue } from '../../shared/duels'

type Duel = { justes: number; sesJustes: number }

/**
 * Un duel tel que le journal le relira : contre la cote figée de son score, lancé par l'autre (`ecrireDesDuels`) —
 * la part du lanceur ferait sortir de l'argent avant ses douze crans.
 */
const commeAuJournal = (d: Duel, i: number): DuelJoue => ({ serie: String(i).padStart(4, '0'), finiLe: i, ...d, coteAdverse: coteDuScore(d.sesJustes) })

/**
 * Des duels qui mènent à sa ligue, puis `crans` victoires de plus dedans :
 * gagnés contre de gros scores pour monter, contre de petits pour y rester.
 */
export function duelsJusqua(ligue: CleDeLigue, crans: number): Duel[] {
  const duels: Duel[] = []
  const releveAvec = (encore: Duel[] = []) => releverLesDuels([...duels, ...encore].map(commeAuJournal), () => 's')
  const cible = LIGUES.findIndex(l => l.cle === ligue)
  while (LIGUES.indexOf(ligueDe(releveAvec().cote)) < cible) duels.push({ justes: 20, sesJustes: 19 })
  const ici = () => releveAvec().bordures.find(b => b.ligue === ligue)?.crans ?? 0
  for (let garde = 0; ici() < crans && garde < 200; garde++) {
    // La victoire la plus douce qui le garde dans sa ligue : contre le plus petit score d'abord. Sous l'Or, chaque duel
    // rapporte sa participation : cent points d'argent ne tiennent douze victoires que contre lui — contre huit
    // bonnes réponses d'abord, l'argent ne gardait que six crans, et le profil filait jusqu'en diamant.
    const doux: Duel[] = [
      { justes: 3, sesJustes: 0 },
      { justes: 9, sesJustes: 8 },
    ]
    duels.push(doux.find(d => ligueDe(releveAvec([d]).cote).cle === ligue) ?? doux[0])
  }
  return duels
}

/**
 * Les écrit au journal de ce profil, une toutes les vingt minutes jusqu'à
 * maintenant : chacun lancé par l'autre, à sa cote figée, et joué des deux
 * côtés — lui en second.
 */
export function ecrireDesDuels(db: Database.Database, profileId: string, ligue: CleDeLigue, crans: number, maintenant = Date.now()) {
  const duels = duelsJusqua(ligue, crans)
  const enFace = randomUUID()
  const lancer = db.prepare(`INSERT INTO campagne_duels (code, auteur, questions, cree_le, ferme_le, adversaire, cote_auteur) VALUES (?, ?, '[]', ?, ?, ?, ?)`)
  const jouer = db.prepare(
    `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, duel)
     VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'duel', ?)`,
  )
  duels.forEach((d, i) => {
    const quand = maintenant - (duels.length - i) * 20 * 60_000
    const code = randomUUID()
    lancer.run(code, enFace, quand - 180_000, quand + 7 * 24 * 3_600_000, profileId, coteDuScore(d.sesJustes))
    jouer.run(randomUUID(), enFace, d.sesJustes + VIES, d.sesJustes, quand - 180_000, quand - 60_000, code)
    jouer.run(randomUUID(), profileId, d.justes + VIES, d.justes, quand - 60_000, quand, code)
  })
}
