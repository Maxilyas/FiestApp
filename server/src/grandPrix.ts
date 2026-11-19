import express, { type Express, type Request, type Response } from 'express'
import type { ProfileStore } from './auth/profiles'
import type { GrandPrixStore } from './core/grandPrix'
import { wrap } from './core/http'
import { noterLeGeste } from './core/journalDesGestes'
import { readPlayerToken } from './auth/http'
import { PRIX_DES_GRANDS_PRIX, legendaire } from '../../shared/legendaires'
import { RUBANS } from '../../shared/grandPrix'

/**
 * Les routes du Grand Prix (`core/grandPrix.ts`) : courir, pour les profils —
 * avant la porte des animateurs, comme le quiz du jour —, et le programmer,
 * au QG, derrière la sienne (`/api/admin`, posée par `mountApi` avant toute
 * route : chaque geste qui change quelque chose s'y note au journal).
 */
export function mountGrandPrix(app: Express, deps: { grandPrix: GrandPrixStore; profiles: ProfileStore }) {
  const petit = express.json({ limit: '4kb' })

  /** Le profil connecté, ou un 401 qui dit quoi faire. */
  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour courir le Grand Prix' })
    return profil
  }

  app.get(
    '/api/grand-prix',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.grandPrix.etat(profil.id))
    }),
  )

  // Ses flots, pour le carnet des Grands Prix de « Ma collection ».
  app.get(
    '/api/grand-prix/carnet',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json({ flots: await deps.grandPrix.carnetDe(profil.id) })
    }),
  )

  app.post(
    '/api/grand-prix/depart',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.grandPrix.depart(profil.id))
    }),
  )

  app.post(
    '/api/grand-prix/course/:id/suivante',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.grandPrix.suivante(profil.id, String(req.params.id)))
    }),
  )

  app.post(
    '/api/grand-prix/course/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      res.json(await deps.grandPrix.repondre(profil.id, String(req.params.id), req.body?.position, req.body?.choix))
    }),
  )

  app.post(
    '/api/grand-prix/course/:id/abandon',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.grandPrix.abandon(profil.id, String(req.params.id)))
    }),
  )

  // ── Le QG ──────────────────────────────────────────────────────────────

  const page = async () => ({
    grandsPrix: await deps.grandPrix.auQg(),
    prix: PRIX_DES_GRANDS_PRIX.map(cle => ({ cle, nom: legendaire(cle)?.nom ?? cle })),
    rubans: Object.entries(RUBANS).map(([cle, r]) => ({ cle, nom: r.nom, rond: r.rond, pli: r.pli })),
  })

  app.get(
    '/api/admin/grand-prix',
    wrap(async (_req, res) => {
      res.set('Cache-Control', 'no-store')
      res.json(await page())
    }),
  )

  // Ce que le fantôme a de quoi courir, avant de le programmer : ses questions du jour et de la campagne.
  app.get(
    '/api/admin/grand-prix/fantome/:id',
    wrap(async (req, res) => {
      res.set('Cache-Control', 'no-store')
      const apercu = await deps.grandPrix.apercuDuFantome(String(req.params.id))
      if (!apercu) return res.status(404).json({ error: 'Ce profil est introuvable' })
      res.json(apercu)
    }),
  )

  // `{ id?, fantome, jour, titre, ruban, mot, prix, prixFete }` : programme un Grand Prix, ou le reprogramme avant son jour.
  app.post(
    '/api/admin/grand-prix',
    express.json({ limit: '8kb' }),
    wrap(async (req, res) => {
      const g = await deps.grandPrix.programmer(req.body ?? {})
      const p = await deps.profiles.byId(g.fantome)
      noterLeGeste(res, { sorte: 'annonce', resume: `Grand Prix programmé : « ${g.titre} », le ${g.jour}, contre le fantôme de ${p?.name ?? '?'}`, cible: g.id })
      res.json(await page())
    }),
  )

  // L'essai d'un Grand Prix, à tout jour : l'administrateur court contre le fantôme qu'il programme, avec son profil,
  // hors classement et sans flot. Derrière la porte du QG : un essai montre des questions du vivier avant leur jour.
  app.get(
    '/api/admin/grand-prix/:id/essai',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      if (!deps.grandPrix.get(String(req.params.id))) return res.status(404).json({ error: 'Ce Grand Prix est introuvable : recharge le QG' })
      res.json(await deps.grandPrix.etat(profil.id, String(req.params.id)))
    }),
  )

  app.post(
    '/api/admin/grand-prix/:id/essai',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const g = deps.grandPrix.get(String(req.params.id))
      if (!g) return res.status(404).json({ error: 'Ce Grand Prix est introuvable : recharge le QG' })
      const etat = await deps.grandPrix.depart(profil.id, g.id)
      noterLeGeste(res, { sorte: 'annonce', resume: `Essai du Grand Prix « ${g.titre} »`, cible: g.id })
      res.json(etat)
    }),
  )

  app.delete(
    '/api/admin/grand-prix/:id',
    wrap(async (req, res) => {
      const g = deps.grandPrix.get(String(req.params.id))
      if (!g || !(await deps.grandPrix.retirer(g.id))) return res.status(404).json({ error: 'Ce Grand Prix est introuvable : recharge le QG' })
      noterLeGeste(res, { sorte: 'annonce', resume: `Grand Prix retiré : « ${g.titre} », le ${g.jour}`, cible: g.id })
      res.json(await page())
    }),
  )
}
