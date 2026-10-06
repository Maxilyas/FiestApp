import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { NomLaure } from './Laurier'
import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { CeQuIlRemplace, ChoixDeLEclat, DetailDivin, DetailLegendaire } from './Carriere'
import { CarteJoueur } from './CarteJoueur'
import { Onglets } from './Onglets'
import { dessinDuPortrait, useDessins } from './medaillons'
import { espacesFines } from '../format'
import { rendreLeFocus } from '../focus'
import { AVATARS, COLLECTION } from '../../../shared/avatars'
import { hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { LEGENDAIRES, cibleEclat, legendaire } from '../../../shared/legendaires'
import { DIVINS, divin } from '../../../shared/divins'
import {
  BRANCHES,
  PORTRAITS,
  brancheDe,
  deLaBranche,
  nomDansLaPhrase,
  ouvertsDansLaBranche,
  portrait as portraitDe,
  portraitsOuverts,
  prochainDansLaBranche,
  type Branche,
  type CleDeBranche,
  type Paliers,
} from '../../../shared/branches'
import { FONDS } from '../../../shared/fonds'
import { GERBES } from '../../../shared/gerbes'
import { GerbeDeJuste } from './Gerbe'
import { cleDeMaitre, maitresDe, nomDuTitre } from '../../../shared/sentiers'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, brilleChez, type PublicProfileDetail } from '../../../shared/profil'
import type { ChoixDuProfil } from './choix'

// « Mon avatar », au profil : ce que la salle voit de lui, son visage —
// portraits des branches, emojis, légendaires, Divins, rangés par famille —,
// et sa finition ; puis, dans « Ma carte » et « Mon thème », son titre, son
// fond et sa gerbe.
//
// Tout cela, c'est l'avatar qu'on porte : une seule carte, un onglet par
// famille, des cases de la même taille ; un anneau de couleur dit ce qui est
// rare, et chaque case se touche de la même façon : sa fiche s'ouvre, et
// l'on porte l'avatar de là.

/**
 * L'anneau des emojis de collection passe du vert au bleu à partir du
 * niveau 10 : les premiers viennent en quelques soirées, les autres en une
 * année, et la grille le dit d'un coup d'œil.
 */
export const COLLECTION_HAUTE = 10

type Patch = Omit<ChoixDuProfil, 'vitrine'>

/**
 * Sa ligne telle que la salle la voit, dans les classements et la salle
 * d'attente : son visage, sa finition, son niveau. On change d'avatar
 * plus bas, et l'on se voit changer ici.
 */
export function ApercuSalle({ profil }: { profil: PublicProfileDetail }) {
  // Sa carte, telle que la salle l'ouvre en touchant son nom : il composait
  // titre, vitrine et fond sans jamais la voir.
  const [carte, setCarte] = useState(false)
  return (
    <section className="card apercu" aria-label="Ce que la salle voit">
      <span className="label">Ce que la salle voit</span>
      <div className="lb-row me apercu-ligne">
        <Avatar
          className="lb-avatar"
          avatar={profil.avatar}
          finition={profil.finition}
          eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))}
          legendaire={profil.legendaire ?? undefined}
        />
        {/* Sa ligne telle que la salle la voit : son laurier compris. */}
        <span className="lb-name">
          <NomLaure nom={profil.name} laurier={profil.laurier} />
        </span>
        <Niveau niveau={profil.niveau} />
      </div>
      <button type="button" className="btn btn-small apercu-carte" onClick={() => setCarte(true)}>
        <Icon name="eye" />
        Voir ma carte
      </button>
      {carte && <CarteJoueur adresse="/api/joueur/carte" onFermer={() => setCarte(false)} />}
    </section>
  )
}

/**
 * Les familles de « Mes avatars », dans l'ordre des onglets. Trois, pas
 * cinq : cinq onglets à compteur faisaient trois rangées au téléphone, un
 * tiers de l'écran avant le premier avatar. Les emojis de collection vivent
 * avec les emojis, les Divins avec les légendaires, chacun sous son titre.
 */
export type Famille = 'branches' | 'emojis' | 'legendaires'
const FAMILLES: { id: Famille; nom: string }[] = [
  { id: 'branches', nom: 'Branches' },
  { id: 'emojis', nom: 'Emojis' },
  { id: 'legendaires', nom: 'Légendaires' },
]

/**
 * La famille où « Mes avatars » s'ouvre : celle de l'avatar dessiné qu'il
 * porte — on vient souvent pour en changer, et « Le porter » est alors à
 * côté de ce qu'on quitte —, celle de son emoji de collection. Sous un emoji
 * de l'inscription, les branches : c'est là que ses bonnes réponses le
 * mènent.
 */
export function familleDe(profil: Pick<PublicProfileDetail, 'legendaire' | 'avatar'>): Famille {
  if (portraitDe(profil.legendaire)) return 'branches'
  if (legendaire(profil.legendaire) || divin(profil.legendaire)) return 'legendaires'
  if (COLLECTION.some(c => c.emoji === profil.avatar)) return 'emojis'
  return 'branches'
}

