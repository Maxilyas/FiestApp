import { useEffect, useId, useState, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Avatar } from './Avatar'
import { api } from '../api'
import { porterNiche } from '../niche'
import { niveauVu, retenirLeNiveau } from '../niveauVu'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { gemme } from '../gemmes'
import { apercuDe } from '../apercus'
import { espacesFines, formatNumber } from '../format'
import { collectionGagnee, COLLECTION } from '../../../shared/avatars'
import { GERBES } from '../../../shared/gerbes'
import { NOM_FINITION, finitionsOuvertes, type Finition, type PublicProfile } from '../../../shared/profil'
import { DE_LA_PIERRE, pierreGagnee } from '../../../shared/pierres'
import { Niveau as Pastille } from './Niveau'
import { TROPHEES_MONTRES, totalDeLXp, type ObjetAPorter, type PartDeLXp, type TropheeTombe } from '../../../shared/gains'

// L'écran de gains, le même dans chaque mode (l'écran A, choisi par le
// propriétaire le 13 octobre 2026) — la fin d'une soirée, d'une partie du
// quiz du jour, d'une série, d'un défi, d'un duel, d'une épreuve ou d'une
// étape : « Ce que tu gagnes », l'expérience en un total, ce qui la fait, les
// confettis et le niveau ; « Nouveaux trophées », trois au plus, les plus
// rares d'abord, chacun menant à sa page de l'album ; « À porter », ce qu'ils
// ouvrent, à essayer dans la loge. Chaque fin le disait à sa façon, et l'on
// ne savait plus ce qu'on avait gagné, ni où le retrouver (le retour reçu par
// le propriétaire : « c'est très confus »). Les règles sont pures
// (`shared/gains.ts`) ; les légendaires, les Divins, l'Éclat, la page du
// calendrier et les portraits gardent leur grande carte : c'est la nouvelle.

// ── Le niveau ─────────────────────────────────────────────────────────────

// Le dernier niveau que la page a vu vit dans un module léger (`niveauVu.ts`) :
// le musée du Cabinet le retient à son ouverture sans télécharger cet écran.
// Les pages qui ont déjà l'écran des gains le retiennent par lui.
export { retenirLeNiveau }

/**
 * Ce que l'écran de gains sait du niveau : celui d'après la partie, celui
 * d'avant s'il le sait, et où il en est dans le suivant — sans lui, pas de
 * barre : une fin de soirée relue des jours après ne sait plus que sa montée.
 */
export interface NiveauDeLaFin {
  niveau: number
  acquis?: number
  requis?: number
  avant: number | null
}

/** Le niveau d'un profil relu après la partie, et celui d'avant qu'on connaît. */
export const niveauDe = (p: Pick<PublicProfile, 'niveau' | 'acquis' | 'requis'>, avant: number | null): NiveauDeLaFin => ({
  niveau: p.niveau,
  acquis: p.acquis,
  requis: p.requis,
  avant,
})

/**
 * Le niveau relu après une fin de série, d'épreuve ou de duel — ces pages
 * n'ont que le profil léger d'avant — et celui que la page avait vu. Le quiz
 * du jour la montrait ; la campagne ne disait que « +12 XP », et l'on ne
 * voyait pas qu'on avançait (le 6 octobre 2026). Muet, rien : la fin reste
 * lisible sans lui. Le même profil relu donne à la niche la forme que la
 * partie a fait atteindre à son compagnon : il en sort pour la montrer
 * (`client/src/niche.ts`).
 */
