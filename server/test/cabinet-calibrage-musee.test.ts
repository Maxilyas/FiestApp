// Le modèle du calibrage du Cabinet (`scripts/calibrage-cabinet.ts`) et son
// musée : le chasseur qui éveille son gardien avant l'occasionnel (la tablée
// du 25 octobre 2026), et le musée qui se remplit jour après jour. Coupé de
// `cabinet-calibrage-parties.test.ts` le 18 novembre 2026, sans rien changer à
// ses épreuves : 25 s seul, ce fichier a passé les deux minutes d'un fichier
// sur une machine lente de la CI (règle `tests.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireNombre } from '../../shared/nombres'
import { calibrer } from './calibrage-du-cabinet'

test('le chasseur chasse dans la salle du prochain gardien, et l’éveille plus tôt que l’occasionnel', async () => {
  // L'occasionnel attendait son premier gardien au 36ᵉ jour au calibrage du 25 octobre 2026 : la visite remplissait
  // les neuf salles à la fois. Une de ses cases vise chaque jour la salle du prochain gardien depuis le 26 (au 21ᵉ jour,
  // sur quatre parcours d'un an) ; le même joueur, aux mêmes jours, qui y chasse aussi, l'éveille plus tôt encore.
  // Ses cartes-bonus se choisissent sur cent parties, la mesure d'office : sur trente, le hasard de ces choix couvrait
  // l'écart des deux, que la case de la visite vers le prochain gardien a resserré (le chasseur au 21,5ᵉ jour,
  // l'occasionnel au 21ᵉ ; sur cent, au 15ᵉ et au 21ᵉ).
  const { code, sortie, erreurs } = await calibrer(['--sections', 'musee', '--joueurs', 'occasionnel,chasseur', '--parcours', '2', '--jours', '80'])
  assert.equal(code, 0, erreurs)
  const premier = (joueur: string) => {
    const bloc = sortie.slice(sortie.indexOf(`\n  ${joueur}\n`))
    const m = /le premier gardien réveillé en jouant : (\S+) j/.exec(bloc)
    assert.ok(m, `${joueur} :\n${sortie}`)
    return lireNombre(m[1])!
  }
  assert.ok(premier('chasseur') < premier('occasionnel'), `le premier gardien : au ${premier('chasseur')}ᵉ jour au chasseur, au ${premier('occasionnel')}ᵉ à l'occasionnel`)
})

test('le musée se remplit jour après jour, par les règles du musée', async () => {
  // Un joueur moyen qui arrive neuf et joue chaque jour : tout est à lui en moins d'un mois. Jusqu'au 25 octobre 2026,
  // l'épreuve faisait arriver un explorateur avec soixante œuvres de l'Expédition : la migration s'est abandonnée
  // (la décision du propriétaire, chacun commence à zéro), et chacun arrive neuf.
  const { code, sortie, erreurs } = await calibrer(['--parties', '100', '--mesures', '20', '--parcours', '1', '--jours', '30', '--joueurs', 'moyen'])
  assert.equal(code, 0, erreurs)
  assert.match(sortie, /chacun arrive neuf : les 4 œuvres de départ, rien de l'Expédition/)
  assert.doesNotMatch(sortie, /rapportées/)
  const jours = /tout posséder : (\d+) j/.exec(sortie)
  assert.ok(jours && lireNombre(jours[1])! <= 30, `tout posséder :\n${sortie}`)
  assert.match(sortie, /par jour joué : \d+ parties/)
  assert.match(sortie, /gardiens réveillés, semaine/)
})
