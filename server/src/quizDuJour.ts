import { createHash, timingSafeEqual } from 'node:crypto'
import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import type { JourStore } from './core/jour'
import type { RappelStore } from './core/rappels'
import { idDeSession, type ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { extrait, noterLeGeste } from './core/journalDesGestes'
import { readPlayerToken, requireAdmin } from './auth/http'
import { A_ECRIRE_A_LA_MAIN, A_ECRIRE_MAX } from './core/consigne'
import { consigneDEtiquetage } from './core/etiquetage'
import { parseImportedQuestions } from '../../shared/library'
import { HEURE_DU_RAPPEL, jourAvant, jourDe, jourValide, moisDe } from '../../shared/jour'
import { tronquer } from '../../shared/avatars'
import { apparenceDeLAvatar } from '../../shared/profil'
import { LIGNES_DU_MOIS_AU_QG, SERIES_NOMMEES, TOURNEES_MONTREES, partDesBonnes, repartirLesSeries, type SuiviDuJour } from '../../shared/qgDuJour'

interface JourDeps {
  jour: JourStore
  profiles: ProfileStore
  /** L'heure du serveur, celle du magasin : un classement « d'aujourd'hui » se lit au même jour. */
  maintenant: () => number
  /** Une routine peut remplir la réserve : `RESERVE_TOKEN` est posé. L'administration le dit. */
  reserveAutomatique?: boolean
}

const MOIS = /^\d{4}-\d{2}$/

/**
 * Les routes du quiz du jour, pour les profils : jouer, se classer, relire,
 * signaler. Elles passent AVANT la porte des animateurs — un joueur n'a pas
 * de compte d'animateur —, derrière celle des profils : un invité anonyme
 * n'a pas de quiz du jour, et le serveur le lui dit sans détour.
 */
export function mountJour(app: Express, deps: JourDeps & { rappels: RappelStore }) {
  const petit = express.json({ limit: '4kb' })

  /** Le profil connecté, ou un 401 qui dit quoi faire. */
  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour jouer au quiz du jour' })
    return profil
  }

  // Le rappel du soir (`core/rappels.ts`) : la clé du serveur, que le
  // téléphone donne à son service de push en s'abonnant, puis l'abonnement
  // lui-même — attaché à la session qui le demande : une déconnexion le défait.
  // Chaque réponse dit son réglage, que la cloche montre. Seul le quiz du jour
  // sonne : la cloche des défis est partie le 13 octobre 2026. Une page
  // d'avant, ouverte sur les duels, la demande encore (`quoi: 'defis'`) :
  // l'allumer est refusé ; rattachée ou coupée, elle ne change rien et lit le
  // réglage du soir — la voilà éteinte, et le téléphone ne se désabonne pas
  // de ce qui sonne encore.
  const lesDefis = (req: Request) => req.body?.quoi === 'defis'
  app.get(
    '/api/jour/rappel',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json({ cle: deps.rappels.clePublique(), heure: HEURE_DU_RAPPEL })
    }),
  )

  app.post(
    '/api/jour/rappel',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      if (lesDefis(req) && req.body?.activer === true) throw new Error('Les duels ne sonnent plus : seul le quiz du jour a son rappel, sur sa page')
      if (lesDefis(req)) return void res.json({ ok: true, ...(await deps.rappels.reglages(profil.id, req.body?.abonnement?.endpoint)) })
      // Le jeton est là : `profilDe` vient de le lire.
      const reglages = await deps.rappels.abonner(
        profil.id,
        idDeSession(readPlayerToken(req.header('cookie'))!),
        req.body?.abonnement,
        req.body?.activer === true,
        req.body?.ancien,
      )
      res.json({ ok: true, ...reglages })
    }),
  )

  app.delete(
    '/api/jour/rappel',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const reglages = lesDefis(req) ? await deps.rappels.reglages(profil.id, req.body?.endpoint) : await deps.rappels.desabonner(profil.id, req.body?.endpoint)
      res.json({ ok: true, ...reglages })
    }),
  )

  app.get(
    '/api/jour',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const etat = await deps.jour.etat(profil)
      // Sans l'en-tête maison, c'est le préchargement que la page a posé
      // (`shared/depart.ts`) : la réponse arrivera à son `fetch` déjà là, et
      // l'heure qu'elle porte ne se mesure plus autour de lui. Elle le dit.
      res.json(req.header('x-requested-with') === 'quizz' ? etat : { ...etat, prechargee: true })
    }),
  )

  app.post(
    '/api/jour/commencer',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.jour.commencer(profil))
    }),
  )

  app.post(
    '/api/jour/suivante',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.jour.suivante(profil))
    }),
  )

  app.post(
    '/api/jour/repondre',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const { jour, index, choix } = req.body ?? {}
      res.json(await deps.jour.repondre(profil, String(jour ?? ''), Number(index), choix))
    }),
  )

  // Des sabliers pour sa série, en confettis — la boutique en prend un ou
  // deux d'un coup : le profil tient le solde, le quiz du jour compte ceux
  // qui restent (`serieAvecSabliers`).
  app.post(
    '/api/jour/sablier',
    express.json({ limit: '1kb' }),
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const maintenant = deps.maintenant()
      const jour = jourDe(maintenant)
      const nombre = req.body?.nombre === undefined ? 1 : Number(req.body.nombre)
      const sabliers = await deps.profiles.acheterSablier(profil.id, jour, id => deps.jour.sabliersDe(id), maintenant, nombre)
      res.json({ sabliers, confettis: (await deps.profiles.boutiqueDe(profil, jour)).confettis })
    }),
  )

  // `?jour=2026-09-25` ou `?mois=2026-09` ; aujourd'hui par défaut.
  app.get(
    '/api/jour/classement',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const mois = typeof req.query.mois === 'string' ? req.query.mois : ''
      if (MOIS.test(mois)) return res.json(await deps.jour.classementDuMois(mois, profil.id))
      const jour = jourValide(req.query.jour) ? req.query.jour : jourDe(deps.maintenant())
      res.json(await deps.jour.classementDuJour(jour, profil.id))
    }),
  )

  app.get(
    '/api/jour/correction/:jour',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const correction = await deps.jour.correction(profil, req.params.jour)
      // Avant minuit, pour qui n'a pas fini : elle donnerait le quiz à qui ne l'a pas joué.
      if (!correction) return res.status(404).json({ error: 'La correction s’ouvre quand tu as fini, ou à minuit' })
      res.json(correction)
    }),
  )

  app.post(
    '/api/jour/signaler',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const { jour, index, texte } = req.body ?? {}
      await deps.jour.signaler(profil, String(jour ?? ''), Number(index), texte)
      res.json({ ok: true })
    }),
  )
}

