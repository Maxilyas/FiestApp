import type { Express } from 'express'
import { clientDistant, type Client } from './core/distante'
import { wrap } from './core/http'
import { enTranches } from './core/tourniquet'
import type { MemoireDuQg } from './core/memoireDuQg'
import type { JournalDesGestes } from './core/journalDesGestes'
import type { SanteDuServeur } from './core/santeDuServeur'
import type { ProfileStore } from './auth/profiles'
import type { AudienceDuQg } from './joueursDuQg'
import { jourAvant, jourDe } from '../../shared/jour'
import { minuitDe } from '../../shared/qg'
import { JOURS_DE_LA_MEMOIRE, SEGMENTS, type ChiffresDUnJour, type Presence, type ProfilDeLAudience, type SegmentDuQg } from '../../shared/qgJoueurs'
import { ANNONCES_MONTREES } from '../../shared/annonces'
import { AFFICHES_MONTREES, estUnePageALAffiche } from '../../shared/affiches'
import {
  JOURS_DE_L_AVANT_APRES,
  JOURS_DE_L_EFFET_D_UNE_ANNONCE,
  JOURS_DES_REPERES,
  JOURS_DES_REPERES_DU_JOURNAL,
  ROUTES_DES_REPERES,
  effetsDesAffiches,
  effetsDesAnnonces,
  repereDuGeste,
  reperesDesDemarrages,
  type ChiffresDuRepere,
  type EffetsDesAffiches,
  type EffetsDesAnnonces,
  type GesteDeRepere,
  type JoursDeLAvantApres,
  type RepereDuQg,
  type ReperesDuQg,
} from '../../shared/qgEffets'

export interface EffetsDeps {
  memoire: Pick<MemoireDuQg, 'presencesEntre' | 'joursDepuis'>
  /** La mémoire tenue à jour jusqu'à hier : une fois par jour, partagée avec la page des joueurs (`aJour`). */
  audience: Pick<AudienceDuQg, 'aJour'>
  profiles: Pick<ProfileStore, 'profilsPourLAudience'>
  gestes: Pick<JournalDesGestes, 'desRoutes'>
  sante: Pick<SanteDuServeur, 'demarragesDesReperes'>
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
}

const JOUR_MS = 86_400_000

/** Une lecture du jour, partagée par qui la demande pendant qu'elle se fait, oubliée si elle échoue, gardée jusqu'à minuit. */
function duJour<T>(lire: (aujourdhui: string) => Promise<T>): (aujourdhui: string) => Promise<T> {
  let garde: { aujourdhui: string; lecture: Promise<T> } | null = null
  return aujourdhui => {
    if (garde?.aujourdhui !== aujourdhui) {
      const lecture = lire(aujourdhui)
      const g = { aujourdhui, lecture }
      garde = g
      lecture.catch(() => {
        if (garde === g) garde = null
      })
    }
    return garde.lecture
  }
}

/**
 * L'effet de ce que le QG envoie et les repères de ses courbes (le QG 2, le 4 novembre 2026 — la revue d'analyse,
 * P2.1 et P2.2 ; `shared/qgEffets.ts`). Ce qui est fini se lit une fois par jour et se garde jusqu'à minuit — les
 * feuilles de présence et les jours de la mémoire, les profils, les destinataires des annonces à un segment, les
 * visites des affiches, les gestes d'avant aujourd'hui : un jour fini ne bouge plus. Seuls se relisent, à chaque
 * demande, la liste des annonces et des affiches — leurs cinquante dernières, par l'index de leur date — et les gestes
 * d'aujourd'hui, par le leur. Jamais une lecture par annonce.
 */
export class EffetsDuQg {
  private client: Client

  constructor(
    url: string,
    authToken: string | undefined,
    private deps: EffetsDeps,
  ) {
    this.client = clientDistant(url, authToken)
  }

  close() {
    this.client.close()
  }

  // ── La mémoire, lue une fois par jour ──────────────────────────────────────

  /** Un an de jours de la mémoire (`qg_jours`) : les achats d'une affiche de la boutique, l'avant / après d'un repère. */
  private lesJours = duJour(async aujourdhui => {
    const lus = await this.deps.memoire.joursDepuis(jourAvant(aujourdhui, JOURS_DE_LA_MEMOIRE))
    return { jours: lus.jours as ReadonlyMap<string, ChiffresDUnJour>, depuis: lus.premier }
  })

