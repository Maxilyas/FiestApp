// Régression (relecture sceptique du 26 octobre 2026, angle serveur) : le lot
// equilibre-2 (96e8fa2) a sorti la série du lot du départ pour l'écrire au
// premier geste répondu de chaque visite ou chasse (`jourCompte`,
// server/src/core/cabinet/magasin.ts:928-929 ; l'instruction,
// ecriture.ts:247-254). L'instruction n'a pas de garde sur le jour : elle
// réécrit la ligne du profil à chaque partie, même quand le jour est déjà
// compté — la deuxième case de la visite, la chasse d'après —, jusqu'à cinq
// lignes écrites par jour et par joueur au quota de Turso pour rien. Sa voisine
// du même lot, la visite figée, se garde exprès (« une instruction qui ne
// change rien ne coûte pas une ligne écrite », ecriture.ts:134-136).
//
// Lancer : cd /home/user/FiestApp/server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/serveur-serie-ecrite-pour-rien.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DIX_HEURES, aLaMain, dossierDEssai, enBase, fermerLesMagasins, magasinDEssai } from '../../../server/test/cabinet-banc'
import type { PariTire } from '../../../shared/cabinet/jeux/pari'

after(fermerLesMagasins)

test('un jour déjà compté à la série ne réécrit pas la ligne du profil', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'serie.db')
  const { cabinet } = await magasinDEssai(fichier, horloge)
  // Chaque écriture de la ligne qui touche la série sans la changer.
  aLaMain(
    fichier,
    `CREATE TABLE ecritures_pour_rien (n INTEGER);
     CREATE TRIGGER serie_pour_rien AFTER UPDATE OF serie, serie_jour, serie_record ON cabinet_profils
       WHEN OLD.serie IS NEW.serie AND OLD.serie_jour IS NEW.serie_jour AND OLD.serie_record IS NEW.serie_record
       BEGIN INSERT INTO ecritures_pour_rien VALUES (1); END;`,
  )
  for (const k of [0, 1]) {
    let p = await cabinet.commencer('ana', { origine: 'chasse', oeuvre: 'lecon', carte: null })
    const t = p.depart.tirages[0] as PariTire
    const r = await cabinet.geste('ana', p.id, p.etat.rang, { quoi: 'repondre', manche: 0, reponse: { pari: { choix: (t.q1.bonne + 1) % 4 } } })
    assert.ok('partie' in r, JSON.stringify(r))
    p = r.partie
    const q = await cabinet.geste('ana', p.id, p.etat.rang, { quoi: 'quitter' })
    assert.ok('partie' in q, `chasse ${k + 1} : ${JSON.stringify(q)}`)
  }
  const ligne = enBase(fichier, db => db.prepare("SELECT serie, serie_jour AS jour FROM cabinet_profils WHERE profile_id = 'ana'").get())
  assert.deepEqual(ligne, { serie: 1, jour: '2026-10-24' }, 'le jour compte une fois')
  const pourRien = enBase(fichier, db => (db.prepare('SELECT COUNT(*) AS n FROM ecritures_pour_rien').get() as { n: number }).n)
  assert.equal(pourRien, 0, `la seconde chasse du jour a réécrit la série sans rien y changer (${pourRien} ligne écrite)`)
})
