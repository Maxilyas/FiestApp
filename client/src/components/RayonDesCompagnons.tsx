import { useState, useSyncExternalStore, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { choixDialog, confirmDialog } from './Dialog'
import { JaugeFine } from './LigneDeCollection'
import { gemme } from './Boutique'
import { Feuille } from './Pieces'
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
  compagnon as leCompagnon,
  formeDeCompagnon,
  prochaineForme,
  type CleDeCompagnon,
  type Compagnon as LeCompagnon,
  type CompagnonAcquis,
} from '../../../shared/compagnons'
import { CONFETTIS_D_UNE_MISSION, CONFETTIS_DES_TROIS, MISSIONS_PAR_JOUR } from '../../../shared/missions'
import { NOM_RARETE } from '../../../shared/badges'
import { ORNEMENTS, prochainOrnement, titreDeLAmitie } from '../../../shared/ornements'
import type { PublicProfileDetail } from '../../../shared/profil'
import { abonnerNiche, nicheActuelle } from '../niche'

// Les compagnons, à la boutique (`/boutique#compagnons`) : une étagère qu'on
// fait glisser, une carte chacun à ses couleurs — celui qu'on adopte, ou sa
// forme du moment s'il est à lui —, et sa fiche dans une feuille, au toucher :
// sa scène, en grand. Il y flotte, et sautille quand on le touche ; ses
// quatre formes en couleur dessous — celle qu'on adopte, puis celles qu'il
// prendra en grandissant (le choix du 13 octobre 2026 : 1000 confettis, puis
// 100, 300 et 500 bonnes réponses données avec lui) — : en toucher une la
// montre en grand, jusqu'à sa forme ultime et son monde vivant. Le
// propriétaire, le 14 octobre 2026 : « les mettre vraiment en avant, super
// mignon et avoir envie de les acheter ». Une scène chacun, qu'on faisait
// défiler une à une, prenait tout l'écran et laissait les quatre autres
// derrière elle (la refonte du 1er novembre 2026) : l'étagère les montre
// ensemble, la feuille l'un après l'autre.
//
// Il s'essaie avant de s'adopter : « L'essayer dans ma niche » l'y fait
// paraître, à sa première forme, le temps de la visite — rien ne s'écrit
// (`essayerNiche`, `client/src/niche.ts`). Adopté, il s'installe dans sa
// niche, en haut de chaque page (le 18 octobre 2026) — et rien de plus : il
// ne devient pas son avatar (le 19 octobre 2026, le propriétaire : « ça le met
// sur notre avatar et dans la niche. Ça serait mieux que dans la niche »). Sa
// fiche dit où il en est — sa forme, la jauge de la suivante —, s'il est dans
// sa niche — sinon, de quoi l'y installer : c'est celui de la niche qui
// grandit — et « Le porter en avatar », qui ouvre la loge avec lui à l'essai.

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** Ce que ses missions d'un jour rapportent au plus : la piste qu'on montre à qui n'a pas encore de quoi. */
const CONFETTIS_DES_MISSIONS = MISSIONS_PAR_JOUR * CONFETTIS_D_UNE_MISSION + CONFETTIS_DES_TROIS

/** Ce qui s'envole quand on le caresse : des cœurs et des étincelles, des emojis d'avant Unicode 13. */
const ENVOLS = ['💛', '✨', '💖', '✨', '💛']

/** « le loup », « la tortue-île » : son nom dans une phrase. */
const dansLaPhrase = (c: LeCompagnon) => `${c.le} ${c.nom.replace(/^L[ae] /, '').toLowerCase()}`

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

