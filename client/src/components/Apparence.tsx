import { useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { NomLaure } from './Laurier'
import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { DetailDivin, DetailLegendaire } from './Carriere'
import { AVATARS, COLLECTION } from '../../../shared/avatars'
import { hautFait, hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { LEGENDAIRES, cibleEclat, legendaire } from '../../../shared/legendaires'
import { DIVINS, divin } from '../../../shared/divins'
import { FONDS, fond } from '../../../shared/fonds'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, type FinitionChoisie, type PublicProfileDetail } from '../../../shared/profil'

// L'onglet « Apparence » du profil : ce que la salle voit de lui, son visage
// — une seule grille, emojis, légendaires et Divins —, et sa finition.
//
// Emojis, légendaires ou Divins, c'est l'avatar qu'on porte : trois
// catalogues à part en faisaient trois sections repliées, et l'on cherchait
// où changer de tête. Une grille, des cases de la même taille ; un anneau de
// couleur dit ce qui est rare, et toucher un avatar dessiné dit d'où il vient.

/**
 * L'anneau des emojis de collection passe du vert au bleu à partir du
 * niveau 10 : les premiers viennent en quelques soirées, les autres en une
 * année, et la grille le dit d'un coup d'œil.
 */
const COLLECTION_HAUTE = 10

/** Ce qu'un toucher du profil change : un champ à la fois. */
export type ChoixDuProfil = {
  avatar?: string
  finition?: FinitionChoisie
  legendaire?: string | null
  titre?: string | null
  fond?: string | null
  vitrine?: string[] | null
}
type Patch = Omit<ChoixDuProfil, 'vitrine'>

/**
 * Ce qu'un choix enregistré a changé, en une phrase pour le lecteur
 * d'écran : l'état « pressé » d'une case changeait sans rien dire.
 */
export function annonceDuChoix(choix: ChoixDuProfil): string {
  if (choix.avatar) return `Tu portes ${choix.avatar}.`
  if (choix.legendaire !== undefined) {
    const nom = legendaire(choix.legendaire)?.nom ?? divin(choix.legendaire)?.nom
    return nom ? `Tu portes ${nom}.` : 'Tu reviens à ton emoji.'
  }
  if (choix.finition) return choix.finition === 'auto' ? 'Ta plus belle finition, d’office.' : `Finition ${NOM_FINITION[choix.finition]}.`
  if (choix.titre !== undefined) {
    const titre = choix.titre ? hautFait(choix.titre)?.title : undefined
    return titre ? `Ton titre : ${titre}.` : 'Sans titre.'
  }
  if (choix.fond !== undefined) {
    const nom = fond(choix.fond)?.nom
    return nom ? `Ton fond de carte : ${nom}.` : 'Sans fond de carte.'
  }
  if (choix.vitrine !== undefined) return choix.vitrine ? 'Ta vitrine est enregistrée.' : 'Ta vitrine montre tes plus beaux hauts faits.'
  return 'C’est enregistré.'
}

/**
 * Sa ligne telle que la salle la voit, dans les classements et la salle
 * d'attente : son visage, sa finition, son niveau. On change d'avatar
 * plus bas, et l'on se voit changer ici.
 */
export function ApercuSalle({ profil }: { profil: PublicProfileDetail }) {
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
    </section>
  )
}

/**
 * Tous ses avatars, en une grille : les vingt-quatre emojis, les douze de
 * collection, les légendaires, les cinq Divins. Un emoji se porte d'un
 * toucher — celui de collection, une fois son niveau atteint ; un avatar
 * dessiné se touche d'abord pour lire sa légende — et, gagné, se porte de là.
 */
