import { ETIQUETTES, type MetadonneesDeQuestion } from '../../../shared/etiquettes'
import { sansAccent } from '../../../shared/homonymes'

/**
 * Une question d'univers dit de quel univers elle parle (le 26 novembre 2026,
 * le retour du propriétaire : « il manque le contexte, on a juste "Qui est
 * mort dans l'épisode 4 ?" mais on ne sait pas de quelle série on parle »).
 *
 * Jouée dans son thème, la tuile le dit. Mais une question de Stargate se
 * tire aussi dans une série de « Cinéma & séries » ou de toutes les
 * catégories, au défi, en duel, au quiz tout prêt de l'écran commun — et là,
 * seul son intitulé parle. La base en avait 394 sur 2 426 qui ne nommaient
 * rien : « Quel est le titre français de l'épisode 12 de la saison 6 ? »
 * (Lost), « Quel lien de parenté unit Yvain à Guenièvre ? » (Kaamelott, dont
 * la réponse n'est pas celle de la légende). Game of Thrones et Friends,
 * écrits après la consigne du 10 novembre 2026, n'en avaient qu'une.
 *
 * Un repère, c'est ce qui dit l'univers à quelqu'un qui ne le connaît pas :
 * son nom, ses œuvres, les quelques personnages et lieux que tout le monde y
 * rattache — Gandalf, Poudlard, Dark Vador, Pikachu. Pas Luna Lovegood, ni
 * Kanto, ni les Goa'uld : un fan les situe, la salle non. `titres` : un titre
 * d'œuvre suffit aussi (« Dans « Le Roi lion » (1994) », « dans « Goldfinger » ») ;
 * jamais pour une série, dont les titres sont ceux de ses épisodes —
 * « Dans « Révélations », quelle scientifique asgard… » ne dit Stargate à
 * personne. Kaamelott n'a que son nom : Arthur, Perceval et Guenièvre sont
 * aussi ceux de la légende.
 *
 * Un univers neuf a ses repères ici, ou le juge refuse ses questions
 * (`univers-nommes.test.ts` le vérifie sur `ETIQUETTES`).
 */
export const REPERES_DES_UNIVERS: Readonly<Record<string, { titres: boolean; reperes: readonly string[] }>> = {
  asterix: { titres: true, reperes: ['Astérix', 'Obélix', 'Panoramix', 'Idéfix', 'Goscinny', 'Uderzo', 'Abraracourcix', 'Assurancetourix', 'village gaulois'] },
  disney: { titres: true, reperes: ['Disney', 'Disneyland', 'Pixar', 'Mickey', 'Donald', 'Picsou', 'Dingo', 'Minnie'] },
  friends: { titres: false, reperes: ['Friends', 'Central Perk'] },
  'game-of-thrones': { titres: false, reperes: ['Game of Thrones', 'Trône de fer', 'Westeros', 'House of the Dragon', 'Targaryen', 'Lannister', 'Daenerys', 'Jon Snow'] },
  'harry-potter': {
    titres: true,
    reperes: ['Harry Potter', 'Harry', 'Poudlard', 'Voldemort', 'Dumbledore', 'Hermione', 'Hagrid', 'Weasley', 'Quidditch', 'Moldu', 'Gryffondor', 'Serpentard', 'Poufsouffle', 'Serdaigle', 'Mangemort', 'Choixpeau', 'Animaux fantastiques', 'Rowling'],
  },
  'james-bond': { titres: true, reperes: ['James Bond', 'Bond', '007'] },
  kaamelott: { titres: false, reperes: ['Kaamelott'] },
  lost: { titres: false, reperes: ['Lost'] },
  marvel: {
    titres: true,
    reperes: ['Marvel', 'MCU', 'Avengers', 'X-Men', 'Spider-Man', 'Iron Man', 'Captain America', 'Captain Marvel', 'Hulk', 'Thor', 'Wolverine', 'Thanos', 'Deadpool', 'Black Panther', 'Black Widow', 'Doctor Strange', 'Ant-Man', 'Venom', 'Daredevil', 'Magneto', 'Wakanda', 'Gardiens de la Galaxie', 'Quatre Fantastiques', "Surfer d'argent", 'Tony Stark', 'Peter Parker', 'Stan Lee'],
  },
  nintendo: {
    titres: true,
    reperes: ['Nintendo', 'Mario', 'Luigi', 'Peach', 'Bowser', 'Yoshi', 'Donkey Kong', 'Zelda', 'Link', 'Kirby', 'Metroid', 'Pikmin', 'Nintendogs', 'Animal Crossing', 'Splatoon', 'Super Smash Bros', 'NES', 'Super NES', 'Famicom', 'Game Boy', 'GameCube', 'Wii', 'Switch'],
  },
  pokemon: { titres: true, reperes: ['Pokémon', 'Pikachu', 'Pokédex', 'Sacha'] },
  'seigneur-des-anneaux': {
    titres: true,
    reperes: ['Seigneur des anneaux', 'Hobbit', 'Tolkien', 'Terre du Milieu', 'Silmarillion', 'Anneaux de pouvoir', 'Anneau unique', "Communauté de l'Anneau", 'Frodon', 'Bilbon', 'Gandalf', 'Gollum', 'Sauron', 'Aragorn', 'Legolas', 'Mordor', 'Peter Jackson'],
  },
  'star-wars': {
    titres: true,
    reperes: ['Star Wars', 'Guerre des étoiles', 'Jedi', 'Sith', 'Dark Vador', 'Skywalker', 'Anakin', 'Leia', 'Yoda', 'Obi-Wan', 'Han Solo', 'Chewbacca', 'R2-D2', 'C-3PO', 'Mandalorian', 'Tatooine', 'Étoile de la mort', 'Empire galactique', 'stormtrooper', 'sabre laser', 'George Lucas'],
  },
  stargate: { titres: false, reperes: ['Stargate'] },
  tintin: { titres: true, reperes: ['Tintin', 'Hergé', 'Milou', 'Haddock', 'Tournesol', 'Dupond', 'Dupont', 'Dupondt', 'Castafiore', 'Moulinsart'] },
}

