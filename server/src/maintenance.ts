import type { Express, NextFunction, Request, Response } from 'express'
import type { AuthStore } from './auth/store'
import type { ProfileStore } from './auth/profiles'
import { readPlayerToken, readSessionToken } from './auth/http'
import { wrap } from './core/http'
import { extrait, noterLeGeste } from './core/journalDesGestes'
import type { Maintenance, Visiteur } from './core/maintenance'
import { PAGES_EN_MAINTENANCE, PAGES_FERMABLES, type EtatDUnePage, type EtatDeLaMaintenance, type PageEnMaintenance } from '../../shared/maintenance'

/**
 * Les routes qu'une page en maintenance ferme : celles qui y commencent
 * quelque chose — une partie, un départ, un achat. Une partie déjà à
 * l'écran se finit : ses réponses passent, ce qu'elle a gagné lui reste ; la
 * maintenance ferme les portes, elle ne coupe personne en route. Les pages,
 * elles, se ferment à l'adresse : servies fermées, elles ne demandent rien
 * (`ecrireLeService`, `core/page.ts`). Fermer la campagne ferme aussi le défi
 * de la semaine, qui vit dans sa page. Une page bientôt disponible ferme les
 * mêmes, à tous sauf à ses testeurs. `maintenance.test.ts` relit chaque
 * route dans le routeur : renommée, elle ne sortirait pas en silence de la
 * porte.
 */
export const PORTES_DES_PAGES: Record<PageEnMaintenance, readonly string[]> = {
  jour: ['POST /api/jour/commencer'],
  campagne: ['POST /api/campagne/serie', 'POST /api/campagne/revision', 'POST /api/campagne/sentiers/epreuve', 'POST /api/campagne/sujets/epreuve', 'POST /api/campagne/defi'],
  defi: ['POST /api/campagne/defi'],
  duels: ['POST /api/campagne/duel', 'POST /api/campagne/duel/:code', 'POST /api/campagne/rencontre'],
  expedition: ['POST /api/expedition'],
  // Le départ d'une partie ; jamais un geste : une partie commencée se finit, sa poussière et son œuvre avec.
  cabinet: ['POST /api/cabinet/partie'],
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
 * Qui demande : l'administrateur, et le profil de sa session de joueur — un
 * testeur entre dans la page bientôt disponible qu'il essaie. L'un et l'autre
 * se lisent en mémoire.
 */
export function quiEstCe(deps: { auth: AuthStore; profiles: ProfileStore }, req: Request): Visiteur {
  const jeton = readPlayerToken(req.header('cookie'))
  return { admin: estLAdministrateur(deps.auth, req), profil: jeton ? deps.profiles.sessionProfileId(jeton) : null }
}

/**
 * La garde des portes, posée devant les routes des joueurs (`api.ts`). Une
 * page fermée répond 423 et son motif, jamais 503 : le client lirait « le
 * serveur redémarre », et une écriture qui attend le réveil (`auReveil`) se
 * rejouerait jusqu'à passer. Rien de fermé, elle ne lit rien.
 */
export function fermerLesPortes(deps: { maintenance: Maintenance; auth: AuthStore; profiles: ProfileStore }) {
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
    // Toutes celles de la route : le défi bientôt disponible et la campagne en maintenance, son testeur ne passe pas.
    const fermees = portes.filter(p => p.methode === req.method && p.motif.test(chemin) && deps.maintenance.estFermee(p.page))
    if (fermees.length === 0) return next()
    const qui = quiEstCe(deps, req)
    const refus = fermees.find(p => !deps.maintenance.laisseEntrer(p.page, qui))
    if (!refus) return next()
    res.set('Cache-Control', 'no-store')
    if (deps.maintenance.etatDe(refus.page) === 'bientot') {
      res.status(423).json({ error: `${PAGES_FERMABLES[refus.page].bientot} : reviens dans quelques jours`, bientot: refus.page })
    } else {
      res.status(423).json({ error: `${PAGES_FERMABLES[refus.page].titre} : reviens un peu plus tard`, maintenance: refus.page })
    }
  }
}

