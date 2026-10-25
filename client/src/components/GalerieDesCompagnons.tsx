import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Icon } from './Icon'
import { Compagnon as DessinDuCompagnon, teintesDuCompagnon } from './Compagnon'
import { choixDialog, confirmDialog } from './Dialog'
import { PROPOSITIONS } from './Niche'
import { useModale } from '../modale'
import { espacesFines, formatNumber } from '../format'
import { gemme } from '../gemmes'
import { NOM_RARETE } from '../../../shared/badges'
import {
  COMPAGNONS,
  JUSTES_DES_FORMES,
  NOM_D_UN_COMPAGNON_MAX,
  PRIX_D_UN_COMPAGNON,
  metamorphoseOuverte,
  prochaineForme,
  type CleDeCompagnon,
  type Compagnon,
  type CompagnonAcquis,
} from '../../../shared/compagnons'
import { CONFETTIS_D_UNE_MISSION, CONFETTIS_DES_TROIS, MISSIONS_PAR_JOUR } from '../../../shared/missions'
import { LEGENDAIRES, estUneVoieDExpedition, voiesMontrees } from '../../../shared/legendaires'
import { CABINET_EN_PRODUCTION } from '../../../shared/cabinet/ouverture'

// « Tous les voir » (la maquette validée le 20 octobre 2026 : « cliquer sur
// adopter et que ça me montre tous les compagnons que je peux avoir mais pas
// que ça me redirige vers la boutique ») : les quatre, chacun sa scène et ce
// qu'il faut pour l'avoir — la luciole comprise, « Expédition » (« c'est
// particulier les compagnons donc pas que dans collections », le
// propriétaire). Sa fiche montre ses formes et comment l'avoir, et l'on
// adopte sur place, comme à la boutique : l'installer dans sa niche, ou
// l'adopter seulement.
//
// Le Cabinet de curiosités ouvert en production, la luciole s'y gagne d'abord,
// à la première salle complète — « Cabinet » : l'Expédition ferme son départ
// le même jour, et n'y mènerait plus personne de neuf. Fermé, il se tait, comme
// dans l'album (`voiesDeLAvatar`, le drapeau du code : la préproduction, qui le
// sert, le tait aussi d'ici l'ouverture). `cabinet` force le drapeau.

/**
 * D'où vient la luciole, qui ne s'achète pas (`Compagnon.gagne`) : la grille,
 * sa fiche et « Tes compagnons » (`MonCompagnon.tsx`) le disent de même. Le
 * Cabinet ouvert, sa première salle complète d'abord ; l'expédition tant que
 * l'album dit sa voie — ce que `voiesMontrees` en décide pour les légendaires
 * qu'elle garde, la lecture de l'album (`lieuxDeSaVenue`, `shared/album.ts`),
 * qui ne se tire pas ici : le jour où son départ ferme, la luciole la tait avec
 * eux. Le Cabinet fermé, l'expédition seule, comme avant lui.
 */
export function venuesDeLaLuciole(cabinet: boolean): { enExpedition: boolean; dites: string; mot: string } {
  const enExpedition = !cabinet || LEGENDAIRES.some(l => voiesMontrees(l, cabinet).some(estUneVoieDExpedition))
  return {
    enExpedition,
    dites: [cabinet ? 'au Cabinet' : '', enExpedition ? 'en expédition' : ''].filter(Boolean).join(' ou '),
    // Un seul mot sous elle, ce qui l'amène d'abord : « Expédition ou Cabinet » (143 pixels pour 129) débordait de sa
    // carte en 360.
    mot: cabinet ? 'Cabinet' : 'Expédition',
  }
}

const enConfettis = (n: number) => `🎊 ${formatNumber(n)}`

/** Ce que ses missions d'un jour rapportent au plus : la piste qu'on montre à qui n'a pas encore de quoi. */
const CONFETTIS_DES_MISSIONS = MISSIONS_PAR_JOUR * CONFETTIS_D_UNE_MISSION + CONFETTIS_DES_TROIS

/** « la place du loup », « de la tortue-île » : son nom après « de », l'article contracté. */
const deLui = (c: Compagnon) => `${c.le === 'la' ? 'de la' : 'du'} ${c.nom.replace(/^L[ae] /, '').toLowerCase()}`

