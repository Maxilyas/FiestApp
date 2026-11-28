// Les traversées : mener tout le monde sur l'autre rive, dans une barque trop
// petite, sans jamais laisser ensemble ceux qui ne doivent pas l'être. La plus
// vieille famille d'énigmes qu'on sache dater : Alcuin en pose trois vers l'an
// 800. Le pont et sa lanterne se jouent dans le même moule — la lanterne est la
// barque, et chaque passage coûte le temps du plus lent.
import { plusCourt, type Fiche, type Moule } from '../socle'

export interface Passager {
  cle: string
  /** Un emoji antérieur à Unicode 13 : l'écran commun n'est pas seul sous Windows 10. */
  signe: string
  nom: string
  /** Une lettre ou un nombre au coin du jeton : à qui il est marié, combien de minutes il met. */
  marque?: string
  teinte?: string
  /** Ses minutes pour passer le pont. */
  temps?: number
}
export interface FicheDeTraversee extends Fiche {
  moule: 'traversee'
  passagers: readonly Passager[]
  places: number
  /** Qui sait mener la barque ; tous, sinon. */
  pilotes?: readonly string[]
  sansPilote?: string
  /** La phrase du malheur si ce groupe ne peut rester seul ; rien, sinon. */
  danger?: (groupe: readonly string[]) => string | null
  /** Le danger vaut aussi dans la barque. */
  aBord?: boolean
  /** Des minutes : au-delà, c'est perdu. */
  limite?: number
  tropTard?: string
  /** Ce qui tient lieu de barque : « La lanterne ». */
  barque?: string
}
export interface EtatDeTraversee {
  /** La rive de chacun : 0 le départ, 1 l'autre rive. */
  rive: Record<string, 0 | 1>
  barque: 0 | 1
  temps: number
}
/** Une traversée : ceux qui embarquent. Le choix se fait à l'écran ; la règle ne voit que la barque qui part. */
export interface CoupDeTraversee { traverse: string[] }

const saitMener = (f: FicheDeTraversee, groupe: readonly string[]) => !f.pilotes || groupe.some(c => f.pilotes!.includes(c))
// Tous les groupes de une à `places` personnes prises sur la rive de la barque.
function groupes(liste: readonly string[], places: number): string[][] {
  const r: string[][] = []
  const pousse = (debut: number, pris: string[]) => {
    if (pris.length) r.push(pris)
    if (pris.length === places) return
    for (let i = debut; i < liste.length; i++) pousse(i + 1, [...pris, liste[i]!])
  }
  pousse(0, [])
  return r
}
/** Pourquoi ce groupe ne peut pas partir, ou rien : l'écran le demande avant d'allumer la barque. */
export function refusDeLaBarque(f: FicheDeTraversee, e: EtatDeTraversee, qui: readonly string[]): string | null {
  if (!qui.length) return 'La barque ne part pas seule.'
  if (qui.length > f.places) return f.places > 1 ? `La barque ne porte que ${f.places} passagers.` : 'La barque ne porte qu’un passager.'
  if (new Set(qui).size !== qui.length || qui.some(c => e.rive[c] !== e.barque)) return 'La barque est sur l’autre rive.'
  if (!saitMener(f, qui)) return f.sansPilote || 'Personne à bord ne sait mener la barque.'
  return (f.aBord && f.danger?.(qui)) || null
}

