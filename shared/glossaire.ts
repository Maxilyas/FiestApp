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
//
// Les mots du Cabinet de curiosités (« œuvre », « carte-bonus »…) disent leurs
// chiffres par son barème, jamais recopiés : un barème changé change aussi ce
// que le glossaire promet.

import { ETOILES_PAR_MANCHE, MANCHES_PAR_PARTIE } from './cabinet/bareme'

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
  | 'ecusson'
  | 'laurier'
  | 'serie'
  | 'fond'
  | 'ligue'
  // Les mots du Cabinet de curiosités.
  | 'oeuvre'
  | 'salle'
  | 'gardien'
  | 'cartel'
  | 'poussiere'
  | 'cadreDore'
  | 'carteBonus'
  | 'visite'
  | 'chasse'
  | 'manche'

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
  legendaire: { terme: 'Avatar légendaire', sens: 'Un avatar dessiné, débloqué par des hauts faits, au quiz du jour ou à sa saison.' },
  divin: { terme: 'Divins', sens: 'Six avatars secrets. Personne ne sait ce qui les fait descendre.' },
  finition: { terme: 'Finition', sens: 'Le cadre autour de ton avatar, que toute la salle voit. Il se gagne au niveau.' },
  eclat: { terme: 'Éclat', sens: 'Une chance sur 40 par soirée à deux ou quiz du jour, sur 20 au défi : ton avatar change de couleurs.' },
  xp: { terme: 'XP', sens: 'L’expérience, gagnée en jouant avec un profil. Elle fait monter de niveau.' },
  niveau: { terme: 'Niveau', sens: 'Il monte avec l’XP, et ne redescend pas pendant une soirée. Il ne donne aucun avantage de jeu.' },
  precision: { terme: 'Précision', sens: 'La part de bonnes réponses aux QCM. Une estimation ne compte pas.' },
  coupDOeil: { terme: 'Coup d’œil', sens: 'Aux estimations : la part de la salle que les tiennes battent ou égalent.' },
  reflexe: { terme: 'Réflexe', sens: 'Ton temps moyen sur tes bonnes réponses.' },
  flair: { terme: 'Flair', sens: 'La part de tes bonnes réponses données quand la majorité se trompait.' },
  ecusson: { terme: 'Écussons de savoir', sens: 'Tes bonnes réponses dans une catégorie — soirées, quiz du jour, campagne : bronze, argent, or.' },
  laurier: { terme: 'Laurier', sens: 'Après le prénom du vainqueur du quiz du jour d’hier — et, en argent, du défi de la semaine passée.' },
  serie: { terme: 'Série', sens: 'Les jours d’affilée où tu as joué, au quiz du jour ou en soirée. Minuit la casse.' },
  fond: { terme: 'Fond de carte', sens: 'Le décor derrière ta carte, quand on touche ton prénom. Il se gagne, comme un titre.' },
  ligue: { terme: 'Ligue', sens: 'Ta place aux duels, selon ta cote : du bronze aux maîtres, une tous les cent points.' },
  oeuvre: { terme: 'Œuvre', sens: 'Une peinture de ton musée, gagnée en jouant ou achetée. Une œuvre à toi ne se perd jamais.' },
  salle: { terme: 'Salle', sens: 'Un mur du Cabinet : une famille de huit œuvres, ou les vingt du Vestibule.' },
  gardien: { terme: 'Gardien', sens: 'Un légendaire qui veille sur une salle : complète, elle le réveille ; toute dorée, un second.' },
  cartel: { terme: 'Cartel', sens: 'La plaque sous une œuvre : ce que tu as appris en la gagnant.' },
  poussiere: { terme: 'Poussière d’or', sens: 'La monnaie du Cabinet, qui n’en sort jamais : chaque partie en rapporte, même ratée.' },
  cadreDore: { terme: 'Cadre doré', sens: 'Trois manches parfaites sans qu’un pouvoir ait servi, ou de la poussière d’or.' },
  carteBonus: { terme: 'Carte-bonus', sens: 'Une œuvre ou un gardien que tu emportes en partie pour son pouvoir. Elle ne s’use jamais.' },
  visite: { terme: 'Visite du jour', sens: 'Les parties proposées chaque jour : chacune peut te faire gagner une œuvre, gardée secrète.' },
  chasse: { terme: 'Chasse', sens: 'Partir chercher l’œuvre de ton choix au jeu où elle se trouve, ou rejouer une œuvre à dorer.' },
  manche: { terme: 'Manche', sens: `Un tour d’un jeu du Cabinet : ${MANCHES_PAR_PARTIE} par partie, ${ETOILES_PAR_MANCHE} étoiles au plus chacune.` },
}
