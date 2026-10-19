import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { choixDialog, confirmDialog } from './Dialog'
import { JaugeFine } from './LigneDeCollection'
import { gemme } from './Boutique'
import { Compagnon, teintesDuCompagnon } from './Compagnon'
// Les fichiers des compagnons, inscrits à l'évaluation : le rayon les montre dès son premier rendu.
import './compagnons-peints'
import { espacesFines, formatNumber } from '../format'
import {
  COMPAGNONS,
  JUSTES_DES_FORMES,
  NOM_DE_LA_FORME,
  PRIX_D_UN_COMPAGNON,
  avecLui,
  compagnon as leCompagnon,
  prochaineForme,
  type Compagnon as LeCompagnon,
  type CompagnonAcquis,
} from '../../../shared/compagnons'
import { CONFETTIS_D_UNE_MISSION, CONFETTIS_DES_TROIS, MISSIONS_PAR_JOUR } from '../../../shared/missions'
import { NOM_RARETE } from '../../../shared/badges'
import type { PublicProfileDetail } from '../../../shared/profil'
import { abonnerNiche, nicheActuelle } from '../niche'

// La vitrine des compagnons, dans la boutique (`/boutique#compagnons`) : un
// compagnon par écran, qu'on fait glisser — le suivant dépasse au bord, pour
// qu'on devine qu'il y en a d'autres. Chacun sur sa scène, à ses couleurs,
// en grand : il flotte, et sautille quand on le touche. Ses quatre formes en
// couleur dessous — celle qu'on adopte, puis celles qu'il prendra en
// grandissant (le choix du 13 octobre 2026 : 1000 confettis, puis 100, 300
// et 500 bonnes réponses données avec lui) — : en toucher une la montre en
// grand, jusqu'à sa forme ultime et son monde vivant. Le propriétaire, le
// 14 octobre 2026 : « les mettre vraiment en avant, super mignon et avoir
// envie de les acheter » ; les silhouettes dorées d'avant cachaient
// justement ce qu'il devient. Adopté, il s'installe dans sa niche, en haut de
// chaque page (le 18 octobre 2026) — et rien de plus : il ne devient pas son
// avatar (le 19 octobre 2026, le propriétaire : « ça le met sur notre avatar
// et dans la niche. Ça serait mieux que dans la niche »). La carte dit où il
// en est — sa forme, la jauge de la suivante —, s'il est dans sa niche —
// sinon, de quoi l'y installer : c'est celui de la niche qui grandit — et
// « Le porter en avatar », qui ouvre la loge avec lui à l'essai.

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** Ce que ses missions d'un jour rapportent au plus : la piste qu'on montre à qui n'a pas encore de quoi. */
const CONFETTIS_DES_MISSIONS = MISSIONS_PAR_JOUR * CONFETTIS_D_UNE_MISSION + CONFETTIS_DES_TROIS

/** Ce qui s'envole quand on le caresse : des cœurs et des étincelles, des emojis d'avant Unicode 13. */
const ENVOLS = ['💛', '✨', '💖', '✨', '💛']

/** « le loup », « la tortue-île » : son nom dans une phrase. */
const dansLaPhrase = (c: LeCompagnon) => `${c.le} ${c.nom.replace(/^L[ae] /, '').toLowerCase()}`

/** Le compagnon qu'une adresse ouvre — `/boutique#compagnon-chat`, le bandeau « À la une » de l'accueil — : la vitrine s'ouvre sur lui. */
export function compagnonDeLAdresse(hash: string): number | null {
  const m = /^#compagnon-([\w-]+)$/.exec(hash)
  const i = m ? COMPAGNONS.findIndex(c => c.key === m[1]) : -1
  return i >= 0 ? i : null
}