/** Sans accents ni casse, l'apostrophe droite : « l’Anneau » et « l'Anneau » se valent. */
const plat = (texte: string) => sansAccent(texte).replace(/[’‘]/g, "'")

/** Les repères déjà mis à plat, une fois : le juge passe sur chaque entrée d'un lot ou d'un dépôt. */
const REPERES_A_PLAT: ReadonlyMap<string, { titres: boolean; reperes: readonly string[] }> = new Map(
  Object.entries(REPERES_DES_UNIVERS).map(([cle, u]) => [cle, { titres: u.titres, reperes: u.reperes.map(plat) }]),
)

const lettreOuChiffre = (c: string | undefined) => c !== undefined && /[a-z0-9]/.test(c)

/** Le repère écrit en mot entier, au pluriel près : « les hobbits », « des Jedi ». */
function ecritDans(texte: string, repere: string): boolean {
  for (let i = texte.indexOf(repere); i >= 0; i = texte.indexOf(repere, i + 1)) {
    let fin = i + repere.length
    if (texte[fin] === 's' || texte[fin] === 'x') fin++
    if (!lettreOuChiffre(texte[i - 1]) && !lettreOuChiffre(texte[fin])) return true
  }
  return false
}

/**
 * Un titre d'œuvre dans l'intitulé, quand l'univers en compte : une œuvre de
 * ses entités écrite en toutes lettres, sans son article (« du « Roi lion » »
 * pour « Le Roi lion »), ou un titre entre guillemets que la phrase donne pour
 * un titre — après « dans », « de », « film », « album »…, ou suivi de son
 * année : les films de 007 n'ont pas toujours leur entité. Une réplique entre
 * guillemets n'en est pas un : « Quel ours soupire « Oh, bother ! » ? » ne
 * dit pas Disney.
 */
const TITRE_ENTRE_GUILLEMETS = /(\b(dans|de|du|des|d'|film|animation|anime|album|tome|roman|jeu|livre|realise|signe|ecrit)\s*«[^»]+»|«[^»]+»\s*\(\d{4}\))/

/** Les titres des œuvres d'une question, sans leur précision entre parenthèses ni leur article. */
const titresDesOeuvres = (entites: MetadonneesDeQuestion['entites']) =>
  entites.filter(e => e.type === 'oeuvre').map(e => plat(e.nom).replace(/\s*\([^)]*\)$/, '').replace(/^(le|la|les|l')\s*/, '')).filter(t => t.length >= 4)

/**
 * L'univers qu'une question porte en étiquette sans le nommer, ou rien. Une
 * question dont la bonne réponse est l'univers — ou, quand ses titres
 * comptent, une de ses œuvres — le décrit déjà : « Quelle série suit les
 * rescapés du vol Oceanic 815 ? → Lost » n'a rien à nommer.
 */
export function universSansSonNom(q: { texte: string; reponses: readonly string[]; bonne: number; meta: Pick<MetadonneesDeQuestion, 'etiquettes' | 'entites'> }): string | null {
  const texte = plat(q.texte)
  const bonne = plat(q.reponses[q.bonne] ?? '')
  for (const cle of q.meta.etiquettes) {
    const u = REPERES_A_PLAT.get(cle)
    if (!u) continue
    if (u.reperes.some(r => ecritDans(texte, r) || ecritDans(bonne, r))) continue
    if (u.titres) {
      const titres = titresDesOeuvres(q.meta.entites)
      if (titres.some(t => ecritDans(texte, t) || ecritDans(bonne, t)) || TITRE_ENTRE_GUILLEMETS.test(texte)) continue
    }
    return cle
  }
  return null
}

/** Le nom d'un univers, tel que la consigne le donne (`ETIQUETTES`, « Les univers »). */
function nomDeLUnivers(cle: string): string {
  for (const f of ETIQUETTES) for (const e of f.etiquettes) if (e.cle === cle) return e.nom
  return cle
}

/** Le refus du juge : ce qui manque, et quoi écrire. */
export function motifSansSonUnivers(cle: string): string {
  const u = REPERES_DES_UNIVERS[cle]
  const nom = nomDeLUnivers(cle)
  const exemple = u?.titres ? `« Dans ${nom}, … », ou le titre d'une de ses œuvres` : `« Dans ${nom}, … »`
  return `l’intitulé ne dit pas de quel univers il parle : nomme ${nom} (${exemple}) — hors de son thème, la question se joue aussi en série de toutes les catégories`
}
