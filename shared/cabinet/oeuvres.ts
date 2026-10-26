// Les œuvres du Cabinet de curiosités : les 84 cartes peintes des rencontres
// de l'Expédition, sans les légendaires — « garder toutes les cartes que l'on
// a pu générer pour la collection : ça peut être ça les objets du musée à
// collectionner » (le propriétaire, le 24 octobre 2026). Leur peinture vit
// dans `client/public/cartes`, sous la table de la chaîne `peindre`.
//
// Une copie légère plutôt qu'un import : la page du musée ne doit pas tirer
// les 4 782 lignes de `shared/rencontres.ts`, qui partira avec l'Expédition.
// `cabinet-catalogue.test.ts` relit chaque nom, chaque famille et chaque
// rareté contre le catalogue des rencontres, et chaque peinture.
//
// Deux tables se gèlent (invariant 22) : les œuvres de départ, que tout profil
// possède par règle, et le jeu de chaque œuvre. Une œuvre entrée chez un
// joueur n'en sort jamais.

import type { CleDeJeu } from './jeux/regle'
import type { CleDeSalle } from './salles'

/** La rareté d'une œuvre — jamais légendaire : un légendaire est un gardien. */
export type Rarete = 'commun' | 'rare' | 'maudit' | 'epique'

/** Les raretés, de la plus courante à la plus rare ; la maudite, forte, a la place d'une rare. */
export const RARETES: readonly Rarete[] = ['commun', 'rare', 'maudit', 'epique']

interface OeuvreEcrite {
  cle: string
  nom: string
  salle: CleDeSalle
  rarete: Rarete
}

