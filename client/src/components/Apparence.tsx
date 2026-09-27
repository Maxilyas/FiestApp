import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { NomLaure } from './Laurier'
import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { CeQuIlRemplace, DetailDivin, DetailLegendaire } from './Carriere'
import { CarteJoueur } from './CarteJoueur'
import { Onglets } from './Onglets'
import { dessinDuPortrait, useDessins } from './medaillons'
import { espacesFines } from '../format'
import { rendreLeFocus } from '../focus'
import { AVATARS, COLLECTION } from '../../../shared/avatars'
import { hautFait, hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { LEGENDAIRES, cibleEclat, legendaire } from '../../../shared/legendaires'
import { DIVINS, divin } from '../../../shared/divins'
import {
  BRANCHES,
  PORTRAITS,
  brancheDe,
  ecussonDuSeuil,
  nomDansLaPhrase,
  ouvertsDansLaBranche,
  portrait as portraitDe,
  portraitsOuverts,
  prochainDansLaBranche,
  savoirDesEcussons,
  type Branche,
  type CleDeBranche,
  type Savoir,
} from '../../../shared/branches'
import { FONDS } from '../../../shared/fonds'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, type PublicProfileDetail } from '../../../shared/profil'
import type { ChoixDuProfil } from './choix'

// L'onglet « Apparence » du profil : ce que la salle voit de lui, son visage
// — portraits des branches, emojis, légendaires, Divins, rangés par famille
// —, et sa finition.
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
const COLLECTION_HAUTE = 10

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
          eclat={profil.eclats.includes(cibleEclat(profil.legendaire, profil.avatar))}
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

/** Les familles de « Mes avatars », dans l'ordre des onglets. */
export type Famille = 'branches' | 'emojis' | 'collection' | 'legendaires' | 'divins'
const FAMILLES: { id: Famille; nom: string }[] = [
  { id: 'branches', nom: 'Branches' },
  { id: 'emojis', nom: 'Emojis' },
  { id: 'collection', nom: 'Collection' },
  { id: 'legendaires', nom: 'Légendaires' },
  { id: 'divins', nom: 'Divins' },
]

/**
 * La famille où « Mes avatars » s'ouvre : celle de l'avatar qu'il porte —
 * on vient souvent pour en changer, et « Le porter » est alors à côté de ce
 * qu'on quitte. Sous un emoji de l'inscription, les branches : c'est là que
 * ses bonnes réponses le mènent.
 */
export function familleDe(profil: Pick<PublicProfileDetail, 'legendaire' | 'avatar'>): Famille {
  if (portraitDe(profil.legendaire)) return 'branches'
  if (legendaire(profil.legendaire)) return 'legendaires'
  if (divin(profil.legendaire)) return 'divins'
  if (COLLECTION.some(c => c.emoji === profil.avatar)) return 'collection'
  return 'branches'
}

