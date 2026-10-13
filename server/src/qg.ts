import type { Express } from 'express'
import type { DB } from './core/db'
import type { SpaceRegistry } from './core/space'
import type { IoServer } from './core/types'
import { estUnSalon, type AuthStore } from './auth/store'
import type { ProfileStore } from './auth/profiles'
import type { JourStore } from './core/jour'
import type { CampagneStore } from './core/campagne'
import type { ArchiveStore } from './core/archive'
import type { PartageStore } from './core/partages'
import type { RappelStore } from './core/rappels'
import type { PartyBackup } from './core/backup'
import { pouls, type Charge } from './core/pouls'
import type { JournalDesGestes } from './core/journalDesGestes'
import { wrap } from './core/http'
import { nomDeLEspace } from '../../shared/space'
import { tronquer } from '../../shared/avatars'
import {
  JOURS_DU_QG,
  SORTES_DE_GESTES,
  compteDuJour,
  etatDeLaSoiree,
  minuitsDeParis,
  modeDeLaSerie,
  participationsParJour,
  type DirectDuQg,
  type ModeDuQg,
  type SoireeDuQg,
  type SorteDeGeste,
  type VueDEnsemble,
} from '../../shared/qg'
import { jourDe } from '../../shared/jour'

export interface QgDeps {
  /** La base locale : le registre des soirées pas encore closes — la clôture la vide. */
  db: DB
  registry: SpaceRegistry
  io: IoServer
  auth: AuthStore
  profiles: ProfileStore
  jour: JourStore
  campagne: CampagneStore
  archives: ArchiveStore
  partages: PartageStore
  rappels: RappelStore
  backup: PartyBackup
  charge: Charge
  gestes: JournalDesGestes
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
  env: string
  version: string | null
}

/** Une soirée pas encore close, telle que la base locale la garde. */
interface LigneDeSoiree {
  space_id: string
  inscrits: number
  premier: number
  dernier: number
  /** Les parties dont une question a été jouée, séparées par des virgules. */
  parties: string | null
  /** Les invités qui ont joué au moins une question. */
  joueurs: number
  held_at: number | null
  soiree_id: string | null
}

/**
 * Les soirées pas encore closes, lues dans la base locale : la clôture et
 * l'essai effacé la vident, et une soirée qu'on n'a pas close y reste. Son
 * dernier signe de vie est la plus récente de ses arrivées, de ses réponses
 * et de ses parties qui avancent — ce que `soireesOuJeJoue` lit aussi.
 */
function lignesDesSoirees(db: DB): LigneDeSoiree[] {
  return db
    .prepare(
      `SELECT p.space_id AS space_id, COUNT(*) AS inscrits, MIN(p.created_at) AS premier,
         MAX(MAX(p.created_at),
             COALESCE((SELECT MAX(updated_at) FROM sessions s WHERE s.space_id = p.space_id), 0),
             COALESCE((SELECT MAX(created_at) FROM answer_log a WHERE a.space_id = p.space_id), 0)) AS dernier,
         (SELECT group_concat(DISTINCT session_id) FROM answer_log a WHERE a.space_id = p.space_id) AS parties,
         (SELECT COUNT(DISTINCT player_id) FROM answer_log a WHERE a.space_id = p.space_id) AS joueurs,
         (SELECT held_at FROM soiree WHERE space_id = p.space_id) AS held_at,
         (SELECT id FROM soiree WHERE space_id = p.space_id) AS soiree_id
       FROM players p WHERE p.space_id IS NOT NULL GROUP BY p.space_id`,
    )
    .all() as LigneDeSoiree[]
}

/** Les journaux qui grossissent chaque jour, tels que la vue d'ensemble les lit : qui, quand. */
interface Journaux {
  parties: { qui: string; quand: number }[]
  series: { qui: string; quand: number; mode: string | null }[]
  activite: { inscriptions: number[]; achats: number[]; soirees: { qui: string; quand: number }[] }
}

/** Ce que des journaux disent d'avant un instant. */
function avant(j: Journaux, minuit: number): Journaux {
  return {
    parties: j.parties.filter(e => e.quand < minuit),
    series: j.series.filter(e => e.quand < minuit),
    activite: {
      inscriptions: j.activite.inscriptions.filter(quand => quand < minuit),
      achats: j.activite.achats.filter(quand => quand < minuit),
      soirees: j.activite.soirees.filter(e => e.quand < minuit),
    },
  }
}

function boutABout(a: Journaux, b: Journaux): Journaux {
  return {
    parties: [...a.parties, ...b.parties],
    series: [...a.series, ...b.series],
    activite: {
      inscriptions: [...a.activite.inscriptions, ...b.activite.inscriptions],
      achats: [...a.activite.achats, ...b.activite.achats],
      soirees: [...a.activite.soirees, ...b.activite.soirees],
    },
  }
}

