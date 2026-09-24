// Les mots maison de FiestApp, et ce qu'ils veulent dire — une phrase chacun.
//
// La tablée du 24 septembre 2026 a buté sur « souvenir », « bilan », « coup
// d'œil », « biais »… Un `title` ne s'affiche pas au toucher : ces définitions
// se lisent dans une légende qu'on déplie (`Glossaire.tsx`), là où les mots
// apparaissent le plus. Une seule source, pour qu'un mot se définisse partout
// de la même façon.
//
// Les Divins n'y ont que leur nom et leur mystère : leurs règles et leurs
// légendes ne quittent jamais le serveur (invariant 21), et `mots.test.ts`
// vérifie qu'aucune n'a glissé ici.

export type Mot =
  | 'souvenir'
  | 'bilan'
  | 'historique'
  | 'carte'
  | 'prix'
  | 'palmares'
  | 'hautsFaits'
  | 'paliers'
  | 'legendaire'
  | 'divin'
  | 'finition'
  | 'eclat'
  | 'xp'
  | 'niveau'
  | 'precision'
  | 'coupDOeil'
  | 'reflexe'
  | 'flair'

export interface Definition {
  /** Le mot tel qu'il s'affiche. */
  terme: string
  /** Une phrase, au tu, qui se lit au téléphone sans défiler. */
  sens: string
}

export const GLOSSAIRE: Record<Mot, Definition> = {
  souvenir: { terme: 'Souvenir', sens: 'La page de la soirée, pour tout le monde : podium, prix et chiffres.' },
  bilan: { terme: 'Bilan', sens: 'Tes réponses, question par question, à côté de celles de la salle.' },
  historique: { terme: 'Historique', sens: 'Toutes les soirées closes de cet espace, chacune avec son souvenir et son bilan.' },
  carte: { terme: 'Carte', sens: 'Ce qu’on voit en touchant un prénom : son niveau, ses prix, sa soirée.' },
  prix: { terme: 'Prix', sens: 'Une distinction de la soirée, pour rire : décernée par les chiffres, ou à la main.' },
  palmares: { terme: 'Palmarès', sens: 'Les prix que les chiffres de la soirée désignent tout seuls.' },
  hautsFaits: { terme: 'Hauts faits', sens: 'Ce que tu as réussi — ou raté avec panache — pendant une soirée.' },
  paliers: { terme: 'Paliers', sens: 'Bronze, argent, or : un haut fait cumulé sur toutes tes soirées.' },
  legendaire: { terme: 'Avatar légendaire', sens: 'Un des douze avatars dessinés, débloqué par des hauts faits.' },
  divin: { terme: 'Divins', sens: 'Cinq avatars secrets. Personne ne sait ce qui les fait descendre.' },
  finition: { terme: 'Finition', sens: 'Le cadre autour de ton avatar, que toute la salle voit. Il se gagne au niveau.' },
  eclat: { terme: 'Éclat', sens: 'Une chance sur quarante, à chaque soirée jouée à deux ou plus : ton avatar change de couleurs.' },
  xp: { terme: 'XP', sens: 'L’expérience, gagnée en jouant avec un profil. Elle fait monter de niveau.' },
  niveau: { terme: 'Niveau', sens: 'Il monte avec l’XP, et ne redescend jamais. Il ne donne aucun avantage de jeu.' },
  precision: { terme: 'Précision', sens: 'La part de bonnes réponses aux QCM. Une estimation ne compte pas.' },
  coupDOeil: { terme: 'Coup d’œil', sens: 'Aux estimations : la part de la salle que les tiennes battent ou égalent.' },
  reflexe: { terme: 'Réflexe', sens: 'Ton temps moyen sur tes bonnes réponses.' },
  flair: { terme: 'Flair', sens: 'La part de tes bonnes réponses données quand la majorité se trompait.' },
}
