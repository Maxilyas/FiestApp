import { useEffect, useRef, useState } from 'react'
import type { PublicProfileDetail } from '../../../shared/profil'
import { theme as leTheme } from '../../../shared/themes'
import { COMPAGNONS_DE_LA_BOUTIQUE, compagnon as leCompagnon } from '../../../shared/compagnons'
import { fond as leFond } from '../../../shared/fonds'
import { QUESTIONS_PAR_JOUR } from '../../../shared/jour'
import { CONFETTIS_D_UNE_MISSION, CONFETTIS_DES_TROIS, MISSIONS_PAR_JOUR } from '../../../shared/missions'
import { ouEnEstLEnvie, type Envie } from '../../../shared/envie'
import { lignesDuPanier, sansLaSorte, type EssaiDeLaBoutique, type LigneDuPanier, type SorteDEssai } from '../../../shared/panier'
import {
  LIGNE_DES_FONDS,
  LIGNE_DU_COMPTOIR,
  RAYONS,
  RAYON_DE,
  enConfettis,
  fondsEnRayon,
  ligneDesCompagnons,
  ligneDesThemes,
  themesEnRayon,
  type Rayon,
} from '../../../shared/rayons'
import type { ChoixDuProfil } from './choix'
import { api, motifDe } from '../api'
import { espacesFines } from '../format'
import { essayerTheme, finirLEssai } from '../themeJoueur'
import { essayerNiche } from '../niche'
import { Feuille } from './Pieces'
import { JaugeFine } from './LigneDeCollection'
import { RayonDesThemes } from './Boutique'
import { RayonDesCompagnons, compagnonDeLAdresse } from './RayonDesCompagnons'
import { RayonDesFonds, fondDeLAdresse } from './RayonDesFonds'
import { RayonDesObjets, useComptoir } from './Comptoir'
import { OBJETS, objetDeLAdresse } from './Objets'
import { Presentoir } from './Presentoir'
import { BarreDuPanier, FeuilleDuPanier, VignetteDeLArticle } from './PanierDeLaBoutique'

// La boutique (`/boutique`), en grilles (la refonte du 10 novembre 2026, la
// maquette validée par le propriétaire — `retours/2026-11-10/boutique/` :
// « J'ai l'impression que les utilisateurs ont du mal et ne voient pas
// grand-chose sur leur téléphone »). Une seule page dense, ses quatre rayons à
// la suite — les thèmes, trois par rangée ; les compagnons, les cinq sur une
// rangée ; les fonds, quatre par rangée, sa carte sur chacun ; le comptoir, en
// lignes —, et la rangée des rayons collée en haut, qui y mène. Mesuré ce
// jour-là en 360 × 640 : la boutique d'avant montrait un article entier à
// l'arrivée et faisait 3587 px de haut, 6,2 écrans ; celle-ci en montre neuf,
// en 3,7 écrans. Rien n'y glisse plus de côté : une étagère cachait trois
// cartes sur cinq, et « À la une », en tête, prenait l'écran d'arrivée pour
// redire trois articles que les rayons montrent — elle reste à l'accueil, d'où
// elle amène ici.
//
// Chaque rayon dit en une ligne ce qu'on vient y chercher (« 22, dont 9 à ta
// portée »), un prix se lit à l'or quand son solde le paie, et son envie —
// l'article pour lequel il économise (`shared/envie.ts`) — se suit en tête.
// Toucher un article ouvre son présentoir (`Presentoir.tsx`), le même pour
// les quatre rayons.
//
// Ce qui s'y prête s'essaie avant de s'acheter : un thème habille toute la
// page (`essayerTheme`, comme dans la loge), un compagnon sa niche
// (`essayerNiche`) — un de chaque sorte, sans rien écrire. Ce qu'on essaie et
// qui s'achète attend dans la barre de l'essai (`shared/panier.ts`) ; quitter
// la page rend tout.

