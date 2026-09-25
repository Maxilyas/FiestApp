// Maquettes des propositions, aux couleurs de l'application : rendues depuis
// l'origine du serveur, pour ses polices. Rien de ceci n'existe dans le code.
import { chromium, nouveauContexte, connecter, BASE, CAP, PORTABLE, TELEPHONE } from './outils.mjs'

const CSS = `
:root{--bg:#1a1412;--bg-halo:#2b211b;--bg-raised:#241c18;--ink:#f3ece2;--muted:#a89b8a;--accent:#d9b56a;--accent-rgb:217,181,106;
--surface:rgba(255,255,255,.035);--surface-strong:rgba(255,255,255,.06);--accent-soft:rgba(217,181,106,.12);--edge:rgba(217,181,106,.22);--edge-strong:rgba(217,181,106,.55);
--serif:'Cormorant Garamond',Georgia,serif;--sans:Figtree,'Segoe UI',system-ui,sans-serif}
@font-face{font-family:'Cormorant Garamond';font-weight:600;src:url('/fonts/cormorant-garamond-600.woff2') format('woff2')}
@font-face{font-family:'Figtree';font-weight:300 900;src:url('/fonts/figtree-variable.woff2') format('woff2')}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);font-size:16px;line-height:1.4;color:var(--ink);background:var(--bg);background-image:radial-gradient(120% 60% at 50% -10%,var(--bg-halo) 0%,var(--bg) 60%);background-size:100% 100vh;background-repeat:no-repeat}
h1,h2,h3{font-family:var(--serif);font-weight:600;margin:0}
.page{max-width:900px;margin:0 auto;padding:18px 24px}
.nav{display:flex;align-items:center;justify-content:space-between;font-size:.9rem;color:var(--muted);padding-bottom:10px;border-bottom:1px solid var(--edge)}
.nav a{color:var(--muted);text-decoration:none;margin-left:18px}
.nav .brand{font-family:var(--serif);color:var(--accent);font-size:1.25rem}
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.between{justify-content:space-between}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(var(--accent-rgb),.26);background:transparent;color:var(--ink);font:500 .92rem var(--sans)}
.btn-primary{background:var(--accent);color:#1a1412;border-color:var(--accent);font-weight:600}
.btn-small{min-height:32px;padding:0 12px;font-size:.82rem}
.btn-ghost{color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--edge);border-radius:16px;padding:16px}
.muted{color:var(--muted)}.small{font-size:.82rem}
.warn{color:var(--accent);font-weight:500}
.chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--edge);border-radius:999px;padding:5px 12px;font-size:.82rem;color:var(--muted)}
.chip.on{background:var(--accent-soft);border-color:var(--edge-strong);color:var(--accent)}
.input{background:rgba(0,0,0,.25);border:1px solid var(--edge);border-radius:12px;color:var(--ink);padding:10px 14px;font:inherit}
.label{letter-spacing:.18em;text-transform:uppercase;font-size:.7rem;color:var(--muted)}
.prog{border-color:var(--edge-strong);background:linear-gradient(180deg,rgba(217,181,106,.08),rgba(217,181,106,.02))}
.prog ol{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px}
.prog li{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:12px;background:rgba(0,0,0,.18)}
.num{font-family:var(--serif);color:var(--accent);font-size:1.3rem;width:22px;text-align:center}
.x2{color:#1a1412;background:var(--accent);border-radius:999px;padding:1px 8px;font-size:.75rem;font-weight:700}
.list{display:grid;gap:0;border:1px solid var(--edge);border-radius:16px;overflow:hidden}
.item{display:grid;grid-template-columns:40px 1fr 170px auto;align-items:center;gap:14px;padding:10px 14px;border-top:1px solid rgba(217,181,106,.12)}
.item:first-child{border-top:0}
.cover{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;font-size:1.3rem;background:var(--surface-strong)}
.item h3{font-size:1.18rem;line-height:1.15}
.dots{width:34px;height:34px;border-radius:999px;border:1px solid var(--edge);display:grid;place-items:center;color:var(--muted);font-weight:700;letter-spacing:1px}
.note{position:fixed;right:12px;bottom:10px;font:600 .72rem var(--sans);letter-spacing:.14em;text-transform:uppercase;color:#1a1412;background:var(--accent);padding:4px 10px;border-radius:999px;opacity:.92}
.menu{position:absolute;right:24px;top:118px;width:300px;background:var(--bg-raised);border:1px solid var(--edge-strong);border-radius:14px;padding:6px;box-shadow:0 18px 40px rgba(0,0,0,.5);z-index:3}
.menu div{padding:9px 12px;border-radius:10px}
.menu div:hover,.menu .hl{background:var(--accent-soft)}
.menu b{display:block;font-weight:600}
`

