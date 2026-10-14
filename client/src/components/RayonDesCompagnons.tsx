import { useState } from 'react'
import { Icon } from './Icon'
import { choixDialog } from './Dialog'
import { JaugeFine } from './LigneDeCollection'
import { gemme } from './Boutique'
import { Compagnon } from './Compagnon'
// Les fichiers des compagnons, inscrits à l'évaluation : le rayon les montre dès son premier rendu.
import './compagnons-peints'
import { espacesFines, formatNumber } from '../format'
import {
  COMPAGNONS,
  JUSTES_DES_FORMES,
  NOM_DE_LA_FORME,
  PRIX_D_UN_COMPAGNON,
  enLePortant,
  prochaineForme,
  type Compagnon as LeCompagnon,
  type CompagnonAcquis,
} from '../../../shared/compagnons'
import { NOM_RARETE } from '../../../shared/badges'
import type { PublicProfileDetail } from '../../../shared/profil'

// Le rayon des compagnons, dans la boutique (`/boutique#compagnons`) : les
// trois compagnons, chacun avec ses quatre formes — celle qu'on achète, puis
// celles qu'il prendra en grandissant (le choix du 13 octobre 2026 : 1000
// confettis, puis 100, 300 et 500 bonnes réponses données en le portant).
// Acheté, la carte dit où il en est — sa forme, la jauge de la suivante — et
// où le porter ; on ne le porte pas d'ici, la loge le fait.

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** La carte d'un compagnon : sa forme du moment en grand, ses quatre formes, et l'achat — ou où il en est. */
function CarteDuCompagnon({
  c,
  sien,
  porte,
  solde,
  busy,
  onAcheter,
}: {
  c: LeCompagnon
  sien: CompagnonAcquis | undefined
  porte: string | null
  solde: number
  busy: boolean
  onAcheter: () => void
}) {
  const montree = c.formes[sien?.rang ?? 0]
  const suite = sien ? prochaineForme(sien) : null
  const manque = PRIX_D_UN_COMPAGNON - solde
  const lePorte = !!porte && c.formes.some(f => f.key === porte)
  return (
    <article className="card compagnon-carte" aria-labelledby={`compagnon-${c.key}`}>
      <div className="compagnon-tete">
        <span className="compagnon-grand" aria-hidden="true">
          <Compagnon cle={montree.key} grand />
        </span>
        <span className="compagnon-titre">
          <b id={`compagnon-${c.key}`}>{c.nom}</b>
          <span className="muted small">{espacesFines(c.phrase)}</span>
        </span>
      </div>
      {/* Ses quatre formes : celles qu'il a en couleur, les autres en silhouette, et ce qu'elles demandent. */}
      <ol className="compagnon-formes" aria-label={`Les formes ${c.le === 'la' ? 'de la' : 'du'} ${c.nom.replace(/^L[ae] /, '')}`}>
        {c.formes.map(f => {
          const aLui = !!sien && sien.rang >= f.rang
          return (
            <li key={f.key} className={'compagnon-forme' + (aLui ? '' : ' compagnon-a-venir')} style={gemme(f.rarete)}>
              <span className="compagnon-petit" aria-hidden="true">
                <Compagnon cle={f.key} verrouille={!aLui} />
              </span>
              <span className="sr-only">{`${f.nom}, ${NOM_RARETE[f.rarete].toLowerCase()}, ${aLui ? 'à toi' : f.rang === 0 ? 'à l’achat' : `à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses`}`}</span>
              <span className="compagnon-seuil" aria-hidden="true">
                {f.rang === 0 ? 'Achat' : formatNumber(JUSTES_DES_FORMES[f.rang])}
              </span>
            </li>
          )
        })}
      </ol>
      {sien ? (
        <div className="compagnon-sien">
          <p className="small">
            <Icon name="check" />
            {espacesFines(`À toi · ${montree.nom}, ${NOM_DE_LA_FORME[montree.rang].toLowerCase()}`)}
          </p>
          {suite && (
            <div className="compagnon-jauge">
              <JaugeFine part={sien.justes / JUSTES_DES_FORMES[suite.forme.rang]} />
              <span className="muted small">
                {espacesFines(`${formatNumber(sien.justes)} sur ${formatNumber(JUSTES_DES_FORMES[suite.forme.rang])} bonnes réponses ${enLePortant(c)} : ${suite.forme.nom.charAt(0).toLowerCase()}${suite.forme.nom.slice(1)}`)}
              </span>
            </div>
          )}
          {!suite && <p className="muted small">{espacesFines('Sa forme ultime : son monde prend vie.')}</p>}
          <a className="link-inline" href="/profil#avatar">
            {lePorte ? `Tu ${c.le} portes · en changer` : `${c.le === 'la' ? 'La' : 'Le'} porter`}
          </a>
        </div>
      ) : (
        <div className="compagnon-achat">
          <span className="compagnon-prix">{enConfettis(PRIX_D_UN_COMPAGNON)}</span>
          {manque > 0 ? (
            <span className="muted small">{`Encore ${formatNumber(manque)} confettis`}</span>
          ) : (
            <button type="button" className="btn btn-small" disabled={busy} onClick={onAcheter}>
              L’acheter
            </button>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * Le rayon des compagnons : trois cartes, l'achat sur chacune. Le porter
 * tout de suite, ou le garder pour plus tard, comme un thème (`choixDialog`).
 */
export function RayonDesCompagnons({
  profil,
  busy,
  acheter,
}: {
  profil: PublicProfileDetail
  busy: boolean
  /** Achète — et porte, ou garde pour plus tard : rend le motif d'un refus, ou null. */
  acheter: (cle: string, porter: boolean) => Promise<string | null>
}) {
  const [erreur, setErreur] = useState<{ cle: string; motif: string } | null>(null)
  const [achete, setAchete] = useState<{ c: LeCompagnon; porte: boolean } | null>(null)
  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  const acheterLe = async (c: LeCompagnon) => {
    if (busy) return
    setErreur(null)
    setAchete(null)
    const il = c.le === 'la' ? 'Elle' : 'Il'
    const choix = await choixDialog({
      title: c.nom,
      message: `${il} coûte ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_COMPAGNON)}. ${il} grandira avec les bonnes réponses que tu donnes ${enLePortant(c)}.`,
      confirmLabel: `Acheter et porter · ${enConfettis(PRIX_D_UN_COMPAGNON)}`,
      alternative: { label: 'L’acheter seulement' },
      cancelLabel: 'Plus tard',
    })
    if (!choix) return
    const porter = choix.geste === 'confirmer'
    const refus = await acheter(c.key, porter)
    if (refus) return setErreur({ cle: c.key, motif: refus })
    setAchete({ c, porte: porter })
  }
  return (
    <section className="rayon-compagnons">
      <p className="gemme-legende">
        {espacesFines(
          'Chacun grandit avec toi : 100, 300 puis 500 bonnes réponses données en le portant, en soirée, au quiz du jour et en campagne. Une forme atteinte ne se perd jamais.',
        )}
      </p>
      {achete && (
        <p className="card theme-achete" role="status">
          {achete.porte ? (
            `${achete.c.nom} est à toi, et tu ${achete.c.le} portes.`
          ) : (
            <>
              {`${achete.c.nom} est à toi : `}
              <a className="link-inline" href="/profil#avatar">
                {`${achete.c.le} porter`}
              </a>
              {' quand tu veux.'}
            </>
          )}
        </p>
      )}
      {COMPAGNONS.map(c => (
        <div key={c.key}>
          <CarteDuCompagnon
            c={c}
            sien={boutique.compagnons?.find(a => a.compagnon === c.key)}
            porte={profil.legendaire}
            solde={solde}
            busy={busy}
            onAcheter={() => void acheterLe(c)}
          />
          {erreur?.cle === c.key && (
            <p className="error" role="alert">
              {erreur.motif}
            </p>
          )}
        </div>
      ))}
    </section>
  )
}