/**
 * Ce qu'ouvre une adresse de la boutique : le rayon où la page descend, et
 * l'article dont le présentoir s'ouvre. Les adresses d'avant les onglets
 * mènent au même endroit — `#compagnons`, `#fonds`, `#objets` ;
 * `#theme-aurore`, `#compagnon-tortue`, `#objet-sablier`, `#fond-jazz`, leur
 * présentoir (le bandeau « À la une » de l'accueil, l'album, la série du quiz
 * du jour, la fiche d'un fond dans « Ma collection ») ; `#vies`, celle
 * d'avant les objets, la vie.
 */
export function ceQueLAdresseOuvre(hash: string): { rayon: Rayon | null; fiche: Envie | null } {
  if (hash === '#themes') return { rayon: 'themes', fiche: null }
  const t = /^#theme-([\w-]+)$/.exec(hash)
  const leThemeDit = t ? leTheme(t[1]) : undefined
  if (leThemeDit && leThemeDit.rarete !== 'offert') return { rayon: 'themes', fiche: { sorte: 'theme', cle: leThemeDit.key } }
  if (hash === '#compagnons') return { rayon: 'compagnons', fiche: null }
  const c = compagnonDeLAdresse(hash)
  if (c) return { rayon: 'compagnons', fiche: { sorte: 'compagnon', cle: c } }
  if (hash === '#fonds') return { rayon: 'fonds', fiche: null }
  const f = fondDeLAdresse(hash)
  if (f) return { rayon: 'fonds', fiche: { sorte: 'fond', cle: f } }
  if (hash === '#objets') return { rayon: 'objets', fiche: null }
  if (hash === '#vies') return { rayon: 'objets', fiche: { sorte: 'objet', cle: 'vie' } }
  const o = objetDeLAdresse(hash)
  if (o) return { rayon: 'objets', fiche: { sorte: 'objet', cle: o } }
  return { rayon: null, fiche: null }
}

const sansMouvement = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Le rayon que la page montre : le dernier dont le titre est passé sous la rangée collée — le dernier, tout en bas. */
function rayonALEcran(): Rayon {
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) return RAYONS[RAYONS.length - 1].id
  let ici: Rayon = RAYONS[0].id
  for (const r of RAYONS) {
    const el = document.getElementById(`rayon-${r.id}`)
    if (el && el.getBoundingClientRect().top <= 160) ici = r.id
  }
  return ici
}

/** Le nom d'un article, quelle que soit sa sorte. */
function nomDeLArticle(a: Envie): string | undefined {
  if (a.sorte === 'theme') return leTheme(a.cle)?.nom
  if (a.sorte === 'compagnon') return leCompagnon(a.cle)?.nom
  if (a.sorte === 'fond') return leFond(a.cle)?.nom
  return OBJETS.find(o => o.cle === a.cle)?.nom
}

/** Ce que ses missions d'un jour rapportent au plus. */
const CONFETTIS_DES_MISSIONS = MISSIONS_PAR_JOUR * CONFETTIS_D_UNE_MISSION + CONFETTIS_DES_TROIS

/**
 * « Tes confettis », ouverte en touchant son solde : ce qu'il a, et d'où ils
 * viennent. Le chiffre seul, en tête de la boutique, ne disait ni comment en
 * gagner ni par où commencer — et c'est la question de qui n'a pas de quoi.
 */
export function FeuilleDesConfettis({ solde, onFermer }: { solde: number; onFermer: () => void }) {
  return (
    <Feuille
      titre="Tes confettis"
      onFermer={onFermer}
      className="feuille-boutique"
      pied={
        <div className="presentoir-gestes presentoir-geste-seul">
          <a className="btn btn-primary" href="/jour">
            Jouer le quiz du jour
          </a>
        </div>
      }
    >
      <p className="confettis-solde">{enConfettis(solde)}</p>
      <p className="presentoir-dit">{espacesFines('Une bonne réponse, un confetti : ils se gagnent en jouant, et se dépensent ici.')}</p>
      {solde < 0 && <p className="presentoir-dit">Une soirée retirée de l’historique a repris les siens. Ce que tu as acheté te reste.</p>}
      <ul className="confettis-sources">
        <li>
          <span>Le quiz du jour</span>
          <span>{`jusqu’à ${QUESTIONS_PAR_JOUR} par jour`}</span>
        </li>
        <li>
          <span>La campagne, les sentiers, les duels</span>
          <span>1 par bonne réponse</span>
        </li>
        <li>
          <span>Une soirée entre amis</span>
          <span>1 par bonne réponse</span>
        </li>
        <li>
          <a className="link-inline" href="/#missions">
            Les missions du jour
          </a>
          <span>{`jusqu’à ${CONFETTIS_DES_MISSIONS} par jour`}</span>
        </li>
        <li>
          <span>Le coffre de la semaine</span>
          <span>en plus</span>
        </li>
      </ul>
    </Feuille>
  )
}