export const traversee: Moule<FicheDeTraversee, EtatDeTraversee, CoupDeTraversee> = {
  cle: 'traversee',
  nom: 'Les traversées',
  socle: 'chemin',
  unite: ['traversée', 'traversées'],
  depart: f => ({ rive: Object.fromEntries(f.passagers.map(p => [p.cle, 0 as const])), barque: 0, temps: 0 }),
  jauge: (f, e) => (f.limite ? `${e.temps} min sur ${f.limite}` : null),
  coups(f, e) {
    const ici = f.passagers.filter(p => e.rive[p.cle] === e.barque).map(p => p.cle)
    return groupes(ici, f.places).filter(g => !refusDeLaBarque(f, e, g)).map(g => ({ traverse: g }))
  },
  jouer(f, e, coup) {
    const qui = Array.isArray(coup?.traverse) ? coup.traverse.filter(c => typeof c === 'string') : []
    const refus = refusDeLaBarque(f, e, qui)
    if (refus) return { refus }
    const rive = { ...e.rive }
    const autre = (1 - e.barque) as 0 | 1
    for (const c of qui) rive[c] = autre
    const cout = f.limite ? Math.max(...qui.map(c => f.passagers.find(p => p.cle === c)!.temps ?? 0)) : 0
    return { etat: { rive, barque: autre, temps: e.temps + cout } }
  },
  fini(f, e) {
    for (const cote of [0, 1] as const) {
      const malheur = f.danger?.(f.passagers.filter(p => e.rive[p.cle] === cote).map(p => p.cle))
      if (malheur) return { perdu: malheur }
    }
    if (f.limite && e.temps > f.limite) return { perdu: f.tropTard || 'Trop tard.' }
    return f.passagers.every(p => e.rive[p.cle] === 1) ? { gagne: true } : null
  },
  // Un pont se juge à ses minutes : la limite de la fiche doit être le plus court temps, pas une minute de trop.
  verifier(f) {
    const r = plusCourt(traversee, f)
    if (!r) return { ok: false, note: 'aucune solution' }
    if (f.limite && plusCourt(traversee, { ...f, limite: f.limite - 1 })) return { ok: false, note: `on fait mieux que ${f.limite} minutes` }
    return { ok: true, coups: r.coups, solution: r.solution, note: f.limite ? `${f.limite} minutes, pas une de moins` : undefined }
  },
}

/* ------------------------------------------------------------------ */

const commun = { moule: 'traversee' as const }

// Des couples jaloux : chacun sa lettre et sa couleur, pour qu'on voie d'un coup d'œil qui est à qui.
const TEINTES: Record<string, string> = { A: '#f3dea6', B: '#6f97c4', C: '#e06c6c', D: '#8fc48a', E: '#c79ad6' }
const couples = (lettres: string): Pick<FicheDeTraversee, 'passagers' | 'danger'> => ({
  passagers: [...lettres].flatMap(l => [
    { cle: 'mari' + l, signe: '🤴', nom: 'Le mari ' + l, marque: l, teinte: TEINTES[l] },
    { cle: 'femme' + l, signe: '👸', nom: 'L’épouse ' + l, marque: l.toLowerCase(), teinte: TEINTES[l] },
  ]),
  danger: g => {
    for (const l of lettres) {
      if (g.includes('femme' + l) && !g.includes('mari' + l) && g.some(c => c.startsWith('mari'))) return `Le mari ${l} est jaloux : sa femme est restée avec un autre.`
    }
    return null
  },
})