/**
 * Le QG de l'administrateur (`/admin`) : deux routes, sous `/api/admin` —
 * gardées d'un bloc (`api.ts`), elles entrent d'elles-mêmes dans
 * `admin-seulement.test.ts`.
 *
 * `/qg/direct` se lit en mémoire et dans la base locale, sans un aller-retour
 * vers Turso pour les soirées : la page le redemande toutes les dix secondes.
 * `/qg` lit la base permanente — trente jours de parties, de séries, de
 * soirées — : la page le redemande toutes les cinq minutes, et il ne relit
 * des jours finis que les soirées (`lesTrenteJours`).
 *
 * Des soirées des autres, rien que des chiffres : le salon, où elle en est,
 * combien d'invités. Ni le quiz, ni la question, ni un prénom d'invité (le
 * choix du 13 octobre 2026) — `qg.test.ts` relit la réponse entière.
 */
export function mountQg(app: Express, deps: QgDeps) {
  const direct = async (): Promise<DirectDuQg> => {
    const maintenant = deps.maintenant()
    const lignes = lignesDesSoirees(deps.db)
    const comptes = lignes.map(l => deps.auth.byId(l.space_id))
    const titulaires = await deps.profiles.byIds(comptes.flatMap(a => (a?.profileId ? [a.profileId] : [])))
    const parId = new Map(titulaires.flatMap(p => (p ? [[p.id, p] as const] : [])))
    const soirees: SoireeDuQg[] = lignes.map((l, i) => {
      const compte = comptes[i]
      const titulaire = compte?.profileId ? parId.get(compte.profileId) : undefined
      const runtime = deps.registry.peek(l.space_id)
      const jouees = (l.parties ?? '').split(',').filter(Boolean)
      const avancement = runtime?.engine.avancement() ?? null
      const active = runtime?.engine.activeSessionId ?? null
      return {
        spaceId: l.space_id,
        salon: {
          nom: compte ? nomDeLEspace({ salon: estUnSalon(compte), titulaire: titulaire ? { nom: titulaire.name } : null, name: compte.name }) : 'Un espace supprimé',
          avatar: titulaire?.avatar ?? null,
        },
        etat: etatDeLaSoiree(l.dernier, maintenant),
        inscrits: l.inscrits,
        connectes: runtime ? runtime.party.connectedPlayerIds().length : 0,
        depuis: l.held_at ?? l.premier,
        dernierSigne: l.dernier,
        quizJoues: jouees.length,
        partie: avancement ? { ...avancement, quiz: jouees.filter(id => id !== active).length + 1 } : null,
        ecran: (deps.io.sockets.adapter.rooms.get(`hosts:${l.space_id}`)?.size ?? 0) > 0,
        sauvegardeEnRetard: deps.backup.enRetardPour(l.space_id),
      }
    })
    // Les soirées vivantes d'abord, la plus récente en tête ; celles laissées en plan derrière.
    soirees.sort((a, b) => (a.etat === b.etat ? b.dernierSigne - a.dernierSigne : a.etat === 'en-cours' ? -1 : 1))

    let memoireMo: number | null = null
    try {
      memoireMo = Math.round(process.memoryUsage().rss / 1024 / 1024)
    } catch {
      // Sous `ulimit -n 64`, la mesure lève EMFILE : le QG s'en passe, comme `/healthz`.
    }
    const base = pouls.base.lireAvecMediane()
    const sante = deps.backup.sante()
    const charge = deps.charge.lire()
    return {
      maintenant,
      soirees,
      invitesConnectes: deps.registry.all().reduce((n, rt) => n + rt.party.connectedPlayerIds().length, 0),
      profilsEnLigne: deps.profiles.combienEnLigne(),
      miroir: { enAttente: sante.enAttente, echecsConsecutifs: sante.echecsConsecutifs, enEchecDepuis: sante.enEchecDepuis, espacesEnRetard: sante.espacesEnRetard },
      serveur: {
        env: deps.env,
        version: deps.version,
        enMarcheDepuisS: Math.round(process.uptime()),
        memoireMo,
        cpuPct: charge.cpuPct,
        bouclePct: charge.boucleOccupeePct,
        baseP95Ms: base.n > 0 ? Math.round(base.p95) : null,
        connexions: deps.io.engine.clientsCount,
      },
    }
  }

  const lireLesJournaux = async (depuis: number): Promise<Journaux> => {
    const [parties, series, activite] = await Promise.all([
      deps.jour.partiesDepuis(depuis),
      deps.campagne.seriesDepuis(depuis),
      deps.profiles.activiteDepuis(depuis),
    ])
    return { parties, series, activite }
  }

  // Les jours finis ne bougent plus : lus une fois par jour, gardés jusqu'au
  // minuit suivant, et seul aujourd'hui se relit. La page redemande la vue
  // toutes les cinq minutes, et un QG reste ouvert sur un écran toute la
  // journée : trente jours de séries relus à chaque fois coûtaient au quota
  // de Turso ce qu'elle ne montrait pas de neuf. Un profil supprimé
  // aujourd'hui compte donc dans les jours d'avant jusqu'à demain. Les
  // soirées, elles, se relisent toujours : une soirée d'hier close ce matin
  // passe de la base locale aux archives, et ne doit pas disparaître.
  let gardes: { minuit: number; depuis: number; journaux: Journaux } | null = null
  const lesTrenteJours = async (minuits: readonly number[]): Promise<Journaux> => {
    const minuit = minuits[minuits.length - 1]
    const depuis = minuits[0]
    const dejaLus = gardes?.minuit === minuit && gardes.depuis === depuis ? gardes.journaux : null
    const [jusquHier, aujourdhui] = await Promise.all([
      dejaLus ??
        lireLesJournaux(depuis).then(lus => {
          const journaux = avant(lus, minuit)
          gardes = { minuit, depuis, journaux }
          return journaux
        }),
      lireLesJournaux(minuit),
    ])
    return boutABout(jusquHier, aujourdhui)
  }

  const vueDEnsemble = async (): Promise<VueDEnsemble> => {
    const maintenant = deps.maintenant()
    const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
    const depuis = minuits[0]
    const [{ parties, series, activite }, rangees, reserve, signalementsDuJour, signalementsDeLaCampagne, aRelire] = await Promise.all([
      lesTrenteJours(minuits),
      deps.archives.joueursDepuis(depuis),
      deps.jour.avanceDeLaReserve(),
      deps.jour.signalementsATraiter(),
      deps.campagne.signalementsATraiter(),
      deps.partages.catalogue('propose'),
    ])

    const solo: { quand: number; qui: string; mode: Exclude<ModeDuQg, 'soiree'> }[] = [
      ...parties.map(p => ({ ...p, mode: 'jour' as const })),
      ...series.map(s => ({ quand: s.quand, qui: s.qui, mode: modeDeLaSerie(s.mode) })),
    ]
    // Une soirée se range après chaque quiz : celle qui se joue encore a déjà
    // sa fiche, un quiz en retard. Elle compte ceux qui ont joué depuis.
    const soirees = new Map(rangees.map(r => [`${r.spaceId}|${r.id}`, { quand: r.quand, joueurs: r.joueurs }]))
    for (const l of lignesDesSoirees(deps.db)) {
      if (l.held_at === null || l.soiree_id === null || l.held_at < depuis) continue
      const cle = `${l.space_id}|${l.soiree_id}`
      const rangee = soirees.get(cle)
      soirees.set(cle, { quand: l.held_at, joueurs: Math.max(rangee?.joueurs ?? 0, l.joueurs) })
    }

    const campagne = series.filter(s => modeDeLaSerie(s.mode) === 'campagne')
    const duels = series.filter(s => modeDeLaSerie(s.mode) === 'duel')
    const bilan = deps.rappels.bilan()
    return {
      maintenant,
      jour: jourDe(maintenant),
      aujourdhui: {
        profilsActifs: compteDuJour([...solo, ...activite.soirees], minuits, maintenant, { distincts: true }),
        partiesDuJour: compteDuJour(parties, minuits, maintenant),
        seriesDeCampagne: compteDuJour(campagne, minuits, maintenant),
        duels: compteDuJour(duels, minuits, maintenant),
        nouveauxProfils: compteDuJour(activite.inscriptions.map(quand => ({ quand })), minuits, maintenant),
        achats: compteDuJour(activite.achats.map(quand => ({ quand })), minuits, maintenant),
      },
      participations: participationsParJour(solo, [...soirees.values()], minuits, maintenant),
      aTraiter: {
        reserve: { joursDAvance: reserve.joursDAvance },
        signalementsDuJour,
        signalementsDeLaCampagne,
        catalogue: aRelire.length,
        rappel: bilan && { jour: bilan.jour, envoyes: bilan.envoyes, echecs: bilan.echecs },
        routine: { jour: reserve.dernierDepotIa, campagne: deps.campagne.santeDeLaBase().dernierApport },
      },
    }
  }

  app.get(
    '/api/admin/qg/direct',
    wrap(async (_req, res) => {
      res.json(await direct())
    }),
  )
  app.get(
    '/api/admin/qg',
    wrap(async (_req, res) => {
      res.json(await vueDEnsemble())
    }),
  )
  // Le journal des gestes, une page à la fois : par sorte (`?sorte=profil`),
  // par ce qu'il visait (`?cible=`, la fiche d'un joueur), à partir du curseur
  // que la page d'avant a rendu (`?suite=`).
  app.get(
    '/api/admin/gestes',
    wrap(async (req, res) => {
      const { sorte, cible, suite } = req.query
      res.json(
        await deps.gestes.lire({
          sorte: typeof sorte === 'string' && (SORTES_DE_GESTES as readonly string[]).includes(sorte) ? (sorte as SorteDeGeste) : null,
          cible: typeof cible === 'string' && cible ? tronquer(cible, 80) : null,
          suite: typeof suite === 'string' ? suite : null,
        }),
      )
    }),
  )
}
