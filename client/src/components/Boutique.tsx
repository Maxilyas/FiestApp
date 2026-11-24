import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { gemme } from '../gemmes'
import { Icon } from './Icon'
import { ongletVise } from './Onglets'
import { rendreLeFocus } from '../focus'
import { espacesFines, formatNumber } from '../format'
import { NOM_DE_RARETE, THEMES, campDuTheme, enBoutique, prixDe, retourEnBoutique, theme, type Theme } from '../../../shared/themes'
import { nomDeLaPlaque } from '../../../shared/plaques'
import { enConfettis, themesEnRayon } from '../../../shared/rayons'
import type { PublicProfileDetail } from '../../../shared/profil'
import { AGagner, EnteteDeLaPiece, PiedDeLaPiece, VersLaBoutique, ceQueDitLaVignette, classesDeLaVignette, type EtatDUneVignette } from './LigneDeCollection'
import { apercuDe } from '../apercus'
import { EchantillonDePlaque, MaPlaque, plaquesDeLaLoge } from './MaPlaque'
import type { PropsDUnePiece } from './choix'

// Les thèmes : ce qui habille toutes ses pages — la soirée, son profil, ses
// quiz, son compte —, sauf l'écran commun, acheté en confettis
// (`shared/themes.ts`). Une bonne réponse, un confetti. La boutique ne montre
// que ce qui reste à prendre, en tuiles serrées, trois par rangée sur un
// téléphone, du moins cher au plus cher (`RayonDesThemes`, la refonte du
// 10 novembre 2026) ; ce qu'on a se porte dans la pièce « Thème » de la
// loge (`MesThemes`), en vignettes au même haut d'aperçu, et sa plaque à
// côté, dans son onglet (le 17 novembre 2026). « Ma
// collection » les montre tous, en vignettes rangées par rareté, ceux qui ne
// se vendent pas compris, et la même fiche dit où les gagner.
//
// À la boutique, toucher un thème ouvre son présentoir (`Presentoir.tsx`) :
// il s'y essaie — toute la page le porte, rien n'est enregistré (le souhait
// du propriétaire du 1er novembre 2026 : « pouvoir essayer sans acheter ») —
// et s'y achète. Dans la loge, le toucher l'essaie aussi, et « Porter », dans
// sa barre, le garde. Un thème se portait d'un toucher, enregistré : le doigt
// qui voulait le regarder habillait déjà toute la page, pour de bon.

export type EtatDuTheme = 'porte' | 'a-toi' | 'a-vendre' | 'trop-cher' | 'hors-saison' | 'a-gagner'

/**
 * Ce qu'est un thème pour lui, ce jour-là : porté, à lui, à vendre, trop
 * cher pour l'instant, hors de sa saison — ou à gagner : celui-là ne se vend
 * jamais, et son prix ne voudrait rien dire.
 */
export function etatDuTheme(t: Theme, porte: string, possedes: ReadonlySet<string>, solde: number, jour: string): EtatDuTheme {
  if (t.key === porte) return 'porte'
  if (possedes.has(t.key)) return 'a-toi'
  if (t.gagne) return 'a-gagner'
  if (!enBoutique(t, jour)) return 'hors-saison'
  return prixDe(t) > solde ? 'trop-cher' : 'a-vendre'
}

/** Sa case, dite à l'oreille d'une traite : son nom, puis ce qu'il est pour lui. */
export function nomDeLaCase(t: Theme, etat: EtatDuTheme, solde: number): string {
  if (etat === 'porte') return `${t.nom}, porté`
  if (etat === 'a-toi') return `${t.nom}, à toi`
  if (etat === 'a-gagner') return `${t.nom}, ${NOM_DE_RARETE[t.rarete]}, se gagne`
  const prix = `${NOM_DE_RARETE[t.rarete]}, ${formatNumber(prixDe(t))} confettis`
  if (etat === 'trop-cher') return `${t.nom}, ${prix}, encore ${formatNumber(prixDe(t) - solde)}`
  if (etat === 'hors-saison') return `${t.nom}, ${prix}, ${retourEnBoutique(t)}`
  return `${t.nom}, ${prix}`
}

// La couleur de chaque rareté vit à part (`gemmes.ts`) : la fin d'une partie la lit sans la boutique.
export { gemme }

