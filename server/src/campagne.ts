import express, { type Express, type Request, type Response } from 'express'
import type { CampagneStore } from './core/campagne'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { readPlayerToken, requireAdmin } from './auth/http'
import { porteDeLaReserve } from './quizDuJour'
import { CATEGORIES } from '../../shared/categories'
import { jourDe } from '../../shared/jour'
import type { EtatDesSentiers } from '../../shared/sentiers'

interface CampagneDeps {
  campagne: CampagneStore
  profiles: ProfileStore
}

/**
 * Les routes de la campagne solo, pour les profils — comme le quiz du jour,
 * avant la porte des animateurs : un joueur n'a pas de compte d'animateur.
 * Un invité anonyme n'a pas de campagne, et le serveur le lui dit.
 */
export function mountCampagne(app: Express, deps: CampagneDeps) {
  const petit = express.json({ limit: '4kb' })

  const profilDe = async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store')
    const jeton = readPlayerToken(req.header('cookie'))
    const profil = jeton ? await deps.profiles.bySession(jeton) : null
    if (!profil) res.status(401).json({ error: 'Connecte-toi à ton profil pour jouer la campagne' })
    return profil
  }

  app.get(
    '/api/campagne',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.etat(profil.id))
    }),
  )

  app.post(
    '/api/campagne/serie',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      // Seules les catégories de la liste fixe : le reste ne filtrerait rien.
      const brut: unknown = req.body?.categories
      const categories = Array.isArray(brut) ? brut.filter((c): c is string => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c)).slice(0, CATEGORIES.length) : []
      // Un sujet traverse les catégories ; une page d'avant n'en envoie pas. Inconnu, il est refusé avec son motif.
      const sujet: unknown = req.body?.sujet
      res.json(await deps.campagne.commencer(profil.id, categories, typeof sujet === 'string' && sujet ? sujet : undefined))
    }),
  )

  // Le défi entre amis : le lancer — sur des catégories ou un sujet, comme
  // une série —, le relire par son code, le relever. Ses réponses passent par
  // la porte des séries.
  app.post(
    '/api/campagne/duel',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const brut: unknown = req.body?.categories
      const categories = Array.isArray(brut) ? brut.filter((c): c is string => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c)).slice(0, CATEGORIES.length) : []
      const sujet: unknown = req.body?.sujet
      res.json(await deps.campagne.creerUnDuel(profil.id, categories, typeof sujet === 'string' && sujet ? sujet : undefined))
    }),
  )

  app.get(
    '/api/campagne/duels',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.mesDuels(profil.id))
    }),
  )

  app.get(
    '/api/campagne/duel/:code',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.duel(profil.id, req.params.code))
    }),
  )

  app.post(
    '/api/campagne/duel/:code',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.releverUnDuel(profil.id, req.params.code))
    }),
  )

  app.post(
    '/api/campagne/serie/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      res.json(await deps.campagne.repondre(profil.id, String(req.params.id), Number(req.body?.index), req.body?.choix))
    }),
  )

  // « Recommencer » : la série finit là, comme perdue ; le défi ne s'abandonne pas.
  app.post(
    '/api/campagne/serie/:id/abandon',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.abandonnerSerie(profil.id, String(req.params.id)))
    }),
  )

  // « Signaler une erreur » : une question déjà jouée de sa série, en une phrase.
  app.post(
    '/api/campagne/serie/:id/signalement',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      await deps.campagne.signaler(profil.id, String(req.params.id), Number(req.body?.index), req.body?.texte)
      res.json({ ok: true })
    }),
  )

  app.get(
    '/api/campagne/serie/:id/correction',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.correction(profil.id, String(req.params.id)))
    }),
  )

  // ── Le carnet de révision (`shared/revision.ts`) ───────────────────────
  // Une révision est une série d'un autre mode : ses réponses et son
  // signalement passent par les routes de la série, sous son identifiant.

  app.get(
    '/api/campagne/carnet',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.carnet(profil.id))
    }),
  )

  app.get(
    '/api/campagne/carnet/appris',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.faitsAppris(profil.id))
    }),
  )

  app.post(
    '/api/campagne/revision',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.commencerRevision(profil.id))
    }),
  )

  // ── Affronter un inconnu ───────────────────────────────────────────────
  // Une rencontre est une série d'un autre mode : ses réponses, son
  // signalement et sa correction passent par les routes de la série.

  app.post(
    '/api/campagne/rencontre',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.commencerUneRencontre(profil.id))
    }),
  )

  app.get(
    '/api/campagne/rencontres',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.mesRencontres(profil.id))
    }),
  )

  // ── Le défi de la semaine ──────────────────────────────────────────────
  // Une série d'un autre mode : ses réponses, son signalement et sa
  // correction passent par les routes de la série, sous son identifiant.

  app.get(
    '/api/campagne/defi',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.defi(profil.id))
    }),
  )

  app.post(
    '/api/campagne/defi',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.commencerLeDefi(profil.id))
    }),
  )

  // ── Les sentiers du savoir (`shared/sentiers.ts`) ──────────────────────
  // Une épreuve est une série d'un autre mode : son signalement et sa
  // correction passent par les routes de la série, sous son identifiant.

  /** La page des sentiers : ses vies, ses paliers, son épreuve laissée — et son solde, pour racheter des vies. */
  const etatDesSentiers = async (profil: NonNullable<Awaited<ReturnType<typeof profilDe>>>): Promise<EtatDesSentiers> => {
    const [etat, boutique] = await Promise.all([
      deps.campagne.etatDesSentiers(profil.id),
      // Une base qui se tait ôte le solde, pas les sentiers.
      deps.profiles.boutiqueDe(profil, jourDe(Date.now())).catch(e => {
        console.error('[sentiers] solde illisible :', e)
        return null
      }),
    ])
    return { ...etat, ...(boutique && { confettis: boutique.confettis.solde }) }
  }

  app.get(
    '/api/campagne/sentiers',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await etatDesSentiers(profil))
    }),
  )

  app.post(
    '/api/campagne/sentiers/epreuve',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.commencerEpreuve(profil.id, req.body?.branche, req.body?.palier))
    }),
  )

  app.post(
    '/api/campagne/epreuve/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.repondreEpreuve(profil.id, String(req.params.id), Number(req.body?.index), req.body?.choix))
    }),
  )

  app.post(
    '/api/campagne/epreuve/:id/abandon',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      await deps.campagne.abandonnerEpreuve(profil.id, String(req.params.id))
      res.json(await etatDesSentiers(profil))
    }),
  )

  // Des vies en confettis : le profil tient le solde, la campagne les compte.
  app.post(
    '/api/campagne/vies',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      await deps.profiles.acheterVies(profil.id, req.body?.nombre, jourDe(Date.now()))
      res.json(await etatDesSentiers(profil))
    }),
  )
}

