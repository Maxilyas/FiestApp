import type { Express } from 'express'
import type { CabinetStore } from './core/cabinet/magasin'
import type { ProfileStore } from './auth/profiles'
import { contenuDuCabinetEnTranches } from './core/cabinet/contenu'
import { enTranches } from './core/tourniquet'
import { wrap } from './core/http'
import { tronquer } from '../../shared/avatars'
import { minuitsDeParis } from '../../shared/qg'
import { idDeLaFiche, idDeLaReplique, idDuLieu } from '../../shared/cabinet/pieces'
import { defisTenus } from '../../shared/cabinet/sceaux'
import type { CleDeJeu } from '../../shared/cabinet/jeux/regle'
import type { Replique } from '../../shared/cabinet/contenu'
import {
  JOURS_DU_CABINET,
  nommerLaPage,
  pageDuCabinetEnTranches,
  profilsANommer,
  type NomsDuContenu,
  type PageDuCabinetAuQg,
  type PieceAuQg,
  type ProfilNomme,
  type TraverseeAuQg,
} from '../../shared/qgCabinet'

export interface CabinetDuQgDeps {
  cabinet: Pick<CabinetStore, 'traverseesFiniesAuQg' | 'traverseesVivantesAuQg' | 'piecesDesEpreuves' | 'signalementsDesJeux'>
  profiles: Pick<ProfileStore, 'pourLAdministrateurDe' | 'recompensesOf'>
  /** L'heure du serveur — celle du quiz du jour, que les tests avancent. */
  maintenant: () => number
}

/** Les signalements des jeux, gardés dix minutes : la page se rouvre à chaque passage, et leur table n'a pas d'index sur sa date. */
const SIGNALEMENTS_GARDES_MS = 10 * 60_000

/** Une réplique telle que la page la nomme : la phrase recousue — l'espace après l'apostrophe en moins, `apres` portant son blanc. */
const phraseDe = (r: Pick<Replique, 'avant' | 'mot' | 'apres'>): string => tronquer(`« ${r.avant}${/['’]$/.test(r.avant) ? '' : ' '}${r.mot}${r.apres} »`, 90)

/**
 * La page du Cabinet de curiosités au QG (`/admin#cabinet`, le 4 novembre
 * 2026 — « J'ai pas aussi de page dédié au cabinet », le propriétaire, la
 * veille), sous `/api/admin`, gardée d'un bloc (`api.ts`,
 * `admin-seulement.test.ts`).
 *
 * Ce qu'elle lit coûte peu au quota de Turso : les traversées finies avant
 * minuit, une ligne et un résumé chacune (`cabinet_traversees.resume`), une
 * fois par jour et gardées jusqu'au minuit suivant — avec ce que les manches
 * de leurs épreuves ont posé, par la clé de leurs parties —, comme les jours
 * finis de la vue d'ensemble (`lesTrenteJours`, `qg.ts`) ; à chaque page, par
 * l'index de leur fin, celles en route et celles finies depuis minuit, et les
 * pièces de leurs épreuves. Le calcul passe en tranches (`enTranches`).
 *
 * Des joueurs, rien que leur prénom et leur identifiant, dans ses deux listes
 * — les traversées en route, ceux qui traversent le plus —, qui ouvrent leur
 * fiche ; rien d'un Divin.
 */