const empreinte = (jeton: string) => createHash('sha256').update(jeton).digest()

/**
 * La réserve, pour la routine qui la remplit (`RESERVE_TOKEN`) : ce qu'il
 * faut écrire — la consigne —, puis le dépôt. Un jeton qui ne sait faire
 * que ça : ni lire un profil, ni retirer une question. Mais la consigne
 * rappelle les intitulés déjà en réserve, ceux des prochains jours d'abord
 * — l'IA ne les réécrit pas : le jeton les vaut. Gardé tel quel à
 * l'arbitrage du 27 septembre 2026 ; s'il fuit, on le change des deux
 * côtés (docs/exploitation/mise-en-ligne.md, étape 9). Sans jeton posé, la porte n'existe pas.
 *
 * La routine tourne sur l'abonnement Claude de l'administrateur : aucune
 * clé d'IA n'est confiée au serveur. Elle passe AVANT la porte des
 * animateurs — elle n'en est pas un —, mais derrière la protection contre
 * les requêtes forgées : son dépôt porte `X-Requested-With: quizz`, comme
 * toute écriture.
 */
/**
 * La porte du jeton de la réserve, AVANT de lire le corps : sans elle,
 * n'importe qui faisait analyser un quart de mégaoctet de JSON au serveur.
 * Les jetons se comparent par leur empreinte, en temps constant : ni le
 * jeton ni sa longueur ne se devinent à la montre. La même pour la base de
 * la campagne (`mountBaseDeLaCampagne`) : une routine, un jeton.
 */
