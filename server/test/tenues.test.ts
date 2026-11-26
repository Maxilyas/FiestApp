// Les calques et les tenues de la loge (le 26 novembre 2026, la maquette
// `retours/2026-11-26/la-piece-avatar/` : « calques + tenues c'est le top »,
// puis « Je valide », le propriétaire). La pièce « Avatar » empilait une
// rangée de pastilles par réglage — chez une collectionneuse, ses avatars
// passaient 192 px sous le menu — : un rail de calques la remplace, une
// grille à la fois. Et ce qu'on règle calque par calque se garde : une tenue,
// c'est le look de sa carte — l'avatar et ses calques, le fond —, pas le
// palmarès — le titre et la vitrine le suivent. Les tenues sont des cartes :
// on glisse la carte de la loge, le cintre ouvre la liste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { AVATARS } from '../../shared/avatars'
import { NOM_D_UNE_TENUE_MAX, TENUES_MAX, laTenuePortee, lireLesTenues, lireUnLook, memeLook, type LookDUneTenue, type TenueGardee } from '../../shared/tenues'
import { calqueDOuverture, calqueDeLEssai, calquesDe, calquesNeufs, essaiDeLaTenue, lookPorte, nomDUneTenue } from '../../shared/loge'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '#avatar', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '#avatar', origin: 'http://banc' },
})

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

/** Ce que Léa porte : le Phénix éclaté, en Or, sa bordure d'or, son fond Nuit étoilée. */
const LEA = {
  id: 'p-lea',
  name: 'Léa',
  avatar: '🦊',
  legendaire: 'lg:phenix',
  finition: 'or',
  finitionChoisie: 'or',
  bordureChoisie: 'auto',
  motifChoisi: null,
  sceauMasque: false,
  fond: 'nuit',
  titre: null,
  vitrine: [],
  vitrineChoisie: null,
  theme: null,
  gerbe: null,
  niveau: 14,
  acquis: 10,
  requis: 100,
  ouvertes: ['mat', 'argent', 'or', 'holo'],
  legendaires: ['lg:phenix', 'lg:dragon'],
  divins: [],
  sentiers: {},
  hautsFaits: [],
  titresDates: [],
  eclats: ['lg:phenix'],
  eclatsEteints: [],
  matieres: { 'lg:phenix': ['jade'] },
  matieresPortees: {},
  scelles: ['lg:phenix'],
  bordures: [{ ligue: 'or', crans: 12 }],
  motifs: ['feuilles', 'jonc', 'nu', 'vagues'],
  fonds: ['nuit'],
  gerbes: ['confettis'],
  boutique: { confettis: { gagnes: 0, depenses: 0, solde: 0 }, possedes: ['velours', 'ivoire'], porte: null, jour: '2026-11-26' },
} as any

const LOOK: LookDUneTenue = { avatar: '🦊', legendaire: 'lg:phenix', finition: 'or', bordure: 'auto', motif: null, sceau: true, fond: 'nuit', eclat: { cle: 'lg:phenix', brille: true, matiere: null } }

test('les calques : chacun pour qui a de quoi le régler, et la loge s’ouvre sur celui qu’on demande, puis sur le neuf', () => {
  // L'avatar, la finition, la bordure pour tous ; la version dès un Éclat, le sceau dès un légendaire scellé.
  assert.deepEqual(calquesDe(LEA), ['avatar', 'version', 'finition', 'bordure', 'sceau'])
  assert.deepEqual(calquesDe({ eclats: [], scelles: [] }), ['avatar', 'finition', 'bordure'])
  // Le calque d'une pièce de l'essai : un motif se règle avec la bordure.
  assert.equal(calqueDeLEssai({ motif: 'vagues' }), 'bordure')
  assert.equal(calqueDeLEssai({ eclat: { cle: 'lg:phenix', brille: false } }), 'version')
  assert.equal(calqueDeLEssai({ finition: 'holo' }), 'finition')
  assert.equal(calqueDeLEssai({ sceau: false }), 'sceau')
  assert.equal(calqueDeLEssai({ legendaire: 'lg:dragon' }), 'avatar')
  assert.equal(calqueDeLEssai({ titre: 'hf:oracle' }), null)
  // Le neuf : une finition, une bordure — le reste se trouve dans la grille des avatars.
  assert.deepEqual([...calquesNeufs(['finition:holo', 'bordure:or:sertie', 'eclat:🦊', 'lg:dragon'])], ['finition', 'bordure', 'avatar'])
  // L'ouverture : le lien « Essayer » d'abord (un motif de la boutique ouvre « Bordure »), puis le premier calque neuf,
  // puis « Avatar » — on vient surtout changer d'avatar.
  assert.equal(calqueDOuverture({ motif: 'vagues' }, ['finition:holo'], calquesDe(LEA)), 'bordure')
  assert.equal(calqueDOuverture({}, ['bordure:or:sertie'], calquesDe(LEA)), 'bordure')
  assert.equal(calqueDOuverture({}, ['finition:holo', 'lg:dragon'], calquesDe(LEA)), 'avatar')
  assert.equal(calqueDOuverture({}, [], calquesDe(LEA)), 'avatar')
  // Une version demandée sans Éclat n'ouvre pas un calque qu'il n'a pas.
  assert.equal(calqueDOuverture({ eclat: { cle: '🦊', brille: false } }, [], ['avatar', 'finition', 'bordure']), 'avatar')
})

