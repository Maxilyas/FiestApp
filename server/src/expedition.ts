import express, { type Express, type Request, type Response } from 'express'
import type { CampagneStore } from './core/campagne'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { readPlayerToken } from './auth/http'
import { EXPEDITION_EN_PRODUCTION } from '../../shared/jokers'
import { RENCONTRES_EN_PRODUCTION } from '../../shared/rencontres'

interface ExpeditionDeps {
  campagne: CampagneStore
  profiles: ProfileStore
  /**
   * Ses routes répondent : hors de la production, et en production depuis
   * ses jokers (`EXPEDITION_EN_PRODUCTION`, `shared/jokers.ts`). Sans eux, le
   * joueur moyen n'arrivait au bout que quatre fois sur cent : rien ne s'y
   * gagnait en production avant que le mode soit entier.
   */
  ouverte: boolean
  /**
   * Le départ peut-il choisir les rencontres (la v5, `shared/rencontres.ts`) ?
   * Un prototype : la préproduction d'abord (le choix du propriétaire du
   * 18 octobre 2026), la production le jour où `RENCONTRES_EN_PRODUCTION`
   * l'ouvre. Sans lui, le départ reste celui des jokers.
   */
  rencontres?: boolean
}

/**
 * L'expédition répond-elle ? Hors de la production toujours — la
 * préproduction (`APP_ENV`), `npm run dev`, les tests —, en production tant
 * que le drapeau l'ouvre : ses jokers venus, il l'ouvre.
 */
export function expeditionOuverte({ online, env }: { online: boolean; env: string }): boolean {
  return EXPEDITION_EN_PRODUCTION || !online || env !== 'production'
}

/** Les rencontres se choisissent-elles au départ ? La même règle, sous leur drapeau à elles. */
export function rencontresOuvertes({ online, env }: { online: boolean; env: string }): boolean {
  return RENCONTRES_EN_PRODUCTION || !online || env !== 'production'
}

/**
 * Les routes de l'Expédition (`shared/expedition.ts`), pour les profils —
 * comme la campagne, dont elle est une partie d'un autre mode : sa
 * correction et ses signalements passent par les routes de la série
 * (`/api/campagne/serie/:id/…`). Un invité anonyme n'a pas d'expédition, et
 * le serveur le lui dit.
 */
export function mountExpedition(app: Express, deps: ExpeditionDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    if (!deps.ouverte) {
      res.status(404).json({ error: 'L’expédition arrive bientôt : reviens dans quelques jours' })
      return null
    }
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour partir en expédition' })
    return profil
  }

  // Celle qu'il a en route, sinon la prochaine : son numéro et ses gardiens.
  app.get(
    '/api/expedition',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.pageDeLExpedition(profil.id, { rencontres: deps.rencontres === true }))
    }),
  )

  // Partir, avec son équipée : deux légendaires au plus, les siens ou l'invité du jour —
  // et, là où elles s'ouvrent, aux rencontres, sa catégorie fétiche, le dos de son paquet et son cran de l'Ascension avec.
  app.post(
    '/api/expedition',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      // Demandées où elles ne s'ouvrent pas, elles se taisent : le départ reste celui des jokers, sans un refus pour une page d'avance.
      const rencontres = deps.rencontres === true && req.body?.rencontres === true
      const fetiche = typeof req.body?.fetiche === 'string' ? req.body.fetiche : undefined
      const dos = typeof req.body?.dos === 'string' ? req.body.dos : undefined
      const ascension = typeof req.body?.ascension === 'number' ? req.body.ascension : undefined
      res.json(
        await deps.campagne.partirEnExpedition(profil.id, req.body?.equipee ?? [], {
          rencontres,
          ...(rencontres && fetiche !== undefined && { fetiche }),
          ...(rencontres && dos !== undefined && { dos }),
          ...(rencontres && ascension !== undefined && { ascension }),
        }),
      )
    }),
  )

  // Un geste — avancer, jouer une carte, voir la question et sa mise, prendre une offre, camper, garder un gardien —, avec le rang qu'il croit suivre.
  app.post(
    '/api/expedition/:id/geste',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.gesteDExpedition(profil.id, String(req.params.id), Number(req.body?.rang), req.body?.geste))
    }),
  )

  // Une réponse, avec le rang de la question qu'elle vise.
  app.post(
    '/api/expedition/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.repondreEnExpedition(profil.id, String(req.params.id), Number(req.body?.position), req.body?.choix))
    }),
  )

  app.post(
    '/api/expedition/:id/abandon',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.abandonnerLExpedition(profil.id, String(req.params.id)))
    }),
  )

  // Un dévoilement (l'étape 3) : les mots de la question qui attend, chacun
  // à son heure — une réponse qui s'écrit au fil du texte, un mot par ligne,
  // jamais l'intitulé entier d'avance (invariant 1). Rouverte, elle redit
  // d'un coup les mots déjà dits, puis reprend leur rythme.
  app.get(
    '/api/expedition/:id/devoilement',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const d = await deps.campagne.devoilement(profil.id, String(req.params.id), Number(req.query.position))
      // Ni compressée — `compression()` garderait les mots jusqu'au dernier —, ni retenue par un proxy, ni minutée comme une attente.
      res.locals.auFilDuTemps = true
      res.status(200).set({ 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' })
      res.flushHeaders()
      let ecrits = 0
      let minuterie: ReturnType<typeof setTimeout> | null = null
      res.on('close', () => {
        if (minuterie) clearTimeout(minuterie)
      })
      const ecrire = () => {
        minuterie = null
        if (res.writableEnded || res.destroyed) return
        const { dits, suivantDans } = d.ou()
        if (dits > ecrits) {
          res.write(d.mots.slice(ecrits, dits).map(mot => `${mot}\n`).join(''))
          ecrits = dits
        }
        if (suivantDans === null) res.end()
        // L'heure du mot suivant se relit à chaque mot : Arrêt sur image joué en route la repousse.
        else minuterie = setTimeout(ecrire, Math.max(20, suivantDans))
      }
      ecrire()
    }),
  )
}
