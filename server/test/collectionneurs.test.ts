// La valeur d'une collection et le classement des collectionneurs
// (`shared/collectionneurs.ts`) : le barème que le propriétaire a retenu le
// 9 novembre 2026 sur la maquette (`retours/2026-11-09/classement-des-collections/`),
// et la règle de tous les classements (invariant 15) appliquée à chaque catégorie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CARATS_DE_LA_GEMME,
  CARATS_D_UN_ECLAT,
  CARATS_D_UN_MAITRE,
  CARATS_DU_ZENITH,
  CATEGORIE,
  CATEGORIES_DE_COLLECTION,
  LEGENDAIRES_SCELLABLES,
  caratsDeLaCollection,
  caratsDeLaPiece,
  bilanDuFaceAFace,
  celuiAPasser,
  classerLesCollectionneurs,
  enLegendaires,
  lignesDuFaceAFace,
  piecesDuStyle,
  piecesMaitresses,
  rangDeCollection,
  valeurDansLaCategorie,
  versionDeLaPiece,
  type ReleveDeCollection,
  type StyleDeCollection,
} from '../../shared/collectionneurs'
import { RARETES_D_AVATAR, type RareteDAvatar } from '../../shared/album'
import { LEGENDAIRES, estScellable } from '../../shared/legendaires'
import { releveDeLaCollection, type ProfilDuCollectionneur } from '../src/core/collectionneurs'

const aucuneGemme = (): Record<RareteDAvatar, number> => Object.fromEntries(RARETES_D_AVATAR.map(g => [g, 0])) as Record<RareteDAvatar, number>

function releve(r: Partial<ReleveDeCollection> = {}): ReleveDeCollection {
  return {
    niveau: 0,
    gemmes: aucuneGemme(),
    legendaires: [],
    divins: [],
    scelles: [],
    eclats: 0,
    maitres: [],
    paliers: 0,
    sceaux: { bronze: 0, argent: 0, or: 0 },
    trophees: 0,
    timbres: 0,
    ...r,
  }
}

const sansStyle = (): StyleDeCollection => ({ themes: {}, fonds: 0, gerbes: 0, finitions: 0, ligues: [] })

test('le barème : un Divin vaut huit légendaires, un Éclat et un maître chacun un, l’étoile du zénith deux', () => {
  assert.equal(CARATS_DE_LA_GEMME.divin, 200, 'le propriétaire : « passe-le à 200 »')
  assert.equal(CARATS_DE_LA_GEMME.divin, 8 * CARATS_DE_LA_GEMME.legendaire)
  assert.equal(CARATS_D_UN_ECLAT, CARATS_DE_LA_GEMME.legendaire)
  assert.equal(CARATS_D_UN_MAITRE, CARATS_DE_LA_GEMME.legendaire)
  assert.equal(CARATS_DU_ZENITH, 2 * CARATS_DE_LA_GEMME.legendaire, 'le propriétaire : « des légendaires durs à obtenir, donc j’aimerais que ce soit 50 »')
  // Chaque gemme vaut plus que celle d'en dessous : l'échelle de l'album.
  for (let i = 1; i < RARETES_D_AVATAR.length; i++) assert.ok(CARATS_DE_LA_GEMME[RARETES_D_AVATAR[i]] > CARATS_DE_LA_GEMME[RARETES_D_AVATAR[i - 1]])
})

test('le barème de la page compte en gemmes d’or ce qui vaut des légendaires, et jamais une gemme coupée', () => {
  // « Pas un gros pavé, plutôt le visuel » (le propriétaire, le 9 novembre 2026) : une gemme d'or par légendaire, que
  // l'œil compare d'une ligne à l'autre — et que le barème ne dessine que s'il tombe juste.
  assert.deepEqual([CARATS_D_UN_ECLAT, CARATS_D_UN_MAITRE, CARATS_DU_ZENITH, CARATS_DE_LA_GEMME.divin].map(enLegendaires), [1, 1, 2, 8])
  assert.equal(enLegendaires(CARATS_DE_LA_GEMME.legendaire), 1)
  // Un barème qui ne tomberait plus juste n'écrirait que ses carats : une gemme et demie mentirait.
  assert.equal(enLegendaires(40), null)
  assert.equal(enLegendaires(CARATS_DE_LA_GEMME.epique), null, 'moins d’un légendaire, pas de gemme d’or')
  assert.equal(enLegendaires(0), null)
})