/**
 * Tous ses avatars, rangés par famille : les portraits des branches ; les
 * vingt-quatre emojis et les douze de collection ; les légendaires et les
 * six Divins. Cent quarante avatars ne se parcourent plus en une grille :
 * chaque famille a son onglet, et chaque partie son titre et son compte.
 *
 * Dans « Mon avatar » (`aMoi`), seulement ceux qu'il a : on y vient pour en
 * changer, et cent cases fermées noyaient les quarante qu'on peut porter. Ce
 * qui reste à gagner, et où, se lit dans « Ma collection ».
 *
 * Chacun se touche de la même façon : sa fiche s'ouvre sous sa rangée, et
 * l'on porte l'avatar de là (« Le porter ») — un emoji comme un portrait ou
 * un légendaire. Un emoji se portait d'un toucher, quand un avatar dessiné
 * ouvrait sa légende : la même grille répondait de deux façons. Le doigt qui
 * voulait voir la grenouille la portait déjà — enregistrée, montrée à la
 * salle — et ôtait le Phénix.
 */
export function MesAvatars({
  profil,
  busy,
  enregistrer,
  familleInitiale,
  aMoi = false,
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: Patch) => void
  /** La famille ouverte d'abord ; celle de l'avatar qu'il porte, par défaut (`familleDe`). */
  familleInitiale?: Famille
  /** Seulement ceux qu'il a : l'écran où l'on choisit. */
  aMoi?: boolean
}) {
  // Dans « Mon avatar », sous un emoji de l'inscription, ses emojis : c'est
  // ce qu'il porte, et ses branches n'y montrent que ce qu'il a — rien, au
  // premier jour.
  const [famille, setFamille] = useState<Famille>(() => {
    if (familleInitiale) return familleInitiale
    const f = familleDe(profil)
    return aMoi && f === 'branches' && !portraitDe(profil.legendaire) ? 'emojis' : f
  })
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Ce qui a éclaté brille, sauf ce qu'il a éteint : la grille et les fiches
  // montrent la version qu'il porte.
  const brille = (cle: string) => brilleChez(profil, cle)
  const choisirEclat = (cle: string) => (b: boolean) => enregistrer({ eclat: { cle, brille: b } })
  const divins = profil.divins ?? []
  const descendu = (cle: string) => divins.some(d => d.key === cle)
  const porte = profil.legendaire
  // Ses paliers validés sur les sentiers du savoir : ils ouvrent ses portraits.
  const paliers = profil.sentiers ?? {}
  const portraits = portraitsOuverts(paliers)
  const ouverts = COLLECTION.filter(c => profil.niveau >= c.niveau).length
  const possedes = portraits.length + AVATARS.length + ouverts + profil.legendaires.length + divins.length
  const total = PORTRAITS.length + AVATARS.length + COLLECTION.length + LEGENDAIRES.length + DIVINS.length
  const toucher = (cle: string) => setOuvert(o => (o === cle ? null : cle))
  // Ce que chaque grille montre : tout, ou ce qu'il a.
  const legendairesVus = LEGENDAIRES.filter(l => !aMoi || profil.legendaires.includes(l.key))
  const divinsVus = DIVINS.filter(d => !aMoi || descendu(d.key))
  // Changer de famille referme la fiche : elle parlait d'un avatar qu'on ne voit plus.
  const choisir = (f: Famille) => {
    setFamille(f)
    setOuvert(null)
  }
  // La fiche s'ouvre juste sous la case, et reçoit le focus sur son nom :
  // le lecteur d'écran la lit. La page ne défile que ce qu'il faut pour la
  // montrer entière, « Le porter » compris : la case touchée reste à
  // l'écran, juste au-dessus — le doigt qui parcourt la grille n'est pas
  // emporté.
  const detail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fiche = detail.current
    if (!ouvert || !fiche) return
    const nom = fiche.querySelector<HTMLElement>('.galerie-detail-nom')
    if (!nom) return
    nom.tabIndex = -1
    nom.focus({ preventScroll: true })
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const comportement = calme ? 'auto' : 'smooth'
    // La case et sa fiche ensemble, quand elles tiennent à l'écran : la
    // fiche refermée plus haut dans la grille fait remonter tout ce qui la
    // suit, et la fiche d'un légendaire, qui le montre en grand, est haute —
    // on touchait le Kraken, et la page le laissait au-dessus de l'écran.
    const laCase = fiche.previousElementSibling
    const haut = (laCase ?? fiche).getBoundingClientRect().top
    const bas = fiche.getBoundingClientRect().bottom
    if (laCase && haut < 0 && bas - haut <= window.innerHeight) {
      window.scrollBy({ top: haut - Math.min(8, window.innerHeight - (bas - haut)), behavior: comportement })
    } else {
      fiche.scrollIntoView({ block: 'nearest', behavior: comportement })
    }
  }, [ouvert])
  // Porté, un emoji n'a plus de bouton : le focus qui y était tombait sur la
  // page. Il revient au nom de la fiche.
  useEffect(() => {
    rendreLeFocus(detail.current, ['.galerie-detail-nom'])
  }, [porte, profil.avatar])
  // La fiche se glisse juste derrière la case touchée ; la grille, en
  // `dense`, finit la rangée et la pose dessous, de toute sa largeur
  // (`styles.css`). Sous toute la grille — 687 px en 360 × 640, plus haute
  // que l'écran —, elle s'ouvrait hors de la vue : toucher le Dragon
  // semblait ne rien faire.
  const fiche = (cle: string) =>
    ouvert === cle && (
      <div id="detail-avatar" className="fiche-case" ref={detail}>
        {portraitDe(cle) ? (
          <DetailPortrait
            cle={cle}
            paliers={paliers}
            porte={porte}
            eclat={profil.eclats.includes(cle)}
            brille={brille(cle)}
            busy={busy}
            onPorter={k => enregistrer({ legendaire: k })}
            onEclat={choisirEclat(cle)}
          />
        ) : legendaire(cle) ? (
          <DetailLegendaire
            cle={cle}
            debloques={profil.legendaires}
            eclats={profil.eclats}
            eteints={profil.eclatsEteints ?? []}
            porte={porte}
            hautsFaits={profil.hautsFaits}
            busy={busy}
            onPorter={l => enregistrer({ legendaire: l })}
            onEclat={choisirEclat(cle)}
            dessin={<Legendaire cle={cle} verrouille={!profil.legendaires.includes(cle)} eclat={brille(cle)} grand />}
          />
        ) : divin(cle) ? (
          <DetailDivin
            cle={cle}
            descendus={divins}
            porte={porte}
            busy={busy}
            onPorter={d => enregistrer({ legendaire: d })}
            dessin={<Divin cle={cle} verrouille={!descendu(cle)} grand />}
          />
        ) : (
          <DetailEmoji
            emoji={cle}
            avatar={profil.avatar}
            porte={porte}
            eclat={profil.eclats.includes(cle)}
            brille={brille(cle)}
            busy={busy}
            onPorter={a => enregistrer({ avatar: a })}
            onEclat={choisirEclat(cle)}
          />
        )}
      </div>
    )
  return (
    <section className="card">
      <h3>
        <Icon name="users" />
        Mes avatars <span className="muted small titre-compte">{aMoi ? `${possedes} à toi` : `${possedes} / ${total}`}</span>
      </h3>
      <p className="muted small">
        {espacesFines('Un seul à la fois : touche un avatar, puis « Le porter ». Un avatar dessiné dit aussi d’où il vient.')}
      </p>
      <Onglets
        onglets={FAMILLES}
        actif={famille}
        onChoisir={choisir}
        label="Familles d’avatars"
        idOnglet={f => `famille-${f}`}
        idPanneau={() => 'famille-avatars'}
        className="onglets-petits onglets-familles"
      />
      <div className="famille-avatars" role="tabpanel" id="famille-avatars" aria-labelledby={`famille-${famille}`}>
        {famille === 'branches' && (
          <>
            <h4 className="famille-titre">
              Les portraits des branches <span className="famille-compte">{`${portraits.length} / ${PORTRAITS.length}`}</span>
            </h4>
            <p className="muted small famille-note">
              Ils se gagnent sur les sentiers du savoir de la campagne : un portrait tous les deux paliers.{' '}
              <a className="link-inline" href="/campagne#sentiers">
                Les sentiers
              </a>
            </p>
            <MesBranches
              paliers={paliers}
              porte={porte}
              eclats={profil.eclats.filter(brille)}
              ouvert={ouvert}
              toucher={toucher}
              fiche={fiche}
              onDeplier={() => setOuvert(null)}
              aMoi={aMoi}
            />
          </>
        )}
        {famille === 'emojis' && (
          <>
            <h4 className="famille-titre">
              Les emojis <span className="famille-compte">{AVATARS.length}</span>
            </h4>
            <div className="emoji-grid grille-unique" role="group" aria-label="Les emojis">
              {AVATARS.map(a => {
                const choisi = !porte && a === profil.avatar
                return (
                  <Fragment key={a}>
                    <button
                      type="button"
                      className={'emoji-btn case-avatar' + (choisi ? ' selected' : '') + (ouvert === a ? ' ouverte' : '')}
                      // Il ouvre sa fiche, dessous, comme un avatar dessiné : un
                      // bouton qui déplie, plus un interrupteur.
                      aria-expanded={ouvert === a}
                      aria-controls={ouvert === a ? 'detail-avatar' : undefined}
                      aria-label={`Avatar ${a}${brille(a) ? ', éclaté' : ''}${choisi ? ', porté' : ''}`}
                      onClick={() => toucher(a)}
                    >
                      <Avatar avatar={a} finition={profil.finition} eclat={brille(a)} />
                    </button>
                    {fiche(a)}
                  </Fragment>
                )
              })}
            </div>
            {(!aMoi || ouverts > 0) && (
              <>
                <h4 className="famille-titre">
                  De collection <span className="famille-compte">{`${ouverts} / ${COLLECTION.length}`}</span>
                </h4>
                <p className="legende-anneaux small muted famille-note">
                  Un à chaque niveau qui n’ouvre pas de finition, réservés aux profils ·{' '}
                  <span className="puce anneau-texte-collection" aria-hidden="true">
                    ●
                  </span>{' '}
                  niveaux 2 à 9 ·{' '}
                  <span className="puce anneau-texte-collection-haut" aria-hidden="true">
                    ●
                  </span>{' '}
                  11 et plus
                </p>
                <div className="emoji-grid grille-unique" role="group" aria-label="De collection">
                  {COLLECTION.map(c => {
                    const anneau = c.niveau < COLLECTION_HAUTE ? ' anneau-collection' : ' anneau-collection-haut'
                    if (profil.niveau < c.niveau) {
                      // Sa silhouette et son niveau, rien à toucher : il n'a pas d'autre
                      // histoire que le niveau qui l'ouvre. Dans « Mon avatar », rien.
                      if (aMoi) return null
                      return (
                        <span
                          key={c.emoji}
                          className={'emoji-btn case-avatar ferme' + anneau}
                          role="img"
                          aria-label={`Emoji de collection, s’ouvre au niveau ${c.niveau}`}
                        >
                          <span className="silhouette" aria-hidden="true">
                            {c.emoji}
                          </span>
                          <span className="case-niveau" aria-hidden="true">
                            niv. {c.niveau}
                          </span>
                        </span>
                      )
                    }
                    const choisi = !porte && c.emoji === profil.avatar
                    return (
                      <Fragment key={c.emoji}>
                        <button
                          type="button"
                          className={'emoji-btn case-avatar' + anneau + (choisi ? ' selected' : '') + (ouvert === c.emoji ? ' ouverte' : '')}
                          aria-expanded={ouvert === c.emoji}
                          aria-controls={ouvert === c.emoji ? 'detail-avatar' : undefined}
                          aria-label={`Avatar ${c.emoji}, de collection${brille(c.emoji) ? ', éclaté' : ''}${choisi ? ', porté' : ''}`}
                          onClick={() => toucher(c.emoji)}
                        >
                          <Avatar avatar={c.emoji} finition={profil.finition} eclat={brille(c.emoji)} />
                        </button>
                        {fiche(c.emoji)}
                      </Fragment>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
        {famille === 'legendaires' && (
          <>
            <h4 className="famille-titre">
              Les légendaires <span className="famille-compte">{`${profil.legendaires.length} / ${LEGENDAIRES.length}`}</span>
            </h4>
            {legendairesVus.length === 0 && (
              <p className="muted small">Aucun encore : chacun se réveille par un exploit, en soirée, au quiz du jour ou en campagne.</p>
            )}
            <div className="emoji-grid grille-unique" role="group" aria-label="Les légendaires">
              {legendairesVus.map(l => {
                const gagne = profil.legendaires.includes(l.key)
                return (
                  <Fragment key={l.key}>
                    <button
                      type="button"
                      className={
                        'emoji-btn case-avatar anneau-legendaire' +
                        (gagne ? '' : ' ferme') +
                        (porte === l.key ? ' selected' : '') +
                        (ouvert === l.key ? ' ouverte' : '')
                      }
                      // Il ouvre sa légende, dessous : un bouton qui déplie, pas un interrupteur.
                      aria-expanded={ouvert === l.key}
                      aria-controls={ouvert === l.key ? 'detail-avatar' : undefined}
                      aria-label={`${l.nom}, légendaire${gagne ? (porte === l.key ? ', porté' : ', gagné') : ', à gagner'}`}
                      onClick={() => toucher(l.key)}
                    >
                      <span className="case-medaillon">
                        <Legendaire cle={l.key} verrouille={!gagne} eclat={brille(l.key)} />
                      </span>
                    </button>
                    {fiche(l.key)}
                  </Fragment>
                )
              })}
            </div>
            {divinsVus.length > 0 && (
              <>
                <h4 className="famille-titre">
                  Les Divins <span className="famille-compte">{`${divins.length} / ${DIVINS.length}`}</span>
                </h4>
                <div className="emoji-grid grille-unique" role="group" aria-label="Les Divins">
                  {divinsVus.map(d => {
                    const la = descendu(d.key)
                    return (
                      <Fragment key={d.key}>
                        <button
                          type="button"
                          className={
                            'emoji-btn case-avatar anneau-divin' +
                            (la ? '' : ' ferme') +
                            (porte === d.key ? ' selected' : '') +
                            (ouvert === d.key ? ' ouverte' : '')
                          }
                          aria-expanded={ouvert === d.key}
                          aria-controls={ouvert === d.key ? 'detail-avatar' : undefined}
                          aria-label={la ? `${d.nom}, Divin${porte === d.key ? ', porté' : ''}` : 'Un Divin, inconnu'}
                          onClick={() => toucher(d.key)}
                        >
                          <span className="case-medaillon">
                            <Divin cle={d.key} verrouille={!la} />
                          </span>
                        </button>
                        {fiche(d.key)}
                      </Fragment>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
      {profil.eclats.length > 0 && (
        <p className="muted small">
          {profil.eclats.length === 1 ? 'Un de tes avatars a éclaté' : `${profil.eclats.length} de tes avatars ont éclaté`} : il
          change de couleurs, et toi seul l’as comme ça.
        </p>
      )}
    </section>
  )
}

/** Les douze branches, une sorte de dessins chacune (`medaillons.ts`). */
const SORTES_DES_BRANCHES = BRANCHES.map(b => `branche:${b.key}` as const)

/**
 * La branche dépliée d'abord : celle du portrait qu'il porte ; sinon celle
 * où il est monté le plus haut sans l'avoir finie — c'est là que le prochain
 * tombera ; la première, pour qui n'a encore rien.
 */
function brancheDepliee(paliers: Paliers, porte: string | null): CleDeBranche {
  const portee = portraitDe(porte)
  if (portee) return portee.branche
  const enCours = BRANCHES.filter(b => prochainDansLaBranche(b, paliers))
  const plusAvancee = [...enCours].sort((a, b) => (paliers[b.key] ?? 0) - (paliers[a.key] ?? 0))[0]
  return plusAvancee && (paliers[plusAvancee.key] ?? 0) > 0 ? plusAvancee.key : BRANCHES[0].key
}

const nPaliers = (n: number) => `${n} palier${n > 1 ? 's' : ''}`

/** « Encore 2 paliers du sentier pour Anubis. » — ou le sentier fini. */
function ceQuiVient(b: Branche, paliers: Paliers): string {
  const prochain = prochainDansLaBranche(b, paliers)
  if (!prochain) return 'Sentier complet : les six portraits sont à toi.'
  return `Encore ${nPaliers(prochain.encore)} du sentier pour ${nomDansLaPhrase(prochain.portrait.nom)}.`
}

/**
 * L'onglet des branches : douze catégories, six portraits chacune. Une
 * branche se déplie — son compte, sa jauge vers le prochain portrait, ses
 * six cases —, juste sous les onglets ; les autres tiennent sur une ligne,
 * avec leur dernier portrait gagné, ou la silhouette du premier à gagner, et
 * ce qui manque au prochain (« Histoire · encore 17 »). Toucher une ligne la
 * déplie à la place de l'autre. Dépliée à sa place dans la liste, la forêt
 * tombait sous quatre lignes, hors de l'écran d'un téléphone.
 */
function MesBranches({
  paliers,
  porte,
  eclats,
  ouvert,
  toucher,
  fiche,
  onDeplier,
  aMoi = false,
}: {
  paliers: Paliers
  porte: string | null
  eclats: string[]
  ouvert: string | null
  toucher: (cle: string) => void
  fiche: (cle: string) => ReactNode
  /** Une autre branche se déplie : la fiche d'un portrait de la précédente se referme. */
  onDeplier: () => void
  /** Seulement ses portraits : les branches où il en a, et dans chacune ceux qu'il a gagnés. */
  aMoi?: boolean
}) {
  // Dans « Mon avatar », les branches où il a déjà un portrait : les autres
  // n'ont rien à porter.
  const siennes = BRANCHES.filter(b => !aMoi || ouvertsDansLaBranche(b, paliers) > 0)
  const [depliee, setDepliee] = useState<CleDeBranche>(() => {
    const k = brancheDepliee(paliers, porte)
    return siennes.some(b => b.key === k) ? k : (siennes[0]?.key ?? k)
  })
  // La ligne touchée a disparu, remplacée par sa branche dépliée en tête : le
  // focus qu'elle avait va au nom de la branche, et la page remonte juste ce
  // qu'il faut pour la montrer.
  const rayon = useRef<HTMLDivElement>(null)
  const premiere = useRef(true)
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    const nom = rayon.current?.querySelector<HTMLElement>('.rayon-tete b')
    if (nom) {
      nom.tabIndex = -1
      nom.focus({ preventScroll: true })
    }
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rayon.current?.scrollIntoView({ block: 'nearest', behavior: calme ? 'auto' : 'smooth' })
  }, [depliee])
  const deplier = (cle: CleDeBranche) => {
    onDeplier()
    setDepliee(cle)
  }
  // La dépliée d'abord, les autres dans l'ordre des catégories.
  const ordre = [...siennes.filter(b => b.key === depliee), ...siennes.filter(b => b.key !== depliee)]
  // Les douze branches se montrent — dépliée, ou sur une ligne : leurs
  // dessins viennent ensemble, à l'ouverture de l'onglet.
  const dessins = useDessins(...SORTES_DES_BRANCHES)
  const { Portrait } = dessins
  const dessin = (cle: string, verrouille: boolean) =>
    Portrait && dessinDuPortrait(dessins, cle) ? (
      <Portrait cle={cle} verrouille={verrouille} eclat={eclats.includes(cle)} />
    ) : (
      <span className="pt" aria-hidden="true" />
    )
  return (
    <div className="branches">
      {ordre.map(b => {
        const valides = paliers[b.key] ?? 0
        const n = ouvertsDansLaBranche(b, paliers)
        const compte = `${n} / ${b.portraits.length}`
        if (b.key !== depliee) {
          // Sur sa ligne, le dernier portrait gagné — ou le premier, en
          // silhouette —, sa catégorie et ce qui manque : deux lignes, pas
          // trois. La phrase entière, portrait nommé, se lit dépliée — et
          // l'oreille l'entend d'ici.
          const vitrine = b.portraits[Math.max(0, n - 1)]
          const encore = prochainDansLaBranche(b, paliers)?.encore
          return (
            <button
              key={b.key}
              type="button"
              className="ligne-branche"
              aria-expanded={false}
              aria-label={`${b.nom}, ${compte}. ${ceQuiVient(b, paliers)}`}
              onClick={() => deplier(b.key)}
            >
              <span className="ligne-branche-dessin">{dessin(vitrine.key, n === 0)}</span>
              <span className="ligne-branche-texte">
                <b>{b.nom}</b>
                <span className="muted small">{`${b.categorie} · ${encore ? `encore ${nPaliers(encore)}` : 'complète'}`}</span>
              </span>
              <span className="ligne-branche-compte">{compte}</span>
            </button>
          )
        }
        // La jauge va du dernier portrait gagné au prochain : elle bouge à
        // chaque palier validé.
        const prochain = prochainDansLaBranche(b, paliers)
        const depuis = n > 0 ? b.portraits[n - 1].palier : 0
        const part = prochain ? (valides - depuis) / (prochain.portrait.palier - depuis) : 1
        return (
          <div key={b.key} className="rayon" ref={rayon}>
            <div className="rayon-tete">
              <b>{b.nom}</b>
              <span className="detail-famille muted">{b.categorie}</span>
              <span className="ligne-branche-compte">{compte}</span>
            </div>
            <span className="jauge" aria-hidden="true">
              <span className="jauge-plein" style={{ width: `${Math.round(part * 100)}%` }} />
            </span>
            <p className="muted small">{ceQuiVient(b, paliers)}</p>
            <div className="emoji-grid grille-unique grille-branche" role="group" aria-label={b.nom}>
              {b.portraits.filter(p => !aMoi || valides >= p.palier).map(p => {
                const gagne = valides >= p.palier
                return (
                  <Fragment key={p.key}>
                    <button
                      type="button"
                      className={
                        'emoji-btn case-avatar case-portrait' +
                        (gagne ? '' : ' ferme') +
                        (porte === p.key ? ' selected' : '') +
                        (ouvert === p.key ? ' ouverte' : '')
                      }
                      aria-expanded={ouvert === p.key}
                      aria-controls={ouvert === p.key ? 'detail-avatar' : undefined}
                      aria-label={`${p.nom}${gagne ? (porte === p.key ? ', porté' : ', gagné') : `, au palier ${p.palier}`}`}
                      onClick={() => toucher(p.key)}
                    >
                      <span className="case-medaillon">{dessin(p.key, !gagne)}</span>
                      {!gagne && (
                        <span className="case-niveau" aria-hidden="true">
                          {`P${p.palier}`}
                        </span>
                      )}
                    </button>
                    {fiche(p.key)}
                  </Fragment>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Ce qu'on lit d'un portrait en le touchant : sa branche, son nom, le palier
 * de son sentier qui l'ouvre — et, s'il manque encore, combien de paliers,
 * avec le chemin du sentier. Gagné, il se porte d'ici ; porté, on revient à
 * son emoji. Sans `onPorter` — « Ma collection », qui ne fait que montrer —,
 * rien à toucher que le sentier.
 */
export function DetailPortrait({
  cle,
  paliers,
  porte,
  eclat,
  brille = eclat,
  busy,
  onPorter,
  onEclat,
}: {
  cle: string
  paliers: Paliers
  /** L'avatar dessiné qu'il porte, s'il en porte un. */
  porte: string | null
  /** Il a éclaté pour lui. */
  eclat: boolean
  /** Il en porte la version rare — sinon, il l'a éteint. */
  brille?: boolean
  busy: boolean
  onPorter?: (cle: string | null) => void
  /** Porter sa version rare, ou sa version d'origine. */
  onEclat?: (brille: boolean) => void
}) {
  const p = portraitDe(cle)
  if (!p) return null
  const b = brancheDe(p)
  const valides = paliers[b.key] ?? 0
  const gagne = valides >= p.palier
  return (
    <div className="galerie-detail detail-case">
      <span className="detail-famille muted">{`${b.nom} · ${b.categorie}`}</span>
      <b className="galerie-detail-nom">{p.nom}</b>
      {gagne ? (
        <p className="small">{`Gagné au palier ${p.palier} du sentier ${deLaBranche(b)}.`}</p>
      ) : (
        <>
          <p className="small">
            {`Se gagne au palier ${p.palier} du sentier ${deLaBranche(b)} : `}
            <b>{`encore ${nPaliers(p.palier - valides)}`}</b>, dans la campagne.
          </p>
          <a className="btn btn-small" href={`/campagne#sentier-${b.key}`}>
            Aller au sentier
          </a>
        </>
      )}
      {/* Gagné seulement : un portrait verrouillé n'a rien qui éclate. */}
      {gagne && eclat && <ChoixDeLEclat brille={brille} busy={busy} onChoisir={onEclat} />}
      {gagne && onPorter && (
        <>
          <CeQuIlRemplace porte={porte} cle={p.key} />
          <button
            type="button"
            className={'btn btn-small ' + (porte === p.key ? 'btn-ghost' : 'btn-primary')}
            aria-disabled={busy || undefined}
            onClick={() => onPorter(porte === p.key ? null : p.key)}
          >
            {porte === p.key ? 'Revenir à mon emoji' : 'Le porter'}
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Ce qu'on lit d'un emoji en le touchant dans la grille, comme d'un avatar
 * dessiné : d'où il vient — le niveau, pour un emoji de collection —, s'il a
 * éclaté (seul le lecteur d'écran le disait), et ce que « Le porter »
 * ôterait. Porté, rien à toucher : c'est lui que la salle voit.
 */
export function DetailEmoji({
  emoji,
  avatar,
  porte,
  eclat,
  brille = eclat,
  busy,
  onPorter,
  onEclat,
}: {
  emoji: string
  /** L'emoji du profil : celui qu'il porte, s'il ne porte rien de dessiné. */
  avatar: string
  /** Le légendaire ou le Divin qu'il porte, s'il en porte un. */
  porte: string | null
  /** Il a éclaté pour lui. */
  eclat: boolean
  /** Il en porte la version rare — sinon, il l'a éteint. */
  brille?: boolean
  busy: boolean
  onPorter: (emoji: string) => void
  /** Porter sa version rare, ou sa version d'origine. */
  onEclat?: (brille: boolean) => void
}) {
  const collection = COLLECTION.find(c => c.emoji === emoji)
  const choisi = !porte && emoji === avatar
  return (
    <div className="galerie-detail detail-case">
      {collection ? (
        <span className={'detail-famille ' + (collection.niveau < COLLECTION_HAUTE ? 'anneau-texte-collection' : 'anneau-texte-collection-haut')}>
          {`De collection · niveau ${collection.niveau}`}
        </span>
      ) : (
        <span className="detail-famille muted">Emoji</span>
      )}
      <b className="galerie-detail-nom detail-emoji">{emoji}</b>
      {eclat && <ChoixDeLEclat brille={brille} busy={busy} onChoisir={onEclat} />}
      {choisi ? (
        <p className="muted small">C’est lui que la salle voit.</p>
      ) : (
        <>
          <CeQuIlRemplace porte={porte} cle={emoji} />
          <button type="button" className="btn btn-small btn-primary" aria-disabled={busy || undefined} onClick={() => onPorter(emoji)}>
            Le porter
          </button>
        </>
      )}
    </div>
  )
}

/**
 * Sa finition : par défaut, la plus belle qu'il a — chaque niveau qui en
 * ouvre une nouvelle la fait porter d'office. On en épingle une autre si on
 * préfère.
 */
export function MesFinitions({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  // Les aperçus montrent ce que la salle verra : sous un légendaire porté,
  // le médaillon cerclé de la finition — pas l'emoji caché dessous, qu'on
  // choisissait auréolé d'« Aurore » sans voir le Phénix que la salle verrait.
  const divinPorte = divin(profil.legendaire)
  // Sous un Divin, qui n'en prend pas, c'est sous l'emoji que la finition se verra.
  const legendairePorte = divinPorte ? undefined : (profil.legendaire ?? undefined)
  const eclat = brilleChez(profil, cibleEclat(legendairePorte, profil.avatar))
  return (
    <section className="card">
      <h3>
        <Icon name="trophy" />
        Ma finition <span className="muted small titre-compte">{`${profil.ouvertes.length} / ${FINITIONS.length}`}</span>
      </h3>
      {/* Un Divin ne prend ni finition ni Éclat : la sienne se choisira sous un autre avatar. */}
      {divinPorte && <p className="muted small">{`${divinPorte.nom} a sa propre lumière : ta finition se voit sous tes autres avatars.`}</p>}
      <div className="finitions">
        <button
          type="button"
          className={'finition-btn' + (profil.finitionChoisie === 'auto' ? ' selected' : '')}
          aria-disabled={busy || undefined}
          aria-pressed={profil.finitionChoisie === 'auto'}
          onClick={() => enregistrer({ finition: 'auto' })}
        >
          <Avatar avatar={profil.avatar} finition={profil.finition} eclat={eclat} legendaire={legendairePorte} />
          <span className="finition-nom">La plus belle</span>
          {/* L'état se dit par `aria-pressed` : lu aussi, il se disait deux fois. */}
          <span className="muted small" aria-hidden="true">
            {profil.finitionChoisie === 'auto' ? 'portée' : 'automatique'}
          </span>
        </button>
        {FINITIONS.map(f => {
          const ouverte = profil.ouvertes.includes(f)
          const choisie = profil.finitionChoisie === f
          return (
            <button
              key={f}
              type="button"
              className={'finition-btn' + (choisie ? ' selected' : '')}
              disabled={!ouverte}
              aria-disabled={busy || undefined}
              aria-pressed={choisie}
              onClick={() => enregistrer({ finition: f })}
            >
              <Avatar avatar={profil.avatar} finition={f} eclat={eclat} legendaire={legendairePorte} />
              <span className="finition-nom">{NOM_FINITION[f]}</span>
              {/* « épinglée » redit `aria-pressed` : l'oreille entend « ouverte ». */}
              <span className="muted small" aria-hidden={choisie || undefined}>
                {ouverte ? (choisie ? 'épinglée' : 'ouverte') : `niveau ${NIVEAU_FINITION[f]}`}
              </span>
              {choisie && <span className="sr-only">ouverte</span>}
            </button>
          )
        })}
      </div>
      <p className="muted small">
        Les finitions se gagnent au niveau, jusqu’à Constellation au niveau 25. L’Éclat, lui, ne se gagne pas : une chance
        sur quarante par soirée jouée à deux ou plus et par quiz du jour, une sur vingt par défi de la semaine, et c’est
        l’avatar lui-même qui change de couleurs.
      </p>
    </section>
  )
}

/**
 * Son titre, sous son prénom : chaque haut fait gagné ouvre le sien — son
 * nom, « L'Oracle », « La Lanterne Rouge » —, et chaque palier de maître des
 * sentiers du savoir le sien (« Maître de la forêt »). Il s'écrit sur sa
 * carte : la salle le lit en touchant son nom. Ceux qui restent à gagner se
 * comptent, sans se nommer : trente boutons fermés noyaient les siens.
 */
export function MonTitre({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  // Les maîtres d'abord : un sentier gravi jusqu'au bout se dit en premier ;
  // puis les titres datés des champions du mois, du plus récent au plus ancien.
  const dates = profil.titresDates ?? []
  const gagnes = [...maitresDe(profil.sentiers ?? {}).map(cleDeMaitre), ...dates, ...hautsFaitsGagnes(recompensesDe(profil.hautsFaits))]
  const aGagner = profil.hautsFaits.length - (gagnes.length - maitresDe(profil.sentiers ?? {}).length - dates.length)
  const porte = profil.titre ?? null
  return (
    <section className="card">
      <h3>
        <Icon name="star" />
        Mon titre
      </h3>
      <p className="muted small">
        Chaque haut fait gagné ouvre le sien, chaque palier de maître des sentiers aussi. Il s’écrit sous ton prénom, sur ta carte : la salle
        le lit en touchant ton nom.
      </p>
      <div className="titres" role="group" aria-label="Mon titre">
        <button
          type="button"
          className={'titre-choix' + (!porte ? ' selected' : '')}
          aria-pressed={!porte}
          aria-disabled={busy || undefined}
          onClick={() => enregistrer({ titre: null })}
        >
          Aucun
        </button>
        {gagnes.map(cle => (
          <button
            key={cle}
            type="button"
            className={'titre-choix' + (porte === cle ? ' selected' : '')}
            aria-pressed={porte === cle}
            aria-disabled={busy || undefined}
            onClick={() => enregistrer({ titre: cle })}
          >
            {nomDuTitre(cle)}
          </button>
        ))}
        {aGagner > 0 && (
          <span className="titre-choix ferme">
            <Icon name="lock" />
            {gagnes.length === 0 ? `${aGagner} titres à gagner` : `et ${aGagner} autre${aGagner > 1 ? 's' : ''} à gagner`}
          </span>
        )}
      </div>
    </section>
  )
}

/**
 * Le fond de sa carte : ce qu'on voit derrière elle quand quelqu'un touche
 * son nom. Rien d'autre ne change — ni l'écran commun, ni les classements.
 * Ceux qui restent à gagner se voient, avec ce qu'il faut : savoir ce qui
 * vient donne envie de revenir.
 */
export function MonFond({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  if (!profil.fonds) return null
  const porte = profil.fond ?? null
  return (
    <section className="card">
      <h3>
        <Icon name="image" />
        Le fond de ma carte <span className="muted small titre-compte">{`${profil.fonds.length} / ${FONDS.length}`}</span>
      </h3>
      <p className="muted small">Il se voit quand quelqu’un touche ton nom : c’est ta carte qui change d’allure, rien d’autre.</p>
      <div className="finitions fonds-choix">
        <button
          type="button"
          className={'finition-btn' + (!porte ? ' selected' : '')}
          aria-disabled={busy || undefined}
          aria-pressed={!porte}
          onClick={() => enregistrer({ fond: null })}
        >
          <span className="fond-apercu" aria-hidden="true" />
          <span className="finition-nom">Velours</span>
          <span className="muted small" aria-hidden="true">
            {!porte ? 'porté' : 'd’office'}
          </span>
        </button>
        {FONDS.map(f => {
          const ouvert = profil.fonds!.includes(f.key)
          const choisi = porte === f.key
          return (
            <button
              key={f.key}
              type="button"
              className={'finition-btn' + (choisi ? ' selected' : '')}
              disabled={!ouvert}
              aria-disabled={busy || undefined}
              aria-pressed={choisi}
              onClick={() => enregistrer({ fond: f.key })}
            >
              <span className={`fond-apercu carte-fond fond-${f.key}`} aria-hidden="true" />
              <span className="finition-nom">{f.nom}</span>
              {/* « porté » redit `aria-pressed` : l'oreille entend « ouvert ». */}
              <span className="muted small" aria-hidden={choisi || undefined}>
                {ouvert ? (choisi ? 'porté' : 'ouvert') : f.regle}
              </span>
              {choisi && <span className="sr-only">ouvert</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/**
 * Sa gerbe : ce qui éclate sur son téléphone à une bonne réponse, en soirée,
 * au quiz du jour et en campagne. Pour lui seul — ni la salle ni l'écran
 * commun n'en voient rien. Ceux qui restent à gagner se voient, avec ce
 * qu'il faut ; toucher celle qu'on porte la rejoue.
 */
export function MaGerbe({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  // L'aperçu : la gerbe qu'on vient de toucher éclate, une fois par toucher.
  const [apercu, setApercu] = useState<{ cle: string; n: number } | null>(null)
  if (!profil.gerbes) return null
  const porte = profil.gerbe ?? null
  const montrer = (cle: string) => setApercu(a => ({ cle, n: (a?.n ?? 0) + 1 }))
  return (
    <section className="card">
      <h3>
        <Icon name="zap" />
        Ma gerbe <span className="muted small titre-compte">{`${profil.gerbes.length} / ${GERBES.length}`}</span>
      </h3>
      <p className="muted small">Elle éclate sur ton téléphone à chaque bonne réponse : en soirée, au quiz du jour et en campagne. Personne d’autre ne la voit.</p>
      <div className="finitions gerbes-choix">
        <button
          type="button"
          className={'finition-btn' + (!porte ? ' selected' : '')}
          aria-disabled={busy || undefined}
          aria-pressed={!porte}
          onClick={() => enregistrer({ gerbe: null })}
        >
          <span className="gerbe-apercu" aria-hidden="true" />
          <span className="finition-nom">Aucune</span>
          <span className="muted small" aria-hidden="true">
            {!porte ? 'portée' : 'sobre'}
          </span>
        </button>
        {GERBES.map(g => {
          const ouverte = profil.gerbes!.includes(g.key)
          const choisie = porte === g.key
          return (
            <button
              key={g.key}
              type="button"
              className={'finition-btn' + (choisie ? ' selected' : '')}
              disabled={!ouverte}
              aria-disabled={busy || undefined}
              aria-pressed={choisie}
              onClick={() => {
                montrer(g.key)
                if (!choisie) enregistrer({ gerbe: g.key })
              }}
            >
              <span className="gerbe-apercu" aria-hidden="true">
                {g.particules.slice(0, 3).join('')}
              </span>
              <span className="finition-nom">{g.nom}</span>
              <span className="muted small" aria-hidden={choisie || undefined}>
                {ouverte ? (choisie ? 'portée' : 'ouverte') : g.regle}
              </span>
              {choisie && <span className="sr-only">ouverte</span>}
            </button>
          )
        })}
      </div>
      {apercu && <GerbeDeJuste key={apercu.n} cle={apercu.cle} />}
    </section>
  )
}
