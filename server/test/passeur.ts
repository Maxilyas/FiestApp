// Le problème du banc : le passeur, le loup, la chèvre et le chou — celui de
// la maquette du 25 novembre 2026 (`retours/2026-11-25/le-probleme-du-sphinx/`).
// Tout le monde le connaît : les épreuves et les photos le posent sans rien
// gâcher au propriétaire, qui joue aussi. Jamais dans la réserve livrée
// (`server/content/sphinx/problemes.json`), seulement au banc
// (`enigmesDuSphinx`), en ses deux formes de réponse.
import type { Enigme, ProblemeDeLaReserve } from '../src/core/sphinx'

const RECIT = [
  'Un passeur doit faire traverser la rivière à un loup, une chèvre et un chou.',
  'Sa barque est si petite qu’il n’y tient qu’avec un seul des trois.',
  'Laissés seuls sur une rive, le loup mange la chèvre, et la chèvre mange le chou. Quand le passeur est là, personne ne mange personne.',
]
const EXPLICATION: ProblemeDeLaReserve['explication'] = [
  { dit: 'D’abord la chèvre. Sur la rive, le loup et le chou se tiennent tranquilles.', etat: '🐺🥬 | 🐐' },
  { dit: 'Il revient seul.', etat: '🐺🥬 | 🐐' },
  { dit: 'Il passe le loup… mais en face, il ne peut pas le laisser avec la chèvre.', etat: '🥬 | 🐐🐺' },
  { dit: 'Alors il ramène la chèvre : ce qu’on a passé peut revenir.', etat: '🐐🥬 | 🐺' },
  { dit: 'Il passe le chou. Le loup et le chou, ensemble, ne risquent rien.', etat: '🐐 | 🐺🥬' },
  { dit: 'Il revient seul, et passe enfin la chèvre. Sept traversées.', etat: ' | 🐺🐐🥬' },
]
const SOURCE = { texte: 'Attribué à Alcuin d’York, Propositiones ad acuendos juvenes, n° XVIII, vers l’an 800' }

/** Le passeur, à nombre : combien de traversées, au moins ? Trois essais. */
export const PASSEUR: Enigme = {
  numero: 'p-passeur',
  sorte: 'probleme',
  difficulte: 'facile',
  vers: [],
  solution: 'sept traversées',
  acceptees: [],
  presque: [],
  page: '',
  facSimile: '',
  probleme: {
    titre: 'Le passeur',
    recit: RECIT,
    question: 'Combien de traversées lui faut-il, au moins, pour tout passer sain et sauf ?',
    aide: 'Un aller compte pour une traversée, un retour aussi.',
    figure: '🚣 🐺 🐐 🥬',
    reponse: { sorte: 'nombre', valeur: 7 },
    explication: EXPLICATION,
    source: SOURCE,
  },
}

/** Le passeur, à choisir : qui passe en premier ? Un seul essai ; la chèvre est la deuxième proposition. */
export const PASSEUR_A_CHOISIR: Enigme = {
  ...PASSEUR,
  numero: 'p-passeur-choix',
  solution: 'la chèvre',
  probleme: {
    ...PASSEUR.probleme!,
    question: 'Qui doit-il faire passer en premier ?',
    aide: undefined,
    reponse: {
      sorte: 'choix',
      propositions: [
        { texte: 'Le loup', emoji: '🐺' },
        { texte: 'La chèvre', emoji: '🐐' },
        { texte: 'Le chou', emoji: '🥬' },
      ],
      bonne: 1,
    },
  },
}
