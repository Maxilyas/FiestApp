import type { Express, Request, Response } from 'express'
import type { ProfileRec, ProfileStore } from './auth/profiles'
import type { AccountRec, AuthStore } from './auth/store'
import { estSalonDuProfil, estUnSalon } from './auth/store'
import type { QuizStore } from './core/quizStore'
import type { JourStore } from './core/jour'
import type { CampagneStore } from './core/campagne'
import { accountOf, loginBudgetOf } from './auth/http'
import { wrap } from './core/http'
import { noterLeGeste } from './core/journalDesGestes'
import { tronquer } from '../../shared/avatars'
import { deNom } from '../../shared/typographie'
import { jourDe } from '../../shared/jour'
import type { FicheDuJoueur, ProfilDAdministration } from '../../shared/profil'
import { JOURS_DU_QG, minuitsDeParis, modeDeLaSerie } from '../../shared/qg'
import { activiteDesJoueurs, parModeVide, type ActiviteDUnJoueur, type PartieSeule } from '../../shared/qgActivite'
import type { EspaceDAdministration } from '../../shared/space'
import { titreLibre } from '../../shared/library'

interface ProfilsAdminDeps {
  profiles: ProfileStore
  auth: AuthStore
  store: QuizStore
  jour: Pick<JourStore, 'resumeDe' | 'estMasque' | 'partiesDepuis'>
  campagne: Pick<CampagneStore, 'epreuveLaissee' | 'libererEpreuve' | 'seriesDepuis'>
  /** Les espaces dont une soirée pas encore close compte ce profil parmi ses invités — actives ou laissées en plan. */
  soireesPasCloses: (profileId: string) => string[]
  /** Supprime le profil et ce qui n'était qu'à lui — composé dans `createQuizServer`, où tout est à portée. */
  supprimerProfil: (profileId: string) => Promise<{ salon: 'detache' | null }>
  /** La bibliothèque d'un espace a changé : « Lancer » la relit. */
  onLibraryChanged: (spaceId: string) => Promise<void>
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
}

/**
 * « Les profils », à `/admin` : l'administrateur les cherche, ouvre la fiche
 * d'un joueur et y agit — lui offrir des confettis, lui donner un code de
 * secours neuf, changer un prénom qui ne va pas, le suspendre ou le
 * réactiver, rouvrir sa connexion fermée, libérer l'épreuve de sentier qui
 * l'attend, le supprimer (les choix du 13 octobre 2026). Sous `/api/admin`,
 * gardé d'un bloc (`api.ts`) : administrateur seul, jamais depuis une télé
 * branchée. Chaque geste dit sa phrase au journal du QG, sur le profil
 * (`cible`) : la fiche relit les siens.
 */
