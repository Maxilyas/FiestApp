import { useEffect, useMemo, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { formatNumber } from '../../../shared/typographie'
import { tempsDeReponse, type PeriodeDuServeur } from '../../../shared/santeDuServeur'
import {
  APPAREILS,
  CLS_EN_ALERTE,
  INP_LENT_MS,
  LCP_LENT_MS,
  NOM_DE_L_APPAREIL,
  NOM_DE_LA_PAGE_MESUREE,
  PART_DES_TELEPHONES_MESURES,
  type CentileDuTelephone,
  type PageDesTelephones,
  type TelephonesDeLHeure,
} from '../../../shared/telephones'

const SUR: Record<PeriodeDuServeur, string> = { '1h': 'l’heure en cours et la précédente', '24h': 'les dernières 24 heures', '7j': 'les sept derniers jours' }

/** Le 75ᵉ centile de toutes les pages : ceux de chacune, pondérés par leurs mesures. */
function ensemble(pages: readonly PageDesTelephones[], f: (p: PageDesTelephones) => CentileDuTelephone | null): CentileDuTelephone | null {
  let n = 0
  let s = 0
  for (const p of pages) {
    const c = f(p)
    if (!c) continue
    n += c.n
    s += c.p75 * c.n
  }
  return n === 0 ? null : { n, p75: s / n }
}

const sauts = (v: number) => formatNumber(Math.round(v * 100) / 100)

/**
 * Les téléphones des joueurs (`/admin#telephones`, sous « Technique », le QG
 * 2, lot 9) : ce qu'ils vivent de leur côté — le temps qu'une page met à
 * paraître, à répondre au doigt, ce qui saute, le client qui plante —, mesuré
 * dans la page d'un téléphone sur quatre et agrégé à l'heure au serveur, sans
 * un nom ni une adresse. Sur la période de la barre, lue dans la page du
 * serveur (`PageDuServeur.telephones`) : pas une lecture de plus.
 */
export function QgTelephones({ periode = '24h' }: { periode?: PeriodeDuServeur }) {
  const [t, setT] = useState<TelephonesDeLHeure | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let perimee = false
    api.admin.serveur(periode).then(
      p => !perimee && setT(p.telephones ?? { pages: [], appareils: {}, installees: 0 }),
      e => !perimee && setError(motifDe(e)),
    )
    return () => {
      perimee = true
    }
  }, [periode])
  if (error && !t) return <p className="error">{error}</p>
  if (!t) return <p className="serif-note">Chargement…</p>
  return <TelephonesAuQg t={t} periode={periode} />
}

