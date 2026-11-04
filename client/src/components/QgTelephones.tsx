import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { CopierLeTableau } from './CopierLeTableau'
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
        {/* Ce qui dépasse se dit d'une icône et d'un mot avec le rouge : la couleur seule ne se lit pas de tous. */}
        <ul className="qg-tuiles qg-tuiles-quatre">
          <li className={'qg-tuile' + (lcp && lcp.p75 > LCP_LENT_MS ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">
              {lcp && lcp.p75 > LCP_LENT_MS && <Icon name="alert" />}
              Page affichée
            </span>
            <span className="qg-tuile-valeur num">{lcp ? tempsDeReponse(lcp.p75) : '–'}</span>
            <span className="qg-ecart qg-tuile-detail">3 pages sur 4 font mieux · lente au-delà de {tempsDeReponse(LCP_LENT_MS)}</span>
          </li>
          <li className={'qg-tuile' + (inp && inp.p75 > INP_LENT_MS ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">
              {inp && inp.p75 > INP_LENT_MS && <Icon name="alert" />}
              Réponse au doigt
            </span>
            <span className="qg-tuile-valeur num">{inp ? tempsDeReponse(inp.p75) : '–'}</span>
            <span className="qg-ecart qg-tuile-detail">3 pages sur 4 font mieux · lente au-delà de {tempsDeReponse(INP_LENT_MS)}</span>
          </li>
          <li className={'qg-tuile' + (cls && cls.p75 > CLS_EN_ALERTE ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">
              {cls && cls.p75 > CLS_EN_ALERTE && <Icon name="alert" />}
              Ce qui saute
            </span>
            <span className="qg-tuile-valeur num">{cls ? sauts(cls.p75) : '–'}</span>
            <span className="qg-ecart qg-tuile-detail">3 pages sur 4 font mieux · trop au-delà de {sauts(CLS_EN_ALERTE)}</span>
          </li>
          <li className={'qg-tuile' + (erreurs > 0 ? ' qg-tuile-alerte' : '')}>
            <span className="qg-tuile-nom">
              {erreurs > 0 && <Icon name="alert" />}
              Erreurs du client
            </span>
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
/** Les quatre mesures se détaillent à l'ordinateur ; au téléphone, une seule colonne dit la pire (`lePire`). */
const COLONNES: { cle: Cle; nom: string; detail?: true }[] = [
  { cle: 'page', nom: 'Page' },
  { cle: 'vues', nom: 'Vues' },
  { cle: 'lcp', nom: 'Affichée', detail: true },
  { cle: 'inp', nom: 'Au doigt', detail: true },
  { cle: 'cls', nom: 'Sauts', detail: true },
  { cle: 'erreurs', nom: 'Erreurs', detail: true },
]
const valeur = (p: PageDesTelephones, cle: Cle): number | string =>
  cle === 'page' ? NOM_DE_LA_PAGE_MESUREE[p.page] : cle === 'vues' || cle === 'erreurs' ? p[cle] : (p[cle]?.p75 ?? Number.NEGATIVE_INFINITY)

/**
 * Au téléphone, la pire mesure d'une page, avec son mot — celle qui dépasse le plus son seuil, une erreur avant tout :
 * la table montrait la page, ses vues, « Affichée », puis coupait « Au doigt » en silence, les sauts et les erreurs hors
 * de l'écran (la revue d'ergonomie du 4 novembre 2026). Null quand tout tient.
 */
function lePire(p: PageDesTelephones): { mot: string; valeur: string } | null {
  const depasses = [
    p.erreurs > 0 ? { mot: p.erreurs > 1 ? 'Erreurs' : 'Erreur', valeur: formatNumber(p.erreurs), r: Number.POSITIVE_INFINITY } : null,
    p.lcp && p.lcp.p75 > LCP_LENT_MS ? { mot: 'Affichée', valeur: tempsDeReponse(p.lcp.p75), r: p.lcp.p75 / LCP_LENT_MS } : null,
    p.inp && p.inp.p75 > INP_LENT_MS ? { mot: 'Au doigt', valeur: tempsDeReponse(p.inp.p75), r: p.inp.p75 / INP_LENT_MS } : null,
    p.cls && p.cls.p75 > CLS_EN_ALERTE ? { mot: 'Sauts', valeur: sauts(p.cls.p75), r: p.cls.p75 / CLS_EN_ALERTE } : null,
  ].filter(d => d !== null)
  const pire = depasses.sort((a, b) => b.r - a.r)[0]
  return pire ? { mot: pire.mot, valeur: pire.valeur } : null
}

/** Une valeur au-delà de son seuil : l'icône et le mot pour l'oreille, avec le rouge. */
function AuDela({ au, children }: { au: boolean; children: ReactNode }) {
  return au ? (
    <>
      <Icon name="alert" />
      <span className="sr-only">au-delà du seuil : </span>
      {children}
    </>
  ) : (
    <>{children}</>
  )
}

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
          <span className="muted small">trois pages sur quatre font mieux que le chiffre dit</span>
        </div>
      </div>
      {pages.length === 0 ? (
        <p className="muted small">Aucune page mesurée sur la période : les mesures arrivent quand les joueurs quittent une page.</p>
      ) : (
        <>
        <div className="qg-outils">
          <CopierLeTableau nom="le ressenti page par page" />
        </div>
        <div className="qg-table-cadre">
          <table className="qg-table">
            <caption className="sr-only">Ce que les téléphones vivent, page par page</caption>
            <thead>
              <tr>
                {COLONNES.map(c => (
                  <th
                    key={c.cle}
                    scope="col"
                    className={(c.cle === 'page' ? '' : 'qg-nombre') + (c.detail ? ' qg-colonne-detail' : '')}
                    aria-sort={tri.cle === c.cle ? (tri.sens === 1 ? 'ascending' : 'descending') : undefined}
                  >
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
                <th scope="col" className="qg-nombre qg-colonne-resume">
                  Le pire
                </th>
              </tr>
            </thead>
            <tbody>
              {triees.map(p => {
                const pire = lePire(p)
                const lente = !!(p.lcp && p.lcp.p75 > LCP_LENT_MS)
                const lourde = !!(p.inp && p.inp.p75 > INP_LENT_MS)
                const saute = !!(p.cls && p.cls.p75 > CLS_EN_ALERTE)
                return (
                  <tr key={p.page}>
                    <th scope="row">{NOM_DE_LA_PAGE_MESUREE[p.page]}</th>
                    <td className="qg-nombre">{formatNumber(p.vues)}</td>
                    <td className={'qg-nombre qg-colonne-detail' + (lente ? ' qg-table-alerte' : '')}>
                      <AuDela au={lente}>{p.lcp ? tempsDeReponse(p.lcp.p75) : '–'}</AuDela>
                    </td>
                    <td className={'qg-nombre qg-colonne-detail' + (lourde ? ' qg-table-alerte' : '')}>
                      <AuDela au={lourde}>{p.inp ? tempsDeReponse(p.inp.p75) : '–'}</AuDela>
                    </td>
                    <td className={'qg-nombre qg-colonne-detail' + (saute ? ' qg-table-alerte' : '')}>
                      <AuDela au={saute}>{p.cls ? sauts(p.cls.p75) : '–'}</AuDela>
                    </td>
                    <td className={'qg-nombre qg-colonne-detail' + (p.erreurs > 0 ? ' qg-table-alerte' : '')}>
                      <AuDela au={p.erreurs > 0}>{formatNumber(p.erreurs)}</AuDela>
                    </td>
                    <td className={'qg-nombre qg-colonne-resume' + (pire ? ' qg-table-alerte' : '')}>
                      {pire ? (
                        <AuDela au>
                          {pire.mot} {pire.valeur}
                        </AuDela>
                      ) : (
                        <span className="muted">rien à redire</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  )
}
