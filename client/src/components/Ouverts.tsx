import { useState } from 'react'
import type { Finition } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { nomDansLaPhrase, portrait as portraitDe } from '../../../shared/branches'
import { compagnonDe, formeDeCompagnon, type FormeDeCompagnon } from '../../../shared/compagnons'
import { api } from '../api'
import { espacesFines } from '../format'
import { showToast } from '../state'
import { Avatar, Dessin } from './Avatar'
import { perdus, sortesDe, useDessins } from './medaillons'

// Ce qu'une partie vient d'ouvrir de grand, qu'on porte d'ici — un
// légendaire, l'Éclat, et le médaillon d'un Divin — : à la fin d'une soirée
// (`FinDeSoiree.tsx`), du quiz du jour (`JourApp.tsx`), d'une série de
// campagne ou d'un défi (`CampagneApp.tsx`) ou d'une épreuve des sentiers.
// À part de la fin de soirée : le quiz du jour l'importait pour ces
// composants, et téléchargeait toute la fin de soirée à chaque ouverture de
// sa page. Le reste — l'expérience, les trophées, ce qu'ils ouvrent, les
// emojis de collection — passe par l'écran de gains de tous les modes
// (`Gains.tsx`).

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
  // Un compagnon porté éclate aussi (`cibleEclat`) : sans lui, sa clé s'écrivait en toutes lettres — « Ton cp:loup-jeune a éclaté ! ».
  const compagnon = formeDeCompagnon(cle)
  const dessine = legendaire(cle) ?? portraitDe(cle) ?? compagnon
  // L'Éclat tombe sur ce qu'il porte : sa forme ultime portée, il l'a atteinte, et sa métamorphose s'ouvre maintenant.
  const ouverte = compagnon && compagnon.rang === 3 && !compagnon.metamorphose ? compagnon : null
  return (
    <>
      <section className="card fin-eclat">
        <span className="label">{`Une chance sur ${EN_LETTRES[chance] ?? chance}`}</span>
        <span className="fin-apparition">
          {dessine ? <Avatar avatar={avatar} legendaire={cle} finition={finition} eclat /> : <Avatar avatar={cle} finition={finition} eclat />}
        </span>
        <h2>{dessine ? `${dessine.nom} a éclaté !` : `Ton ${cle} a éclaté !`}</h2>
        {/* Un compagnon n'a pas de version rare : ses paillettes le suivent sous toutes ses formes (`clesQuiBrillent`), et sa forme ultime ouvre sa métamorphose. */}
        <p className="serif-note">
          {compagnon ? 'Il brille, désormais, sous toutes ses formes — et personne d’autre ne l’a comme ça.' : 'Il a changé de couleurs, pour toujours — et personne d’autre ne l’a comme ça.'}
        </p>
        {compagnon && !ouverte && !compagnon.metamorphose && (
          <p className="muted small">{espacesFines(`Dès sa forme ultime, l’Éclat lui ouvre sa métamorphose : ${nomDansLaPhrase(compagnonDe(compagnon).lumiere.nom)}.`)}</p>
        )}
      </section>
      {ouverte && <MetamorphoseOuverte forme={ouverte} />}
    </>
  )
}

/**
 * La métamorphose que l'Éclat vient d'ouvrir, sous sa carte : elle s'ajoute
 * à ses formes et ne remplace rien (le propriétaire, le 19 octobre 2026 :
 * « je veux que ce soit un choix ») — sa forme ultime reste telle quelle, et
 * on la porte d'ici, ou plus tard : la loge et sa niche la marquent neuve
 * tant qu'il ne l'a pas vue.
 */
function MetamorphoseOuverte({ forme }: { forme: FormeDeCompagnon }) {
  const [porte, setPorte] = useState(false)
  const m = compagnonDe(forme).lumiere
  const porter = async () => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: m.key })
      setPorte(profile.legendaire === m.key)
      showToast({ kind: 'info', message: `Tu portes ${nomDansLaPhrase(m.nom)}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }
  return (
    <section className="card fin-legendaire fin-metamorphose">
      <span className="label">Sa métamorphose s’ouvre</span>
      <Medaillon cle={m.key} className="fin-medaillon" />
      <h2>{m.nom}</h2>
      <p className="serif-note">{m.legende}</p>
      {porte ? (
        <p className="muted small">C’est elle que la salle verra, dès la prochaine soirée.</p>
      ) : (
        <button className="btn btn-primary" onClick={() => void porter()}>
          Le porter
        </button>
      )}
      <p className="muted small">{espacesFines('Elle s’ajoute à ses formes, sans rien remplacer : la loge et ta niche te la proposent.')}</p>
    </section>
  )
}