export function porteDeLaReserve(jeton: string | null) {
  const attendu = jeton ? empreinte(jeton) : null
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store')
    if (!attendu) return res.status(404).json({ error: 'Le dépôt automatique n’est pas ouvert sur ce serveur' })
    const recu = /^Bearer\s+(\S+)$/i.exec(req.header('authorization') ?? '')?.[1] ?? ''
    if (!timingSafeEqual(empreinte(recu), attendu)) return res.status(401).json({ error: 'Jeton de la réserve refusé' })
    next()
  }
}

export function mountReserve(app: Express, deps: { jour: JourStore; jeton: string | null }) {
  const depot = express.json({ limit: '256kb' })
  const porte = porteDeLaReserve(deps.jeton)

  app.get(
    '/api/jour/reserve',
    porte,
    wrap(async (_req, res) => {
      res.json({ ...(await deps.jour.consigne()), parEnvoi: A_ECRIRE_MAX })
    }),
  )

  app.post(
    '/api/jour/reserve',
    porte,
    depot,
    wrap(async (req, res) => {
      const liste = typeof req.body?.liste === 'string' ? req.body.liste : ''
      if (!liste.trim()) return res.status(400).json({ error: 'Envoie les questions dans « liste », au format de la consigne' })
      const lu = parseImportedQuestions(liste)
      if (lu.questions.length > A_ECRIRE_MAX) {
        return res.status(400).json({ error: `${A_ECRIRE_MAX} questions au plus par envoi : coupe la liste en plusieurs` })
      }
      const { ajoutees, ecartees } = await deps.jour.ajouter(lu.questions, 'ia')
      console.log(`[jour] dépôt de la routine : ${ajoutees} ajoutée${ajoutees > 1 ? 's' : ''}, ${ecartees.length} écartée${ecartees.length > 1 ? 's' : ''}`)
      res.json({ ajoutees, ecartees, ignores: lu.ignores })
    }),
  )

  /**
   * L'étiquetage de la réserve, par la même routine et le même jeton : la
   * consigne d'étiquetage (`core/etiquetage.ts`), et les questions qui n'ont
   * pas encore leurs métadonnées, cinquante au plus — ce qu'une IA décrit
   * bien d'un coup. Le jeton n'en apprend pas plus qu'il n'écrivait déjà.
   */
  app.get(
    '/api/jour/reserve/etiquetage',
    porte,
    wrap(async (_req, res) => {
      const questions = await deps.jour.aEtiqueter(ETIQUETER_PAR_ENVOI)
      res.json({ consigne: consigneDEtiquetage(questions.length || ETIQUETER_PAR_ENVOI), questions })
    }),
  )

  app.post(
    '/api/jour/reserve/etiquetage',
    porte,
    depot,
    wrap(async (req, res) => {
      const entrees: unknown = req.body?.etiquetage
      if (!Array.isArray(entrees)) return res.status(400).json({ error: 'Envoie le tableau rendu dans « etiquetage »' })
      if (entrees.length > ETIQUETER_PAR_ENVOI) return res.status(400).json({ error: `${ETIQUETER_PAR_ENVOI} questions au plus par envoi` })
      const fait = await deps.jour.etiqueter(entrees)
      console.log(`[jour] étiquetage de la routine : ${fait.etiquetees} décrites, ${fait.horsBase} hors de la base, ${fait.refusees.length} refusées`)
      res.json(fait)
    }),
  )
}

/** Ce qu'une IA décrit bien d'un coup : la consigne d'étiquetage a été essayée sur cinquante questions. */
const ETIQUETER_PAR_ENVOI = 50

