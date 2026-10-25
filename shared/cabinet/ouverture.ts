// Où le Cabinet de curiosités s'ouvre, et quels jeux y sont livrés. Il se
// construit lot après lot, en préproduction d'abord : tout reste fermé en
// production jusqu'à ce que le mode soit entier, ses quatre premiers jeux
// joués et la migration des joueurs de l'Expédition mesurée à blanc.
//
// Une constante du code plutôt qu'une variable d'environnement, comme
// l'Expédition l'a fait (`EXPEDITION_EN_PRODUCTION`, `shared/jokers.ts`). La
// page ne la lit pas : une constante ne sait pas la préproduction, qui sert le
// même code — c'est le serveur qui sait, et qui le lui dit.
//
// Ce fichier n'importe que des types : l'album, l'accueil et le serveur le
// lisent sans tirer le Cabinet.

import type { CleDeJeu } from './jeux/regle'

/** Le Cabinet s'ouvre-t-il en production ? Non tant qu'il n'est pas entier ; la préproduction, `npm run dev` et les tests le jouent toujours. */
export const CABINET_EN_PRODUCTION = false

/** Le Cabinet répond-il ? Hors de la production toujours ; en production, sous son drapeau. */
export function cabinetOuvert({ online, env }: { online: boolean; env: string }): boolean {
  return CABINET_EN_PRODUCTION || !online || env !== 'production'
}

/**
 * Les jeux livrés : la visite, la chasse et les parties libres ne tirent
 * qu'eux, et le cadre vide d'une œuvre d'un autre jeu dit « bientôt ». Ils
 * se sont ouverts un à un, chacun avec son tireur (`server/src/core/cabinet/tirages/`)
 * et son écran : le Pari et l'Éclair d'abord, qui tirent leurs questions de la
 * base de la campagne ; puis le Détail, ses cent tableaux, et la Frise, ses
 * frises à thème et celles des sujets de la base ; puis le Mot mystère et le
 * Filet, qui y tirent un mot à taper et une valeur à viser ; enfin l'Épingle,
 * les Indices et la Réplique, du contenu écrit pour le Cabinet
 * (`server/content/cabinet/`) — les neuf. Un dixième jeu y entre de même,
 * et la page dit « bientôt » de ses œuvres tant qu'il n'y est pas.
 */
export const JEUX_PRETS: readonly CleDeJeu[] = ['pari', 'eclair', 'detail', 'frise', 'mot', 'filet', 'epingle', 'indices', 'replique']