const sansMouvement = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** La scène d'un compagnon : lui en grand, ses formes, et l'adoption — ou où il en est. */
function SceneDuCompagnon({
  c,
  sien,
  porte,
  dansLaNiche,
  solde,
  busy,
  erreur,
  onAdopter,
  onInstaller,
}: {
  c: LeCompagnon
  sien: CompagnonAcquis | undefined
  porte: string | null
  /** C'est lui qui vit dans sa niche, et qui grandit. */
  dansLaNiche: boolean
  solde: number
  busy: boolean
  erreur: string | null
  onAdopter: () => void
  /** L'installer dans sa niche ; absent d'une page qui ne sait pas l'enregistrer. */
  onInstaller?: () => void
}) {
  // La forme montrée en grand : la sienne, ou celle qu'on adopte — puis celle qu'on touche.
  const [vue, setVue] = useState(sien?.rang ?? 0)
  // Chaque caresse le fait sauter de nouveau : la clé rejoue l'animation.
  const [caresses, setCaresses] = useState(0)
  const forme = c.formes[vue]
  const montree = c.formes[sien?.rang ?? 0]
  const suite = sien ? prochaineForme(sien) : null
  const manque = PRIX_D_UN_COMPAGNON - solde
  const lePorte = !!porte && c.formes.some(f => f.key === porte)
  const { aura, fond } = teintesDuCompagnon(c.key)
  const teintes = { '--aura': aura, '--scene': fond[1], '--nuit': fond[2] } as CSSProperties
  return (
    <article className="compagnon-carte" aria-labelledby={`compagnon-${c.key}`} style={teintes}>
      <button type="button" className="compagnon-scene" aria-label={`Caresser ${dansLaPhrase(c)}`} onClick={() => setCaresses(n => n + 1)}>
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
      <div className="compagnon-texte">
        <b id={`compagnon-${c.key}`} className="compagnon-nom">
          {c.nom}
        </b>
        <span className="compagnon-forme-nom" style={gemme(forme.rarete)}>
          {`${forme.nom} · ${NOM_RARETE[forme.rarete]}`}
        </span>
        <p className="muted small">{espacesFines(forme.legende)}</p>
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
          {!suite && <p className="muted small">{espacesFines('Sa forme ultime : son monde prend vie.')}</p>}
          {/* L'avatar est une autre affaire que la niche : la loge, sa forme la plus haute à l'essai. */}
          <a className="link-inline" href={lePorte ? '/profil#avatar' : `/profil?essayer=${montree.key}#avatar`}>
            {lePorte ? `Tu ${c.le} portes en avatar · en changer` : `${c.le === 'la' ? 'La' : 'Le'} porter en avatar`}
          </a>
        </div>
      ) : (
        <>
          <div className="compagnon-achat">
            <span className="compagnon-prix">{enConfettis(PRIX_D_UN_COMPAGNON)}</span>
            {manque > 0 ? (
              <span className="compagnon-economies">
                <JaugeFine part={Math.max(0, solde) / PRIX_D_UN_COMPAGNON} />
                <span className="muted small">{`Encore ${formatNumber(manque)} confettis`}</span>
              </span>
            ) : (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onAdopter}>
                L’adopter
              </button>
            )}
          </div>
          {manque > 0 && (
            <p className="muted small compagnon-astuce">
              {espacesFines(`Tes missions du jour en rapportent jusqu’à ${CONFETTIS_DES_MISSIONS} chaque jour : `)}
              <a className="link-inline" href="/#missions">
                mes missions
              </a>
            </p>
          )}
        </>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </article>
  )
}

/**
 * La vitrine des compagnons : une scène par compagnon, qu'on fait glisser,
 * des points dessous pour sauter de l'un à l'autre. L'adopter l'installe
 * dans sa niche ; s'il y en a déjà un, il choisit : l'y installer, ou
 * l'adopter seulement — celui qui y vit la garde, et continue de grandir
 * (`choixDialog`).
 */