/** Salle par salle, dans l'ordre des rencontres : chaque famille, ses communes, ses rares, ses épiques. */
const OEUVRES_ECRITES = [
  // L'Érudit
  { cle: 'plume', nom: 'Plume', salle: 'erudit', rarete: 'commun' },
  { cle: 'savoir-faire', nom: 'Savoir-faire', salle: 'erudit', rarete: 'commun' },
  { cle: 'memoire', nom: 'Mémoire', salle: 'erudit', rarete: 'commun' },
  { cle: 'bibliotheque', nom: 'Bibliothèque', salle: 'erudit', rarete: 'rare' },
  { cle: 'lecon', nom: 'Leçon', salle: 'erudit', rarete: 'rare' },
  { cle: 'expose', nom: 'Exposé', salle: 'erudit', rarete: 'rare' },
  { cle: 'encyclopedie', nom: 'Encyclopédie', salle: 'erudit', rarete: 'epique' },
  { cle: 'genie', nom: 'Génie', salle: 'erudit', rarete: 'epique' },
  // Le Devin
  { cle: 'lucidite', nom: 'Lucidité', salle: 'devin', rarete: 'commun' },
  { cle: 'augure', nom: 'Augure', salle: 'devin', rarete: 'commun' },
  { cle: 'presage', nom: 'Présage', salle: 'devin', rarete: 'commun' },
  { cle: 'troisieme-oeil', nom: 'Troisième œil', salle: 'devin', rarete: 'rare' },
  { cle: 'voyance', nom: 'Voyance', salle: 'devin', rarete: 'rare' },
  { cle: 'astrolabe', nom: 'Astrolabe', salle: 'devin', rarete: 'rare' },
  { cle: 'vision', nom: 'Vision', salle: 'devin', rarete: 'epique' },
  { cle: 'revelation', nom: 'Révélation', salle: 'devin', rarete: 'epique' },
  // Le Rempart
  { cle: 'parade', nom: 'Parade', salle: 'rempart', rarete: 'commun' },
  { cle: 'muraille', nom: 'Muraille', salle: 'rempart', rarete: 'commun' },
  { cle: 'pansement', nom: 'Pansement', salle: 'rempart', rarete: 'commun' },
  { cle: 'contre-attaque', nom: 'Contre-attaque', salle: 'rempart', rarete: 'rare' },
  { cle: 'cuirasse', nom: 'Cuirasse', salle: 'rempart', rarete: 'rare' },
  { cle: 'second-souffle', nom: 'Second souffle', salle: 'rempart', rarete: 'rare' },
  { cle: 'bastion', nom: 'Bastion', salle: 'rempart', rarete: 'epique' },
  { cle: 'represailles', nom: 'Représailles', salle: 'rempart', rarete: 'epique' },
  // L'Élan
  { cle: 'echauffement', nom: 'Échauffement', salle: 'elan', rarete: 'commun' },
  { cle: 'lancee', nom: 'Lancée', salle: 'elan', rarete: 'commun' },
  { cle: 'foulee', nom: 'Foulée', salle: 'elan', rarete: 'commun' },
  { cle: 'acceleration', nom: 'Accélération', salle: 'elan', rarete: 'rare' },
  { cle: 'rythme', nom: 'Rythme', salle: 'elan', rarete: 'rare' },
  { cle: 'sprint', nom: 'Sprint', salle: 'elan', rarete: 'rare' },
  { cle: 'vent-arriere', nom: 'Vent arrière', salle: 'elan', rarete: 'epique' },
  { cle: 'inarretable', nom: 'Inarrêtable', salle: 'elan', rarete: 'epique' },
  // Le Métamorphe
  { cle: 'corser', nom: 'Corser', salle: 'metamorphe', rarete: 'commun' },
  { cle: 'simplifier', nom: 'Simplifier', salle: 'metamorphe', rarete: 'commun' },
  { cle: 'volte-face', nom: 'Volte-face', salle: 'metamorphe', rarete: 'commun' },
  { cle: 'prisme', nom: 'Prisme', salle: 'metamorphe', rarete: 'rare' },
  { cle: 'miroir', nom: 'Miroir', salle: 'metamorphe', rarete: 'rare' },
  { cle: 'cameleon', nom: 'Caméléon', salle: 'metamorphe', rarete: 'rare' },
  { cle: 'metamorphose', nom: 'Métamorphose', salle: 'metamorphe', rarete: 'epique' },
  { cle: 'polymorphe', nom: 'Polymorphe', salle: 'metamorphe', rarete: 'epique' },
  // Le Flambeur
  { cle: 'doubler-la-mise', nom: 'Doubler la mise', salle: 'flambeur', rarete: 'commun' },
  { cle: 'pourboire', nom: 'Pourboire', salle: 'flambeur', rarete: 'commun' },
  { cle: 'cagnotte', nom: 'Cagnotte', salle: 'flambeur', rarete: 'commun' },
  { cle: 'banco', nom: 'Banco', salle: 'flambeur', rarete: 'rare' },
  { cle: 'assurance', nom: 'Assurance', salle: 'flambeur', rarete: 'rare' },
  { cle: 'fortune', nom: 'Fortune', salle: 'flambeur', rarete: 'rare' },
  { cle: 'pactole', nom: 'Pactole', salle: 'flambeur', rarete: 'epique' },
  { cle: 'rafle', nom: 'Rafle', salle: 'flambeur', rarete: 'epique' },
  // Le Sophiste
  { cle: 'insinuation', nom: 'Insinuation', salle: 'sophiste', rarete: 'commun' },
  { cle: 'rumeur', nom: 'Rumeur', salle: 'sophiste', rarete: 'commun' },
  { cle: 'objection', nom: 'Objection', salle: 'sophiste', rarete: 'commun' },
  { cle: 'zizanie', nom: 'Zizanie', salle: 'sophiste', rarete: 'rare' },
  { cle: 'engrenage', nom: 'Engrenage', salle: 'sophiste', rarete: 'rare' },
  { cle: 'coup-de-grace', nom: 'Coup de grâce', salle: 'sophiste', rarete: 'rare' },
  { cle: 'paranoia', nom: 'Paranoïa', salle: 'sophiste', rarete: 'epique' },
  { cle: 'hantise', nom: 'Hantise', salle: 'sophiste', rarete: 'epique' },
  // Le Téméraire
  { cle: 'fougue', nom: 'Fougue', salle: 'temeraire', rarete: 'commun' },
  { cle: 'coup-de-sang', nom: 'Coup de sang', salle: 'temeraire', rarete: 'commun' },
  { cle: 'cicatrices', nom: 'Cicatrices', salle: 'temeraire', rarete: 'commun' },
  { cle: 'adrenaline', nom: 'Adrénaline', salle: 'temeraire', rarete: 'rare' },
  { cle: 'dernier-carre', nom: 'Dernier carré', salle: 'temeraire', rarete: 'rare' },
  { cle: 'temerite', nom: 'Témérité', salle: 'temeraire', rarete: 'rare' },
  { cle: 'berserk', nom: 'Berserk', salle: 'temeraire', rarete: 'epique' },
  { cle: 'baroud', nom: 'Baroud', salle: 'temeraire', rarete: 'epique' },
  // Le Vestibule : les vingt neutres
  { cle: 'concentration', nom: 'Concentration', salle: 'vestibule', rarete: 'commun' },
  { cle: 'prudence', nom: 'Prudence', salle: 'vestibule', rarete: 'commun' },
  { cle: 'coup-d-oeil', nom: 'Coup d’œil', salle: 'vestibule', rarete: 'commun' },
  { cle: 'echange', nom: 'Échange', salle: 'vestibule', rarete: 'commun' },
  { cle: 'pioche', nom: 'La pioche', salle: 'vestibule', rarete: 'commun' },
  { cle: 'arret-sur-image', nom: 'Arrêt sur image', salle: 'vestibule', rarete: 'commun' },
  { cle: 'detour', nom: 'Le détour', salle: 'vestibule', rarete: 'commun' },
  { cle: 'evidence', nom: 'Évidence', salle: 'vestibule', rarete: 'commun' },
  { cle: 'repere', nom: 'Le repère', salle: 'vestibule', rarete: 'commun' },
  { cle: 'lettre', nom: 'La lettre', salle: 'vestibule', rarete: 'commun' },
  { cle: 'initiale', nom: 'L’initiale', salle: 'vestibule', rarete: 'rare' },
  { cle: 'double-chance', nom: 'Double chance', salle: 'vestibule', rarete: 'rare' },
  { cle: 'sursis', nom: 'Sursis', salle: 'vestibule', rarete: 'rare' },
  { cle: 'meditation', nom: 'Méditation', salle: 'vestibule', rarete: 'rare' },
  { cle: 'sang-froid', nom: 'Sang-froid', salle: 'vestibule', rarete: 'rare' },
  { cle: 'panacee', nom: 'Panacée', salle: 'vestibule', rarete: 'epique' },
  { cle: 'maitrise', nom: 'Maîtrise', salle: 'vestibule', rarete: 'epique' },
  { cle: 'tout-ou-rien', nom: 'Tout ou rien', salle: 'vestibule', rarete: 'maudit' },
  { cle: 'quitte-ou-double', nom: 'Quitte ou double', salle: 'vestibule', rarete: 'maudit' },
  { cle: 'surmenage', nom: 'Surmenage', salle: 'vestibule', rarete: 'maudit' },
] as const satisfies readonly OeuvreEcrite[]

