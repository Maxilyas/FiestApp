import { useState } from 'react'
import type { Finition, PublicProfile } from '../../../shared/profil'
import { collectionGagnee } from '../../../shared/avatars'
import { ceQuIlAFallu, palierDe } from '../../../shared/hautsfaits'
import { legendaire } from '../../../shared/legendaires'
import { portrait as portraitDe } from '../../../shared/branches'
import { api } from '../api'
import { showToast } from '../state'
import { Avatar, Dessin } from './Avatar'
import { perdus, sortesDe, useDessins } from './medaillons'

// Ce qu'une partie vient d'ouvrir, qu'on porte d'ici : à la fin d'une
// soirée (`FinDeSoiree.tsx`), du quiz du jour (`JourApp.tsx`), d'une série
// de campagne ou d'un défi (`CampagneApp.tsx`) ou d'une épreuve des sentiers.
// À part de la fin de soirée : le quiz du jour l'importait pour ces
// composants, et téléchargeait toute la fin de soirée à chaque ouverture de
// sa page. (Les portraits des branches s'y annonçaient aussi : ils se
// gagnent maintenant sur les sentiers, qui ont leur révélation.)

/**
 * Les emojis de collection qu'une montée de niveau vient d'ouvrir, qu'on
 * porte d'ici : en fin de soirée comme à la fin du quiz du jour, qui les
 * ouvrait sans un mot.
 */
export function CollectionOuverte({
  avant,
  apres,
  finition,
  onPorte,
}: {
  avant: number
  apres: number
  finition?: Finition
  onPorte?: (profil: PublicProfile) => void
}) {
  const [emojiPorte, setEmojiPorte] = useState<string | null>(null)
  const nouveaux = collectionGagnee(avant, apres)
  if (nouveaux.length === 0) return null
  const porterEmoji = async (emoji: string) => {
    try {
      const { profile } = await api.joueur.enregistrer({ avatar: emoji })
      setEmojiPorte(profile.avatar)
      onPorte?.(profile)
      showToast({ kind: 'info', message: `Tu portes ${emoji}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }
  return (
    <section className="card fin-collection">
      <span className="label">{nouveaux.length > 1 ? 'Nouveaux avatars de collection' : 'Nouvel avatar de collection'}</span>
      <div className="fin-collection-emojis">
        {nouveaux.map(e => (
          <div key={e} className="fin-collection-emoji">
            <Avatar avatar={e} finition={finition} />
            {emojiPorte !== e && (
              <button className="btn btn-small" aria-label={`Porter ${e}`} onClick={() => void porterEmoji(e)}>
                Le porter
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">
        {emojiPorte && nouveaux.includes(emojiPorte)
          ? `C’est ${emojiPorte} que la salle verra, dès la prochaine soirée.`
          : 'Réservés aux profils : un emoji à chaque niveau qui n’ouvre pas de finition, jusqu’au 17.'}
      </p>
    </section>
  )
}

/**
 * Un médaillon gagné ce soir, dans son cadre. Si son dessin n'a pas pu venir
 * (`medaillons.ts`), la page ne le chargera plus, et la recharger ne
 * suffirait pas — la fin de soirée a oublié le jeton de l'invité. Son profil,
 * lui, le montre : un lien prend la place du cadre, dont la taille est celle
 * d'un dessin, pas d'un texte.
 */
export function Medaillon({ cle, className }: { cle: string; className: string }) {
  const sortes = sortesDe([cle])
  if (perdus(useDessins(...sortes), sortes)) {
    return (
      <p className="small">
        <a className="link-inline" href="/profil">
          Le voir sur ton profil
        </a>
      </p>
    )
  }
  return (
    <span className={className}>
      <Dessin cle={cle} grand />
    </span>
  )
}

/**
 * Le légendaire qu'une partie vient d'ouvrir — au quiz du jour, en
 * campagne, sur un sentier —, fêté comme en fin de soirée, et qu'on porte
 * d'un toucher.
 */
export function LegendaireOuvert({ cle, dejaPorte }: { cle: string; dejaPorte: boolean }) {
  const [porte, setPorte] = useState(dejaPorte)
  const l = legendaire(cle)
  if (!l) return null
  const porter = async () => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: cle })
      setPorte(profile.legendaire === cle)
      showToast({ kind: 'info', message: `Tu portes ${l.nom}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }
  return (
    <section className="card fin-legendaire">
      <span className="label">Avatar légendaire débloqué</span>
      <Medaillon cle={cle} className="fin-medaillon" />
      <h2>{l.nom}</h2>
      <p className="serif-note">{l.legende}</p>
      {porte ? (
        <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
      ) : (
        <button className="btn btn-primary" onClick={() => void porter()}>
          Le porter
        </button>
      )}
    </section>
  )
}

/** Le tirage en toutes lettres, comme on le dit : « une chance sur quarante ». */
const EN_LETTRES: Record<number, string> = { 20: 'vingt', 40: 'quarante' }

/**
 * L'Éclat tombé — à la fin d'une soirée, d'une partie du quiz du jour, d'un
 * défi de la semaine : ce qui a éclaté, dans sa version rare. Il tombait en
 * silence, et sous un légendaire personne ne le voyait jamais. `avatar` tient
 * la place d'un légendaire ou d'un portrait le temps que son dessin arrive.
 */
export function EclatTombe({ cle, avatar, finition, chance }: { cle: string; avatar: string; finition?: Finition; chance: number }) {
  const dessine = legendaire(cle) ?? portraitDe(cle)
  return (
    <section className="card fin-eclat">
      <span className="label">{`Une chance sur ${EN_LETTRES[chance] ?? chance}`}</span>
      <span className="fin-apparition">
        {dessine ? <Avatar avatar={avatar} legendaire={cle} finition={finition} eclat /> : <Avatar avatar={cle} finition={finition} eclat />}
      </span>
      <h2>{dessine ? `${dessine.nom} a éclaté !` : `Ton ${cle} a éclaté !`}</h2>
      <p className="serif-note">Il a changé de couleurs, pour toujours — et personne d’autre ne l’a comme ça.</p>
    </section>
  )
}

/**
 * Un haut fait ou un palier qui vient de tomber — le Lève-tôt, le
 * Funambule, L'Alpiniste · Argent —, avec ce qu'il a fallu faire : un titre
 * seul ne dit rien à qui ne l'a jamais chassé.
 */
export function RecompenseTombee({ recompense }: { recompense: { key: string; emoji: string; title: string } }) {
  return (
    <div className="jour-ligne">
      <span className="jour-pastille jour-palier" aria-hidden="true">
        {recompense.emoji}
      </span>
      <div>
        <b>{`${palierDe(recompense.key) ? 'Nouveau palier' : 'Nouveau haut fait'} : ${recompense.title}`}</b>
        <span className="muted small">{ceQuIlAFallu(recompense.key)}</span>
      </div>
    </div>
  )
}
