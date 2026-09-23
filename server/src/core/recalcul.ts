import type { ArchiveStore } from './archive'
import { recapOfArchive } from './archive'
import type { PlayerRec } from './party'
import { buildProgress } from './progress'
import { hautsFaitsDeSoiree, xpDesHautsFaits } from './hautsfaits'
import type { AuthStore } from '../auth/store'
import { decodeDetail, revaloriser, type PrixDeSoiree, type ProfileStore } from '../auth/profiles'
import { hautFaitDeSoiree } from '../../../shared/hautsfaits'
import type { PartyArchive } from '../../../shared/archive'

/**
 * Ce qu'une soirée archivée rapporte à ses profils, relu avec les règles du
 * jour : l'expérience de la soirée entière (clôture comprise), et les
 * récompenses à ranger — prix du palmarès et hauts faits. La même lecture que
 * la clôture d'une soirée en cours (`SpaceRuntime.creditDeCloture`), sur les
 * journaux que l'archive a gardés.
 */
export function creditDArchive(archive: PartyArchive, horsConcours: ReadonlySet<string>) {
  const players: PlayerRec[] = archive.players.map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    token: '',
    teamId: p.teamId,
    profileId: p.profileId ?? null,
    createdAt: p.createdAt,
  }))
  const live = { players, scores: archive.scores, answers: archive.answers }
  const faits = hautsFaitsDeSoiree(live)
  const xpDesFaits = new Map([...faits].map(([id, cles]) => [id, xpDesHautsFaits(cles)]))
  const gains = buildProgress(live, { cloture: true, horsConcours, hautsFaits: xpDesFaits })
  const profilDuJoueur = new Map(gains.map(g => [g.playerId, g.profileId]))
  const laureats: PrixDeSoiree[] = recapOfArchive(archive).stats.awards.flatMap(a => {
    const profileId = a.player && profilDuJoueur.get(a.player.playerId)
    return profileId ? [{ profileId, badge: a.key, emoji: a.emoji, title: a.title }] : []
  })
  for (const [playerId, cles] of faits) {
    const profileId = profilDuJoueur.get(playerId)
    if (!profileId) continue
    for (const cle of cles) {
      const h = hautFaitDeSoiree(cle)
      if (h) laureats.push({ profileId, badge: h.key, emoji: h.emoji, title: h.title })
    }
  }
  return { gains, laureats }
}

/**
 * Le recalcul de l'expérience et des hauts faits, depuis l'historique.
 *
 * L'expérience est une dérivation des journaux, comme le souvenir et le
 * bilan : quand le barème change, les soirées passées se relisent avec le
 * nouveau — c'est la promesse de l'invariant 14, tenue jusqu'au bout. Au
 * premier démarrage après le barème au mérite, chaque soirée de l'historique
 * est donc recréditée (clôture comprise), ses prix et ses hauts faits
 * rangés ; les anciens badges de carrière laissent place aux paliers ; et
 * chaque profil reçoit les paliers que sa carrière atteint.
 *
 * Une ligne dont la soirée n'est pas dans l'historique — la soirée en cours,
 * ou une soirée retirée — ne peut pas se recalculer : elle est revalorisée
 * sur ce que son relevé dit encore (réponses, bonnes réponses), et la soirée
 * en cours se recrédite exactement à son prochain quiz.
 *
 * Ne fait rien quand tout est déjà au barème du jour : c'est ce qui le rend
 * sûr à chaque démarrage. Rend ce qu'il a fait, ou null.
 */
export async function recalculerHistorique(deps: {
  profiles: ProfileStore
  archives: ArchiveStore
  auth: AuthStore
  /** Les soirées en cours, dans tous les espaces : elles n'ont pas fini de se jouer. */
  enCours: ReadonlySet<string>
}): Promise<{ soirees: number; lignes: number; profils: number } | null> {
  const { profiles, archives, auth, enCours } = deps
  const { lignes, anciensBadges } = await profiles.aRecalculer()
  if (lignes.length === 0 && anciensBadges === 0) return null

  // Les soirées rangées, relues une à une avec les règles du jour.
  const recalculees = new Set<string>()
  const touches = new Set<string>()
  for (const { spaceId, id } of await archives.toutes()) {
    if (enCours.has(id)) continue
    const trouvee = await archives.get(spaceId, id).catch(e => {
      console.error(`[recalcul] soirée « ${id} » illisible :`, e)
      return null
    })
    if (!trouvee) continue
    const lui = auth.byId(spaceId)?.profileId
    const { gains, laureats } = creditDArchive(trouvee.archive, new Set(lui ? [lui] : []))
    for (const g of gains) {
      await profiles.creditSoiree({
        profileId: g.profileId,
        soireeId: id,
        spaceId,
        gain: g.gain,
        releve: g.releve,
        xp: g.xp,
      })
      touches.add(g.profileId)
    }
    await profiles.remplacerRecompensesDeSoiree(id, spaceId, laureats)
    recalculees.add(`${spaceId}#${id}`)
  }

  // Les lignes que l'historique ne sait plus relire : revalorisées.
  let revalorisees = 0
  for (const l of lignes) {
    if (recalculees.has(`${l.spaceId}#${l.soireeId}`) || l.soireeId.startsWith('#')) continue
    const { v, releve } = decodeDetail(l.detail)
    if (v >= 2) continue
    const { gain, xp } = revaloriser(releve)
    await profiles.creditSoiree({ profileId: l.profileId, soireeId: l.soireeId, spaceId: l.spaceId, gain, releve, xp })
    touches.add(l.profileId)
    revalorisees++
  }

  // L'ancien catalogue de carrière laisse place aux paliers, qui se
  // décernent sur la carrière recalculée — sous le nom de la dernière soirée
  // jouée, celle qui les aurait fait tomber.
  for (const id of await profiles.oublierAnciensBadgesDeCarriere()) touches.add(id)
  for (const id of touches) {
    const [derniere] = await profiles.historiqueOf(id)
    if (derniere) await profiles.accorderPaliers(id, derniere.soireeId, derniere.spaceId)
  }
  return { soirees: recalculees.size, lignes: revalorisees, profils: touches.size }
}