/**
 * La réserve, les signalements et les profils masqués, pour l'administrateur
 * seul (`/admin`), et ce que le QG suit du quiz du jour. Passe derrière la
 * porte des animateurs.
 */
export function mountJourAdmin(app: Express, deps: JourDeps & { rappels: Pick<RappelStore, 'suivi'> }) {
  /** Une question d'un jour joué, telle que le journal du QG la cite — et ce qu'elle était dans la réserve. */
  const questionDuJour = async (jour: unknown, index: number) => {
    const q = jourValide(jour) ? (await deps.jour.tirage(jour))?.questions[index] : undefined
    return { cite: q ? `« ${extrait(q.texte)} »` : `la question ${index + 1} du ${String(jour)}`, reserveId: q?.reserveId ?? null }
  }

  app.get(
    '/api/admin/jour',
    requireAdmin,
    wrap(async (_req, res) => {
      const [reserve, signalements, masques] = await Promise.all([
        deps.jour.etatDeLaReserve(),
        deps.jour.signalements(),
        deps.jour.profilsPourLAdministration(''),
      ])
      res.json({
        reserve,
        signalements,
        masques,
        remplissage: { automatique: !!deps.reserveAutomatique },
        aujourdhui: jourDe(deps.maintenant()),
        mois: moisDe(jourDe(deps.maintenant())),
      })
    }),
  )

  // Ce que le QG suit du quiz du jour (`shared/qgDuJour.ts`) : le tirage
  // d'aujourd'hui question par question, le classement du mois, les séries
  // qui tiennent, le rappel du soir. À part de la réserve, que la page
  // montre d'abord sans attendre les séries.
  app.get(
    '/api/admin/jour/suivi',
    requireAdmin,
    wrap(async (_req, res) => {
      const maintenant = deps.maintenant()
      const jour = jourDe(maintenant)
      const mois = moisDe(jour)
      const [aujourdhui, hier, classement, lues, rappel] = await Promise.all([
        deps.jour.suiviDAujourdhui(),
        deps.jour.bonnesDUnJourClos(jourAvant(jour)),
        deps.jour.classementDuMois(mois, null),
        deps.jour.seriesEnCours(),
        deps.rappels.suivi(TOURNEES_MONTREES),
      ])
      // Les plus longues, nommées : un profil qui ne se lit plus laisse sa place au suivant.
      const candidates = lues.series.slice(0, SERIES_NOMMEES * 2)
      const profils = await deps.profiles.byIds(candidates.map(s => s.profileId))
      const plusLongues = candidates
        .flatMap((s, i) => {
          const p = profils[i]
          // Ce qu'il porte, comme au classement : l'emoji seul montrait autrement qui porte un légendaire.
          return p
            ? [{ profileId: s.profileId, nom: p.name, avatar: deps.profiles.avatarPorte(p), ...apparenceDeLAvatar(deps.profiles.apparenceDe(p)), serie: s.serie, tenue: s.tenue }]
            : []
        })
        .slice(0, SERIES_NOMMEES)
      const suivi: SuiviDuJour = {
        maintenant,
        jour,
        parties: aujourdhui.parties,
        bonnes: { aujourdhui: partDesBonnes(aujourdhui.questions), hier },
        questions: aujourdhui.questions,
        mois: { mois, joueurs: classement.joueurs, lignes: classement.lignes.slice(0, LIGNES_DU_MOIS_AU_QG), masques: deps.jour.nombreDeMasques() },
        series: { parTranche: repartirLesSeries(lues.series.map(s => s.serie)), total: lues.series.length, plusLongues, sabliersDuMois: lues.sabliersDuMois },
        rappel,
      }
      res.json(suivi)
    }),
  )

  // « Copier la consigne pour une IA » : la même que celle de la routine,
  // pour un chatbot où l'on colle à la main — trente questions d'un coup.
  app.get(
    '/api/admin/jour/consigne',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.jour.consigne(A_ECRIRE_A_LA_MAIN))
    }),
  )

  app.get(
    '/api/admin/jour/prochaines',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.jour.prochaines())
    }),
  )

  // « Coller une liste » : le même format, le même analyseur que l'éditeur.
  app.post(
    '/api/admin/jour/liste',
    requireAdmin,
    wrap(async (req, res) => {
      const texte = typeof req.body?.texte === 'string' ? req.body.texte : ''
      if (!texte.trim()) return res.status(400).json({ error: 'Colle une liste de questions' })
      const lu = parseImportedQuestions(texte)
      const { ajoutees, ecartees } = await deps.jour.ajouter(lu.questions, 'liste')
      noterLeGeste(res, {
        sorte: 'jour',
        resume: `Liste collée au quiz du jour : ${ajoutees} question${ajoutees > 1 ? 's' : ''} ajoutée${ajoutees > 1 ? 's' : ''}${ecartees.length > 0 ? `, ${ecartees.length} écartée${ecartees.length > 1 ? 's' : ''}` : ''}`,
      })
      res.json({ ajoutees, ecartees, ignores: lu.ignores })
    }),
  )

  app.post(
    '/api/admin/jour/garder',
    requireAdmin,
    wrap(async (req, res) => {
      await deps.jour.garder(String(req.body?.jour ?? ''), Number(req.body?.index))
      const q = await questionDuJour(req.body?.jour, Number(req.body?.index))
      noterLeGeste(res, { sorte: 'jour', resume: `Question du jour gardée, ses signalements refermés : ${q.cite}`, cible: q.reserveId })
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/jour/annuler',
    requireAdmin,
    wrap(async (req, res) => {
      await deps.jour.annuler(String(req.body?.jour ?? ''), Number(req.body?.index))
      const q = await questionDuJour(req.body?.jour, Number(req.body?.index))
      noterLeGeste(res, { sorte: 'jour', resume: `Question du jour annulée pour tous : ${q.cite}`, cible: q.reserveId })
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/jour/retirer',
    requireAdmin,
    wrap(async (req, res) => {
      const reserveId = String(req.body?.reserveId ?? '')
      const texte = await deps.jour.texteDeLaReserve(reserveId)
      const retiree = await deps.jour.retirer(reserveId)
      if (!retiree) return res.status(404).json({ error: 'Cette question n’est plus dans la réserve' })
      // Ses signalements, s'il y en avait, n'ont plus rien à attendre.
      if (jourValide(req.body?.jour)) await deps.jour.garder(req.body.jour, Number(req.body?.index))
      noterLeGeste(res, { sorte: 'jour', resume: `Question retirée de la réserve du quiz du jour : « ${extrait(texte ?? reserveId)} »`, cible: reserveId })
      res.json({ ok: true })
    }),
  )

  app.get(
    '/api/admin/jour/profils',
    requireAdmin,
    wrap(async (req, res) => {
      res.json(await deps.jour.profilsPourLAdministration(typeof req.query.q === 'string' ? tronquer(req.query.q, 40) : ''))
    }),
  )

  app.post(
    '/api/admin/jour/masquer',
    requireAdmin,
    wrap(async (req, res) => {
      // Suspendu compris, que `byId` tait : la liste des masqués le montre
      // encore, et « Remettre au classement » y répondait « Profil introuvable ».
      const profil = await deps.profiles.pourLAdministrateur(String(req.body?.profileId ?? ''))
      if (!profil) return res.status(404).json({ error: 'Profil introuvable' })
      const masque = req.body?.masque !== false
      await deps.jour.masquer(profil.id, masque)
      noterLeGeste(res, {
        sorte: 'jour',
        resume: `Profil ${masque ? 'masqué du' : 'remis au'} classement du quiz du jour : ${profil.name} (@${profil.login})`,
        cible: profil.id,
      })
      res.json({ ok: true })
    }),
  )
}
