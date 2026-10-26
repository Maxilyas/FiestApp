// Régression (relecture sceptique du 26 octobre 2026, angle serveur) : la
// relecture du lot equilibre-2 (db6eba5) fige la visite du jour à la première
// dépense, « dans le même aller-retour » : le lot envoie l'achat (ou la
// dorure), puis `instructionQuiFigeLaVisite` — mais cette seconde instruction
// n'est gardée par rien (server/src/core/cabinet/magasin.ts:1153-1156,
// ecriture.ts:144-150). Quand la base refuse la dépense — le solde que l'autre
// serveur d'une mise en ligne vient de dépenser, une partie qu'il vient de
// commencer —, l'achat ne s'écrit pas, et la visite se fige quand même, d'un
// musée que le magasin oublie l'instant d'après parce qu'il le sait faux. Un
// départ, lui, ne fige la visite que s'il part (`lotDuDepart`, sous
// `partie IS NULL`) ; le commentaire de l'écriture dit « comme un départ », et
// la règle D9 : « Rien d'écrit, ou une erreur ».
//
// Lancer : cd /home/user/FiestApp/server && nice -n 10 node --import tsx --test --test-timeout=120000 ../retours/2026-10-26/reproductions/serveur-gel-de-la-depense-non-garde.test.ts
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { DIX_HEURES, aLaMain, dossierDEssai, enBase, fermerLesMagasins, magasinDEssai } from '../../../server/test/cabinet-banc'
import { PRIX_D_UNE_OEUVRE } from '../../../shared/cabinet/bareme'
import { OEUVRES } from '../../../shared/cabinet/oeuvres'

after(fermerLesMagasins)

test('un achat que la base refuse ne fige pas la visite du jour', async () => {
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'gel.db')
  const { cabinet } = await magasinDEssai(fichier, horloge)
  const lecon = OEUVRES.find(o => o.cle === 'lecon')!
  const prix = PRIX_D_UNE_OEUVRE[lecon.rarete]
  aLaMain(fichier, `INSERT INTO cabinet_profils (profile_id, poussiere, cree_le, maj_le) VALUES ('ivy', ${prix}, 0, 0);`)
  const page = await cabinet.page('ivy')
  assert.equal(page.visite.figee, false, 'rien n’a encore figé la visite')
  // L'autre serveur d'une mise en ligne dépense la même poussière : la mémoire d'ici ne le sait pas.
  aLaMain(fichier, `UPDATE cabinet_profils SET poussiere = 0 WHERE profile_id = 'ivy';`)
  await assert.rejects(cabinet.acheter('ivy', 'lecon', prix), 'la base refuse l’achat, et le refus se dit en mots')
  assert.equal(enBase(fichier, db => (db.prepare("SELECT COUNT(*) AS n FROM cabinet_oeuvres WHERE profile_id = 'ivy'").get() as { n: number }).n), 0, 'rien d’acheté')
  const visites = enBase(fichier, db => (db.prepare("SELECT visites FROM cabinet_profils WHERE profile_id = 'ivy'").get() as { visites: string | null }).visites)
  assert.equal(visites, null, `la dépense refusée a figé la visite : ${visites}`)
})