export function mountCabinetDuQg(app: Express, deps: CabinetDuQgDeps) {
  /** Les jours finis : les traversées finies avant le dernier minuit, et les pièces de leurs épreuves. */
  let gardes: { minuit: number; depuis: number; lus: Promise<{ traversees: TraverseeAuQg[]; pieces: PieceAuQg[] }> } | null = null
  let signalements: { depuis: number; le: number; parJeu: ReadonlyMap<CleDeJeu, number> } | null = null

  const piecesDe = (traversees: readonly TraverseeAuQg[]) => deps.cabinet.piecesDesEpreuves([...new Set(traversees.flatMap(t => t.resume?.epreuves.map(ep => ep.partie) ?? []))])

  const lesJoursFinis = (depuis: number, minuit: number) => {
    if (gardes?.minuit === minuit && gardes.depuis === depuis) return gardes.lus
    // Une lecture par jour, partagée : deux onglets ouverts au premier passage d'après minuit ne lisent pas deux fois le
    // mois. Une lecture qui échoue ne se garde pas : la page suivante la refait.
    const lus = (async () => {
      const traversees = await deps.cabinet.traverseesFiniesAuQg(depuis, minuit)
      return { traversees, pieces: await piecesDe(traversees) }
    })()
    const garde = { minuit, depuis, lus }
    gardes = garde
    lus.catch(() => {
      if (gardes === garde) gardes = null
    })
    return lus
  }

  const lesSignalements = async (depuis: number, maintenant: number) => {
    if (signalements && signalements.depuis === depuis && maintenant - signalements.le < SIGNALEMENTS_GARDES_MS) return signalements.parJeu
    // Une lecture qui échoue ne se garde pas : la page se passe de cette colonne-là.
    const parJeu = await deps.cabinet.signalementsDesJeux(depuis).catch(e => {
      console.error('[qg] les signalements du Cabinet ne se lisent pas', e)
      return null
    })
    if (parJeu) signalements = { depuis, le: maintenant, parJeu }
    return parJeu ?? new Map<CleDeJeu, number>()
  }

  const noms = async (): Promise<NomsDuContenu> => {
    const c = await contenuDuCabinetEnTranches()
    return {
      lieux: new Map(c.lieux.map(l => [l.id, l.nom])),
      fiches: new Map(c.fiches.map(f => [f.id, f.reponse])),
      repliques: new Map(c.repliques.map(r => [r.id, `${phraseDe(r)} — ${r.qui}`])),
    }
  }

  const page = async (): Promise<PageDuCabinetAuQg> => {
    const maintenant = deps.maintenant()
    const minuits = minuitsDeParis(maintenant, JOURS_DU_CABINET)
    const depuis = minuits[0]
    const minuit = minuits[minuits.length - 1]
    const [finis, vivantes, parJeu, lesNoms] = await Promise.all([
      lesJoursFinis(depuis, minuit),
      deps.cabinet.traverseesVivantesAuQg(minuit),
      lesSignalements(depuis, maintenant),
      noms(),
    ])
    const aujourdhui = await piecesDe(vivantes.finies.concat(vivantes.enRoute))
    // Chacune une fois : une traversée finie aujourd'hui n'est pas dans les jours finis, une en route nulle part ailleurs.
    const traversees = [...new Map([...finis.traversees, ...vivantes.finies, ...vivantes.enRoute].map(t => [t.id, t])).values()]
    const aNommer = await enTranches(
      pageDuCabinetEnTranches(
        { traversees, pieces: [...finis.pieces, ...aujourdhui], signalements: parJeu, noms: lesNoms, minuits, maintenant },
        { lieu: idDuLieu(''), fiche: idDeLaFiche(''), replique: idDeLaReplique('') },
      ),
    )
    // Les profils nommés, d'un aller-retour (suspendus compris : ils ont traversé) ; leurs défis, de l'étagère en mémoire.
    const ids = profilsANommer(aNommer)
    const profils = new Map<string, ProfilNomme>(
      (await deps.profiles.pourLAdministrateurDe(ids)).map(p => [p.id, { id: p.id, nom: p.name, login: p.login, suspendu: p.disabledAt !== null }]),
    )
    const defis = new Map(
      ids.map(id => {
        const tenus = defisTenus(deps.profiles.recompensesOf(id).keys())
        // Un rang tenu donne ceux d'en dessous : l'Or d'une carte, ce sont trois rangs.
        return [id, { rangs: Object.values(tenus.rangs).reduce<number>((n, r) => n + r, 0), maitrises: tenus.maitrises.length }] as const
      }),
    )
    return nommerLaPage(aNommer, profils, defis)
  }

  app.get(
    '/api/admin/cabinet',
    wrap(async (_req, res) => {
      res.json(await page())
    }),
  )
}
