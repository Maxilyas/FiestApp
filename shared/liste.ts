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
  MAX_TITRE,
  MAX_UNIT,
  MIN_ANSWERS,
  MIN_DURATION,
  MIN_OBSERVE,
  SANS_BONNE_REPONSE,
  luCommeReglage,
  parseImportedQuestions,
  photoManquante,
  type QuizQuestionDef,
} from './library'
import { ecrireNombre } from './nombres'

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
export const EXEMPLE_DU_FORMAT = `Titre : Le tour du monde en six questions

# Géographie

Quelle est la capitale de l'Australie ?
Sydney
* Canberra
Melbourne
Perth

Laquelle de ces villes est la capitale du Canada ?
Ordre : fixe
Toronto
Montréal
* Ottawa
Aucune de ces villes

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
- Tout en haut, seule sur sa ligne, « Titre : » suivi du titre du quiz (${MAX_TITRE} caractères au plus). Facultative.
- La première ligne d'une question est son intitulé : ${MAX_TEXT} caractères au plus, et le plus court possible — il s'affiche en grand.
- Ni numéros, ni puces, ni gras, ni tableau ; ni introduction, ni conclusion : rien que les questions.
- ${MAX_QUESTIONS} questions au plus par quiz.
- Des emojis courants seulement : les plus récents s'affichent en carré vide sur certains écrans.

QCM
Sous l'intitulé, de ${MIN_ANSWERS} à ${MAX_ANSWERS} réponses, une par ligne (${MAX_ANSWER_TEXT} caractères au plus). Une étoile * devant la bonne réponse, et une seule. Un vrai ou faux est un QCM à deux réponses : « Vrai » et « Faux ».

ESTIMATION
Sous l'intitulé, une seule ligne : le signe = suivi de la bonne valeur, en chiffres, puis de son unité s'il y en a une (${MAX_UNIT} caractères au plus) : « = 1889 », « = 8 849 m », « = 0,8 % ». Chacun propose un nombre, et plus il tombe près, plus il rapporte : idéal pour une date, une distance, un prix, que personne ne connaît au chiffre près.

RÉGLAGES — facultatifs, chacun sur sa ligne sous l'intitulé, dans n'importe quel ordre
Temps : 30 s — le temps pour répondre, de ${MIN_DURATION} à ${MAX_DURATION} secondes, pour cette question et les suivantes, jusqu'à la prochaine ligne Temps : inutile de la répéter. Écrite seule avant la première question, elle vaut pour tout le quiz. Sans aucune ligne Temps, celui réglé dans FiestApp (${DEFAULT_DURATION} s au départ).
Photo : tour-eiffel.jpg — une photo montrée avec la question : le nom de son fichier, à envoyer avec la liste, ou, à défaut, ce qu'elle doit montrer (« Photo : la tour Eiffel illuminée, de nuit »).
Observation : 5 s — avec une photo seulement : elle passe seule pendant ce temps, de ${MIN_OBSERVE} à ${MAX_OBSERVE} secondes, puis disparaît, et l'on répond de mémoire.
Ordre : fixe — les réponses restent dans l'ordre écrit, même si le quiz les mélange à chaque partie : pour « Aucune de ces réponses », ou une suite qui a un sens.

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

/**
 * Le quiz écrit dans le format que « Coller une liste » relit — l'inverse de
 * `parseImportedQuestions`. On ne pouvait pas se passer un quiz en texte :
 * dans un message, à relire, à faire compléter par une IA (AD-7). La
 * catégorie et le temps ne s'écrivent que lorsqu'ils changent, puisqu'ils
 * courent d'une question à l'autre. Les photos ne voyagent pas en texte :
 * elles s'annoncent (« Photo : »), et la question recollée les attendra.
 * Une question sans intitulé ne s'écrit pas : elle n'aurait rien à relire.
 */
export function ecrireListe(questions: readonly QuizQuestionDef[], titre?: string | null): string {
  const blocs: string[] = []
  // Le titre voyage avec la liste : recollée dans un quiz neuf, elle le nomme.
  const t = (titre ?? '').replace(/\s+/g, ' ').trim()
  if (t) blocs.push(`Titre : ${t}`)
  // Rien de connu au départ : la première question dit sa catégorie et son
  // temps, sans quoi, recollée, elle prendrait ceux de sa nouvelle voisine.
  // Un quiz sans aucune catégorie n'en dit rien : un « # » seul en tête
  // intriguerait qui lit la liste, pour un cas rare.
  let categorie: string | null | undefined = questions.some(q => q.category) ? undefined : null
  let temps: number | null = null
  let n = 0
  for (const q of questions) {
    const intitule = (q.text ?? '').trim()
    if (!intitule) continue
    n++
    const lignes: string[] = []
    const cat = q.category ?? null
    if (cat !== categorie) {
      lignes.push(cat ? `# ${cat}` : '#')
      categorie = cat
    }
    // Sur une seule ligne, comme l'éditeur l'affichera. Un intitulé que la
    // liste relirait autrement — « # Quiz musical ? » pris pour une
    // catégorie, « Temps : 30 s » pour un réglage, « 2. étape » amputé de son
    // numéro — prend un numéro devant, que la relecture retire.
    const ligne = intitule.replace(/\s*\n\s*/g, ' ')
    lignes.push(parseImportedQuestions(`${ligne}\n* a\nb`).questions[0]?.text === ligne ? ligne : `${n}. ${ligne}`)
    if (q.duration !== temps) {
      lignes.push(`Temps : ${q.duration} s`)
      temps = q.duration
    }
    if (q.kind === 'choice' && q.ordreFixe) lignes.push('Ordre : fixe')
    const photo = q.image ? `photo de la question ${n}` : photoManquante(q)
    if (photo) {
      lignes.push(`Photo : ${photo}`)
      if (q.observeSeconds !== null && q.observeSeconds !== undefined) lignes.push(`Observation : ${q.observeSeconds} s`)
    }
    if (q.kind === 'number') {
      // Sans cible, la ligne « = » ne se relit pas, et la question se perd
      // au recollage (compté parmi les blocs ignorés) : on ne devine pas.
      const cible = q.target === null ? '' : ecrireNombre(q.target)
      lignes.push(`= ${cible}${q.unit.trim() ? ` ${q.unit.trim()}` : ''}`)
    } else {
      q.answers.forEach((a, i) => {
        const reponse = (a ?? '').trim()
        if (!reponse) return
        const marquee = i === q.correct && q.correct !== SANS_BONNE_REPONSE ? `* ${reponse}` : reponse
        // « Photo : la plage » est un choix, pas un réglage : la puce le dit.
        lignes.push(luCommeReglage(reponse) ? `- ${marquee}` : marquee)
      })
    }
    blocs.push(lignes.join('\n'))
  }
  return blocs.join('\n\n')
}

