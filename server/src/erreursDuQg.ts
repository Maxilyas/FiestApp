import type { Express } from 'express'
import type { SanteDuServeur } from './core/santeDuServeur'
import type { AlertesDuQg } from './core/alertes'
import type { RappelStore } from './core/rappels'
import type { Veille } from './core/veille'
import { wrap } from './core/http'
import { extrait, noterLeGeste } from './core/journalDesGestes'
import { formatNumber } from '../../shared/typographie'
import { EMPREINTE_D_UN_TELEPHONE, MESSAGE_D_ESSAI, type TelephoneDuQg } from '../../shared/pannes'
import { ETATS_DU_TRI, lireLaNote, type EtatDUneErreur, type PageDesErreurs, type TriLu } from '../../shared/triDesErreurs'
import type { ErreurDeLaSemaine } from '../../shared/santeDuServeur'

export interface ErreursDeps {
  sante: Pick<SanteDuServeur, 'erreurs' | 'trier'>
  alertes: Pick<AlertesDuQg, 'telephones' | 'abonner' | 'retirer' | 'prevenir'>
  /** Les clés du rappel du soir, que les alertes partagent : la publique part au téléphone qui s'abonne. */
  rappels: Pick<RappelStore, 'clesDuServeur'>
  veille: Pick<Veille, 'pannes'>
}

/** Une clé d'erreur tient sous cette longueur : sa source, sa sorte, son message coupé (`core/erreurs.ts`). */
const CLE_MAX = 2000

/** « 2 téléphones prévenus », « plus aucun téléphone prévenu ». */
const prevenus = (n: number) => (n === 0 ? 'plus aucun téléphone prévenu' : `${formatNumber(n)} téléphone${n > 1 ? 's' : ''} prévenu${n > 1 ? 's' : ''}`)

/** L'erreur dans une phrase du journal : sa sorte, son message, d'où elle vient — de quoi la reconnaître. */
const lErreur = (e: ErreurDeLaSemaine) => `${e.nom}${e.message ? ` — ${extrait(e.message, 60)}` : ''} (${e.source})`

/** Ce que le journal dit d'un tri : ce que l'erreur devient, et le mot qui l'accompagne. */
export function phraseDuTri(e: ErreurDeLaSemaine, etat: EtatDUneErreur, note: string | null, avant: TriLu): string {
  const mot = note ? ` — « ${note} »` : ''
  if (etat === 'a-regarder') return `Erreur remise à regarder : ${lErreur(e)}`
  // Le même état, un autre mot : la note seule a changé.
  if (avant.etat === etat) return `Note d’une erreur ${etat === 'reglee' ? 'réglée' : 'ignorée'} : ${lErreur(e)}${mot || ' — sans note'}`
  return `Erreur ${etat === 'reglee' ? (avant.revenue ? 'revenue, réglée de nouveau' : 'réglée') : 'ignorée'} : ${lErreur(e)}${mot}`
}

/**
 * La page des erreurs du QG (`/admin#erreurs`, le souhait du propriétaire du
 * 19 octobre 2026) et les alertes du téléphone de l'administrateur — sous
 * `/api/admin`, gardées d'un bloc (`api.ts`). Chaque geste dit sa phrase au
 * journal, sous « Erreurs », et rend ce que la page montre d'après.
 */
