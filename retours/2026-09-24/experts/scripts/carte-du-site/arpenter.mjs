// L'arpenteur de la carte : visite chaque adresse dans chaque rôle et relève,
// pour chacune, l'adresse finale, le titre de l'onglet, les titres, les liens
// (texte → cible) et les boutons. Rejouer :
//   node arpenter.mjs <base> <fichier-sortie.json> [etiquette-du-moment] [id-archive]
// Rôles : anonyme, animatrice (elodie), administrateur (antoine), joueuse à profil.
import { createRequire } from 'node:module'
import fs from 'node:fs'
const require = createRequire('/opt/node22/lib/node_modules/x.js')
const { chromium } = require('playwright')
const [base, sortie, moment = 'sans-soiree', archive = ''] = process.argv.slice(2)
const E = 'chez-elodie'
const ADRESSES = [
  '/', '/profil', '/host', '/edit', '/connexion', '/connexion?next=/admin', '/activer', '/compte', '/admin',
  `/${E}`, `/${E}/souvenir`, `/${E}/stats`, `/${E}/bilan`, `/${E}/bilan/fiches`, `/${E}/soirees`,
  ...(archive ? [`/${E}/soirees/${archive}`, `/${E}/soirees/${archive}/bilan`] : []),
  `/${E}/soirees/inexistante`, '/espace-qui-nexiste-pas', '/espace-qui-nexiste-pas/souvenir',
  `/${E}/nimporte`, '/souvenir', '/soirees', '/host/plus',
]
const LISTE = process.env.ADRESSES ? process.env.ADRESSES.split(',') : ADRESSES
const ROLES_VOULUS = process.env.ROLES ? process.env.ROLES.split(',') : null
const ROLES = {
  anonyme: async () => {},
  animatrice: async r => r.post(base + '/api/auth/login', { headers: { Origin: base, 'x-requested-with': 'quizz' }, data: { login: 'elodie', password: 'elodie-secret1' } }),
  admin: async r => r.post(base + '/api/auth/login', { headers: { Origin: base, 'x-requested-with': 'quizz' }, data: { login: 'antoine', password: 'tablee-admin' } }),
  joueuse: async r => {
    const c = await r.post(base + '/api/joueur/connexion', { headers: { Origin: base, 'x-requested-with': 'quizz' }, data: { login: 'margaux', password: 'margaux-secret1' } })
    if (!c.ok()) return r.post(base + '/api/joueur/inscription', { headers: { Origin: base, 'x-requested-with': 'quizz' }, data: { login: 'margaux', password: 'margaux-secret1', name: 'Margaux', avatar: '🦊' } })
  },
}
const navigateur = await chromium.launch()
const releve = {}
for (const [role, entrer] of Object.entries(ROLES).filter(([r]) => !ROLES_VOULUS || ROLES_VOULUS.includes(r))) {
  const ctx = await navigateur.newContext({ viewport: { width: 360, height: 640 } })
  const r = await entrer(ctx.request)
  if (r && !r.ok()) console.error(role, 'connexion refusée', r.status(), await r.text())
  releve[role] = {}
  for (const a of LISTE) {
    const page = await ctx.newPage()
    const statuts = []
    page.on('response', rep => { if (rep.url().startsWith(base) && rep.status() >= 300) statuts.push(`${rep.status()} ${rep.url().slice(base.length)}`) })
    await page.goto(base + a, { waitUntil: 'load', timeout: 15000 }).catch(e => statuts.push('ERR ' + e.message))
    await page.waitForTimeout(1500)
    const vu = await page.evaluate(() => {
      const vis = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
      return {
        titres: [...document.querySelectorAll('h1,h2')].filter(vis).map(h => h.innerText.trim()).slice(0, 8),
        liens: [...document.querySelectorAll('a[href]')].filter(vis).map(l => `${l.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)} → ${l.getAttribute('href')}${l.target ? ' [' + l.target + ']' : ''}`),
        boutons: [...document.querySelectorAll('button')].filter(vis).map(b => b.innerText.trim().replace(/\s+/g, ' ').slice(0, 40)).filter(Boolean),
        texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
      }
    })
    releve[role][a] = { final: page.url().slice(base.length), onglet: await page.title(), statuts, ...vu }
    await page.close()
  }
  await ctx.close()
}
await navigateur.close()
fs.writeFileSync(sortie, JSON.stringify({ moment, releve }, null, 1))
console.log('relevé :', sortie)