export function mountProfilsAdmin(app: Express, deps: ProfilsAdminDeps) {
  const budget = loginBudgetOf(app)
  /** Les deux secrets d'un profil, sous les clés de leurs portes : son mot de passe, son code de secours. */
  const clesDeConnexion = (login: string) => [`joueur:${login}`, `secours:${login}`]
  /** Jusqu'à quand sa connexion est fermée — par l'un ou l'autre de ses secrets —, ou null. */
  const fermeeJusquA = (login: string) => Math.max(0, ...clesDeConnexion(login).map(cle => budget.fermeJusquA(cle) ?? 0)) || null

  const ligne = async (moi: AccountRec, p: { profil: ProfileRec; niveau: number; soirees: number }): Promise<ProfilDAdministration> => {
    const salon = deps.auth.byProfile(p.profil.id)
    return {
      id: p.profil.id,
      login: p.profil.login,
      nom: p.profil.name,
      avatar: p.profil.avatar,
      niveau: p.niveau,
      soirees: p.soirees,
      vuLe: p.profil.lastSeenAt,
      salon: salon ? { slug: salon.slug, quiz: await deps.store.count(salon.id), propre: estSalonDuProfil(salon) } : null,
      toi: salon?.id === moi.id,
      suspendu: p.profil.disabledAt !== null,
    }
  }

  /**
   * Ses trente derniers jours, mode par mode — sur quoi il s'acharne : ses
   * parties du jour, ses séries et ses soirées, lues pour lui seul par leurs
   * index, comptées comme la page de l'activité (`activiteDesJoueurs`).
   */
  const sesTrenteJours = async (profileId: string): Promise<ActiviteDUnJoueur> => {
    const maintenant = deps.maintenant()
    const minuits = minuitsDeParis(maintenant, JOURS_DU_QG)
    const [parties, series, soirees] = await Promise.all([
      deps.jour.partiesDepuis(minuits[0], profileId),
      deps.campagne.seriesDepuis(minuits[0], profileId),
      deps.profiles.soireesDuQgDe(profileId, minuits[0]),
    ])
    const seules: PartieSeule[] = [
      ...parties.map(p => ({ qui: p.qui, quand: p.quand, mode: 'jour' as const, questions: p.questions })),
      ...series.map(s => ({ qui: s.qui, quand: s.quand, mode: modeDeLaSerie(s.mode), questions: s.questions })),
    ]
    const [sienne] = activiteDesJoueurs(seules, soirees, minuits, maintenant)
    return sienne ? { questions: sienne.questions, parties: sienne.parties, jours: sienne.jours } : { questions: parModeVide(), parties: parModeVide(), jours: 0 }
  }

  /** Le profil que vise la route, suspendu compris ; sinon la réponse est partie (404). */
  const leProfil = async (req: Request, res: Response): Promise<ProfileRec | null> => {
    const p = await deps.profiles.pourLAdministrateur(String(req.params.id))
    if (!p) res.status(404).json({ error: 'Ce profil est introuvable' })
    return p
  }
  /** Le profil de l'administrateur qui regarde : il ne se suspend, ne se supprime ni ne se renomme d'ici. */
  const estLeSien = (res: Response, p: ProfileRec) => deps.auth.byProfile(p.id)?.id === accountOf(res).id
  /** Comment la phrase du journal nomme un profil : son prénom et son identifiant, sans jamais s'accorder à lui. */
  const nomme = (p: ProfileRec) => `${p.name} (@${p.login})`

  app.get(
    '/api/admin/profils',
    wrap(async (req, res) => {
      const { total, profils } = await deps.profiles.pourLAdministration(typeof req.query.q === 'string' ? tronquer(req.query.q, 40) : '')
      const moi = accountOf(res)
      res.json({ total, profils: await Promise.all(profils.map(p => ligne(moi, p))) })
    }),
  )

  // La fiche d'un joueur : où il en est dans chaque mode, ses confettis, sa
  // connexion, l'épreuve qui l'attend. Une base qui se tait sur un mode ôte
  // ce mode, pas la fiche.
  app.get(
    '/api/admin/profils/:id',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      const [soirees, jour, campagne, duels, boutique, epreuve, activite] = await Promise.all([
        deps.profiles.soireesDe([p.id]).then(n => n.get(p.id) ?? 0),
        deps.jour.resumeDe(p.id).catch(() => null),
        deps.profiles.statsDeCampagne?.(p.id).catch(() => null) ?? null,
        deps.profiles.duelsDe?.(p.id).catch(() => null) ?? null,
        deps.profiles.boutiqueEtDons(p, jourDe(deps.maintenant())).catch(() => null),
        deps.campagne.epreuveLaissee(p.id).catch(() => null),
        sesTrenteJours(p.id).catch(() => null),
      ])
      const fiche: FicheDuJoueur = {
        ...(await ligne(accountOf(res), { profil: p, niveau: deps.profiles.niveauOf(p), soirees })),
        creeLe: p.createdAt,
        enLigne: deps.profiles.enLigne(p.id),
        masque: deps.jour.estMasque(p.id),
        suspenduLe: p.disabledAt,
        jour,
        campagne: campagne ? { record: campagne.record, justes: campagne.justes } : null,
        duels: duels ? { ligue: duels.ligue, cote: duels.cote } : null,
        confettis: boutique ? { solde: boutique.boutique.confettis.solde, offerts: boutique.dons.reduce((n, d) => n + d.confettis, 0) } : null,
        connexion: { fermeeJusquA: fermeeJusquA(p.login) },
        epreuve,
        activite,
      }
      res.json(fiche)
    }),
  )

  // Offrir des confettis : un geste pour quelqu'un — un mot facultatif, dit
  // une fois sur son accueil —, jamais à un profil suspendu, qui ne le
  // verrait pas. À soi aussi : c'est son serveur (« je peux pas m'octroyer des
  // confettis », le propriétaire, le 14 octobre 2026 — la route le refusait).
  app.post(
    '/api/admin/profils/:id/confettis',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      if (p.disabledAt) return res.status(400).json({ error: 'Réactive d’abord ce profil' })
      const don = await deps.profiles.offrirDesConfettis(p.id, req.body?.confettis, req.body?.mot)
      noterLeGeste(res, {
        sorte: 'profil',
        resume: `${don.confettis} confetti${don.confettis > 1 ? 's offerts' : ' offert'} : ${nomme(p)}${don.mot ? ` — « ${don.mot} »` : ''}`,
        cible: p.id,
      })
      res.json({ ok: true, ...don })
    }),
  )

  // Aider à se reconnecter : un code de secours neuf, montré une fois ici,
  // que l'administrateur transmet ; le joueur le tape dans « Mot de passe
  // oublié ? », qui lui en rend un autre. Le code ne va jamais au journal.
  app.post(
    '/api/admin/profils/:id/secours',
    wrap(async (req, res) => {
      res.set('Cache-Control', 'no-store')
      const p = await leProfil(req, res)
      if (!p) return
      if (p.disabledAt) return res.status(400).json({ error: 'Réactive d’abord ce profil : suspendu, il ne se connecte pas' })
      const code = await deps.profiles.nouveauCodeDeSecours(p.id)
      noterLeGeste(res, { sorte: 'profil', resume: `Code de secours neuf tiré : ${nomme(p)}`, cible: p.id })
      res.json({ code, login: p.login })
    }),
  )

  // Changer un prénom qui ne va pas — pas pour départager deux homonymes, qui
  // se règlent à l'affichage (invariant 17). Le sien se change depuis son profil.
  // Une soirée en cours garde celui de son arrivée (invariant 9) : rien à rediffuser.
  app.post(
    '/api/admin/profils/:id/prenom',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      if (estLeSien(res, p)) return res.status(400).json({ error: 'Ton prénom se change depuis ton profil' })
      const { avant, apres } = await deps.profiles.renommer(p.id, req.body?.nom)
      noterLeGeste(res, { sorte: 'profil', resume: `Profil renommé : « ${avant} » devient « ${apres} » (@${p.login})`, cible: p.id })
      res.json({ ok: true, nom: apres })
    }),
  )

  // Suspendre : ni connexion, ni place aux classements, rien d'effacé. Jamais
  // le sien, et jamais pendant une soirée pas encore close qui le compte :
  // sa clôture ne le trouverait plus, et il perdrait ce qu'elle lui doit.
  app.post(
    '/api/admin/profils/:id/suspendre',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      if (estLeSien(res, p)) return res.status(400).json({ error: 'C’est ton propre profil : il ne se suspend pas' })
      if (p.disabledAt) return res.status(400).json({ error: 'Ce profil est déjà suspendu' })
      const ailleurs = deps.soireesPasCloses(p.id)
      if (ailleurs.length > 0) {
        const chez = deps.auth.byId(ailleurs[0])?.name ?? 'un autre animateur'
        return res.status(409).json({ error: `${p.name} joue une soirée pas encore close chez ${chez} : elle doit être close d’abord` })
      }
      await deps.profiles.suspendre(p.id)
      // Les consoles que ce profil avait ouvertes tombent avec ses sessions (invariant 16).
      await deps.auth.revokeProfileSessions(p.id)
      noterLeGeste(res, { sorte: 'profil', resume: `Profil suspendu : ${nomme(p)}`, cible: p.id })
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/profils/:id/reactiver',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      if (!p.disabledAt) return res.status(400).json({ error: 'Ce profil n’est pas suspendu' })
      await deps.profiles.reactiver(p.id)
      noterLeGeste(res, { sorte: 'profil', resume: `Profil réactivé : ${nomme(p)}`, cible: p.id })
      res.json({ ok: true })
    }),
  )

  // Lever le verrou de connexion : cinq essais manqués la ferment un quart
  // d'heure ; le joueur au bout du fil, l'administrateur la rouvre — ses deux
  // portes, le mot de passe et le code de secours.
  app.post(
    '/api/admin/profils/:id/connexion',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      if (fermeeJusquA(p.login) === null) return res.status(400).json({ error: 'Sa connexion n’est pas fermée' })
      for (const cle of clesDeConnexion(p.login)) budget.rouvrir(cle)
      noterLeGeste(res, { sorte: 'profil', resume: `Verrou de connexion levé : ${nomme(p)}`, cible: p.id })
      res.json({ ok: true })
    }),
  )

  // Libérer l'épreuve de sentier qui l'attend : une seule à la fois, et tant
  // qu'elle attend, il n'en commence aucune autre. Refermée sans lui coûter de vie.
  app.post(
    '/api/admin/profils/:id/epreuve',
    wrap(async (req, res) => {
      const p = await leProfil(req, res)
      if (!p) return
      const liberee = await deps.campagne.libererEpreuve(p.id)
      if (!liberee) return res.status(404).json({ error: 'Aucune épreuve ne l’attend' })
      noterLeGeste(res, {
        sorte: 'profil',
        resume: `Épreuve de sentier libérée, sans coûter de vie : ${nomme(p)} — ${liberee.sentier}, palier ${liberee.palier}`,
        cible: p.id,
      })
      res.json({ ok: true, ...liberee })
    }),
  )

  // « Les salons » : tous les espaces, chacun avec son titulaire — les
  // profils se chargent d'un coup (`byIds`), pas un aller-retour par espace.
  // `/api/admin/accounts` reste, pour les pages d'avant.
  app.get(
    '/api/admin/espaces',
    wrap(async (_req, res) => {
      const moi = accountOf(res)
      const comptes = deps.auth.list()
      const profils = await deps.profiles.byIds(comptes.flatMap(a => (a.profileId ? [a.profileId] : [])))
      const parId = new Map(profils.flatMap(p => (p ? [[p.id, p] as const] : [])))
      const espaces: EspaceDAdministration[] = await Promise.all(
        comptes.map(async a => {
          const titulaire = a.profileId ? parId.get(a.profileId) : undefined
          return {
            ...deps.auth.toPublic(a),
            salon: estUnSalon(a),
            titulaire: titulaire ? { nom: titulaire.name, avatar: titulaire.avatar } : null,
            quiz: await deps.store.count(a.id),
            toi: a.id === moi.id,
          }
        }),
      )
      res.json(espaces)
    }),
  )

  // Rattacher un espace sans titulaire à un profil : fusionner deux
  // identités d'avant — un compte d'animateur et un profil créé à part —,
  // que le serveur ne pouvait pas deviner être la même personne (un seul
  // profil, le choix du 3 octobre 2026). Si le profil tenait déjà un salon,
  // ses quiz rejoignent l'espace rattaché, photos comprises, et le salon
  // d'avant reste, détaché : les souvenirs de ses soirées s'ouvrent toujours.
  app.post(
    '/api/admin/espaces/:id/titulaire',
    wrap(async (req, res) => {
      const moi = accountOf(res)
      const cible = deps.auth.byId(req.params.id)
      if (!cible) return res.status(404).json({ error: 'Cet espace est introuvable' })
      if (cible.profileId) return res.status(400).json({ error: 'Cet espace a déjà un titulaire' })
      if (cible.disabledAt) return res.status(400).json({ error: 'Réactive d’abord cet espace' })
      const profil = await deps.profiles.byLogin(req.body?.login)
      if (!profil) return res.status(404).json({ error: 'Aucun profil à cet identifiant' })
      const ancien = deps.auth.byProfile(profil.id)
      if (ancien?.id === moi.id) return res.status(400).json({ error: 'C’est ton propre profil : il garde ton espace' })
      let recopies = 0
      if (ancien) {
        const titres = (await deps.store.list(cible.id)).map(q => q.title)
        for (const resume of await deps.store.list(ancien.id)) {
          const quiz = await deps.store.get(ancien.id, resume.id)
          if (!quiz) continue
          const questions = await deps.store.copierPhotos(cible.id, quiz.questions)
          const titre = titreLibre(quiz.title, titres)
          titres.push(titre)
          await deps.store.create(cible.id, titre, questions, undefined, quiz.reglages)
          recopies++
        }
        await deps.auth.linkProfile(ancien.id, null)
      }
      await deps.auth.linkProfile(cible.id, profil.id)
      if (recopies > 0) await deps.onLibraryChanged(cible.id)
      noterLeGeste(res, {
        sorte: 'salon',
        resume: `Espace « ${cible.name} » rattaché au profil ${deNom(profil.name)} (@${profil.login})${recopies > 0 ? `, ${recopies} quiz recopié${recopies > 1 ? 's' : ''} de son ancien salon` : ''}`,
        cible: profil.id,
      })
      res.json({ ok: true, recopies, ancien: ancien ? ancien.slug : null })
    }),
  )

  // Supprimer un profil : jamais le sien — l'administrateur s'enfermerait
  // dehors —, et jamais pendant qu'il joue une soirée pas encore close, son
  // salon compris : sa clôture le créditerait, lui, ses prix, ses hauts faits
  // et ses paliers, sous un identifiant qui n'existe plus. L'espace qu'il
  // tenait reste, détaché — les souvenirs des soirées qu'on y a jouées
  // s'ouvrent toujours (l'arbitrage du 3 octobre 2026). Un profil suspendu se
  // supprime aussi.
  app.delete(
    '/api/admin/profils/:id',
    wrap(async (req, res) => {
      const profil = await leProfil(req, res)
      if (!profil) return
      const salon = deps.auth.byProfile(profil.id)
      if (salon?.id === accountOf(res).id) return res.status(400).json({ error: 'C’est ton propre profil : il ne se supprime pas d’ici' })
      const ailleurs = deps.soireesPasCloses(profil.id)
      if (ailleurs.length > 0) {
        const chez = deps.auth.byId(ailleurs[0])?.name ?? 'un autre animateur'
        return res.status(409).json({ error: `${profil.name} joue une soirée pas encore close chez ${chez} : elle doit être close d’abord` })
      }
      const fait = await deps.supprimerProfil(profil.id)
      noterLeGeste(res, {
        sorte: 'profil',
        resume: `Profil supprimé : ${nomme(profil)}${fait.salon === 'detache' ? ' — son salon reste, sans titulaire' : ''}`,
        cible: profil.id,
      })
      res.json({ ok: true, ...fait })
    }),
  )
}