test('la valeur d’une collection : ses trois familles, et le tout', () => {
  const gemmes = { ...aucuneGemme(), commune: 3, rare: 1, legendaire: 2, divin: 1 }
  const r = releve({ gemmes, eclats: 2, scelles: ['lg:comete'], maitres: ['monde'], sceaux: { bronze: 1, argent: 1, or: 1 }, trophees: 4, timbres: 3 })
  const style: StyleDeCollection = { themes: { offert: 2, rare: 1, legendaire: 1 }, fonds: 2, gerbes: 1, finitions: 3, ligues: ['bronze', 'argent', 'or'] }
  const c = caratsDeLaCollection(r, style)
  // Ses avatars, ses deux Éclats, et l'étoile du zénith de sa Comète.
  assert.equal(c.avatars, 3 * 1 + 5 + 2 * 25 + 200 + 2 * 25 + 50)
  assert.equal(c.trophees, 25 + 2 + 5 + 10 + 4 * 2 + 3 * 2)
  // Les deux thèmes offerts à tous ne valent rien.
  assert.equal(c.style, 5 + 25 + 2 * 3 + 3 + 3 * 2 + (1 + 2 + 5))
  assert.equal(c.total, c.avatars + c.trophees + c.style)
  assert.deepEqual(caratsDeLaCollection(releve(), sansStyle()), { avatars: 0, trophees: 0, style: 0, total: 0 })
})

/** Un profil tel que le magasin le donne au relevé, au niveau 1 : pas un emoji de collection, rien que ce qu'on lui ajoute. */
const profilVide = (p: Partial<ProfilDuCollectionneur> = {}): ProfilDuCollectionneur => ({
  id: 'p',
  nom: 'Léa',
  creeLe: 0,
  avatar: '🦊',
  apparence: {},
  bordure: null,
  niveau: 1,
  legendaires: [],
  scelles: [],
  divins: [],
  compagnons: [],
  eclatsPoses: 0,
  eclates: [],
  matieres: {},
  portees: {},
  hautsFaits: [],
  prix: [],
  calendrier: { pages: [], dorees: [], mois: '', joursCeMois: 0 },
  titresDates: [],
  sentiers: {},
  bordures: [],
  themes: [],
  fonds: [],
  gerbes: [],
  finitions: ['mat'],
  timbres: 0,
  ...p,
})

test('le relevé d’un profil : une matière n’est pas un avatar de plus, l’Opale ne coûte rien, un Divin ne prend pas d’Éclat', () => {
  // « Est-ce que les matières des légendaires comptent bien aussi comme un légendaire ? » (le propriétaire,
  // le 9 novembre 2026) : la matière coûte un Éclat et se compte comme lui (`eclatsPosesOf`, que le magasin
  // donne), jamais comme un avatar de plus — le Phénix en jade reste un légendaire sur trente-deux.
  const phenix = LEGENDAIRES[0].key
  const lea = releveDeLaCollection(
    profilVide({ legendaires: [phenix], divins: ['dv:helios'], eclatsPoses: 2, eclates: [phenix, 'dv:helios'], matieres: { [phenix]: ['jade'] } }),
  )
  assert.deepEqual({ ...lea.releve.gemmes }, { ...aucuneGemme(), legendaire: 1, divin: 1 }, 'un avatar chacun, la matière n’en ajoute pas')
  assert.equal(lea.releve.eclats, 2)
  assert.equal(caratsDeLaCollection(lea.releve, lea.style).avatars, CARATS_DE_LA_GEMME.legendaire + CARATS_DE_LA_GEMME.divin + 2 * CARATS_D_UN_ECLAT)
  // Le Divin d'abord, à sa gemme seule — même dit éclaté : un Divin ne prend ni Éclat ni matière.
  assert.deepEqual(
    lea.pieces.map(p => [p.cle, p.carats, p.eclat, p.taillees]),
    [
      ['dv:helios', 200, undefined, undefined],
      [phenix, 75, true, 1],
    ],
  )
  // Les quatre matières : cinq Éclats posés, et l'Opale qu'elles offrent par-dessus, sans rien de plus.
  const zoe = releveDeLaCollection(profilVide({ legendaires: [phenix], eclatsPoses: 5, eclates: [phenix], matieres: { [phenix]: ['porcelaine', 'corail', 'jade', 'obsidienne'] } }))
  assert.deepEqual(zoe.pieces.map(p => [p.cle, p.carats, p.eclat]), [[phenix, CARATS_DE_LA_GEMME.legendaire + 5 * CARATS_D_UN_ECLAT, 'opale']])
  assert.equal(zoe.releve.gemmes.legendaire, 1)
})

