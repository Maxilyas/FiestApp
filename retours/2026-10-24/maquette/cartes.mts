// Tire les cartes des rencontres et leur peinture, pour donnees.js : node --import tsx cartes.mts > cartes.json
import * as R from '../../../shared/rencontres.ts'
import { CARTES_PEINTES } from '../../../client/src/components/cartes-peintes.ts'
const cartes = (R as any).CARTES_DES_RENCONTRES as any[]
const out = cartes.map(c => ({ cle: c.cle, nom: c.nom, famille: c.famille, rarete: c.rarete, resume: c.resume, legendaire: c.legendaire, peinture: CARTES_PEINTES[c.cle]?.[1] }))
console.log(JSON.stringify(out))