test('une tenue garde le look, pas le palmarès — et se lit de la base sans jamais casser', () => {
  // Ce qu'il porte : l'avatar et ses calques, le fond ; sa version du Phénix éclaté, rare.
  assert.deepEqual(lookPorte(LEA), LOOK)
  // En jade, la matière y est ; d'origine, la version aussi ; sans Éclat, rien.
  assert.deepEqual(lookPorte({ ...LEA, matieresPortees: { 'lg:phenix': 'jade' } }).eclat, { cle: 'lg:phenix', brille: true, matiere: 'jade' })
  assert.deepEqual(lookPorte({ ...LEA, eclatsEteints: ['lg:phenix'] }).eclat, { cle: 'lg:phenix', brille: false, matiere: null })
  assert.equal(lookPorte({ ...LEA, legendaire: 'lg:dragon' }).eclat, null)
  // Ni titre ni vitrine : ils le suivent d'une tenue à l'autre (« tu penses qu'il faut tout ou juste l'avatar qui change ? »).
  assert.deepEqual(Object.keys(LOOK).sort(), ['avatar', 'bordure', 'eclat', 'finition', 'fond', 'legendaire', 'motif', 'sceau'])
  // Son nom d'office : celui de son avatar.
  assert.equal(nomDUneTenue(LOOK), 'Le Phénix')
  assert.equal(nomDUneTenue({ ...LOOK, legendaire: null }), 'Ma tenue')
  assert.equal(nomDUneTenue({ ...LOOK, legendaire: 'cp:loup-louveteau' }), 'Le Loup')

  // Deux looks qui habillent la carte de même : sous un légendaire, l'emoji d'en dessous ne compte pas.
  assert.ok(memeLook(LOOK, { ...LOOK, avatar: '🐸' }))
  assert.ok(!memeLook(LOOK, { ...LOOK, fond: null }))
  assert.ok(!memeLook(LOOK, { ...LOOK, eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } }))
  assert.ok(!memeLook({ ...LOOK, legendaire: null }, { ...LOOK, legendaire: null, avatar: '🐸' }))

  // La colonne `tenues` : du JSON. Illisible, rien ; une tenue sans sa forme se tait, la suivante se lit ; six au plus.
  const t = (i: number): TenueGardee => ({ id: `t${i}`, nom: `Tenue ${i}`, look: LOOK })
  assert.deepEqual(lireLesTenues(null), [])
  assert.deepEqual(lireLesTenues('pas du json'), [])
  assert.deepEqual(lireLesTenues(JSON.stringify({ id: 't1' })), [])
  assert.deepEqual(lireLesTenues(JSON.stringify([{ id: 't0', nom: 'Sans look' }, t(1)])), [t(1)])
  assert.equal(lireLesTenues(JSON.stringify(Array.from({ length: TENUES_MAX + 3 }, (_, i) => t(i)))).length, TENUES_MAX)
  assert.equal(lireLesTenues(JSON.stringify([{ ...t(1), nom: 'x'.repeat(40) }]))[0].nom.length, NOM_D_UNE_TENUE_MAX)
  // Un look à moitié écrit se complète d'office ; sans avatar, il n'y a pas de look.
  assert.deepEqual(lireUnLook({ avatar: '🦊' }), { avatar: '🦊', legendaire: null, finition: 'auto', bordure: 'auto', motif: null, sceau: true, fond: null, eclat: null })
  assert.equal(lireUnLook({ legendaire: 'lg:phenix' }), null)
})