test('le relevé d’un profil : l’étoile du zénith d’un légendaire scellé compte, sur sa pièce et dans sa valeur', () => {
  // « Il faudrait du coup pouvoir récompenser dans le classement cela » (le propriétaire, le 9 novembre 2026) :
  // la même Comète, gagnée au Cabinet ou par ses quatre cents réflexes, ne vaut pas pareil.
  const [comete, phenix] = ['lg:comete', LEGENDAIRES[0].key]
  const auCabinet = releveDeLaCollection(profilVide({ legendaires: [comete, phenix] }))
  const scellee = releveDeLaCollection(profilVide({ legendaires: [comete, phenix], scelles: [comete] }))
  assert.deepEqual(scellee.releve.scelles, [comete])
  assert.deepEqual({ ...scellee.releve.gemmes }, { ...auCabinet.releve.gemmes }, 'scellé, il reste un légendaire : aucun avatar de plus')
  assert.equal(caratsDeLaCollection(scellee.releve, scellee.style).total - caratsDeLaCollection(auCabinet.releve, auCabinet.style).total, CARATS_DU_ZENITH)
  // Sa pièce le dit et le vaut : la plus belle de sa vitrine.
  assert.deepEqual(scellee.pieces[0], { cle: comete, gemme: 'legendaire', scelle: true, carats: CARATS_DE_LA_GEMME.legendaire + CARATS_DU_ZENITH })
  assert.equal(auCabinet.pieces.find(p => p.cle === comete)?.scelle, undefined)
  // Une étoile sans sa pièce ne compte pas : la règle ne scelle que ce qu'il a, la valeur ne le suppose pas.
  assert.deepEqual(releveDeLaCollection(profilVide({ legendaires: [phenix], scelles: [comete] })).releve.scelles, [])
})

test('une pièce de la vitrine : son Éclat, et chaque matière qu’il a coûté ; l’Opale n’en coûte pas de plus ; un Divin ne prend rien', () => {
  assert.equal(caratsDeLaPiece('legendaire'), 25)
  assert.equal(caratsDeLaPiece('legendaire', true), 50)
  assert.equal(caratsDeLaPiece('legendaire', true, 1), 75, 'un Éclat, puis un pour la matière taillée')
  assert.equal(caratsDeLaPiece('legendaire', true, 4), 150, 'les quatre matières, et l’Opale qu’elles ouvrent ne coûte rien de plus')
  assert.equal(caratsDeLaPiece('rare', true), 30)
  assert.equal(caratsDeLaPiece('divin', true, 2), 200, 'un Divin ne prend ni finition ni Éclat (invariant 21)')
  assert.equal(caratsDeLaPiece('divin', false, 0, true), 200, 'ni sceau')
  assert.equal(caratsDeLaPiece('commune'), 1)
  // Scellé : son étoile du zénith en plus — d'origine, ou éclaté et taillé : il égale alors un Divin, sans le passer.
  assert.equal(caratsDeLaPiece('legendaire', false, 0, true), 75)
  assert.equal(caratsDeLaPiece('legendaire', true, 4, true), 200)
  assert.ok(caratsDeLaPiece('legendaire', true, 4, true) <= CARATS_DE_LA_GEMME.divin, 'aucune pièce ne vaut plus qu’un Divin')
  // La version montrée : l'Opale aux quatre, la matière portée tant qu'il l'a, sinon la version rare.
  assert.equal(versionDeLaPiece(['jade', 'corail', 'porcelaine', 'obsidienne']), 'opale')
  assert.equal(versionDeLaPiece(['jade', 'corail'], 'corail'), 'corail')
  assert.equal(versionDeLaPiece(['jade'], 'corail'), true, 'une matière qu’il n’a plus ne se montre pas')
  assert.equal(versionDeLaPiece([], null), true)
})

