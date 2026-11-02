import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { PublicProfileDetail } from '../../../shared/profil'
import { theme as leTheme } from '../../../shared/themes'
import { lignesDuPanier, sansLaSorte, type EssaiDeLaBoutique, type LigneDuPanier, type SorteDEssai } from '../../../shared/panier'
import type { CleDeCompagnon } from '../../../shared/compagnons'
import type { ChoixDuProfil } from './choix'
import { essayerTheme, finirLEssai } from '../themeJoueur'
import { abonnerNiche, essayerNiche, nicheActuelle } from '../niche'
import { FicheDuTheme, RayonDesObjets, RayonDesThemes, acheterUnTheme, etatDuTheme } from './Boutique'
import { FicheDuCompagnon, RayonDesCompagnons, compagnonDeLAdresse } from './RayonDesCompagnons'
import { RayonDesFonds, fondDeLAdresse } from './RayonDesFonds'
import { objetDeLAdresse, type CleDObjet } from './Objets'
import { UneDeLaBoutique } from './UneDeLaBoutique'
import { BarreDuPanier, FeuilleDuPanier } from './PanierDeLaBoutique'

// La boutique (`/boutique`), d'un seul tenant (la refonte du 1er novembre
// 2026, « la Galerie », la piste A de la maquette, avec le panier de la
// piste B — le choix du propriétaire, le même jour : « beaucoup plus
// esthétique et pratique à naviguer sur téléphone », et « pouvoir essayer
// sans acheter pour les éléments qui s'y prêtent ») : « À la une » en tête,
// puis les quatre rayons à la suite — les thèmes, une étagère par rareté ; les
// compagnons ; les fonds, sur sa propre carte ; le comptoir des objets —, et
// une rangée de puces collée en haut qui y mène. Quatre onglets cachaient
// trois rayons sur quatre, et chaque rayon avait sa mise en page.
//
// Ce qui s'y prête s'essaie avant de s'acheter : un thème habille toute la
// page (`essayerTheme`, comme dans la loge), un fond sa carte, un compagnon
// sa niche (`essayerNiche`) — un de chaque sorte, sans rien écrire. Ce qu'on
// essaie et qui s'achète s'additionne dans le panier (`shared/panier.ts`),
// qu'on prend d'un geste ou ligne à ligne ; quitter la page rend tout.

type Rayon = 'themes' | 'compagnons' | 'fonds' | 'objets'

const RAYONS: { id: Rayon; nom: string; dit: string }[] = [
  { id: 'themes', nom: 'Thèmes', dit: 'Ils habillent tes pages, de la soirée à tes quiz. Ouvre-en un pour l’essayer : toute la page le porte.' },
  { id: 'compagnons', nom: 'Compagnons', dit: 'Il vit dans ta niche, en haut de chaque page, et grandit avec tes bonnes réponses. Essaie-le d’abord : il y passe le temps de ta visite.' },
  { id: 'fonds', nom: 'Fonds', dit: 'Un décor par savoir, derrière ta carte quand quelqu’un touche ton nom. Touche-les : ta carte les essaie.' },
  { id: 'objets', nom: 'Objets', dit: 'Ce qui sert en jeu : ta série, tes sentiers, ton avatar.' },
]

/** Ce qu'une fiche ouverte montre : un thème, un compagnon ou un objet — un fond s'essaie sur sa carte, sans fiche. */
type Fiche = { sorte: 'theme'; cle: string } | { sorte: 'compagnon'; cle: CleDeCompagnon } | { sorte: 'objet'; cle: CleDObjet }

/**
 * Ce qu'ouvre une adresse de la boutique : le rayon où la page descend, la
 * fiche qui s'ouvre, le fond que sa carte essaie. Les adresses d'avant les
 * onglets mènent au même endroit — `#compagnons`, `#fonds`, `#objets` ;
 * `#theme-aurore`, `#compagnon-tortue`, `#objet-sablier`, leur fiche (le
 * bandeau « À la une » de l'accueil, l'album, la série du quiz du jour) ;
 * `#fond-jazz`, sa carte qui l'essaie (la fiche d'un fond dans « Ma
 * collection ») ; `#vies`, celle d'avant les objets, la fiche de la vie.
 */
