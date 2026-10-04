import { useState } from 'react'
import type { Finition, PublicProfile } from '../../../shared/profil'
import { brancheDe, nomDansLaPhrase, portrait as portraitDe, type Portrait } from '../../../shared/branches'
import { collectionGagnee } from '../../../shared/avatars'
import { api } from '../api'
import { showToast } from '../state'
import { Avatar, Dessin } from './Avatar'
import { perdus, sortesDe, useDessins } from './medaillons'

// Ce qu'une partie vient d'ouvrir, qu'on porte d'ici : à la fin d'une
// soirée (`FinDeSoiree.tsx`) comme à la fin du quiz du jour (`JourApp.tsx`).
// À part de la fin de soirée : le quiz du jour l'importait pour ces trois
// composants, et téléchargeait toute la fin de soirée à chaque ouverture de
// sa page.

/**
 * Les portraits des branches que la soirée — ou la partie du quiz du jour —
 * vient d'ouvrir, qu'on porte d'ici. Presque chaque soirée en ouvre un, et
 * la première en ouvre souvent plusieurs : ils tiennent dans une rangée, pas
 * dans une carte chacun comme un légendaire, qui reste l'événement.
 */
export function PortraitsOuverts({
  cles,
  porte,
  onPorte,
}: {
  cles: readonly string[]
  /** L'avatar dessiné qu'il porte déjà. */
  porte: string | null
  onPorte?: (profil: PublicProfile) => void
}) {
  const [porteIci, setPorteIci] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const portraits = cles.map(c => portraitDe(c)).filter((p): p is Portrait => !!p)
  if (portraits.length === 0) return null
  const actuel = porteIci ?? porte
  const porter = async (p: Portrait) => {
    if (busy) return
    setBusy(true)
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: p.key })
      setPorteIci(profile.legendaire)
      onPorte?.(profile)
      showToast({ kind: 'info', message: `Tu portes ${nomDansLaPhrase(p.nom)}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card fin-portraits">
      <span className="label">{portraits.length > 1 ? 'Nouveaux avatars du savoir' : 'Nouvel avatar du savoir'}</span>
      <div className="fin-portraits-liste">
        {portraits.map(p => (
          <div key={p.key} className="fin-portrait">
            <Medaillon cle={p.key} className="fin-portrait-dessin" />
            <b>{p.nom}</b>
            <span className="muted small">{`${p.seuil} bonnes réponses en ${brancheDe(p).categorie}`}</span>
            {actuel === p.key ? (
              <span className="muted small">C’est lui que la salle verra.</span>
            ) : (
              <button
                type="button"
                className="btn btn-small"
                aria-label={`Porter ${nomDansLaPhrase(p.nom)}`}
                aria-disabled={busy || undefined}
                onClick={() => void porter(p)}
              >
                Le porter
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">Chaque bonne réponse fait avancer la branche de sa catégorie, en soirée comme au quiz du jour.</p>
    </section>
  )
}

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
