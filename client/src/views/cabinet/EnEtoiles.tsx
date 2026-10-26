import { Fragment, type ReactNode } from 'react'

// Les étoiles d'un barème, à l'œil et à l'oreille. Les barèmes du Cabinet se
// composent en glyphes (`JEUX`, `MOTS_DU_PARI`, `shared/cabinet/jeux/regle.ts`) :
// « Garder ★★ », « en 1 ou 2 essais ★★★ · 3 ou 4 ★★ ». L'œil les lit d'un
// coup ; le lecteur d'écran disait « étoile noire, étoile noire » (Hugo, à la
// tablée du 25 octobre 2026). Les glyphes restent à l'écran, cachés à
// l'oreille, qui entend « 2 étoiles » à leur place ; les barèmes, eux, ne
// changent pas — ils se composent toujours des chiffres du barème.

/** « 1 étoile », « 3 étoiles » : un nombre d'étoiles en mots, accordé. */
export const etoilesDites = (n: number): string => `${n} étoile${n > 1 ? 's' : ''}`

/** Une suite d'étoiles, dans un texte du barème. */
const ETOILES = /★+/g

/**
 * Après un nombre, l'oreille a besoin d'une virgule : « 3 ou 4 ★★ » se serait
 * entendu « 3 ou 4 2 étoiles ». Après un mot (« Garder ★★ », « petit filet
 * ★★★ »), rien.
 */
const apresUnNombre = (avant: string) => /\d\s*$/.test(avant)

/** La flèche d'un barème (« Parier → ★★★ ») : à l'oreille, « pour » — le lecteur d'écran disait « flèche droite ». */
const FLECHE = /\s*→\s*/g

/**
 * Un texte du barème tel que l'oreille l'entend — le nom d'un bouton (`aria-label`) : chaque suite d'étoiles dite en mots, la
 * flèche dite « pour ». Le nom de « Parier » s'écrivait à la main, à côté de celui de « Garder », tiré du barème : un verbe
 * retouché dans `motsDuPari` aurait changé l'écran sans changer l'oreille (la relecture du lot page-2).
 */
export function aLOreille(texte: string): string {
  const t = texte.replace(FLECHE, ' pour ')
  return t.replace(ETOILES, (glyphes: string, ou: number) => `${apresUnNombre(t.slice(0, ou)) ? ', ' : ''}${etoilesDites(glyphes.length)}`).replace(/\s+,/g, ',')
}

/**
 * Un texte du barème à l'écran : ses étoiles en glyphes pour l'œil, en mots pour l'oreille. D'un seul tenant : posés à même un
 * bouton, qui range ses enfants en flex, ses morceaux devenaient chacun un élément — « Parier → » passait sur deux lignes, ses
 * étoiles à part, écartées de l'espace d'une icône.
 */
export function EnEtoiles({ texte }: { texte: string }) {
  const morceaux: ReactNode[] = []
  let suite = 0
  for (const m of texte.matchAll(ETOILES)) {
    const ou = m.index ?? 0
    morceaux.push(texte.slice(suite, ou))
    morceaux.push(
      <Fragment key={ou}>
        <span aria-hidden="true">{m[0]}</span>
        <span className="sr-only">{`${apresUnNombre(texte.slice(0, ou)) ? ', ' : ''}${etoilesDites(m[0].length)}`}</span>
      </Fragment>,
    )
    suite = ou + m[0].length
  }
  morceaux.push(texte.slice(suite))
  return <span>{morceaux}</span>
}
