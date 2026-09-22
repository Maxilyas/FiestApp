// Les garde-fous de sécurité. D'abord : où l'on revient après la connexion.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { pageDeRetour } from '../../shared/securite'

// ── La page de retour après connexion ───────────────────────────────────

describe('la page de retour après connexion', () => {
  const ORIGINE = 'https://quiz.example'
  /** `next` tel que la page le lit : décodé par le navigateur depuis la barre d'adresse. */
  const retour = (search: string) => pageDeRetour(new URLSearchParams(search).get('next'), ORIGINE)

  test('une page d’ici est suivie, avec sa requête et son ancre', () => {
    assert.equal(retour('?next=/compte'), '/compte')
    assert.equal(retour('?next=/admin'), '/admin')
    assert.equal(retour('?next=%2Fcompte%3Fonglet%3Dprofil%23mdp'), '/compte?onglet=profil#mdp')
    assert.equal(retour('?next=https://quiz.example/compte'), '/compte', 'une adresse complète, mais d’ici')
  })

  test('toute adresse qui mène ailleurs ramène à l’écran commun', () => {
    for (const piege of [
      // Les deux premières passaient l'ancien test (« commence par une barre,
      // pas par deux ») : le navigateur lit la contre-oblique comme une barre,
      // et efface la tabulation et le saut de ligne avant de résoudre.
      '?next=/\\evil.example',
      '?next=/%5Cevil.example',
      '?next=/%09/evil.example',
      '?next=/%0A/evil.example',
      '?next=/%0D/evil.example',
      '?next=//evil.example',
      '?next=%20//evil.example',
      '?next=\\\\evil.example',
      '?next=https://evil.example',
      '?next=https://quiz.example.evil.example/compte',
      '?next=javascript:alert(1)',
      '?next=JaVaScRiPt:alert(1)',
      '?next=data:text/html,<script>alert(1)</script>',
      '?next=',
      '',
    ]) {
      assert.equal(retour(piege), '/host', `${JSON.stringify(piege)} ne doit mener nulle part ailleurs`)
    }
  })

  test('un caractère de contrôle suffit à refuser, même sans quitter le site', () => {
    // Le navigateur l'effacerait sans rien dire : un lien honnête n'en porte pas.
    assert.equal(retour('?next=/com%09pte'), '/host')
    assert.equal(retour('?next=/compte%00'), '/host')
  })
})