/**
 * La fiche ouverte s'ouvre juste sous sa case, et reçoit le focus sur son
 * nom : le lecteur d'écran la lit. La page ne défile que ce qu'il faut pour
 * la montrer entière, son bouton compris. Porté, un thème n'a plus de
 * bouton : le focus qui y était tombait sur la page, il revient au nom.
 */
export function useFiche(ouvert: string | null, porte: string) {
  const detail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fiche = detail.current
    if (!ouvert || !fiche) return
    const nom = fiche.querySelector<HTMLElement>('.galerie-detail-nom')
    if (nom) {
      nom.tabIndex = -1
      nom.focus({ preventScroll: true })
    }
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    fiche.scrollIntoView({ block: 'nearest', behavior: calme ? 'auto' : 'smooth' })
  }, [ouvert])
  useEffect(() => {
    rendreLeFocus(detail.current, ['.galerie-detail-nom'])
  }, [porte])
  return detail
}

/**
 * Le prix d'un article, sur sa tuile : à l'or quand son solde le paie, en
 * gris sinon — d'un coup d'œil, ce qu'il peut s'offrir aujourd'hui. Aucun
 * aperçu ne s'éteint pour autant : ce qu'on vise se regarde aussi. Un thème
 * y pose la gemme de sa rareté, à la couleur que sa tuile lui donne.
 */
export function PrixDeLaTuile({ prix, solde, avecGemme = false }: { prix: number; solde: number; avecGemme?: boolean }) {
  return (
    <span className={'article-prix' + (prix > solde ? ' article-prix-loin' : '')}>
      {avecGemme && <i className="article-gemme" aria-hidden="true" />}
      {enConfettis(prix)}
    </span>
  )
}

/**
 * La tuile d'un thème, à la boutique : le haut de son aperçu — la question,
 * ses premières réponses : assez pour le reconnaître —, son nom entier, sur
 * deux lignes s'il le faut, et son prix. Trois par rangée sur un téléphone :
 * neuf thèmes à l'arrivée en 360 × 640, là où les cartes de l'étagère en
 * montraient un et demi. Elle ouvre son présentoir, et dit ce qu'elle est
 * pour lui : à l'essai, son envie, ou de saison — une saison ne dure que
 * quelques jours.
 */
function TuileDeTheme({
  t,
  etat,
  solde,
  essaye,
  envie,
  onToucher,
}: {
  t: Theme
  etat: EtatDuTheme
  solde: number
  /** La page l'essaie. */
  essaye: boolean
  /** C'est pour lui qu'il économise. */
  envie: boolean
  onToucher: () => void
}) {
  const apercu = apercuDe(t.key)
  return (
    <button
      type="button"
      className={'article-boutique article-theme' + (essaye ? ' article-essayee' : '')}
      style={gemme(t.rarete)}
      aria-haspopup="dialog"
      aria-label={nomDeLaCase(t, etat, solde) + (essaye ? ', à l’essai' : '') + (envie ? ', ton envie' : '')}
      onClick={onToucher}
    >
      <span className="article-image" aria-hidden="true">
        {apercu && <img src={apercu} alt="" width={180} height={225} loading="lazy" decoding="async" />}
      </span>
      {essaye ? (
        <span className="article-marque">à l’essai</span>
      ) : envie ? (
        <span className="article-marque">
          <Icon name="star" />
          envie
        </span>
      ) : (
        t.saison && <span className="article-marque">de saison</span>
      )}
      <span className="article-pied">
        <b className="article-nom">{t.nom}</b>
        <PrixDeLaTuile prix={prixDe(t)} solde={solde} avecGemme />
      </span>
    </button>
  )
}

/**
 * La case d'un thème, dans la loge : une vignette comme celles de ses autres
 * pièces (`.loge-vignette`, la base commune du 17 novembre 2026) — le haut de
 * son aperçu, comme la tuile de la boutique, puis son nom, la gemme de sa
 * rareté devant. Elle dit son état comme une case d'avatar : le cadre d'or,
 * le thème que la page montre ; le halo, à l'essai ; la coche, celui qu'il
 * porte ; le point rouge, le neuf. Un interrupteur (`aria-pressed`, ce que la
 * page montre), comme une case d'avatar : un toucher l'essaie et ne déplie
 * plus rien. Une grande carte (175 px de haut, l'aperçu entier) la précédait,
 * qui dépliait sa fiche sous sa rangée : quatre thèmes faisaient défiler la
 * pièce de 550 px en 360 × 640.
 */
