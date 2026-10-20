import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent, type ReactNode } from 'react'
import { Icon } from './Icon'
import { PieceTete } from './Pieces'
import { Compagnon as DessinDuCompagnon, teintesDuCompagnon } from './Compagnon'
import { DESSINS } from './compagnons-peints'
import { Arche, ENVOLS, IconeDeLEnvie, PROPOSITIONS, PetitPaquet, gesteDeLaCaresse, sansArticle, sansMouvement, type Geste } from './Niche'
import { ApercuDOrnement } from './Ornements'
import { Jardin, useEchelle } from './Jardin'
import { NICHE } from './jardin'
import { Decorer } from './Decorer'
import { GalerieDesCompagnons } from './GalerieDesCompagnons'
import { Cueillette, DessinDeFriandise, FRIANDISES } from './Cueillette'
import { CadeauDuCompagnon } from './CadeauDuCompagnon'
import { useModale } from '../modale'
import { api } from '../api'
import { espacesFines, formatNumber } from '../format'
import { gemme } from '../gemmes'
import { nicheTouchee, porterNiche, retenirLeReveil, reveilleAujourdhui, type NicheVue } from '../niche'
import { NOM_RARETE } from '../../../shared/badges'
import {
  COMPAGNONS,
  JUSTES_DES_FORMES,
  MONTREE_DE_LA_METAMORPHOSE,
  NOM_D_UN_COMPAGNON_MAX,
  PRIX_D_UN_COMPAGNON,
  compagnon as leCompagnon,
  formeDansLaNiche,
  metamorphoseOuverte,
  type CleDeCompagnon,
  type Compagnon,
  type CompagnonAcquis,
  type CompagnonPossede,
  type FormeDeCompagnon,
} from '../../../shared/compagnons'
import { ORNEMENTS, ornementsMontres, styleDeLOrnement, type CleDOrnement, type StyleDOrnement } from '../../../shared/ornements'
import { ENVIES, NOM_DE_L_ENVIE, prochainCadeauGrand, prochainGrandCadeau, toursAppris, type CadeauOuvert, type Envie, type SoinsDuProfil } from '../../../shared/soins'
import { TERRAINS, TROUVAILLES, niveauDuTerrain, placeLibre, trouvailleDe } from '../../../shared/trouvailles'
import type { PublicProfile, PublicProfileDetail } from '../../../shared/profil'

// « Mon compagnon », chez lui (la maquette validée par le propriétaire le 20
// octobre 2026, `retours/2026-10-20/mon-compagnon/` : « trop de texte et pas
// assez visuel » ; « un endroit où c'est stylisé, intuitif et visuel » ; « un
// mini jeu de s'occuper de son compagnon […] qu'à la fin on puisse avoir des
// choses supplémentaires »). Sa niche en grand au milieu de son jardin : on
// le caresse en le touchant, son nom se touche sur sa plaque, « Décorer »
// ouvre son jardin et sa niche. Dessous, ses trois envies du jour et le
// cadeau qu'elles ouvrent, son chemin — ses formes, sa métamorphose, les
// ornements de sa niche, sur un seul fil —, et ses compagnons. Rien ne s'y
// gagne en confettis ni en expérience, rien n'y donne d'avantage (invariant
// 8) ; il ne boude jamais. Sur cette page, la niche du coin s'efface : il est
// là, en grand (`body:has(.chez-lui)`, `styles.css`).

type Mode = 'chez' | 'dort' | 'reveil' | 'gouter' | 'calin'
type Ecran = null | 'info' | 'nom' | 'decorer' | 'galerie' | 'jeu' | 'cadeau'

function Coeur({ couleur = '#e8739a' }: { couleur?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21.5C5 16 1.5 12.4 1.5 8.2 1.5 5.1 3.9 2.8 6.9 2.8c2.1 0 3.9 1.1 5.1 2.9 1.2-1.8 3-2.9 5.1-2.9 3 0 5.4 2.3 5.4 5.4 0 4.2-3.5 7.8-10.5 13.3Z" fill={couleur} />
    </svg>
  )
}

function Lune() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15.5 4.5a8 8 0 1 0 4 12.8 6.5 6.5 0 0 1-4-12.8z" fill="#e9c97f" />
    </svg>
  )
}

/** Une étape de son chemin : une forme, sa métamorphose, un ornement de sa niche. */
interface Etape {
  cle: string
  forme?: FormeDeCompagnon
  ornement?: CleDOrnement
  atteinte: boolean
  ici: boolean
  verrou: boolean
  nom: string
  aria: string
}

