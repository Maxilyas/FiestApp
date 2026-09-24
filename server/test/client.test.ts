// Ce que le téléphone dit quand un appel échoue : la logique pure de
// `shared/erreurs.ts`, sans navigateur ni serveur.
//
// C'est le seul canal d'erreur des invités, lu dans le noir : il ne doit
// jamais parler anglais, ni dire « Connexion requise » à quelqu'un qui a
// seulement mal tapé son mot de passe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOTIFS, echecPassager, motifEchec, motifHttp, statutPassager } from '../../shared/erreurs'

test('un mot de passe faux se dit tel que le serveur le dit, pas « Connexion requise »', () => {
  assert.equal(
    motifHttp(401, { error: 'Identifiant ou mot de passe incorrect' }),
    'Identifiant ou mot de passe incorrect',
  )
  // Une session expirée garde son motif à elle.
  assert.equal(motifHttp(401, { error: 'Connexion requise' }), 'Connexion requise')
  // Sans corps lisible, un 401 dit encore quoi faire.
  assert.match(motifHttp(401, undefined), /reconnecte-toi/)
})

test('les refus du serveur passent tels quels, suggestion comprise ailleurs', () => {
  assert.equal(motifHttp(400, { error: 'Il faut un titre' }), 'Il faut un titre')
  assert.equal(
    motifHttp(429, { error: 'Trop d’essais — réessaie dans un quart d’heure' }),
    'Trop d’essais — réessaie dans un quart d’heure',
  )
  assert.equal(motifHttp(400, { error: '  « camille » est déjà pris  ', suggestion: 'camille2' }), '« camille » est déjà pris')
})

test('pendant un déploiement, on dit d’attendre — pas « Bad Gateway »', () => {
  for (const statut of [502, 503, 504]) {
    assert.equal(motifHttp(statut, undefined), MOTIFS.redemarrage, `statut ${statut}`)
    // L'hébergeur répond parfois en JSON, en anglais : ça ne passe pas non plus.
    assert.equal(motifHttp(statut, { error: 'Service Unavailable' }), MOTIFS.redemarrage)
  }
})

test('une panne du serveur ne montre jamais son message technique', () => {
  assert.equal(motifHttp(500, { error: 'SQLITE_BUSY: database is locked' }), MOTIFS.panne)
  assert.equal(motifHttp(500, undefined), MOTIFS.panne)
})

test('un corps sans message garde un motif qui dit quoi faire', () => {
  for (const corps of [undefined, null, 'Not Found', { error: '   ' }, { error: 42 }, [], {}]) {
    const motif = motifHttp(404, corps)
    assert.match(motif, /404/, JSON.stringify(corps))
    assert.match(motif, /réessaie/)
  }
  assert.match(motifHttp(429, {}), /patiente/)
})

test('le réseau coupé ne parle pas anglais, quel que soit le navigateur', () => {
  // Chrome, Safari, Firefox — et un navigateur qui rejetterait sans texte.
  for (const texte of ['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', '']) {
    assert.equal(motifEchec(new TypeError(texte)), MOTIFS.reseau, texte)
  }
  assert.equal(motifEchec(undefined), MOTIFS.reseau)
  assert.equal(motifEchec('perdu'), MOTIFS.reseau)
})

test('un délai dépassé dit que le serveur ne répond pas', () => {
  assert.equal(motifEchec(new DOMException('The operation was aborted.', 'AbortError')), MOTIFS.silence)
  assert.equal(motifEchec(new DOMException('Signal timed out.', 'TimeoutError')), MOTIFS.silence)
  // Un DOMException n'hérite pas d'Error dans tous les navigateurs : seul
  // son nom compte.
  assert.equal(motifEchec({ name: 'AbortError', message: 'aborted' }), MOTIFS.silence)
})

test('un réveil se reconnaît — délai dépassé, 502, 503, 504 — et rien d’autre ne se rejoue', () => {
  for (const statut of [502, 503, 504]) assert.equal(statutPassager(statut), true, `statut ${statut}`)
  for (const statut of [400, 401, 404, 409, 429, 500]) assert.equal(statutPassager(statut), false, `statut ${statut}`)
  assert.equal(echecPassager(new DOMException('The operation was aborted.', 'AbortError')), true)
  assert.equal(echecPassager({ name: 'TimeoutError', message: 'timed out' }), true)
  // Le réseau coupé n'est pas un réveil : l'attendre deux minutes en silence
  // cacherait un wifi tombé, qu'on peut rétablir tout de suite.
  assert.equal(echecPassager(new TypeError('Failed to fetch')), false)
  assert.equal(echecPassager(new SyntaxError('Unexpected token < in JSON at position 0')), false)
  assert.equal(echecPassager(undefined), false)
})

test('une réponse qui n’est pas du JSON (portail wifi) se dit illisible', () => {
  assert.equal(motifEchec(new SyntaxError('Unexpected token < in JSON at position 0')), MOTIFS.illisible)
})

test('chaque phrase toute faite est courte, en français, et dit quoi faire', () => {
  for (const [cle, motif] of Object.entries(MOTIFS)) {
    assert.ok(motif.length <= 70, `${cle} : trop long pour un toast (${motif.length})`)
    assert.match(motif, / — .*(réessaie|patiente|recharge|vérifie)/, `${cle} : il manque le geste à faire`)
    assert.doesNotMatch(motif, /fetch|failed|error|network/i, `${cle} : de l'anglais`)
  }
})
