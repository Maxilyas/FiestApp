// UN PROTOTYPE DE MESURE, pas la correction : il remplace à chaud trois
// méthodes pour chiffrer le gain des pistes 1 et 2 du rapport, sans toucher au
// dépôt. Importé avant le serveur (`PROTOTYPE=1`, ou `--import` pour un
// processus enfant).
//
//  1. `ProfileStore.byIds` : les profils manquants d'un classement chargés par
//     paquets — un SELECT des profils, un des Éclats, un des récompenses —
//     au lieu de trois allers-retours par profil, huit à la fois.
//  2. `JourStore.joueursDu` : un jour clos (≤ `closJusqua`) ne se relit plus à
//     chaque réponse du jour ; une lecture en vol sert aussi l'appel parallèle
//     (`vainqueursDe` et `sonJour` demandent la veille en même temps). La vraie
//     correction tient une révision PAR JOUR (voir le rapport) ; ce raccourci
//     suffit à mesurer.
//  3. `JourStore.classementDuMois` : les profils par `byIds`.
//  4. `JourStore.joursJoues` (la page du profil) : la place de chacun de ses
//     trente derniers jours lue dans les classements gardés (piste 3), chargés
//     d'une requête pour les jours qui manquent — le rang toujours par
//     `rangDansLesTries` (invariant 15).
import { ProfileStore, type ProfileRec } from '../../../server/src/auth/profiles'
import { JourStore } from '../../../server/src/core/jour'
import { moisDe, jourDe, medailleDe } from '../../../shared/jour'
import { rangDansLesTries } from '../../../shared/classement'

/** Assez de jours gardés pour « ses trente derniers jours ». */
const JOURS_GARDES = 40

const PAQUET = 400

;(ProfileStore.prototype as any).byIds = async function (this: any, ids: readonly string[]): Promise<Map<string, ProfileRec>> {
  const manquants = [...new Set(ids)].filter(id => !this.profiles.has(id))
  for (let i = 0; i < manquants.length; i += PAQUET) {
    const paquet = manquants.slice(i, i + PAQUET)
    const marques = paquet.map(() => '?').join(', ')
    const [lignes, eclats] = await this.client.batch(
      [
        { sql: `SELECT * FROM profiles WHERE id IN (${marques})`, args: paquet },
        { sql: `SELECT profile_id, avatar FROM profile_eclats WHERE profile_id IN (${marques})`, args: paquet },
      ],
      'read',
    )
    const parProfil = new Map<string, Set<string>>(paquet.map(id => [id, new Set<string>()]))
    for (const r of eclats.rows) parProfil.get(String(r.profile_id))?.add(String(r.avatar))
    for (const [id, s] of parProfil) if (!this.eclats.has(id)) this.eclats.set(id, s)
    await this.recompterRecompenses(paquet)
    // `remember` trouve les Éclats en mémoire : il ne relit plus rien.
    for (const row of lignes.rows) await this.remember(row)
  }
  const rendus = new Map<string, ProfileRec>()
  for (const id of ids) {
    const p = this.profiles.get(id)
    if (p && !p.disabledAt) rendus.set(id, p)
  }
  return rendus
}

const enVol = new Map<string, Promise<unknown[]>>()

;(JourStore.prototype as any).joueursDu = async function (this: any, jour: string, pour: string | null) {
  const garde = this.classementsGardes.get(jour)
  const fige = jour <= this.closJusqua
  let tous = garde && (garde.revision === this.revision || (fige && garde.fige)) ? garde.joueurs : null
  if (!tous) {
    const revision = this.revision
    const cle = `${jour}|${revision}`
    let lecture = enVol.get(cle)
    if (!lecture) {
      lecture = (async () => {
        const res = await this.client.execute({ sql: 'SELECT profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour = ?', args: [jour] })
        const profils: Map<string, ProfileRec> = await this.deps.profiles.byIds(res.rows.map((r: any) => String(r.profile_id)))
        const lus: unknown[] = []
        for (const r of res.rows as any[]) {
          const profil = profils.get(String(r.profile_id))
          if (profil) lus.push({ profil, points: Number(r.points), enCours: r.finie_le == null, commenceeLe: Number(r.commencee_le) })
        }
        return lus
      })().finally(() => enVol.delete(cle))
      enVol.set(cle, lecture)
    }
    tous = await lecture
    // La révision relue APRÈS : une écriture arrivée pendant la lecture ne la
    // laisse pas passer pour fraîche (jour-regles-2, concurrence-3).
    if (this.revision === revision || fige) this.classementsGardes.set(jour, { revision, joueurs: tous, fige })
    if (this.classementsGardes.size > JOURS_GARDES) this.classementsGardes.delete(this.classementsGardes.keys().next().value)
  }
  return (tous as any[]).filter(j => !this.masques.has(j.profil.id) || j.profil.id === pour)
}

