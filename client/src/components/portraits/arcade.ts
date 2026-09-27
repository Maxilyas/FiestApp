// L’arcade · Jeux & pop culture — du slime au chevalier, en pixels.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { pixels, type DessinDePortrait } from './outils'

/** La grille fine de l'écran, en filigrane : une ligne tous les cinq. */
const GRILLE = (() => {
  let d = ''
  for (let k = 5; k < 100; k += 5) d += `M${k},0 V100 M0,${k} H100 `
  return `<path d="${d}" stroke="#fff" stroke-opacity=".06" stroke-width=".5"/>`
})()

/** Des étoiles carrées, comme tout le reste. */
const ETOILES = (liste: [number, number][], couleur = '#ffe36b') =>
  liste.map(([x, y]) => `<rect x="${x}" y="${y}" width="2.5" height="2.5" fill="${couleur}" opacity=".85"/>`).join('')

/** Celles du chevalier de la maquette, que les autres reprennent. */
const CIEL: [number, number][] = [
  [14, 28],
  [84, 24],
  [12, 62],
  [88, 60],
  [26, 12],
  [76, 86],
]

/** Le contour d'un pixel, le même pour tous : c'est lui qui les détache du disque à 26 px. */
const A = '#141b28'

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:slime': {
    fond: ['#4cc2c8', '#16607a', '#07192b'],
    decor: () => GRILLE + ETOILES(CIEL),
    corps: () =>
      pixels(
        [
          '.......AA...........',
          '......ALGA..........',
          '.....AWLGGAAAAA.....',
          '....AWLGGGGGGGGA....',
          '...AWLGGGGGGGGGMA...',
          '...ALGGGGGGGGGGMA...',
          '..ALGGGGGGGGGGGGMA..',
          '..ALGGWKGGGGWKGGMA..',
          '..ALGGKKGGGGKKGGMA..',
          '..ALGGKKGGGGKKGGMA..',
          '..ALGPGGRGGRGGPGMA..',
          '..ALGGGGGRRGGGGGMA..',
          '..ALGGGGGGGGGGGGMA..',
          '..AGGGGGGGGGGGGLMA..',
          '..AGGLGGGGGGGGGGMA..',
          '.AAMGGGGGGGGGGGGMAA.',
          'ALMMGGGGGGGGGGGGMMDA',
          'ADMMMGGGGGGGGGGMMMDA',
          'ADDMMMMGGGGGGMMMMDDA',
          'ADDDMMMMMMMMMMMMDDDA',
          'ADDDDMMMMMMMMMMDDDDA',
          'ADDDDDDDDDDDDDDDDDDA',
        ],
        { A, W: '#ffffff', L: '#c9f59a', G: '#7fd650', M: '#4fae45', D: '#2d7d45', K: '#0d1118', P: '#ff8fa3', R: '#6e1a2c' },
        3.5,
        20.5,
      ),
  },

  'br:squelette': {
    fond: ['#4ab0cf', '#155277', '#061729'],
    decor: () => GRILLE + ETOILES(CIEL),
    corps: () =>
      pixels(
        [
          '..............A..',
          '.............ASA.',
          '.............ASA.',
          '.....AAAAAA..ASA.',
          '...AABBBBBCAAASA.',
          '..ABBBBBBBBCCASA.',
          '..ABBBBBBBBBCASA.',
          '..ABEEEBBEEECASA.',
          '..ABEREBBERECASA.',
          '..ABEEEBBEEEDASA.',
          '..ABBBBEEBBBCASA.',
          '...ABBBBBBBCAASA.',
          '...ABABABABCAASA.',
          '....ABBBBBCA.ASA.',
          '.....AAAAAA.AASAA',
          '......ABCA..AGGGA',
          '..AAAAABCAAAABBCA',
          '.ABBBBBBBBBBACCDA',
          '.AEEEEEBCEEEEAGA.',
          '.ABBBBBBCBBBBCA..',
          '.ABEEEEBCEEEEBA..',
          '.ABBBBBBCBBBBCA..',
          '.ABEEEEBCEEEEBA..',
        ],
        { A, B: '#f3eee0', C: '#cfc5aa', D: '#9a8f76', E: '#1d1826', R: '#ff5a3c', S: '#dfe6f0', G: '#c99a3e' },
      ),
  },

  'br:coffre': {
    fond: ['#3fbac4', '#135a73', '#061a28'],
    decor: () => GRILLE + ETOILES(CIEL),
    corps: () =>
      pixels(
        [
          '....AAAAAAAAAA....',
          '..AAWWWWGHWWVVAA..',
          '.AWWWWWWGHWWWWVVA.',
          'AGWWWWWWGHWWWWWVHA',
          'AGWWWWWWGHWWWWWVHA',
          'AGWBBBWWGHWWBBBVHA',
          'AGWKKBWWGHWWKKBVHA',
          'AGVVVVVVGHVVVVVUHA',
          'AYGGGGGGGGGGGGGGHA',
          '.ATTETTETTETTETTA.',
          '.AETEETEEEETEETEA.',
          '.AYGETERSRRETEYGA.',
          '.AGHTTERSRRETTGHA.',
          'AYGGGGARSRRAGGGGHA',
          'AGWWWWARRRRAWWWVHA',
          'AGWWWWWARRAWWWWVHA',
          'AGWWWWWWAAWWWWWVHA',
          'AGUUUUUUGHUUUUUUHA',
          'AGWWWWWWGHWWWWWVHA',
          'AGWWWWWWGHWWWWWVHA',
        ],
        {
          A,
          W: '#c98a4b',
          V: '#9c5f2e',
          U: '#6b3a1a',
          G: '#f2c14e',
          H: '#b8862a',
          Y: '#fff0a0',
          B: '#ffffff',
          K: '#0d1118',
          E: '#2a0e16',
          T: '#fff7e6',
          R: '#e0506e',
          S: '#ff8fa8',
        },
        3.5,
        27.5,
      ),
  },

  'br:archere': {
    fond: ['#48bccf', '#175c7e', '#07192d'],
    decor: () => GRILLE + ETOILES(CIEL),
    corps: () =>
      pixels(
        [
          '.........AA.........',
          '........ALGA........',
          '.......ALGGDA....AA.',
          '..AA..ALGGGGDA..AFBA',
          '.AWI.ALGGGGGGDA.AFBA',
          'AW.IALGGNNNNGGDAAVA.',
          'AW.IALGNRRRQNGDAAVA.',
          'AW.IALNRRSSRQNDAAVA.',
          'AW.IALNBKSSBKNDAAUUA',
          'AW.IALNKKSSKKNDAAUUA',
          'ASSIALNPSSSSPNDAAUUA',
          'ASSIALNSSMMSSNDAAUUA',
          'AW.IALGNTSSTNGDAAUUA',
          'AW.IALGGGYYGGGDAAAAA',
          'AW.ILGGGGGGGGGUGDA..',
          'AW.ILGGGGGGGGUGGGDA.',
          'AWGILGGGGGGGUGGGGGDA',
          'AAWILGGGGGGUGGGGGGDA',
          'ALAALGGGGGUGGGGGGGDA',
          'ALGGGGGGGUGGGGGGGGDA',
          'ALGGGGGGUGGGGGGGGGDA',
          'ALGGGGGUGGGGGGGGGGDA',
          'ALGGGGUGGGGGGGGGGGDA',
        ],
        {
          A,
          L: '#7ccc5c',
          G: '#3f9a47',
          D: '#276a34',
          N: '#163b24',
          S: '#e8b48a',
          T: '#c98d62',
          P: '#ff8f8f',
          R: '#b4462a',
          Q: '#7a2a18',
          K: '#1a1014',
          M: '#b0404a',
          W: '#d49a5a',
          I: '#f4efe0',
          F: '#e0433a',
          B: '#ffffff',
          V: '#8a5528',
          U: '#6e3b1a',
          Y: '#f2c14e',
        },
      ),
  },

  'br:mage': {
    fond: ['#52b6d6', '#1a5580', '#08172e'],
    decor: () => GRILLE + ETOILES(CIEL),
    corps: () =>
      pixels(
        [
          '.......AA..........',
          '......ALDA.....AAA.',
          '......ALHDA...AOCCA',
          '.....ALHHYDA..ACCCA',
          '.....ALHHHHDA.ACCQA',
          '....ALYHHHHHDA.AAA.',
          '...ABBBBBBBBBBAAFA.',
          '.AALHHHHHHHHHHDAFA.',
          'ALHHHHHHHHHHHHDAFA.',
          '.AAWWWWWWWWWVVVAFA.',
          '..AWWSOKSSOKSVVAFA.',
          '..AWWSKKSSKKSVVAFA.',
          '..AWWPSSSSSSPVVAFA.',
          '..AWWSSSMMSSSVVAFA.',
          '..AWWVTSSSSTVVVAFA.',
          '.AWWWVHBBBBHVVUAFA.',
          'AWWWVLHYYHHHVVASSTA',
          'AWWVLHHHHHHHVUATTTA',
          'AWVLHHHHHHHHHVUAFA.',
          'AVLHHHHHHHHHHHDAFAD',
          'ALHHHHHHHHHHHHDAFAD',
          'ALHHHHHHHHHHHHDAFAD',
          'ALHHHHHHHHHHHDDAFAD',
          'ALHHHHHHHHHHHDDAFAD',
        ],
        {
          A,
          L: '#7d70f0',
          H: '#4b3cc9',
          D: '#2e2485',
          B: '#f2c14e',
          Y: '#ffe36b',
          W: '#f3eefc',
          V: '#c9bde8',
          U: '#9a8cc4',
          S: '#9c6442',
          T: '#7a4a2e',
          P: '#d4777a',
          K: '#140c10',
          M: '#f08a96',
          O: '#ffffff',
          F: '#8a5528',
          C: '#ffe36b',
          Q: '#f0a030',
        },
        3.5,
        13.5,
      ),
  },

  'br:chevalier': {
    fond: ['#45b9cc', '#16597a', '#07192b'],
    decor: () => GRILLE + ETOILES(CIEL),
    corps: () =>
      pixels(
        [
          '.......FG.......',
          '......FFGG......',
          '......FFFG......',
          '.....AAAAAA.....',
          '....ABBBBCCA....',
          '...ABBBBCCCDA...',
          '...ABBBCCCCDA...',
          '..ABBBCCCCCDDA..',
          '..AEEYEEEEYEEA..',
          '..ABCCCCCCCDDA..',
          '..ABCECCCCECDA..',
          '..ABCCCCCCCCDA..',
          '..ABCECCCCECDA..',
          '...ABCCCCCCDA...',
          '..AHHHHHHHHHHA..',
          '.AHHHHHHHHHHHHA.',
          'AJJJJJJJJJJJJJJA',
          'AJJJJKKKKKKJJJJA',
          'AJJJJKKKKKKJJJJA',
          'AJJJJJJJJJJJJJJA',
          'AJJJJJJJJJJJJJJA',
          'AJJJJJJJJJJJJJJA',
          'AJJJJJJJJJJJJJJA',
        ],
        { A, B: '#e3e8f1', C: '#a3aec0', D: '#6b778a', E: '#0d1118', F: '#e0433a', G: '#ff7a5c', H: '#f2c14e', J: '#3b6fd8', K: '#f2c14e', Y: '#ffe36b' },
      ),
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { arcade: DESSINS } })
