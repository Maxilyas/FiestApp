// « Mes avatars » et « Mon style », à la manière de la maquette.
//
// Les avatars se parcourent en atlas : un rail des douze branches, chacune un
// orbe dont l'anneau se remplit, puis la branche choisie en chemin ; les
// légendaires et les Divins en grilles de médaillons. Le style se lit en
// quatre lignes — ce qui est choisi, en clair —, chacune ouvrant son écran à
// son adresse, la carte collée en tête pendant qu'on règle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { BRANCHES, ouvertsDansLaBranche } from '../../shared/branches'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' },
})

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// La branche la plus avancée ouvre l'atlas : trois portraits sur six.
const avancee = BRANCHES[2]
const savoir = { [avancee.categorie]: avancee.portraits[2].seuil }

const profil = {
  id: 'p',
  login: 'lea',
  name: 'Léa',
  avatar: '🦊',
  finition: 'mat',
  finitionChoisie: 'auto',
  niveau: 3,
  acquis: 40,
  requis: 100,
  titre: null,
  fond: null,
  theme: null,
  laurier: false,
  legendaire: null,
  legendaires: [LEGENDAIRES[0].key],
  divins: [],
  eclats: [],
  eclatsEteints: [],
  hautsFaits: [],
  ecussons: Object.entries(savoir).map(([categorie, justes]) => ({ categorie, justes })),
  boutique: { confettis: { solde: 12 } },
}
const rien = { busy: false, enregistrer: () => {} }

test('le savoir en atlas : douze orbes sur deux rangées, la branche la plus avancée en chemin', async () => {
  const html = await rendu('components/AtlasDesAvatars', 'AtlasDesAvatars', { profil, ...rien, onglet: 'savoir' })
  assert.match(html, /<div class="atlas-rail rail-compact" role="tablist" aria-label="Les douze branches">/)
  assert.equal(html.match(/class="atlas-orbe"/g)?.length, BRANCHES.length)
  // Chaque orbe dit où il en est, en chiffres : l'anneau seul ne se lit pas.
  for (const b of BRANCHES) assert.match(html, new RegExp(`${ouvertsDansLaBranche(b, savoir)}/${b.portraits.length}`), b.nom)
  // La branche ouverte d'abord est celle où l'on avance — trois portraits gagnés, le quatrième qui palpite.
  assert.match(html, /<section class="atlas-branche"/)
  assert.equal(html.match(/class="atlas-etape atlas-gagne"/g)?.length, 3)
  assert.equal(html.match(/class="atlas-etape atlas-prochain"/g)?.length, 1)
  assert.equal(html.match(/class="atlas-etape atlas-ferme"/g)?.length, 2)
  // On passe d'une branche à l'autre aux flèches, sans repasser par le rail.
  assert.match(html, /aria-label="Branche précédente"/)
  assert.match(html, /aria-label="Branche suivante"/)
})

