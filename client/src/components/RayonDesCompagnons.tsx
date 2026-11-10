import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { Icon } from './Icon'
import { JaugeFine } from './LigneDeCollection'
import { PrixDeLaTuile, gemme } from './Boutique'
import { Compagnon, teintesDuCompagnon } from './Compagnon'
// Les fichiers des compagnons, inscrits à l'évaluation : le rayon les montre dès son premier rendu.
import './compagnons-peints'
import { espacesFines, formatNumber } from '../format'
import {
  COMPAGNONS_DE_LA_BOUTIQUE,
  JUSTES_DES_FORMES,
  NOM_DE_LA_FORME,
  PRIX_D_UN_COMPAGNON,
  avecLui,
  formeDeCompagnon,
  prochaineForme,
  type CleDeCompagnon,
  type Compagnon as LeCompagnon,
  type CompagnonAcquis,
} from '../../../shared/compagnons'
import { NOM_RARETE } from '../../../shared/badges'
import { ORNEMENTS, prochainOrnement, titreDeLAmitie } from '../../../shared/ornements'
import type { PublicProfileDetail } from '../../../shared/profil'
import { abonnerNiche, nicheActuelle } from '../niche'

// Les compagnons, à la boutique (`/boutique#compagnons`) : les cinq sur une
// seule rangée, chacun dans son médaillon, à ses couleurs — celui qu'on
// adopte, ou sa forme du moment s'il est à lui (la refonte du 10 novembre
// 2026 : l'étagère qu'on faisait glisser en montrait un sur cinq en 360 de
// large). Toucher un médaillon ouvre son présentoir : lui en plus grand, qui
// sautille quand on le touche, ses quatre formes en couleur dessous — celle
// qu'on adopte, puis celles qu'il prendra en grandissant (le choix du
// 13 octobre 2026 : 1000 confettis, puis 100, 300 et 500 bonnes réponses
// données avec lui) — : en toucher une la montre à sa place. Le propriétaire,
// le 14 octobre 2026 : « les mettre vraiment en avant, super mignon et avoir
// envie de les acheter ».
//
// Il s'essaie avant de s'adopter : « L'essayer » l'y fait paraître, à sa
// première forme, le temps de la visite — rien ne s'écrit (`essayerNiche`,
// `client/src/niche.ts`). Adopté, il s'installe dans sa niche, en haut de
// chaque page (le 18 octobre 2026) — et rien de plus : il ne devient pas son
// avatar (le 19 octobre 2026, le propriétaire : « ça le met sur notre avatar
// et dans la niche. Ça serait mieux que dans la niche »). Sa fiche dit où il
// en est — sa forme, la jauge de la suivante —, s'il est dans sa niche —
// sinon, de quoi l'y installer : c'est celui de la niche qui grandit — et
// « Le porter en avatar », qui ouvre la loge avec lui à l'essai.

/** Ce qui s'envole quand on le caresse : des cœurs et des étincelles, des emojis d'avant Unicode 13. */
const ENVOLS = ['💛', '✨', '💖', '✨', '💛']

/** « le loup », « la tortue-île » : son nom dans une phrase. */
export const dansLaPhrase = (c: LeCompagnon) => `${c.le} ${c.nom.replace(/^L[ae] /, '').toLowerCase()}`

/** « Loup », « Tortue » : son nom en un mot, sous son médaillon — cinq sur une rangée de téléphone. */
const enUnMot = (c: LeCompagnon) => c.nom.replace(/^L[ae] /, '').split(/[ -]/)[0]

/** Le compagnon qu'une adresse ouvre — `/boutique#compagnon-chat`, le bandeau « À la une » de l'accueil — : sa fiche s'ouvre sur lui. */
export function compagnonDeLAdresse(hash: string): CleDeCompagnon | null {
  const m = /^#compagnon-([\w-]+)$/.exec(hash)
  return m ? (COMPAGNONS_DE_LA_BOUTIQUE.find(c => c.key === m[1])?.key ?? null) : null
}

/** Les couleurs de sa scène : le bleu de nuit du loup, la prune du chat, le lagon de la tortue. */
function teintes(c: CleDeCompagnon): CSSProperties {
  const { aura, fond } = teintesDuCompagnon(c)
  return { '--aura': aura, '--scene': fond[1], '--nuit': fond[2] } as CSSProperties
}

/**
 * La rangée des compagnons : un médaillon chacun — celui qu'on adopte, ou sa
 * forme du moment s'il est à lui —, son nom en un mot, et ce qu'il est pour
 * lui : son prix, à l'or s'il a de quoi, ou sa coche. Le toucher ouvre sa
 * fiche.
 */
