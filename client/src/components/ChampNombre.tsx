import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { entierBorne, lireNombre, valeurEnQuittant } from '../../../shared/nombres'

/**
 * Un champ où l'on tape un nombre entier : le temps d'une question, les
 * points d'un prix, le nombre d'invités.
 *
 * Ces champs étaient lus par `Number(e.target.value)` et réaffichaient la
 * valeur lue : on effaçait « 20 », `Number('')` valait 0, le champ se
 * remplissait de nouveau — et le 45 qu'on tapait derrière donnait « 2045 »,
 * ramené à 120 s sans un mot (tablée du 24 septembre : Nadia, Léa, Marc).
 * Le champ garde maintenant le texte tapé, vide compris ; seule la valeur
 * lue (`lireNombre`, CLAUDE.md) remonte. Les bornes s'appliquent quand on
 * quitte le champ, jamais à chaque frappe : borner « 4 », en route vers 45,
 * c'était déjà écrire 5.
 */
export function ChampNombre({
  valeur,
  min,
  max,
  onValeur,
  className = 'input',
  ...reste
}: {
  valeur: number
  min: number
  max: number
  /**
   * Chaque valeur lisible, telle qu'on la tape — hors bornes comprise, que
   * la question peut dire (« de 5 à 120 s ») —, puis la valeur bornée quand
   * on quitte le champ.
   */
  onValeur: (n: number) => void
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'>) {
  const [texte, setTexte] = useState(() => String(valeur))
  useEffect(() => {
    // Une valeur changée ailleurs — « Régler tout le quiz », une annulation —
    // revient au champ ; celle qu'on tape garde son texte.
    if (lireNombre(texte) !== valeur) setTexte(String(valeur))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur])

  const lu = lireNombre(texte)
  const horsBornes = lu === null || lu < min || lu > max
  // La valeur d'avant la frappe : vidé puis quitté, le champ y revient — pas
  // au « 2 » émis en route quand on effaçait « 20 » (voir `valeurEnQuittant`).
  const auFocus = useRef<number | null>(null)

  const quitter = () => {
    const n = valeurEnQuittant(texte, auFocus.current ?? valeur, min, max)
    setTexte(String(n))
    if (n !== valeur) onValeur(n)
    return n
  }

  return (
    <input
      {...reste}
      className={className}
      // Du texte, pas `type="number"` : un champ numérique rend "" pour « 4, »
      // ou « - » en cours de frappe, et le navigateur y ajoute ses flèches.
      type="text"
      inputMode={min < 0 ? 'text' : 'numeric'}
      autoComplete="off"
      aria-invalid={horsBornes || undefined}
      value={texte}
      onChange={e => {
        setTexte(e.target.value)
        const n = lireNombre(e.target.value)
        if (n !== null && n !== valeur) onValeur(n)
      }}
      onFocus={e => {
        auFocus.current = valeur
        reste.onFocus?.(e)
      }}
      onBlur={e => {
        quitter()
        auFocus.current = null
        reste.onBlur?.(e)
      }}
      onKeyDown={e => {
        // Entrée valide un formulaire sans quitter le champ : on borne d'abord.
        if (e.key === 'Enter') auFocus.current = quitter()
        // Les flèches du clavier, comme dans un champ numérique.
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const n = entierBorne((lu ?? auFocus.current ?? valeur) + (e.key === 'ArrowUp' ? 1 : -1), min, max)
          setTexte(String(n))
          if (n !== valeur) onValeur(n)
        }
        reste.onKeyDown?.(e)
      }}
    />
  )
}