export function useNiveauRelu(actif = true): NiveauDeLaFin | null {
  // Le niveau d'avant se lit au premier rendu : la relecture le remplace.
  const [avant] = useState(() => niveauVu())
  const [lu, setLu] = useState<PublicProfile | null>(null)
  useEffect(() => {
    if (!actif) return
    let vivant = true
    api.joueur
      .moiLeger()
      .then(({ profile }) => {
        if (!vivant || !profile) return
        retenirLeNiveau(profile.niveau)
        setLu(profile)
        porterNiche(profile)
      })
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [actif])
  return lu ? niveauDe(lu, avant) : null
}

/** Les finitions qu'une montée de niveau vient d'ouvrir — portées d'office. */
export function finitionsNeuves(n: NiveauDeLaFin | null): Finition[] {
  if (!n || n.avant === null || n.niveau <= n.avant) return []
  const avant = finitionsOuvertes(n.avant)
  return finitionsOuvertes(n.niveau).filter(f => !avant.includes(f))
}

/**
 * La barre du niveau : elle part de vide et se remplit — une montée se voit,
 * c'est tout l'intérêt de l'avoir gagnée —, puis « Niveau 15 ! » et la
 * finition qu'il ouvre.
 */
function Niveau({ n }: { n: NiveauDeLaFin }) {
  const [plein, setPlein] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPlein(true), 250)
    return () => clearTimeout(t)
  }, [])
  const monte = n.avant !== null && n.niveau > n.avant
  const finitions = finitionsNeuves(n)
  const pierre = monte ? pierreGagnee(n.avant, n.niveau) : null
  const { acquis, requis } = n
  return (
    <div className="gains-niveau">
      {acquis !== undefined && requis !== undefined && (
        <>
          <div className="xp-bar" role="progressbar" aria-label={`Niveau ${n.niveau}`} aria-valuemin={0} aria-valuemax={requis || 1} aria-valuenow={requis > 0 ? acquis : 1}>
            <div className="xp-fill" style={{ width: plein ? `${requis > 0 ? Math.min(100, (acquis / requis) * 100) : 100}%` : '0%' }} />
          </div>
          <p className="muted small">
            {requis > 0 ? `Niveau ${n.niveau} · ${formatNumber(acquis)} / ${formatNumber(requis)} XP vers le niveau ${n.niveau + 1}` : `Niveau ${n.niveau} · au sommet`}
          </p>
        </>
      )}
      {monte && <p className="fin-monte">{`Niveau ${n.niveau} !`}</p>}
      {finitions.length > 0 && (
        <p className="gains-finition">
          Nouvelle finition : <b>{finitions.map(f => NOM_FINITION[f]).join(', ')}</b>
        </p>
      )}
      {/* Une dizaine passée, dès le 30 : la pastille que la salle voit change de pierre — elle se dit ici, montrée. */}
      {pierre && (
        <p className="gains-finition">
          Ta pastille de niveau se pare <b>{DE_LA_PIERRE[pierre]}</b> <Pastille niveau={n.niveau} />
        </p>
      )}
    </div>
  )
}

// ── Ce que tu gagnes ──────────────────────────────────────────────────────

/**
 * Ce que tu gagnes : l'expérience en un total — la partie, la série, les
 * trophées, tout ce que la barre vient de prendre —, ce qui la fait, en une
 * ligne, quand elle vient de plusieurs côtés ; les confettis ; le niveau.
 * Rien à compter, rien d'affiché : un « +0 » ressemblait à une panne.
 */
export function CeQueTuGagnes({ parts, confettis = 0, niveau, children }: { parts: readonly PartDeLXp[]; confettis?: number; niveau: NiveauDeLaFin | null; children?: ReactNode }) {
  const id = useId()
  const total = totalDeLXp(parts)
  if (total <= 0 && confettis <= 0) return null
  return (
    <section className="card gains" aria-labelledby={id}>
      <span className="label" id={id}>
        Ce que tu gagnes
      </span>
      <div className="gains-total">
        {total > 0 && <b className="num">{`+${formatNumber(total)} XP`}</b>}
        {confettis > 0 && (
          <span className="gains-confettis">
            <span aria-hidden="true">🎊</span>
            {` +${formatNumber(confettis)} confetti${confettis > 1 ? 's' : ''}`}
          </span>
        )}
      </div>
      {parts.length > 1 && <p className="gains-parts muted small">{parts.map(p => `${p.nom} +${formatNumber(p.xp)}`).join(' · ')}</p>}
      {children}
      {niveau && total > 0 && <Niveau n={niveau} />}
    </section>
  )
}