export function RayonDesCompagnons({
  profil,
  essai,
  envie,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Celui qu'on essaie dans sa niche. */
  essai?: string
  /** Celui pour lequel il économise. */
  envie?: string
  onOuvrir: (cle: CleDeCompagnon) => void
}) {
  // Celui de sa niche, que sa fiche peut changer sans que la page ne relise le profil.
  const nicheIci = useSyncExternalStore(abonnerNiche, nicheActuelle, () => null)
  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  const dansLaNiche = nicheIci?.compagnon ?? profil.niche
  return (
    // Ceux qui se vendent : les cinq, la luciole comprise depuis le 31 octobre 2026 (l'Expédition, qui l'amenait, effacée).
    <ul className="rang-des-compagnons" aria-label="Les compagnons">
      {COMPAGNONS_DE_LA_BOUTIQUE.map(c => {
        const sien = boutique.compagnons?.find(a => a.compagnon === c.key)
        const forme = c.formes[sien?.rang ?? 0]
        const essaye = !sien && essai === c.key
        const etat = sien
          ? dansLaNiche === c.key
            ? 'Dans ta niche'
            : 'À toi'
          : essaye
            ? 'À l’essai'
            : solde >= PRIX_D_UN_COMPAGNON
              ? `${formatNumber(PRIX_D_UN_COMPAGNON)} confettis`
              : `encore ${formatNumber(PRIX_D_UN_COMPAGNON - solde)}`
        return (
          <li key={c.key}>
            <button
              type="button"
              className={'compagnon-vitrine' + (sien ? ' compagnon-a-toi' : '') + (essaye ? ' compagnon-essaye' : '')}
              style={teintes(c.key)}
              aria-haspopup="dialog"
              aria-label={`${c.nom}, ${etat}${envie === c.key ? ', ton envie' : ''}`}
              onClick={() => onOuvrir(c.key)}
            >
              <span className="compagnon-vitrine-scene" aria-hidden="true">
                <Compagnon cle={forme.key} />
              </span>
              <b className="compagnon-vitrine-nom">{enUnMot(c)}</b>
              {sien ? (
                <span className="compagnon-vitrine-a-toi">
                  <Icon name="check" />à toi
                </span>
              ) : (
                <PrixDeLaTuile prix={PRIX_D_UN_COMPAGNON} solde={solde} />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * La fiche d'un compagnon, dans le présentoir : lui dans son médaillon, qui
 * bondit au toucher ; ce qu'il est, et son prix — ou sa coche —, que le
 * présentoir pose à côté (`children`) ; ses quatre formes, en couleur, dont
 * chacune se montre à sa place au toucher ; puis, à lui, où il en est et
 * s'il vit dans sa niche — sinon ce qu'il fera, une fois adopté.
 */
export function FicheDuCompagnon({
  c,
  sien,
  porte,
  dansLaNiche,
  busy,
  onInstaller,
  children,
}: {
  c: LeCompagnon
  sien: CompagnonAcquis | undefined
  /** Ce qu'il porte en avatar : sa métamorphose aussi, c'est lui. */
  porte: string | null
  /** C'est lui qui vit dans sa niche, et qui grandit. */
  dansLaNiche: boolean
  busy: boolean
  /** L'installer dans sa niche ; absent d'une page qui ne sait pas l'enregistrer. */
  onInstaller?: () => void
  /** Son prix et ce qui manque — la même pièce pour les quatre rayons. */
  children?: ReactNode
}) {
  // La forme montrée en grand : la sienne, ou celle qu'on adopte — puis celle qu'on touche.
  const [vue, setVue] = useState(sien?.rang ?? 0)
  // Chaque caresse le fait sauter de nouveau : la clé rejoue l'animation.
  const [caresses, setCaresses] = useState(0)
  const forme = c.formes[vue]
  const montree = c.formes[sien?.rang ?? 0]
  const suite = sien ? prochaineForme(sien) : null
  const orne = sien && !suite ? prochainOrnement(sien) : null
  const lePorte = formeDeCompagnon(porte)?.compagnon === c.key
  return (
    <div className="presentoir-corps" style={teintes(c.key)}>
      <div className="presentoir-fiche">
        <button type="button" className="presentoir-image compagnon-scene" aria-label={`Caresser ${dansLaPhrase(c)}`} onClick={() => setCaresses(n => n + 1)}>
          <span key={caresses} className={'compagnon-bete' + (caresses > 0 ? ' saute' : '')} aria-hidden="true">
            <Compagnon cle={forme.key} grand />
          </span>
          {caresses > 0 && (
            <span key={`envol-${caresses}`} className="compagnon-envols" aria-hidden="true">
              {ENVOLS.map((e, i) => (
                <i key={i}>{e}</i>
              ))}
            </span>
          )}
        </button>
        {/* Une forme touchée, le compagnon suivant : ce qui change ici se dit à l'oreille, la fenêtre restant la même. */}
        <div className="presentoir-texte" aria-live="polite">
          <span className="presentoir-sorte" style={gemme(forme.rarete)}>
            <i className="article-gemme" aria-hidden="true" />
            {`Compagnon · ${NOM_RARETE[forme.rarete]}`}
          </span>
          <h3 className="presentoir-nom">{c.nom}</h3>
          <p>
            <b>{`${forme.nom}.`}</b> {espacesFines(forme.legende)}
          </p>
          {children}
        </div>
      </div>
      {/* Ses quatre formes, en couleur : en toucher une la montre en grand. */}
      <ol className="compagnon-formes" aria-label={`Les formes ${c.le === 'la' ? 'de la' : 'du'} ${c.nom.replace(/^L[ae] /, '')}`}>
        {c.formes.map(f => {
          const aLui = !!sien && sien.rang >= f.rang
          const demande = f.rang === 0 ? 'à l’adoption' : `à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses`
          return (
            <li key={f.key}>
              <button
                type="button"
                className={'compagnon-forme' + (aLui ? ' compagnon-atteinte' : '')}
                style={gemme(f.rarete)}
                aria-pressed={vue === f.rang}
                aria-label={`${f.nom}, ${NOM_RARETE[f.rarete].toLowerCase()}, ${aLui ? 'à toi' : demande}`}
                onClick={() => setVue(f.rang)}
              >
                <span className="compagnon-petit" aria-hidden="true">
                  <Compagnon cle={f.key} />
                </span>
                <span className="compagnon-seuil" aria-hidden="true">
                  {f.rang === 0 ? 'Achat' : formatNumber(JUSTES_DES_FORMES[f.rang])}
                </span>
              </button>
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
          {dansLaNiche ? (
            <p className="small compagnon-niche">
              <Icon name="home" />
              {espacesFines(`Dans ta niche : c’est ${c.le === 'la' ? 'elle' : 'lui'} qui grandit`)}
            </p>
          ) : (
            onInstaller && (
              <button type="button" className="btn btn-ghost compagnon-installer" disabled={busy} onClick={onInstaller}>
                <Icon name="home" />
                L’installer dans ma niche
              </button>
            )
          )}
          {suite && (
            <div className="compagnon-jauge">
              <JaugeFine part={sien.justes / JUSTES_DES_FORMES[suite.forme.rang]} />
              <span className="muted small">
                {espacesFines(`${formatNumber(sien.justes)} sur ${formatNumber(JUSTES_DES_FORMES[suite.forme.rang])} bonnes réponses ${avecLui(c)} : ${suite.forme.nom.charAt(0).toLowerCase()}${suite.forme.nom.slice(1)}`)}
              </span>
            </div>
          )}
          {/* Après sa forme ultime, la jauge vise le palier suivant de sa niche, et ne s'arrête qu'à la légende (le 19 octobre 2026). */}
          {!suite && orne && (
            <div className="compagnon-jauge">
              <JaugeFine part={sien.justes / orne.ornement.justes} />
              <span className="muted small">
                {espacesFines(`${formatNumber(sien.justes)} sur ${formatNumber(orne.ornement.justes)} bonnes réponses ${avecLui(c)} : ${orne.ornement.nom}`)}
              </span>
            </div>
          )}
          {!suite && !orne && <p className="muted small">{espacesFines(`${titreDeLAmitie(ORNEMENTS.length)} : sa niche a tous ses ornements.`)}</p>}
          {/* L'avatar est une autre affaire que la niche : la loge, sa forme la plus haute à l'essai. */}
          <a className="link-inline" href={lePorte ? '/profil#avatar' : `/profil?essayer=${montree.key}#avatar`}>
            {lePorte ? `Tu ${c.le} portes en avatar · en changer` : `${c.le === 'la' ? 'La' : 'Le'} porter en avatar`}
          </a>
          {/* Sa niche se gère à son écran du profil — son nom, sa forme, ses ornements, qui y vit : on ne la trouvait qu'en la touchant. */}
          <a className="link-inline" href="/profil#compagnon">
            Gérer ma niche
          </a>
        </div>
      ) : (
        <p className="presentoir-dit">
          {espacesFines(`${c.le === 'la' ? 'Elle' : 'Il'} vit dans ta niche, en haut de tes pages, et grandit avec tes bonnes réponses.`)}
        </p>
      )}
    </div>
  )
}
