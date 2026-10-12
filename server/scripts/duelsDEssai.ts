// Des duels classés écrits au journal, pour les scripts de rendu : de quoi
// mener un profil jusqu'à sa ligue et sertir les crans de sa bordure, tels
// que `releverLesDuels` les relira. Ce n'est pas un test.
import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { VIES } from '../../shared/campagne'
import { LIGUES, ligueDe, releverLesDuels, type CleDeLigue, type DuelJoue } from '../../shared/duels'

type Duel = { justes: number; sesJustes: number }

/**
 * Des duels qui mènent à sa ligue, puis `crans` victoires de plus dedans :
 * gagnés contre de gros scores pour monter, contre de petits pour y rester.
 */
export function duelsJusqua(ligue: CleDeLigue, crans: number): Duel[] {
  const duels: Duel[] = []
  const releveAvec = (encore: Duel[] = []) =>
    releverLesDuels([...duels, ...encore].map((d, i): DuelJoue => ({ serie: String(i).padStart(4, '0'), finiLe: i, ...d })), () => 's')
  const cible = LIGUES.findIndex(l => l.cle === ligue)
  while (LIGUES.indexOf(ligueDe(releveAvec().cote)) < cible) duels.push({ justes: 20, sesJustes: 19 })
  const ici = () => releveAvec().bordures.find(b => b.ligue === ligue)?.crans ?? 0
  for (let garde = 0; ici() < crans && garde < 200; garde++) {
    // La victoire la plus douce qui le garde dans sa ligue : contre un petit score, puis un plus petit encore.
    const doux: Duel[] = [
      { justes: 9, sesJustes: 8 },
      { justes: 3, sesJustes: 0 },
    ]
    duels.push(doux.find(d => ligueDe(releveAvec([d]).cote).cle === ligue) ?? doux[1])
  }
  return duels
}

/** Les écrit au journal des rencontres de ce profil, une toutes les vingt minutes jusqu'à maintenant. */
export function ecrireDesDuels(db: Database.Database, profileId: string, ligue: CleDeLigue, crans: number, maintenant = Date.now()) {
  const duels = duelsJusqua(ligue, crans)
  const inserer = db.prepare(
    `INSERT INTO campagne_series (id, profile_id, questions, position, vies, justes, commencee_le, finie_le, mode, adversaire)
     VALUES (?, ?, '[]', ?, 0, ?, ?, ?, 'rencontre', ?)`,
  )
  duels.forEach((d, i) => {
    const quand = maintenant - (duels.length - i) * 20 * 60_000
    const adversaire = { serie: randomUUID(), profil: randomUUID(), reponses: [...Array(d.sesJustes).fill(true), ...Array(VIES).fill(false)] }
    inserer.run(randomUUID(), profileId, d.justes + VIES, d.justes, quand - 60_000, quand, JSON.stringify(adversaire))
  })
}