/** La clé d'une œuvre — celle de sa carte peinte. Un `Record` qui en manque une ne compile pas. */
export type CleDOeuvre = (typeof OEUVRES_ECRITES)[number]['cle']
/** Les vingt du Vestibule, dont chacune porte son propre pouvoir (`POUVOIR_DU_NEUTRE`). */
export type CleDuVestibule = Extract<(typeof OEUVRES_ECRITES)[number], { salle: 'vestibule' }>['cle']

export interface Oeuvre extends OeuvreEcrite {
  cle: CleDOeuvre
}

export const OEUVRES: readonly Oeuvre[] = OEUVRES_ECRITES

const PAR_CLE = new Map<string, Oeuvre>(OEUVRES.map(o => [o.cle, o]))

/** Une œuvre par sa clé (`bastion`) ; la carte d'un légendaire, un Divin ou une clé inconnue n'en sont pas. */
export function oeuvre(cle: unknown): Oeuvre | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle) : undefined
}

export function estUneOeuvre(cle: unknown): cle is CleDOeuvre {
  return typeof cle === 'string' && PAR_CLE.has(cle)
}

/** Les œuvres d'une salle, dans l'ordre de leur rareté. */
export function oeuvresDeLaSalle(salle: CleDeSalle): readonly Oeuvre[] {
  return OEUVRES.filter(o => o.salle === salle)
}

