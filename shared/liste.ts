// « Coller une liste » : le format qu'on donne à quelqu'un — un ami, ou une
// IA — pour qu'il écrive le quiz, et les photos qui rejoignent leurs
// questions.
//
// La liste collée ne se décrivait que par un exemple de trois questions :
// ni le temps, ni la photo, ni la liste des catégories. Qui voulait faire
// écrire un quiz devait deviner le reste, ou le recopier de l'éditeur. Le
// format complet se copie maintenant d'un bouton. Il est écrit à partir des
// bornes et des catégories du jour — il ne peut pas promettre ce que
// l'éditeur refuserait —, et son exemple se relit dans les tests : il ne peut
// pas montrer ce que `parseImportedQuestions` ne comprend pas.
//
// Une liste écrite ailleurs arrive sans ses photos. Chacune y est annoncée
// par une ligne « Photo : » — son nom de fichier, ou ce qu'elle doit
// montrer —, que la question garde tant qu'elle n'a pas la sienne
// (`photoAttendue`). Les fichiers choisis au moment de coller la liste
// rejoignent leur question par leur nom.

import { CATEGORIES } from './categories'
import {
  DEFAULT_DURATION,
  MAX_ANSWERS,
  MAX_ANSWER_TEXT,
  MAX_DURATION,
  MAX_OBSERVE,
  MAX_QUESTIONS,
  MAX_TEXT,
  MAX_UNIT,
  MIN_ANSWERS,
  MIN_DURATION,
  MIN_OBSERVE,
  photoManquante,
  type QuizQuestionDef,
} from './library'

/** L'exemple court, sous le champ où l'on colle : les gestes de tous les jours. */
export const APERCU_DU_FORMAT = `# Géographie

Quelle est la capitale de l'Australie ?
Sydney
* Canberra
Melbourne

Quel est ce monument ?
Photo : tour-eiffel.jpg
Temps : 30 s
* La tour Eiffel
Big Ben

Combien de pays composent l'Union européenne ?
= 27 pays`

/** L'exemple du format complet : chaque possibilité, une fois au moins. */
export const EXEMPLE_DU_FORMAT = `# Géographie

Quelle est la capitale de l'Australie ?
Sydney
* Canberra
Melbourne
Perth

Quelle est l'altitude du mont Everest ?
= 8 849 m
Temps : 30 s

# Histoire

La tour Eiffel a été construite pour l'Exposition universelle de 1889.
* Vrai
Faux

En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?
= 1969

# Cinéma & séries

De quel film vient cette image ?
Photo : titanic.jpg
Temps : 15 s
* Titanic
Avatar
Le Grand Bleu
Pearl Harbor

# Autour de la fête

Combien de bougies y avait-il sur le gâteau ?
Photo : le gâteau d'anniversaire, bougies allumées
Observation : 5 s
= 30 bougies`

/**
 * Ce que copie « Copier le format complet » : de quoi écrire un quiz sans
 * avoir jamais vu l'application. Écrit pour un humain autant que pour une
 * IA — qui suit un exemple mieux qu'une règle, et à qui il faut dire de ne
 * rendre que les questions : une introduction se collerait avec.
 */
