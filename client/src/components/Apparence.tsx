import { useState } from 'react'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Icon } from './Icon'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'
import { DetailDivin, DetailLegendaire } from './Carriere'
import { AVATARS } from '../../../shared/avatars'
import { hautFait, hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'
import { LEGENDAIRES, cibleEclat, legendaire } from '../../../shared/legendaires'
import { DIVINS } from '../../../shared/divins'
import { FINITIONS, NIVEAU_FINITION, NOM_FINITION, type FinitionChoisie, type PublicProfileDetail } from '../../../shared/profil'

// L'onglet « Apparence » du profil : ce que la salle voit de lui, son visage
// — une seule grille, emojis, légendaires et Divins —, et sa finition.
//
// Emojis, légendaires ou Divins, c'est l'avatar qu'on porte : trois
// catalogues à part en faisaient trois sections repliées, et l'on cherchait
// où changer de tête. Une grille, des cases de la même taille ; un anneau de
// couleur dit ce qui est rare, et toucher un avatar dessiné dit d'où il vient.

type Patch = { avatar?: string; finition?: FinitionChoisie; legendaire?: string | null; titre?: string | null }

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
        <span className="lb-name">{profil.name}</span>
        <Niveau niveau={profil.niveau} />
      </div>
    </section>
  )
}

/**
 * Tous ses avatars, en une grille : les vingt-quatre emojis, les douze
 * légendaires, les cinq Divins. Un emoji se porte d'un toucher ; un avatar
 * dessiné se touche d'abord pour lire sa légende — et, gagné, se porte de là.
 */
export function MesAvatars({ profil, busy, enregistrer }: { profil: PublicProfileDetail; busy: boolean; enregistrer: (patch: Patch) => void }) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  const brille = (cle: string) => profil.eclats.includes(cle)
  const divins = profil.divins ?? []
  const descendu = (cle: string) => divins.some(d => d.key === cle)
  const porte = profil.legendaire
  const possedes = AVATARS.length + profil.legendaires.length + divins.length
  const total = AVATARS.length + LEGENDAIRES.length + DIVINS.length
  const toucher = (cle: string) => setOuvert(o => (o === cle ? null : cle))
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
              disabled={busy}
              onClick={() => {
                setOuvert(null)
                enregistrer({ avatar: a })
              }}
            >
              <Avatar avatar={a} finition={profil.finition} eclat={brille(a)} />
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
      <div id="detail-avatar">
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
        Divin
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
  const eclat = profil.eclats.includes(profil.avatar)
  return (
    <section className="card">
      <h3>
        <Icon name="trophy" />
        Ma finition <span className="muted small titre-compte">{`${profil.ouvertes.length} / ${FINITIONS.length}`}</span>
      </h3>
      <div className="finitions">
        <button
          type="button"
          className={'finition-btn' + (profil.finitionChoisie === 'auto' ? ' selected' : '')}
          disabled={busy}
          aria-pressed={profil.finitionChoisie === 'auto'}
          onClick={() => enregistrer({ finition: 'auto' })}
        >
          <Avatar avatar={profil.avatar} finition={profil.finition} eclat={eclat} />
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
              disabled={!ouverte || busy}
              aria-pressed={choisie}
              onClick={() => enregistrer({ finition: f })}
            >
              <Avatar avatar={profil.avatar} finition={f} eclat={eclat} />
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
          disabled={busy}
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
            disabled={busy}
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
