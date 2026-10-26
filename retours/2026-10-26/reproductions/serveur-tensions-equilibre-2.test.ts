// Deux tensions du lot equilibre-2 (96e8fa2) avec un parti pris écrit — à
// trancher, pas à corriger d'office (relecture sceptique du 26 octobre 2026,
// angle serveur). Chaque épreuve dit la règle générale et rougit sur le cas que
// l'arbitrage a laissé.
//
// 1. « Un départ se relit à sa forme ; une version inconnue se refuse, une
//    connue garde la sienne » (règle cabinet.md, lecture.ts). Le lot change ce
//    que le pli juge (Protéger, Miser 3, les Indices à [2, 4], le rayon de la
//    zone) sans monter `VERSION_DU_DEPART` (decisions.md, arbitrage 7) : un
//    départ v1 de l'Épingle écrit avant le lot — sans `rayonKm` — ne se relit
//    plus du tout (`lEpingle`, shared/cabinet/lecture.ts:199-201), et sa partie
//    devient illisible ; une partie v1 misée à la force 3 se rejoue à +3 dans
//    « Mes réponses » quand son bilan figé dit +4.
// 2. « Quitter d'emblée ne rapporte rien — ni étoile, ni poussière, ni jour de
//    série » (decisions.md, arbitrage 2). Le lancer que la page envoie d'elle-
//    même à l'échéance du Filet, le curseur au milieu sans qu'il y ait touché,
//    est une réponse (`choix` non nul, shared/cabinet/jeux/filet.ts:222-238) :
//    une chasse au Filet laissée ouverte une manche puis quittée tient la série
//    du jour et paie son plancher. Trente jours ainsi réveillent le Scarabée.
//
// Lancer : cd /home/user/FiestApp/server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/serveur-tensions-equilibre-2.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DIX_HEURES, dossierDEssai, enBase, fermerLesMagasins, magasinDEssai } from '../../../server/test/cabinet-banc'
import { departDe } from '../../../server/test/cabinet-plans'
import { lireLeDepart } from '../../../shared/cabinet/lecture'
import { VERSIONS_DU_DEPART } from '../../../shared/cabinet/partie'
import { DUREES_DES_JEUX } from '../../../shared/cabinet/bareme'
import { JEU_DE_L_OEUVRE, OEUVRES, OEUVRES_DE_DEPART } from '../../../shared/cabinet/oeuvres'
import type { FiletTire } from '../../../shared/cabinet/jeux/filet'

after(fermerLesMagasins)

test('tension 1 : un départ v1 de l’Épingle écrit avant le 26 octobre — sans rayon figé — se relit à sa version', () => {
  const d = departDe('epingle')
  assert.equal(d.v, 1)
  assert.ok(VERSIONS_DU_DEPART.includes(1 as never), 'la version 1 est connue')
  const avant = JSON.parse(JSON.stringify(d))
  for (const t of avant.tirages) delete t.decalage.rayonKm
  assert.notEqual(lireLeDepart(JSON.stringify(avant)), null, 'un départ de la version 1 ne se relit plus : sa partie, son cartel et « Mes réponses » deviennent illisibles')
})

test('tension 2 : une chasse au Filet laissée à l’échéance sans y toucher, puis quittée, ne tient pas la série', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'filet.db')
  const { cabinet } = await magasinDEssai(fichier, horloge)
  const cible = OEUVRES.find(o => JEU_DE_L_OEUVRE[o.cle] === 'filet' && !OEUVRES_DE_DEPART.includes(o.cle))!
  const p = await cabinet.commencer('ana', { origine: 'chasse', oeuvre: cible.cle, carte: null })
  const t = p.depart.tirages[0] as FiletTire
  // La page n'a rien touché : à l'échéance, elle lance d'elle-même le curseur au milieu, filet moyen.
  horloge.t += DUREES_DES_JEUX.filet * 1000 - 500
  const milieu = Math.round((t.piste.min + t.piste.max) / 2 / t.piste.pas) * t.piste.pas
  const r = await cabinet.geste('ana', p.id, p.etat.rang, { quoi: 'repondre', manche: 0, auto: true, reponse: { filet: { x: milieu, taille: 'moyen' } } })
  assert.ok('partie' in r, JSON.stringify(r))
  const q = await cabinet.geste('ana', p.id, r.partie.etat.rang, { quoi: 'quitter' })
  assert.ok('partie' in q, JSON.stringify(q))
  const ligne = enBase(fichier, db => db.prepare("SELECT serie, poussiere FROM cabinet_profils WHERE profile_id = 'ana'").get()) as { serie: number; poussiere: number }
  assert.equal(ligne.serie, 0, `sans un geste, la chasse a compté le jour à la série (série ${ligne.serie}, ${ligne.poussiere} poussières d’or)`)
})
