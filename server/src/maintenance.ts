import type { Express, NextFunction, Request, Response } from 'express'
import type { AuthStore } from './auth/store'
import { readSessionToken } from './auth/http'
import { wrap } from './core/http'
import { extrait, noterLeGeste } from './core/journalDesGestes'
import type { Maintenance } from './core/maintenance'
import { PAGES_EN_MAINTENANCE, PAGES_FERMABLES, type PageEnMaintenance } from '../../shared/maintenance'

/**
 * Les routes qu'une page en maintenance ferme : celles qui y commencent
 * quelque chose — une partie, un départ, un achat. Une partie déjà à
 * l'écran se finit : ses réponses passent, ce qu'elle a gagné lui reste ; la
 * maintenance ferme les portes, elle ne coupe personne en route. Les pages,
 * elles, se ferment à l'adresse : servies fermées, elles ne demandent rien
 * (`ecrireLeService`, `core/page.ts`). Fermer la campagne ferme aussi le défi
 * de la semaine, qui vit dans sa page. `maintenance.test.ts` relit chaque
 * route dans le routeur : renommée, elle ne sortirait pas en silence de la
 * porte.
 */
export const PORTES_DES_PAGES: Record<PageEnMaintenance, readonly string[]> = {
  jour: ['POST /api/jour/commencer'],
  campagne: ['POST /api/campagne/serie', 'POST /api/campagne/revision', 'POST /api/campagne/sentiers/epreuve', 'POST /api/campagne/sujets/epreuve', 'POST /api/campagne/defi'],
  defi: ['POST /api/campagne/defi'],
  duels: ['POST /api/campagne/duel', 'POST /api/campagne/duel/:code', 'POST /api/campagne/rencontre'],
  expedition: ['POST /api/expedition'],
  boutique: ['POST /api/joueur/themes', 'POST /api/joueur/compagnons', 'POST /api/joueur/fonds'],
}

/**
 * L'administrateur, reconnu par la session de sa console — en mémoire, sans
 * un aller-retour. Il entre encore dans une page fermée : c'est de là qu'il
 * vérifie la réparation avant de rouvrir. Jamais une télé branchée, qui
 * n'administre rien.
 */
export function estLAdministrateur(auth: AuthStore, req: Request): boolean {
  const jeton = readSessionToken(req.header('cookie'))
  const trouve = jeton ? auth.resolveSession(jeton) : null
  return trouve?.account.role === 'admin' && auth.sessionById(trouve.session.id)?.finMax == null
}

/**
 * La garde des portes, posée devant les routes des joueurs (`api.ts`). Une
 * page fermée répond 423 et son motif, jamais 503 : le client lirait « le
 * serveur redémarre », et une écriture qui attend le réveil (`auReveil`) se
 * rejouerait jusqu'à passer. Rien de fermé, elle ne lit rien.
 */
export function fermerLesPortes(deps: { maintenance: Maintenance; auth: AuthStore }) {
  // Lues comme Express les lit : sans égard à la casse, la barre finale permise.
  const portes = PAGES_EN_MAINTENANCE.flatMap(page =>
    PORTES_DES_PAGES[page].map(route => {
      const [methode, chemin] = route.split(' ')
      return { page, methode, motif: new RegExp(`^${chemin.replace(/:[a-zA-Z]+/g, '[^/]+')}/?$`, 'i') }
    }),
  )
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' || !deps.maintenance.quelqueChoseDeFerme()) return next()
    // Posée sous `/api`, elle lit le chemin depuis là : la porte se dit entière.
    const chemin = req.baseUrl + req.path
    const fermee = portes.find(p => p.methode === req.method && p.motif.test(chemin) && deps.maintenance.estFermee(p.page))
    if (!fermee || estLAdministrateur(deps.auth, req)) return next()
    res.set('Cache-Control', 'no-store')
    res.status(423).json({ error: `${PAGES_FERMABLES[fermee.page].titre} : reviens un peu plus tard`, maintenance: fermee.page })
  }
}

/**
 * Le bandeau et les pages en maintenance au QG (`/admin#maintenance`) — sous
 * `/api/admin`, gardées d'un bloc (`api.ts`). Chaque geste dit sa phrase au
 * journal et rend l'état d'après, que la page montre sans relire.
 */
export function mountMaintenance(app: Express, deps: { maintenance: Maintenance }) {
  app.get(
    '/api/admin/maintenance',
    wrap(async (_req, res) => {
      res.json(deps.maintenance.etat())
    }),
  )

  // `{ texte }` le pose, `{ texte: null }` le retire.
  app.put(
    '/api/admin/maintenance/bandeau',
    wrap(async (req, res) => {
      const { avant, apres } = await deps.maintenance.poserLeBandeau(req.body?.texte === null ? null : req.body?.texte)
      noterLeGeste(res, {
        sorte: 'maintenance',
        resume:
          apres === null
            ? `Bandeau retiré : « ${extrait(avant ?? '')} »`
            : avant === null
              ? `Bandeau affiché : « ${apres} »`
              : `Bandeau changé : « ${extrait(avant)} » devient « ${apres} »`,
      })
      res.json(deps.maintenance.etat())
    }),
  )

  // `{ fermee: true }` la met en maintenance, `{ fermee: false }` la rouvre.
  app.put(
    '/api/admin/maintenance/pages/:page',
    wrap(async (req, res) => {
      const fermee: unknown = req.body?.fermee
      if (typeof fermee !== 'boolean') throw new Error('Dis s’il faut fermer la page ou la rouvrir : recharge le QG')
      const page = await deps.maintenance.fermer(req.params.page, fermee)
      const nom = PAGES_FERMABLES[page].nom
      noterLeGeste(res, { sorte: 'maintenance', resume: fermee ? `Page mise en maintenance : ${nom}` : `Page rouverte aux joueurs : ${nom}`, cible: page })
      res.json(deps.maintenance.etat())
    }),
  )
}
