import type { ArchiveStore } from './archive'
import { recapOfArchive } from './archive'
import type { PlayerRec } from './party'
import { buildProgress } from './progress'
import { hautsFaitsDeSoiree, xpDesHautsFaits } from './hautsfaits'
import { divinsDeSoiree, laureatsDivins } from './divins'
import { LIGNE_PALIERS, cleDeSoiree, decodeDetail, revaloriser, type PrixDeSoiree, type ProfileStore } from '../auth/profiles'
import { hautFaitDeSoiree } from '../../../shared/hautsfaits'
import type { PartyArchive } from '../../../shared/archive'

/**
 * Ce qu'une soirée archivée rapporte à ses profils, relu avec les règles du
 * jour : l'expérience de la soirée entière (clôture comprise), et les
 * récompenses à ranger — prix du palmarès, hauts faits et Divins. La même
 * lecture que la clôture d'une soirée en cours
 * (`SpaceRuntime.creditDeCloture`), sur les journaux que l'archive a gardés.
 */
export function creditDArchive(archive: PartyArchive) {
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
  const gains = buildProgress(live, { cloture: true, hautsFaits: xpDesFaits })
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
  laureats.push(...laureatsDivins(divinsDeSoiree(live), profilDuJoueur))
  return { gains, laureats }
}

/**
 * Combien de soirées — puis de profils — se relisent de front. Assez pour
 * que la latence de la base distante ne s'additionne plus d'une soirée à
 * l'autre ; pas assez pour noyer Turso, ni la mémoire, sous des archives de
 * plusieurs Mo téléchargées ensemble.
 */
const EN_PARALLELE = 4

/** Traite chaque élément, jamais plus de `n` à la fois. */
async function enParallele<T>(elements: T[], n: number, traiter: (e: T) => Promise<void>): Promise<void> {
  let suivant = 0
  const ouvrier = async () => {
    while (suivant < elements.length) await traiter(elements[suivant++])
  }
  await Promise.all(Array.from({ length: Math.min(n, elements.length) }, ouvrier))
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
 * ou une soirée retirée — ne peut pas se recalculer. Écrite par l'ancien
 * barème, elle est revalorisée sur ce que son relevé dit encore (réponses,
 * bonnes réponses) ; écrite par un barème au mérite d'une version d'avant,
 * elle garde son gain sous la version du jour. La soirée en cours se
 * recrédite exactement à son prochain quiz.
 *
 * Au bout du compte, plus aucune ligne n'est d'une version d'avant : c'est
 * ce qui empêche de tout relire au démarrage suivant.
 *
 * Ne fait rien quand tout est déjà au barème du jour : c'est ce qui le rend
 * sûr à chaque démarrage. Rend ce qu'il a fait, ou null.
 *
 * Il passe avant l'ouverture du port, et y reste : une soirée en cours qui
 * créditerait un quiz, ou une clôture qui déciderait d'un palier, pendant
 * que la carrière d'un profil n'est relue qu'à moitié, écrirait sur une
 * valeur fausse — et un palier décerné ne se reprend pas. Il se fait donc
 * vite plutôt que tard : un lot par soirée au lieu de deux requêtes par
 * profil, et quatre soirées de front (68 s → quelques secondes pour 101
 * soirées, à 20 ms de latence). Deux soirées menées de front écrivent des
 * lignes distinctes (une par profil et par soirée) et recalculent chaque
 * total par une somme en base : l'ordre d'arrivée n'y change rien.
 */
export async function recalculerHistorique(deps: {
  profiles: ProfileStore
  archives: ArchiveStore
  /** Les soirées en cours, dans tous les espaces (`cleDeSoiree`) : elles n'ont pas fini de se jouer. */
  enCours: ReadonlySet<string>
}): Promise<{ soirees: number; lignes: number; profils: number } | null> {
  const { profiles, archives, enCours } = deps
  const { lignes, anciensBadges } = await profiles.aRecalculer()
  if (lignes.length === 0 && anciensBadges === 0) return null

  // Les soirées rangées, relues une à une avec les règles du jour.
  const recalculees = new Set<string>()
  /** Les profils recrédités de chaque soirée relue. */
  const credites = new Set<string>()
  const touches = new Set<string>()
  const soirees = (await archives.toutes()).filter(({ spaceId, id }) => !enCours.has(cleDeSoiree(spaceId, id)))
  await enParallele(soirees, EN_PARALLELE, async ({ spaceId, id }) => {
    const trouvee = await archives.get(spaceId, id).catch(e => {
      console.error(`[recalcul] soirée « ${id} » illisible :`, e)
      return null
    })
    if (!trouvee) return
    const { gains, laureats } = creditDArchive(trouvee.archive)
    await profiles.crediterSoireeEntiere(id, spaceId, gains)
    for (const g of gains) {
      touches.add(g.profileId)
      credites.add(`${g.profileId}#${spaceId}#${id}`)
    }
    await profiles.remplacerRecompensesDeSoiree(id, spaceId, laureats)
    recalculees.add(`${spaceId}#${id}`)
  })

  // Les lignes d'une version d'avant que la relecture n'a pas réécrites.
  let revalorisees = 0
  const paliers = new Set<string>()
  for (const l of lignes) {
    if (l.soireeId === LIGNE_PALIERS) {
      paliers.add(l.profileId)
      continue
    }
    // Réécrite par la relecture de sa soirée.
    if (credites.has(`${l.profileId}#${l.spaceId}#${l.soireeId}`)) continue
    // Sinon, rien ne la relit : sa soirée n'est pas dans l'historique, ou son
    // archive ne sait pas que ce profil y jouait. Elle garde ce qu'elle peut
    // — jamais effacée : une archive d'avant les profils ne les nomme pas.
    const { v, releve } = decodeDetail(l.detail)
    if (v >= 2) {
      await profiles.remettreAuBareme(l.profileId, l.soireeId)
      continue
    }
    const { gain, xp } = revaloriser(releve)
    await profiles.creditSoiree({ profileId: l.profileId, soireeId: l.soireeId, spaceId: l.spaceId, gain, releve, xp })
    touches.add(l.profileId)
    revalorisees++
  }

  // L'ancien catalogue de carrière laisse place aux paliers, qui se
  // décernent sur la carrière recalculée — sous le nom de la dernière soirée
  // jouée, celle qui les aurait fait tomber.
  for (const id of await profiles.oublierAnciensBadgesDeCarriere()) touches.add(id)
  // Les soirées menées de front ont pu laisser en mémoire un total ou une
  // étagère arrivés dans le désordre : on relit ce que la base dit, avant
  // d'y juger les paliers.
  await profiles.relireProfils([...touches])
  // Chaque profil a ses paliers à lui : ils se jugent de front, eux aussi.
  await enParallele([...touches], EN_PARALLELE, async id => {
    // La dernière soirée CLOSE : sa plus récente ligne peut être celle d'un
    // essai qui se joue encore ailleurs, et son effacement emporterait le
    // palier rangé sous son nom — un palier que les soirées closes, seules,
    // avaient fait tomber.
    const derniere = (await profiles.historiqueOf(id)).find(s => !enCours.has(cleDeSoiree(s.spaceId, s.soireeId)))
    if (derniere) await profiles.accorderPaliers(id, derniere.soireeId, derniere.spaceId, enCours)
  })
  // La ligne des paliers ne se réécrit qu'avec un palier neuf : sans palier
  // de plus, elle resterait d'une version d'avant.
  for (const id of paliers) await profiles.remettreAuBareme(id, LIGNE_PALIERS)
  return { soirees: recalculees.size, lignes: revalorisees, profils: touches.size }
}