test('la tenue qu’il porte se reconnaît — sa version d’un Éclat comprise — sans lire la cible de l’Éclat', () => {
  const tenues: TenueGardee[] = [
    { id: 'a', nom: 'Dragon', look: { ...LOOK, legendaire: 'lg:dragon', eclat: null } },
    { id: 'b', nom: 'Soirée', look: LOOK },
  ]
  assert.equal(laTenuePortee(tenues, LEA), 1)
  // Une pièce qui diffère : aucune — ni le fond, ni la version de l'Éclat, ni un calque.
  assert.equal(laTenuePortee(tenues, { ...LEA, fond: null }), -1)
  assert.equal(laTenuePortee(tenues, { ...LEA, eclatsEteints: ['lg:phenix'] }), -1)
  assert.equal(laTenuePortee(tenues, { ...LEA, motifChoisi: 'vagues' }), -1)
  assert.equal(laTenuePortee(tenues, { ...LEA, sceauMasque: true }), -1)
  assert.equal(laTenuePortee(tenues, { ...LEA, legendaire: 'lg:dragon' }), 0)
  // Taillé en jade et porté en jade : sa tenue en jade, pas celle en version rare.
  const jade = { ...LEA, matieresPortees: { 'lg:phenix': 'jade' } }
  assert.equal(laTenuePortee(tenues, jade), -1)
  assert.equal(laTenuePortee([...tenues, { id: 'c', nom: 'Jade', look: { ...LOOK, eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } } }], jade), 2)
})

test('une tenue s’essaie pièce par pièce, et ce qui n’est plus à lui se tait : elle se porte sans', () => {
  // Le Dragon en Holo, sa bordure sans motif, le Fil nu, le sceau masqué, aucun fond.
  const dragon: LookDUneTenue = { avatar: '🦊', legendaire: 'lg:dragon', finition: 'holo', bordure: 'aucune', motif: 'nu', sceau: false, fond: null, eclat: null }
  assert.deepEqual(essaiDeLaTenue(dragon, LEA), { legendaire: 'lg:dragon', finition: 'holo', bordure: 'aucune', motif: 'nu', sceau: false, fond: null })
  // Ce qu'il porte déjà sort de l'essai : sa tenue d'aujourd'hui n'a rien à essayer.
  assert.deepEqual(essaiDeLaTenue(LOOK, LEA), {})
  // Un emoji ôte le légendaire ; l'Éclat se règle sur l'avatar montré.
  assert.deepEqual(essaiDeLaTenue({ ...LOOK, legendaire: null, avatar: '🐸', eclat: null }, LEA), { avatar: '🐸' })
  assert.deepEqual(essaiDeLaTenue({ ...LOOK, eclat: { cle: 'lg:phenix', brille: false, matiere: null } }, LEA), { eclat: { cle: 'lg:phenix', brille: false, matiere: null } })
  assert.deepEqual(essaiDeLaTenue({ ...LOOK, eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } }, LEA), { eclat: { cle: 'lg:phenix', brille: true, matiere: 'jade' } })
  // Ce qu'il n'a plus : un légendaire repris, une finition au-dessus de son niveau, une ligue, un motif, un fond, une
  // matière jamais taillée — chacun se tait, le reste de la tenue se porte.
  const perdue: LookDUneTenue = { avatar: '🦊', legendaire: 'lg:kraken', finition: 'singularite', bordure: 'diamant', motif: 'cometes', sceau: true, fond: 'abysses', eclat: { cle: 'lg:phenix', brille: true, matiere: 'opale' } }
  assert.deepEqual(essaiDeLaTenue(perdue, LEA), {})
  assert.deepEqual(essaiDeLaTenue({ ...perdue, finition: 'argent' }, LEA), { finition: 'argent' })
})

