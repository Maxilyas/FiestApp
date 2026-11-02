// La pierre du niveau : dès le 30, la pastille de niveau et la gemme de la
// carte prennent celle de leur dizaine — saphir, améthyste, ambre au 50.
//
// Au-delà du 25, plus aucune finition ne s'ouvrait : les plus assidus de la
// production, bientôt au niveau 30, n'avaient plus rien qui dise leur avance
// (le souhait du propriétaire du 1er novembre 2026). Une convention, comme le
// rouge des messages : aucun thème ne la repeint, et son chiffre se lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import React from 'react'
import { PIERRES_DU_NIVEAU, pierreDuNiveau, pierreGagnee } from '../../shared/pierres'
import { NIVEAU_FINITION } from '../../shared/profil'
import { contraste } from './teintes'

Object.assign(globalThis, { React })

const client = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const CSS = client('styles.css')

async function pastille(niveau: number | undefined, big = false): Promise<string> {
  const { Niveau } = await import(new URL('../../client/src/components/Niveau.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(Niveau, { niveau, big }))
}

test('la pierre de sa dizaine, dès le 30 — rien avant, et rien pour qui n’a pas de niveau', () => {
  assert.equal(pierreDuNiveau(undefined), null, 'un anonyme n’a pas de niveau : l’absence, pas l’infériorité')
  assert.equal(pierreDuNiveau(0), null)
  assert.equal(pierreDuNiveau(25), null)
  assert.equal(pierreDuNiveau(29), null)
  assert.equal(pierreDuNiveau(30), 'saphir')
  assert.equal(pierreDuNiveau(39), 'saphir')
  assert.equal(pierreDuNiveau(40), 'amethyste')
  assert.equal(pierreDuNiveau(50), 'ambre')
  assert.equal(pierreDuNiveau(120), 'ambre', 'l’ambre est la dernière')
  // Chaque pierre arrive avec la finition de sa dizaine — les Abysses au 30, l'Envol au 40, la Singularité au 50 :
  // le niveau qui change la pastille change aussi l'avatar.
  for (const { niveau } of PIERRES_DU_NIVEAU) assert.ok(Object.values(NIVEAU_FINITION).includes(niveau), `une finition s'ouvre au ${niveau}`)
  // Une montée qui passe une dizaine l'annonce, une fois.
  assert.equal(pierreGagnee(29, 30), 'saphir')
  assert.equal(pierreGagnee(30, 31), null)
  assert.equal(pierreGagnee(38, 41), 'amethyste')
  assert.equal(pierreGagnee(28, 52), 'ambre', 'la plus haute passée')
})

test('la pastille la porte, partout où le niveau se montre — l’écran commun compris', async () => {
  assert.equal(await pastille(undefined), '', 'pas de pastille sans niveau')
  assert.doesNotMatch(await pastille(29), /pierre/)
  assert.match(await pastille(31), /^<span class="niveau pierre pierre-saphir" title="Niveau 31">/)
  assert.match(await pastille(44, true), /^<span class="niveau big pierre pierre-amethyste" title="Niveau 44">/)
  assert.match(await pastille(50), /class="niveau pierre pierre-ambre"/)
  // La carte la sertit dans le métal de son cadre.
  assert.match(client('components/CarteJoueur.tsx'), /const pierre = pierreDuNiveau\(p\?\.niveau\)/)
  assert.match(client('components/CarteJoueur.tsx'), /'carte-gemme' \+ \(pierre \? ` carte-gemme-pierre carte-gemme-\$\{pierre\}` : ''\)/)
  // La fin d'une partie qui la fait passer le dit, la pastille montrée.
  assert.match(client('components/Gains.tsx'), /const pierre = monte \? pierreGagnee\(n\.avant, n\.niveau\) : null/)
})

test('son chiffre se lit sur chaque teinte de sa pierre, et aucun thème ne la repeint', () => {
  const regle = (selecteur: string) => {
    const debut = CSS.indexOf(`\n${selecteur} {`)
    assert.ok(debut >= 0, `la règle ${selecteur}`)
    return CSS.slice(debut, CSS.indexOf('}', debut))
  }
  for (const { pierre } of PIERRES_DU_NIVEAU) {
    const corps = regle(`.pierre-${pierre},\n.carte-gemme-${pierre}`)
    const jeton = (nom: string) => new RegExp(`--pierre-${nom}: (#[0-9a-f]{6});`).exec(corps)?.[1]
    const encre = jeton('encre')
    assert.ok(encre, `${pierre} : son encre est écrite en dur`)
    for (const nom of ['haut', 'coeur', 'bas']) {
      const fond = jeton(nom)
      assert.ok(fond, `${pierre} : --pierre-${nom}`)
      const c = contraste(encre!, fond!)
      assert.ok(c >= 4.5, `${pierre} : le chiffre sur --pierre-${nom} tient ${c.toFixed(2)}:1`)
    }
  }
  // Plus forte que les `:root[data-theme='…'] .niveau` des thèmes (0,3,0) : `body` la fait passer devant.
  const pastille = regle(':root body .niveau.pierre')
  for (const propriete of ['border', 'background', 'color']) assert.match(pastille, new RegExp(`(?:^|\\s)${propriete}: [^;]*var\\(--pierre-`), propriete)
  assert.match(regle('.carte-gemme.carte-gemme-pierre'), /var\(--cadre\) border-box/, 'sertie dans le métal du cadre')
  const dossier = new URL('../../client/src/themes/', import.meta.url)
  for (const f of readdirSync(dossier).filter(f => f.endsWith('.css'))) assert.doesNotMatch(readFileSync(new URL(f, dossier), 'utf8'), /pierre-|carte-gemme/, f)
})
