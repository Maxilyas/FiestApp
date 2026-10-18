import { useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { Dessin } from '../components/Avatar'
import { EMBLEME } from '../components/Ecusson'
import { Balise } from '../components/Balise'
import { Feuille } from '../components/Pieces'
import { espacesFines } from '../format'
import { gemme } from '../gemmes'
import { useModale } from '../modale'
import { iconeDuSujet } from '../iconeDuSujet'
import { couleurDePiste, pourcentDeChance } from '../../../shared/sentiers'
import { sujetParCle } from '../../../shared/sujets'
import { CATEGORIES } from '../../../shared/categories'
import { NOM_NIVEAU } from '../../../shared/campagne'
import type { RareteDeTheme } from '../../../shared/themes'
import { duGardien, nomDuGardien, type FormeDEscale, type VueDeLExpedition } from '../../../shared/expedition'
import {
  CARTES_DES_RENCONTRES,
  CARTES_PAR_QUESTION,
  COURAGE_DE_LA_RENAISSANCE,
  COURAGE_MAX,
  FAMILLES_DE_CARTES,
  INSPIRATION_PAR_QUESTION,
  MISES,
  apercuDuTour,
  carteDeRencontre,
  cartesDeCombat,
  famillesDeLEquipee,
  type AnnonceDuTour,
  type ApercuDuTour,
  type CarteDeRencontre,
  type CoupDeRencontre,
  type FamilleDeCartes,
  type MomentDUneCarte,
  type VueDeLaRencontre,
} from '../../../shared/rencontres'

// Le prototype des rencontres, à l'écran (`shared/rencontres.ts` ; la
// proposition « L'Expédition en cartes », validée par le propriétaire le
// 18 octobre 2026 : « C'est good lance le prototype avec tes recos »). Une
// escale à question est un adversaire : la page dit qui il est, ses sceaux et
// ce qu'il frappe ; puis, avant chaque question, l'annonce — sa catégorie, sa
// marche, sa forme, sa chance —, ce que la réponse ferait, la mise et la main ;
// la question vue, les réflexes ; la réponse dite, ce qu'elle a brisé ou
// coûté. Rien ne se calcule ici que la page ne pourrait relire du serveur :
// les refus des cartes et des mises arrivent avec la vue, et l'aperçu se refait
// à la mise choisie par la règle même du serveur (`apercuDuTour`).
//
// Ses pièces, à part de `ExpeditionApp.tsx`, qui les assemble : une carte n'est
// pas un joker — son coût, son moment, sa famille —, et la page des jokers
// garde les siens pour les expéditions d'avant, qui finissent sous leurs
// règles.

/** « 62 % » : une chance telle que la page l'écrit, le signe collé par une espace fine insécable. */
export const pourcents = (chance: number) => `${pourcentDeChance(chance)} %`

/** Le nom d'une catégorie là où la place manque : sous une escale, dans les douze pastilles du Commandement. */
export const COURT: Readonly<Record<string, string>> = {
  'Culture générale': 'Culture G.',
  'Cinéma & séries': 'Cinéma',
  'Arts & lettres': 'Arts',
  'Jeux & pop culture': 'Jeux & pop',
  'Autour de la fête': 'La fête',
}

// ── Les cartes ──────────────────────────────────────────────────────────────

/**
 * La couleur d'une carte, au cadre : la gemme de sa rareté — celle des
 * jokers, de l'album et de la boutique (`gemmes.ts`) ; une maudite prend le
 * pourpre de l'épique. Une seule couleur par rareté dans toute l'application.
 */
const GEMME_DE_LA_CARTE: Record<CarteDeRencontre['rarete'], RareteDeTheme> = { commun: 'commune', rare: 'rare', maudit: 'epique', legendaire: 'legendaire' }
export const gemmeDeLaCarte = (c: CarteDeRencontre) => gemme(GEMME_DE_LA_CARTE[c.rarete])

/** Sa rareté, accordée à « carte ». */
export const RARETE_DE_LA_CARTE: Record<CarteDeRencontre['rarete'], string> = { commun: 'commune', rare: 'rare', maudit: 'maudite', legendaire: 'légendaire' }

/** Quand une carte se joue, en clair : la carte levée, l'offre, l'échoppe le disent. */
export const MOMENT: Record<MomentDUneCarte, string> = {
  preparation: 'Avant de voir la question',
  reflexe: 'La question sous les yeux',
  pouvoir: 'Posée pour toute la rencontre',
  route: 'Sur la carte, une fois par acte',
}
const MOMENT_COURT: Record<MomentDUneCarte, string> = { preparation: 'préparation', reflexe: 'réflexe', pouvoir: 'pouvoir', route: 'route' }

/** Son moment en un signe, au coin d'une carte de la main : on n'en voit que le haut. */
const SIGNE_DU_MOMENT: Record<MomentDUneCarte, IconName> = { preparation: 'clock', reflexe: 'zap', pouvoir: 'infinity', route: 'flag' }

/** Le dessin d'une carte sans légendaire ; celui d'un légendaire est son médaillon. */
const ICONE_DE_LA_CARTE: Readonly<Record<string, IconName>> = {
  concentration: 'target',
  prudence: 'shield',
  'coup-d-oeil': 'eye',
  echange: 'rotate',
  pioche: 'plus-square',
  'arret-sur-image': 'pause',
  detour: 'arrow-up',
  'double-chance': 'copy',
  sursis: 'hourglass',
  'tout-ou-rien': 'dice',
  'quitte-ou-double': 'zap',
  plume: 'edit',
  bibliotheque: 'book',
  'doubler-la-mise': 'ecu',
  banco: 'star',
  corser: 'plus',
  simplifier: 'check',
  echauffement: 'timer',
  lancee: 'spark',
  parade: 'bouclier',
  'contre-attaque': 'sabre',
  lucidite: 'bulb',
  'troisieme-oeil': 'moon',
}

/** Une carte en petit : le médaillon du légendaire qui la donne, sinon son dessin. */
export function VisageDeLaCarte({ c }: { c: CarteDeRencontre }) {
  return c.legendaire ? (
    <span className="exp-medaillon exp-visage-joker" aria-hidden="true">
      <Dessin cle={c.legendaire} />
    </span>
  ) : (
    <Icon name={ICONE_DE_LA_CARTE[c.cle] ?? 'sparkles'} />
  )
}

/** Ce que dit une carte au-delà de son effet : quand elle se joue, si elle s'épuise, si elle aide, d'où elle vient. */
export function origineDeLaCarte(c: CarteDeRencontre): string {
  return [
    MOMENT[c.moment],
    c.epuisement && 'jouée, elle s’épuise jusqu’à la rencontre suivante',
    c.indice && 'un indice : ta réponse ne compte pas pour ton savoir',
    c.legendaire && `la carte ${duGardien(c.legendaire)}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** L'ordre du catalogue : neutres, familles, légendaires — pas celui des noms, que `localeCompare` trierait en chargeant `Intl` (règle `client.md`). */
const RANG_AU_CATALOGUE = new Map(CARTES_DES_RENCONTRES.map((c, i) => [c.cle, i]))

/** Des cartes comptées — « Concentration ×4 » —, dans l'ordre du catalogue. */
export function comptesDesCartes(cles: readonly string[]): { cle: string; nom: string; n: number }[] {
  const n = new Map<string, number>()
  for (const cle of cles) n.set(cle, (n.get(cle) ?? 0) + 1)
  return [...n]
    .map(([cle, x]) => ({ cle, nom: carteDeRencontre(cle)?.nom ?? cle, n: x }))
    .sort((a, b) => (RANG_AU_CATALOGUE.get(a.cle) ?? 99) - (RANG_AU_CATALOGUE.get(b.cle) ?? 99))
}

export const ditDesCartes = (cles: readonly string[]) => comptesDesCartes(cles).map(c => (c.n > 1 ? `${c.nom} ×${c.n}` : c.nom))

/** Des cartes comptées, en jetons : la pioche, la défausse, le paquet. */
export function JetonsDeCartes({ cles, vide }: { cles: readonly string[]; vide: string }) {
  if (cles.length === 0) return <p className="muted small">{espacesFines(vide)}</p>
  return (
    <ul className="exp-jetons">
      {ditDesCartes(cles).map(t => (
        <li key={t} className="exp-jeton">
          {t}
        </li>
      ))}
    </ul>
  )
}

/** Ce qui reste d'un tas quand on en ôte d'autres, chaque carte autant de fois qu'elle y est. */
function sans(tas: readonly string[], otees: readonly string[]): string[] {
  const reste = [...tas]
  for (const cle of otees) {
    const i = reste.indexOf(cle)
    if (i >= 0) reste.splice(i, 1)
  }
  return reste
}

/**
 * Son courage, dans la barre : ce qui remplace les trois vies — un cœur,
 * combien, et sa jauge sur cinquante. Bas, il le dit en couleur.
 */
export function Courage({ n }: { n: number }) {
  const part = Math.round((Math.max(0, Math.min(COURAGE_MAX, n)) / COURAGE_MAX) * 100)
  return (
    <span className={'exp-courage' + (n <= COURAGE_MAX / 5 ? ' exp-courage-bas' : '')} role="img" aria-label={`${n} de courage sur ${COURAGE_MAX}`}>
      <Icon name="heart" />
      <b>{n}</b>
      <span className="exp-courage-jauge" aria-hidden="true">
        <i style={{ width: `${part}%` }} />
      </span>
    </span>
  )
}

// ── La main ─────────────────────────────────────────────────────────────────

export type JouerUneCarte = (cle: string, plus?: { categorie?: string; montre?: number }) => void

/** Une carte de la main : son coût au coin, son moment à l'autre, son dessin, son nom — on n'en voit que le haut. */
function CarteDeLaMain({ c, refus, enPetit, onToucher }: { c: CarteDeRencontre; refus: string | null; enPetit?: boolean; onToucher: () => void }) {
  return (
    <button
      type="button"
      className={'exp-carte-joker exp-carte-rencontre' + (refus ? ' exp-refuse' : '')}
      style={gemmeDeLaCarte(c)}
      data-carte={c.cle}
      aria-haspopup="dialog"
      onClick={onToucher}
    >
      {!enPetit && c.moment !== 'route' && (
        <span className="exp-cout" aria-hidden="true">
          {c.cout}
        </span>
      )}
      {!enPetit && <Icon name={SIGNE_DU_MOMENT[c.moment]} className="exp-signe-moment" />}
      <span className="exp-joker-dessin" aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <b className={enPetit ? 'sr-only' : 'exp-joker-nom'}>{c.nom}</b>
      <span className="sr-only">{`${c.moment !== 'route' ? `, ${c.cout} d’inspiration` : ''}, ${MOMENT_COURT[c.moment]}${refus ? ', pas maintenant' : ''}`}</span>
    </button>
  )
}

/**
 * La main d'une rencontre — ou, sur la carte, ses cartes de route en petit
 * (`enPetit`) : chaque carte au cadre de sa rareté, son coût d'inspiration au
 * coin. Touchée, elle se lève (`CarteLevee`) et dit ce qu'elle fait, puis
 * « Jouer » — ou pourquoi elle ne se joue pas maintenant, de la règle du
 * serveur (`refus`). Au bout, le dos de la pioche : touché, ses tas.
 */
export function MainDeRencontre({
  cles,
  refus,
  busy,
  enPetit,
  pile,
  onJouer,
  onMontrer,
}: {
  cles: readonly string[]
  refus: Readonly<Record<string, string | null>>
  busy: boolean
  enPetit?: boolean
  /** Le dos de la pioche — du paquet, sur la carte — : combien, ce qu'il dit à l'oreille, et ce qu'il ouvre. */
  pile: { compte: number; mot: string; dit: string; onOuvrir: () => void }
  onJouer: JouerUneCarte
  /** La Prédiction : il montre une réponse à l'Oracle, sur la question à l'écran. */
  onMontrer?: () => void
}) {
  const [levee, setLevee] = useState<number | null>(null)
  const cle = levee !== null ? cles[levee] : undefined
  return (
    <>
      <section className={'exp-main exp-main-rencontre' + (enPetit ? ' exp-main-en-petit' : '')} aria-label={enPetit ? 'Tes cartes de route' : 'Ta main'}>
        {cles.map((k, i) => {
          const c = carteDeRencontre(k)
          return c ? <CarteDeLaMain key={`${k}:${i}`} c={c} refus={refus[k] ?? null} enPetit={enPetit} onToucher={() => setLevee(i)} /> : null
        })}
        {cles.length === 0 && !enPetit && <p className="exp-main-vide">{espacesFines('Ta main est vide : la question suivante en tire cinq.')}</p>}
        <button type="button" className="exp-pioche" aria-haspopup="dialog" onClick={pile.onOuvrir}>
          <b aria-hidden="true">{pile.compte}</b>
          {!enPetit && <span aria-hidden="true">{pile.mot}</span>}
          <span className="sr-only">{pile.dit}</span>
        </button>
      </section>
      {cle && (
        <CarteLevee
          // Une autre carte levée repart de zéro : la catégorie du Commandement choisie n'est pas la sienne.
          key={`${cle}:${levee}`}
          cle={cle}
          refus={refus[cle] ?? null}
          busy={busy}
          onJouer={(c, plus) => {
            setLevee(null)
            onJouer(c, plus)
          }}
          onMontrer={
            onMontrer &&
            (() => {
              setLevee(null)
              onMontrer()
            })
          }
          onReposer={() => setLevee(null)}
        />
      )}
    </>
  )
}

/**
 * Une carte levée : en grand — son coût, sa rareté et sa famille, son dessin,
 * son nom, ce qu'elle fait, quand elle se joue —, puis le geste : la jouer, la
 * poser, choisir la catégorie du Commandement, montrer une réponse à
 * l'Oracle ; ou pourquoi elle ne se joue pas maintenant. Toucher à côté la
 * repose, Échap aussi : un toucher perdu ne coûte rien.
 */
export function CarteLevee({
  cle,
  refus,
  busy,
  onJouer,
  onMontrer,
  onReposer,
}: {
  cle: string
  refus: string | null
  busy: boolean
  onJouer: JouerUneCarte
  onMontrer?: () => void
  onReposer: () => void
}) {
  const boite = useRef<HTMLDivElement>(null)
  useModale(boite, onReposer)
  const [categorie, setCategorie] = useState<string | null>(null)
  const c = carteDeRencontre(cle)
  if (!c) return null
  const verbe = cle === 'prediction' ? 'Montrer une réponse à l’Oracle' : `${c.moment === 'pouvoir' ? 'Poser' : 'Jouer'} « ${c.nom} »`
  // Le Commandement choisit d'abord sa catégorie : douze pastilles sous la carte, qui se fait plus petite.
  const choix = !refus && cle === 'commandement'
  return (
    <div className="carte-voile exp-leve-voile" onClick={onReposer}>
      <div className={'exp-leve' + (choix ? ' exp-leve-avec-choix' : '')} role="dialog" aria-modal="true" aria-label={c.nom} ref={boite} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div className="exp-carte-joker exp-carte-levee exp-carte-rencontre" style={gemmeDeLaCarte(c)}>
          {c.moment !== 'route' && (
            <span className="exp-cout" role="img" aria-label={`Elle coûte ${c.cout} d’inspiration`}>
              {c.cout}
            </span>
          )}
          <span className="exp-joker-rarete">
            <i aria-hidden="true" />
            {`${RARETE_DE_LA_CARTE[c.rarete]} · ${FAMILLES_DE_CARTES[c.famille].nom}`}
          </span>
          <span className="exp-joker-dessin" aria-hidden="true">
            <VisageDeLaCarte c={c} />
          </span>
          <b className="exp-joker-nom">{c.nom}</b>
          <p className="exp-joker-effet">{espacesFines(c.effet)}</p>
          <span className="exp-joker-origine">{espacesFines(origineDeLaCarte(c))}</span>
        </div>
        {refus ? (
          <p className="exp-refus">{espacesFines(refus)}</p>
        ) : choix ? (
          <div className="exp-leve-choix">
            <p>{espacesFines('L’escale suivante, si c’est une rencontre, posera toutes ses questions en :')}</p>
            <div className="exp-categories" role="group" aria-label="La catégorie de l’escale suivante">
              {CATEGORIES.map(x => (
                <button key={x} type="button" className={'pill-btn' + (categorie === x ? ' active' : '')} aria-pressed={categorie === x} onClick={() => setCategorie(x)}>
                  {COURT[x] ?? x}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-block" aria-disabled={busy || !categorie || undefined} onClick={() => categorie && !busy && onJouer(cle, { categorie })}>
              {categorie ? `Jouer · ${categorie}` : 'Choisis une catégorie'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-block"
            aria-disabled={busy || undefined}
            onClick={() => {
              if (busy) return
              if (cle === 'prediction' && onMontrer) onMontrer()
              else onJouer(cle)
            }}
          >
            {verbe}
          </button>
        )}
        <button type="button" className="link-inline exp-reposer" onClick={onReposer}>
          Reposer la carte
        </button>
      </div>
    </div>
  )
}

/** Le cycle des cartes, en une fois : « on comprend pas bien ce qu'on a en main et comment les cartes reviennent » (le 18 octobre 2026). */
const REGLE_DU_CYCLE = `À chaque question, tu tires ${CARTES_PAR_QUESTION} cartes et tu as ${INSPIRATION_PAR_QUESTION} d’inspiration. Ce que tu ne joues pas part à la défausse ; ta pioche vide, ta défausse y revient. Une carte épuisée revient à la rencontre suivante, un pouvoir agit jusqu’au bout de la rencontre, et chaque rencontre remélange tout ton paquet. Les cartes de route se jouent sur la carte, une fois par acte.`

/**
 * Ses tas, quand il touche la pioche : en rencontre, les pouvoirs posés, ce
 * qui reste à tirer — tout son paquet de combat, moins ce qui a servi : sa
 * composition se déduit, son ordre reste au serveur —, sa défausse, ses
 * épuisées ; puis tout son paquet, et la règle du cycle.
 */
export function FeuilleDesCartes({ paquet, rencontre, onFermer }: { paquet: readonly string[]; rencontre?: VueDeLaRencontre; onFermer: () => void }) {
  const pioche = rencontre ? sans(cartesDeCombat(paquet), [...rencontre.main, ...rencontre.defausse, ...rencontre.epuisees, ...rencontre.pouvoirs]) : []
  const pouvoirs = (rencontre?.pouvoirs ?? []).map(cle => carteDeRencontre(cle)).filter((c): c is CarteDeRencontre => !!c)
  return (
    <Feuille titre={rencontre ? 'Tes cartes' : 'Ton paquet'} className="feuille-paquet" onFermer={onFermer}>
      {pouvoirs.length > 0 && (
        <section className="exp-main-section">
          <h3 className="label">Posées pour la rencontre</h3>
          <ul className="exp-poses-liste">
            {pouvoirs.map(c => (
              <li key={c.cle}>
                <b>{c.nom}</b> <span className="muted small">{espacesFines(c.effet)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {rencontre && (
        <>
          <section className="exp-main-section">
            <h3 className="label">{`Ta pioche · ${rencontre.pioche}`}</h3>
            <JetonsDeCartes cles={pioche} vide="Ta pioche est vide : ta défausse y revient à la question suivante." />
          </section>
          <section className="exp-main-section">
            <h3 className="label">{`Ta défausse · ${rencontre.defausse.length}`}</h3>
            <JetonsDeCartes cles={rencontre.defausse} vide="Rien en défausse." />
          </section>
          {rencontre.epuisees.length > 0 && (
            <section className="exp-main-section">
              <h3 className="label">{`Épuisées jusqu’à la rencontre suivante · ${rencontre.epuisees.length}`}</h3>
              <JetonsDeCartes cles={rencontre.epuisees} vide="" />
            </section>
          )}
        </>
      )}
      <section className="exp-main-section">
        <h3 className="label">{`Tout ton paquet · ${paquet.length}`}</h3>
        <JetonsDeCartes cles={paquet} vide="Ton paquet est vide." />
      </section>
      <p className="muted small">{espacesFines(REGLE_DU_CYCLE)}</p>
    </Feuille>
  )
}

// ── La rencontre ────────────────────────────────────────────────────────────

/**
 * L'adversaire, en tête de la rencontre : l'emblème de sa catégorie — de son
 * thème pointu, le médaillon d'un gardien —, son nom, ses sceaux qui restent,
 * et ce qu'il frappe à la prochaine erreur. `sceaux` : ceux qui restent après
 * la réponse, à la révélation.
 */
export function Adversaire({ r, gardien, acte, sceaux, compact }: { r: VueDeLaRencontre; gardien: string; acte: number; sceaux?: number; compact?: boolean }) {
  const restants = Math.max(0, sceaux ?? r.sceaux)
  const sujet = r.sujet ? sujetParCle(r.sujet) : undefined
  const theme = sujet?.nom ?? r.categorie ?? 'Mélange'
  const surtitre = r.sorte === 'gardien' ? `Gardien · acte ${acte + 1}` : r.sorte === 'elite' ? `Élite · ${theme}` : theme
  const part = r.max > 0 ? Math.round((restants / r.max) * 100) : 0
  const s = restants > 1 ? 'x' : ''
  return (
    <section
      // Compact, la question sous les yeux : la question et ses réponses d'abord, la main encore en vue.
      className={`exp-adversaire exp-adversaire-${r.sorte}` + (restants === 0 ? ' exp-adversaire-tombe' : '') + (compact ? ' exp-adversaire-compact' : '')}
      aria-label={espacesFines(`${surtitre} : ${r.adversaire}, ${restants} sceau${s} sur ${r.max} ; il frappe ${r.frappe} si tu te trompes`)}
    >
      <span className="exp-adversaire-embleme" aria-hidden="true">
        {r.sorte === 'gardien' ? (
          <span className="exp-medaillon">
            <Dessin cle={gardien} />
          </span>
        ) : (
          <Icon name={sujet ? iconeDuSujet(sujet) : r.categorie ? (EMBLEME[r.categorie] ?? 'swords') : 'shuffle'} />
        )}
      </span>
      <span className="exp-adversaire-texte" aria-hidden="true">
        <span className="label">{surtitre}</span>
        <b className="exp-adversaire-nom">{r.sorte === 'gardien' ? nomDuGardien(gardien) : r.adversaire}</b>
        <span className="exp-sceaux">
          <span className="exp-sceaux-jauge">
            <i style={{ width: `${part}%` }} />
          </span>
          <b>{restants === 0 ? 'tombé' : `${restants} sceau${s}`}</b>
        </span>
      </span>
      <span className="exp-intention" aria-hidden="true">
        <Icon name="swords" />
        <b>{r.frappe}</b>
      </span>
    </section>
  )
}

/**
 * Ce que le tour a sous la main : son inspiration, sa Charge, sa Garde, sa
 * série — et les pouvoirs posés ; `compact`, la question sous les yeux, leur
 * seul dessin : une ligne, pas deux.
 */
export function EtatDuTour({ r, compact }: { r: VueDeLaRencontre; compact?: boolean }) {
  const pouvoirs = r.pouvoirs.map(cle => carteDeRencontre(cle)).filter((c): c is CarteDeRencontre => !!c)
  return (
    <ul className={'exp-tour' + (compact ? ' exp-tour-compact' : '')} aria-label="Ce tour">
      <li className="exp-tour-inspiration">
        <Icon name="spark" />
        <b>{r.inspiration}</b>
        <span>d’inspiration</span>
      </li>
      {r.charge > 0 && (
        <li>
          <Icon name="target" />
          <b>{`+${r.charge}`}</b>
          <span>Charge</span>
        </li>
      )}
      {r.garde > 0 && (
        <li>
          <Icon name="shield" />
          <b>{r.garde}</b>
          <span>Garde</span>
        </li>
      )}
      {r.serie > 0 && (
        <li>
          <Icon name="zap" />
          <b>{r.serie}</b>
          <span>{r.serie > 1 ? 'd’affilée' : 'de série'}</span>
        </li>
      )}
      {pouvoirs.map(c => (
        <li key={c.cle} className="exp-tour-pouvoir" style={gemmeDeLaCarte(c)}>
          <span className="exp-tour-visage" aria-hidden="true">
            <VisageDeLaCarte c={c} />
          </span>
          <span className={compact ? 'sr-only' : undefined}>{c.nom}</span>
        </li>
      ))}
    </ul>
  )
}

const FORME_DITE: Record<FormeDEscale, string> = { quatre: 'quatre choix', six: 'six choix', 'vrai-faux': 'vrai ou faux', devoilement: 'mot à mot' }

/** L'annonce de la question qui vient, avant de la voir : sa catégorie, sa marche, sa forme, ce qu'on répond — et sa chance. Jamais son texte (invariant 1). */
export function Annonce({ a }: { a: AnnonceDuTour }) {
  // « Chiffrées » : la règle des nombres (celle de la Prédiction) compte aussi « Apollo 11 » — ce n'est pas toujours un nombre à trouver.
  const en = a.reponseEn === 'annee' ? 'réponse : une année' : a.reponseEn === 'nombre' ? 'réponses chiffrées' : null
  return (
    <section className="exp-annonce" aria-labelledby="exp-annonce-titre">
      <h2 className="label" id="exp-annonce-titre">
        La question qui vient
      </h2>
      <p className="exp-annonce-quoi">
        <Icon name={a.categorie ? (EMBLEME[a.categorie] ?? 'help') : 'shuffle'} />
        <span className="exp-annonce-texte">
          <b>{a.categorie ?? 'Une catégorie au hasard'}</b>
          <span className="muted small">{espacesFines([NOM_NIVEAU[a.niveau], FORME_DITE[a.forme], en].filter(Boolean).join(' · '))}</span>
        </span>
        {a.chance !== undefined && (
          <span className="exp-annonce-chance">
            <Balise couleur={couleurDePiste(a.chance)} />
            {pourcents(a.chance)}
          </span>
        )}
      </p>
    </section>
  )
}

/**
 * L'aperçu du verdict, avant de répondre : ce qu'une bonne réponse briserait
 * — au dévoilement, du premier mot au dernier —, s'il tombe, ce que la mise
 * rapporterait ; ce qu'une erreur coûterait, la Garde comptée. La même règle
 * que le verdict (`apercuDuTour`).
 */
export function Apercu({ a }: { a: ApercuDuTour }) {
  const j = a.juste
  const f = a.faux
  const sceaux = (n: number) => `${n} sceau${n > 1 ? 'x' : ''}`
  const brises = j.auPremierMot !== undefined ? `de ${sceaux(j.auPremierMot)} au premier mot à ${j.brises} au dernier` : sceaux(j.brises)
  const juste = [`tu brises ${brises}`, j.tombe && 'il tombe', j.ecus > 0 && `+${j.ecus} écus`].filter(Boolean).join(' · ')
  const coup =
    f.frappe === 0
      ? 'il ne te frappe pas'
      : f.perdu === 0
        ? `il frappe ${f.frappe}, ta Garde prend tout`
        : f.absorbee > 0
          ? `il frappe ${f.frappe}, ta Garde en prend ${f.absorbee} : −${f.perdu} de courage`
          : `il frappe : −${f.perdu} de courage`
  const faux = [coup, f.ecus > 0 && `−${f.ecus} écus`, f.contre > 0 && `Contre-attaque : ${sceaux(f.contre)}`].filter(Boolean).join(' · ')
  return (
    <div className="exp-apercu" role="group" aria-label="Ce que ta réponse fera">
      <p className="exp-apercu-juste">
        <Icon name="check" />
        <span>
          <b>Juste</b>
          {espacesFines(` : ${juste}`)}
        </span>
      </p>
      <p className="exp-apercu-faux">
        <Icon name="swords" />
        <span>
          <b>Faux</b>
          {espacesFines(` : ${faux}`)}
        </span>
      </p>
    </div>
  )
}

/** Ses mises, avant de voir la question : rien, 10, 25, 50 écus. Une mise qu'il ne peut pas payer s'éteint, et dit pourquoi au toucher. */
function Mises({ mises, choisie, onChoisir }: { mises: Readonly<Record<number, string | null>>; choisie: number; onChoisir: (mise: number, refus: string | null) => void }) {
  return (
    <div className="exp-mises" role="radiogroup" aria-labelledby="exp-mises-titre">
      <span className="label" id="exp-mises-titre">
        Ta mise
      </span>
      {MISES.map(m => {
        const refus = mises[m] ?? null
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={choisie === m}
            aria-disabled={refus !== null || undefined}
            className={'exp-mise' + (choisie === m ? ' exp-choisi' : '') + (refus !== null ? ' exp-refuse' : '')}
            onClick={() => onChoisir(m, refus)}
          >
            {m === 0 ? (
              'Rien'
            ) : (
              <>
                <Icon name="ecu" />
                {m}
                <span className="sr-only"> écus</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * La préparation d'une question (le cœur du prototype) : l'adversaire, ce que
 * le tour a sous la main, l'annonce, l'aperçu à la mise choisie, la mise, puis
 * « Voir la question » ; dessous, la main — ses cartes de préparation et ses
 * pouvoirs se jouent ici, avant de voir. La question, tirée au serveur,
 * n'arrive qu'au geste qui la voit (invariant 1).
 */
export function PreparationDeLaRencontre({
  vue,
  r,
  barre,
  busy,
  erreur,
  onJouer,
  onVoir,
}: {
  vue: VueDeLExpedition
  r: VueDeLaRencontre
  /** La barre du haut : « ← Partir », les écus, le courage. */
  barre: ReactNode
  busy: boolean
  erreur: string
  onJouer: JouerUneCarte
  onVoir: (mise: number) => void
}) {
  const [mise, setMise] = useState(0)
  const [dit, setDit] = useState<string | null>(null)
  const [tas, setTas] = useState(false)
  const gardien = vue.gardiens[Math.min(vue.acte, vue.gardiens.length - 1)]?.cle ?? ''
  const a = r.annonce
  const refus = r.mises?.[mise] ?? null
  // L'aperçu à la mise choisie, par la règle du serveur : celui de la vue est à mise nulle, la mise n'étant dite qu'en voyant la question.
  const apercu = a
    ? apercuDuTour({
        tour: { charge: r.charge, garde: r.garde, mise, jouees: r.jouees },
        pouvoirs: r.pouvoirs,
        sceaux: r.sceaux,
        frappe: r.frappe,
        savoir: a.savoir,
        question: { reponses: a.reponses, forme: a.forme, categorie: a.categorie },
        ...(vue.fetiche && { fetiche: vue.fetiche }),
        ...(a.mots !== undefined && { mots: a.mots }),
      })
    : r.apercu
  const motif = dit ?? refus
  return (
    <div className="player-shell expedition exp-rencontre">
      {barre}
      <Adversaire r={r} gardien={gardien} acte={vue.acte} />
      <EtatDuTour r={r} />
      {a && <Annonce a={a} />}
      {apercu && <Apercu a={apercu} />}
      <Mises
        mises={r.mises ?? {}}
        choisie={mise}
        onChoisir={(m, refusDeM) => {
          setDit(refusDeM)
          if (refusDeM === null) setMise(m)
        }}
      />
      {motif && (
        <p className="exp-refus small" role="status">
          {espacesFines(motif)}
        </p>
      )}
      {erreur && (
        <p className="error" role="alert">
          {espacesFines(erreur)}
        </p>
      )}
      {/* La mise se lit au-dessus, choisie, et dans l'aperçu : le bouton garde ses trois mots — « · 10 écus misés » sortait du bouton en 360 × 640. */}
      <button type="button" className="btn btn-primary btn-big btn-block exp-voir" aria-disabled={busy || refus !== null || undefined} onClick={() => !busy && refus === null && onVoir(mise)}>
        <Icon name="eye" />
        Voir la question
      </button>
      <MainDeRencontre
        cles={r.main}
        refus={r.refus}
        busy={busy}
        pile={{ compte: r.pioche, mot: 'pioche', dit: `Ta pioche : ${r.pioche} carte${r.pioche > 1 ? 's' : ''}, ta défausse : ${r.defausse.length}`, onOuvrir: () => setTas(true) }}
        onJouer={onJouer}
      />
      {tas && <FeuilleDesCartes paquet={vue.cartes?.paquet ?? []} rencontre={r} onFermer={() => setTas(false)} />}
    </div>
  )
}

/**
 * Ce qu'une réponse vient de faire en rencontre, à la révélation : le titre —
 * ce qu'elle a brisé, l'adversaire qui tombe, la frappe — et ses lignes — la
 * Garde, le courage, la mise, la victoire.
 */
export function verdictDeLaRencontre(c: CoupDeRencontre, adversaire: string, finie: boolean): { titre: string; lignes: string[] } {
  const sceaux = (n: number) => `${n} sceau${n > 1 ? 'x' : ''}`
  if (c.traversee) return { titre: 'Traversée : ni frappe, ni sceaux', lignes: ['La question part à ton carnet.'] }
  if (c.juste) {
    return {
      titre: c.victoire ? `${adversaire} tombe !` : `Juste : ${sceaux(c.brises)} de moins`,
      lignes: [
        c.victoire && `${sceaux(c.brises)} brisés d’un coup`,
        c.mise > 0 && `+${c.mise} écus de ta mise`,
        c.victoire && c.victoire.ecus > 0 && `+${c.victoire.ecus} écus de la victoire`,
        c.victoire && c.victoire.courage > 0 && `+${c.victoire.courage} de courage, à l’aube`,
      ].filter((x): x is string => !!x),
    }
  }
  const titre = finie
    ? 'Raté… ton courage est à bout'
    : c.renaissance
      ? `Raté… Renaissance : tu renais avec ${COURAGE_DE_LA_RENAISSANCE} de courage`
      : c.frappe === 0
        ? 'Raté… il ne te frappe pas'
        : c.perdu === 0
          ? `Raté… ta Garde prend toute sa frappe`
          : `Raté… il frappe : −${c.perdu} de courage`
  return {
    titre,
    lignes: [
      c.frappe > 0 && c.absorbee > 0 && c.perdu > 0 && `Sa frappe de ${c.frappe}, ta Garde en a pris ${c.absorbee}`,
      c.brises > 0 && `Contre-attaque : ${sceaux(c.brises)} brisés`,
      c.mise < 0 && `−${-c.mise} écus de ta mise`,
      c.victoire && `${adversaire} tombe quand même !`,
    ].filter((x): x is string => !!x),
  }
}

/** Ce qu'une carte jouée vient de faire, quand l'écran ne le montre pas de lui-même ; null : il le dit déjà. */
export function ceQueLaCarteAFait(cle: string): string | null {
  const c = carteDeRencontre(cle)
  if (!c) return null
  if (c.moment === 'pouvoir') return cle === 'abysses' ? `« ${c.nom} » est posée : elle t’a coûté 6 de courage` : `« ${c.nom} » agit jusqu’au bout de la rencontre`
  if (cle === 'pioche') return 'Deux cartes de plus dans ta main'
  if (cle === 'feu-d-artifice') return 'Ta défausse revient dans ta pioche : trois cartes de plus'
  if (cle === 'horizon') return 'Ton courage te revient — et ta prochaine récompense sera vide'
  if (cle === 'reveil') return 'Deux d’inspiration de plus pour cette question'
  return null
}

// ── Le départ ──────────────────────────────────────────────────────────────

/** Le choix de partir aux rencontres, et sa catégorie fétiche : retenus sur le téléphone, sous try/catch — un stockage refusé ne doit rien bloquer. */
const CLE_DES_RENCONTRES = 'quizz.expedition.rencontres'
const CLE_DE_LA_FETICHE = 'quizz.expedition.fetiche'

/** Parti aux rencontres la dernière fois — d'office oui, c'est le prototype qu'on essaie. */
export function rencontresRetenues(): boolean {
  try {
    return localStorage.getItem(CLE_DES_RENCONTRES) !== 'non'
  } catch {
    return true
  }
}

export function feticheRetenue(): string | null {
  try {
    const lue = localStorage.getItem(CLE_DE_LA_FETICHE)
    return lue && (CATEGORIES as readonly string[]).includes(lue) ? lue : null
  } catch {
    return null
  }
}

export function retenirLesRencontres(oui: boolean, fetiche: string | null) {
  try {
    localStorage.setItem(CLE_DES_RENCONTRES, oui ? 'oui' : 'non')
    if (fetiche) localStorage.setItem(CLE_DE_LA_FETICHE, fetiche)
    else localStorage.removeItem(CLE_DE_LA_FETICHE)
  } catch {
    // Un stockage refusé : le prochain départ reproposera les rencontres, sans catégorie fétiche.
  }
}

/**
 * Au départ, là où le prototype s'ouvre (la préproduction) : partir aux
 * rencontres — d'office —, sa catégorie fétiche, que l'Érudit fait vivre, et
 * les familles que son équipée apporte aux récompenses.
 */
export function AuDepart({
  actif,
  fetiche,
  equipee,
  onActif,
  onFetiche,
}: {
  actif: boolean
  fetiche: string | null
  equipee: readonly string[]
  onActif: (oui: boolean) => void
  onFetiche: (categorie: string | null) => void
}) {
  const [choisir, setChoisir] = useState(false)
  const familles = famillesDeLEquipee(equipee)
  return (
    <section className="card exp-prototype" aria-labelledby="exp-prototype-titre">
      <div className="exp-section-tete">
        <h2 className="label" id="exp-prototype-titre">
          Les rencontres
          <span className="exp-pastille exp-pastille-or">prototype</span>
        </h2>
        <button type="button" role="switch" aria-checked={actif} aria-labelledby="exp-prototype-titre" className="exp-interrupteur" onClick={() => onActif(!actif)}>
          <i aria-hidden="true" />
        </button>
      </div>
      <p className="small">
        {espacesFines(
          actif
            ? 'Chaque escale à question est un adversaire à faire tomber, question après question. Avant de voir chaque question, tu prépares tes cartes et ta mise ; ton courage remplace tes trois vies.'
            : 'Coupées : l’expédition part aux règles d’avant, trois vies et des jokers.',
        )}
      </p>
      {actif && (
        <>
          <div className="exp-section-tete">
            <span className="small">
              {'Ta catégorie fétiche : '}
              <b>{fetiche ?? 'aucune'}</b>
            </span>
            <button type="button" className="link-inline small exp-changer" aria-haspopup="dialog" onClick={() => setChoisir(true)}>
              {fetiche ? 'Changer' : 'Choisir'}
              <Icon name="chevron-right" />
            </button>
          </div>
          <p className="muted small">
            {espacesFines(
              familles.length > 0
                ? `Tes familles : ${familles.map(f => FAMILLES_DE_CARTES[f].nom).join(' et ')} — tes récompenses en proposent les cartes.`
                : 'Sans légendaire dans ton équipée, tes récompenses ne proposent que des cartes neutres.',
            )}
          </p>
        </>
      )}
      {choisir && <FeuilleDeLaFetiche fetiche={fetiche} onChoisir={onFetiche} onFermer={() => setChoisir(false)} />}
    </section>
  )
}

/** Sa catégorie fétiche, en feuille : les douze, leur emblème ; touchée encore, plus aucune. Rien ne change avant « Choisir ». */
function FeuilleDeLaFetiche({ fetiche, onChoisir, onFermer }: { fetiche: string | null; onChoisir: (categorie: string | null) => void; onFermer: () => void }) {
  const [choisie, setChoisie] = useState(fetiche)
  return (
    <Feuille
      titre="Ta catégorie fétiche"
      className="feuille-fetiche"
      onFermer={onFermer}
      pied={
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            onChoisir(choisie)
            onFermer()
          }}
        >
          {choisie ? `Choisir · ${choisie}` : 'Partir sans catégorie fétiche'}
        </button>
      }
    >
      <p className="muted small">{espacesFines('L’Érudit en vit : Plume charge tes réponses de ta catégorie fétiche, Bibliothèque leur fait briser trois sceaux de plus.')}</p>
      <div className="exp-fetiches" role="radiogroup" aria-label="Ta catégorie fétiche">
        {CATEGORIES.map(x => (
          <button key={x} type="button" role="radio" aria-checked={choisie === x} className={'exp-fetiche' + (choisie === x ? ' exp-choisi' : '')} onClick={() => setChoisie(choisie === x ? null : x)}>
            <Icon name={EMBLEME[x] ?? 'help'} />
            <span>{x}</span>
          </button>
        ))}
      </div>
    </Feuille>
  )
}

/**
 * Toutes les cartes des rencontres, dans la feuille de l'équipée : les
 * neutres, puis chaque famille — sa devise, ses deux cartes, et celles des
 * légendaires qui l'apportent : à lui, l'invité du jour, ou à gagner.
 */
export function ToutesLesCartes({ siens, invite }: { siens: ReadonlySet<string>; invite: string }) {
  const ligne = (c: CarteDeRencontre) => (
    <li key={c.cle} className="exp-joker-du-catalogue">
      <span className="exp-offre-visage" style={gemmeDeLaCarte(c)} aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="exp-joker">
        <b>{c.nom}</b>
        <span className="muted small">
          {[
            c.moment !== 'route' && `${c.cout} d’inspiration`,
            MOMENT_COURT[c.moment],
            RARETE_DE_LA_CARTE[c.rarete],
            c.legendaire && (siens.has(c.legendaire) ? 'à toi' : c.legendaire === invite ? 'l’invité du jour' : `${nomDuGardien(c.legendaire)}, à gagner`),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="small">{espacesFines(c.effet)}</span>
      </span>
    </li>
  )
  const familles = Object.keys(FAMILLES_DE_CARTES).filter((f): f is FamilleDeCartes => f !== 'neutre')
  return (
    <div id="exp-toutes-les-cartes" className="exp-catalogue">
      <h3 className="label">{`${FAMILLES_DE_CARTES.neutre.nom} · ${FAMILLES_DE_CARTES.neutre.devise}`}</h3>
      <ul>{CARTES_DES_RENCONTRES.filter(c => c.famille === 'neutre').map(ligne)}</ul>
      {familles.map(f => (
        <section key={f}>
          <h3 className="label">{`${FAMILLES_DE_CARTES[f].nom} · « ${FAMILLES_DE_CARTES[f].devise} »`}</h3>
          <ul>{CARTES_DES_RENCONTRES.filter(c => c.famille === f).map(ligne)}</ul>
        </section>
      ))}
    </div>
  )
}

/** Ce qu'une carte montre dans une ligne d'offre ou d'étal : son visage au cadre de sa rareté, son nom et sa rareté, son effet, quand elle se joue. */
export function LigneDeCarte({ c, prix }: { c: CarteDeRencontre; prix?: ReactNode }) {
  return (
    <>
      <span className="exp-offre-visage" style={gemmeDeLaCarte(c)} aria-hidden="true">
        <VisageDeLaCarte c={c} />
      </span>
      <span className="exp-joker">
        <span className="exp-offre-nom">
          <b>{c.nom}</b>
          <span className={`exp-rarete exp-rarete-${c.rarete}`}>{RARETE_DE_LA_CARTE[c.rarete]}</span>
        </span>
        <span className="small">{espacesFines(c.effet)}</span>
        <span className="muted small">{espacesFines([c.moment !== 'route' && `${c.cout} d’inspiration`, MOMENT[c.moment]].filter(Boolean).join(' · '))}</span>
      </span>
      {prix}
    </>
  )
}