const maquette = (corps, classe = '') => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${CSS}</style></head><body class="${classe}">${corps}<span class="note">Maquette — proposition</span></body></html>`

const LIGNES = [
  ['🎆', 'Nouvel an 2026 — manche 2', '15 questions · 2 estimations · ≈ 8 min', 'Au programme', true, ''],
  ['🎬', 'Cinéma culte', '30 questions · 6 photos · ≈ 16 min', 'Joué le 14 mars', false, ''],
  ['🎂', 'Qui connaît le mieux Julie ?', '8 questions · ≈ 4 min', 'Jamais joué', false, '8 réponses ✏️ à remplacer'],
  ['📼', 'Soirée années 90', '15 questions · 2 photos · 3 estimations · ≈ 9 min', 'Jamais joué', false, '1 à compléter'],
  ['🌍', 'Géo — capitales du monde', '40 questions · ≈ 20 min', 'Joué 3 fois · le 2 mai', false, ''],
  ['🎄', 'Noël 2025 — en famille', '30 questions · 4 photos · ≈ 17 min', 'Joué le 25 déc.', false, ''],
  ['⚽', 'Sport — Coupe du monde', '15 questions · ≈ 8 min', 'Joué le 14 mars', false, ''],
]

const bibliotheque = maquette(`
<div class="page">
  <div class="nav"><span class="brand">La soirée d’Antoine</span><span><a>Écran commun</a><a>Historique</a><a>Mon compte</a><a>Les comptes</a></span></div>
  <div class="row between" style="margin:16px 0 12px"><h1 style="font-size:2.1rem">Mes quiz</h1>
    <button class="btn btn-primary">＋ Nouveau quiz ▾</button></div>
  <div class="menu">
    <div class="hl"><b>Quiz vide</b><span class="muted small">Écrire les questions une à une</span></div>
    <div><b>Coller une liste</b><span class="muted small">Tes notes, ou la réponse d’une IA</span></div>
    <div><b>Partir d’un modèle</b><span class="muted small">12 modèles, dont 6 à personnaliser</span></div>
    <div><b>Recevoir un quiz</b><span class="muted small">Un code d’ami, ou un fichier .quiz.json</span></div>
  </div>
  <div class="card prog">
    <div class="row between"><div><span class="label">Programme de ce soir</span><h2 style="font-size:1.35rem;margin-top:2px">Nouvel an 2026</h2></div>
      <span class="muted small">3 quiz · 40 questions · ≈ 24 min</span></div>
    <ol>
      <li><span class="num">1</span><span style="flex:1">Nouvel an 2026 — manche 1 <span class="muted small">· 15 q.</span></span><span class="muted small">joué ce soir ✓</span></li>
      <li><span class="num">2</span><span style="flex:1">Nouvel an 2026 — manche 2 <span class="muted small">· 15 q.</span></span><span class="muted small">prochain</span></li>
      <li><span class="num">3</span><span style="flex:1">Nouvel an 2026 — la finale <span class="muted small">· 10 q.</span> <span class="x2">×2</span></span><span class="muted small"></span></li>
    </ol>
  </div>
  <div class="row" style="margin:14px 0 10px">
    <input class="input" style="flex:1;min-width:260px" value="" placeholder="🔎 Chercher un quiz, ou une question…">
    <span class="chip">Récents ▾</span>
  </div>
  <div class="row" style="margin-bottom:12px">
    <span class="chip on">Tous · 38</span><span class="chip">À compléter · 3</span><span class="chip">Jamais joués · 21</span><span class="chip">Avec photos · 6</span><span class="chip">Cinéma &amp; séries · 4</span><span class="chip">Archivés · 12</span>
  </div>
  <div class="list">
    ${LIGNES.map(([e, t, m, j, prog, alerte]) => `
    <div class="item"><span class="cover">${e}</span>
      <div><h3>${t}</h3><span class="muted small">${m}</span>${alerte ? ` <span class="warn small">· ⚠ ${alerte}</span>` : ''}</div>
      <span class="muted small">${j}</span>
      <span class="row" style="gap:8px">${prog ? '<span class="chip on">✓ Au programme</span>' : '<button class="btn btn-small btn-ghost">＋ Programme</button>'}<span class="dots">⋯</span></span>
    </div>`).join('')}
  </div>