export function mountErreurs(app: Express, deps: ErreursDeps) {
  const alertes = async (): Promise<PageDesErreurs['alertes']> => ({
    cle: deps.rappels.clesDuServeur()?.publique ?? null,
    telephones: await deps.alertes.telephones(),
  })
  const page = async (): Promise<PageDesErreurs> => {
    const [erreurs, lesAlertes] = await Promise.all([deps.sante.erreurs(), alertes()])
    return { ...erreurs, pannes: deps.veille.pannes(), alertes: lesAlertes }
  }

  app.get(
    '/api/admin/erreurs',
    wrap(async (_req, res) => {
      res.json(await page())
    }),
  )

  // `{ cle, etat, note }` : réglée — avec son mot, « PR #274 » —, ignorée, ou remise à regarder.
  app.post(
    '/api/admin/erreurs/tri',
    wrap(async (req, res) => {
      const cle: unknown = req.body?.cle
      const etat: unknown = req.body?.etat
      if (typeof cle !== 'string' || !cle || cle.length > CLE_MAX) throw new Error('Cette erreur ne se lit pas : recharge la page')
      if (typeof etat !== 'string' || !(ETATS_DU_TRI as readonly string[]).includes(etat)) throw new Error('Choisis : réglée, ignorée ou à regarder')
      const sonEtat = etat as EtatDUneErreur
      const note = sonEtat === 'a-regarder' ? null : lireLaNote(req.body?.note)
      const trie = await deps.sante.trier(cle, sonEtat, note)
      if (!trie) return res.status(404).json({ error: 'Cette erreur n’est plus dans la semaine : recharge la page' })
      noterLeGeste(res, { sorte: 'erreur', resume: phraseDuTri(trie.erreur, sonEtat, note, trie.avant), cible: trie.erreur.source })
      res.json(await page())
    }),
  )

  // Ce que le service worker relit quand le service de push renouvelle un abonnement sans dire sa clé (`client/public/sw.js`).
  app.get(
    '/api/admin/alertes',
    wrap(async (_req, res) => {
      res.json(await alertes())
    }),
  )

  // `{ abonnement, ancien? }` : ce téléphone sonnera aux pannes. `ancien` : l'abonnement que son service vient de remplacer.
  app.post(
    '/api/admin/alertes/telephones',
    wrap(async (req, res) => {
      const ancien: unknown = req.body?.ancien
      const { nouveau, telephones, service } = await deps.alertes.abonner(req.body?.abonnement, ancien)
      // Renouvelé par son service de push, c'est le même téléphone : rien ne s'est allumé.
      const renouvele = typeof ancien === 'string' || !nouveau
      noterLeGeste(res, {
        sorte: 'erreur',
        resume: renouvele ? `Un téléphone a renouvelé ses alertes de panne (${service})` : `Alertes de panne allumées sur un téléphone (${service}) — ${prevenus(telephones)}`,
        cible: null,
      })
      res.json(await alertes())
    }),
  )

  app.delete(
    '/api/admin/alertes/telephones/:empreinte',
    wrap(async (req, res) => {
      const empreinte = String(req.params.empreinte)
      const reste = new RegExp(`^[0-9a-f]{${EMPREINTE_D_UN_TELEPHONE}}$`).test(empreinte) ? await deps.alertes.retirer(empreinte) : null
      if (!reste) return res.status(404).json({ error: 'Ce téléphone n’est déjà plus prévenu : recharge la page' })
      noterLeGeste(res, { sorte: 'erreur', resume: `Alertes de panne coupées sur un téléphone — ${prevenus(reste.telephones)}`, cible: null })
      res.json(await alertes())
    }),
  )

  // Fait sonner chaque téléphone prévenu, pour voir : la notification d'une vraie panne arrive de même.
  app.post(
    '/api/admin/alertes/essai',
    wrap(async (_req, res) => {
      const telephones: TelephoneDuQg[] = await deps.alertes.telephones()
      if (telephones.length === 0) throw new Error('Aucun téléphone n’est prévenu : allume les alertes sur celui-ci d’abord')
      const bilan = await deps.alertes.prevenir(MESSAGE_D_ESSAI)
      const sonnes = bilan.envoyes === 0 ? 'aucun téléphone n’a sonné' : `${formatNumber(bilan.envoyes)} téléphone${bilan.envoyes > 1 ? 's' : ''} sonné${bilan.envoyes > 1 ? 's' : ''}`
      const enPlus = [bilan.echecs > 0 && `${formatNumber(bilan.echecs)} en échec`, bilan.retires > 0 && `${formatNumber(bilan.retires)} oublié${bilan.retires > 1 ? 's' : ''}, désabonné${bilan.retires > 1 ? 's' : ''}`]
        .filter(Boolean)
        .join(', ')
      noterLeGeste(res, { sorte: 'erreur', resume: `Essai d’alerte : ${sonnes}${enPlus ? ` (${enPlus})` : ''}`, cible: null })
      res.json({ ...bilan, ...(await alertes()) })
    }),
  )
}