function CaseDeTheme({ t, etat, onToucher }: { t: Theme; etat: EtatDUneVignette; onToucher: () => void }) {
  const apercu = apercuDe(t.key)
  return (
    <button
      type="button"
      className={'loge-vignette loge-theme-case' + classesDeLaVignette(etat)}
      style={gemme(t.rarete)}
      aria-pressed={etat.montre}
      aria-label={`${t.nom}, ${NOM_DE_RARETE[t.rarete].toLowerCase()}` + ceQueDitLaVignette(etat, 'porté', 'nouveau')}
      onClick={onToucher}
    >
      <span className="loge-vignette-image" aria-hidden="true">
        {apercu && <img src={apercu} alt="" width={180} height={225} loading="lazy" decoding="async" />}
      </span>
      <span className="loge-vignette-nom">
        <i className="article-gemme" aria-hidden="true" />
        {t.nom}
      </span>
    </button>
  )
}

/**
 * Le rayon des thèmes, à la boutique : ce qu'il n'a pas et que la saison
 * permet, dans une seule grille, du moins cher au plus cher — l'ordre du
 * catalogue, la gemme de chaque rareté devant son prix. Une étagère par
 * rareté, qu'on faisait glisser de côté, montrait deux cartes sur cinq et
 * demandait cinq gestes pour tout voir (385 à 1867 px de page en 360 × 640,
 * mesuré le 10 novembre 2026) ; avant elle, une rareté à la fois cachait les
 * quatre autres. Ceux qui ne se vendent pas n'y sont pas : ils se gagnent, et
 * « Ma collection » dit où (la remarque du 6 octobre 2026). Toucher une tuile
 * ouvre son présentoir.
 */
export function RayonDesThemes({
  profil,
  essai,
  envie,
  onOuvrir,
}: {
  profil: PublicProfileDetail
  /** Le thème que la page essaie. */
  essai?: string
  /** Le thème pour lequel il économise. */
  envie?: string
  onOuvrir: (cle: string) => void
}) {
  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  // Le thème porté se lit dans le profil, que chaque enregistrement rend à
  // jour — jamais dans la boutique, lue une fois avec la page.
  const porte = profil.theme ?? 'velours'
  const possedes = new Set(boutique.possedes)
  const enRayon = themesEnRayon(boutique.possedes, boutique.jour)
  return (
    <>
      {enRayon.length === 0 ? (
        <p className="card muted">Tu as tous les thèmes de la boutique. Ceux des saisons reviennent avec elles.</p>
      ) : (
        <ul className="rayon-grille grille-themes" aria-label="Les thèmes">
          {enRayon.map(t => (
            <li key={t.key}>
              <TuileDeTheme t={t} etat={etatDuTheme(t, porte, possedes, solde, boutique.jour)} solde={solde} essaye={essai === t.key} envie={envie === t.key} onToucher={() => onOuvrir(t.key)} />
            </li>
          ))}
        </ul>
      )}
      <p className="rayon-suite">
        {possedes.size} thème{possedes.size > 1 ? 's' : ''} déjà à toi ·{' '}
        <a className="link-inline" href="/profil#theme">
          les porter
        </a>
      </p>
    </>
  )
}

/** Les deux onglets de la pièce « Thème » : ses thèmes, que lui seul voit, et sa plaque, que les autres voient. */
type VueDuTheme = 'themes' | 'plaque'

/**
 * « Mes thèmes · Mon podium », tout en haut de la pièce « Thème » : sa plaque
 * vivait sous ses thèmes, une ligne de classement entière par choix, et
 * commençait à 1180 px en 360 × 640 pour une habituée — « caché tout en bas
 * et donc impossible pour des utilisateurs de savoir que ça existe » (le
 * propriétaire, le 17 novembre 2026). Deux onglets plutôt que deux boutons à
 * `aria-pressed` : ce sont deux vues de la même pièce, l'une à la place de
 * l'autre, au clavier comme la rangée des pièces et les gemmes des avatars
 * (un seul arrêt de Tab, les flèches passent à l'autre, `ongletVise`).
 * Chacun dit d'un coup d'œil ce qu'il garde : combien de thèmes, et
 * l'échantillon de la plaque que la page montre ; le point rouge, du neuf
 * qu'on n'a pas sous les yeux — une plaque vient avec chaque thème neuf.
 */