test('les tenues au serveur : garder ce qu’il porte, renommer, retirer — six au plus, sans doublon, revues après un réveil', async () => {
  const banc: Banc = await demarrer()
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const tenues = (r: Response) => r.json().then((j: any) => ({ status: r.status, tenues: j.tenues as TenueGardee[], erreur: j.error as string | undefined }))
    const garder = (corps: object = {}) => ecrire(banc.url, '/api/joueur/tenues', corps, lea).then(tenues)
    const porter = (patch: object) => ecrire(banc.url, '/api/joueur/moi', patch, lea, 'PUT').then(r => assert.equal(r.status, 200))
    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: lea } })).json()) as any).profile

    // Sans profil : rien.
    assert.equal((await ecrire(banc.url, '/api/joueur/tenues', {})).status, 401)
    // Rien de gardé : la page le dit, une liste vide.
    assert.deepEqual((await moi()).tenues, [])

    // Ce qu'il porte, gardé sous le nom de son avatar — ce que la page envoie d'autre ne compte pas.
    const premiere = await garder({ look: { legendaire: 'lg:kraken' } })
    assert.equal(premiere.status, 200)
    assert.equal(premiere.tenues.length, 1)
    assert.deepEqual(premiere.tenues[0].look, { avatar: '🦊', legendaire: null, finition: 'auto', bordure: 'auto', motif: null, sceau: true, fond: null, eclat: null })
    assert.equal(premiere.tenues[0].nom, 'Ma tenue')
    // La même encore : refusée, en la nommant.
    const doublon = await garder()
    assert.equal(doublon.status, 400)
    assert.equal(doublon.erreur, 'Tu la gardes déjà : « Ma tenue »')

    // Une autre tenue, sous son nom — ses espaces resserrés. Un nouveau venu n'a que le Mat : il l'épingle.
    await porter({ avatar: '🐸', finition: 'mat' })
    const deux = await garder({ nom: '  La   grenouille  ' })
    assert.deepEqual(deux.tenues.map(t => t.nom), ['Ma tenue', 'La grenouille'])
    assert.equal(deux.tenues[1].look.avatar, '🐸')
    assert.equal(deux.tenues[1].look.finition, 'mat')
    // Il les voit avec son profil, et la tenue qu'il porte se reconnaît.
    const profil = await moi()
    assert.deepEqual(profil.tenues, deux.tenues)
    assert.equal(laTenuePortee(profil.tenues, profil), 1)

    // Renommer : un nom vide se refuse, une tenue partie aussi.
    const id = deux.tenues[0].id
    const renommer = (cle: string, nom: unknown) => ecrire(banc.url, `/api/joueur/tenues/${cle}`, { nom }, lea, 'PUT').then(tenues)
    assert.equal((await renommer(id, '   ')).erreur, 'Il faut un nom à ta tenue')
    assert.equal((await renommer('inconnue', 'Soirée')).erreur, 'Cette tenue n’existe plus')
    assert.deepEqual((await renommer(id, 'Soirée')).tenues.map(t => t.nom), ['Soirée', 'La grenouille'])

    // Six au plus : la septième se refuse.
    const autres = AVATARS.filter(a => a !== '🦊' && a !== '🐸')
    for (let i = 3; i <= TENUES_MAX; i++) {
      await porter({ avatar: autres[i] })
      assert.equal((await garder({ nom: `Tenue ${i}` })).status, 200)
    }
    assert.equal((await moi()).tenues.length, TENUES_MAX)
    await porter({ avatar: autres[0] })
    assert.equal((await garder()).erreur, `${TENUES_MAX} tenues au plus : retires-en une d’abord`)

    // Retirer : ce qu'il porte ne bouge pas ; une tenue partie se refuse.
    const retirer = (cle: string) => fetch(`${banc.url}/api/joueur/tenues/${cle}`, { method: 'DELETE', headers: { Cookie: lea, 'X-Requested-With': 'quizz' } }).then(tenues)
    const apres = await retirer(id)
    assert.equal(apres.tenues.length, TENUES_MAX - 1)
    assert.ok(!apres.tenues.some(t => t.id === id))
    assert.equal((await retirer(id)).erreur, 'Cette tenue n’existe plus')
    assert.equal((await moi()).avatar, autres[0])

    // Un réveil les relit de la base, telles quelles.
    await banc.redemarrer()
    assert.deepEqual((await moi()).tenues, apres.tenues)
  } finally {
    await banc.close()
  }
})

