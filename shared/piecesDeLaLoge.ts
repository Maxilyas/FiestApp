// Les six pièces de la loge, sans rien d'autre : la page du profil les montre
// dès qu'elle a le profil — sa carte et sa rangée —, avant que les règles de
// l'essai (`shared/loge.ts`, qui tire tous les catalogues) n'arrivent avec
// ses panneaux. Dans `shared/loge.ts`, elles faisaient attendre toute la
// carte au profil qui s'ouvre.

export type PieceDeLaLoge = 'avatar' | 'titre' | 'vitrine' | 'fond' | 'theme' | 'gerbe'

/**
 * Les six pièces, dans l'ordre de leur rangée : ce que la salle voit d'abord,
 * puis ce que lui seul voit. `qui` le redit sous la rangée, en une ligne :
 * qui le voit, et où.
 */
export const PIECES_DE_LA_LOGE: readonly { id: PieceDeLaLoge; nom: string; groupe: 'salle' | 'moi'; qui: string }[] = [
  { id: 'avatar', nom: 'Avatar', groupe: 'salle', qui: 'La salle le voit, à côté de ton prénom.' },
  { id: 'titre', nom: 'Titre', groupe: 'salle', qui: 'Sous ton prénom, sur ta carte.' },
  { id: 'vitrine', nom: 'Vitrine', groupe: 'salle', qui: 'Trois trophées, sur ta carte.' },
  { id: 'fond', nom: 'Fond', groupe: 'salle', qui: 'Derrière ta carte : rien d’autre ne change.' },
  { id: 'theme', nom: 'Thème', groupe: 'moi', qui: 'Toi seul le vois : il habille tes pages.' },
  { id: 'gerbe', nom: 'Gerbe', groupe: 'moi', qui: 'Toi seul la vois, à tes bonnes réponses.' },
]

export function estUnePieceDeLaLoge(x: unknown): x is PieceDeLaLoge {
  return PIECES_DE_LA_LOGE.some(p => p.id === x)
}