export function TelephonesAuQg({ t, periode }: { t: TelephonesDeLHeure; periode: PeriodeDuServeur }) {
  const vues = t.pages.reduce((n, p) => n + p.vues, 0)
  const erreurs = t.pages.reduce((n, p) => n + p.erreurs, 0)
  const lcp = ensemble(t.pages, p => p.lcp)
  const inp = ensemble(t.pages, p => p.inp)
  const cls = ensemble(t.pages, p => p.cls)
  const parAppareil = APPAREILS.map(a => ({ a, n: t.appareils[a] ?? 0 })).filter(x => x.n > 0)
  const part = (n: number) => (vues > 0 ? `${formatNumber(Math.round((n / vues) * 100))} %` : '–')
  return (
    <>
      <p className="muted small">
        Ce que les joueurs vivent de leur côté, mesuré dans la page d’un téléphone sur {Math.round(1 / PART_DES_TELEPHONES_MESURES)} et agrégé à l’heure au
        serveur — sans un nom ni une adresse, sans cookie. Sur {SUR[periode]}. Un navigateur qui ne sait pas mesurer (Safari, longtemps) laisse ses
        chiffres vides : ses pages comptent dans les vues, les appareils et les erreurs.
      </p>
      <section className="qg-chiffres" aria-labelledby="telephones-chiffres">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="telephones-chiffres">
            {formatNumber(vues)} page{vues > 1 ? 's' : ''} mesurée{vues > 1 ? 's' : ''}
          </h2>
        </div>
        <ul className="qg-tuiles qg-tuiles-quatre">
          <li className={'qg-tuile' + (lcp && lcp.p75 > LCP_LENT_MS ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">Page affichée</span>
            <span className="qg-tuile-valeur num">{lcp ? tempsDeReponse(lcp.p75) : '–'}</span>
            <span className="qg-ecart qg-tuile-detail">75ᵉ centile · lente au-delà de {tempsDeReponse(LCP_LENT_MS)}</span>
          </li>
          <li className={'qg-tuile' + (inp && inp.p75 > INP_LENT_MS ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">Réponse au doigt</span>
            <span className="qg-tuile-valeur num">{inp ? tempsDeReponse(inp.p75) : '–'}</span>
            <span className="qg-ecart qg-tuile-detail">75ᵉ centile · lente au-delà de {tempsDeReponse(INP_LENT_MS)}</span>
          </li>
          <li className={'qg-tuile' + (cls && cls.p75 > CLS_EN_ALERTE ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">Ce qui saute</span>
            <span className="qg-tuile-valeur num">{cls ? sauts(cls.p75) : '–'}</span>
            <span className="qg-ecart qg-tuile-detail">75ᵉ centile · trop au-delà de {sauts(CLS_EN_ALERTE)}</span>
          </li>
          <li className={'qg-tuile' + (erreurs > 0 ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">Erreurs du client</span>
            <span className="qg-tuile-valeur num">{formatNumber(erreurs)}</span>
            <span className="qg-ecart qg-tuile-detail">le script qui plante, dans la page</span>
          </li>
        </ul>
      </section>
      <section className="qg-console" aria-labelledby="telephones-appareils">
        <div className="qg-console-tete">
          <div>
            <span className="qg-etiquette">Les appareils</span>
            <h2 id="telephones-appareils">Qui ouvre les pages</h2>
            <span className="muted small">
              {formatNumber(t.installees)} ouverture{t.installees > 1 ? 's' : ''} depuis l’application installée — {part(t.installees)}
            </span>
          </div>
        </div>
        {parAppareil.length === 0 ? (
          <p className="muted small">Aucune mesure encore.</p>
        ) : (
          <ul className="qg-pistes">
            {parAppareil.map(({ a, n }) => (
              <li key={a} className="qg-piste-ligne">
                <span className="qg-piste-nom">
                  {NOM_DE_L_APPAREIL[a]} · {formatNumber(n)}
                </span>
                <span className="qg-piste qg-piste-or" aria-hidden="true">
                  <i style={{ width: `${(n / vues) * 100}%` }} />
                </span>
                <b>{part(n)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PageParPage pages={t.pages} />
    </>
  )
}

type Cle = 'page' | 'vues' | 'lcp' | 'inp' | 'cls' | 'erreurs'
const COLONNES: { cle: Cle; nom: string }[] = [
  { cle: 'page', nom: 'Page' },
  { cle: 'vues', nom: 'Vues' },
  { cle: 'lcp', nom: 'Affichée' },
  { cle: 'inp', nom: 'Au doigt' },
  { cle: 'cls', nom: 'Sauts' },
  { cle: 'erreurs', nom: 'Erreurs' },
]
const valeur = (p: PageDesTelephones, cle: Cle): number | string =>
  cle === 'page' ? NOM_DE_LA_PAGE_MESUREE[p.page] : cle === 'vues' || cle === 'erreurs' ? p[cle] : (p[cle]?.p75 ?? Number.NEGATIVE_INFINITY)

/** Page par page : ses vues et ses trois mesures au 75ᵉ centile, ses erreurs — triable, ce qui dépasse en couleur. */
function PageParPage({ pages }: { pages: PageDesTelephones[] }) {
  const [tri, setTri] = useState<{ cle: Cle; sens: 1 | -1 }>({ cle: 'vues', sens: -1 })
  const triees = useMemo(
    () =>
      [...pages].sort((a, b) => {
        const va = valeur(a, tri.cle)
        const vb = valeur(b, tri.cle)
        return (typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb) : Number(va) - Number(vb)) * tri.sens
      }),
    [pages, tri],
  )
  return (
    <section className="qg-console" aria-labelledby="telephones-pages">
      <div className="qg-console-tete">
        <div>
          <span className="qg-etiquette">Page par page</span>
          <h2 id="telephones-pages">Le ressenti des téléphones</h2>
          <span className="muted small">au 75ᵉ centile : trois pages sur quatre font mieux</span>
        </div>
      </div>
      {pages.length === 0 ? (
        <p className="muted small">Aucune page mesurée sur la période : les mesures arrivent quand les joueurs quittent une page.</p>
      ) : (
        <div className="qg-table-cadre">
          <table className="qg-table">
            <caption className="sr-only">Ce que les téléphones vivent, page par page</caption>
            <thead>
              <tr>
                {COLONNES.map(c => (
                  <th key={c.cle} scope="col" className={c.cle === 'page' ? '' : 'qg-nombre'} aria-sort={tri.cle === c.cle ? (tri.sens === 1 ? 'ascending' : 'descending') : undefined}>
                    <button
                      type="button"
                      className="qg-tri"
                      onClick={() => setTri(t => (t.cle === c.cle ? { cle: c.cle, sens: t.sens === 1 ? -1 : 1 } : { cle: c.cle, sens: c.cle === 'page' ? 1 : -1 }))}
                    >
                      {c.nom}
                      {tri.cle === c.cle && <Icon name={tri.sens === 1 ? 'arrow-up' : 'arrow-down'} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {triees.map(p => (
                <tr key={p.page}>
                  <th scope="row">{NOM_DE_LA_PAGE_MESUREE[p.page]}</th>
                  <td className="qg-nombre">{formatNumber(p.vues)}</td>
                  <td className={'qg-nombre' + (p.lcp && p.lcp.p75 > LCP_LENT_MS ? ' qg-table-alerte' : '')}>{p.lcp ? tempsDeReponse(p.lcp.p75) : '–'}</td>
                  <td className={'qg-nombre' + (p.inp && p.inp.p75 > INP_LENT_MS ? ' qg-table-alerte' : '')}>{p.inp ? tempsDeReponse(p.inp.p75) : '–'}</td>
                  <td className={'qg-nombre' + (p.cls && p.cls.p75 > CLS_EN_ALERTE ? ' qg-table-alerte' : '')}>{p.cls ? sauts(p.cls.p75) : '–'}</td>
                  <td className={'qg-nombre' + (p.erreurs > 0 ? ' qg-table-alerte' : '')}>{formatNumber(p.erreurs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