export function GalerieDesCompagnons({
  siens,
  niche,
  solde,
  busy,
  ouverteSur,
  onAdopter,
  onInstaller,
  onNommer,
  onFermer,
  cabinet = CABINET_EN_PRODUCTION,
}: {
  /** Ses compagnons et où chacun en est (`GET /api/joueur/niche`). */
  siens: readonly CompagnonAcquis[]
  /** Celui qui vit dans sa niche. */
  niche: string | null
  solde: number
  busy: boolean
  /** Ouverte sur la fiche d'un compagnon, touché dans « Tes compagnons ». */
  ouverteSur: CleDeCompagnon | null
  /** Adopte — et l'installe dans sa niche, ou pas : rend le motif d'un refus, ou null. */
  onAdopter: (cle: string, installer: boolean) => Promise<string | null>
  onInstaller: (cle: string) => void
  /** Lui donner un nom, à peine adopté : rend le motif d'un refus, ou null. */
  onNommer: (cle: string, nom: string) => Promise<string | null>
  onFermer: () => void
  /** Le Cabinet ouvert : d'office le drapeau du code, forcé pour la lire telle qu'elle sera à l'ouverture. */
  cabinet?: boolean
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onFermer)
  const [fiche, setFiche] = useState<CleDeCompagnon | null>(ouverteSur)
  const [vue, setVue] = useState(0)
  const [erreur, setErreur] = useState('')
  const [bienvenue, setBienvenue] = useState<{ c: Compagnon; installe: boolean } | null>(null)
  const [brouillon, setBrouillon] = useState('')
  const ordre = [...COMPAGNONS.filter(c => siens.some(a => a.compagnon === c.key)), ...COMPAGNONS.filter(c => !siens.some(a => a.compagnon === c.key))]
  const c = fiche ? COMPAGNONS.find(x => x.key === fiche) ?? null : null

  const ouvrir = (cle: CleDeCompagnon) => {
    const sien = siens.find(a => a.compagnon === cle)
    setFiche(cle)
    setVue(sien ? Math.min(sien.rang, 3) : 0)
    setErreur('')
    setBienvenue(null)
  }
  const adopter = async (lui: Compagnon) => {
    if (busy) return
    setErreur('')
    const il = lui.le === 'la' ? 'Elle' : 'Il'
    const prix = `${il} coûte ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis : il t’en restera ${formatNumber(solde - PRIX_D_UN_COMPAGNON)}.`
    const resteLa = niche && niche !== lui.key ? COMPAGNONS.find(x => x.key === niche) : undefined
    let installe = true
    if (!resteLa) {
      const oui = await confirmDialog({
        title: lui.nom,
        message: `${prix} ${il} s’installera dans ta niche, en haut de chaque page, et grandira avec tes bonnes réponses.`,
        confirmLabel: `L’adopter · ${enConfettis(PRIX_D_UN_COMPAGNON)}`,
        cancelLabel: 'Plus tard',
      })
      if (!oui) return
    } else {
      const sonNom = siens.find(a => a.compagnon === resteLa.key)?.nom
      const choix = await choixDialog({
        title: lui.nom,
        message: `${prix} ${il} peut prendre la place ${sonNom ? `de ${sonNom}` : deLui(resteLa)} dans ta niche — c’est celui de ta niche dont tu t’occupes, et qui grandit. Tu pourras changer quand tu veux.`,
        confirmLabel: `L’adopter et l’installer · ${enConfettis(PRIX_D_UN_COMPAGNON)}`,
        alternative: { label: 'L’adopter seulement' },
        cancelLabel: 'Plus tard',
      })
      if (!choix) return
      installe = choix.geste === 'confirmer'
    }
    const refus = await onAdopter(lui.key, installe)
    if (refus) return setErreur(refus)
    setBrouillon('')
    setBienvenue({ c: lui, installe })
  }
  const garderLeNom = async (e: FormEvent) => {
    e.preventDefault()
    if (!bienvenue) return
    const nom = brouillon.trim()
    if (nom) {
      const refus = await onNommer(bienvenue.c.key, nom)
      if (refus) return setErreur(refus)
    }
    setBienvenue(null)
  }

  const possedes = ordre.filter(x => siens.some(a => a.compagnon === x.key)).length
  return (
    <div className="carte-voile" onClick={onFermer}>
      <div ref={boite} className="carte-feuille galerie-feuille" role="dialog" aria-modal="true" aria-label="Les compagnons" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <header className="carte-barre">
          {c ? (
            <button type="button" className="carte-fermer galerie-retour" onClick={() => setFiche(null)}>
              <Icon name="arrow-left" />
              Tous
            </button>
          ) : (
            <b className="feuille-titre">Les compagnons</b>
          )}
          {/* À côté de « Les compagnons », il le faisait passer sur deux lignes en 360 : sur la grille, il descend sous le titre. */}
          {c && (
            <span className="galerie-solde" aria-label={`${formatNumber(solde)} confettis`}>
              {enConfettis(solde)}
            </span>
          )}
          <button type="button" className="carte-fermer" onClick={onFermer}>
            <Icon name="x" />
            Fermer
          </button>
        </header>
        <div className="carte-corps">
          {/* À peine adopté, il est accueilli en tête de la feuille : sous sa fiche, il fallait la faire défiler pour le voir. */}
          {bienvenue ? (
            <form className="galerie-bienvenue" onSubmit={garderLeNom}>
              <span className="galerie-grande-scene" style={{ '--a': teintesDuCompagnon(bienvenue.c.key).fond[0], '--b': teintesDuCompagnon(bienvenue.c.key).fond[1], '--c': teintesDuCompagnon(bienvenue.c.key).fond[2] } as CSSProperties} aria-hidden="true">
                <DessinDuCompagnon cle={bienvenue.c.formes[0].key} grand />
              </span>
              <b className="galerie-bienvenue-titre">{`Bienvenue, ${bienvenue.c.formes[0].nom.charAt(0).toLowerCase()}${bienvenue.c.formes[0].nom.slice(1)} !`}</b>
              <p className="muted small">
                {espacesFines(
                  bienvenue.installe
                    ? `${bienvenue.c.le === 'la' ? 'Elle' : 'Il'} s’installe dans ta niche, en haut de chaque page.`
                    : `${bienvenue.c.le === 'la' ? 'Elle' : 'Il'} attend son tour : touche-${bienvenue.c.le} dans « Tes compagnons » pour l’installer.`,
                )}
              </p>
              <label className="label" htmlFor="galerie-nom">
                Lui donner un nom
              </label>
              <div className="niche-nommer-ligne">
                <input
                  id="galerie-nom"
                  className="input"
                  type="text"
                  value={brouillon}
                  maxLength={NOM_D_UN_COMPAGNON_MAX}
                  placeholder={PROPOSITIONS[bienvenue.c.key]}
                  autoComplete="off"
                  enterKeyHint="done"
                  onChange={e => setBrouillon(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {brouillon.trim() ? 'Garder' : 'Plus tard'}
                </button>
              </div>
            </form>
          ) : !c ? (
            <>
              <p className="galerie-sous">
                <span className="muted small">{`${possedes} chez toi · ${COMPAGNONS.length - possedes} à rencontrer`}</span>
                <span className="galerie-solde" aria-label={`${formatNumber(solde)} confettis`}>
                  {enConfettis(solde)}
                </span>
              </p>
              <div className="galerie-grille">
                {ordre.map(lui => {
                  const sien = siens.find(a => a.compagnon === lui.key)
                  const forme = lui.formes[sien ? Math.min(sien.rang, 3) : 0]
                  const { fond } = teintesDuCompagnon(lui.key)
                  // Des noms à elle : `.niche`, la niche du coin, et `.expedition`, sa page, sont pris. `en-expedition`
                  // reste celui d'un compagnon qui se gagne, que le Cabinet l'amène ou l'expédition : la feuille le peint.
                  const condition = sien ? (lui.key === niche ? 'dans-la-niche' : 'chez') : lui.gagne ? 'en-expedition' : 'prix'
                  return (
                    <button
                      key={lui.key}
                      type="button"
                      className="galerie-carte"
                      style={{ '--a': fond[0], '--b': fond[1], '--c': fond[2] } as CSSProperties}
                      aria-label={`${sien?.nom ?? lui.nom} : ${condition === 'dans-la-niche' ? 'dans ta niche' : condition === 'chez' ? 'chez toi' : condition === 'en-expedition' ? `se gagne ${venuesDeLaLuciole(cabinet).dites}` : `${formatNumber(PRIX_D_UN_COMPAGNON)} confettis`}`}
                      onClick={() => ouvrir(lui.key)}
                    >
                      <span className="galerie-scene" aria-hidden="true">
                        <DessinDuCompagnon cle={forme.key} />
                      </span>
                      <span className="galerie-texte">
                        <b>{sien?.nom ?? lui.nom}</b>
                        {sien?.nom && <span className="muted small">{lui.nom}</span>}
                        <span className={`galerie-condition ${condition}`}>
                          {condition === 'dans-la-niche' ? (
                            <>
                              <Icon name="home" />
                              Dans ta niche
                            </>
                          ) : condition === 'chez' ? (
                            <>
                              <Icon name="check" />
                              Chez toi
                            </>
                          ) : condition === 'en-expedition' ? (
                            // L'arche du Cabinet, celle de l'accueil, quand il l'amène.
                            <>
                              {cabinet && <Icon name="landmark" />}
                              {venuesDeLaLuciole(cabinet).mot}
                            </>
                          ) : (
                            enConfettis(PRIX_D_UN_COMPAGNON)
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="muted small">Touche un compagnon pour voir ses formes et comment l’avoir.</p>
            </>
          ) : (
            <FicheDuCompagnon
              c={c}
              sien={siens.find(a => a.compagnon === c.key)}
              dansLaNiche={c.key === niche}
              solde={solde}
              busy={busy}
              vue={vue}
              onVoir={setVue}
              onAdopter={() => void adopter(c)}
              onInstaller={() => onInstaller(c.key)}
              cabinet={cabinet}
            />
          )}
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** Sa fiche : lui en grand, ses formes — la métamorphose de l'Éclat au bout —, comment l'avoir ou où il en est, et ce qu'on peut faire. */
function FicheDuCompagnon({
  c,
  sien,
  dansLaNiche,
  solde,
  busy,
  vue,
  onVoir,
  onAdopter,
  onInstaller,
  cabinet,
}: {
  c: Compagnon
  sien: CompagnonAcquis | undefined
  dansLaNiche: boolean
  solde: number
  busy: boolean
  vue: number
  onVoir: (rang: number) => void
  onAdopter: () => void
  onInstaller: () => void
  cabinet: boolean
}) {
  const { fond } = teintesDuCompagnon(c.key)
  const formes = [...c.formes, ...(c.lumiere ? [c.lumiere] : [])]
  const forme = formes[Math.min(vue, formes.length - 1)]
  const ouverte = !!sien && metamorphoseOuverte(sien)
  const Il = c.le === 'la' ? 'Elle' : 'Il'
  const suite = sien ? prochaineForme(sien) : null
  const manque = PRIX_D_UN_COMPAGNON - solde
  return (
    <div className="galerie-fiche">
      <div className="galerie-grande-scene" style={{ '--a': fond[0], '--b': fond[1], '--c': fond[2] } as CSSProperties} aria-hidden="true">
        <DessinDuCompagnon cle={forme.key} grand verrouille={!!forme.metamorphose && !ouverte} />
      </div>
      <span className="galerie-forme-nom" style={gemme(forme.metamorphose ? 'legendaire' : forme.rarete)}>
        <i aria-hidden="true" />
        {forme.metamorphose ? `${forme.nom} · métamorphose` : `${forme.nom} · ${NOM_RARETE[forme.rarete].toLowerCase()}`}
      </span>
      <ol className="galerie-formes" aria-label={`Ses formes`}>
        {formes.map((f, i) => {
          const atteinte = !!sien && (f.metamorphose ? ouverte : sien.rang >= f.rang)
          // Sous sa première forme, ce qui l'amène : le mot de sa pastille dans la grille.
          const seuil = f.metamorphose ? 'Éclat' : i === 0 ? (c.gagne ? venuesDeLaLuciole(cabinet).mot : 'Adoption') : formatNumber(JUSTES_DES_FORMES[f.rang])
          // Son nom dit la forme et où elle est, jamais si on la regarde : `aria-pressed` le dit (`design.test.ts`).
          const nomLu = `${f.nom}${atteinte ? ', à toi' : f.metamorphose ? ', sa métamorphose, que l’Éclat ouvre à sa forme ultime' : i === 0 ? '' : `, à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses`}`
          return (
            <li key={f.key}>
              <button
                type="button"
                className={'galerie-forme' + (atteinte ? ' atteinte' : '')}
                style={gemme(f.metamorphose ? 'legendaire' : f.rarete)}
                aria-pressed={vue === i}
                aria-label={nomLu}
                onClick={() => onVoir(i)}
              >
                <span className="galerie-forme-dessin" aria-hidden="true">
                  <DessinDuCompagnon cle={f.key} verrouille={!!f.metamorphose && !ouverte} />
                </span>
                <span className="galerie-forme-seuil" aria-hidden="true">
                  {seuil}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <h2 className="galerie-fiche-nom">{sien?.nom ? `${sien.nom}, ${c.nom.charAt(0).toLowerCase()}${c.nom.slice(1)}` : c.nom}</h2>
      <p className="muted">{espacesFines(c.phrase)}</p>
      <h3 className="label">{sien ? (c.le === 'la' ? 'Où elle en est' : 'Où il en est') : 'Comment l’avoir'}</h3>
      <ul className="galerie-etapes">
        {sien ? (
          <li className="faite">
            <span className="galerie-etape-icone" aria-hidden="true">
              <Icon name={dansLaNiche ? 'home' : 'check'} />
            </span>
            <span>
              <b>{dansLaNiche ? 'Dans ta niche' : 'Chez toi'}</b>
              <span className="muted small">
                {suite ? `${c.formes[sien.rang].nom} · ${formatNumber(sien.justes)} sur ${formatNumber(JUSTES_DES_FORMES[suite.forme.rang])} bonnes réponses` : c.formes[sien.rang].nom}
              </span>
            </span>
          </li>
        ) : c.gagne && cabinet ? (
          <>
            <li>
              <span className="galerie-etape-icone" aria-hidden="true">
                <Icon name="landmark" />
              </span>
              <span>
                <b>Complète une salle du Cabinet</b>
                <span className="muted small">{espacesFines(`Ta première salle complète : ${c.le === 'la' ? 'elle' : 'il'} te rejoint. ${Il} ne s’achète pas.`)}</span>
              </span>
            </li>
            {/* Tant que l'album dit la voie de l'Expédition, elle se dit aussi, sans chemin : celui du Cabinet passe devant. */}
            {venuesDeLaLuciole(cabinet).enExpedition && (
              <li>
                <span className="galerie-etape-icone bleu" aria-hidden="true">
                  <Icon name="globe" />
                </span>
                <span>
                  <b>Ou mène une expédition au bout</b>
                  <span className="muted small">{espacesFines(`Les trois gardiens vaincus, ${c.le === 'la' ? 'elle' : 'il'} te rejoint aussi.`)}</span>
                </span>
              </li>
            )}
          </>
        ) : c.gagne ? (
          <li>
            <span className="galerie-etape-icone bleu" aria-hidden="true">
              <Icon name="globe" />
            </span>
            <span>
              <b>Mène une expédition au bout</b>
              <span className="muted small">{espacesFines(`Les trois gardiens vaincus, ${c.le === 'la' ? 'elle' : 'il'} te rejoint. ${Il} ne s’achète pas.`)}</span>
            </span>
          </li>
        ) : (
          <li>
            <span className="galerie-etape-icone" aria-hidden="true">
              <Icon name="sparkles" />
            </span>
            <span>
              <b>{`L’adopter : ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis`}</b>
              <span className="muted small">{manque > 0 ? `Tu en as ${formatNumber(solde)} : encore ${formatNumber(manque)}` : `Tu en as ${formatNumber(solde)}`}</span>
            </span>
          </li>
        )}
        <li>
          <span className="galerie-etape-icone rose" aria-hidden="true">
            <Icon name="leaf" />
          </span>
          <span>
            <b>{`${Il} grandit avec tes bonnes réponses`}</b>
            <span className="muted small">100, 300 puis 500 — en soirée, au quiz du jour, en campagne</span>
          </span>
        </li>
        {c.lumiere && (
          <li>
            <span className="galerie-etape-icone vert" aria-hidden="true">
              <Icon name="star" />
            </span>
            <span>
              <b>L’Éclat ouvre sa métamorphose</b>
              <span className="muted small">{`À sa forme ultime : ${c.lumiere.nom.charAt(0).toLowerCase()}${c.lumiere.nom.slice(1)}`}</span>
            </span>
          </li>
        )}
      </ul>
      {sien ? (
        dansLaNiche ? (
          <p className="galerie-ici">
            <Icon name="home" />
            {`${sien.nom ?? c.nom} vit dans ta niche`}
          </p>
        ) : (
          <button type="button" className="btn galerie-cta" disabled={busy} onClick={onInstaller}>
            <Icon name="home" />
            L’installer dans ma niche
          </button>
        )
      ) : c.gagne ? (
        <a className="btn galerie-cta" href={cabinet ? '/cabinet' : '/expedition'}>
          {cabinet ? 'Aller au Cabinet' : 'Partir en expédition'}
        </a>
      ) : manque > 0 ? (
        <div className="galerie-manque">
          <span className="jauge-fine" aria-hidden="true">
            <span style={{ width: `${Math.round(Math.min(1, Math.max(0, solde) / PRIX_D_UN_COMPAGNON) * 100)}%` }} />
          </span>
          <span className="muted small">{espacesFines(`Encore ${formatNumber(manque)} confettis : tes missions du jour en rapportent jusqu’à ${CONFETTIS_DES_MISSIONS}.`)}</span>
        </div>
      ) : (
        <button type="button" className="btn btn-primary galerie-cta" disabled={busy} onClick={onAdopter}>
          {`L’adopter · ${enConfettis(PRIX_D_UN_COMPAGNON)}`}
        </button>
      )}
    </div>
  )
}