/** La scène d'un compagnon : lui en grand, ses formes, et l'adoption — ou où il en est. */
export function SceneDuCompagnon({
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
  const orne = sien && !suite ? prochainOrnement(sien) : null
  const manque = PRIX_D_UN_COMPAGNON - solde
  // Sa métamorphose aussi : c'est lui qu'on porte.
  const lePorte = formeDeCompagnon(porte)?.compagnon === c.key
  return (
    <article className="compagnon-carte" aria-labelledby={`compagnon-${c.key}`} style={teintes(c.key)}>
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
 * L'étagère des compagnons : une carte chacun, sa scène en petit — celui
 * qu'on adopte, ou sa forme du moment s'il est à lui —, son nom, et ce qu'il
 * est pour lui : son prix, ce qui manque, « À l'essai », « Dans ta niche ».
 * La toucher ouvre sa fiche.
 */
export function RayonDesCompagnons({
  profil,
  essai,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Celui qu'on essaie dans sa niche. */
  essai?: string
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
    <ul className="etagere etagere-compagnons" aria-label="Les compagnons">
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
              ? enConfettis(PRIX_D_UN_COMPAGNON)
              : `encore ${formatNumber(PRIX_D_UN_COMPAGNON - solde)}`
        return (
          <li key={c.key}>
            <button
              type="button"
              className={'compagnon-vitrine' + (sien ? ' compagnon-a-toi' : '') + (essaye ? ' compagnon-essaye' : '')}
              style={teintes(c.key)}
              aria-haspopup="dialog"
              aria-label={`${c.nom}, ${etat.replace('🎊 ', '')}${etat.startsWith('🎊') ? ' confettis' : ''}`}
              onClick={() => onOuvrir(c.key)}
            >
              <span className="compagnon-vitrine-scene" aria-hidden="true">
                <Compagnon cle={forme.key} />
              </span>
              <span className="compagnon-vitrine-pied">
                <b>{c.nom}</b>
                <span className="compagnon-vitrine-prix">{etat}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * La fiche d'un compagnon, dans une feuille : sa scène, et, s'il n'est pas à
 * lui, « L'essayer dans ma niche » sous le pouce. L'adopter l'installe dans sa
 * niche ; s'il y en a déjà un, il choisit : l'y installer, ou l'adopter
 * seulement — celui qui y vit la garde, et continue de grandir (`choixDialog`).
 */
export function FicheDuCompagnon({
  profil,
  cle,
  busy,
  essaye,
  onEssayer,
  acheter,
  installer,
  onAdopte,
  onFermer,
}: {
  profil: PublicProfileDetail
  cle: CleDeCompagnon
  busy: boolean
  /** Il est à l'essai dans sa niche. */
  essaye: boolean
  onEssayer: () => void
  /** Adopte — et l'installe dans sa niche, ou pas : rend le motif d'un refus, ou null. */
  acheter: (cle: string, installer: boolean) => Promise<string | null>
  /** Installe dans sa niche un compagnon qu'il a déjà. */
  installer?: (cle: string) => void
  /** Adopté : l'essai s'arrête, il est à lui. */
  onAdopte?: () => void
  onFermer: () => void
}) {
  const [erreur, setErreur] = useState<string | null>(null)
  const [adopte, setAdopte] = useState<{ installe: boolean; resteLa: string | null } | null>(null)
  const nicheIci = useSyncExternalStore(abonnerNiche, nicheActuelle, () => null)
  const c = leCompagnon(cle)
  const boutique = profil.boutique
  if (!c || !boutique) return null
  const solde = boutique.confettis.solde
  const dansLaNiche = nicheIci?.compagnon ?? profil.niche
  const sien = boutique.compagnons?.find(a => a.compagnon === c.key)
  const adopter = async () => {
    if (busy) return
    setErreur(null)
    setAdopte(null)
    const il = c.le === 'la' ? 'Elle' : 'Il'
    const prix = `${il} coûte ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_COMPAGNON)}.`
    // Un compagnon vit déjà dans sa niche : il choisit qui y grandit.
    const autre = dansLaNiche && dansLaNiche !== c.key ? profil.compagnons?.find(a => a.compagnon === dansLaNiche) : undefined
    const resteLa = autre ? ((nicheIci?.compagnon === autre.compagnon ? nicheIci.nom : autre.nom) ?? dansLaPhrase(leCompagnon(autre.compagnon)!)) : null
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
    if (refus) return setErreur(refus)
    setAdopte({ installe, resteLa })
    onAdopte?.()
  }
  return (
    <Feuille
      titre={c.nom}
      onFermer={onFermer}
      className="feuille-boutique"
      pied={
        !sien && (
          // Un interrupteur : son nom ne change pas, `aria-pressed` dit s'il est à l'essai.
          <button type="button" className="btn btn-ghost btn-block" aria-pressed={essaye} onClick={onEssayer}>
            <Icon name="home" />
            L’essayer dans ma niche
          </button>
        )
      }
    >
      {adopte && (
        <p className="card theme-achete" role="status">
          {espacesFines(
            adopte.installe
              ? `${c.nom} est à toi : ${c.le === 'la' ? 'elle' : 'il'} s’installe dans ta niche. « Gérer ma niche », pour lui donner un nom.`
              : `${c.nom} est à toi. ${adopte.resteLa ? `${adopte.resteLa.charAt(0).toUpperCase()}${adopte.resteLa.slice(1)} garde ta niche` : 'Ta niche ne change pas'} : « Gérer ma niche », pour changer quand tu veux.`,
          )}
        </p>
      )}
      <SceneDuCompagnon
        c={c}
        sien={sien}
        porte={profil.legendaire}
        dansLaNiche={dansLaNiche === c.key}
        solde={solde}
        busy={busy}
        erreur={erreur}
        onAdopter={() => void adopter()}
        onInstaller={installer && (() => installer(c.key))}
      />
    </Feuille>
  )
}
