import { useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { Onglets } from './Onglets'
import { Trouvaille } from './Trouvaille'
import { Jardin, useEchelle } from './Jardin'
import { NICHE, dansLaCour } from './jardin'
import { DESSINS } from './compagnons-peints'
import { Arche, SaNicheSEmbellit, SesFormes } from './Niche'
import { useModale } from '../modale'
import { espacesFines, formatNumber } from '../format'
import { gemme } from '../gemmes'
import { NOM_RARETE, type Rarete } from '../../../shared/badges'
import { formeDansLaNiche, type Compagnon, type CompagnonPossede } from '../../../shared/compagnons'
import { ornementsMontres, type CleDOrnement, type StyleDOrnement } from '../../../shared/ornements'
import type { SoinsDuCompagnon } from '../../../shared/soins'
import {
  EXPLOITS_DU_JARDIN,
  RARETES_DES_TROUVAILLES,
  TERRAINS,
  TROUVAILLES,
  niveauDuTerrain,
  placesOuvertes,
  trouvailleDe,
  vaDans,
} from '../../../shared/trouvailles'
import type { NicheVue } from '../niche'

// « Décorer » (la maquette validée le 20 octobre 2026) : son jardin et sa
// niche, en deux onglets. Le jardin d'abord — la scène, chaque place qui se
// touche, le terrain qui vient dans la brume —, puis son terrain, de trois à
// dix places, et ses trouvailles rangées par rareté : celles qu'il a en
// couleur, ses doubles comptés, celles qui manquent en silhouette, qui disent
// où les trouver. Toucher une place libre puis une trouvaille l'y pose ;
// toucher une trouvaille posée la range. L'onglet « Sa niche » garde la forme
// qu'elle montre et ses ornements — ils ne se règlent que là.

/** Où se trouve chaque rareté : ce qu'une trouvaille qui manque dit quand on la touche. */
const OU_LA_TROUVER: Readonly<Record<Rarete, string>> = {
  commune: 'dans son cadeau du jour, souvent',
  peucommune: 'dans son cadeau du jour, parfois',
  rare: 'dans son cadeau du jour, rarement — plus souvent dans le grand cadeau',
  epique: 'seulement dans le grand cadeau, tous les sept jours de complicité',
  legendaire: 'un exploit',
}

/** Les noms au pluriel des raretés : l'en-tête de leur filtre, pour le lecteur d'écran. */
const RARETES_AU_PLURIEL: Readonly<Record<Rarete, string>> = {
  commune: 'Communes',
  peucommune: 'Peu communes',
  rare: 'Rares',
  epique: 'Épiques',
  legendaire: 'Légendaires',
}

type Onglet = 'jardin' | 'niche'

export function Decorer({
  c,
  niche,
  nom,
  soins,
  trouvailles,
  placeInitiale,
  infoInitiale,
  neuves,
  busy,
  onAmenager,
  onMontrer,
  onOrner,
  onFermer,
}: {
  c: Compagnon
  niche: NicheVue
  nom: string
  soins: SoinsDuCompagnon
  /** Ses trouvailles, comptées : à lui, pour tous ses compagnons. */
  trouvailles: Readonly<Record<string, number>>
  /** La place touchée sur sa page : l'éditeur s'ouvre sur elle. */
  placeInitiale: string | null
  infoInitiale: string | null
  neuves: readonly string[]
  busy: boolean
  /** Son jardin aménagé, en entier : rend le motif d'un refus, ou null. */
  onAmenager: (jardin: Record<string, string>) => Promise<string | null>
  onMontrer: (montree: number) => void
  onOrner: (cle: CleDOrnement, style: StyleDOrnement) => void
  onFermer: () => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onFermer)
  const [onglet, setOnglet] = useState<Onglet>('jardin')
  const [place, setPlace] = useState<string | null>(placeInitiale)
  const [info, setInfo] = useState<string | null>(infoInitiale)
  const [filtre, setFiltre] = useState<'toutes' | Rarete>('toutes')
  const [pose, setPose] = useState<string | null>(null)
  const [cadre, k] = useEchelle<HTMLDivElement>()
  const complicite = soins.complicite
  const niveau = niveauDuTerrain(complicite)
  const ici = TERRAINS[niveau]
  const suivant = TERRAINS[niveau + 1] ?? null
  const ouvertes = placesOuvertes(niveau)
  const jardin = soins.jardin
  const occupees = ouvertes.filter(p => jardin[p]).length
  const forme = formeDansLaNiche(niche as CompagnonPossede)
  const dessin = forme && DESSINS[forme.key]
  const decor = dessin?.disque?.[1]

  const amenager = async (nouveau: Record<string, string>, apres: () => void) => {
    const refus = await onAmenager(nouveau)
    if (refus) setInfo(refus)
    else apres()
  }
  const toucherPlace = (p: string) => {
    if (busy) return
    const cle = jardin[p]
    if (cle) {
      const t = trouvailleDe(cle)
      const sans = { ...jardin }
      delete sans[p]
      void amenager(sans, () => {
        setPlace(p)
        setInfo(`${t?.nom ?? 'Elle'} retourne dans ses trouvailles.`)
      })
      return
    }
    const deja = place === p
    setPlace(deja ? null : p)
    setInfo(deja ? null : 'Choisis une trouvaille pour cette place.')
  }
  const toucherTrouvaille = (cle: string) => {
    if (busy) return
    const t = trouvailleDe(cle)
    if (!t) return
    const n = trouvailles[cle] ?? 0
    if (n === 0) {
      setInfo(t.exploit ? `${t.nom} · légendaire : ${EXPLOITS_DU_JARDIN[t.exploit].texte}.` : `${NOM_RARETE[t.rarete]} · à trouver ${OU_LA_TROUVER[t.rarete]}.`)
      return
    }
    const posees = ouvertes.filter(p => jardin[p] === cle)
    // Toutes ses copies posées : la toucher en range une.
    if (posees.length >= n) {
      const sans = { ...jardin }
      delete sans[posees[posees.length - 1]]
      void amenager(sans, () => {
        setPlace(posees[posees.length - 1])
        setInfo(`${t.nom} retourne dans ses trouvailles.`)
      })
      return
    }
    const visee = place && !jardin[place] && vaDans(t, place) ? place : ouvertes.find(q => !jardin[q] && vaDans(t, q))
    if (!visee) {
      const ou = t.sorte === 'ciel' ? 'dans son ciel' : t.sorte === 'haut' ? 'pour un grand objet' : 'au sol'
      setInfo(
        suivant
          ? `Plus de place ${ou} : range un objet, ou attends ${suivant.nom.charAt(0).toLowerCase()}${suivant.nom.slice(1)} (${suivant.jours} jours).`
          : `Plus de place ${ou} : range un objet.`,
      )
      return
    }
    void amenager({ ...jardin, [visee]: cle }, () => {
      setPose(visee)
      setPlace(null)
      setInfo(`${t.nom} trouve sa place.`)
    })
  }

  const trouvees = TROUVAILLES.filter(t => (trouvailles[t.cle] ?? 0) > 0).length
  const montrees = TROUVAILLES.filter(t => filtre === 'toutes' || t.rarete === filtre)
  const part = suivant ? Math.min(1, Math.max(0, (complicite - ici.jours) / (suivant.jours - ici.jours))) : 1
  return (
    <div className="carte-voile" onClick={onFermer}>
      <div ref={boite} className="carte-feuille decorer-feuille" role="dialog" aria-modal="true" aria-labelledby="decorer-titre" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <header className="carte-barre">
          <b id="decorer-titre" className="feuille-titre">
            Décorer
          </b>
          <button type="button" className="carte-fermer" onClick={onFermer}>
            <Icon name="x" />
            Fermer
          </button>
        </header>
        <div className="carte-corps">
          <p className="muted small decorer-sous">{`${ici.nom} · ${occupees} sur ${ici.places} places`}</p>
          <Onglets
            className="onglets-fins"
            label="Décorer"
            onglets={[
              { id: 'jardin', nom: 'Son jardin' },
              { id: 'niche', nom: 'Sa niche' },
            ]}
            actif={onglet}
            onChoisir={setOnglet}
            idOnglet={id => `decorer-onglet-${id}`}
            idPanneau={id => `decorer-panneau-${id}`}
          />
          {onglet === 'jardin' ? (
            <div id="decorer-panneau-jardin" role="tabpanel" aria-labelledby="decorer-onglet-jardin" className="decorer-panneau">
              <div ref={cadre} className="decorer-cadre" style={{ height: Math.round(242 * k) }}>
                <span className={'chez-fond' + (decor ? '' : ` niche-ciel niche-ciel-${c.key}`)} style={decor ? { backgroundImage: `url(${decor})` } : undefined} aria-hidden="true" />
                <span className="chez-ombre" aria-hidden="true" />
                <Jardin
                  k={k}
                  hauteur={242}
                  niveau={niveau}
                  dessine={Math.min(TERRAINS.length - 1, niveau + 1)}
                  jardin={jardin}
                  nom={nom}
                  places="toutes"
                  choisie={place}
                  nouvelle={pose}
                  vise={place && !dansLaCour(place) ? place : null}
                  onPlace={toucherPlace}
                  cour={
                    forme &&
                    dessin && (
                      <span
                        className={`chez-niche-fixe niche-${c.key}`}
                        style={{ '--l': `${NICHE.l * k}px`, left: NICHE.gauche * k, top: NICHE.haut * k } as CSSProperties}
                        aria-hidden="true"
                      >
                        <Arche forme={forme} dessin={dessin} ornements={ornementsMontres(niche)} grand />
                      </span>
                    )
                  }
                />
              </div>
              <p className="decorer-info" aria-live="polite">
                {espacesFines(info ?? 'Touche une place, puis une trouvaille. Touche un objet du jardin pour le ranger.')}
              </p>

              <section className="decorer-section" aria-labelledby="decorer-terrain">
                <div className="decorer-section-tete">
                  <h3 id="decorer-terrain" className="label">
                    Son terrain
                  </h3>
                  <span className="muted small">{`${complicite} jour${complicite > 1 ? 's' : ''} de complicité`}</span>
                </div>
                <ol className="decorer-terrains">
                  {TERRAINS.map((t, i) => (
                    <li key={t.nom} className={'decorer-terrain' + (i < niveau ? ' passe' : i === niveau ? ' ici' : ' ferme')} aria-current={i === niveau ? 'step' : undefined}>
                      <span className="decorer-terrain-rond" aria-hidden="true">
                        <Icon name={i < niveau ? 'check' : i === niveau ? 'home' : 'lock'} />
                      </span>
                      <b>{t.nom}</b>
                      <span className="muted small">{i <= niveau ? `${t.places} places` : `${t.jours} jours`}</span>
                    </li>
                  ))}
                </ol>
                <span className="jauge-fine decorer-jauge" aria-hidden="true">
                  <span style={{ width: `${Math.round(part * 100)}%` }} />
                </span>
                <p className="muted small decorer-terrain-texte">
                  {espacesFines(
                    suivant
                      ? `Encore ${suivant.jours - complicite} jour${suivant.jours - complicite > 1 ? 's' : ''} de complicité : ${suivant.nom.charAt(0).toLowerCase()}${suivant.nom.slice(1)}, ${suivant.places} places.`
                      : `Tout son domaine est à ${c.le === 'la' ? 'elle' : 'lui'}.`,
                  )}
                </p>
              </section>

              <section className="decorer-section" aria-labelledby="decorer-trouvailles">
                <div className="decorer-section-tete">
                  <h3 id="decorer-trouvailles" className="label">
                    Ses trouvailles
                  </h3>
                  <span className="muted small">{`${trouvees} sur ${TROUVAILLES.length}`}</span>
                </div>
                <div className="decorer-filtres" role="group" aria-label="Ses trouvailles, par rareté">
                  <button type="button" className="decorer-filtre" aria-pressed={filtre === 'toutes'} onClick={() => setFiltre('toutes')} style={gemme('offert')}>
                    <i aria-hidden="true" />
                    {`Toutes ${trouvees}/${TROUVAILLES.length}`}
                  </button>
                  {RARETES_DES_TROUVAILLES.map(r => {
                    const de = TROUVAILLES.filter(t => t.rarete === r)
                    const a = de.filter(t => (trouvailles[t.cle] ?? 0) > 0).length
                    return (
                      <button key={r} type="button" className="decorer-filtre" aria-pressed={filtre === r} aria-label={`${RARETES_AU_PLURIEL[r]} : ${a} sur ${de.length}`} onClick={() => setFiltre(r)} style={gemme(r)}>
                        <i aria-hidden="true" />
                        {`${a}/${de.length}`}
                      </button>
                    )
                  })}
                </div>
                <div className="decorer-grille">
                  {montrees.map(t => {
                    const n = trouvailles[t.cle] ?? 0
                    const posees = ouvertes.filter(p => jardin[p] === t.cle).length
                    return (
                      <button
                        key={t.cle}
                        type="button"
                        className={'decorer-case' + (n === 0 ? ' manque' : '') + (posees > 0 ? ' posee' : '')}
                        style={gemme(t.rarete)}
                        aria-label={n === 0 ? `${NOM_RARETE[t.rarete]}, à trouver` : `${t.nom}, ${NOM_RARETE[t.rarete].toLowerCase()}${n > 1 ? `, ${n} exemplaires` : ''}${posees > 0 ? `, ${posees} dans son jardin` : ''}`}
                        // Jamais désactivée le temps d'écrire : la case touchée perdrait le focus (`toucherTrouvaille` attend, elle).
                        onClick={() => toucherTrouvaille(t.cle)}
                      >
                        <Trouvaille cle={t.cle} icone silhouette={n === 0} nom={t.cle === 'panneau' ? nom : undefined} />
                        {n > 1 && <span className="decorer-double">{`×${n}`}</span>}
                        {posees > 0 && (
                          <span className="decorer-posee" aria-hidden="true">
                            <Icon name="check" />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <ul className="decorer-legende">
                  <li style={gemme('commune')}>
                    <i aria-hidden="true" />
                    <span>
                      <b>Cadeau du jour</b> — ses trois envies comblées : surtout des communes, parfois mieux.
                    </span>
                  </li>
                  <li style={gemme('epique')}>
                    <i aria-hidden="true" />
                    <span>
                      <b>Grand cadeau</b> — tous les sept jours de complicité : une rare ou une épique.
                    </span>
                  </li>
                  <li style={gemme('legendaire')}>
                    <i aria-hidden="true" />
                    <span>
                      <b>Légendaires</b> — chacune son exploit, jamais le hasard.
                    </span>
                  </li>
                </ul>
                <p className="muted small">{espacesFines(`Tes trouvailles sont à toi, pour tous tes compagnons ; chacun a son jardin. Elles ne se voient que chez ${c.le === 'la' ? 'elle' : 'lui'}, et ne donnent aucun avantage.`)}</p>
              </section>
            </div>
          ) : (
            <div id="decorer-panneau-niche" role="tabpanel" aria-labelledby="decorer-onglet-niche" className="decorer-panneau">
              <section className="decorer-section" aria-labelledby="decorer-formes">
                <h3 id="decorer-formes" className="label">
                  Sa forme dans sa niche
                </h3>
                <SesFormes niche={niche} busy={busy} neuves={neuves} onMontrer={onMontrer} />
              </section>
              <SaNicheSEmbellit niche={niche} c={c} busy={busy} onOrner={onOrner} />
              <p className="muted small">{espacesFines(`Ses formes et ses ornements se gagnent avec tes bonnes réponses, en soirée, au quiz du jour et en campagne : ${formatNumber(100)}, ${formatNumber(300)} puis ${formatNumber(500)}, puis sa niche s’embellit.`)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