test('le face-à-face : les Divins d’abord, rien des thèmes, et ce que ni l’un ni l’autre n’a ne se compare pas', () => {
  const avec = (r: Partial<ReleveDeCollection>, carats: number, style: StyleDeCollection = sansStyle()) => ({ ...releve(r), id: 'x', nom: 'X', avatar: '🦊', carats, familles: { avatars: 0, trophees: 0, style: 0 }, style })
  const moi = avec({ niveau: 12, legendaires: ['lg:phenix'], maitres: ['monde'], paliers: 13 }, 100)
  const lui = avec({ niveau: 30, divins: ['dv:x'], legendaires: ['lg:phenix', 'lg:sphinx'], eclats: 2 }, 400)
  const lignes = lignesDuFaceAFace(moi, lui)
  assert.equal(lignes[0].nom, 'Divins')
  assert.ok(lignes[0].divine)
  assert.ok(!lignes.some(l => /th[eè]me/i.test(l.nom)), 'pas de ligne pour les thèmes')
  assert.ok(!lignes.some(l => l.nom === 'Sceaux d’or du Cabinet'), 'ni l’un ni l’autre n’a de sceau d’or')
  assert.ok(!lignes.some(l => l.nom === 'Légendaires scellés'), 'ni l’un ni l’autre n’a de légendaire scellé')
  assert.deepEqual(bilanDuFaceAFace(lignes), { moi: 3, lui: 4, egalites: 0 })
  // Son Phénix scellé, le mien gagné au Cabinet : la ligne des scellés paraît, juste sous les légendaires.
  const scelle = lignesDuFaceAFace(moi, avec({ ...lui, scelles: ['lg:phenix'] }, 425))
  const i = scelle.findIndex(l => l.nom === 'Légendaires scellés')
  assert.deepEqual([scelle[i - 1].nom, scelle[i].moi, scelle[i].lui], ['Légendaires', 0, 1])
})

test('le face-à-face compare aussi les trophées et le style — ses timbres, finitions, bordures, gerbes, fonds —, jamais ses thèmes', () => {
  // « Comment on peut voir / comparer sur un joueur ce qu'ils ont à ce niveau ? » (le propriétaire, le 9 novembre 2026).
  const avec = (r: Partial<ReleveDeCollection>, style: StyleDeCollection) => ({ ...releve(r), id: 'x', nom: 'X', avatar: '🦊', carats: 1, familles: { avatars: 0, trophees: 0, style: 0 }, style })
  const moi = avec({ niveau: 8, timbres: 2 }, { themes: { legendaire: 4, offert: 2 }, fonds: 1, gerbes: 0, finitions: 3, ligues: ['bronze'] })
  const lui = avec({ niveau: 8, timbres: 1 }, { themes: {}, fonds: 2, gerbes: 0, finitions: 1, ligues: ['bronze', 'argent', 'or'] })
  const lignes = lignesDuFaceAFace(moi, lui)
  const ligne = (nom: string) => lignes.find(l => l.nom === nom)
  assert.deepEqual(
    lignes.map(l => l.nom),
    ['Timbres des fêtes', 'Finitions', 'Bordures de ligue', 'Fonds de carte', 'Niveau'],
    'les trophées puis le style, le niveau au bout ; ni gerbe ni l’un ni l’autre',
  )
  assert.deepEqual([ligne('Finitions')!.moi, ligne('Finitions')!.lui], [3, 1])
  assert.deepEqual([ligne('Bordures de ligue')!.moi, ligne('Bordures de ligue')!.lui], [1, 3], 'une bordure par ligue atteinte')
  // Quatre thèmes légendaires de plus que lui : rien ne le dit au face-à-face, et rien n'y penche pour moi.
  assert.ok(!lignes.some(l => /th[eè]me/i.test(l.nom)))
  assert.deepEqual(bilanDuFaceAFace(lignes), { moi: 2, lui: 2, egalites: 1 })
  // Ses comptes, pour sa vitrine : les deux thèmes offerts à tous n'y sont pas.
  assert.deepEqual(piecesDuStyle(moi.style), { themes: 4, fonds: 1, gerbes: 0, finitions: 3, bordures: 1 })
})

type Fiche = ReleveDeCollection & { id: string; nom: string; carats: number }
const fiche = (id: string, nom: string, carats: number, r: Partial<ReleveDeCollection> = {}): Fiche => ({ ...releve(r), id, nom, carats })

test('le classement d’une catégorie : les ex æquo partagent leur rang, et qui n’a rien n’y est pas', () => {
  const fiches = [
    fiche('p3', 'Zoé', 300, { maitres: ['monde', 'stade'], sceaux: { bronze: 0, argent: 0, or: 2 } }),
    fiche('p1', 'Léa', 579, { maitres: ['monde'], eclats: 1 }),
    fiche('p2', 'Max', 300, { maitres: ['monde', 'stade'] }),
    fiche('p4', 'Noé', 0),
  ]
  const collection = classerLesCollectionneurs(fiches, 'collection')
  assert.deepEqual(
    collection.map(c => [c.item.nom, c.rang]),
    [
      ['Léa', 1],
      ['Max', 2],
      ['Zoé', 2],
    ],
    'Max et Zoé à égalité : deuxièmes tous les deux, par ordre de nom ; Noé, à zéro, n’y est pas',
  )
  assert.deepEqual(
    classerLesCollectionneurs(fiches, 'maitres').map(c => [c.item.nom, c.rang]),
    [
      ['Max', 1],
      ['Zoé', 1],
      ['Léa', 3],
    ],
  )
  assert.deepEqual(
    classerLesCollectionneurs(fiches, 'cabinet').map(c => c.item.nom),
    ['Zoé'],
  )
  assert.equal(valeurDansLaCategorie(fiches[0], 'cabinet'), 2, 'le Cabinet se classe aux sceaux d’or')
  assert.deepEqual(classerLesCollectionneurs(fiches, 'eclats').map(c => c.item.nom), ['Léa'])
})