/** Ce que le QG lit de la maintenance : ses testeurs nommés, leur prénom et leur identifiant. */
async function etatPourLeQg(deps: { maintenance: Maintenance; profiles: ProfileStore }): Promise<EtatDeLaMaintenance> {
  const brut = deps.maintenance.etat()
  const ids = [...new Set(PAGES_EN_MAINTENANCE.flatMap(p => brut.testeurs[p].map(t => t.id)))]
  const fiches = new Map((ids.length > 0 ? await deps.profiles.byIds(ids) : []).flatMap(f => (f ? [[f.id, f] as const] : [])))
  // Un profil suspendu ne se lit plus (`byIds`) : il ne se connecte plus, sa ligne attend sa réactivation sans se montrer.
  const testeurs = Object.fromEntries(
    PAGES_EN_MAINTENANCE.map(p => [
      p,
      brut.testeurs[p].flatMap(t => {
        const f = fiches.get(t.id)
        return f ? [{ id: f.id, nom: f.name, login: f.login, depuis: t.depuis }] : []
      }),
    ]),
  ) as EtatDeLaMaintenance['testeurs']
  return { ...brut, testeurs }
}

/** Ce que le journal dit d'une page qui change : « rouverte » après une réparation, « ouverte » après l'attente. */
function phraseDuChangement(page: PageEnMaintenance, avant: EtatDUnePage, apres: EtatDUnePage): string {
  const nom = PAGES_FERMABLES[page].nom
  if (apres === 'maintenance') return `Page mise en maintenance : ${nom}`
  if (apres === 'bientot') return `Page bientôt disponible, pour ses testeurs : ${nom}`
  return avant === 'maintenance' ? `Page rouverte aux joueurs : ${nom}` : `Page ouverte à tous : ${nom}`
}

/**
 * Le bandeau, les pages en maintenance et leurs testeurs au QG
 * (`/admin#maintenance`) — sous `/api/admin`, gardées d'un bloc (`api.ts`).
 * Chaque geste dit sa phrase au journal et rend l'état d'après, que la page
 * montre sans relire.
 */
export function mountMaintenance(app: Express, deps: { maintenance: Maintenance; profiles: ProfileStore }) {
  app.get(
    '/api/admin/maintenance',
    wrap(async (_req, res) => {
      res.json(await etatPourLeQg(deps))
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
      res.json(await etatPourLeQg(deps))
    }),
  )

  // `{ etat }` : `ouverte`, `maintenance` ou `bientot`. Une page d'avant envoie `{ fermee }` : vrai la met en
  // maintenance, faux la rouvre, comme avant.
  app.put(
    '/api/admin/maintenance/pages/:page',
    wrap(async (req, res) => {
      const fermee: unknown = req.body?.fermee
      const etat: unknown = req.body?.etat ?? (typeof fermee === 'boolean' ? (fermee ? 'maintenance' : 'ouverte') : undefined)
      if (etat === undefined) throw new Error('Dis ce que devient la page : recharge le QG')
      const { page, avant } = await deps.maintenance.changerLEtat(req.params.page, etat)
      noterLeGeste(res, { sorte: 'maintenance', resume: phraseDuChangement(page, avant, deps.maintenance.etatDe(page)), cible: page })
      res.json(await etatPourLeQg(deps))
    }),
  )

  // Un testeur de plus, ou de moins : un profil qui existe, par son identifiant.
  const testeur = async (req: Request, res: Response) => {
    const profil = await deps.profiles.byId(String(req.params.id))
    if (!profil) res.status(404).json({ error: 'Ce profil n’existe plus : recharge le QG' })
    return profil
  }
  app.put(
    '/api/admin/maintenance/pages/:page/testeurs/:id',
    wrap(async (req, res) => {
      const profil = await testeur(req, res)
      if (!profil) return
      const page = await deps.maintenance.ajouterUnTesteur(req.params.page, profil.id)
      noterLeGeste(res, { sorte: 'maintenance', resume: `Testeur ajouté à « ${PAGES_FERMABLES[page].nom} » : ${profil.name} (@${profil.login})`, cible: profil.id })
      res.json(await etatPourLeQg(deps))
    }),
  )
  app.delete(
    '/api/admin/maintenance/pages/:page/testeurs/:id',
    wrap(async (req, res) => {
      const profil = await testeur(req, res)
      if (!profil) return
      const page = await deps.maintenance.retirerUnTesteur(req.params.page, profil.id)
      noterLeGeste(res, { sorte: 'maintenance', resume: `Testeur retiré de « ${PAGES_FERMABLES[page].nom} » : ${profil.name} (@${profil.login})`, cible: profil.id })
      res.json(await etatPourLeQg(deps))
    }),
  )
}