/**
 * Son envie, en tête de la boutique : ce qu'il vise, sa jauge, ce qui manque
 * encore — ou « À ta portée ». La toucher ouvre son présentoir.
 */
function CarteDeLEnvie({ envie, solde, onOuvrir }: { envie: Envie; solde: number; onOuvrir: () => void }) {
  const ou = ouEnEstLEnvie(envie, solde)
  const nom = nomDeLArticle(envie)
  if (!ou || !nom) return null
  return (
    <button type="button" className="carte-envie" aria-haspopup="dialog" aria-label={`Ton envie : ${nom}, ${ou.manque > 0 ? `encore ${ou.manque} confettis` : 'à ta portée'}`} onClick={onOuvrir}>
      <VignetteDeLArticle article={envie} />
      <span className="carte-envie-texte">
        <span className="carte-envie-nom">
          Ton envie · <b>{nom}</b>
        </span>
        <JaugeFine part={ou.part / 100} />
      </span>
      <span className="carte-envie-reste">
        {ou.manque > 0 ? (
          <>
            encore
            <b>{enConfettis(ou.manque)}</b>
          </>
        ) : (
          <b>À ta portée</b>
        )}
      </span>
    </button>
  )
}

export function PanneauBoutique({
  profil,
  busy,
  enregistrer,
  acheter,
  acheterCompagnon,
  acheterFond,
  onSolde,
  onEnvie,
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: ChoixDuProfil) => Promise<boolean> | void
  acheter: (cle: string, porter: boolean) => Promise<string | null>
  acheterCompagnon: (cle: string, installer: boolean) => Promise<string | null>
  acheterFond: (cle: string, porter: boolean) => Promise<string | null>
  /** Un objet acheté : le solde que le serveur rend. */
  onSolde: (solde: number) => void
  /** Son envie, telle que le serveur l'a retenue ; null : retirée. */
  onEnvie: (envie: Envie | null) => void
}) {
  const [depart] = useState(() => ceQueLAdresseOuvre(typeof window === 'undefined' ? '' : window.location.hash))
  const [fiche, setFiche] = useState<{ article: Envie; etape: 'fiche' | 'confirmer' } | null>(depart.fiche && { article: depart.fiche, etape: 'fiche' })
  const [essai, setEssai] = useState<EssaiDeLaBoutique>({})
  const [ici, setIci] = useState<Rayon>(depart.rayon ?? 'themes')
  const [erreur, setErreur] = useState('')
  const [panier, setPanier] = useState(false)
  const [pris, setPris] = useState<readonly LigneDuPanier[] | null>(null)
  /** Un essai en train d'être gardé : un à la fois. */
  const prise = useRef(false)
  const comptoir = useComptoir(profil, onSolde)

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

  /** Descendre jusqu'à un rayon, son titre juste sous la rangée collée. */
  const descendre = (r: Rayon, doux = true) => {
    document.getElementById(`rayon-${r}`)?.scrollIntoView({ block: 'start', behavior: doux && !sansMouvement() ? 'smooth' : 'auto' })
  }
  // Ouverte à l'adresse d'un rayon, la page y descend ; une adresse de la boutique suivie depuis la boutique même — « Adopter »,
  // dans la fiche de la niche — ne recharge pas la page : elle la suit.
  useEffect(() => {
    if (depart.rayon && depart.rayon !== 'themes') descendre(depart.rayon, false)
    const suivre = () => {
      const lu = ceQueLAdresseOuvre(window.location.hash)
      if (lu.fiche) setFiche({ article: lu.fiche, etape: 'fiche' })
      if (lu.rayon) {
        setIci(lu.rayon)
        descendre(lu.rayon)
      }
    }
    window.addEventListener('hashchange', suivre)
    return () => window.removeEventListener('hashchange', suivre)
  }, [])
  // Le rayon à l'écran s'allume au fil du défilement.
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
  const adoptes: readonly string[] = (boutique.compagnons ?? []).map(c => c.compagnon)
  const lignes = lignesDuPanier(essai, { themes: boutique.possedes, compagnons: adoptes, jour: boutique.jour })
  const themes = themesEnRayon(boutique.possedes, boutique.jour)
  const envie = boutique.envie
  const envieDe = (sorte: Envie['sorte']) => (envie?.sorte === sorte ? envie.cle : undefined)
  /** Les articles de chaque rayon, dans l'ordre : ce que les flèches du présentoir feuillettent. */
  const cles: Record<Rayon, readonly string[]> = {
    themes: themes.map(t => t.key),
    compagnons: COMPAGNONS_DE_LA_BOUTIQUE.map(c => c.key),
    fonds: fondsEnRayon(profil.fonds ?? []).map(f => f.key),
    objets: OBJETS.map(o => o.cle),
  }
  const lignesDesRayons: Record<Rayon, string> = {
    themes: ligneDesThemes(themes, solde),
    compagnons: ligneDesCompagnons(adoptes.filter(c => COMPAGNONS_DE_LA_BOUTIQUE.some(b => b.key === c)).length),
    fonds: LIGNE_DES_FONDS,
    objets: LIGNE_DU_COMPTOIR,
  }

  /** Changer de rayon n'empile rien : l'adresse suit, et le retour du téléphone quitte la boutique, comme avant. */
  const aller = (r: Rayon) => {
    history.replaceState(history.state, '', r === 'themes' ? `${window.location.pathname}${window.location.search}` : `#${r}`)
    setIci(r)
    descendre(r)
  }
  const ouvrir = (article: Envie, etape: 'fiche' | 'confirmer' = 'fiche') => {
    setErreur('')
    setFiche({ article, etape })
  }
  /**
   * Le présentoir refermé : ce qu'il vient d'acheter sans le porter quitte
   * l'essai — la page le montrait encore, le temps de choisir —, et reprend
   * son habit d'avant.
   */
  const fermer = () => {
    setFiche(null)
    setErreur('')
    setEssai(e => {
      const acquis: SorteDEssai[] = []
      if (e.theme && boutique.possedes.includes(e.theme)) acquis.push('theme')
      if (e.compagnon && adoptes.includes(e.compagnon)) acquis.push('compagnon')
      return acquis.length > 0 ? sansLaSorte(e, ...acquis) : e
    })
  }
  /** Essayer — ou, déjà à l'essai, ôter. Mis à l'essai, il referme son présentoir : on le voit sur la page. */
  const essayer = (sorte: SorteDEssai, cle: string) => {
    const deja = essai[sorte] === cle
    setEssai(e => (deja ? sansLaSorte(e, sorte) : { ...e, [sorte]: cle }))
    setPris(null)
    if (!deja) fermer()
  }
  /** Porté depuis son présentoir : l'essai qui le montrait devient le sien, sans repasser par l'ancien. */
  const porte = (article: Envie) => {
    if (article.sorte === 'theme' && essai.theme === article.cle) finirLEssai(true)
    if (article.sorte === 'theme' || article.sorte === 'compagnon') setEssai(e => (e[article.sorte as SorteDEssai] === article.cle ? sansLaSorte(e, article.sorte as SorteDEssai) : e))
  }
  /** Pose son envie, ou la retire : c'est le serveur qui la retient, et qui la refuse en clair. */
  const poserLEnvie = async (voulue: Envie | null): Promise<string | null> => {
    try {
      const r = await api.joueur.envie(voulue)
      onEnvie(r.envie)
      return null
    } catch (e) {
      return motifDe(e)
    }
  }

  /**
   * « Tout garder » : chaque ligne de l'essai l'une après l'autre — le serveur
   * n'en compte qu'un à la fois —, jusqu'au premier refus, dit dans la
   * feuille. Ce qu'on garde d'ici, on le porte : c'est ce que la page montre.
   * Un thème gardé devient le sien sans repasser par l'ancien, un compagnon
   * s'installe dans sa niche.
   */
  const prendre = async (aPrendre: readonly LigneDuPanier[]) => {
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
        refus = l.sorte === 'theme' ? await acheter(l.cle, true) : await acheterCompagnon(l.cle, true)
        if (refus) {
          refus = `${l.nom} : ${refus}`
          break
        }
        faits.push(l)
        if (l.sorte === 'theme') finirLEssai(true)
      }
    } finally {
      prise.current = false
    }
    if (faits.length > 0) {
      setEssai(e => sansLaSorte(e, ...faits.map(l => l.sorte)))
      setPris(faits)
    }
    if (refus) setErreur(refus)
  }

  return (
    <div className="la-boutique">
      <nav className="boutique-rayons" aria-label="Les rayons de la boutique">
        {/* La bande colle en haut, de bord à bord ; ses segments défilent dans leur cadre, qui s'arrête avant la niche (`styles.css`). */}
        <div className="boutique-rayons-defile">
          {RAYONS.map(r => (
            <a
              key={r.id}
              href={`#${r.id}`}
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
        </div>
      </nav>
      {envie && <CarteDeLEnvie envie={envie} solde={solde} onOuvrir={() => ouvrir(envie)} />}
      {solde < 0 && <p className="muted small">Une soirée retirée de l’historique a repris ses confettis. Ce que tu as acheté te reste.</p>}
      {RAYONS.map(r => (
        <section key={r.id} id={`rayon-${r.id}`} className="rayon-de-la-boutique" aria-labelledby={`titre-${r.id}`}>
          {/* Son nom, et ce qu'on vient y chercher en une ligne : un paragraphe sur ce qu'est un thème prenait la place de deux rangées. */}
          <header className="rayon-tete">
            <h2 id={`titre-${r.id}`}>{r.titre}</h2>
            <p>{lignesDesRayons[r.id]}</p>
          </header>
          {r.id === 'themes' ? (
            <RayonDesThemes profil={profil} essai={essai.theme} envie={envieDe('theme')} onOuvrir={cle => ouvrir({ sorte: 'theme', cle })} />
          ) : r.id === 'compagnons' ? (
            <RayonDesCompagnons profil={profil} essai={essai.compagnon} envie={envieDe('compagnon')} onOuvrir={cle => ouvrir({ sorte: 'compagnon', cle })} />
          ) : r.id === 'fonds' ? (
            <RayonDesFonds profil={profil} envie={envieDe('fond')} onOuvrir={cle => ouvrir({ sorte: 'fond', cle })} />
          ) : (
            <RayonDesObjets comptoir={comptoir} solde={solde} envie={envieDe('objet')} onOuvrir={cle => ouvrir({ sorte: 'objet', cle })} />
          )}
        </section>
      ))}
      {fiche && (
        <Presentoir
          profil={profil}
          ouvert={fiche.article}
          etapeDeDepart={fiche.etape}
          rayon={cles[RAYON_DE[fiche.article.sorte]]}
          essai={essai}
          busy={busy}
          comptoir={comptoir}
          onVoisin={cle => ouvrir({ sorte: fiche.article.sorte, cle })}
          onEssayer={essayer}
          onEnvie={poserLEnvie}
          acheter={acheter}
          acheterCompagnon={acheterCompagnon}
          acheterFond={acheterFond}
          enregistrer={enregistrer}
          onPorte={porte}
          onFermer={fermer}
        />
      )}
      {lignes.length > 0 && !fiche && !panier && (
        <BarreDuPanier
          lignes={lignes}
          onRetirer={() => setEssai({})}
          onGarder={l => ouvrir({ sorte: l.sorte, cle: l.cle }, 'confirmer')}
          onVoir={() => {
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
          onRetirer={sorte => {
            setEssai(e => (sorte ? sansLaSorte(e, sorte) : {}))
            // La dernière ligne retirée, il n'y a plus rien à lire ici.
            if (!sorte || lignes.length <= 1) setPanier(false)
          }}
          onGarder={l => void prendre(l)}
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