</div>`)

const bibliothequeTel = maquette(`
<div class="page" style="padding:12px 16px">
  <div class="row between"><h1 style="font-size:1.9rem">Mes quiz</h1><button class="btn btn-primary">＋ Nouveau ▾</button></div>
  <div class="card prog" style="margin-top:12px;padding:12px">
    <span class="label">Programme de ce soir</span>
    <div style="margin-top:4px"><b>Nouvel an 2026</b> <span class="muted small">· 3 quiz · ≈ 24 min</span></div>
    <div class="muted small" style="margin-top:4px">Prochain : manche 2 — puis la finale <span class="x2">×2</span></div>
  </div>
  <input class="input" style="width:100%;margin:12px 0 8px" placeholder="🔎 Chercher un quiz, une question…">
  <div class="row" style="gap:6px;margin-bottom:10px"><span class="chip on">Tous · 38</span><span class="chip">À compléter · 3</span><span class="chip">Jamais joués</span></div>
  <div class="list">
    ${LIGNES.slice(0, 6).map(([e, t, m, j, prog, alerte]) => `
    <div class="item" style="grid-template-columns:36px 1fr auto;gap:10px;padding:9px 10px"><span class="cover" style="width:36px;height:36px">${e}</span>
      <div><h3 style="font-size:1.05rem">${t}</h3><span class="muted small">${m.split(' · ').slice(0, 2).join(' · ')}</span>${alerte ? `<br><span class="warn small">⚠ ${alerte}</span>` : `<br><span class="muted small">${j}</span>`}</div>
      <span class="dots">⋯</span>
    </div>`).join('')}
  </div>
</div>`)

const consoleProgramme = maquette(`
<div style="display:grid;grid-template-columns:290px 1fr 340px;gap:18px;padding:18px 44px;height:100vh">
  <div class="card"><h2 style="font-size:1.5rem">Invités (23)</h2><p class="muted small">…</p></div>
  <div class="card" style="display:flex;flex-direction:column;gap:14px;padding:26px">
    <span class="label">Prochain quiz · 2 sur 3</span>
    <h1 style="font-size:2.6rem;line-height:1.05">Nouvel an 2026 — manche 2</h1>
    <p class="muted" style="margin:0">15 questions · Cinéma &amp; séries, Musique · 2 estimations · ≈ 8 min</p>
    <div class="row"><span class="muted">Ce quiz vaut</span><span class="chip on">points normaux</span><span class="chip">×2 points</span><span class="chip">×3 points</span></div>
    <div class="row" style="margin-top:6px"><button class="btn btn-primary" style="min-height:56px;font-size:1.1rem;padding:0 30px">▶ C’est parti !</button></div>
    <div style="margin-top:auto;border-top:1px solid var(--edge);padding-top:12px" class="row between">
      <span class="muted small">Ensuite : <b style="color:var(--ink)">la finale</b> <span class="x2">×2</span></span>
      <span class="row"><button class="btn btn-small btn-ghost">Mélanger les réponses : oui</button><button class="btn btn-small">Un autre quiz…</button></span>
    </div>
  </div>
  <div class="card"><h2 style="font-size:1.5rem">Classement de la soirée</h2><p class="muted small">…</p></div>