export const TRAVERSEES: readonly FicheDeTraversee[] = [
  {
    ...commun, id: 'loup-chevre-chou', niveau: 1,
    titre: 'Le loup, la chèvre et le chou',
    source: 'Alcuin d’York, Propositions pour aiguiser l’esprit des jeunes, vers l’an 800',
    recit: [
      'Un homme doit passer une rivière avec un loup, une chèvre et un chou.',
      'Sa barque ne porte que lui, et l’un des trois.',
      'Sans lui, le loup mange la chèvre, et la chèvre mange le chou.',
    ],
    regle: 'Touche qui embarque, puis la barque.',
    places: 2, pilotes: ['homme'], sansPilote: 'Seul l’homme sait mener la barque.',
    passagers: [
      { cle: 'homme', signe: '👨‍🌾', nom: 'L’homme' },
      { cle: 'loup', signe: '🐺', nom: 'Le loup' },
      { cle: 'chevre', signe: '🐐', nom: 'La chèvre' },
      { cle: 'chou', signe: '🥬', nom: 'Le chou' },
    ],
    danger: g => (g.includes('homme') ? null : g.includes('loup') && g.includes('chevre') ? 'Le loup a mangé la chèvre.' : g.includes('chevre') && g.includes('chou') ? 'La chèvre a mangé le chou.' : null),
  },
  {
    ...commun, id: 'missionnaires', niveau: 3,
    titre: 'Les trois ogres et les trois moines',
    source: 'Tradition, fin du XIXe siècle : « les missionnaires et les cannibales »',
    recit: [
      'Trois moines et trois ogres arrivent ensemble au bord du fleuve.',
      'La barque porte deux passagers, et n’importe lequel sait la mener.',
      'Mais sur une rive, que les ogres soient plus nombreux que les moines… et ils les dévorent.',
    ],
    regle: 'Jamais plus d’ogres que de moines sur une rive où il reste un moine.',
    places: 2,
    passagers: [
      ...[1, 2, 3].map(i => ({ cle: 'm' + i, signe: '🧔', nom: 'Un moine', teinte: '#f3dea6' })),
      ...[1, 2, 3].map(i => ({ cle: 'o' + i, signe: '👹', nom: 'Un ogre', teinte: '#e06c6c' })),
    ],
    danger: g => {
      const moines = g.filter(c => c[0] === 'm').length
      return moines && g.length - moines > moines ? 'Les ogres étaient plus nombreux : ils ont dévoré les moines.' : null
    },
  },
  {
    ...commun, id: 'couples-jaloux', niveau: 4,
    titre: 'Les trois maris jaloux',
    source: 'Bachet de Méziriac, Problèmes plaisants et délectables, 1612 — d’après Alcuin d’York',
    recit: [
      'Trois maris jaloux et leurs trois épouses doivent passer la rivière.',
      'La barque ne porte que deux personnes, et chacun sait la mener.',
      'Aucun mari ne souffre que sa femme reste avec un autre homme s’il n’est pas là, sur une rive comme dans la barque.',
    ],
    regle: 'Une épouse ne reste jamais avec un autre mari sans le sien.',
    places: 2, aBord: true, ...couples('ABC'),
  },
  // Dudeney donne onze traversées : le parcours les retrouve (`puits-enigmes.test.ts`).
  {
    ...commun, id: 'dudeney-375', niveau: 5,
    titre: 'Les cinq maris jaloux',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 375, 1917',
    recit: [
      'Une crue. Cinq couples cernés par l’eau, et une barque qui porte trois personnes.',
      'Chaque mari est si jaloux qu’il ne souffre pas sa femme auprès d’un autre homme, dans la barque ou sur une rive, s’il n’y est pas lui-même.',
      'Mène-les tous au sec, au plus vite.',
    ],
    regle: 'Trois dans la barque. Une épouse ne reste jamais avec un autre mari sans le sien.',
    places: 3, aBord: true, ...couples('ABCDE'),
  },
  {
    ...commun, id: 'pont-lanterne', niveau: 3,
    titre: 'Le pont et la lanterne',
    source: 'Tradition, XXe siècle',
    recit: [
      'Quatre voyageurs, la nuit, devant un pont de cordes qui ne porte que deux personnes.',
      'Ils n’ont qu’une lanterne, et nul ne passe sans elle : il faut la ramener.',
      'Chacun marche à son pas — une, trois, six et huit minutes —, et deux ensemble vont au pas du plus lent.',
      'Le pont cède dans dix-huit minutes.',
    ],
    regle: 'Deux au plus sur le pont, toujours avec la lanterne.',
    places: 2, limite: 18, barque: 'La lanterne', tropTard: 'Dix-huit minutes ont passé : le pont a cédé.',
    passagers: [
      { cle: 'vif', signe: '🏃', nom: 'Le plus vif, une minute', marque: '1', temps: 1, teinte: '#f3dea6' },
      { cle: 'pose', signe: '🚶', nom: 'Le posé, trois minutes', marque: '3', temps: 3, teinte: '#f3dea6' },
      { cle: 'lent', signe: '🧓', nom: 'Le lent, six minutes', marque: '6', temps: 6, teinte: '#f3dea6' },
      { cle: 'boiteux', signe: '🧙', nom: 'Le plus lent, huit minutes', marque: '8', temps: 8, teinte: '#f3dea6' },
    ],
  },
]
