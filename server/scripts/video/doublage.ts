// Le doublage de la vidéo de promotion : la voix d'un paresseux bavard qui
// zozote (le souhait du propriétaire, le 5 novembre 2026), réplique par
// réplique, à la seconde de la vidéo où elle se dit. La bande rythmo
// (`rythmo.html`) les fait défiler sous l'image ; la feuille de route du
// doubleur, un document à part, en recopie le texte.
//
// Les instants suivent l'histoire de `montage.html` : « Mars ! » tombe sur le
// doigt qui le touche, « Z'est Nina » sur le podium, « Cosmos ! » sur le thème
// qui paraît. Une scène qui bouge dans le montage déplace ses répliques ici :
// rien ne les recale d'office.

/**
 * Une réplique : ce qui se dit de `de` à `a` (en secondes de la vidéo), et le
 * jeu qui la précède — ce qui ne se dit pas, écrit au-dessus d'elle. Un texte
 * vide porte un jeu seul (le bâillement de la fin).
 */
export interface Replique {
  de: number
  a: number
  texte: string
  jeu?: string
}

/**
 * Ce que la bande déroule avant la vidéo : une seconde « Prêt ? », puis trois
 * bips, un par seconde (`BIPS`, en secondes de la vidéo), et la vidéo part au
 * quatrième temps. Le doubleur claque des mains au troisième : son clap, dans
 * la prise, cale la voix sur l'image.
 */
export const AVANT_LA_VIDEO = 4
export const BIPS: readonly number[] = [-3, -2, -1]

/** Ce que la bande déroule encore après la dernière image : le temps de finir une prise sans couper la fin. */
export const APRES_LA_VIDEO = 1

export const REPLIQUES: readonly Replique[] = [
  // L'ouverture : il arrive en retard.
  { de: 0.35, a: 1.15, texte: 'Attendez-moi !', jeu: 'essoufflé, il arrive en courant' },
  { de: 1.35, a: 1.85, texte: 'Ze suis là…' },
  { de: 2.05, a: 2.85, texte: 'Ah ! FiestApp !', jeu: 'fier' },
  // Sans compte : Nina touche « Jouer sans compte » à 4,8 s.
  { de: 4.0, a: 5.0, texte: 'Pas besoin de compte ?' },
  { de: 5.25, a: 5.75, texte: 'Tant mieux…' },
  { de: 6.0, a: 7.1, texte: 'ze sais pas compter !', jeu: 'tout content' },
  // La planète rouge : la question à 8,05 s, le doigt sur Mars à 9,25 s.
  { de: 8.15, a: 9.0, texte: 'La planète rouge…' },
  { de: 9.25, a: 9.6, texte: 'Mars !', jeu: 'il réfléchit très fort' },
  { de: 9.75, a: 10.85, texte: "Ze l'avais sur le bout d'la griffe !" },
  // La révélation : +200 à 10,75 s, le podium et Nina première à 12,95 s.
  { de: 11.05, a: 11.7, texte: 'Deux cents points !', jeu: 'il exulte' },
  { de: 11.85, a: 12.6, texte: 'Ze suis un zénie !' },
  { de: 12.95, a: 13.35, texte: '…Ah non.', jeu: 'déçu' },
  { de: 13.5, a: 14.2, texte: "Z'est Nina." },
  // Entre deux soirées.
  { de: 15.4, a: 16.2, texte: 'La fête est finie ?' },
  { de: 16.4, a: 16.95, texte: 'Zamais !', jeu: 'paniqué' },
  // Le quiz du jour : le doigt sur La Loire à 21,9 s, la fin et sa série de treize jours à 23,7 s.
  { de: 18.0, a: 18.8, texte: 'Le quiz du zour :' },
  { de: 19.2, a: 20.6, texte: "dix questions, pile mon quota d'effort !" },
  { de: 21.85, a: 22.35, texte: 'La Loire !', jeu: 'sûr de lui' },
  { de: 23.9, a: 24.9, texte: 'Treize zours de série…', jeu: 'admiratif' },
  { de: 25.1, a: 26.5, texte: "Moi, mon record, z'est treize heures de sieste." },
  // Le défi de la semaine : sa page à 28,4 s, « Niveau 23 ! » à 31,1 s.
  { de: 26.9, a: 27.85, texte: 'Le défi de la semaine :' },
  { de: 28.4, a: 29.25, texte: 'une seule tentative…' },
  { de: 29.4, a: 30.55, texte: 'comme ma demande en mariaze.', jeu: 'soupir' },
  { de: 31.35, a: 32.25, texte: 'Oh ! Niveau vingt-trois !', jeu: 'il renifle, puis ravi' },
  // La campagne.
  { de: 32.55, a: 33.55, texte: 'Trois vies, zéro chrono :' },
  { de: 33.75, a: 34.3, texte: 'enfin un zeu' },
  { de: 34.6, a: 36.6, texte: 'à… ma… vi-tesse.', jeu: 'très lentement' },
  // Le Cabinet de curiosités : ses gardiens à 38,65 s.
  { de: 37.5, a: 38.75, texte: 'Le Cabinet de curiosités…' },
  { de: 38.95, a: 39.55, texte: 'Trois gardiens ?' },
  { de: 40.0, a: 41.6, texte: "Quelqu'un veut y aller à ma place ?", jeu: 'voix qui tremble' },
  // Les légendaires, qui paraissent de 43,05 s à 44,2 s.
  { de: 43.1, a: 44.6, texte: 'Phénix… dragon… licorne…', jeu: 'émerveillé' },
  { de: 44.9, a: 46.2, texte: 'Et le paresseux, il est où ?', jeu: 'vexé' },
  // La carte à 48,35 s, puis les thèmes : Cosmos à 49,95 s, Jungle à 50,37 s, Théâtre à 50,78 s.
  { de: 48.2, a: 49.3, texte: 'Ta carte, tes thèmes…' },
  { de: 49.95, a: 50.35, texte: 'Cosmos !' },
  { de: 50.4, a: 50.75, texte: 'Zungle !' },
  { de: 50.8, a: 51.2, texte: 'Théâtre !' },
  { de: 51.4, a: 52.5, texte: "Ze sais plus où z'habite !", jeu: 'étourdi' },
  // La fin : la marque à 53,6 s, ses pastilles juste après.
  { de: 53.6, a: 54.2, texte: 'FiestApp :' },
  { de: 54.4, a: 55.9, texte: 'gratuit, sans compte, rien à installer…' },
  { de: 56.0, a: 57.3, texte: 'Le zeu idéal pour un paresseux !' },
  { de: 57.35, a: 57.6, texte: '', jeu: 'il bâille' },
]