/**
 * La base de la campagne et ses signalements, pour l'administrateur seul
 * (`/admin#campagne`) : qui signale quoi, puis garder la question, la
 * corriger, ou la retirer pour tous. Passe derrière la porte des
 * animateurs, sous `/api/admin`.
 */
export function mountCampagneAdmin(app: Express, deps: CampagneDeps) {
  app.get(
    '/api/admin/campagne',
    requireAdmin,
    wrap(async (_req, res) => {
      const etat = await deps.campagne.administration()
      // Qui signale : leurs profils se lisent d'un coup, comme les plus bloqués des sentiers.
      const ids = [...new Set(etat.signalements.flatMap(s => s.rapports.map(r => r.profileId)))]
      const profils = await deps.profiles.byIds(ids)
      const parId = new Map(ids.map((id, i) => [id, profils[i]]))
      for (const s of etat.signalements) {
        s.rapports = s.rapports.map(r => {
          const p = parId.get(r.profileId)
          return p ? { ...r, prenom: p.name, login: p.login } : r
        })
      }
      res.json(etat)
    }),
  )

  app.post(
    '/api/admin/campagne/garder',
    requireAdmin,
    wrap(async (req, res) => {
      await deps.campagne.garder(String(req.body?.questionId ?? ''))
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/campagne/retirer',
    requireAdmin,
    wrap(async (req, res) => {
      await deps.campagne.retirer(String(req.body?.questionId ?? ''))
      res.json({ ok: true })
    }),
  )

  // Corriger une question signalée : son intitulé, ses réponses, la bonne, l'anecdote.
  app.post(
    '/api/admin/campagne/corriger',
    requireAdmin,
    wrap(async (req, res) => {
      res.json(await deps.campagne.corriger(String(req.body?.questionId ?? ''), req.body?.correction))
    }),
  )

  // Les sentiers palier par palier : de quoi régler un seuil sur des faits.
  // Les plus bloqués y sont nommés : leurs profils se lisent d'un coup.
  app.get(
    '/api/admin/campagne/sentiers',
    requireAdmin,
    wrap(async (req, res) => {
      const stats = await deps.campagne.adminDesSentiers(req.query.branche)
      const profils = await deps.profiles.byIds(stats.bloques.map(x => x.profileId))
      stats.bloques = stats.bloques.map((x, i) => (profils[i] ? { ...x, prenom: profils[i]!.name } : x))
      res.json(stats)
    }),
  )
}

/**
 * La base de la campagne, pour la routine du matin qui l'agrandit — la même
 * que celle de la réserve du quiz du jour, avec le même jeton
 * (`RESERVE_TOKEN`, MISE-EN-LIGNE.md, étape 8) : ce qu'il faut écrire
 * aujourd'hui, la consigne commune et la part de chaque catégorie, puis le
 * dépôt. Le jeton n'y apprend rien de plus : des intitulés déjà écrits — un
 * refus cite celui qui pose déjà le fait —, aucune bonne réponse, et il ne
 * retire rien. Avant la porte des animateurs — la routine
 * n'en est pas un —, derrière la protection contre les requêtes forgées.
 */
export function mountBaseDeLaCampagne(app: Express, deps: { campagne: CampagneStore; jeton: string | null }) {
  const porte = porteDeLaReserve(deps.jeton)
  const depot = express.json({ limit: '512kb' })

  app.get(
    '/api/campagne/base',
    porte,
    wrap(async (_req, res) => {
      res.json(await deps.campagne.commandeDuJour())
    }),
  )

  app.post(
    '/api/campagne/base',
    porte,
    depot,
    wrap(async (req, res) => {
      const fait = await deps.campagne.deposer(req.body?.categorie, req.body?.entrees)
      console.log(
        `[campagne] dépôt de la routine (${String(req.body?.categorie)}) : ${fait.ajoutees} ajoutée${fait.ajoutees > 1 ? 's' : ''}, ` +
          `${fait.ecartees.length} écartée${fait.ecartees.length > 1 ? 's' : ''}`,
      )
      res.json(fait)
    }),
  )
}