export function RayonDesCompagnons({
  profil,
  busy,
  acheter,
  installer,
}: {
  profil: PublicProfileDetail
  busy: boolean
  /** Adopte — et l'installe dans sa niche, ou pas : rend le motif d'un refus, ou null. */
  acheter: (cle: string, installer: boolean) => Promise<string | null>
  /** Installe dans sa niche un compagnon qu'il a déjà. */
  installer?: (cle: string) => void
}) {
  const [ici, setIci] = useState(() => (typeof window === 'undefined' ? 0 : (compagnonDeLAdresse(window.location.hash) ?? 0)))
  const [erreur, setErreur] = useState<{ cle: string; motif: string } | null>(null)
  const [adopte, setAdopte] = useState<{ c: LeCompagnon; installe: boolean; resteLa: string | null } | null>(null)
  // Celui de sa niche, que sa fiche peut changer sans que la page ne relise le profil.
  const nicheIci = useSyncExternalStore(abonnerNiche, nicheActuelle, () => null)
  const piste = useRef<HTMLDivElement>(null)

  /** Amène la scène d'un compagnon au milieu de la piste. */
  const allerA = (i: number, doux = true) => {
    const el = piste.current
    const scene = el?.children[i] as HTMLElement | undefined
    if (!el || !scene) return
    el.scrollTo({ left: scene.offsetLeft - (el.clientWidth - scene.offsetWidth) / 2, behavior: doux && !sansMouvement() ? 'smooth' : 'auto' })
  }
  // Ouverte sur un compagnon (`#compagnon-chat`) : la piste y est déjà, sans
  // glisser. Une fois à l'ouverture, ensuite c'est le doigt qui mène — sauf
  // une adresse suivie d'ici même (« Ses formes », dans la fiche de la niche) :
  // la page ne se recharge pas, la piste y va.
  useEffect(() => {
    if (ici > 0) allerA(ici, false)
    const suivre = () => {
      const i = compagnonDeLAdresse(window.location.hash)
      if (i === null) return
      setIci(i)
      allerA(i)
    }
    window.addEventListener('hashchange', suivre)
    return () => window.removeEventListener('hashchange', suivre)
  }, [])
  /** La scène la plus près du milieu : celle que les points allument. */
  const surLaPiste = () => {
    const el = piste.current
    if (!el) return
    const milieu = el.scrollLeft + el.clientWidth / 2
    let mieux = 0
    let ecart = Infinity
    Array.from(el.children).forEach((s, i) => {
      const e = s as HTMLElement
      const d = Math.abs(e.offsetLeft + e.offsetWidth / 2 - milieu)
      if (d < ecart) {
        ecart = d
        mieux = i
      }
    })
    setIci(mieux)
  }

  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  const dansLaNiche = nicheIci?.compagnon ?? profil.niche
  const adopter = async (c: LeCompagnon) => {
    if (busy) return
    setErreur(null)
    setAdopte(null)
    const il = c.le === 'la' ? 'Elle' : 'Il'
    const prix = `${il} coûte ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_COMPAGNON)}.`
    // Un compagnon vit déjà dans sa niche : il choisit qui y grandit.
    const sien = dansLaNiche && dansLaNiche !== c.key ? profil.compagnons?.find(a => a.compagnon === dansLaNiche) : undefined
    const resteLa = sien ? (nicheIci?.compagnon === sien.compagnon ? nicheIci.nom : sien.nom) ?? dansLaPhrase(leCompagnon(sien.compagnon)!) : null
    let installe = true
    if (!resteLa) {
      const oui = await confirmDialog({
        title: c.nom,
        message: `${prix} ${il} s’installera dans ta niche, en haut de chaque page, et grandira avec tes bonnes réponses.`,
        confirmLabel: `L’adopter · ${enConfettis(PRIX_D_UN_COMPAGNON)}`,
        cancelLabel: 'Plus tard',
      })
      if (!oui) return
    } else {
      const choix = await choixDialog({
        title: c.nom,
        message: `${prix} ${il} peut prendre la place de ${resteLa} dans ta niche — c’est celui de ta niche qui grandit. Tu pourras changer quand tu veux, en touchant ta niche.`,
        confirmLabel: `L’adopter et l’installer · ${enConfettis(PRIX_D_UN_COMPAGNON)}`,
        alternative: { label: 'L’adopter seulement' },
        cancelLabel: 'Plus tard',
      })
      if (!choix) return
      installe = choix.geste === 'confirmer'
    }
    const refus = await acheter(c.key, installe)
    if (refus) return setErreur({ cle: c.key, motif: refus })
    setAdopte({ c, installe, resteLa })
  }
  return (
    <section className="rayon-compagnons">
      <p className="gemme-legende">
        {espacesFines(
          'Il vit dans ta niche, en haut de chaque page, et grandit avec toi : 100, 300 puis 500 bonnes réponses, en soirée, au quiz du jour et en campagne. Une forme atteinte ne se perd jamais, et chacune se porte aussi en avatar.',
        )}
      </p>
      {adopte && (
        <p className="card theme-achete" role="status">
          {espacesFines(
            adopte.installe
              ? `${adopte.c.nom} est à toi : ${adopte.c.le === 'la' ? 'elle' : 'il'} s’installe dans ta niche. Touche-la pour lui donner un nom.`
              : `${adopte.c.nom} est à toi. ${adopte.resteLa ? `${adopte.resteLa.charAt(0).toUpperCase()}${adopte.resteLa.slice(1)} garde ta niche` : 'Ta niche ne change pas'} : touche-la pour changer quand tu veux.`,
          )}
        </p>
      )}
      <div className="vitrine-compagnons" ref={piste} onScroll={surLaPiste} aria-label="Les compagnons">
        {COMPAGNONS.map(c => (
          <SceneDuCompagnon
            key={c.key}
            c={c}
            sien={boutique.compagnons?.find(a => a.compagnon === c.key)}
            porte={profil.legendaire}
            dansLaNiche={dansLaNiche === c.key}
            solde={solde}
            busy={busy}
            erreur={erreur?.cle === c.key ? erreur.motif : null}
            onAdopter={() => void adopter(c)}
            onInstaller={installer && (() => installer(c.key))}
          />
        ))}
      </div>
      <div className="vitrine-points">
        {COMPAGNONS.map((c, i) => (
          <button key={c.key} type="button" className="vitrine-point" aria-label={c.nom} aria-current={i === ici || undefined} onClick={() => allerA(i)} />
        ))}
      </div>
    </section>
  )
}