test('les scellés, septième catégorie : sur le nombre de légendaires qui se scellent, et qui n’a pas d’étoile n’y est pas', () => {
  // « Fais une septième catégorie scellés » (le propriétaire, le 9 novembre 2026).
  assert.equal(LEGENDAIRES_SCELLABLES, LEGENDAIRES.filter(estScellable).length, 'un légendaire de plus qui se scelle monte le plafond')
  assert.equal(CATEGORIE.scelles.sur, LEGENDAIRES_SCELLABLES)
  assert.deepEqual(CATEGORIES_DE_COLLECTION, ['collection', 'niveau', 'maitres', 'cabinet', 'legendaires', 'scelles', 'eclats'], 'la valeur, ce qu’il a fait, puis ses avatars')
  const fiches = [
    fiche('a', 'Ana', 100, { legendaires: ['lg:comete', 'lg:oracle'], scelles: ['lg:comete'] }),
    fiche('b', 'Bea', 300, { legendaires: ['lg:comete', 'lg:oracle', 'lg:phenix'] }),
    fiche('c', 'Cléo', 90, { legendaires: ['lg:comete', 'lg:oracle'], scelles: ['lg:comete', 'lg:oracle'] }),
  ]
  assert.deepEqual(
    classerLesCollectionneurs(fiches, 'scelles').map(c => [c.item.nom, c.rang]),
    [
      ['Cléo', 1],
      ['Ana', 2],
    ],
    'Bea, trois légendaires gagnés au Cabinet, n’y est pas',
  )
  assert.equal(valeurDansLaCategorie(fiches[2], 'scelles'), 2)
})

test('celui à passer : le plus proche strictement devant, jamais un ex æquo', () => {
  const classes = classerLesCollectionneurs(
    [fiche('a', 'Ana', 600), fiche('b', 'Bea', 400), fiche('c', 'Cléo', 400), fiche('d', 'Dan', 100)],
    'collection',
  )
  const carats = (f: Fiche) => f.carats
  // Bea et Cléo, ex æquo devant Dan : c'est la plus proche dans la liste qu'on lui nomme.
  assert.deepEqual(celuiAPasser(classes, 3, carats), { item: classes[2].item, manque: 301 })
  // Cléo, ex æquo de Bea, ne la « passe » pas d'un carat : c'est Ana qu'il faut passer.
  assert.equal(celuiAPasser(classes, 2, carats)?.item.nom, 'Ana')
  assert.equal(celuiAPasser(classes, 2, carats)?.manque, 201)
  assert.equal(celuiAPasser(classes, 0, carats), null, 'le premier n’a personne à passer')
})

test('les rangs d’une collection, de seuil en seuil', () => {
  assert.equal(rangDeCollection(0).nom, 'Le tiroir')
  assert.equal(rangDeCollection(99).nom, 'Le tiroir')
  assert.equal(rangDeCollection(100).nom, 'Le coffret')
  assert.equal(rangDeCollection(579).nom, 'La vitrine')
  assert.equal(rangDeCollection(1000).nom, 'Le musée')
  assert.equal(rangDeCollection(2049).nom, 'Le palais')
})

test('les pièces maîtresses : les plus chères d’abord, et l’ordre donné entre deux égales', () => {
  const pieces = [
    { cle: 'lg:phenix', gemme: 'legendaire' as const, carats: 25 },
    { cle: 'lg:sphinx', gemme: 'legendaire' as const, eclat: 'jade' as const, carats: 75 },
    { cle: 'dv:aube', gemme: 'divin' as const, carats: 200 },
    { cle: 'lg:licorne', gemme: 'legendaire' as const, carats: 25 },
  ]
  assert.deepEqual(
    piecesMaitresses(pieces).map(p => p.cle),
    ['dv:aube', 'lg:sphinx', 'lg:phenix'],
  )
  assert.deepEqual(piecesMaitresses(pieces, 10).map(p => p.cle), ['dv:aube', 'lg:sphinx', 'lg:phenix', 'lg:licorne'])
})