/**
 * Les quatre œuvres de départ, possédées par règle — sans ligne — par tout
 * profil : on emporte une carte-bonus dès la première partie, un pouvoir
 * chacune, sauf Miser (celles de la maquette). Elles comptent pour le
 * Vestibule. Gelée : la raccourcir reprendrait des œuvres à tout le monde.
 */
export const OEUVRES_DE_DEPART: readonly CleDOeuvre[] = ['coup-d-oeil', 'prudence', 'concentration', 'echange']

/**
 * Le jeu où chaque œuvre se trouve, que son cadre vide affiche (« Elle se
 * trouve au Filet »). Une table écrite une fois, et gelée : le hachage de la
 * clé de la maquette mettait trois œuvres d'une salle au même jeu, et un
 * dixième jeu y aurait déplacé toutes les œuvres. Équilibrée : dans chaque
 * famille, huit jeux différents — chaque famille en saute un, à tour de rôle,
 * la rareté tournant avec —, et le Vestibule complète chaque jeu à neuf ou dix
 * œuvres, des communes aux épiques (`cabinet-catalogue.test.ts`). Changer le
 * jeu d'une œuvre ne reprend rien à qui l'a, mais déplace la chasse de qui la
 * cherche : un choix de produit (`docs/reference/baremes.md`).
 */
export const JEU_DE_L_OEUVRE: Readonly<Record<CleDOeuvre, CleDeJeu>> = {
  // L'Érudit, sans l'Épingle
  plume: 'frise', 'savoir-faire': 'mot', memoire: 'detail', bibliotheque: 'filet', lecon: 'pari', expose: 'eclair', encyclopedie: 'indices', genie: 'replique',
  // Le Devin, sans la Frise
  lucidite: 'mot', augure: 'detail', presage: 'filet', 'troisieme-oeil': 'pari', voyance: 'eclair', astrolabe: 'indices', vision: 'replique', revelation: 'epingle',
  // Le Rempart, sans le Mot mystère
  parade: 'detail', muraille: 'filet', pansement: 'pari', 'contre-attaque': 'eclair', cuirasse: 'indices', 'second-souffle': 'replique', bastion: 'epingle', represailles: 'frise',
  // L'Élan, sans le Détail
  echauffement: 'filet', lancee: 'pari', foulee: 'eclair', acceleration: 'indices', rythme: 'replique', sprint: 'epingle', 'vent-arriere': 'frise', inarretable: 'mot',
  // Le Métamorphe, sans le Filet
  corser: 'pari', simplifier: 'eclair', 'volte-face': 'indices', prisme: 'replique', miroir: 'epingle', cameleon: 'frise', metamorphose: 'mot', polymorphe: 'detail',
  // Le Flambeur, sans le Pari
  'doubler-la-mise': 'eclair', pourboire: 'indices', cagnotte: 'replique', banco: 'epingle', assurance: 'frise', fortune: 'mot', pactole: 'detail', rafle: 'filet',
  // Le Sophiste, sans l'Éclair
  insinuation: 'indices', rumeur: 'replique', objection: 'epingle', zizanie: 'frise', engrenage: 'mot', 'coup-de-grace': 'detail', paranoia: 'filet', hantise: 'pari',
  // Le Téméraire, sans les Indices
  fougue: 'replique', 'coup-de-sang': 'epingle', cicatrices: 'frise', adrenaline: 'mot', 'dernier-carre': 'detail', temerite: 'filet', berserk: 'pari', baroud: 'eclair',
  // Le Vestibule, là où il manque une œuvre — la Lettre au Mot mystère, le Repère à l'Épingle
  concentration: 'filet', prudence: 'pari', 'coup-d-oeil': 'epingle', echange: 'mot', pioche: 'frise', 'arret-sur-image': 'detail', detour: 'frise', evidence: 'eclair',
  repere: 'epingle', lettre: 'mot', initiale: 'indices', 'double-chance': 'filet', sursis: 'replique', meditation: 'detail', 'sang-froid': 'pari',
  panacee: 'eclair', maitrise: 'indices', 'tout-ou-rien': 'eclair', 'quitte-ou-double': 'pari', surmenage: 'filet',
}
