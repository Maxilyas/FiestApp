import type { Express } from 'express'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { extrait, noterLeGeste } from './core/journalDesGestes'
import { formatNumber } from '../../shared/typographie'
import { nConfettis } from '../../shared/themes'
import type { AnnonceAuQg, PageDesAnnonces, SorteDeQuestion } from '../../shared/annonces'

/** « 128 profils », « 1 profil », « aucun profil » : la phrase du journal parle des profils, jamais d'un prénom. */
const deProfils = (n: number) => (n === 0 ? 'aucun profil' : `${formatNumber(n)} profil${n > 1 ? 's' : ''}`)

/** Ce que le journal dit d'une annonce partie : à combien de profils, ce qu'elle dit, ce qu'elle offre à chacun. */
export const phraseDeLAnnonce = (a: AnnonceAuQg) =>
  `Annonce à ${deProfils(a.destinataires)} : « ${a.message} »${a.confettis > 0 ? ` — ${nConfettis(a.confettis)} chacun` : ''}${phraseDeLaQuestion(a)}`

const SORTES: Record<SorteDeQuestion, string> = { vote: 'un vote', note: 'une note de 1 à 5', mot: 'un mot libre' }
/** La question d'une annonce, au journal : sa sorte et ce que sa réponse rapporte. */
const phraseDeLaQuestion = (a: AnnonceAuQg) =>
  a.question ? ` — avec ${SORTES[a.question.sorte]}${a.question.recompense > 0 ? `, ${nConfettis(a.question.recompense)} par réponse` : ''}` : ''

/**
 * Les annonces à tous au QG (`/admin#annonces`, sous « Animer ») — sous
 * `/api/admin`, gardées d'un bloc (`api.ts`). Chaque geste dit sa phrase au
 * journal et rend la page d'après, que le QG montre sans relire.
 */
export function mountAnnonces(app: Express, deps: { profiles: ProfileStore }) {
  const page = async (): Promise<PageDesAnnonces> => ({ maintenant: Date.now(), ...(await deps.profiles.annoncesAuQg()) })

  app.get(
    '/api/admin/annonces',
    wrap(async (_req, res) => {
      res.json(await page())
    }),
  )

  // `{ id, message, confettis, question? }` — `question` : `{ sorte, choix, recompense }`. `id`, tiré par la page, fait d'un second envoi
  // du même geste — sa réponse perdue en route — un refus, pas une seconde annonce :
  // multipliée par tous les profils, elle aurait offert deux fois à chacun.
  app.post(
    '/api/admin/annonces',
    wrap(async (req, res) => {
      const { annonce, nouvelle } = await deps.profiles.annoncerATous({ id: req.body?.id, message: req.body?.message, confettis: req.body?.confettis, question: req.body?.question })
      if (!nouvelle) return res.status(409).json({ error: 'Cette annonce est déjà partie : la voici dans la liste' })
      noterLeGeste(res, { sorte: 'annonce', resume: phraseDeLAnnonce(annonce), cible: annonce.id })
      res.json(await page())
    }),
  )

  // Retirer : l'accueil la tait à qui ne l'avait pas lue. Ses confettis restent offerts.
  app.delete(
    '/api/admin/annonces/:id',
    wrap(async (req, res) => {
      const annonce = await deps.profiles.retirerLAnnonce(String(req.params.id))
      if (!annonce) return res.status(404).json({ error: 'Cette annonce est introuvable : recharge le QG' })
      noterLeGeste(res, {
        sorte: 'annonce',
        resume: `Annonce retirée : « ${extrait(annonce.message)} »${annonce.confettis > 0 ? ' — ses confettis restent offerts' : ''}`,
        cible: annonce.id,
      })
      res.json(await page())
    }),
  )

  // Clore la question : les joueurs ne la voient plus, les résultats et les confettis donnés restent.
  app.post(
    '/api/admin/annonces/:id/cloturer',
    wrap(async (req, res) => {
      const annonce = await deps.profiles.cloreLaQuestion(String(req.params.id))
      if (!annonce) return res.status(404).json({ error: 'Cette annonce est introuvable : recharge le QG' })
      noterLeGeste(res, {
        sorte: 'annonce',
        resume: `Question close : « ${extrait(annonce.message)} » — ${formatNumber(annonce.question?.resultats.reponses ?? 0)} réponse${(annonce.question?.resultats.reponses ?? 0) > 1 ? 's' : ''}`,
        cible: annonce.id,
      })
      res.json(await page())
    }),
  )
}