export function ceQueLAdresseOuvre(hash: string): { rayon: Rayon | null; fiche: Fiche | null; fond?: string } {
  if (hash === '#themes') return { rayon: 'themes', fiche: null }
  const t = /^#theme-([\w-]+)$/.exec(hash)
  const leThemeDit = t ? leTheme(t[1]) : undefined
  if (leThemeDit && leThemeDit.rarete !== 'offert') return { rayon: 'themes', fiche: { sorte: 'theme', cle: leThemeDit.key } }
  if (hash === '#compagnons') return { rayon: 'compagnons', fiche: null }
  const c = compagnonDeLAdresse(hash)
  if (c) return { rayon: 'compagnons', fiche: { sorte: 'compagnon', cle: c } }
  if (hash === '#fonds') return { rayon: 'fonds', fiche: null }
  const f = fondDeLAdresse(hash)
  if (f) return { rayon: 'fonds', fiche: null, fond: f }
  if (hash === '#objets') return { rayon: 'objets', fiche: null }
  if (hash === '#vies') return { rayon: 'objets', fiche: { sorte: 'objet', cle: 'vie' } }
  const o = objetDeLAdresse(hash)
  if (o) return { rayon: 'objets', fiche: { sorte: 'objet', cle: o } }
  return { rayon: null, fiche: null }
}

const sansMouvement = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Le rayon que la page montre : le dernier dont le titre est passé sous les puces — le dernier, tout en bas. */
function rayonALEcran(): Rayon {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) return RAYONS[RAYONS.length - 1].id
  let ici: Rayon = RAYONS[0].id
  for (const r of RAYONS) {
    const el = document.getElementById(`rayon-${r.id}`)
    if (el && el.getBoundingClientRect().top <= 160) ici = r.id
  }
  return ici
}

