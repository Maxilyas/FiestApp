// Le catalogue des cartes peintes des rencontres de l'Expédition, figé tel
// qu'il était le 16 novembre 2026 — pas un fichier de tests : une donnée que
// `cabinet-catalogue.test.ts` relit.
//
// Le Cabinet recopie ces cartes plutôt que de les importer (`OEUVRES`,
// `shared/cabinet/oeuvres.ts`), et son test comparait la copie à
// `shared/rencontres.ts`, qui partira avec l'Expédition. Comparée à cet
// instantané, la copie reste tenue aussi serré — une carte de plus ou de
// moins, un nom retouché, une famille ou une rareté changée rougissent
// encore —, sans que le Cabinet ait besoin des rencontres. Une œuvre ne se
// retire jamais (invariant 22) : l'instantané ne se réécrit pas, il ne fait
// qu'ajouter, et le dire.
//
// Écrit une fois de `CARTES_DES_RENCONTRES` et de `FAMILLES_DE_CARTES` : tant
// qu'elles existent, `expedition-rencontres.test.ts` le compare à elles. Le
// lot qui retirera `shared/rencontres.ts` n'aura qu'à retirer cette épreuve-là.
import type { FamilleDeCartes, RareteDeCarte } from '../../shared/cabinet/oeuvres'

export interface CarteDesRencontres {
  cle: string
  nom: string
  famille: FamilleDeCartes
  rarete: RareteDeCarte
  /** La carte d'un légendaire, qui le porte : son médaillon, jamais une peinture — un gardien au Cabinet. */
  legendaire?: string
}

/** Les familles, telles que les salles du Cabinet les reprennent : leur nom, leur devise. */
export const FAMILLES_DES_RENCONTRES: Readonly<Record<FamilleDeCartes, { nom: string; devise: string }>> = {
  erudit: { nom: 'L’Érudit', devise: 'Je connais mon rayon' },
  flambeur: { nom: 'Le Flambeur', devise: 'Je parie sur moi' },
  metamorphe: { nom: 'Le Métamorphe', devise: 'Je change la question' },
  elan: { nom: 'L’Élan', devise: 'Je ne m’arrête plus' },
  rempart: { nom: 'Le Rempart', devise: 'Je tiens bon' },
  devin: { nom: 'Le Devin', devise: 'Je lis les signes' },
  sophiste: { nom: 'Le Sophiste', devise: 'Je sème le doute' },
  temeraire: { nom: 'Le Téméraire', devise: 'Je joue avec le feu' },
  neutre: { nom: 'Les neutres', devise: 'Pour tout le monde' },
}