/**
 * Tous ses avatars, rangés par famille : les portraits des branches, les
 * vingt-quatre emojis, les douze de collection, les légendaires, les cinq
 * Divins. Cent vingt-neuf avatars ne se parcourent plus en une grille :
 * chaque famille a son onglet, et son compte.
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
}: {
  profil: PublicProfileDetail
  busy: boolean
  enregistrer: (patch: Patch) => void
  /** La famille ouverte d'abord ; celle de l'avatar qu'il porte, par défaut (`familleDe`). */
  familleInitiale?: Famille
}) {
  const [famille, setFamille] = useState<Famille>(() => familleInitiale ?? familleDe(profil))
  const [ouvert, setOuvert] = useState<string | null>(null)
  const brille = (cle: string) => profil.eclats.includes(cle)
  const divins = profil.divins ?? []
  const descendu = (cle: string) => divins.some(d => d.key === cle)
  const porte = profil.legendaire
  // Ses bonnes réponses par catégorie : ses écussons les disent déjà.
  const savoir = savoirDesEcussons(profil.ecussons ?? [])
  const portraits = portraitsOuverts(savoir)
  const ouverts = COLLECTION.filter(c => profil.niveau >= c.niveau).length
  const possedes = portraits.length + AVATARS.length + ouverts + profil.legendaires.length + divins.length
  const total = PORTRAITS.length + AVATARS.length + COLLECTION.length + LEGENDAIRES.length + DIVINS.length
  const comptes: Record<Famille, string> = {
    branches: `${portraits.length} / ${PORTRAITS.length}`,
    emojis: String(AVATARS.length),
    collection: `${ouverts} / ${COLLECTION.length}`,
    legendaires: `${profil.legendaires.length} / ${LEGENDAIRES.length}`,
    divins: `${divins.length} / ${DIVINS.length}`,
  }
  const toucher = (cle: string) => setOuvert(o => (o === cle ? null : cle))
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
    if (!ouvert) return
    const nom = detail.current?.querySelector<HTMLElement>('.galerie-detail-nom')
    if (!nom) return
    nom.tabIndex = -1
    nom.focus({ preventScroll: true })
    const calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    detail.current?.scrollIntoView({ block: 'nearest', behavior: calme ? 'auto' : 'smooth' })
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
            savoir={savoir}
            porte={porte}
            eclat={brille(cle)}
            busy={busy}
            onPorter={k => enregistrer({ legendaire: k })}
          />
        ) : legendaire(cle) ? (
          <DetailLegendaire
            cle={cle}
            debloques={profil.legendaires}
            eclats={profil.eclats}
            porte={porte}
            hautsFaits={profil.hautsFaits}
            busy={busy}
            onPorter={l => enregistrer({ legendaire: l })}
          />
        ) : divin(cle) ? (
          <DetailDivin cle={cle} descendus={divins} porte={porte} busy={busy} onPorter={d => enregistrer({ legendaire: d })} />
        ) : (
          <DetailEmoji
            emoji={cle}
            avatar={profil.avatar}
            porte={porte}
            eclat={brille(cle)}
            busy={busy}
            onPorter={a => enregistrer({ avatar: a })}
          />
        )}
      </div>
    )
  return (
    <section className="card">
      <h3>
        <Icon name="users" />
        Mes avatars <span className="muted small titre-compte">{`${possedes} / ${total}`}</span>
      </h3>
      <p className="muted small">
        {espacesFines('Un seul à la fois : touche un avatar, puis « Le porter ». Un avatar dessiné dit aussi d’où il vient.')}
      </p>
      <Onglets
        onglets={FAMILLES.map(f => ({ ...f, compte: comptes[f.id] }))}
        actif={famille}
        onChoisir={choisir}
        label="Familles d’avatars"
        idOnglet={f => `famille-${f}`}
        idPanneau={() => 'famille-avatars'}
        className="onglets-petits onglets-familles"
      />
      <div className="famille-avatars" role="tabpanel" id="famille-avatars" aria-labelledby={`famille-${famille}`}>
        {famille === 'branches' ? (
          <MesBranches
            savoir={savoir}
            porte={porte}
            eclats={profil.eclats}
            ouvert={ouvert}
            toucher={toucher}
            fiche={fiche}
            onDeplier={() => setOuvert(null)}
          />
        ) : (
          <div className="emoji-grid grille-unique" role="group" aria-label={FAMILLES.find(f => f.id === famille)!.nom}>
            {famille === 'emojis' &&
              AVATARS.map(a => {
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
            {famille === 'collection' &&
              COLLECTION.map(c => {
                const anneau = c.niveau < COLLECTION_HAUTE ? ' anneau-collection' : ' anneau-collection-haut'
                if (profil.niveau < c.niveau) {
                  // Sa silhouette et son niveau, rien à toucher : il n'a pas d'autre
                  // histoire que le niveau qui l'ouvre.
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
            {famille === 'legendaires' &&
              LEGENDAIRES.map(l => {
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
            {famille === 'divins' &&
              DIVINS.map(d => {
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
        )}
        {famille === 'collection' && (
          <p className="legende-anneaux small muted">
            Un emoji à chaque niveau qui n’ouvre pas de finition, réservé aux profils ·{' '}
            <span className="puce anneau-texte-collection" aria-hidden="true">
              ●
            </span>{' '}
            niveaux 2 à 9 ·{' '}
            <span className="puce anneau-texte-collection-haut" aria-hidden="true">
              ●
            </span>{' '}
            niveaux 11 et plus
          </p>
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
 * où il sait le plus sans l'avoir finie — c'est là que le prochain tombera ;
 * la première, pour qui n'a encore rien.
 */
function brancheDepliee(savoir: Savoir, porte: string | null): CleDeBranche {
  const portee = portraitDe(porte)
  if (portee) return portee.branche
  const enCours = BRANCHES.filter(b => prochainDansLaBranche(b, savoir))
  const plusAvancee = [...enCours].sort((a, b) => (savoir[b.categorie] ?? 0) - (savoir[a.categorie] ?? 0))[0]
  return plusAvancee && (savoir[plusAvancee.categorie] ?? 0) > 0 ? plusAvancee.key : BRANCHES[0].key
}

/** « Encore 3 bonnes réponses en Histoire pour Anubis. » — ou la branche finie. */
function ceQuiVient(b: Branche, savoir: Savoir): string {
  const prochain = prochainDansLaBranche(b, savoir)
  if (!prochain) return `Branche complète : ${savoir[b.categorie] ?? 0} bonnes réponses en ${b.categorie}.`
  const n = prochain.manque
  return `Encore ${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''} en ${b.categorie} pour ${nomDansLaPhrase(prochain.portrait.nom)}.`
}

/**
 * L'onglet des branches : douze catégories, six portraits chacune. Une
 * branche se déplie — son compte, sa jauge vers le prochain portrait, ses
 * six cases —, juste sous les onglets ; les autres tiennent sur une ligne,
 * avec leur dernier portrait gagné, ou la silhouette du premier à gagner, et
 * ce qui vient en toutes lettres. Toucher une ligne la déplie à la place de
 * l'autre. Dépliée à sa place dans la liste, la forêt tombait sous quatre
 * lignes, hors de l'écran d'un téléphone.
 */
function MesBranches({
  savoir,
  porte,
  eclats,
  ouvert,
  toucher,
  fiche,
  onDeplier,
}: {
  savoir: Savoir
  porte: string | null
  eclats: string[]
  ouvert: string | null
  toucher: (cle: string) => void
  fiche: (cle: string) => ReactNode
  /** Une autre branche se déplie : la fiche d'un portrait de la précédente se referme. */
  onDeplier: () => void
}) {
  const [depliee, setDepliee] = useState<CleDeBranche>(() => brancheDepliee(savoir, porte))
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
  const ordre = [...BRANCHES.filter(b => b.key === depliee), ...BRANCHES.filter(b => b.key !== depliee)]
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
        const justes = savoir[b.categorie] ?? 0
        const n = ouvertsDansLaBranche(b, savoir)
        const compte = `${n} / ${b.portraits.length}`
        if (b.key !== depliee) {
          // Sur sa ligne, le dernier portrait gagné — ou le premier, en silhouette.
          const vitrine = b.portraits[Math.max(0, n - 1)]
          return (
            <button key={b.key} type="button" className="ligne-branche" aria-expanded={false} onClick={() => deplier(b.key)}>
              <span className="ligne-branche-dessin">{dessin(vitrine.key, n === 0)}</span>
              <span className="ligne-branche-texte">
                <b>{b.nom}</b>
                <span className="muted small">{ceQuiVient(b, savoir)}</span>
              </span>
              <span className="ligne-branche-compte">{compte}</span>
            </button>
          )
        }
        // La jauge va du dernier portrait gagné au prochain : elle bouge à
        // chaque soirée, pas une fois l'an.
        const prochain = prochainDansLaBranche(b, savoir)
        const depuis = n > 0 ? b.portraits[n - 1].seuil : 0
        const part = prochain ? (justes - depuis) / (prochain.portrait.seuil - depuis) : 1
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
            <p className="muted small">{ceQuiVient(b, savoir)}</p>
            <div className="emoji-grid grille-unique grille-branche" role="group" aria-label={b.nom}>
              {b.portraits.map(p => {
                const gagne = justes >= p.seuil
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
                      aria-label={`${p.nom}${gagne ? (porte === p.key ? ', porté' : ', gagné') : `, à ${p.seuil} bonnes réponses`}`}
                      onClick={() => toucher(p.key)}
                    >
                      <span className="case-medaillon">{dessin(p.key, !gagne)}</span>
                      {!gagne && (
                        <span className="case-niveau" aria-hidden="true">
                          {p.seuil}
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

/** « de bronze », « d’argent », « d’or ». */
const deMetal = (metal: string) => (metal === 'bronze' ? `de ${metal}` : `d’${metal}`)

/**
 * Ce qu'on lit d'un portrait en le touchant : sa branche, son nom, ce qui
 * l'ouvre — et, s'il manque encore, combien de bonnes réponses. Gagné, il
 * se porte d'ici ; porté, on revient à son emoji.
 */
export function DetailPortrait({
  cle,
  savoir,
  porte,
  eclat,
  busy,
  onPorter,
}: {
  cle: string
  savoir: Savoir
  /** L'avatar dessiné qu'il porte, s'il en porte un. */
  porte: string | null
  eclat: boolean
  busy: boolean
  onPorter: (cle: string | null) => void
}) {
  const p = portraitDe(cle)
  if (!p) return null
  const b = brancheDe(p)
  const justes = savoir[b.categorie] ?? 0
  const gagne = justes >= p.seuil
  const metal = ecussonDuSeuil(p.seuil)
  const avec = metal ? `, avec l’écusson ${deMetal(metal)}` : ''
  return (
    <div className="galerie-detail detail-case">
      <span className="detail-famille muted">{`${b.nom} · ${b.categorie}`}</span>
      <b className="galerie-detail-nom">{p.nom}</b>
      {gagne ? (
        <p className="small">{`Gagné à ${p.seuil} bonnes réponses en ${b.categorie}${avec}.`}</p>
      ) : (
        <p className="small">
          {`Se gagne à ${p.seuil} bonnes réponses en ${b.categorie}${avec} : `}
          <b>{`encore ${p.seuil - justes}`}</b>, en soirée comme au quiz du jour.
        </p>
      )}
      {/* Gagné seulement : un portrait verrouillé n'a rien qui éclate. */}
      {gagne && eclat && <p className="small">Il a éclaté : c’est sa version rare, et personne d’autre ne l’a comme ça.</p>}
      {gagne && (
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
  busy,
  onPorter,
}: {
  emoji: string
  /** L'emoji du profil : celui qu'il porte, s'il ne porte rien de dessiné. */
  avatar: string
  /** Le légendaire ou le Divin qu'il porte, s'il en porte un. */
  porte: string | null
  eclat: boolean
  busy: boolean
  onPorter: (emoji: string) => void
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
      {eclat && <p className="small">Il a éclaté : c’est sa version rare, et personne d’autre ne l’a comme ça.</p>}
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
  const eclat = profil.eclats.includes(cibleEclat(legendairePorte, profil.avatar))
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
        sur quarante par soirée jouée à deux ou plus, et c’est l’avatar lui-même qui change de couleurs.
      </p>
    </section>
  )
}

/**
 * Son titre, sous son prénom : chaque haut fait gagné ouvre le sien — son
 * nom, « L'Oracle », « La Lanterne Rouge ». Il s'écrit sur sa carte : la
 * salle le lit en touchant son nom. Ceux qui restent à gagner se comptent,
 * sans se nommer : trente boutons fermés noyaient les siens.
 */
export function MonTitre({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  const gagnes = hautsFaitsGagnes(recompensesDe(profil.hautsFaits))
  const aGagner = profil.hautsFaits.length - gagnes.length
  const porte = profil.titre ?? null
  return (
    <section className="card">
      <h3>
        <Icon name="star" />
        Mon titre
      </h3>
      <p className="muted small">
        Chaque haut fait gagné ouvre le sien. Il s’écrit sous ton prénom, sur ta carte : la salle le lit en touchant ton nom.
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
            {hautFait(cle)?.title}
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