// ── La demande pour une IA ───────────────────────────────────────────────
//
// « Copier le format complet » donnait les règles ; la demande, il fallait
// l'écrire à côté — et l'IA à qui l'on ne disait ni le public, ni le niveau,
// ni la part d'estimations rendait vingt questions de culture générale à
// quatre réponses. La demande se remplit en quatre choix, et part avec le
// format, d'un seul geste.

export type PublicDuQuiz = 'adultes' | 'famille' | 'enfants'
export type NiveauDuQuiz = 'facile' | 'moyen' | 'difficile'
export type PartDEstimations = 'aucune' | 'quelques' | 'beaucoup'

export interface DemandeIA {
  theme: string
  nombre: number
  public: PublicDuQuiz
  niveau: NiveauDuQuiz
  estimations: PartDEstimations
}

export const DEMANDE_PAR_DEFAUT: DemandeIA = { theme: '', nombre: 15, public: 'adultes', niveau: 'moyen', estimations: 'quelques' }

const PUBLICS: Record<PublicDuQuiz, string> = {
  adultes: 'des adultes, entre amis, un soir de fête',
  famille: 'une famille, des grands-parents aux ados : rien qui exclue une génération',
  enfants: 'des enfants de 8 à 12 ans : des questions simples, sans piège, un vocabulaire qu’ils connaissent',
}

const NIVEAUX: Record<NiveauDuQuiz, string> = {
  facile: 'facile — la salle doit trouver la plupart des réponses',
  moyen: 'moyen — ni évident, ni introuvable : on hésite, on discute, on trouve souvent',
  difficile: 'difficile — pour des connaisseurs, mais jamais une question que personne ne peut deviner',
}

/** La demande complète, format compris, à coller telle quelle dans une IA. */
export function demandePourIA(d: DemandeIA): string {
  const nombre = Math.min(MAX_QUESTIONS, Math.max(1, Math.round(Number(d.nombre) || DEMANDE_PAR_DEFAUT.nombre)))
  const theme = d.theme.replace(/\s+/g, ' ').trim() || 'culture générale, des sujets variés'
  const estimations =
    d.estimations === 'aucune'
      ? 'Uniquement des QCM et quelques vrai ou faux : aucune estimation chiffrée.'
      : d.estimations === 'beaucoup'
        ? `Environ la moitié en estimations chiffrées (une date, une distance, un prix, un nombre…), le reste en QCM à ${MAX_ANSWERS} réponses et quelques vrai ou faux.`
        : `Deux ou trois estimations chiffrées (une date, une distance, un prix…), le reste en QCM à ${MAX_ANSWERS} réponses et quelques vrai ou faux.`
  return [
    `Écris un quiz de ${nombre} question${nombre > 1 ? 's' : ''} sur ce thème : « ${theme} ».`,
    `Public : ${PUBLICS[d.public] ?? PUBLICS.adultes}.`,
    `Niveau : ${NIVEAUX[d.niveau] ?? NIVEAUX.moyen}.`,
    estimations,
    'Vérifie chaque fait. Rien qui change avec le temps : pas de record en cours, de champion en titre ni de prix du jour.',
    'Des réponses fausses plausibles, de la même longueur que la bonne. Des intitulés courts : ils s’affichent en grand sur un écran.',
    'Donne un titre au quiz. Réponds uniquement dans le format ci-dessous, sans introduction ni conclusion.',
    '',
    FORMAT_DE_LISTE,
  ].join('\n')
}