/** Les cent sept cartes, dans l'ordre du catalogue : vingt neutres, soixante-quatre de famille, vingt-trois de légendaire. */
export const CARTES_DES_RENCONTRES_FIGEES: readonly CarteDesRencontres[] = [
  { cle: 'concentration', nom: 'Concentration', famille: 'neutre', rarete: 'commun' },
  { cle: 'prudence', nom: 'Prudence', famille: 'neutre', rarete: 'commun' },
  { cle: 'coup-d-oeil', nom: 'Coup d’œil', famille: 'neutre', rarete: 'commun' },
  { cle: 'echange', nom: 'Échange', famille: 'neutre', rarete: 'commun' },
  { cle: 'pioche', nom: 'La pioche', famille: 'neutre', rarete: 'commun' },
  { cle: 'arret-sur-image', nom: 'Arrêt sur image', famille: 'neutre', rarete: 'commun' },
  { cle: 'detour', nom: 'Le détour', famille: 'neutre', rarete: 'commun' },
  { cle: 'evidence', nom: 'Évidence', famille: 'neutre', rarete: 'commun' },
  { cle: 'repere', nom: 'Le repère', famille: 'neutre', rarete: 'commun' },
  { cle: 'lettre', nom: 'La lettre', famille: 'neutre', rarete: 'commun' },
  { cle: 'initiale', nom: 'L’initiale', famille: 'neutre', rarete: 'rare' },
  { cle: 'double-chance', nom: 'Double chance', famille: 'neutre', rarete: 'rare' },
  { cle: 'sursis', nom: 'Sursis', famille: 'neutre', rarete: 'rare' },
  { cle: 'meditation', nom: 'Méditation', famille: 'neutre', rarete: 'rare' },
  { cle: 'sang-froid', nom: 'Sang-froid', famille: 'neutre', rarete: 'rare' },
  { cle: 'panacee', nom: 'Panacée', famille: 'neutre', rarete: 'epique' },
  { cle: 'maitrise', nom: 'Maîtrise', famille: 'neutre', rarete: 'epique' },
  { cle: 'tout-ou-rien', nom: 'Tout ou rien', famille: 'neutre', rarete: 'maudit' },
  { cle: 'quitte-ou-double', nom: 'Quitte ou double', famille: 'neutre', rarete: 'maudit' },
  { cle: 'surmenage', nom: 'Surmenage', famille: 'neutre', rarete: 'maudit' },
  { cle: 'plume', nom: 'Plume', famille: 'erudit', rarete: 'commun' },
  { cle: 'savoir-faire', nom: 'Savoir-faire', famille: 'erudit', rarete: 'commun' },
  { cle: 'memoire', nom: 'Mémoire', famille: 'erudit', rarete: 'commun' },
  { cle: 'bibliotheque', nom: 'Bibliothèque', famille: 'erudit', rarete: 'rare' },
  { cle: 'lecon', nom: 'Leçon', famille: 'erudit', rarete: 'rare' },
  { cle: 'expose', nom: 'Exposé', famille: 'erudit', rarete: 'rare' },
  { cle: 'encyclopedie', nom: 'Encyclopédie', famille: 'erudit', rarete: 'epique' },
  { cle: 'genie', nom: 'Génie', famille: 'erudit', rarete: 'epique' },
  { cle: 'doubler-la-mise', nom: 'Doubler la mise', famille: 'flambeur', rarete: 'commun' },
  { cle: 'pourboire', nom: 'Pourboire', famille: 'flambeur', rarete: 'commun' },
  { cle: 'cagnotte', nom: 'Cagnotte', famille: 'flambeur', rarete: 'commun' },
  { cle: 'banco', nom: 'Banco', famille: 'flambeur', rarete: 'rare' },
  { cle: 'assurance', nom: 'Assurance', famille: 'flambeur', rarete: 'rare' },
  { cle: 'fortune', nom: 'Fortune', famille: 'flambeur', rarete: 'rare' },
  { cle: 'pactole', nom: 'Pactole', famille: 'flambeur', rarete: 'epique' },
  { cle: 'rafle', nom: 'Rafle', famille: 'flambeur', rarete: 'epique' },
  { cle: 'corser', nom: 'Corser', famille: 'metamorphe', rarete: 'commun' },
  { cle: 'simplifier', nom: 'Simplifier', famille: 'metamorphe', rarete: 'commun' },
  { cle: 'volte-face', nom: 'Volte-face', famille: 'metamorphe', rarete: 'commun' },
  { cle: 'prisme', nom: 'Prisme', famille: 'metamorphe', rarete: 'rare' },
  { cle: 'miroir', nom: 'Miroir', famille: 'metamorphe', rarete: 'rare' },
  { cle: 'cameleon', nom: 'Caméléon', famille: 'metamorphe', rarete: 'rare' },
  { cle: 'metamorphose', nom: 'Métamorphose', famille: 'metamorphe', rarete: 'epique' },
  { cle: 'polymorphe', nom: 'Polymorphe', famille: 'metamorphe', rarete: 'epique' },
  { cle: 'echauffement', nom: 'Échauffement', famille: 'elan', rarete: 'commun' },
  { cle: 'lancee', nom: 'Lancée', famille: 'elan', rarete: 'commun' },
  { cle: 'foulee', nom: 'Foulée', famille: 'elan', rarete: 'commun' },
  { cle: 'acceleration', nom: 'Accélération', famille: 'elan', rarete: 'rare' },
  { cle: 'rythme', nom: 'Rythme', famille: 'elan', rarete: 'rare' },
  { cle: 'sprint', nom: 'Sprint', famille: 'elan', rarete: 'rare' },
  { cle: 'vent-arriere', nom: 'Vent arrière', famille: 'elan', rarete: 'epique' },
  { cle: 'inarretable', nom: 'Inarrêtable', famille: 'elan', rarete: 'epique' },
  { cle: 'parade', nom: 'Parade', famille: 'rempart', rarete: 'commun' },
  { cle: 'muraille', nom: 'Muraille', famille: 'rempart', rarete: 'commun' },
  { cle: 'pansement', nom: 'Pansement', famille: 'rempart', rarete: 'commun' },
  { cle: 'contre-attaque', nom: 'Contre-attaque', famille: 'rempart', rarete: 'rare' },
  { cle: 'cuirasse', nom: 'Cuirasse', famille: 'rempart', rarete: 'rare' },
  { cle: 'second-souffle', nom: 'Second souffle', famille: 'rempart', rarete: 'rare' },
  { cle: 'bastion', nom: 'Bastion', famille: 'rempart', rarete: 'epique' },
  { cle: 'represailles', nom: 'Représailles', famille: 'rempart', rarete: 'epique' },
  { cle: 'lucidite', nom: 'Lucidité', famille: 'devin', rarete: 'commun' },
  { cle: 'augure', nom: 'Augure', famille: 'devin', rarete: 'commun' },
  { cle: 'presage', nom: 'Présage', famille: 'devin', rarete: 'commun' },
  { cle: 'troisieme-oeil', nom: 'Troisième œil', famille: 'devin', rarete: 'rare' },
  { cle: 'voyance', nom: 'Voyance', famille: 'devin', rarete: 'rare' },
  { cle: 'astrolabe', nom: 'Astrolabe', famille: 'devin', rarete: 'rare' },
  { cle: 'vision', nom: 'Vision', famille: 'devin', rarete: 'epique' },
  { cle: 'revelation', nom: 'Révélation', famille: 'devin', rarete: 'epique' },
  { cle: 'insinuation', nom: 'Insinuation', famille: 'sophiste', rarete: 'commun' },
  { cle: 'rumeur', nom: 'Rumeur', famille: 'sophiste', rarete: 'commun' },
  { cle: 'objection', nom: 'Objection', famille: 'sophiste', rarete: 'commun' },
  { cle: 'zizanie', nom: 'Zizanie', famille: 'sophiste', rarete: 'rare' },
  { cle: 'engrenage', nom: 'Engrenage', famille: 'sophiste', rarete: 'rare' },
  { cle: 'coup-de-grace', nom: 'Coup de grâce', famille: 'sophiste', rarete: 'rare' },
  { cle: 'paranoia', nom: 'Paranoïa', famille: 'sophiste', rarete: 'epique' },
  { cle: 'hantise', nom: 'Hantise', famille: 'sophiste', rarete: 'epique' },
  { cle: 'fougue', nom: 'Fougue', famille: 'temeraire', rarete: 'commun' },
  { cle: 'coup-de-sang', nom: 'Coup de sang', famille: 'temeraire', rarete: 'commun' },
  { cle: 'cicatrices', nom: 'Cicatrices', famille: 'temeraire', rarete: 'commun' },
  { cle: 'adrenaline', nom: 'Adrénaline', famille: 'temeraire', rarete: 'rare' },
  { cle: 'dernier-carre', nom: 'Dernier carré', famille: 'temeraire', rarete: 'rare' },
  { cle: 'temerite', nom: 'Témérité', famille: 'temeraire', rarete: 'rare' },
  { cle: 'berserk', nom: 'Berserk', famille: 'temeraire', rarete: 'epique' },
  { cle: 'baroud', nom: 'Baroud', famille: 'temeraire', rarete: 'epique' },
  { cle: 'renaissance', nom: 'Renaissance', famille: 'rempart', rarete: 'legendaire', legendaire: 'lg:phenix' },
  { cle: 'peau-de-feu', nom: 'Peau de feu', famille: 'rempart', rarete: 'legendaire', legendaire: 'lg:salamandre' },
  { cle: 'aube', nom: 'L’aube', famille: 'rempart', rarete: 'legendaire', legendaire: 'lg:scarabee' },
  { cle: 'reveil', nom: 'Le réveil', famille: 'elan', rarete: 'legendaire', legendaire: 'lg:coq' },
  { cle: 'boucle', nom: 'La boucle', famille: 'rempart', rarete: 'legendaire', legendaire: 'lg:ouroboros' },
  { cle: 'sagesse', nom: 'Sagesse', famille: 'erudit', rarete: 'legendaire', legendaire: 'lg:chouette' },
  { cle: 'enigme', nom: 'Énigme', famille: 'devin', rarete: 'legendaire', legendaire: 'lg:sphinx' },
  { cle: 'prediction', nom: 'Prédiction', famille: 'devin', rarete: 'legendaire', legendaire: 'lg:oracle' },
  { cle: 'deux-visages', nom: 'Deux visages', famille: 'metamorphe', rarete: 'legendaire', legendaire: 'lg:janus' },
  { cle: 'mue', nom: 'La mue', famille: 'metamorphe', rarete: 'legendaire', legendaire: 'lg:serpent' },
  { cle: 'commandement', nom: 'Commandement', famille: 'erudit', rarete: 'legendaire', legendaire: 'lg:lion' },
  { cle: 'elan', nom: 'L’élan', famille: 'elan', rarete: 'legendaire', legendaire: 'lg:tigre' },
  { cle: 'trois-tetes', nom: 'Trois têtes', famille: 'metamorphe', rarete: 'legendaire', legendaire: 'lg:chimere' },
  { cle: 'raccourci', nom: 'Le raccourci', famille: 'elan', rarete: 'legendaire', legendaire: 'lg:comete' },
  { cle: 'maison', nom: 'Il connaît la maison', famille: 'flambeur', rarete: 'legendaire', legendaire: 'lg:renard' },
  { cle: 'tresor', nom: 'Le trésor', famille: 'flambeur', rarete: 'legendaire', legendaire: 'lg:dragon' },
  { cle: 'feu-d-artifice', nom: 'Le feu d’artifice', famille: 'elan', rarete: 'legendaire', legendaire: 'lg:bouquet' },
  { cle: 'lanterne', nom: 'La lanterne', famille: 'devin', rarete: 'legendaire', legendaire: 'lg:citrouille' },
  { cle: 'boule', nom: 'Une boule pour chacun', famille: 'flambeur', rarete: 'legendaire', legendaire: 'lg:sapin' },
  { cle: 'abysses', nom: 'Remonter des abysses', famille: 'rempart', rarete: 'legendaire', legendaire: 'lg:kraken' },
  { cle: 'passe-muraille', nom: 'Passe-muraille', famille: 'devin', rarete: 'legendaire', legendaire: 'lg:fantome' },
  { cle: 'horizon', nom: 'L’horizon', famille: 'flambeur', rarete: 'legendaire', legendaire: 'lg:trou-noir' },
  { cle: 'echolocation', nom: 'L’écholocation', famille: 'devin', rarete: 'legendaire', legendaire: 'lg:chauve-souris' },
]