export function MonCompagnon({
  niche,
  profil,
  occupee,
  onAdopter,
  onInstaller,
}: {
  niche: NicheVue | null
  profil: PublicProfileDetail
  /** La page enregistre déjà quelque chose. */
  occupee: boolean
  /** Adopte — et l'installe dans sa niche, ou pas : rend le motif d'un refus, ou null. */
  onAdopter: (cle: string, installer: boolean) => Promise<string | null>
  /** Installe dans sa niche un compagnon qu'il a déjà : vrai s'il a pris. */
  onInstaller: (cle: string) => Promise<boolean>
}) {
  const [soins, setSoins] = useState<SoinsDuProfil | null | undefined>(undefined)
  const [siens, setSiens] = useState<CompagnonAcquis[] | null | undefined>(undefined)
  const [neuves, setNeuves] = useState<readonly string[]>([])
  const [mode, setMode] = useState<Mode>('chez')
  const [apercu, setApercu] = useState<string | null>(null)
  const [ecran, setEcran] = useState<Ecran>(null)
  const [galerieSur, setGalerieSur] = useState<CleDeCompagnon | null>(null)
  const [decorerSur, setDecorerSur] = useState<{ place: string | null; info: string | null }>({ place: null, info: null })
  const [ravi, setRavi] = useState(false)
  const [geste, setGeste] = useState<Geste | null>(null)
  const [coeurs, setCoeurs] = useState(0)
  const [bulle, setBulle] = useState<string | null>(null)
  const [calin, setCalin] = useState(0)
  const [vole, setVole] = useState(false)
  const [pose, setPose] = useState<string | null>(null)
  const [toast, setToast] = useState<{ id: number; texte: string } | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState('')
  const [astuce, setAstuce] = useState(true)
  const [brouillon, setBrouillon] = useState('')
  const [calme] = useState(sansMouvement)
  const minuteurs = useRef<number[]>([])
  const doigt = useRef<{ x: number; y: number } | null>(null)
  const frotte = useRef(0)
  const [scene, k] = useEchelle<HTMLElement>()

  const plusTard = (f: () => void, ms: number) => {
    minuteurs.current.push(window.setTimeout(f, ms))
  }
  useEffect(() => () => minuteurs.current.forEach(t => clearTimeout(t)), [])
  const dire = (texte: string) => {
    const id = Date.now()
    setToast({ id, texte })
    plusTard(() => setToast(t => (t?.id === id ? null : t)), 3800)
  }

  // Ses soins et ses compagnons, lus à l'ouverture — et relus quand il en adopte un.
  const combien = profil.compagnons?.length ?? 0
  useEffect(() => {
    // Trouvée : « Touche-moi ! » ne se propose plus, d'ici comme de sa fiche.
    nicheTouchee()
    let vivant = true
    api.joueur.soins().then(
      s => vivant && setSoins(s),
      () => vivant && setSoins(s => s ?? null),
    )
    api.joueur.niche().then(
      r => {
        if (!vivant) return
        setSiens(r.compagnons ?? (r.niche ? [r.niche] : []))
        setNeuves(r.neuves ?? [])
      },
      () => vivant && setSiens(s => s ?? null),
    )
    return () => {
      vivant = false
    }
  }, [combien])

  const cle = niche?.compagnon
  const c = cle ? leCompagnon(cle) : null
  const sesSoins = soins?.compagnons.find(s => s.compagnon === cle) ?? null
  // Le premier passage du jour, il dort, volets fermés : jamais s'il a déjà fait quelque chose aujourd'hui, ici ou ailleurs.
  useEffect(() => {
    if (!soins || !cle) return
    const s = soins.compagnons.find(x => x.compagnon === cle)
    const rien = !s || (!s.envies.gouter && !s.envies.calin && !s.envies.jeu && !s.cadeau)
    setMode(m => (m === 'chez' && rien && !reveilleAujourdhui(soins.jour, cle) ? 'dort' : m === 'dort' && !rien ? 'chez' : m))
  }, [soins?.jour, cle]) // eslint-disable-line react-hooks/exhaustive-deps

  // Un réglage rend le profil : la niche le prend, et « Tes compagnons » aussi — un nom donné dans la galerie n'y paraissait pas.
  const prendreLeProfil = (profile: PublicProfile) => {
    porterNiche(profile)
    setSiens(l => (l ? l.map(a => ({ ...(profile.compagnons?.find(b => b.compagnon === a.compagnon) ?? a), justes: a.justes })) : l))
  }
  // La page entière passe à lui, et la page le dit au lecteur d'écran (`annonceDuChoix`) : pas de bandeau de plus.
  const installer = async (autre: CleDeCompagnon) => {
    if (autre === cle) return
    if (await onInstaller(autre)) {
      setApercu(null)
      setMode('chez')
    }
  }
  // La galerie, à la même place dans chaque rendu — le second enfant de la racine : une première adoption fait passer
  // la page de « sans compagnon » à chez lui, et rendue ailleurs, la galerie se démontait avec son accueil et son nom à donner.
  const galerie = ecran === 'galerie' && (
    <GalerieDesCompagnons
      siens={siens ?? []}
      niche={cle ?? null}
      solde={profil.boutique?.confettis.solde ?? 0}
      busy={occupe || occupee}
      ouverteSur={galerieSur}
      onAdopter={onAdopter}
      onInstaller={autre => {
        setEcran(null)
        void installer(autre as CleDeCompagnon)
      }}
      onNommer={async (autre, n) => {
        try {
          const { profile } = await api.joueur.reglerCompagnon(autre, { nom: n })
          prendreLeProfil(profile)
          return null
        } catch (e) {
          return (e as Error).message
        }
      }}
      onFermer={() => setEcran(null)}
    />
  )

  // Le profil lu a un compagnon que la page n'a pas encore posé dans sa niche (`porterNiche`, à l'effet suivant) :
  // rien, plutôt que « Pas encore de compagnon » le temps d'une image, sur un téléphone qui n'en retenait aucune.
  if (!niche && profil.niche && profil.compagnons?.some(a => a.compagnon === profil.niche)) return <>{null}{galerie}</>
  if (!niche || !c || !cle) {
    const sansCompagnon = (
      <>
        <PieceTete piece="Mon profil" titre="Mon compagnon" />
        <div className="profil-sans-compagnon">
          <p className="muted">{espacesFines('Pas encore de compagnon : il vivra dans sa niche, en haut de chaque page, et grandira avec tes bonnes réponses.')}</p>
          {/* Les quatre, dessinés : chacun ouvre sa fiche, ses formes et comment l'avoir. */}
          <div className="chez-quatre">
            {COMPAGNONS.map(lui => {
              const { fond } = teintesDuCompagnon(lui.key)
              return (
                <button
                  key={lui.key}
                  type="button"
                  className="chez-quatre-un"
                  aria-label={`${lui.nom} : comment l’avoir`}
                  onClick={() => {
                    setGalerieSur(lui.key)
                    setEcran('galerie')
                  }}
                >
                  <span className="chez-quatre-dessin" style={{ '--a': fond[0], '--b': fond[1], '--c': fond[2] } as CSSProperties} aria-hidden="true">
                    <DessinDuCompagnon cle={lui.formes[0].key} />
                  </span>
                  <span className="chez-quatre-nom">{sansArticle(lui.nom)}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setGalerieSur(null)
              setEcran('galerie')
            }}
          >
            Voir les compagnons
          </button>
        </div>
      </>
    )
    return (
      <>
        {sansCompagnon}
        {galerie}
      </>
    )
  }

  // Sans nom, « ton loup », « ta tortue-île » : « Loup a un cadeau pour toi » se lisait comme un prénom.
  const nom = niche.nom ?? `${c.le === 'la' ? 'ta' : 'ton'} ${sansArticle(c.nom).toLowerCase()}`
  const Nom = nom.charAt(0).toUpperCase() + nom.slice(1)
  const Il = c.le === 'la' ? 'Elle' : 'Il'
  const la = c.le === 'la' ? 'la' : 'le'
  const sien = siens?.find(a => a.compagnon === cle)
  const justes = sien?.justes ?? 0
  const complicite = sesSoins?.complicite ?? 0
  const niveau = niveauDuTerrain(complicite)
  const jardin = sesSoins?.jardin ?? {}
  const envies = sesSoins?.envies ?? { gouter: false, calin: false, jeu: false }
  const toutes = ENVIES.every(e => envies[e])
  const dort = mode === 'dort' || mode === 'reveil'
  const friandise = FRIANDISES[c.key]
  const formeIci = formeDansLaNiche(niche as CompagnonPossede)
  if (!formeIci) return null
  const paliers = niche.rang === 3 ? (niche.paliers ?? 0) : 0

  // Ce que la niche montre : la sienne, ou l'étape de son chemin qu'on regarde.
  let formeVue: FormeDeCompagnon = formeIci
  let ornesVus = ornementsMontres(niche)
  let sous = ''
  let peutMontrer = false
  if (apercu?.startsWith('f')) {
    const r = Number(apercu.slice(1))
    formeVue = c.formes[r]
    ornesVus = r === 3 ? ornesVus : []
    sous = r <= niche.rang ? 'Déjà atteinte' : `À ${formatNumber(JUSTES_DES_FORMES[r])} · encore ${formatNumber(Math.max(0, JUSTES_DES_FORMES[r] - justes))}`
    peutMontrer = r <= niche.rang && formeVue.key !== formeIci.key
  } else if (apercu === 'm' && c.lumiere) {
    formeVue = c.lumiere
    ornesVus = []
    const ouverte = metamorphoseOuverte(niche as CompagnonPossede)
    sous = ouverte ? 'Ouverte par l’Éclat' : 'L’Éclat, à sa forme ultime'
    peutMontrer = ouverte && formeIci.key !== c.lumiere.key
  } else if (apercu?.startsWith('o')) {
    const n = Number(apercu.slice(1))
    formeVue = c.formes[3]
    ornesVus = ornementsMontres({ ...niche, rang: 3, paliers: n } as CompagnonPossede)
    sous = n <= paliers ? 'Déjà sur sa niche' : `À ${formatNumber(ORNEMENTS[n - 1].justes)} bonnes réponses`
  }
  const dessinVu = DESSINS[formeVue.key]
  const decor = dessinVu?.disque?.[1]
  const humeurs = dessinVu?.humeurs ? (['ravi'] as const) : ([] as const)

  // ── Ce qu'un toucher fait ──
  const caresser = () => {
    const n = (geste?.n ?? 0) + 1
    setGeste(calme ? null : { sorte: gesteDeLaCaresse(complicite, n), n })
    setRavi(true)
    setCoeurs(x => x + 1)
    setAstuce(false)
    setBulle(null)
    plusTard(() => setRavi(false), 1500)
  }
  const reveiller = () => {
    if (!soins) return
    retenirLeReveil(soins.jour, cle)
    setMode('reveil')
    setBulle('Bonjour !')
    plusTard(() => {
      setMode('chez')
      setRavi(true)
      setGeste(g => (calme ? null : { sorte: 'saute', n: (g?.n ?? 0) + 1 }))
    }, 800)
    plusTard(() => {
      setRavi(false)
      setBulle(null)
    }, 2600)
  }
  const revenir = () => setApercu(null)
  const toucherNiche = () => {
    if (mode === 'dort') return reveiller()
    if (mode === 'reveil') return
    if (mode === 'calin') return calinerDe(0.16)
    if (apercu) return revenir()
    caresser()
  }
  const combler = async (envie: 'gouter' | 'calin') => {
    try {
      setSoins(await api.joueur.combler(cle, envie))
    } catch (e) {
      setErreur((e as Error).message)
    }
  }
  const faireEnvie = (e: Envie) => {
    if (envies[e] || dort) return
    setApercu(null)
    setAstuce(false)
    setBulle(null)
    setErreur('')
    if (e === 'gouter') setMode('gouter')
    if (e === 'calin') {
      frotte.current = 0
      setCalin(0)
      setMode('calin')
    }
    if (e === 'jeu') setEcran('jeu')
  }
  const donnerGouter = () => {
    if (vole) return
    setVole(true)
    plusTard(() => {
      setRavi(true)
      setGeste(g => (calme ? null : { sorte: 'saute', n: (g?.n ?? 0) + 1 }))
      setBulle('Miam !')
    }, 640)
    plusTard(() => {
      setMode('chez')
      setVole(false)
      setRavi(false)
      setBulle(null)
      void combler('gouter')
    }, 1900)
  }
  const calinerDe = (n: number) => {
    if (mode !== 'calin' || calin >= 1) return
    const apres = Math.min(1, calin + n)
    if (Math.floor(apres * 4) > Math.floor(calin * 4)) setCoeurs(x => x + 1)
    setCalin(apres)
    setRavi(true)
    if (apres >= 1) {
      setBulle('Ronron…')
      setGeste(g => (calme ? null : { sorte: 'saute', n: (g?.n ?? 0) + 1 }))
      plusTard(() => {
        setMode('chez')
        setRavi(false)
        setBulle(null)
        setCalin(0)
        void combler('calin')
      }, 1700)
    }
  }
  // Le câlin se fait du doigt, en le caressant : chaque trait sur sa niche remplit la jauge.
  const poserDoigt = (e: PointerEvent) => {
    doigt.current = { x: e.clientX, y: e.clientY }
  }
  const glisserDoigt = (e: PointerEvent) => {
    if (mode !== 'calin') return
    const appuye = e.buttons > 0 || e.pointerType === 'touch' || e.pointerType === 'pen'
    if (!appuye || !doigt.current) {
      doigt.current = { x: e.clientX, y: e.clientY }
      return
    }
    frotte.current += Math.hypot(e.clientX - doigt.current.x, e.clientY - doigt.current.y)
    doigt.current = { x: e.clientX, y: e.clientY }
    if (frotte.current > 30) {
      frotte.current = 0
      calinerDe(0.06)
    }
  }

  /** Un geste qui écrit : occupé le temps de l'aller-retour, le refus dit sur la page. */
  const faire = async <T,>(geste: () => Promise<T>): Promise<T | null> => {
    if (occupe) return null
    setOccupe(true)
    setErreur('')
    try {
      return await geste()
    } catch (e) {
      setErreur((e as Error).message)
      return null
    } finally {
      setOccupe(false)
    }
  }
  const garderLeProfil = (r: { profile: PublicProfile } | null) => {
    if (r) prendreLeProfil(r.profile)
  }
  const montrer = async () => {
    const montree = apercu === 'm' ? MONTREE_DE_LA_METAMORPHOSE : Number(apercu?.slice(1))
    const r = await faire(() => api.joueur.reglerCompagnon(cle, { montree: montree === niche.rang ? null : montree }))
    garderLeProfil(r)
    if (r) {
      setApercu(null)
      dire(`${formeVue.nom} : c’est ${formeVue.nom.startsWith('La ') || formeVue.nom.startsWith('L’île') ? 'elle' : 'lui'} que sa niche montre.`)
      if (montree === MONTREE_DE_LA_METAMORPHOSE) setNeuves(n => n.filter(x => x !== c.lumiere?.key))
    }
  }
  const garderLeNom = async (e: FormEvent) => {
    e.preventDefault()
    const r = await faire(() => api.joueur.reglerCompagnon(cle, { nom: brouillon }))
    garderLeProfil(r)
    if (r) setEcran(null)
  }
  const amenager = async (j: Record<string, string>): Promise<string | null> => {
    if (occupe) return null
    setOccupe(true)
    try {
      setSoins(await api.joueur.amenager(cle, j))
      return null
    } catch (e) {
      return (e as Error).message
    } finally {
      setOccupe(false)
    }
  }
  const poser = async (o: CadeauOuvert) => {
    const t = trouvailleDe(o.objet)
    const lui = o.soins.compagnons.find(s => s.compagnon === cle)
    const ici = lui?.jardin ?? {}
    const p = placeLibre(ici, niveauDuTerrain(o.complicite), o.objet)
    setEcran(null)
    if (!t) return
    if (!p) {
      setDecorerSur({ place: null, info: `Plus de place pour ${t.nom.charAt(0).toLowerCase()}${t.nom.slice(1)} : range un objet pour lui en faire.` })
      setEcran('decorer')
      return
    }
    const refus = await amenager({ ...ici, [p]: o.objet })
    if (refus) return setErreur(refus)
    setPose(p)
    const terrain = o.terrain !== null ? TERRAINS[o.terrain] : null
    dire(
      terrain
        ? `Son jardin s’agrandit : ${terrain.nom.charAt(0).toLowerCase()}${terrain.nom.slice(1)}${o.terrain === 2 ? ', à droite' : o.terrain === 3 ? ', à gauche' : ''}.`
        : `${t.nom} trouve sa place dans son jardin.`,
    )
  }
  // ── Son chemin : ses formes, sa métamorphose, les ornements de sa niche ──
  const ici = niche.rang < 3 ? `f${niche.rang}` : paliers > 0 ? `o${paliers}` : 'f3'
  const etapes: Etape[] = [
    ...c.formes.map((f, i) => ({
      cle: `f${i}`,
      forme: f,
      atteinte: niche.rang >= i,
      ici: ici === `f${i}`,
      verrou: false,
      nom: niche.rang >= i ? sansArticle(f.nom) : formatNumber(JUSTES_DES_FORMES[i]),
      aria: niche.rang >= i ? `${f.nom}${ici === `f${i}` ? ', sa forme du moment' : ', atteinte'}` : `${f.nom}, à ${JUSTES_DES_FORMES[i]} bonnes réponses`,
    })),
    ...(c.lumiere
      ? [
          {
            cle: 'm',
            forme: c.lumiere,
            atteinte: metamorphoseOuverte(niche as CompagnonPossede),
            ici: false,
            verrou: !metamorphoseOuverte(niche as CompagnonPossede),
            nom: 'Éclat',
            aria: `${c.lumiere.nom}, sa métamorphose : l’Éclat l’ouvre à sa forme ultime`,
          },
        ]
      : []),
    ...ORNEMENTS.map((o, i) => ({
      cle: `o${i + 1}`,
      ornement: o.key,
      atteinte: paliers > i,
      ici: ici === `o${i + 1}`,
      verrou: false,
      nom: paliers > i ? o.titre : formatNumber(o.justes),
      aria: `${o.nom.charAt(0).toUpperCase()}${o.nom.slice(1)}, pour sa niche, ${paliers > i ? 'gagnée' : `à ${o.justes} bonnes réponses`}`,
    })),
  ]
  const indexIci = etapes.findIndex(e => e.ici)
  const prochain = niche.rang < 3 ? JUSTES_DES_FORMES[niche.rang + 1] : (ORNEMENTS[paliers]?.justes ?? null)
  const depuis = niche.rang < 3 ? JUSTES_DES_FORMES[niche.rang] : paliers > 0 ? ORNEMENTS[paliers - 1].justes : JUSTES_DES_FORMES[3]
  const part = prochain ? Math.max(0, Math.min(1, (justes - depuis) / (prochain - depuis))) : 0
  // De l'étape d'ici vers la suivante : l'or du fil, jusqu'où ses bonnes réponses l'ont mené.
  const vers = niche.rang < 3 ? indexIci + 1 : paliers > 0 ? indexIci + 1 : etapes.findIndex(e => e.cle === 'o1')
  const PAS = 66
  const milieu = (i: number) => 6 + PAS / 2 + PAS * i
  const xOr = prochain && vers > 0 ? milieu(indexIci) + part * (milieu(vers) - milieu(indexIci)) : milieu(indexIci)

  const ouvrirLaPlace = (p: string) => {
    setDecorerSur({ place: p, info: 'Choisis une trouvaille pour cette place.' })
    setEcran('decorer')
  }
  const cadeauDuJour = toutes && !sesSoins?.cadeau
  const grand = prochainCadeauGrand(complicite)
  const trouvees = soins ? Object.keys(soins.trouvailles).length : 0

  let gestes: ReactNode
  if (apercu) {
    gestes = (
      <>
        <button type="button" className="chez-pastille" onClick={revenir}>
          <Icon name="arrow-left" />
          Revenir
        </button>
        {peutMontrer && (
          <button type="button" className="chez-pastille or" disabled={occupe} onClick={() => void montrer()}>
            <Icon name="home" />
            La montrer dans sa niche
          </button>
        )}
      </>
    )
  } else if (dort) {
    gestes = (
      <span className="chez-indice">
        <Lune />
        {`${Il} dort encore · touche sa niche`}
      </span>
    )
  } else if (mode === 'gouter') {
    gestes = (
      <button type="button" className="chez-pastille or" disabled={vole} onClick={donnerGouter}>
        <IconeDeLEnvie envie="gouter" />
        {`Donne-lui ${friandise.un}`}
      </button>
    )
  } else if (mode === 'calin') {
    gestes = (
      <span className="chez-jauge-calin" role="progressbar" aria-label="Le câlin" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(calin * 100)}>
        <span className="chez-jauge-calin-plein" style={{ width: `${Math.round(calin * 100)}%` }} />
        <Coeur couleur="#f49ab8" />
        <span>{calin >= 1 ? `${Il} ronronne !` : `Caresse-${la} du doigt`}</span>
      </span>
    )
  } else {
    gestes = (
      <button type="button" className="chez-pastille" onClick={() => setEcran('decorer')}>
        <Icon name="sparkles" />
        Décorer
      </button>
    )
  }

  const bulleMontree = bulle ?? (astuce && mode === 'chez' && !apercu && soins !== undefined ? 'Caresse-moi !' : null)
  const page = (
    <div className="chez-lui">
      <PieceTete piece="Mon profil" titre="Mon compagnon">
        <button type="button" className="chez-info" aria-label="Comment ça marche" onClick={() => setEcran('info')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5" />
            <path d="M12 7.5v.4" />
          </svg>
        </button>
      </PieceTete>

      <section ref={scene} className="chez-scene" style={{ height: Math.round(280 * k), '--k': k } as CSSProperties} aria-label={`${Nom}, chez ${c.le === 'la' ? 'elle' : 'lui'}`}>
        <span className={'chez-fond' + (decor ? '' : ` niche-ciel niche-ciel-${c.key}`)} style={decor ? { backgroundImage: `url(${decor})` } : undefined} aria-hidden="true" />
        <span className="chez-ombre" aria-hidden="true" />
        <span className="chez-etoiles" aria-hidden="true">
          <i style={{ left: '9%', top: '11%' }} />
          <i style={{ left: '23%', top: '31%', animationDelay: '1.1s' }} />
          <i style={{ left: '83%', top: '13%', animationDelay: '.5s' }} />
          <i style={{ left: '71%', top: '36%', animationDelay: '2s' }} />
          <i style={{ left: '93%', top: '42%', animationDelay: '1.6s' }} />
          <i style={{ left: '4%', top: '46%', animationDelay: '2.6s' }} />
        </span>
        <Jardin
          k={k}
          hauteur={280}
          niveau={niveau}
          jardin={jardin}
          nom={niche.nom}
          places={apercu || dort || soins === undefined ? 'aucune' : 'libres'}
          nouvelle={pose}
          onPlace={ouvrirLaPlace}
          cour={
            <>
              <button
                type="button"
                className={`chez-niche niche-${c.key}` + (ravi ? ' ravi' : '') + (apercu ? ' apercu' : '') + (mode === 'calin' ? ' calin' : '')}
                style={{ '--l': `${NICHE.l * k}px`, left: NICHE.gauche * k, top: NICHE.haut * k } as CSSProperties}
                aria-label={mode === 'dort' ? `Réveiller ${nom}` : apercu ? 'Revenir' : `Caresser ${nom}`}
                onClick={toucherNiche}
                onPointerDown={poserDoigt}
                onPointerMove={glisserDoigt}
              >
                {dessinVu && (
                  <Arche
                    forme={formeVue}
                    dessin={dessinVu}
                    humeur={ravi && !apercu ? 'ravi' : 'neutre'}
                    humeurs={humeurs}
                    geste={apercu ? null : geste}
                    ornements={ornesVus}
                    grand
                    dansLeCadre={
                      dort && (
                        <span className={'chez-volets' + (mode === 'reveil' ? ' ouverts' : '')} aria-hidden="true">
                          <span className="chez-volet g" />
                          <span className="chez-volet d">
                            <Lune />
                          </span>
                        </span>
                      )
                    }
                  />
                )}
              </button>
              <button
                type="button"
                className={'chez-plaque' + (niche.nom ? '' : ' sans-nom')}
                style={{ left: NICHE.milieu * k, top: (NICHE.haut + (NICHE.l * 62) / 54 + 6) * k }}
                aria-label={niche.nom ? `${niche.nom} : ${la} renommer` : 'Lui donner un nom'}
                onClick={() => {
                  setBrouillon(niche.nom ?? '')
                  setEcran('nom')
                }}
              >
                <b>{niche.nom ?? 'Lui donner un nom'}</b>
                <Icon name="edit" />
              </button>
              {coeurs > 0 && !calme && (
                <span key={`coeurs-${coeurs}`} className="chez-coeurs" style={{ left: NICHE.milieu * k, top: 96 * k }} aria-hidden="true">
                  {ENVOLS.map((e, i) => (
                    <i key={i}>{e}</i>
                  ))}
                </span>
              )}
              {mode === 'dort' && (
                <span className="chez-zzz" style={{ left: (NICHE.gauche + 104) * k, top: 34 * k }} aria-hidden="true">
                  <i>z</i>
                  <i>z</i>
                  <i>Z</i>
                </span>
              )}
              {bulleMontree && (
                <span className="chez-bulle" style={{ left: Math.max(6, (NICHE.gauche - 118) * k), top: 60 * k }} aria-hidden="true">
                  {bulleMontree}
                </span>
              )}
              {mode === 'calin' && calin < 0.2 && (
                <span className="chez-main" style={{ left: (NICHE.milieu - 17) * k, top: 100 * k }} aria-hidden="true">
                  <IconeDeLEnvie envie="calin" />
                </span>
              )}
              {vole && (
                <span className="chez-vol" style={{ left: (NICHE.milieu - 22) * k, top: 236 * k }} aria-hidden="true">
                  <DessinDeFriandise cle={c.key} />
                </span>
              )}
            </>
          }
        />
        <span className="chez-gemme" style={gemme(formeVue.metamorphose ? 'legendaire' : formeVue.rarete)}>
          <i aria-hidden="true" />
          <span>
            <b>{apercu?.startsWith('o') ? ORNEMENTS[Number(apercu.slice(1)) - 1].nom.replace(/^./, x => x.toUpperCase()) : formeVue.nom.replace(/^(L[ae] |L’)/, x => x).replace(/^./, x => x.toUpperCase())}</b>
            {sous && <small>{sous}</small>}
          </span>
          <span className="sr-only">{formeVue.metamorphose ? ', métamorphose' : `, ${NOM_RARETE[formeVue.rarete].toLowerCase()}`}</span>
        </span>
        <div className="chez-gestes">{gestes}</div>
      </section>

      <section className="card chez-carte" aria-labelledby="chez-envies">
        <div className="chez-carte-tete">
          <h2 id="chez-envies">Ses envies du jour</h2>
          <span className="chez-complicite">
            <Coeur />
            {`${complicite} jour${complicite > 1 ? 's' : ''} de complicité`}
          </span>
        </div>
        {soins === undefined ? (
          <p className="muted small">…</p>
        ) : soins === null ? (
          <p className="muted small">{espacesFines('Ses envies ne se lisent pas : vérifie ta connexion, puis reviens.')}</p>
        ) : dort ? (
          <p className="chez-ligne endormi">
            <span className="chez-pastilles" aria-hidden="true">
              {ENVIES.map(e => (
                <i key={e}>
                  <IconeDeLEnvie envie={e} />
                </i>
              ))}
            </span>
            <span>{espacesFines('Ses trois envies t’attendent à son réveil.')}</span>
          </p>
        ) : !toutes ? (
          <div className="chez-envies">
            {ENVIES.map(e => (
              <button
                key={e}
                type="button"
                className={'chez-envie' + (envies[e] ? ' faite' : '') + ((e === 'gouter' && mode === 'gouter') || (e === 'calin' && mode === 'calin') ? ' active' : '')}
                aria-label={envies[e] ? `${NOM_DE_L_ENVIE[e]} : fait` : NOM_DE_L_ENVIE[e]}
                disabled={envies[e]}
                onClick={() => faireEnvie(e)}
              >
                <span className="chez-envie-rond">
                  <IconeDeLEnvie envie={e} />
                  {envies[e] && (
                    <span className="chez-envie-coche" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                  )}
                </span>
                <span className="chez-envie-nom">{NOM_DE_L_ENVIE[e]}</span>
              </button>
            ))}
          </div>
        ) : cadeauDuJour ? (
          <button type="button" className="chez-cadeau-ligne" onClick={() => setEcran('cadeau')}>
            <span className="chez-cadeau-icone" aria-hidden="true">
              <PetitPaquet />
            </span>
            <span className="chez-cadeau-texte">
              <b>{grand ? `${Nom} a un grand cadeau pour toi` : `${Nom} a un cadeau pour toi`}</b>
              <span>{grand ? 'Sept jours de complicité de plus : une rare ou une épique' : `Ses trois envies sont comblées · grand cadeau à ${prochainGrandCadeau(complicite)} jours`}</span>
            </span>
            <Icon name="chevron-right" />
          </button>
        ) : (
          <p className="chez-ligne">
            <span className="chez-pastilles faites" aria-hidden="true">
              {ENVIES.map(e => (
                <i key={e}>
                  <Icon name="check" />
                </i>
              ))}
            </span>
            <span>{espacesFines(niche.nom ? `Trois envies comblées. À demain, ${niche.nom} !` : 'Trois envies comblées. À demain !')}</span>
          </p>
        )}
      </section>

      <section className="card chez-carte" aria-labelledby="chez-chemin">
        <div className="chez-carte-tete">
          <h2 id="chez-chemin">Son chemin</h2>
          <span className="chez-compte">
            <Icon name="sparkles" />
            {sien ? (prochain ? `${formatNumber(justes)} / ${formatNumber(prochain)}` : formatNumber(justes)) : '…'}
          </span>
        </div>
        <div
          className="chez-chemin"
          ref={el => {
            // Cadré une fois sur l'étape d'ici : ce qui reste à gagner est à droite.
            if (el && el.dataset.cadre !== ici) {
              el.scrollLeft = Math.max(0, milieu(indexIci) - (el.clientWidth || 320) / 2)
              el.dataset.cadre = ici
            }
          }}
        >
          <div className="chez-piste" style={{ width: PAS * etapes.length + 12 }}>
            <span className="chez-piste-trait" style={{ left: milieu(0), width: milieu(etapes.length - 1) - milieu(0) }} />
            <span className="chez-piste-or" style={{ left: milieu(0), width: Math.max(0, xOr - milieu(0)) }} />
            {etapes.map(e => (
              <button
                key={e.cle}
                type="button"
                className={'chez-etape' + (e.ici ? ' ici' : '') + (e.atteinte ? ' atteinte' : ' avenir')}
                aria-label={e.aria}
                aria-pressed={apercu === e.cle}
                disabled={dort}
                onClick={() => setApercu(apercu === e.cle || (e.ici && !apercu) ? null : e.cle)}
              >
                <span className="chez-etape-visuel">
                  {e.forme ? (
                    <span className={`niche-mini niche-${c.key}` + (e.verrou ? ' chez-verrou' : '')} style={{ '--l': '38px' } as CSSProperties}>
                      {DESSINS[e.forme.key] && <Arche forme={e.forme} dessin={DESSINS[e.forme.key]} />}
                    </span>
                  ) : (
                    e.ornement && <ApercuDOrnement cle={e.ornement} style={styleDeLOrnement(niche.ornements, e.ornement) as StyleDOrnement} taille={26} />
                  )}
                  {e.atteinte && !e.ici && !e.forme?.metamorphose && (
                    <span className="chez-badge" aria-hidden="true">
                      <Icon name="check" />
                    </span>
                  )}
                  {e.forme?.metamorphose && (
                    <span className="chez-badge eclat" aria-hidden="true">
                      <Icon name="sparkles" />
                    </span>
                  )}
                </span>
                <span className="chez-etape-nom">{e.nom}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card chez-carte" aria-labelledby="chez-amis">
        <div className="chez-carte-tete">
          <h2 id="chez-amis">Tes compagnons</h2>
          <button
            type="button"
            className="link-inline chez-lien"
            onClick={() => {
              setGalerieSur(null)
              setEcran('galerie')
            }}
          >
            Tous les voir
            <Icon name="chevron-right" />
          </button>
        </div>
        {/* Le profil en attendant sa lecture : les siens ne passent pas un instant pour des compagnons à adopter. */}
        <TesCompagnons
          siens={siens ?? profil.compagnons ?? []}
          niche={niche}
          busy={occupe || occupee}
          onInstaller={autre => void installer(autre)}
          onVoir={autre => {
            setGalerieSur(autre)
            setEcran('galerie')
          }}
        />
      </section>

      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      {toast && (
        <p key={toast.id} className="chez-toast" role="status">
          {espacesFines(toast.texte)}
        </p>
      )}

      {ecran === 'info' && (
        <Feuille titre="Comment ça marche" onFermer={() => setEcran(null)}>
          <CommentCaMarche c={c} complicite={complicite} trouvees={trouvees} />
        </Feuille>
      )}

      {ecran === 'nom' && (
        <Feuille titre="Son nom" onFermer={() => setEcran(null)}>
          <form className="niche-nommer" onSubmit={garderLeNom}>
            <label className="label" htmlFor="chez-nom">
              Sur sa plaque, et sur ta carte
            </label>
            <div className="niche-nommer-ligne">
              <input
                id="chez-nom"
                className="input"
                type="text"
                value={brouillon}
                maxLength={NOM_D_UN_COMPAGNON_MAX}
                placeholder={PROPOSITIONS[c.key]}
                autoComplete="off"
                enterKeyHint="done"
                onChange={e => setBrouillon(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={occupe}>
                Garder
              </button>
            </div>
            {erreur && (
              <p className="error" role="alert">
                {erreur}
              </p>
            )}
          </form>
        </Feuille>
      )}

      {ecran === 'decorer' && sesSoins && soins && (
        <Decorer
          c={c}
          niche={niche}
          nom={niche.nom ?? ''}
          soins={sesSoins}
          trouvailles={soins.trouvailles}
          placeInitiale={decorerSur.place}
          infoInitiale={decorerSur.info}
          neuves={neuves}
          busy={occupe}
          onAmenager={amenager}
          onMontrer={montree => void faire(() => api.joueur.reglerCompagnon(cle, { montree: montree === niche.rang ? null : montree })).then(garderLeProfil)}
          onOrner={(o, style) => void faire(() => api.joueur.reglerCompagnon(cle, { ornements: { [o]: style } })).then(garderLeProfil)}
          onFermer={() => {
            setDecorerSur({ place: null, info: null })
            setEcran(null)
          }}
        />
      )}

      {ecran === 'jeu' && (
        <Cueillette
          c={c}
          forme={formeIci}
          nom={Nom}
          record={sesSoins?.record ?? 0}
          onEcrire={async score => {
            const e = await api.joueur.cueillir(cle, score)
            setSoins(e.soins)
            return e
          }}
          onQuitter={() => setEcran(null)}
          onRamener={e => {
            setEcran(null)
            if (e?.envie) {
              setRavi(true)
              setGeste(g => (calme ? null : { sorte: 'saute', n: (g?.n ?? 0) + 1 }))
              plusTard(() => setRavi(false), 1500)
            }
          }}
        />
      )}

      {ecran === 'cadeau' && (
        <CadeauDuCompagnon
          c={c}
          nom={Nom}
          panneau={niche.nom ?? null}
          grand={grand}
          complicite={complicite}
          trouvees={trouvees}
          onOuvrir={async () => {
            const o = await api.joueur.ouvrirLeCadeau(cle)
            setSoins(o.soins)
            return o
          }}
          onPoser={o => void poser(o)}
          onFermer={o => {
            setEcran(null)
            if (o) dire('Rangée dans ses trouvailles : « Décorer » pour la poser.')
          }}
        />
      )}
    </div>
  )
  return (
    <>
      {page}
      {galerie}
    </>
  )
}

/**
 * « Tes compagnons », sur sa page : les siens d'abord, chacun sous la forme
 * qu'il montre — celui de la niche pressé, les autres à installer d'un
 * toucher : c'est celui de la niche qui grandit —, puis ceux qu'il n'a pas,
 * leur prix ou l'expédition, qui ouvrent leur fiche dans la galerie, où l'on
 * adopte sur place. Un nom fixe : celui de la niche se dit par
 * `aria-pressed`, jamais par son libellé (`design.test.ts`).
 */
export function TesCompagnons({
  siens,
  niche,
  busy,
  onInstaller,
  onVoir,
}: {
  siens: readonly CompagnonPossede[]
  niche: NicheVue
  busy: boolean
  onInstaller: (cle: CleDeCompagnon) => void
  onVoir: (cle: CleDeCompagnon) => void
}) {
  const amis = [...COMPAGNONS.filter(x => siens.some(a => a.compagnon === x.key)), ...COMPAGNONS.filter(x => !siens.some(a => a.compagnon === x.key))]
  return (
    <div className="chez-amis" role="group" aria-label="Tes compagnons : touche l’un des tiens pour l’installer dans ta niche">
      {amis.map(lui => {
        const a = siens.find(x => x.compagnon === lui.key)
        const f = a ? formeDansLaNiche(a) : lui.formes[0]
        const dessin = f && DESSINS[f.key]
        const lA = lui.key === niche.compagnon
        const nomLu = a ? (a.nom ?? lui.nom) : lui.gagne ? `${lui.nom} : se gagne en expédition` : `${lui.nom} : ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis, voir comment l’avoir`
        return (
          <button
            key={lui.key}
            type="button"
            className="chez-ami"
            aria-pressed={lA}
            aria-label={nomLu}
            disabled={busy}
            onClick={() => (a ? onInstaller(lui.key) : onVoir(lui.key))}
          >
            <span className={`niche-mini niche-${lui.key}` + (a ? '' : ' chez-verrou')} style={{ '--l': '38px' } as CSSProperties}>
              {f && dessin && <Arche forme={f} dessin={dessin} ornements={a && lA ? ornementsMontres(niche) : []} />}
            </span>
            {lA && (
              <span className="chez-ami-maison" aria-hidden="true">
                <Icon name="home" />
              </span>
            )}
            <span className="chez-ami-nom">{a?.nom ?? sansArticle(lui.nom)}</span>
            {!a && <span className={'chez-ami-cond' + (lui.gagne ? ' en-expedition' : '')}>{lui.gagne ? 'Expédition' : `🎊 ${formatNumber(PRIX_D_UN_COMPAGNON)}`}</span>}
            {a && !lA && <span className="chez-ami-cond">L’installer</span>}
          </button>
        )
      })}
    </div>
  )
}

/**
 * « Comment ça marche », au bout du titre de sa page : les règles qui
 * faisaient le mur de texte de l'écran d'avant, et où il en est de ses
 * trouvailles, de leur complicité et de ses tours.
 */
export function CommentCaMarche({ c, complicite, trouvees }: { c: Compagnon; complicite: number; trouvees: number }) {
  const tours = toursAppris(complicite).length
  return (
    <>
      <ul className="chez-regles">
        <li>
          <span className="chez-puce" aria-hidden="true">
            <Coeur />
          </span>
          <span>{espacesFines(`Chaque bonne réponse le nourrit — en soirée, au quiz du jour, en campagne. ${c.le === 'la' ? 'Elle' : 'Il'} change de forme à 100, 300 puis 500, puis sa niche s’embellit.`)}</span>
        </li>
        <li>
          <span className="chez-puce" aria-hidden="true">
            <PetitPaquet />
          </span>
          <span>{espacesFines(`Chaque jour, trois envies : un goûter, un câlin, une partie de cueillette. Comblées, ${c.le === 'la' ? 'elle' : 'il'} te rapporte une trouvaille pour son jardin — et tous les sept jours de complicité, un grand cadeau.`)}</span>
        </li>
        <li>
          <span className="chez-puce" aria-hidden="true">
            <Icon name="home" />
          </span>
          <span>{espacesFines('Son jardin s’agrandit avec votre complicité : le petit coin, la cour, le jardin, le domaine — de trois à dix places.')}</span>
        </li>
        <li>
          <span className="chez-puce" aria-hidden="true">
            <Icon name="check-circle" />
          </span>
          <span>{espacesFines(`Un jour sans venir ne ${c.le === 'la' ? 'la' : 'le'} fâche pas et ne retire rien. Ni ses formes ni ses trouvailles ne donnent d’avantage de jeu.`)}</span>
        </li>
      </ul>
      <p className="muted small">{espacesFines(`${trouvees} trouvailles sur ${TROUVAILLES.length} · ${complicite} jours de complicité · ${tours} tour${tours > 1 ? 's' : ''} appris`)}</p>
    </>
  )
}

/** Une feuille de la page, sur le modèle de celles du profil : son titre, « Fermer », son corps qui défile. */
function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onFermer)
  return (
    <div className="carte-voile" onClick={onFermer}>
      <div ref={boite} className="carte-feuille chez-feuille" role="dialog" aria-modal="true" aria-label={titre} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <header className="carte-barre">
          <b className="feuille-titre">{titre}</b>
          <button type="button" className="carte-fermer" onClick={onFermer}>
            <Icon name="x" />
            Fermer
          </button>
        </header>
        <div className="carte-corps">{children}</div>
      </div>
    </div>
  )
}