test('les légendaires et les Divins en grilles de médaillons, le compte en tête', async () => {
  const html = await rendu('components/AtlasDesAvatars', 'AtlasDesAvatars', { profil, ...rien, onglet: 'legendaires' })
  assert.doesNotMatch(html, /atlas-rail/, 'les légendaires n’ont pas le rail des branches')
  assert.match(html, new RegExp(`1 sur ${LEGENDAIRES.length}`))
  assert.equal(html.match(/class="hud-case[^"]*"/g)?.length, LEGENDAIRES.length + DIVINS.length)
  assert.equal(html.match(/class="hud-case hud-gagne"/g)?.length, 1)
  // Un Divin verrouillé ne dit rien de lui, pas même son nom (invariant 21).
  assert.match(html, /<div class="hud-grille hud-grille-divins">/)
  for (const d of DIVINS) assert.doesNotMatch(html, new RegExp(`aria-label="${d.nom}`), d.nom)
  assert.match(html, /Ils ne disent pas comment/)
})

test('« Mon style » : quatre lignes, ce qui est choisi en clair, chacune son écran — le thème compris', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauStyle', { profil, ...rien, onReglage: () => {} })
  assert.match(html, /<button type="button" class="identite"/, 'sa carte en tête : c’est elle qui change')
  const lignes = [...html.matchAll(/<span class="style-nom">([^<]+)<\/span><span class="style-valeur">([^<]+)<\/span>/g)].map(([, nom, valeur]) => `${nom} : ${valeur}`)
  assert.deepEqual(lignes, ['Finition : Auto · Mat', 'Titre : Aucun', 'Fond de carte : Aucun', 'Thème : Velours'])
  // Le thème aussi : ceux qu'on a se portent ici, la boutique ne vend que les autres.
  assert.equal(html.match(/<li><button type="button"><span class="style-icone">/g)?.length, 4)
  // Chaque réglage a son écran, à son adresse : le retour du navigateur ramène au style.
  const app = source('views/ProfilApp.tsx')
  assert.match(app, /type ReglageDuStyle = 'style-finition' \| 'style-titre' \| 'style-fond' \| 'style-theme'/)
  assert.match(app, /onReglage=\{r => ouvrir\(`style-\$\{r\}`\)\}/)
  // Le réglage garde la carte collée en tête, où l'on voit ce qu'on change.
  assert.match(source('components/PanneauxDuProfil.tsx'), /<div className="identite-collante">/)
  assert.match(source('styles.css'), /\.identite-collante \{ position: sticky; top: 0;/)
})

// ── Les trophées, la carrière, les soirées ─────────────────────────────

const releve = (qcm: number, justes: number, rang: number) => ({
  questions: qcm,
  reponses: qcm,
  qcm,
  justes,
  tempsJustesMs: justes * 3000,
  meilleurTempsMs: 1800,
  reflexes: 0,
  premiers: 0,
  meilleureSerie: 2,
  estimations: 0,
  estimationsExactes: 0,
  estimationsProches: 0,
  ecartRelatif: 0,
  estimationsComparees: 0,
  coupDOeil: 0,
  rang,
})

const vecu = {
  ...profil,
  vitrine: [],
  vitrineChoisie: null,
  fiche: {
    soirees: 2,
    reponses: 30,
    precision: 0.8,
    qcm: 20,
    justes: 16,
    coupDOeil: null,
    estimationsComparees: 0,
    reflexeMoyenMs: 2200,
    meilleurTempsMs: 1800,
    meilleureSerie: 6,
    quizGagnes: 1,
    podiumsQuiz: 2,
    estimationsExactes: 0,
    flair: null,
    hotes: 2,
  },
  categories: { Histoire: { questions: 10, justes: 9 }, Sciences: { questions: 10, justes: 7 } },
  soirees: [
    { soireeId: 's2', chez: 'Antoine', slug: 'chez-antoine', titre: 'Soirée jeux', joueurId: 'j2', xp: 214, gain: {}, releve: releve(10, 8, 1), at: Date.UTC(2026, 8, 29, 19) },
    { soireeId: 's1', chez: 'Hugo', slug: 'chez-hugo', titre: null, joueurId: null, xp: 120, gain: {}, releve: releve(10, 8, 4), at: Date.UTC(2025, 8, 20, 19) },
  ],
  prix: [{ key: 'prix:eclair', emoji: '⚡', title: 'L’Éclair', rule: 'Le plus rapide', fois: 1 }],
}

test('les trophées : la vitrine sur une ligne, six collections qu’on déplie, une à la fois', async () => {
  const html = await rendu('components/TropheesAtlas', 'TropheesAtlas', { profil: vecu, ...rien })
  assert.match(html, /<section class="vitrine-ligne" aria-label="Ma vitrine">/)
  // Rien à montrer encore : la ligne le dit, sans bouton pour choisir dans le vide.
  assert.match(html, /Elle se remplit à la fin de chaque soirée/)
  assert.doesNotMatch(html, />Changer</)
  const lignes = [...html.matchAll(/<span class="trophee-texte"><b>([^<]+)<\/b>/g)].map(([, nom]) => nom)
  assert.deepEqual(lignes, ['Hauts faits', 'Coups du sort', 'Paliers', 'Écussons', 'Prix', 'Quiz du jour'])
  // Toutes repliées à l'ouverture : la page tient en un écran.
  assert.equal(html.match(/aria-expanded="false"/g)?.length, 6)
  assert.doesNotMatch(html, /trophee-contenu/)
  assert.match(html, /1\/1<span class="jauge-fine"/, 'les prix : un sur un')
  assert.match(source('components/PanneauxDuProfil.tsx'), /return <TropheesAtlas profil=\{profil\} busy=\{busy\} enregistrer=\{enregistrer\} \/>/)
})

test('la carrière : trois jauges jamais fondues, les chiffres en cases, quatre vues', async () => {
  const html = await rendu('components/CarriereAtlas', 'CarriereAtlas', { profil: vecu })
  const jauges = [...html.matchAll(/<span class="hud-jauge-valeur">([^<]+)<\/span><figcaption><b>([^<]+)<\/b>/g)].map(([, v, nom]) => `${nom} ${v}`)
  // Sans estimation comparée, le coup d'œil dit « — », jamais « 0 % ».
  assert.deepEqual(jauges, ['Précision 80 %', 'Coup d’œil —', 'Flair —'])
  assert.match(html, /16 sur 20 QCM/)
  assert.equal(html.match(/class="atlas-orbe"/g)?.length, 4)
  assert.match(html, /<div class="atlas-rail" role="tablist" aria-label="Ma carrière">/)
  // Tous les chiffres d'avant restent, en cases : rien ne se perd au passage.
  for (const mot of ['soirées', 'quiz gagnés', 'podiums', 'réflexe moyen', 'record de vitesse', 'meilleure série', 'réponses', 'estimations exactes', 'hôtes différents'])
    assert.match(html, new RegExp(`</b>${mot}</span>`), mot)
  assert.match(html, /Soirée après soirée/)
})

test('mes soirées : chez moi ou ailleurs, une carte chacune, le souvenir et son bilan d’un toucher', async () => {
  const html = await rendu('components/MesSoirees', 'MesSoirees', { profil: vecu, monEspace: 'chez-antoine' })
  const filtres = [...html.matchAll(/aria-pressed="(true|false)">([^<]+) <span class="rayon-compte">(\d+)<\/span>/g)].map(([, ici, nom, n]) => `${nom.trim()} ${n}${ici === 'true' ? ' (ici)' : ''}`)
  assert.deepEqual(filtres, ['Toutes 2 (ici)', 'Chez moi 1', 'Ailleurs 1'])
  assert.equal(html.match(/<li class="soiree-carte">/g)?.length, 2)
  // La soirée de son salon se reconnaît à sa date cerclée.
  assert.equal(html.match(/soiree-date soiree-chez-moi/g)?.length, 1)
  assert.match(html, /<a class="soiree-nom" href="\/chez-antoine\/soirees\/s2\/souvenir">Soirée jeux<\/a>/)
  assert.match(html, /href="\/chez-antoine\/soirees\/s2\/bilan#p=j2">Mon bilan<\/a>/)
  // L'année ne s'écrit que pour une soirée d'une autre année.
  assert.equal(html.match(/class="soiree-annee"/g)?.length, 1)
  // Sans salon à lui, pas de filtres : « Chez moi » n'y voudrait rien dire.
  const sansSalon = await rendu('components/MesSoirees', 'MesSoirees', { profil: vecu, monEspace: null })
  assert.doesNotMatch(sansSalon, /rayons-texte/)
  const app = source('views/ProfilApp.tsx')
  assert.match(app, /<pret\.PanneauSoirees profil=\{profil\} monEspace=\{espace\?\.slug\} \/>/)
  assert.match(app, /<pret\.PanneauCarriere profil=\{profil\} \/>/)
})
