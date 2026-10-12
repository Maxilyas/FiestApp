import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ALLURE_PAR_DEFAUT, gerbe as gerbeDuCatalogue, type AllureDeGerbe, type Gerbe } from '../../../shared/gerbes'
import { gerbePortee } from '../gerbe'

/** Une particule, tirée une fois : où elle part, quand, combien de temps, de quelle taille. */
export interface Particule {
  i: number
  x: number
  delai: number
  duree: number
  tour: number
  ecart: number
  /** Sa taille, en part de la plus grande de la gerbe : de quoi la réduire, jamais l'agrandir. */
  echelle: number
}

/** Ses particules, tirées une fois à l'allure de la gerbe : un ballon flotte, une étincelle file. */
export function tirerLesParticules({ nombre, taille, duree }: AllureDeGerbe): Particule[] {
  return Array.from({ length: nombre }, (_, i) => ({
    i,
    x: 4 + Math.random() * 92,
    delai: Math.random() * 0.3,
    duree: duree[0] + Math.random() * (duree[1] - duree[0]),
    tour: Math.round((Math.random() * 2 - 1) * 300),
    ecart: Math.round((Math.random() * 2 - 1) * 60),
    echelle: (taille[0] + Math.random() * (taille[1] - taille[0])) / taille[1],
  }))
}

/**
 * La gerbe d'une bonne réponse : ses particules éclatent par-dessus l'écran,
 * une fois, puis s'effacent — posée dans le bandeau d'une bonne réponse, elle
 * joue à son apparition. Rien ne se touche à travers elle, rien ne la dit au
 * lecteur d'écran : c'est un décor. Elle ne bouge que par `transform` et
 * `opacity`, et se tait si le système demande moins de mouvement.
 *
 * `cle` : une gerbe à montrer — l'aperçu de « Mon thème » ; sinon celle que
 * porte le profil connecté ici (`gerbe.ts`), et rien pour l'anonyme.
 */
export function GerbeDeJuste({ cle }: { cle?: string }) {
  const g = gerbeDuCatalogue(cle ?? gerbePortee())
  // Tirées une fois : une nouvelle diffusion de la même révélation ne relance rien.
  const [particules] = useState(() => tirerLesParticules(g?.allure ?? ALLURE_PAR_DEFAUT))
  if (!g || typeof document === 'undefined') return null
  // Posée sur la page, pas dans le bandeau : une carte à `backdrop-filter`
  // devient le repère d'un `position: fixed`, et la gerbe s'y rognait.
  return createPortal(<GerbeVue g={g} particules={particules} />, document.body)
}

/**
 * La gerbe elle-même, hors de son portail. Toutes ses particules partagent la
 * police de la plus grande (`--taille`, posée une fois), et chacune prend sa
 * taille par `transform` (`--echelle`) : une taille de police par particule,
 * c'étaient vingt-deux emojis à mettre en forme à vingt-deux tailles — la
 * révélation d'une bonne réponse attendait 100 à 230 ms derrière, au
 * processeur d'un téléphone moyen (`gerbes.test.ts`). Réduite, jamais
 * agrandie, une particule reste nette.
 */
export function GerbeVue({ g, particules }: { g: Gerbe; particules: readonly Particule[] }) {
  const { taille } = g.allure ?? ALLURE_PAR_DEFAUT
  return (
    <span className={`gerbe gerbe-${g.mouvement}`} style={{ '--taille': taille[1] } as CSSProperties} aria-hidden="true">
      {particules.map(p => (
        <i
          key={p.i}
          style={
            {
              '--x': `${p.x}%`,
              '--delai': `${p.delai}s`,
              '--duree': `${p.duree}s`,
              '--tour': `${p.tour}deg`,
              '--ecart': `${p.ecart}px`,
              '--echelle': p.echelle,
            } as CSSProperties
          }
        >
          {g.particules[p.i % g.particules.length]}
        </i>
      ))}
    </span>
  )
}