function OngletsDuTheme({
  vue,
  onVue,
  themes,
  plaque,
  nomDeLaPlaque,
  neufs,
}: {
  vue: VueDuTheme
  onVue: (v: VueDuTheme) => void
  themes: number
  /** La plaque que la page montre, en échantillon ; null : sans plaque. */
  plaque: string | null
  nomDeLaPlaque: string
  neufs: { themes: boolean; plaque: boolean }
}) {
  const liste = useRef<HTMLDivElement>(null)
  const ordre: VueDuTheme[] = ['themes', 'plaque']
  const touche = (e: KeyboardEvent, i: number) => {
    const j = ongletVise(e.key, i, ordre.length)
    if (j === null) return
    e.preventDefault()
    onVue(ordre[j])
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
  }
  const onglet = (v: VueDuTheme, i: number, contenu: ReactNode, neuf: boolean) => (
    <button
      id={`loge-theme-${v}`}
      type="button"
      role="tab"
      aria-selected={vue === v}
      aria-controls={vue === v ? 'loge-theme-vue' : undefined}
      tabIndex={vue === v ? 0 : -1}
      className={'onglet' + (vue === v ? ' actif' : '')}
      onClick={() => onVue(v)}
      onKeyDown={e => touche(e, i)}
    >
      {contenu}
      {neuf && vue !== v && (
        <>
          <span className="loge-theme-neuf" aria-hidden="true" />
          <span className="sr-only">, du nouveau</span>
        </>
      )}
    </button>
  )
  return (
    <div ref={liste} className="onglets loge-theme-onglets" role="tablist" aria-label="Thème ou podium">
      {onglet(
        'themes',
        0,
        <>
          <Icon name="palette" />
          Mes thèmes
          <span className="loge-theme-compte">
            <span className="sr-only">, </span>
            {themes}
          </span>
        </>,
        neufs.themes,
      )}
      {onglet(
        'plaque',
        1,
        <>
          <EchantillonDePlaque plaque={plaque} />
          {/* « Ma plaque » jusqu'au 24 novembre 2026 : le nom ne disait pas ce que les autres en voient, sa marche peinte. */}
          Mon podium
          {/* Le seul réglage du panneau « Toi seul » que les autres voient : un petit œil, sans phrase (le souhait du 17 novembre 2026). */}
          <Icon name="eye" className="loge-theme-oeil" />
          <span className="sr-only">{`, ${nomDeLaPlaque}, les autres le voient`}</span>
        </>,
        neufs.plaque,
      )}
    </div>
  )
}

/**
 * Son camp, sous un thème qui en a deux (les Deux Bannières, le choix du
 * propriétaire du 19 novembre 2026 : « l'option choisir son camp ») : une
 * rangée de deux, chacun son emblème et son nom, au-dessus de ses thèmes —
 * seulement quand le thème que la page montre en a. Un toucher l'essaie, la
 * page entière se teinte de lui et sa plaque le porte ; « Porter » le garde,
 * comme le reste de la loge. Sans phrase : l'emblème et le nom suffisent (le
 * propriétaire, le 17 novembre 2026 — pas de texte qui explique).
 */