// ── Nouveaux trophées ─────────────────────────────────────────────────────

/** Les trois métaux d'une piste, allumés jusqu'au sien — ceux de l'album. */
function Metaux({ n }: { n: number }) {
  return (
    <span className="trophee-metaux" aria-hidden="true">
      {[1, 2, 3].map(m => (
        <i key={m} className={m <= n ? `metal-${m}` : undefined} />
      ))}
    </span>
  )
}

/** L'adresse de la page de l'album où retrouver un trophée. */
export const pageDeLAlbum = (t: Pick<TropheeTombe, 'page'>) => `/profil#collection-trophees-${t.page}`

/**
 * Un trophée tombé, en une ligne : son emoji dans le cercle de sa rareté —
 * celui de l'album —, son nom et ses métaux, ce qu'il a fallu, ce qu'il
 * rapporte. Avec un profil, la ligne mène à sa page de l'album.
 */
export function LigneDeTrophee({ t, lien }: { t: TropheeTombe; lien: boolean }) {
  const contenu = (
    <>
      <span className={'trophee-tombe-emoji' + (t.ton === 'ombre' ? ' trophee-tombe-ombre' : '')} aria-hidden="true">
        {t.emoji}
      </span>
      <span className="trophee-tombe-texte">
        <span className="trophee-tombe-titre">
          <b>{t.titre}</b>
          {t.metaux !== undefined && <Metaux n={t.metaux} />}
        </span>
        <span className="muted small">
          {espacesFines([t.detail, t.xp > 0 && `+${formatNumber(t.xp)} XP`, t.prix && 'un prix du palmarès'].filter(Boolean).join(' · '))}
        </span>
      </span>
      {lien && (
        <>
          <span className="sr-only"> : le voir dans ta collection</span>
          <Icon name="chevron-right" className="trophee-tombe-chevron" />
        </>
      )}
    </>
  )
  const style = gemme(t.rarete ?? 'offert')
  return lien ? (
    <a className="trophee-tombe" href={pageDeLAlbum(t)} style={style}>
      {contenu}
    </a>
  ) : (
    <div className="trophee-tombe" style={style}>
      {contenu}
    </div>
  )
}

/**
 * Nouveaux trophées : trois au plus, les plus rares d'abord — exploits, puis
 * coups du sort —, et « N autres » qui déplie le reste sur place. Avec un
 * profil, chaque ligne mène à sa page de l'album, et « Ma collection » en
 * tête. Le palier et Le Laurier d'une même victoire tombent sur une ligne
 * (`tropheesTombes`).
 */
export function NouveauxTrophees({ trophees, lien, titre = 'Nouveaux trophées', apres }: { trophees: readonly TropheeTombe[]; lien: boolean; titre?: string; apres?: ReactNode }) {
  const [tous, setTous] = useState(false)
  const id = useId()
  if (trophees.length === 0) return null
  const montres = tous ? trophees : trophees.slice(0, TROPHEES_MONTRES)
  const reste = trophees.length - montres.length
  return (
    <section className="card gains-trophees" aria-labelledby={id}>
      <div className="gains-tete">
        <span className="label" id={id}>
          {titre}
        </span>
        {lien && (
          <a className="link-inline small" href={pageDeLAlbum(trophees[0])}>
            Ma collection
          </a>
        )}
      </div>
      <div className="gains-liste">
        {montres.map(t => (
          <LigneDeTrophee key={t.cle} t={t} lien={lien} />
        ))}
      </div>
      {reste > 0 && (
        <button type="button" className="link-inline small gains-reste" onClick={() => setTous(true)}>
          {reste > 1 ? `Et ${reste} autres` : 'Et un autre'}
        </button>
      )}
      {apres}
    </section>
  )
}

// ── Les missions du jour ──────────────────────────────────────────────────

/** Les missions (`Missions.tsx`), à la demande : une page de jeu ne télécharge leur code qu'à sa fin, et pour un profil. */
const lesMissions = aLaDemande(() => import('./Missions'))