export function MesAvatars({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const brille = (cle: string) => profil.eclats.includes(cle)
  const divins = profil.divins ?? []
  const descendu = (cle: string) => divins.some(d => d.key === cle)
  const porte = profil.legendaire
  const ouverts = COLLECTION.filter(c => profil.niveau >= c.niveau).length
  const possedes = AVATARS.length + ouverts + profil.legendaires.length + divins.length
  const total = AVATARS.length + COLLECTION.length + LEGENDAIRES.length + DIVINS.length
  const toucher = (cle: string) => setOuvert(o => (o === cle ? null : cle))
  // La légende se déplie sous toute la grille, une vingtaine de Tab plus
  // loin : le focus y va, sur son nom, et le lecteur d'écran la lit. Sans
  // défiler — le doigt qui parcourt la grille n'est pas emporté.
  const detail = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ouvert) return
    const nom = detail.current?.querySelector<HTMLElement>('.galerie-detail-nom')
    if (!nom) return
    nom.tabIndex = -1
    nom.focus({ preventScroll: true })
  }, [ouvert])
  return (
    <section className="card">
      <h3>
        <Icon name="users" />
        Mes avatars <span className="muted small titre-compte">{`${possedes} / ${total}`}</span>
      </h3>
      <p className="muted small">Un seul à la fois. Touche un avatar dessiné pour savoir d’où il vient.</p>
      <div className="emoji-grid grille-unique" role="group" aria-label="Mes avatars">
        {AVATARS.map(a => {
          const choisi = !porte && a === profil.avatar
          return (
            <button
              key={a}
              type="button"
              className={'emoji-btn case-avatar' + (choisi ? ' selected' : '')}
              aria-pressed={choisi}
              aria-label={`Avatar ${a}${brille(a) ? ', éclaté' : ''}`}
              aria-disabled={busy || undefined}
              onClick={() => {
                setOuvert(null)
                enregistrer({ avatar: a })
              }}
            >
              <Avatar avatar={a} finition={profil.finition} eclat={brille(a)} />
            </button>
          )
        })}
        {COLLECTION.map(c => {
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
            <button
              key={c.emoji}
              type="button"
              className={'emoji-btn case-avatar' + anneau + (choisi ? ' selected' : '')}
              aria-pressed={choisi}
              aria-label={`Avatar ${c.emoji}, de collection${brille(c.emoji) ? ', éclaté' : ''}`}
              aria-disabled={busy || undefined}
              onClick={() => {
                setOuvert(null)
                enregistrer({ avatar: c.emoji })
              }}
            >
              <Avatar avatar={c.emoji} finition={profil.finition} eclat={brille(c.emoji)} />
            </button>
          )
        })}
        {LEGENDAIRES.map(l => {
          const gagne = profil.legendaires.includes(l.key)
          return (
            <button
              key={l.key}
              type="button"
              className={
                'emoji-btn case-avatar anneau-legendaire' +
                (gagne ? '' : ' ferme') +
                (porte === l.key ? ' selected' : '') +
                (ouvert === l.key ? ' ouverte' : '')
              }
              // Il ouvre sa légende, dessous : un bouton qui déplie, pas un interrupteur.
              aria-expanded={ouvert === l.key}
              aria-controls="detail-avatar"
              aria-label={`${l.nom}, légendaire${gagne ? (porte === l.key ? ', porté' : ', gagné') : ', à gagner'}`}
              onClick={() => toucher(l.key)}
            >
              <span className="case-medaillon">
                <Legendaire cle={l.key} verrouille={!gagne} eclat={brille(l.key)} />
              </span>
            </button>
          )
        })}
        {DIVINS.map(d => {
          const la = descendu(d.key)
          return (
            <button
              key={d.key}
              type="button"
              className={
                'emoji-btn case-avatar anneau-divin' +
                (la ? '' : ' ferme') +
                (porte === d.key ? ' selected' : '') +
                (ouvert === d.key ? ' ouverte' : '')
              }
              aria-expanded={ouvert === d.key}
              aria-controls="detail-avatar"
              aria-label={la ? `${d.nom}, Divin${porte === d.key ? ', porté' : ''}` : 'Un Divin, inconnu'}
              onClick={() => toucher(d.key)}
            >
              <span className="case-medaillon">
                <Divin cle={d.key} verrouille={!la} />
              </span>
            </button>
          )
        })}
      </div>
      <div id="detail-avatar" ref={detail}>
        {ouvert &&
          (legendaire(ouvert) ? (
            <DetailLegendaire
              cle={ouvert}
              debloques={profil.legendaires}
              eclats={profil.eclats}
              porte={porte}
              hautsFaits={profil.hautsFaits}
              busy={busy}
              onPorter={cle => enregistrer({ legendaire: cle })}
            />
          ) : (
            <DetailDivin cle={ouvert} descendus={divins} porte={porte} busy={busy} onPorter={cle => enregistrer({ legendaire: cle })} />
          ))}
      </div>
      <p className="legende-anneaux small muted">
        <span className="puce anneau-texte-legendaire" aria-hidden="true">
          ●
        </span>{' '}
        légendaire ·{' '}
        <span className="puce anneau-texte-divin" aria-hidden="true">
          ●
        </span>{' '}
        Divin ·{' '}
        <span className="puce anneau-texte-collection" aria-hidden="true">
          ●
        </span>{' '}
        de collection, niveaux 2 à 9 ·{' '}
        <span className="puce anneau-texte-collection-haut" aria-hidden="true">
          ●
        </span>{' '}
        niveaux 11 et plus
      </p>
      {profil.eclats.length > 0 && (
        <p className="muted small">
          {profil.eclats.length === 1 ? 'Un de tes avatars a éclaté' : `${profil.eclats.length} de tes avatars ont éclaté`} : il
          change de couleurs, et toi seul l’as comme ça.
        </p>
      )}
    </section>
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