test('sur la carte de la loge : la tranche des autres tenues, le cintre et un point chacune — et la loge les tient', async () => {
  const tenues: TenueGardee[] = [
    { id: 'a', nom: 'Soirée', look: LOOK },
    { id: 'b', nom: 'Dragon', look: { ...LOOK, legendaire: 'lg:dragon', eclat: null } },
    { id: 'c', nom: 'Renard', look: { ...LOOK, legendaire: null, eclat: null, fond: null } },
  ]
  // La tête légère (avant les panneaux) : la tranche derrière la carte, la portée en or et cerclée.
  const tete = await rendu('components/LogeTete', 'LogeEnChemin', { profil: { ...LEA, tenues }, piece: 'avatar', onPiece: () => {}, attente: null })
  assert.match(tete, /<div class="loge-collante loge-paquet"><div class="loge-carte carte-fond fond-nuit">/)
  assert.match(
    tete,
    /<button type="button" class="loge-tenues" aria-haspopup="dialog" aria-label="Mes tenues, 3 gardées"><span class="loge-tenues-pilule" aria-hidden="true"><svg[^>]*>.*?<\/svg><i class="loge-point montree portee"><\/i><i class="loge-point"><\/i><i class="loge-point"><\/i><\/span><\/button>/,
  )
  // Sans tenue : le cintre seul, sans tranche derrière la carte.
  const seul = await rendu('components/LogeTete', 'LogeEnChemin', { profil: { ...LEA, tenues: [] }, piece: 'avatar', onPiece: () => {}, attente: null })
  assert.match(seul, /<div class="loge-collante"><div class="loge-carte/)
  assert.match(seul, /aria-label="Mes tenues"><span class="loge-tenues-pilule" aria-hidden="true"><svg[^>]*>.*?<\/svg><\/span><\/button>/)
  // « Version rare » n'est plus sur la carte : son calque l'a reprise.
  assert.doesNotMatch(tete, /loge-version|Version rare/)

  // Une tenue gardée montrée : son nom à la place d'« Aperçu ».
  const carte = await rendu('components/LogeTete', 'CarteDeLaLoge', { vu: LEA, vitrine: [], apercu: true, tenueMontree: 'Dragon', paquet: { noms: ['Soirée', 'Dragon'], portee: 0, montree: 1 } })
  assert.match(carte, /<span class="loge-apercu loge-apercu-tenue"><svg[^>]*>.*?<\/svg>Dragon<\/span>/)
  assert.match(carte, /<i class="loge-point portee"><\/i><i class="loge-point montree"><\/i>/)

  // La loge : le doigt glisse la carte d'une tenue à l'autre, le cintre ouvre la liste ; une tenue montrée remplace le
  // look de l'essai et garde le reste (un titre, un thème) ; toucher un calque la quitte.
  const LOGE = source('components/Loge.tsx')
  assert.match(LOGE, /paquet=\{\{ noms: tenues\.map\(t => t\.nom\), portee, montree, onCintre: \(\) => setListeOuverte\(true\), onGlisser: glisser \}\}/)
  assert.match(LOGE, /setEssai\(e => \(\{ \.\.\.sansLeLook\(e\), \.\.\.essaiDeLaTenue\(t\.look, profil\) \}\)\)/)
  assert.match(LOGE, /if \(Object\.keys\(morceau\)\.some\(k => \(DU_LOOK as readonly string\[\]\)\.includes\(k\)\)\) setTenueMontree\(null\)/)
  // « Garder ce que je porte » porte d'abord l'essai en cours : on compose avec les calques, puis on garde.
  assert.match(LOGE, /const garder = async \(\) => \{\s*if \(busy \|\| !\(await porter\(\)\)\) return\s*await tenir\(\(\) => api\.joueur\.garderUneTenue\(\)\)/)
  // Le glissé : jamais à la souris, jamais hors de l'écran, et le clic qui le suit ne l'ouvre pas en grand.
  const TETE = source('components/LogeTete.tsx')
  assert.match(TETE, /e\.isPrimary && e\.pointerType !== 'mouse'/)
  assert.match(TETE, /Math\.max\(-SUIT_LE_DOIGT, Math\.min\(SUIT_LE_DOIGT, dx \* 0\.4\)\)/)
  assert.match(TETE, /if \(Date\.now\(\) - glisseLe\.current > CLIC_APRES_UN_GLISSE_MS\) return/)
  const CSS = source('styles.css')
  assert.match(CSS, /\.loge-carte \{ touch-action: pan-y pinch-zoom; \}/)
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{\s*\.loge-carte-tenue \{ transform: none; \}/)
})