;(JourStore.prototype as any).classementDuMois = async function (this: any, mois: string, pour: string | null) {
  const res = await this.client.execute({
    sql: `SELECT profile_id, SUM(points) AS points, MIN(commencee_le) AS commencee_le FROM jour_parties
          WHERE jour >= ? AND jour <= ? GROUP BY profile_id`,
    args: [`${mois}-01`, `${mois}-31`],
  })
  const profils: Map<string, ProfileRec> = await this.deps.profiles.byIds(res.rows.map((r: any) => String(r.profile_id)))
  const joueurs: unknown[] = []
  for (const r of res.rows as any[]) {
    const profil = profils.get(String(r.profile_id))
    if (!profil || (this.masques.has(profil.id) && profil.id !== pour)) continue
    joueurs.push({ profil, points: Number(r.points), enCours: false, commenceeLe: Number(r.commencee_le) })
  }
  return { ...this.lignes(joueurs, mois, pour), fige: moisDe(jourDe(this.maintenant())) > mois }
}

/** Les jours qui ne sont pas gardés, lus d'une seule requête, et gardés. */
async function chargerJours(this: any, jours: readonly string[]) {
  const manquants = jours.filter(j => {
    const g = this.classementsGardes.get(j)
    return !(g && (g.revision === this.revision || (j <= this.closJusqua && g.fige)))
  })
  if (manquants.length === 0) return
  const revision = this.revision
  const res = await this.client.execute({
    sql: `SELECT jour, profile_id, points, finie_le, commencee_le FROM jour_parties WHERE jour IN (${manquants.map(() => '?').join(', ')})`,
    args: [...manquants],
  })
  const profils: Map<string, ProfileRec> = await this.deps.profiles.byIds(res.rows.map((r: any) => String(r.profile_id)))
  const parJour = new Map<string, unknown[]>(manquants.map(j => [j, []]))
  for (const r of res.rows as any[]) {
    const profil = profils.get(String(r.profile_id))
    if (profil) parJour.get(String(r.jour))!.push({ profil, points: Number(r.points), enCours: r.finie_le == null, commenceeLe: Number(r.commencee_le) })
  }
  for (const [j, joueurs] of parJour) {
    const fige = j <= this.closJusqua
    if (this.revision === revision || fige) this.classementsGardes.set(j, { revision, joueurs, fige })
  }
  while (this.classementsGardes.size > JOURS_GARDES) this.classementsGardes.delete(this.classementsGardes.keys().next().value)
}

;(JourStore.prototype as any).joursJoues = async function (this: any, profileId: string, recents: any[], podiumDe: ReadonlyMap<string, number>) {
  if (recents.length === 0) return []
  const jours = recents.map(p => p.jour)
  const [reponses] = await Promise.all([
    this.client.execute({
      sql: `SELECT jour, question, ms FROM jour_reponses WHERE profile_id = ? AND juste = 1 AND jour IN (${jours.map(() => '?').join(', ')})`,
      args: [profileId, ...jours],
    }),
    chargerJours.call(this, jours),
  ])
  const annuleesDu = new Map(recents.map(p => [p.jour, p.annulees]))
  const tempsDu = new Map<string, number>()
  for (const r of reponses.rows as any[]) {
    const jour = String(r.jour)
    if (annuleesDu.get(jour)?.includes(Number(r.question))) continue
    tempsDu.set(jour, (tempsDu.get(jour) ?? 0) + Number(r.ms ?? 0))
  }
  const resultats = []
  for (const p of recents) {
    const salle: any[] = await this.joueursDu(p.jour, profileId)
    const tries = salle.map(j => j.points).sort((a: number, b: number) => b - a)
    resultats.push({
      jour: p.jour,
      points: p.points,
      rang: rangDansLesTries(p.points, tries.length ? tries : [p.points]),
      joueurs: Math.max(1, tries.length),
      xp: p.xp + (podiumDe.get(p.jour) ?? 0),
      medaille: medailleDe(p.justes, p.comptees),
      comptees: p.comptees,
      justes: p.justes,
      tempsJustesMs: tempsDu.get(p.jour) ?? 0,
    })
  }
  return resultats
}

console.log('[prototype] byIds, joueursDu, classementDuMois et joursJoues remplacés pour la mesure')
