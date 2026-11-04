import type { Express } from 'express'
import { wrap } from './core/http'
import { enTranches } from './core/tourniquet'
import { accountOf } from './auth/http'
import { estUnSalon, type AuthStore } from './auth/store'
import type { ProfileStore } from './auth/profiles'
import type { AudienceDuQg } from './joueursDuQg'
import type { QuizDuCarnet } from './core/quizStore'
import { nomDeLEspace } from '../../shared/space'
import {
  SEGMENTS_DES_ANIMATEURS,
  carnetEnTranches,
  etatDuSegment,
  titulairesDuCarnet,
  type CarnetDesAnimateurs,
  type ComptesDesAnimateurs,
  type EtatDUnSalon,
  type SalonDuCarnet,
  type SegmentDesAnimateurs,
} from '../../shared/qgAnimateurs'

export interface AnimateursDeps {
  /** Les comptes — les espaces —, en mémoire. */
  auth: Pick<AuthStore, 'list'>
  /** Les soirées gardées jusqu'à minuit, et les profils : ce que la page des joueurs lit déjà, lu une fois pour les deux. */
  audience: Pick<AudienceDuQg, 'lesSoirees' | 'lesProfils'>
  profiles: Pick<ProfileStore, 'nomsPourLeQg'>
  /** L'origine et la naissance des quiz de chaque espace, en mémoire (`QuizStore.quizDesEspaces`). */
  quizDesEspaces: () => ReadonlyMap<string, ReadonlyMap<string, QuizDuCarnet>>
  /** Les quiz prêts d'un espace — ceux que sa soirée peut lancer —, en mémoire (`quizLibrary`). */
  quizPrets: (spaceId: string) => readonly string[]
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
}

/**
 * Le carnet des animateurs (`/admin#animateurs`, le QG 2 — la revue d'analyse
 * du 4 novembre 2026, P1.1) : une ligne par salon ouvert, ses soirées, son
 * rythme et son état, l'entonnoir d'un nouvel animateur ; et ce qu'en lisent
 * les annonces (« Leur écrire ») et la fiche d'un joueur qui tient un salon.
 *
 * Rien ne se lit pour lui seul : les comptes et les quiz sont en mémoire ; les
 * fiches des soirées des jours finis et les profils nés avant aujourd'hui, la
 * page des joueurs les garde jusqu'à minuit (`audienceDuQg`), et seules celles
 * d'aujourd'hui se relisent, par l'index de leur date. Le calcul se fait en
 * tranches. Des soirées des autres, le salon et des chiffres : ni un titre, ni
 * une question, ni un prénom d'invité — leurs fiches restent au serveur.
 */
export function animateursDuQg(deps: AnimateursDeps) {
  const leCarnet = async (moi: string | null): Promise<CarnetDesAnimateurs> => {
    const maintenant = deps.maintenant()
    const comptes = deps.auth.list()
    const ouverts = comptes.filter(a => !a.disabledAt)
    const [{ lu, soirees }, profils, noms] = await Promise.all([
      deps.audience.lesSoirees(),
      deps.audience.lesProfils(),
      deps.profiles.nomsPourLeQg(ouverts.flatMap(a => (a.profileId ? [a.profileId] : []))),
    ])
    const suspendus = new Set(profils.filter(p => p.suspendu).map(p => p.id))
    const quiz = deps.quizDesEspaces()
    const salons: SalonDuCarnet[] = ouverts.map(a => {
      const nom = a.profileId ? noms.get(a.profileId) : undefined
      const titulaire = a.profileId && nom ? { id: a.profileId, nom: nom.nom, login: nom.login, suspendu: suspendus.has(a.profileId) } : null
      const siens = quiz.get(a.id)
      return {
        spaceId: a.id,
        nom: nomDeLEspace({ salon: estUnSalon(a), titulaire: titulaire && { nom: titulaire.nom }, name: a.name }),
        titulaire,
        toi: a.id === moi,
        neLe: a.createdAt,
        quiz: { total: siens?.size ?? 0, prets: deps.quizPrets(a.id).map(id => siens?.get(id)?.origine ?? null) },
      }
    })
    const calcul = await enTranches(carnetEnTranches(salons, soirees, profils, maintenant))
    return { maintenant, lu, ...calcul, desactives: comptes.length - ouverts.length }
  }

  return {
    /** Le carnet (`GET /api/admin/animateurs`) ; `moi`, l'espace de l'administrateur qui regarde. */
    carnet: (moi: string | null) => leCarnet(moi),

    /** Combien chaque segment des animateurs toucherait de titulaires : ce que la page des annonces propose. */
    async comptes(): Promise<ComptesDesAnimateurs> {
      const c = await leCarnet(null)
      return {
        maintenant: c.maintenant,
        comptes: Object.fromEntries(SEGMENTS_DES_ANIMATEURS.map(s => [s, titulairesDuCarnet(c.salons, etatDuSegment(s)).length])) as Record<SegmentDesAnimateurs, number>,
      }
    },

    /** Les titulaires d'un segment à l'instant, ni détachés ni suspendus : les destinataires d'une annonce qui lui est écrite. */
    async titulairesDuSegment(segment: SegmentDesAnimateurs): Promise<string[]> {
      return titulairesDuCarnet((await leCarnet(null)).salons, etatDuSegment(segment))
    },

    /** L'état d'un salon et sa dernière soirée : la fiche de son titulaire. Null, un espace qui n'est pas ouvert. */
    async duSalon(spaceId: string): Promise<{ etat: EtatDUnSalon; derniere: number | null } | null> {
      const ligne = (await leCarnet(null)).salons.find(l => l.spaceId === spaceId)
      return ligne ? { etat: ligne.etat, derniere: ligne.derniere } : null
    },
  }
}

export type AnimateursDuQg = ReturnType<typeof animateursDuQg>

/**
 * Les routes du carnet, sous `/api/admin` — gardées d'un bloc (`api.ts`),
 * elles entrent d'elles-mêmes dans `admin-seulement.test.ts`. Elles lisent, et
 * ne changent rien qu'on noterait au journal.
 */
export function mountAnimateurs(app: Express, animateurs: AnimateursDuQg) {
  app.get(
    '/api/admin/animateurs',
    wrap(async (_req, res) => {
      res.json(await animateurs.carnet(accountOf(res).id))
    }),
  )
  app.get(
    '/api/admin/animateurs/segments',
    wrap(async (_req, res) => {
      res.json(await animateurs.comptes())
    }),
  )
}