</div>`)

const PLAN = [
  ['QCM', 'Quel groupe chante « Wannabe » en 1996 ?', 'Musique', ''],
  ['QCM', 'Qui interprète « Macarena » ?', 'Musique', ''],
  ['QCM', 'Lesquels de ces prénoms sont ceux de Spice Girls ?', 'Musique', 'Choisis la bonne réponse'],
  ['=', 'En quelle année la PlayStation est-elle sortie en Europe ?', 'Jeux', ''],
  ['V/F', 'Le Tamagotchi est sorti en 1996 au Japon.', 'Jeux', ''],
  ['📷', 'Quel est cet objet culte ?', 'Jeux', ''],
  ['QCM', 'Quelle console portable Nintendo est sortie en 1998…', 'Jeux', ''],
  ['🙈', 'Combien de posters y avait-il au mur ?', 'Jeux', ''],
  ['QCM', 'Dans « Friends », quel est le métier de Ross ?', 'Cinéma', ''],
  ['=', 'Combien d’épisodes compte la série « Friends » ?', 'Cinéma', ''],
]
const planTel = maquette(`
<div style="position:sticky;top:0;background:var(--bg);padding:10px 14px;border-bottom:1px solid var(--edge)">
  <div class="row between"><b style="font-family:var(--serif);font-size:1.25rem">Soirée années 90</b><button class="btn btn-small btn-primary">Enregistrer</button></div>
  <div class="row between" style="margin-top:6px"><span class="muted small">15 questions · ≈ 9 min</span><span class="warn small">⚠ 1 à compléter →</span></div>
  <div class="row" style="gap:6px;margin-top:8px"><span class="chip on">Plan</span><span class="chip">Cartes</span></div>
</div>
<div style="padding:8px 10px;display:grid;gap:6px">
  ${PLAN.map(([t, q, c, w], i) => `
  <div class="card" style="padding:9px 10px;display:grid;grid-template-columns:22px 1fr 16px;gap:8px;align-items:center;${w ? 'border-color:var(--edge-strong)' : ''}">
    <span class="num" style="font-size:1.05rem">${i + 1}</span>
    <div style="min-width:0"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.92rem">${q}</div>
      <span class="muted small">${t} · ${c} · 25 s</span>${w ? ` <span class="warn small">· ⚠ ${w}</span>` : ''}</div>
    <span class="muted">⋮⋮</span>
  </div>`).join('')}
</div>`)

const browser = await chromium.launch()
async function rendre(html, nom, viewport, mobile = false) {
  const page = await (await nouveauContexte(browser, viewport, mobile)).newPage()
  await page.goto(BASE + '/fonts/OFL-figtree.txt').catch(() => {})
  await page.setContent(html, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${CAP}/${nom}.png` })
  await page.close()
}
await rendre(bibliotheque, 'M1-mes-quiz-1366-menu-ouvert', PORTABLE)
await rendre(bibliotheque.replace(/<div class="menu">[\s\S]*?<\/div>\s*<\/div>/, ''), 'M1-mes-quiz-1366', PORTABLE)
await rendre(bibliothequeTel, 'M2-mes-quiz-360', TELEPHONE, true)
await rendre(consoleProgramme, 'M3-console-programme-1366', PORTABLE)
await rendre(planTel, 'M4-editeur-plan-360', TELEPHONE, true)

// La révélation, avec une anecdote : posée sur le vrai écran, par-dessus.
const hote = await (await nouveauContexte(browser, PORTABLE)).newPage()
await connecter(hote, '/host')
await hote.waitForTimeout(1500)
const enRevelation = await hote.locator('.ans-grid, .answers, .ans-btn').count()
if (enRevelation) {
  await hote.evaluate(() => {
    const grille = document.querySelector('.ans-grid') ?? document.querySelector('.ans-btn')?.parentElement
    const p = document.createElement('div')
    p.innerHTML = '<span style="font:600 .72rem Figtree;letter-spacing:.18em;text-transform:uppercase;color:#d9b56a">Le saviez-vous ?</span><div style="font:600 1.6rem \'Cormorant Garamond\';margin-top:4px;color:#f3ece2">« Wannabe » est le tout premier single des Spice Girls, sorti en juillet 1996.</div>'
    p.style.cssText = 'margin:18px 0 8px;padding:14px 18px;border:1px solid rgba(217,181,106,.55);border-radius:16px;background:rgba(217,181,106,.08)'
    grille?.after(p)
    const note = document.createElement('span')
    note.textContent = 'Maquette — proposition'
    note.style.cssText = 'position:fixed;right:12px;bottom:56px;font:600 .72rem Figtree;letter-spacing:.14em;text-transform:uppercase;color:#1a1412;background:#d9b56a;padding:4px 10px;border-radius:999px'
    document.body.appendChild(note)
  })
  await hote.waitForTimeout(300)
  await hote.screenshot({ path: `${CAP}/M5-revelation-anecdote-1366.png` })
} else {
  console.log('pas de révélation en cours : maquette M5 non faite')
}
await browser.close()