export const FORMAT_DE_LISTE = `FORMAT D'UN QUIZ FIESTAPP

FiestApp est un quiz de soirée : les questions s'affichent en grand sur un écran commun, et chacun répond sur son téléphone. Un quiz s'écrit en texte brut, dans le format ci-dessous, puis se colle dans FiestApp (Mes quiz, le quiz, « Coller une liste »).

LES RÈGLES
- Une ligne vide entre deux questions.
- La première ligne d'une question est son intitulé : ${MAX_TEXT} caractères au plus, et le plus court possible — il s'affiche en grand.
- Ni numéros, ni puces, ni gras, ni tableau ; ni introduction, ni conclusion : rien que les questions.
- ${MAX_QUESTIONS} questions au plus par quiz.

QCM
Sous l'intitulé, de ${MIN_ANSWERS} à ${MAX_ANSWERS} réponses, une par ligne (${MAX_ANSWER_TEXT} caractères au plus). Une étoile * devant la bonne réponse, et une seule. Un vrai ou faux est un QCM à deux réponses : « Vrai » et « Faux ».

ESTIMATION
Sous l'intitulé, une seule ligne : le signe = suivi de la bonne valeur, en chiffres, puis de son unité s'il y en a une (${MAX_UNIT} caractères au plus) : « = 1889 », « = 8 849 m », « = 0,8 % ». Chacun propose un nombre, et plus il tombe près, plus il rapporte : idéal pour une date, une distance, un prix, que personne ne connaît au chiffre près.

RÉGLAGES — facultatifs, chacun sur sa ligne sous l'intitulé, dans n'importe quel ordre
Temps : 30 s — le temps pour répondre, de ${MIN_DURATION} à ${MAX_DURATION} secondes, pour cette question et les suivantes, jusqu'à la prochaine ligne Temps : inutile de la répéter. Écrite seule avant la première question, elle vaut pour tout le quiz. Sans aucune ligne Temps, celui réglé dans FiestApp (${DEFAULT_DURATION} s au départ).
Photo : tour-eiffel.jpg — une photo montrée avec la question : le nom de son fichier, à envoyer avec la liste, ou, à défaut, ce qu'elle doit montrer (« Photo : la tour Eiffel illuminée, de nuit »).
Observation : 5 s — avec une photo seulement : elle passe seule pendant ce temps, de ${MIN_OBSERVE} à ${MAX_OBSERVE} secondes, puis disparaît, et l'on répond de mémoire.

CATÉGORIES — facultatives
Une ligne # suivie d'une catégorie, placée avant une question, range cette question et les suivantes dans la catégorie, jusqu'à la prochaine ligne #. Un # seul : les suivantes n'en ont plus. Seulement l'une de celles-ci, écrite telle quelle : ${CATEGORIES.join(', ')}.

EXEMPLE

${EXEMPLE_DU_FORMAT}
`

/**
 * « Tour_Eiffel.JPG », « tour-eiffel » et « Tour Eiffel.jpeg » désignent la
 * même photo : personne ne recopie un nom de fichier au caractère près, et
 * un Mac l'écrit en lettres décomposées.
 */
export function cleDePhoto(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Pour chaque question, le fichier qui porte la photo qu'elle attend, ou null. */
export function apparierPhotos<F extends { name: string }>(questions: QuizQuestionDef[], fichiers: readonly F[]): (F | null)[] {
  const parCle = new Map<string, F>()
  for (const f of fichiers) {
    const cle = cleDePhoto(f.name)
    // Deux fichiers du même nom : le premier choisi l'emporte.
    if (cle && !parCle.has(cle)) parCle.set(cle, f)
  }
  return questions.map(q => {
    const attendue = photoManquante(q)
    return (attendue && parCle.get(cleDePhoto(attendue))) || null
  })
}

/**
 * Joint à chaque question la photo qu'elle annonçait, parmi les fichiers
 * choisis. Une à une, et une seule fois chacune, même montrée par deux
 * questions : cinquante photos envoyées d'un coup satureraient la connexion.
 * Celle qui ne part pas laisse sa question l'attendre — l'éditeur la
 * réclame — et son nom revient dans `echecs`. L'envoi se prend en paramètre,
 * comme à l'import d'un fichier (`shared/echange.ts`) : le navigateur et les
 * tests passent par le même chemin.
 */
export async function joindrePhotos<F extends { name: string }>(
  questions: QuizQuestionDef[],
  fichiers: readonly F[],
  envoyer: (fichier: F) => Promise<string>,
  avancer?: (faites: number, total: number) => void,
): Promise<{ questions: QuizQuestionDef[]; echecs: string[] }> {
  const choisis = apparierPhotos(questions, fichiers)
  const adresses = new Map<F, string | null>()
  for (const f of choisis) if (f) adresses.set(f, null)
  const echecs: string[] = []
  let faites = 0
  for (const f of adresses.keys()) {
    try {
      adresses.set(f, await envoyer(f))
    } catch {
      echecs.push(f.name)
    }
    avancer?.(++faites, adresses.size)
  }
  return {
    questions: questions.map((q, i) => {
      const f = choisis[i]
      const adresse = f && adresses.get(f)
      return adresse ? { ...q, image: adresse, photoAttendue: null } : q
    }),
    echecs,
  }
}