/**
 * Ce que la partie vient de faire de ses missions du jour, sous ce qu'elle a
 * gagné — « Mission accomplie », les trois et leur tampon —, le même à la fin
 * de chaque mode. Rien sans profil (`profil`), ni si elle n'en a fait aucune :
 * la fin reste la même.
 */
export function MissionsAccomplies({ profil }: { profil: boolean }) {
  const module = useALaDemande(lesMissions, profil)
  return profil && module && module !== 'perdu' ? <module.MissionsDeLaFin /> : null
}

// ── À porter ──────────────────────────────────────────────────────────────

const SORTE_A_PORTER: Record<ObjetAPorter['piece'] | 'avatar', string> = { fond: 'Fond de carte', gerbe: 'Gerbe', theme: 'Thème', avatar: 'Avatar de collection' }

/** Ce qu'une montée de niveau ouvre à porter : les emojis de collection — réservés aux profils, un à chaque niveau qui n'ouvre pas de finition. */
export function emojisAPorter(n: NiveauDeLaFin | null): ObjetAPorterOuEmoji[] {
  if (!n || n.avant === null || n.niveau <= n.avant) return []
  return collectionGagnee(n.avant, n.niveau).map(e => ({
    piece: 'avatar' as const,
    cle: e,
    nom: 'Un nouvel avatar',
    par: `le niveau ${COLLECTION.find(c => c.emoji === e)?.niveau ?? n.niveau}`,
  }))
}

export type ObjetAPorterOuEmoji = ObjetAPorter | { piece: 'avatar'; cle: string; nom: string; par: string }

/** L'aperçu d'un objet à porter : le fond en vignette, la gerbe en trois particules, le thème en photo, l'emoji tel quel. */
function Apercu({ o }: { o: ObjetAPorterOuEmoji }) {
  if (o.piece === 'fond') return <span className={`fond-apercu carte-fond fond-${o.cle}`} />
  if (o.piece === 'gerbe') return <span className="gerbe-apercu">{GERBES.find(g => g.key === o.cle)?.particules.slice(0, 3).join('') ?? '🎉'}</span>
  if (o.piece === 'theme') {
    const image = apercuDe(o.cle)
    return image ? <img src={image} alt="" width={36} height={45} loading="lazy" decoding="async" /> : <Icon name="palette" />
  }
  return <Avatar avatar={o.cle} />
}

/** L'adresse qui l'essaie dans la loge : `/profil?essayer=nuit#fond`. */
export const adresseDeLEssai = (o: ObjetAPorterOuEmoji) => `/profil?essayer=${encodeURIComponent(o.cle)}#${o.piece}`

/**
 * À porter : ce que la partie vient d'ouvrir et qui se porte — un fond, une
 * gerbe, un thème, un emoji de collection —, avec ce qui l'a ouvert ;
 * « Essayer » ouvre la loge, l'essai déjà sur la carte. Rien ne s'enregistre
 * d'ici : on le voit avant de le porter, comme dans la loge.
 */
export function APorter({ objets, nu = false }: { objets: readonly ObjetAPorterOuEmoji[]; /** Dans une carte déjà : sans la sienne. */ nu?: boolean }) {
  const id = useId()
  if (objets.length === 0) return null
  return (
    <section className={(nu ? '' : 'card ') + 'gains-a-porter'} aria-labelledby={id}>
      <span className="label" id={id}>
        À porter
      </span>
      <ul className="a-porter">
        {objets.map(o => (
          <li key={`${o.piece}:${o.cle}`}>
            <span className={`a-porter-apercu a-porter-${o.piece}`} aria-hidden="true">
              <Apercu o={o} />
            </span>
            <span className="a-porter-texte">
              <b>{o.nom}</b>
              <span className="muted small">{espacesFines(`${SORTE_A_PORTER[o.piece]} · par ${o.par}`)}</span>
            </span>
            <a className="btn btn-small a-porter-essayer" href={adresseDeLEssai(o)} aria-label={`Essayer ${o.piece === 'avatar' ? `l’avatar ${o.cle}` : o.nom}`}>
              Essayer
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