function ChoixDuCamp({
  profil,
  essai,
  essayer,
  montre,
}: Pick<PropsDUnePiece, 'profil' | 'essai' | 'essayer'> & {
  /** Le thème que la page montre : l'essai, sinon le sien. */
  montre: string
}) {
  const t = theme(montre)
  if (!t?.camps) return null
  const porte = campDuTheme(t, profil.camp)?.key
  const vu = campDuTheme(t, essai.camp !== undefined ? essai.camp : profil.camp)?.key
  return (
    <div className="loge-camps" role="radiogroup" aria-label="Ton camp">
      {t.camps.map(c => (
        <button
          key={c.key}
          type="button"
          role="radio"
          aria-checked={vu === c.key}
          className={'loge-camp' + (vu === c.key ? ' selected' : '') + (vu === c.key && porte !== c.key ? ' essaye' : '')}
          onClick={() => essayer({ camp: c.key })}
        >
          <EchantillonDePlaque plaque={`${t.key}-${c.key}`} />
          <span className="loge-camp-nom">{c.nom}</span>
          <span className="sr-only">{`, ${c.long}` + (porte === c.key ? ', porté' : '')}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * La pièce « Thème » de la loge, en deux onglets (`OngletsDuTheme`) : ses
 * thèmes d'office, sa plaque à côté.
 *
 * Ses thèmes : seulement ceux qu'il a, en vignettes, trois par rangée, celui
 * qu'il porte en tête. Toucher un thème l'essaie — la page entière le porte,
 * rien n'est enregistré — ; « Porter », dans la barre de la loge, le garde.
 * Un thème se portait d'un toucher, enregistré : le doigt qui voulait le
 * regarder habillait déjà toute la page, pour de bon.
 *
 * La fiche d'un thème (`DetailTheme`) ne s'ouvre plus sous la case touchée :
 * la page entière l'essaie déjà, la barre de l'essai dit son nom et sa
 * rareté, et la fiche, glissée dans la grille, poussait les cases d'après
 * sous le doigt qui en essayait une autre. Son humeur — la seule chose
 * qu'elle disait encore ici — reste dans son présentoir à la boutique et sa
 * fiche de « Ma collection » : le thème porté par toute la page la dit
 * mieux qu'une phrase.
 */
export function MesThemes({ profil, essai, essayer, neufs }: PropsDUnePiece) {
  // Revenu sur la pièce avec une plaque à l'essai et pas de thème : elle s'ouvre sur sa plaque, là où il en était.
  const [vue, setVue] = useState<VueDuTheme>(() => (essai.plaque !== undefined && essai.theme === undefined ? 'plaque' : 'themes'))
  const boutique = profil.boutique
  if (!boutique) return null
  const porte = profil.theme ?? 'velours'
  // Le thème que la page porte : l'essai, sinon le sien.
  const montre = essai.theme !== undefined ? (essai.theme ?? 'velours') : porte
  const possedes = new Set(boutique.possedes)
  const siens = THEMES.filter(t => possedes.has(t.key)).sort((a, b) => Number(b.key === porte) - Number(a.key === porte))
  const aVendre = themesEnRayon(boutique.possedes, boutique.jour).length
  const aGagner = THEMES.filter(t => t.gagne && !possedes.has(t.key)).length
  const plaques = plaquesDeLaLoge(profil, essai)
  const toucher = (cle: string) => essayer({ theme: cle === 'velours' ? null : cle })
  return (
    <section className="mes-themes">
      {/* Les onglets tiennent lieu de titre à l'œil (`.mes-themes .loge-entete-titre`) : le lecteur d'écran le lit. */}
      <EnteteDeLaPiece id="loge-theme-titre" titre={vue === 'themes' ? 'Mes thèmes' : 'Mon podium'}>
        <OngletsDuTheme
          vue={vue}
          onVue={setVue}
          themes={siens.length}
          plaque={plaques.vue}
          nomDeLaPlaque={plaques.vue ? nomDeLaPlaque(plaques.vue) : 'classique'}
          neufs={{ themes: siens.some(t => neufs?.has(t.key)), plaque: plaques.choix.some(c => neufs?.has(c.cle)) }}
        />
      </EnteteDeLaPiece>
      <div className="loge-theme-vue" role="tabpanel" id="loge-theme-vue" aria-labelledby={`loge-theme-${vue}`}>
        {vue === 'themes' && <ChoixDuCamp profil={profil} essai={essai} essayer={essayer} montre={montre} />}
        {vue === 'themes' ? (
          <ul className="loge-vignettes loge-themes" aria-label="Mes thèmes">
            {siens.map(t => (
              <li key={t.key}>
                <CaseDeTheme t={t} etat={{ montre: montre === t.key, porte: porte === t.key, neuve: neufs?.has(t.key) }} onToucher={() => toucher(t.key)} />
              </li>
            ))}
          </ul>
        ) : (
          <MaPlaque profil={profil} essai={essai} essayer={essayer} neufs={neufs} />
        )}
      </div>
      {/* Ce qu'il n'a pas encore, sur une ligne : la boutique pour ce qui s'achète — et la plaque qui vient avec —, la
          collection pour ce qui se gagne, et où. La pièce ne montre que ce qu'il a. */}
      <PiedDeLaPiece>
        <VersLaBoutique n={aVendre} href="/boutique#themes" icone="palette" />
        <AGagner n={aGagner} un="thème" plusieurs="thèmes" href="#collection-themes" />
      </PiedDeLaPiece>
    </section>
  )
}

/**
 * La fiche d'un thème, sous sa case : son nom, son aperçu en grand, ce qu'il
 * habille, et le seul geste qui compte ce jour-là — le porter, l'acheter —,
 * ou ce qui manque encore. L'écran commun garde le sien : c'est ici qu'on le
 * dit, au moment de choisir. Sans `onPorter` ni `onAcheter` — « Ma
 * collection », qui ne fait que montrer —, un lien mène à l'écran qui le
 * fait ; un thème qui se gagne dit comment, et où.
 */
export function DetailTheme({
  theme: t,
  etat,
  solde,
  busy = false,
  erreur,
  onPorter,
  onAcheter,
}: {
  theme: Theme
  etat: EtatDuTheme
  solde: number
  /** Un enregistrement en route ; « Ma collection » n'en fait aucun. */
  busy?: boolean
  /** Le refus d'un achat, dit là où l'on a touché. */
  erreur?: string
  /** Le porter ; null : Velours, celui de toutes les soirées. */
  onPorter?: (cle: string | null) => void
  onAcheter?: (theme: Theme) => void
}) {
  const prix = prixDe(t)
  const apercu = apercuDe(t.key)
  return (
    <div className="galerie-detail detail-case detail-theme">
      <span className="detail-famille muted">
        {t.rarete === 'offert' ? 'Offert' : t.gagne ? `${NOM_DE_RARETE[t.rarete]} · il se gagne` : `${NOM_DE_RARETE[t.rarete]} · ${enConfettis(prix)}`}
      </span>
      <b className="galerie-detail-nom">{t.nom}</b>
      {apercu && (
        <span className="detail-apercu" aria-hidden="true">
          <img src={apercu} alt="" width={180} height={260} loading="lazy" decoding="async" />
        </span>
      )}
      <p className="muted small">{t.humeur}</p>
      {etat === 'porte' && <p className="muted small">C’est lui qui habille tes pages. L’écran commun garde le sien.</p>}
      {etat === 'a-toi' &&
        (onPorter ? (
          <button
            type="button"
            className="btn btn-small btn-primary"
            aria-disabled={busy || undefined}
            onClick={() => onPorter(t.key === 'velours' ? null : t.key)}
          >
            Le porter
          </button>
        ) : (
          <p className="muted small">
            À toi : il se porte dans{' '}
            <a className="link-inline" href="#theme">
              « Mon thème »
            </a>
            .
          </p>
        ))}
      {etat === 'a-vendre' && (
        <>
          <p className="muted small">
            {`Il coûte ${formatNumber(prix)} confettis : il t’en restera ${formatNumber(solde - prix)}.`}
            {t.saison && ` En boutique ${t.saison.periode}, et gardé toute l’année.`}
          </p>
          {onAcheter ? (
            <button type="button" className="btn btn-small btn-primary" aria-disabled={busy || undefined} onClick={() => onAcheter(t)}>
              {`L’acheter · ${enConfettis(prix)}`}
            </button>
          ) : (
            <a className="link-inline" href="/boutique">
              La boutique
            </a>
          )}
        </>
      )}
      {etat === 'trop-cher' && (
        <p className="muted small">
          Il coûte {formatNumber(prix)} confettis : <b>encore {formatNumber(prix - solde)}</b>.{t.saison && ` En boutique ${t.saison.periode}.`} Une bonne réponse, un confetti.
        </p>
      )}
      {etat === 'hors-saison' && t.saison && (
        <p className="muted small">{`En boutique ${t.saison.periode} seulement — acheté, il se garde toute l’année.`}</p>
      )}
      {etat === 'a-gagner' && t.gagne && (
        <>
          <p className="muted small">{espacesFines(`Il ne se vend pas : il se gagne avec ${t.gagne.regle}.`)}</p>
          <a className="link-inline" href={t.gagne.ou.lien}>
            {t.gagne.ou.nom}
          </a>
        </>
      )}
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
    </div>
  )
}