  /** Tous les profils — quand chacun est né, s'il est suspendu : les destinataires d'une annonce à tous, les segments d'une semaine passée. */
  private lesProfils = duJour<ProfilDeLAudience[]>(() => this.deps.profiles.profilsPourLAudience(0, Number.MAX_SAFE_INTEGER))

  /**
   * Les feuilles de présence des jours finis qu'il faut : de la plus ancienne annonce ou affiche, moins trente-sept
   * jours — la semaine d'avant et les trente jours que lit la règle d'un segment —, jusqu'à hier ; un an au plus, ce
   * que la mémoire garde.
   */
  private lesFeuilles = duJour(async aujourdhui => {
    // Par l'index de leur date, une ligne chacune ; une table vide rend NULL — pas l'an 1970.
    const [annonces, affiches] = await this.client.batch(['SELECT MIN(created_at) AS le FROM qg_annonces', 'SELECT MIN(created_at) AS le FROM qg_affiches'], 'read')
    const plusVieux = Math.min(this.deps.maintenant(), ...[annonces, affiches].map(r => (r.rows[0]?.le == null ? Infinity : Number(r.rows[0].le))))
    // La semaine d'une annonce, la veille de sa semaine d'habitude et les trente jours de la règle d'un segment ; les
    // quatorze jours d'avant d'une affiche y tiennent.
    const recul = JOURS_DE_L_EFFET_D_UNE_ANNONCE + 1 + 30
    const debut = [jourAvant(jourDe(plusVieux), recul), jourAvant(aujourdhui, recul)].sort()[0]
    const plusAncien = jourAvant(aujourdhui, JOURS_DE_LA_MEMOIRE)
    const parJour = new Map<string, Presence[]>()
    for (const p of await this.deps.memoire.presencesEntre(debut < plusAncien ? plusAncien : debut, aujourdhui)) {
      let du = parJour.get(p.jour)
      if (!du) parJour.set(p.jour, (du = []))
      du.push(p)
    }
    return parJour
  })

