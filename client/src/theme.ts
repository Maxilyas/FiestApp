// Deux habillages pour l'écran commun. « Velours » est celui de la soirée :
// le noir chaud, le champagne, le halo. « Ivoire » est le même passé sur
// papier — fond crème, encre sombre — pour un vidéoprojecteur qui délave les
// noirs au point de rendre l'écran illisible.
//
// Le choix ne concerne que l'écran commun, et il est mémorisé sur le PC de
// l'animateur : les téléphones des invités restent en Velours, le noir y
// ménage les yeux dans une salle sombre.

export type Theme = 'velours' | 'ivoire'

const KEY = 'quizz.theme'

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'ivoire' ? 'ivoire' : 'velours'
  } catch {
    return 'velours'
  }
}

let theme: Theme = read()

export function currentTheme(): Theme {
  return theme
}

/**
 * Pose l'habillage sur la page. La feuille de style est écrite en Velours ;
 * `data-theme="ivoire"` sur <html> redéfinit ses variables, et rien d'autre.
 */
export function applyTheme() {
  document.documentElement.dataset.theme = theme
}

export function toggleTheme(): Theme {
  theme = theme === 'ivoire' ? 'velours' : 'ivoire'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Stockage indisponible : le choix vaut pour cette page, sans plus.
  }
  applyTheme()
  return theme
}
