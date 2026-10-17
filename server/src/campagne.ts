import express, { type Express, type Request, type Response } from 'express'
import type { CampagneStore } from './core/campagne'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { extrait, noterLeGeste } from './core/journalDesGestes'
import { readPlayerToken, requireAdmin } from './auth/http'
import { porteDeLaReserve } from './quizDuJour'
import { CATEGORIES } from '../../shared/categories'
import { jourDe } from '../../shared/jour'
import { texteDuMelange, type EtatDesSentiers } from '../../shared/sentiers'
import { classementAuJournal } from '../../shared/qgSignalements'

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

  // Ce que la campagne peut poser — ses catégories, ses sujets —, le même
  // pour tous et sans toucher à la base : la préparation d'un duel n'a besoin
  // que de cela, et la page des duels le demande en fond.
  app.get(
    '/api/campagne/choix',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.choix())
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

  // Le défi : le lancer — sur des catégories ou un sujet, comme une série —
  // contre quelqu'un (`adversaire`), en duel classé, ou, d'une page d'avant,
  // vers des amis choisis (`amis`) ; il leur part à sa dernière réponse. Le
  // relire par son code, le relever. Ses réponses passent par la porte des
  // séries.
  app.post(
    '/api/campagne/duel',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const brut: unknown = req.body?.categories
      const categories = Array.isArray(brut) ? brut.filter((c): c is string => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c)).slice(0, CATEGORIES.length) : []
      const sujet: unknown = req.body?.sujet
      res.json(await deps.campagne.creerUnDuel(profil.id, categories, typeof sujet === 'string' && sujet ? sujet : undefined, req.body?.amis, req.body?.adversaire))
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

  // Ses amis — ceux avec qui il a joué un défi entre amis — et les défis
  // qu'ils lui ont envoyés ; lus pour un de ses défis (`?duel=`), ceux qui
  // l'ont déjà. Lui envoyer un défi, le retirer de sa liste.
  app.get(
    '/api/campagne/amis',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.mesAmis(profil.id, req.query.duel))
    }),
  )

  app.post(
    '/api/campagne/duel/:code/envoi',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.envoyerUnDuel(profil.id, req.params.code, req.body?.amis))
    }),
  )

  app.post(
    '/api/campagne/amis/:id/retrait',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.retirerUnAmi(profil.id, req.params.id))
    }),
  )

  // L'ajouter à sa liste, trouvé par son prénom : sans demande ni attente.
  app.post(
    '/api/campagne/amis/:id/ajout',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.ajouterUnAmi(profil.id, req.params.id))
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
      // `tout` : tout le carnet, en avance compris ; `recommencer` : celle laissée en route se referme. Un vrai booléen, rien d'autre.
      // `categories`, `sujet` : ce qu'elle vise, comme une série — les catégories de la liste fixe seulement, le reste ne
      // viserait rien ; un sujet inconnu est refusé avec son motif.
      const corps = (req.body && typeof req.body === 'object' ? req.body : {}) as { tout?: unknown; recommencer?: unknown; categories?: unknown; sujet?: unknown }
      const categories = Array.isArray(corps.categories)
        ? corps.categories.filter((c): c is string => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c)).slice(0, CATEGORIES.length)
        : undefined
      const sujet = typeof corps.sujet === 'string' && corps.sujet ? corps.sujet : undefined
      if (profil) {
        res.json(await deps.campagne.commencerRevision(profil.id, { tout: corps.tout === true, recommencer: corps.recommencer === true, ...(categories && { categories }), ...(sujet && { sujet }) }))
      }
    }),
  )

  // ── Affronter un inconnu ───────────────────────────────────────────────
  // Une rencontre est une série d'un autre mode : ses réponses, son
  // signalement et sa correction passent par les routes de la série.

  // Le dé : sur des catégories ou un sujet, comme une série ; une rencontre laissée reprend, sur les siens.
  app.post(
    '/api/campagne/rencontre',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const brut: unknown = req.body?.categories
      const categories = Array.isArray(brut) ? brut.filter((c): c is string => typeof c === 'string' && (CATEGORIES as readonly string[]).includes(c)).slice(0, CATEGORIES.length) : []
      const sujet: unknown = req.body?.sujet
      res.json(await deps.campagne.commencerUneRencontre(profil.id, { categories, ...(typeof sujet === 'string' && sujet && { sujet }) }))
    }),
  )

  app.get(
    '/api/campagne/rencontres',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.mesRencontres(profil.id))
    }),
  )

  // ── Les duels classés (`shared/duels.ts`) ──────────────────────────────
  // Leur page (`/duels`) : sa cote, sa ligue, sa semaine, le classement. Un
  // duel classé est une rencontre : il se cherche, se joue et se corrige par
  // les routes de la rencontre et de la série.

  app.get(
    '/api/duels',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.etatDesDuels(profil.id))
    }),
  )

  // La suite de son historique, au « Voir plus » : après le dernier duel qu'il a sous les yeux (`?le=&cle=`).
  app.get(
    '/api/duels/historique',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.historiqueDesDuels(profil.id, req.query.le, req.query.cle))
    }),
  )

  // Chercher quelqu'un à défier ou à ajouter, par son prénom (`?q=`).
  app.get(
    '/api/duels/joueurs',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.chercherDesJoueurs(profil.id, req.query.q))
    }),
  )

  // Un joueur touché — sa carte, la préparation ouverte à son adresse : ce
  // que la recherche dirait de lui, s'il est son ami, et sa propre cote.
  app.get(
    '/api/duels/joueurs/:id',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (!profil) return
      const face = await deps.campagne.faceAFace(profil.id, req.params.id)
      if (face) res.json(face)
      else res.status(404).json({ error: 'Ce joueur est introuvable : cherche-le de nouveau' })
    }),
  )

  // La feuille des amis : sa liste — qui est en ligne, entre amis réciproques —, qui l'a ajouté, et des joueurs croisés.
  app.get(
    '/api/duels/amis',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.amisDeLaFeuille(profil.id))
    }),
  )

  // Des joueurs croisés — une soirée, un duel, le défi de la semaine, son niveau —, pour « Contre qui ? ».
  app.get(
    '/api/duels/croises',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.joueursCroises(profil.id))
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
      // Validée, sa fin vient avec : le portrait se révèle comme à sa dernière question.
      const fin = await deps.campagne.abandonnerEpreuve(profil.id, String(req.params.id))
      res.json({ ...(await etatDesSentiers(profil)), ...(fin && { fin }) })
    }),
  )

  // ── Les sentiers à thème (`shared/sentiersDeSujets.ts`) ───────────────
  // Une épreuve de sujet est une série d'un autre mode : son signalement et
  // sa correction passent par les routes de la série, sous son identifiant.

  app.get(
    '/api/campagne/sujets',
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.etatDesSujets(profil.id))
    }),
  )

  app.post(
    '/api/campagne/sujets/epreuve',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.commencerUnSujet(profil.id, req.body?.sujet, req.body?.palier))
    }),
  )

  app.post(
    '/api/campagne/sujets/epreuve/:id/reponse',
    petit,
    wrap(async (req, res) => {
      const profil = await profilDe(req, res)
      if (profil) res.json(await deps.campagne.repondreAuSujet(profil.id, String(req.params.id), Number(req.body?.index), req.body?.choix))
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
  /** Une question de la base, telle que le journal du QG la cite. */
  const citee = async (questionId: string) => `« ${extrait((await deps.campagne.texteDeLaQuestion(questionId)) ?? questionId)} »`

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
      const questionId = String(req.body?.questionId ?? '')
      await deps.campagne.garder(questionId)
      noterLeGeste(res, { sorte: 'campagne', resume: `Question de la campagne gardée, ses signalements refermés : ${await citee(questionId)}`, cible: questionId })
      res.json({ ok: true })
    }),
  )

  app.post(
    '/api/admin/campagne/retirer',
    requireAdmin,
    wrap(async (req, res) => {
      const questionId = String(req.body?.questionId ?? '')
      await deps.campagne.retirer(questionId)
      noterLeGeste(res, { sorte: 'campagne', resume: `Question retirée de la campagne, pour tous : ${await citee(questionId)}`, cible: questionId })
      res.json({ ok: true })
    }),
  )

  // Corriger une question signalée : son intitulé, ses réponses, la bonne, l'anecdote.
  app.post(
    '/api/admin/campagne/corriger',
    requireAdmin,
    wrap(async (req, res) => {
      const questionId = String(req.body?.questionId ?? '')
      // Citée telle qu'elle était : c'est elle qu'on a signalée, et corrigée.
      const avant = await citee(questionId)
      const corrigee = await deps.campagne.corriger(questionId, req.body?.correction)
      noterLeGeste(res, {
        sorte: 'campagne',
        resume: `Question de la campagne corrigée${corrigee.nouvelle ? ', sous un identifiant neuf' : ''} : ${avant}`,
        cible: questionId,
      })
      res.json(corrigee)
    }),
  )

  // La reclasser (`/admin#signalements`) : sa catégorie, son sous-thème, sa difficulté estimée à l'écriture.
  app.post(
    '/api/admin/campagne/reclasser',
    requireAdmin,
    wrap(async (req, res) => {
      const questionId = String(req.body?.questionId ?? '')
      const { avant, apres } = await deps.campagne.reclasser(questionId, req.body?.classement)
      noterLeGeste(res, { sorte: 'campagne', resume: `Question de la campagne reclassée, ${classementAuJournal(avant, apres)} : ${await citee(questionId)}`, cible: questionId })
      res.json({ ok: true })
    }),
  )

  // Les sentiers palier par palier : de quoi régler un mélange sur des faits.
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

  // Ce que le QG suit de la campagne : les paliers du jour, le défi de la semaine, les parcours, les vies.
  app.get(
    '/api/admin/campagne/suivi',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.campagne.suiviAuQg())
    }),
  )

  // Régler le mélange d'un palier, pour les douze sentiers ensemble — ou le
  // rendre à celui du code (`melange: null`). Le choix du 13 octobre 2026 :
  // le mélange, jamais le seuil, qui reste dix partout.
  app.post(
    '/api/admin/campagne/paliers/:n/melange',
    requireAdmin,
    wrap(async (req, res) => {
      const melange: unknown = req.body?.melange
      if (melange === undefined) throw new Error('Dis combien de questions de chaque marche')
      const r = await deps.campagne.reglerLeMelange(Number(req.params.n), melange)
      const changement = `${texteDuMelange(r.avant)} → ${texteDuMelange(r.apres)}`
      noterLeGeste(res, {
        sorte: 'campagne',
        resume: r.origine ? `Palier ${r.palier} des sentiers rendu à son mélange d’origine : ${changement}` : `Mélange du palier ${r.palier} des sentiers réglé : ${changement}`,
        cible: `palier:${r.palier}`,
      })
      res.json(r)
    }),
  )

  // Les duels au QG : les duels classés lancés, les ligues, le classement, ceux qui attendent leur adversaire.
  app.get(
    '/api/admin/duels/suivi',
    requireAdmin,
    wrap(async (_req, res) => {
      res.json(await deps.campagne.suiviDesDuelsAuQg())
    }),
  )

  // Annuler un duel classé que celui qu'il défie n'a pas commencé (le choix
  // du 13 octobre 2026) : fermé tout de suite, il ne compte pour personne,
  // comme un duel expiré sans réponse.
  app.post(
    '/api/admin/duels/:code/annuler',
    requireAdmin,
    wrap(async (req, res) => {
      const r = await deps.campagne.annulerUnDuel(req.params.code)
      // Nommés comme au journal : le profil, jamais la personne — un suspendu se lit encore pour l'administrateur.
      const [auteur, adversaire] = await Promise.all([deps.profiles.pourLAdministrateur(r.auteur), deps.profiles.pourLAdministrateur(r.adversaire)])
      const nomme = (p: { name: string; login: string } | null) => (p ? `${p.name} (@${p.login})` : 'un profil parti')
      noterLeGeste(res, { sorte: 'duel', resume: `Duel classé annulé avant d’être joué : ${nomme(auteur)} → ${nomme(adversaire)}`, cible: r.auteur })
      res.json({ ok: true, code: r.code })
    }),
  )
}

/**
 * La base de la campagne, pour la routine du matin qui l'agrandit — la même
 * que celle de la réserve du quiz du jour, avec le même jeton
 * (`RESERVE_TOKEN`, docs/exploitation/mise-en-ligne.md, étape 9) : ce qu'il faut écrire
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
