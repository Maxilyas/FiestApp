import type { Express } from 'express'
import type { ProfileStore } from './auth/profiles'
import { wrap } from './core/http'
import { noterLeGeste } from './core/journalDesGestes'
import { nConfettis } from '../../shared/themes'
import { DESTINATIONS, estUnePageALAffiche, type AfficheAuQg, type PageDesAffiches } from '../../shared/affiches'

/** Le nom de sa page, au journal : une page inconnue d'ici — un serveur d'après — se dit par sa clé. */
const nomDeLaPage = (page: string) => (estUnePageALAffiche(page) ? DESTINATIONS[page].nom : page)

/** Ce que le journal dit d'une affiche posée : sa page, son titre, sa durée, ce que sa première visite offre. */
export const phraseDeLAffiche = (a: Omit<AfficheAuQg, 'ouvertes' | 'rangees'>) =>
  `Affiche posée : ${nomDeLaPage(a.page)} — « ${a.titre} », ${Math.round((a.fin - a.le) / 86_400_000)} jours${a.confettis > 0 ? ` — ${nConfettis(a.confettis)} à la première visite` : ''}`

/**
 * L'affiche des nouveautés au QG (`/admin#affiches`, sous « Animer ») — sous
 * `/api/admin`, gardées d'un bloc (`api.ts`). Chaque geste dit sa phrase au
 * journal, sous les annonces — c'est aux joueurs qu'elle parle —, et rend la
 * page d'après, que le QG montre sans relire.
 *
 * `cabinet` : le Cabinet de curiosités s'ouvre-t-il sur ce serveur
 * (`cabinetOuvert`) ? Fermé, son affiche se refuse : elle mènerait les joueurs
 * à une page qui n'y répond pas, et l'accueil ne la montrerait à personne.
 */
export function mountAffiches(app: Express, deps: { profiles: ProfileStore; cabinet: boolean }) {
  const page = async (): Promise<PageDesAffiches> => ({ maintenant: Date.now(), affiches: await deps.profiles.affichesAuQg() })

  app.get(
    '/api/admin/affiches',
    wrap(async (_req, res) => {
      res.json(await page())
    }),
  )

  // `{ id, page, titre, phrase, jours, confettis }` — `id`, tiré par la page, fait d'un second envoi du même geste — sa
  // réponse perdue en route — un refus, pas une seconde affiche.
  app.post(
    '/api/admin/affiches',
    wrap(async (req, res) => {
      if (req.body?.page === 'cabinet' && !deps.cabinet) return res.status(400).json({ error: 'Le Cabinet de curiosités ne s’ouvre pas sur ce serveur : son affiche ne mènerait nulle part' })
      const { etat, affiche } = await deps.profiles.mettreALAffiche(req.body)
      if (etat === 'deja') return res.status(409).json({ error: 'Cette affiche est déjà posée : la voici dans la liste' })
      if (etat === 'occupee') {
        return res.status(409).json({ error: `${nomDeLaPage(affiche.page)} a déjà son affiche, « ${affiche.titre} » : retire-la avant d’en poser une autre` })
      }
      noterLeGeste(res, { sorte: 'annonce', resume: phraseDeLAffiche(affiche), cible: affiche.id })
      res.json(await page())
    }),
  )

  // Retirer avant sa fin : l'accueil la tait à tous, sa pastille avec. Les confettis offerts restent.
  app.delete(
    '/api/admin/affiches/:id',
    wrap(async (req, res) => {
      const affiche = await deps.profiles.retirerLAffiche(String(req.params.id))
      if (!affiche) return res.status(404).json({ error: 'Cette affiche est introuvable : recharge le QG' })
      noterLeGeste(res, {
        sorte: 'annonce',
        resume: `Affiche retirée : ${nomDeLaPage(affiche.page)} — « ${affiche.titre} »${affiche.confettis > 0 ? ' — les confettis offerts restent' : ''}`,
        cible: affiche.id,
      })
      res.json(await page())
    }),
  )
}
