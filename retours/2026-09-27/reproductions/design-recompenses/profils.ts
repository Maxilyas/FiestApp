// Les profils de l'atelier, du plus riche au tout neuf, écrits dans la base
// permanente du banc comme le font collection/fonds/ecussons/laurier.test.ts.
import { banc, changer, eclat, etagere, idDe, inscrireProfil, jours, laureatsDHier, mettreAuNiveau, soirees, ecrire, type Banc } from './outils'
import { connexionAnimateur } from '../../../server/test/banc'

export interface Joueur {
  login: string
  nom: string
  avatar: string
  cookie: string
  id: string
}

export const LEGENDAIRES_DOUZE: [string, number][] = [
  ['hf:phenix', 1],
  ['hf:triple', 1],
  ['hf:oracle', 8],
  ['hf:grand-chelem', 1],
  ['hf:foudre', 10],
  ['hf:seul-contre-tous', 3],
  ['hf:roi', 8],
  ['hf:habitue:3', 1],
  ['hf:reflexe:3', 1],
  ['hf:lanterne-rouge', 3],
  ['hf:somnambule', 6],
  ['hf:cosmique', 7],
]

/** Les douze catégories, à des paliers mêlés : quatre or, quatre argent, trois bronze, une rien. */
export const CATEGORIES_RICHES: Record<string, number> = {
  Sciences: 212,
  Histoire: 205,
  Géographie: 200,
  'Cinéma & séries': 224,
  Musique: 80,
  Sport: 91,
  Cuisine: 76,
  'Arts & lettres': 101,
  Nature: 25,
  'Culture générale': 40,
  'Jeux & pop culture': 20,
  'Autour de la fête': 5,
}

export async function peupler(): Promise<{ b: Banc; admin: string; j: Record<string, Joueur> }> {
  const b = await banc()
  const admin = await connexionAnimateur(b.url)
  const liste: [string, string, string][] = [
    ['mc', 'Marie-Charlotte Lefebvre', '🦊'],
    ['gw', 'Guillaume-Maxime Wawrzyn', '🦉'],
    ['op', 'Ophélie', '🐝'],
    ['bo', 'Bo', '🐻'],
    ['cam1', 'Camille', '🐙'],
    ['cam2', 'Camille', '🐙'],
    ['lea', 'Léa', '🐼'],
    ['zoe', 'Zoé', '🐸'],
  ]
  const j: Record<string, Joueur> = {}
  for (const [login, nom, avatar] of liste) {
    const cookie = await inscrireProfil(b.url, login, nom, avatar)
    j[login] = { login, nom, avatar, cookie, id: idDe(b, login) }
  }

  // Marie-Charlotte : tout. Niveau 25 (Constellation), les douze et le
  // Sphinx et les trois de saison, deux Divins, un Éclat sur le Phénix, les
  // quatre fonds, douze écussons, une vitrine pleine, un titre long, le laurier.
  mettreAuNiveau(b, j.mc.id, 25, 180)
  etagere(b, j.mc.id, [
    ...LEGENDAIRES_DOUZE,
    ['hf:assidu:3', 1],
    ['saison:halloween', 1],
    ['saison:noel', 1],
    ['saison:nouvel-an', 1],
    ['dv:seraphin', 1],
    ['dv:lotus', 1],
    ['hf:ascenseur', 2],
    ['hf:zero-pointe', 1],
    ['hf:buzzer-or', 4],
    ['hf:bavard:3', 1],
    ['hf:podium:2', 1],
    ['hf:champion-du-jour:2', 1],
    ['eclair', 6],
    ['sauveur', 2],
    ['lynx', 1],
  ])
  soirees(b, j.mc.id, 12, CATEGORIES_RICHES)
  jours(b, j.mc.id, 45, 12)
  eclat(b, j.mc.id, 'lg:phenix')

  // Guillaume-Maxime : niveau 20 (l'Aurore), la Citrouille, le laurier.
  mettreAuNiveau(b, j.gw.id, 20, 40)
  etagere(b, j.gw.id, [['saison:halloween', 1], ['hf:cosmique', 7], ['hf:lanterne-rouge', 1]])
  soirees(b, j.gw.id, 6, { Histoire: 90, Sport: 30, Musique: 22 })

  // Ophélie : niveau 17, le dernier emoji de collection (🪐), la Nuit étoilée.
  mettreAuNiveau(b, j.op.id, 17, 10)
  etagere(b, j.op.id, [['hf:somnambule', 2]])
  jours(b, j.op.id, 31, 2)

  // Bo : niveau 12, Hélios porté, le Kintsugi.
  mettreAuNiveau(b, j.bo.id, 12)
  etagere(b, j.bo.id, [['dv:helios', 1], ['hf:foudre', 3]])
  jours(b, j.bo.id, 14, 10)

  // Les deux Camille : même prénom, même avatar — « Camille (2) » ; la seconde a gagné hier.
  mettreAuNiveau(b, j.cam1.id, 3)
  mettreAuNiveau(b, j.cam2.id, 6)
  jours(b, j.cam2.id, 3, 1)

  // Léa : à mi-chemin, niveau 8, quelques hauts faits, trois écussons au bronze.
  // À vingt points du niveau 9 : la soirée lui ouvre le flamant (🦩), et sa fin de soirée l'annonce.
  mettreAuNiveau(b, j.lea.id, 9, -20)
  etagere(b, j.lea.id, [['hf:oracle', 3], ['hf:bavard:1', 1], ['eclair', 1]])
  soirees(b, j.lea.id, 3, { Histoire: 22, Nature: 21, Cuisine: 20, Musique: 12 })
  jours(b, j.lea.id, 4, 0)

  // Zoé : rien du tout.

  laureatsDHier(b, [j.mc.id, j.gw.id, j.op.id, j.cam2.id])
  await b.redemarrer()
  // La liste d'hier est lue en mémoire : remettre un profil au classement la fait relire.
  for (const x of [j.mc, j.gw, j.op, j.cam2]) await ecrire(b.url, '/api/admin/jour/masquer', { profileId: x.id, masque: false }, admin)

  await changer(b, j.mc.cookie, {
    legendaire: 'lg:phenix',
    titre: 'hf:ascenseur',
    vitrine: ['hf:ascenseur', 'hf:seul-contre-tous', 'hf:phenix'],
    fond: 'theatre',
  })
  await changer(b, j.gw.cookie, { legendaire: 'lg:citrouille', titre: 'hf:cosmique', fond: 'aurore' })
  await changer(b, j.op.cookie, { avatar: '🪐', fond: 'nuit', titre: 'hf:somnambule' })
  await changer(b, j.bo.cookie, { legendaire: 'dv:helios', fond: 'kintsugi' })
  await changer(b, j.lea.cookie, { avatar: '🦔' })
  return { b, admin, j }
}