  /** Les destinataires des annonces écrites à un segment, d'un seul texte JSON — une annonce à tous n'en retient aucun. */
  private lesDestinataires = duJour(async () => {
    const res = await this.client.execute('SELECT json_group_array(json_array(annonce_id, profile_id)) AS lignes FROM qg_annonce_destinataires')
    const parAnnonce = new Map<string, string[]>()
    for (const [annonce, qui] of JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, string][]) {
      let siens = parAnnonce.get(String(annonce))
      if (!siens) parAnnonce.set(String(annonce), (siens = []))
      siens.push(String(qui))
    }
    return parAnnonce
  })

  /** Les visites que les affiches ont notées (`profile_affiches.ouverte_le`), d'un seul texte JSON. */
  private lesVisites = duJour(async () => {
    const res = await this.client.execute(
      'SELECT json_group_array(json_array(affiche_id, profile_id, ouverte_le)) AS lignes FROM profile_affiches WHERE ouverte_le IS NOT NULL',
    )
    const parAffiche = new Map<string, { qui: string; le: number }[]>()
    for (const [affiche, qui, le] of JSON.parse(String(res.rows[0]?.lignes ?? '[]')) as [string, string, number][]) {
      let siennes = parAffiche.get(String(affiche))
      if (!siennes) parAffiche.set(String(affiche), (siennes = []))
      siennes.push({ qui: String(qui), le: Number(le) })
    }
    return parAffiche
  })

  /** Ce que la mémoire prête aux effets aujourd'hui — à jour jusqu'à hier d'abord. */
  private async laMemoire() {
    await this.deps.audience.aJour()
    const maintenant = this.deps.maintenant()
    const aujourdhui = jourDe(maintenant)
    const [presences, profils, { jours, depuis }] = await Promise.all([this.lesFeuilles(aujourdhui), this.lesProfils(aujourdhui), this.lesJours(aujourdhui)])
    return { maintenant, aujourdhui, presences, profils, jours, depuis }
  }

  // ── Ce que les pages lisent ────────────────────────────────────────────────

  /** L'effet de chaque annonce montrée (`GET /api/admin/annonces/effets`). */
  async desAnnonces(): Promise<EffetsDesAnnonces> {
    const m = await this.laMemoire()
    const [lues, destinataires] = await Promise.all([
      this.client.execute({
        sql: `SELECT json_group_array(json_array(id, created_at, segment)) AS lignes FROM (
                SELECT a.id, a.created_at, (SELECT segment FROM qg_annonce_segments s WHERE s.annonce_id = a.id) AS segment
                FROM qg_annonces a ORDER BY a.created_at DESC LIMIT ?)`,
        args: [ANNONCES_MONTREES],
      }),
      this.lesDestinataires(m.aujourdhui),
    ])
    const annonces = (JSON.parse(String(lues.rows[0]?.lignes ?? '[]')) as [string, number, string | null][])
      // Plus vieille que la mémoire, une annonce n'a plus rien à comparer.
      .filter(([, le]) => le >= m.maintenant - JOURS_DE_LA_MEMOIRE * JOUR_MS)
      .map(([id, le, segment]) => {
        const lu = (SEGMENTS as readonly unknown[]).includes(segment) ? (segment as SegmentDuQg) : null
        return { id: String(id), le: Number(le), segment: lu, destinataires: lu ? (destinataires.get(String(id)) ?? []) : null }
      })
    const effets = await enTranches(effetsDesAnnonces(annonces, m))
    return { maintenant: m.maintenant, aujourdhui: m.aujourdhui, effets }
  }

  /** L'effet de chaque affiche montrée (`GET /api/admin/affiches/effets`). */
  async desAffiches(): Promise<EffetsDesAffiches> {
    const m = await this.laMemoire()
    const [lues, visites] = await Promise.all([
      this.client.execute({
        sql: 'SELECT json_group_array(json_array(id, page, created_at)) AS lignes FROM (SELECT id, page, created_at FROM qg_affiches ORDER BY created_at DESC LIMIT ?)',
        args: [AFFICHES_MONTREES],
      }),
      this.lesVisites(m.aujourdhui),
    ])
    const affiches = (JSON.parse(String(lues.rows[0]?.lignes ?? '[]')) as [string, string, number][]).flatMap(([id, page, le]) =>
      estUnePageALAffiche(page) && le >= m.maintenant - JOURS_DE_LA_MEMOIRE * JOUR_MS ? [{ id: String(id), page, le: Number(le), visites: visites.get(String(id)) ?? [] }] : [],
    )
    const effets = await enTranches(effetsDesAffiches(affiches, m))
    return { maintenant: m.maintenant, aujourdhui: m.aujourdhui, effets }
  }

  /** Les jours de la mémoire autour d'un repère, son jour à quatorze jours de chaque côté (`GET /api/admin/reperes/avant-apres`). */
  async joursAutourDe(jour: string): Promise<JoursDeLAvantApres> {
    await this.deps.audience.aJour()
    const maintenant = this.deps.maintenant()
    const aujourdhui = jourDe(maintenant)
    const { jours, depuis } = await this.lesJours(aujourdhui)
    const autour: [string, ChiffresDuRepere][] = []
    for (let k = -JOURS_DE_L_AVANT_APRES; k <= JOURS_DE_L_AVANT_APRES; k++) {
      const j = jourAvant(jour, -k)
      const c = jours.get(j)
      if (c) autour.push([j, { joueurs: c.joueurs, profils: c.profils, modes: c.modes, parties: c.parties, nouveauxProfils: c.nouveauxProfils }])
    }
    return { maintenant, aujourdhui, depuis, jours: autour }
  }

  // ── Les repères ─────────────────────────────────────────────────────────────

  /** Des gestes du journal, leur annonce et leur affiche lues par leur clé — le segment de l'une, la page de l'autre —, en repères. */
  private async enReperes(gestes: readonly Omit<GesteDeRepere, 'segment' | 'page'>[]): Promise<RepereDuQg[]> {
    const annonces = gestes.filter(g => g.route === 'POST /api/admin/annonces' && g.cible).map(g => g.cible!)
    const affiches = gestes.filter(g => g.route === 'POST /api/admin/affiches' && g.cible).map(g => g.cible!)
    const segments = new Map<string, SegmentDuQg>()
    const pages = new Map<string, string>()
    if (annonces.length > 0 || affiches.length > 0) {
      const [s, p] = await this.client.batch(
        [
          { sql: 'SELECT annonce_id, segment FROM qg_annonce_segments WHERE annonce_id IN (SELECT value FROM json_each(?))', args: [JSON.stringify(annonces)] },
          { sql: 'SELECT id, page FROM qg_affiches WHERE id IN (SELECT value FROM json_each(?))', args: [JSON.stringify(affiches)] },
        ],
        'read',
      )
      for (const r of s.rows) if ((SEGMENTS as readonly unknown[]).includes(r.segment)) segments.set(String(r.annonce_id), r.segment as SegmentDuQg)
      for (const r of p.rows) pages.set(String(r.id), String(r.page))
    }
    return gestes.flatMap(g => {
      const r = repereDuGeste({ ...g, segment: g.cible ? (segments.get(g.cible) ?? null) : null, page: g.cible ? (pages.get(g.cible) ?? null) : null })
      return r ? [r] : []
    })
  }

  /** Les repères des gestes d'avant aujourd'hui — un an, ce que la mémoire sait —, lus une fois par jour : un geste écrit ne change plus. */
  private lesReperesDAvant = duJour(async () => {
    const minuit = minuitDe(this.deps.maintenant())
    return this.enReperes(await this.deps.gestes.desRoutes(ROUTES_DES_REPERES, minuit - (JOURS_DES_REPERES_DU_JOURNAL + 1) * JOUR_MS, minuit))
  })

  /**
   * Les repères de `jours` jours, du plus ancien au plus récent (`GET /api/admin/reperes`) : les gestes — ceux d'avant
   * aujourd'hui gardés, ceux d'aujourd'hui relus par leur index —, et les mises en ligne et arrêts nets des démarrages
   * que la santé du serveur garde huit jours. Ni la mémoire du QG, ni une lecture de plus au poste de commande qu'une
   * poignée de lignes.
   */
  async reperes(jours = JOURS_DES_REPERES): Promise<ReperesDuQg> {
    const maintenant = this.deps.maintenant()
    const minuit = minuitDe(maintenant)
    const depuis = maintenant - jours * JOUR_MS
    const [avant, aujourdhui, serveur] = await Promise.all([
      this.lesReperesDAvant(jourDe(maintenant)),
      this.deps.gestes.desRoutes(ROUTES_DES_REPERES, minuit).then(g => this.enReperes(g)),
      this.deps.sante.demarragesDesReperes().catch((e: unknown) => {
        // Une base qui se tait ôte les mises en ligne, pas les gestes.
        console.error('[qg] les démarrages ne se lisent pas pour les repères :', e)
        return null
      }),
    ])
    const demarrages = serveur ? reperesDesDemarrages(serveur.demarrages, serveur.maintenant, serveur.courant) : []
    const reperes = [...avant, ...aujourdhui, ...demarrages].filter(r => r.quand >= depuis).sort((a, b) => a.quand - b.quand)
    return { maintenant, reperes, demarragesDepuis: (serveur?.maintenant ?? maintenant) - 8 * JOUR_MS }
  }
}