export function PanneauBoutique({
  profil,
  busy,
  enregistrer,
  acheter,
  acheterCompagnon,
  acheterFond,
  onSolde,
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => void
  acheter: (cle: string, porter: boolean) => Promise<string | null>
  acheterCompagnon: (cle: string, installer: boolean) => Promise<string | null>
  acheterFond: (cle: string, porter: boolean) => Promise<string | null>
  /** Un objet acheté : le solde que le serveur rend. */
  onSolde: (solde: number) => void
}) {
  const [depart] = useState(() => ceQueLAdresseOuvre(typeof window === 'undefined' ? '' : window.location.hash))
  const [fiche, setFiche] = useState<Fiche | null>(depart.fiche)
  const [essai, setEssai] = useState<EssaiDeLaBoutique>(() => (depart.fond ? { fond: depart.fond } : {}))
  const [ici, setIci] = useState<Rayon>(depart.rayon ?? 'themes')
  const [erreur, setErreur] = useState('')
  const [panier, setPanier] = useState(false)
  const [pris, setPris] = useState<{ lignes: readonly LigneDuPanier[]; porter: boolean } | null>(null)
  /** Un panier en train d'être pris : un à la fois. */
  const prise = useRef(false)
  // Celui qui vit dans sa niche — l'essai n'y change rien : un compagnon pris au panier s'y installe s'il n'y a personne.
  const nicheIci = useSyncExternalStore(abonnerNiche, nicheActuelle, () => null)

  // Le thème essayé habille toute la page ; le compagnon essayé passe dans la niche. Quitter la page rend tout.
  useEffect(() => {
    if (essai.theme) void essayerTheme(essai.theme)
    else finirLEssai()
  }, [essai.theme])
  useEffect(() => essayerNiche(essai.compagnon ?? null), [essai.compagnon])
  useEffect(
    () => () => {
      finirLEssai()
      essayerNiche(null)
    },
    [],
  )

  /** Descendre jusqu'à un rayon, son titre juste sous les puces. */
  const descendre = (r: Rayon, doux = true) => {
    document.getElementById(`rayon-${r}`)?.scrollIntoView({ block: 'start', behavior: doux && !sansMouvement() ? 'smooth' : 'auto' })
  }
  // Ouverte à l'adresse d'un rayon, la page y descend ; une adresse de la boutique suivie depuis la boutique même — « Adopter »,
  // dans la fiche de la niche — ne recharge pas la page : elle la suit.
  useEffect(() => {
    if (depart.rayon && depart.rayon !== 'themes') descendre(depart.rayon, false)
    const suivre = () => {
      const lu = ceQueLAdresseOuvre(window.location.hash)
      if (lu.fiche) setFiche(lu.fiche)
      if (lu.fond) setEssai(e => ({ ...e, fond: lu.fond }))
      if (lu.rayon) {
        setIci(lu.rayon)
        descendre(lu.rayon)
      }
    }
    window.addEventListener('hashchange', suivre)
    return () => window.removeEventListener('hashchange', suivre)
  }, [])
  // La puce du rayon à l'écran s'allume au fil du défilement.
  useEffect(() => {
    let image = 0
    const suivre = () => {
      if (image) return
      image = requestAnimationFrame(() => {
        image = 0
        setIci(rayonALEcran())
      })
    }
    window.addEventListener('scroll', suivre, { passive: true })
    return () => {
      window.removeEventListener('scroll', suivre)
      cancelAnimationFrame(image)
    }
  }, [])

  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  const lignes = lignesDuPanier(essai, {
    themes: boutique.possedes,
    fonds: profil.fonds ?? [],
    compagnons: (boutique.compagnons ?? []).map(c => c.compagnon),
    jour: boutique.jour,
  })

  /** Changer de rayon n'empile rien : l'adresse suit, et le retour du téléphone quitte la boutique, comme avant. */
  const aller = (r: Rayon) => {
    history.replaceState(history.state, '', r === 'themes' ? `${window.location.pathname}${window.location.search}` : `#${r}`)
    setIci(r)
    descendre(r)
  }
  const fermer = () => {
    setFiche(null)
    setErreur('')
  }
  /** Essayer — ou, déjà à l'essai, ôter. Un thème ou un compagnon mis à l'essai referme sa fiche : on le voit sur la page. */
  const essayer = (sorte: SorteDEssai, cle: string | undefined) => {
    const deja = cle !== undefined && essai[sorte] === cle
    setEssai(e => (cle === undefined || deja ? sansLaSorte(e, sorte) : { ...e, [sorte]: cle }))
    setPris(null)
    if (!deja && cle !== undefined && sorte !== 'fond') fermer()
  }
  const voir = (sorte: SorteDEssai, cle: string) => {
    if (sorte === 'fond') {
      setEssai(e => ({ ...e, fond: cle }))
      return aller('fonds')
    }
    setFiche(sorte === 'theme' ? { sorte, cle } : { sorte: 'compagnon', cle: cle as CleDeCompagnon })
  }

  /** « L'acheter », dans sa fiche : acheté et porté, l'essai devient son thème sans repasser par l'ancien. */
  const acheterLeTheme = async (cle: string) => {
    const t = leTheme(cle)
    if (!t || busy) return
    setErreur('')
    const r = await acheterUnTheme(t, solde, acheter)
    if (!r) return
    if (r.refus) return setErreur(r.refus)
    if (essai.theme === t.key) {
      finirLEssai(r.porter)
      setEssai(e => sansLaSorte(e, 'theme'))
    }
  }

  /**
   * Le panier pris : chaque ligne cochée l'une après l'autre — le serveur
   * n'en compte qu'un à la fois —, jusqu'au premier refus, dit dans le
   * panier. Ce qui est pris quitte l'essai ; un thème porté le devient sans
   * repasser par l'ancien, un compagnon s'installe dans sa niche si on le
   * porte, ou si elle est vide.
   */
  const prendre = async (aPrendre: readonly LigneDuPanier[], porter: boolean) => {
    // Entre deux achats, la page n'est plus occupée l'espace d'un instant : un second toucher y relançait le panier, et
    // l'achat que la page refuse pendant un autre (`enregistrement`, `ProfilApp`) se serait compté pris.
    if (busy || prise.current) return
    prise.current = true
    setErreur('')
    setPris(null)
    const faits: LigneDuPanier[] = []
    let refus: string | null = null
    try {
      for (const l of aPrendre) {
        refus = l.sorte === 'theme' ? await acheter(l.cle, porter) : l.sorte === 'fond' ? await acheterFond(l.cle, porter) : await acheterCompagnon(l.cle, porter || !nicheIci)
        if (refus) {
          refus = `${l.nom} : ${refus}`
          break
        }
        faits.push(l)
        if (l.sorte === 'theme') finirLEssai(porter)
      }
    } finally {
      prise.current = false
    }
    if (faits.length > 0) {
      setEssai(e => sansLaSorte(e, ...faits.map(l => l.sorte)))
      setPris({ lignes: faits, porter })
    }
    if (refus) setErreur(refus)
  }

  const themeOuvert = fiche?.sorte === 'theme' ? leTheme(fiche.cle) : undefined
  return (
    <div className="la-boutique">
      <UneDeLaBoutique
        boutique={boutique}
        essai={essai}
        // Un fond s'essaie sur sa carte, dans son rayon : la page y descend.
        onEssayer={(sorte, cle) => (sorte === 'fond' && essai.fond !== cle ? voir(sorte, cle) : essayer(sorte, cle))}
        onVoir={voir}
      />
      <nav className="boutique-rayons" aria-label="Les rayons de la boutique">
        {RAYONS.map(r => (
          <a
            key={r.id}
            href={r.id === 'themes' ? '#themes' : `#${r.id}`}
            aria-current={ici === r.id || undefined}
            onClick={e => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
              e.preventDefault()
              aller(r.id)
            }}
          >
            {r.nom}
          </a>
        ))}
      </nav>
      {RAYONS.map(r => (
        <section key={r.id} id={`rayon-${r.id}`} className="rayon-de-la-boutique" aria-labelledby={`titre-${r.id}`}>
          <header className="rayon-tete">
            <h2 id={`titre-${r.id}`}>{r.id === 'objets' ? 'Le comptoir' : r.nom}</h2>
            <p className="muted small">{r.dit}</p>
          </header>
          {r.id === 'themes' ? (
            <RayonDesThemes profil={profil} essai={essai.theme} onOuvrir={cle => setFiche({ sorte: 'theme', cle })} />
          ) : r.id === 'compagnons' ? (
            <RayonDesCompagnons profil={profil} essai={essai.compagnon} onOuvrir={cle => setFiche({ sorte: 'compagnon', cle })} />
          ) : r.id === 'fonds' ? (
            <RayonDesFonds profil={profil} busy={busy} essai={essai.fond} onEssayer={cle => essayer('fond', cle)} acheter={acheterFond} />
          ) : (
            <RayonDesObjets
              profil={profil}
              ouvert={fiche?.sorte === 'objet' ? fiche.cle : null}
              onOuvrir={cle => setFiche({ sorte: 'objet', cle })}
              onFermer={fermer}
              onSolde={onSolde}
            />
          )}
        </section>
      ))}
      {themeOuvert && (
        <FicheDuTheme
          theme={themeOuvert}
          etat={etatDuTheme(themeOuvert, profil.theme ?? 'velours', new Set(boutique.possedes), solde, boutique.jour)}
          solde={solde}
          busy={busy}
          erreur={erreur}
          essaye={essai.theme === themeOuvert.key}
          onEssayer={() => essayer('theme', themeOuvert.key)}
          onAcheter={() => void acheterLeTheme(themeOuvert.key)}
          onFermer={fermer}
        />
      )}
      {fiche?.sorte === 'compagnon' && (
        <FicheDuCompagnon
          key={fiche.cle}
          profil={profil}
          cle={fiche.cle}
          busy={busy}
          essaye={essai.compagnon === fiche.cle}
          onEssayer={() => essayer('compagnon', fiche.cle)}
          acheter={acheterCompagnon}
          installer={cle => enregistrer({ niche: cle })}
          onAdopte={() => setEssai(e => (e.compagnon === fiche.cle ? sansLaSorte(e, 'compagnon') : e))}
          onFermer={fermer}
        />
      )}
      {lignes.length > 0 && !panier && (
        <BarreDuPanier
          lignes={lignes}
          onAnnuler={() => setEssai({})}
          onPrendre={() => {
            setErreur('')
            setPris(null)
            setPanier(true)
          }}
        />
      )}
      {panier && (
        <FeuilleDuPanier
          lignes={lignes}
          solde={solde}
          busy={busy}
          erreur={erreur}
          pris={pris}
          onPrendre={(l, porter) => void prendre(l, porter)}
          onFermer={() => {
            setPanier(false)
            setErreur('')
            setPris(null)
          }}
        />
      )}
    </div>
  )
}