/** « 2026-10-31 » : un jour de Paris, lu dans l'adresse ; refusé plutôt que deviné. */
const JOUR = /^\d{4}-\d{2}-\d{2}$/

/**
 * Les routes de l'effet et des repères, sous `/api/admin` — gardées d'un bloc (`api.ts`), elles entrent d'elles-mêmes
 * dans `admin-seulement.test.ts`. Elles lisent seulement : la mémoire qu'elles tiennent à jour en passant n'est que le
 * reflet des journaux, et rien n'y va au journal des gestes.
 */
export function mountEffetsDuQg(app: Express, effets: EffetsDuQg) {
  app.get(
    '/api/admin/annonces/effets',
    wrap(async (_req, res) => {
      res.json(await effets.desAnnonces())
    }),
  )
  app.get(
    '/api/admin/affiches/effets',
    wrap(async (_req, res) => {
      res.json(await effets.desAffiches())
    }),
  )
  // `?jours=` : quatre-vingt-dix d'office, la plus longue des courbes ; le journal en demande un an.
  app.get(
    '/api/admin/reperes',
    wrap(async (req, res) => {
      const jours = Number(req.query.jours)
      res.json(await effets.reperes(Number.isInteger(jours) && jours > 0 && jours <= JOURS_DES_REPERES_DU_JOURNAL ? jours : JOURS_DES_REPERES))
    }),
  )
  app.get(
    '/api/admin/reperes/avant-apres',
    wrap(async (req, res) => {
      const jour = typeof req.query.jour === 'string' && JOUR.test(req.query.jour) ? req.query.jour : null
      if (!jour) return res.status(400).json({ error: 'Choisis un repère dans le fil : son jour manque' })
      res.json(await effets.joursAutourDe(jour))
    }),
  )
}

