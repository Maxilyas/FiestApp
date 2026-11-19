// Les emblèmes des plaques de nom (le choix du propriétaire du 18 novembre
// 2026, `retours/2026-11-18/plaques/`) : un petit dessin par thème — en
// filigrane dans l'écrin d'un avatar et sur sa marche du podium, en semis sur
// sa carte d'un duel, au bout de son nom sur sa plaque. Chaque emblème est
// dessiné en deux tons, le ton clair de la plaque cerné de son ton sombre :
// dessinés d'abord pour suivre le prénom sur le fond de celui qui regarde, les
// deux tons sont ceux de son thème (son or, son trait), éclaircis ou assombris
// jusqu'à se lire à 3:1 sur le fond de chaque thème, et sur sa propre plaque
// (`plaques.test.ts` le mesure) — l'emblème se lit encore là où l'écrin et le
// podium l'ont posé, sur sa plaque.
//
// Des images en ligne, pas un dessin du DOM : un SVG du DOM se tracerait dans
// le calque de sa ligne, en multi-échantillonnage — la friture du téléphone
// Android du 9 au 14 novembre 2026 (règle `css.md`) —, une image se dessine à
// part. Et ni masque ni filtre pour les colorer (règle `themes.md`) : leurs
// couleurs sont écrites dedans.
//
// Le bloc s'écrit dans `client/src/styles.css`, entre ses deux repères,
// jamais à la main :
//
//   npx tsx scripts/emblemes-des-plaques.ts           (dit s'il est à jour)
//   npx tsx scripts/emblemes-des-plaques.ts --ecrire  (le réécrit)
import { readFileSync, writeFileSync } from 'node:fs'
import { THEMES } from '../../shared/themes'
import { PLAQUES, themeDeLaPlaque } from '../../shared/plaques'
import { contraste, surFond, teinte, themesDuClient } from '../test/teintes'

const FEUILLE = new URL('../../client/src/styles.css', import.meta.url)
export const DEBUT = '/* ── Les emblèmes des plaques : écrits par server/scripts/emblemes-des-plaques.ts --ecrire, jamais à la main ── */'
export const FIN = '/* ── Fin des emblèmes des plaques ── */'

/** Le contraste d'un trait ou d'un dessin (WCAG 1.4.11, ce qui n'est pas du texte). */
export const CONTRASTE_D_UN_EMBLEME = 3

// Les deux bêtes des Deux Bannières, tracées de leurs emblèmes peints (le
// contour de ce que le champ de chaque écu enferme, puis potrace) : trop
// longues pour tenir dans le dictionnaire à côté des autres.
const CLANS =
  'M11.7,23.2C11.6,23.1 11.4,22.9 11.3,22.8C11,22.4 10.9,22.3 10.6,22.3C10.3,22.3 10.2,22.2 9.9,21.9C9.7,21.5 9.6,21.4 9.3,21.5C9,21.5 8.9,21.5 8.7,21.0C8.5,20.5 8.2,20.2 8,20.0C7.7,19.8 7.6,19.6 7.6,19.4C7.6,19.1 7.5,19.1 6.8,19.3C6.2,19.5 5.4,19.5 4.9,19.3C4.6,19.2 4.6,19.2 4.4,19.3C3.9,19.6 2.8,18.9 2.7,18.3C2.6,18.1 2.6,18 2.4,18.0C2,17.9 1.5,16.8 1.2,15.5C0.9,14.3 1.3,12.2 1.9,10.9C2.6,9.6 3.3,9.4 3,10.6C2.5,13.5 3.7,16.6 5.5,16.7C6,16.8 6,16.7 5.7,15.8C5.7,15.5 5.6,15.2 5.5,15.2C5.5,15.1 5.5,15 5.4,15.0C5.2,14.9 5.1,14.7 5.2,14.4C5.2,14 5.2,13.9 4.9,13.9C4.5,13.9 4.4,13.6 4.6,13.0C4.7,12.6 4.7,12.6 4.6,12.4C4.4,12.1 4.4,12 4.6,11.7C4.7,11.4 4.7,11.4 4.6,11.2C4.5,10.9 4.6,10.7 4.8,10.5C5.3,10.1 5.6,9.7 5.6,9.3C5.6,9.1 5.6,9 5.8,8.7C6.2,8.3 6.1,7.9 5.4,7.5C5.2,7.4 5.1,7.3 5.1,7.1C5.1,6.8 4.9,6.7 4.7,6.7C4.2,6.7 4,6.2 4.3,5.9C4.4,5.7 4.4,5.7 4.3,5.6C4.3,5.3 4.3,5.1 4.3,5.0C4.4,4.9 4.4,4.7 4.4,4.6C4.4,4.3 4.5,4.2 4.7,4.1C4.9,4 4.9,3.9 4.7,3.7C4.6,3.6 4.5,3.4 4.4,3.2C4.2,2.9 4,2.8 3.8,2.8C3.6,2.8 3.4,2.6 3.3,2.2C2.9,0.8 3.1,0.4 4,1.1C4.3,1.4 4.6,1.5 5.1,1.7C5.8,2 6.4,2.3 6.7,2.5C7,2.6 7.2,2.8 7.2,2.8C7.3,2.8 7.5,2.9 7.7,3.2C8.1,3.7 8.2,3.7 8.9,2.8C9,2.7 9,2.6 9.3,2.6C9.7,2.6 10.1,2.3 10.3,1.9C10.4,1.6 10.6,1.5 10.8,1.6C11.1,1.6 11.3,1.5 11.5,1.1C11.8,0.4 12.1,0.5 12.6,1.3C12.8,1.6 12.9,1.7 13.1,1.8C13.2,1.9 13.4,2 13.6,2.1C13.8,2.3 13.8,2.3 14,2.3C14.4,2.3 14.4,2.3 14.6,2.6C14.7,2.7 14.8,2.8 14.9,2.9C15,2.9 15.2,3 15.3,3.1C15.8,3.7 15.9,3.7 16.3,3.2C16.5,2.9 16.6,2.8 16.8,2.7C16.9,2.7 17.1,2.6 17.2,2.5C17.4,2.4 18.3,2 18.7,1.8C19.1,1.7 19.7,1.4 20.1,1.1C20.6,0.7 20.9,0.8 20.8,1.4C20.8,2.2 20.5,2.7 20.2,2.7C20,2.7 19.8,2.9 19.8,3.0C19.8,3.1 19.7,3.3 19.6,3.5C19.3,3.9 19.3,4.6 19.5,4.8C20.3,5.5 19.9,6.9 18.7,7.5C17.8,7.9 17.8,8.1 18.3,9.0C18.4,9.2 18.4,9.2 18.4,9.7C18.3,10.3 18.4,10.3 18.8,10.4C19.2,10.5 19.4,10.7 19.3,11.1C19.3,11.4 19.4,11.6 19.4,11.8C19.6,12.1 19.6,12.2 19.4,12.4C19.3,12.6 19.3,12.7 19.4,13.1C19.6,13.7 19.5,13.9 19.1,13.9C18.8,13.9 18.8,14 18.8,14.4C18.8,14.8 18.8,14.9 18.5,15.0C18.5,15 18.4,15.3 18.3,15.6C18.2,15.9 18.1,16.2 18.1,16.3C17.7,17.1 19.1,16.8 19.8,15.9C21,14.6 21.3,12.7 20.9,10.4C20.7,9.7 21.3,9.6 21.7,10.3C23,12.2 23.2,15.3 22.2,17.3C22.1,17.6 21.9,17.7 21.6,17.7C21.3,17.7 21.3,17.7 20.6,18.3C19.4,19.5 18.8,19.6 17.1,19.3C16.3,19.1 16.3,19.1 16.3,19.5C16.3,19.8 16.3,19.9 16,20.0C15.7,20.3 15.4,20.6 15.3,21.0C15.2,21.4 15.1,21.4 14.8,21.4C14.6,21.4 14.6,21.5 14.2,21.9C13.8,22.3 13.5,22.5 13.2,22.5C13,22.5 12.8,22.6 12.6,22.8C12.2,23.4 11.9,23.5 11.7,23.2zM14.2,12.4C14.2,12.3 14.1,12.2 14,12.1C13.5,11.3 14,10.9 14.7,11.6C14.9,11.8 15.9,11.9 16.2,11.7C16.5,11.5 16.6,10.8 16.4,10.1C16.3,9.8 16.3,9.6 16.5,9.4C16.8,9 16.8,8.9 16.5,9.1C16.5,9.2 16.3,9.2 16.1,9.3C15.8,9.3 15.7,9.3 15.5,9.5C15.4,9.6 15.2,9.7 15,9.8C14.8,9.9 14.5,10.2 14.4,10.5C14.3,10.7 14.2,10.9 14,11.0C13.7,11.2 13.7,11.3 13.7,11.4C13.7,11.5 13.6,11.6 13.6,11.7C13.5,11.8 13.6,12 13.9,12.3C14.1,12.5 14.2,12.5 14.2,12.4zM9.4,11.5C9.5,11.3 9.6,11.3 9.8,11.3C10.2,11.3 10.3,11.1 10,10.9C9.8,10.8 9.7,10.6 9.5,10.5C9.4,10.3 9.3,10.1 9.2,10.1C8.8,10 8.8,10 8.7,9.9C8.6,9.6 8.3,9.4 7.9,9.3C7.6,9.3 7.6,9.3 7.6,9.8C7.6,10 7.6,10.4 7.5,10.6C7.3,11.5 7.4,11.6 8.4,11.7C8.8,11.7 9.1,11.7 9.2,11.7C9.3,11.7 9.3,11.7 9.4,11.5z'
const ROYAUME =
  'M15.4,23.2C15.3,23.1 15.2,23 15.1,22.7C15,22.3 14.9,22.3 14.6,22.3C14.5,22.4 14.4,22.4 14.3,22.4C14.2,22.3 14,22.4 13.9,22.6C13.5,23.1 13.2,22.2 13.5,21.5C13.8,21 13.6,20.8 13.1,20.9C12.6,21.1 12.8,20.2 13.3,19.9C13.9,19.7 14.3,19.6 14.7,19.8C15.1,20 15.4,19.9 15.5,19.3C15.6,18.7 15.5,18.4 14.9,18.2C14.4,18 14.4,18 14.1,18.3C13.8,18.7 13.1,18.9 12.9,18.6C12.8,18.5 12.9,18.5 13,18.2C13.3,17.9 13.3,17.6 13.1,17.0C13,16.7 12.9,16.2 12.9,15.9C12.9,15.5 12.7,15.4 12.2,15.6C11.6,15.9 11.5,16.3 11.9,16.9C12.1,17.2 12.1,17.4 11.8,17.8C11.5,18.2 11.5,18.4 11.6,18.7C11.6,18.8 11.4,18.9 11.1,18.9C10.8,18.9 10.8,18.9 10.5,19.3C10.3,19.7 10,19.7 9.9,19.3C9.7,18.9 9.6,19 9.3,19.6C9.1,20.2 9,20.3 8.7,20.4C8.4,20.5 8.2,20.4 8.3,20.1C8.4,19.6 8,19.4 7.7,19.8C7.5,20.1 7.5,20.1 7.2,20.2C7,20.2 7,20.2 6.8,20.4C6.6,20.6 6.6,20.6 6.4,20.5C6.2,20.4 6.1,19.8 6.2,19.4C6.3,19.1 6.3,19.1 5.7,18.8C5.6,18.7 5.6,18.7 5.4,18.8C5.1,19 5,18.9 5,18.6C5,18.2 5.2,17.9 5.6,17.7C6.1,17.4 6.2,16.9 5.8,16.8C5.4,16.8 5.5,16.5 5.8,16.3C6.2,16.2 6.3,16.2 6.8,16.3C7.4,16.4 7.5,16.5 7.7,16.9C7.9,17.3 8.2,17.4 8.7,17.1C9.3,16.9 9.4,16.6 9.2,16.2C9.2,16 9.1,15.8 9.1,15.8C9,15.5 8.9,15.5 8.6,15.5C8.1,15.5 7.7,15.3 7.6,14.9C7.5,14.5 7.6,14.3 8,14.4C8.4,14.6 8.6,14.5 9.2,13.9C9.8,13.2 10.2,13.1 11.3,13.1C12.2,13.1 12.3,12.8 11.4,12.4C11,12.2 10.7,12 10.4,11.7C10.2,11.5 10.1,11.5 10,11.8C9.9,12.1 9.8,12.1 9.4,11.9C9.2,11.8 9.1,11.9 8.9,12.1C8.5,12.5 8.3,12.5 8.2,12.1C8.1,11.7 7.9,11.8 7.8,12.2C7.6,13 7.2,13.4 6.8,13.4C6.8,13.3 6.8,13.3 6.8,13.1C6.7,12.6 6.5,12.5 6.3,12.9C6.1,13.1 5.8,13.3 5.7,13.3C5.6,13.3 5.5,13.5 5.4,13.6C5.3,14.3 4.7,13.8 4.7,12.9C4.7,12.5 4.7,12.4 4.3,12.2C4.1,12.1 4,12.1 3.8,12.2C3.2,12.7 3.3,11.6 3.9,11.1C4.5,10.6 4.5,10.2 4,10.2C3.9,10.2 3.7,10.1 3.8,9.9C3.9,9.6 4.3,9.5 4.9,9.5C5.4,9.5 5.5,9.6 5.8,9.9C6.2,10.3 6.4,10.4 7.1,10.0C8,9.5 8,9.4 7.7,9.1C7.5,8.9 7.5,8.8 7.7,8.7C8.1,8.7 8.1,8.4 7.9,8.3C7.8,8.2 7.7,8.2 7.5,8.4C7.3,8.5 7.1,8.4 7,7.9C7,7.6 6.9,7.5 6.7,7.4C6.2,7.3 6.1,7.1 6.3,6.9C6.7,6.5 6.6,6.4 6,6.4C5.4,6.3 5.1,6.3 4.9,6.0C4.6,5.8 4.7,5.6 5,5.6C5.2,5.6 5.3,5.5 5.4,5.3C5.5,5 5.4,4.9 5,4.9C4.7,4.9 4.5,4.9 4.3,4.7C4.2,4.5 4.1,4.5 3.9,4.5C3.2,4.7 3.5,3.9 4.2,3.6C4.7,3.3 4.7,3.3 4.7,2.9C4.7,2.5 4.7,2.5 4.3,2.3C4.2,2.2 4.2,2.1 4.3,2.0C4.6,1.7 5,1.8 5.6,2.0C6.3,2.4 6.5,2.3 6.3,1.8C6.2,1.5 6.3,1.4 6.4,1.4C7.1,1.4 7.7,2.6 7.4,3.3C7.2,3.9 7.4,4.3 8.5,5.3C9.3,6.1 9.5,6.2 9.6,5.8C9.7,5.5 9.8,5.4 10.1,5.6C10.5,5.9 11.4,5.9 11.5,5.6C11.7,5.4 11.5,5.3 11.2,5.4C10.7,5.6 10.6,5.5 10.5,5.1C10.5,4.5 10.5,4.5 9.8,4.5C8.8,4.5 8.3,4.1 8.5,3.4C8.6,2.8 9.3,2.6 9.3,3.1C9.3,3.5 9.5,3.8 9.9,3.8C10.3,3.8 10.3,3.7 10.2,3.4C10,3.2 10,3 9.9,2.5C9.9,2 10,1.9 10.4,1.8C11.1,1.6 11.1,1.6 11.4,1.4C11.7,1.1 12,1 12.8,1.0C13.5,1 13.7,1 13.9,0.8C14.2,0.6 14.4,0.6 14.5,1.0C14.6,1.3 14.8,1.4 14.9,1.4C15.1,1.4 15.3,1.5 15.3,1.8C15.4,1.9 15.5,2.2 15.6,2.3C15.7,2.5 15.9,2.8 15.9,3.0C16.1,3.4 16.2,3.6 16.4,3.7C16.7,3.8 16.6,4.3 16.3,4.3C16,4.3 15.9,6.2 16.2,6.7C16.4,7.1 16.3,7.2 15.8,7.2C15.5,7.1 15.5,7.1 15.3,7.8C15.1,8.6 15.1,8.7 15.2,9.2C15.4,9.6 15.3,9.6 14.9,9.6C14.4,9.5 14.4,9.6 14.6,10.3C14.8,11.1 15,11.4 15.6,12.1C15.8,12.3 16.1,12.7 16.2,12.9C16.7,13.8 17.2,14.1 17.8,14.1C19,14.1 19.4,12.3 18.3,12.0C17.9,11.9 17.6,12.2 17.7,12.6C17.7,12.9 17.4,13 17.1,12.7C16.8,12.5 16.7,12 16.9,11.5C17,11.1 17,11.1 16.7,10.9C16,10.4 15.8,9.8 15.9,9.1C16,8.4 16.3,8.3 16.5,8.8C16.6,9.3 17,9.6 17.3,9.6C17.5,9.7 17.5,9.5 17.3,9.1C16.7,8 16.5,6.7 16.9,5.6C17.1,5.1 17.1,5.1 17,4.8C17,4.3 17,4 17.3,3.4C17.6,2.7 17.6,2.4 17.4,2.3C17.1,2 17.4,1.8 17.8,1.8C18.1,1.9 18.3,2 18.4,2.2C18.8,2.7 19.5,1.9 19.3,1.1C19.2,0.6 19.8,0.8 20.1,1.4C20.4,1.8 20.4,2.3 20.2,2.8C20.2,3.1 20.2,3.1 20.2,3.4C20.5,4.3 20,5 18.8,5.5C18,5.8 17.8,6.1 17.8,7.0C17.8,7.8 18,8.2 18.3,7.7C18.4,7.6 18.6,7.4 19,7.1C19.3,6.8 19.4,6.6 19.4,6.2C19.4,5.8 19.7,5.7 20,6.2C20.4,6.8 20.3,7.5 19.7,8.1C19,8.9 18.8,9.8 19.5,9.2C19.9,8.9 20.4,8.8 20.5,9.0C20.6,9.1 20.5,9.1 20.3,9.5C20,9.8 20,10.3 20.2,11.2C20.3,12 20.3,13 20.2,13.4C19.8,14.9 18.4,15.7 17,15.2C16.7,15.1 16.6,15.1 16.5,15.3C16.2,16.2 16.8,16.8 17.5,16.4C18,16.1 18.2,16.5 18.1,17.2C18,17.6 18.2,17.9 18.6,18.1C18.8,18.2 18.8,18.4 18.6,18.6C18.3,18.9 18.2,19 18.2,19.3C18.2,19.9 18.1,20 17.9,19.9C17.5,19.7 17.4,19.9 17.5,20.2C17.8,20.9 17.7,21.7 17.4,22.0C17.3,22 17.1,22 17.1,21.8C17,21.7 16.9,21.6 16.8,21.6C16.7,21.6 16.6,21.7 16.5,22.0C16.5,22.3 16.5,22.3 16.2,22.6C16,22.8 16,22.8 15.9,23.0C15.9,23.3 15.7,23.4 15.4,23.2z'

/**
 * Les dessins, dans un carré de 24 : `f`, une forme pleine ; `s="1.8"`, un
 * trait de cette épaisseur. Chaque forme se peint deux fois — son cerne au ton
 * sombre, un peu plus large, puis elle au ton clair (`enDeuxTons`).
 */
export const EMBLEMES: Record<string, string> = {
  // Le losange et son cœur, comme le filet d'or d'un carton d'invitation.
  ivoire: `<path s="1.8" d="M12 3.5 17.5 12 12 20.5 6.5 12z"/><circle f cx="12" cy="12" r="2.3"/>`,
  // Le crayon de l'écolier, sa mine à part.
  cahier: `<path f d="M8.6 19.4 4.6 15.4 15.2 4.8l4 4z"/><path f d="M3.7 16.5l3.8 3.8-4.8 1z"/>`,
  // L'avion de papier du carnet de voyage.
  carnet: `<path f d="M2.5 11.2 21.5 3l-6.6 18-3.4-7.4z"/><path f d="M11.9 13.2 21 3.4l-7.6 12.5z"/>`,
  // La guirlande : trois ampoules qui pendent à leur fil.
  guinguette: `<path s="1.2" d="M2 4q10 6 20 0"/><path s="1.3" d="M6.5 6v2.2M12 7v2.6M17.5 6v2.2"/><circle f cx="6.5" cy="11.2" r="2.5"/><circle f cx="12" cy="12.8" r="2.5"/><circle f cx="17.5" cy="11.2" r="2.5"/>`,
  // La lune et son étoile.
  pyjama: `<path f d="M14.6 3.4A8.8 8.8 0 1 0 20.6 15.3 7 7 0 0 1 14.6 3.4z"/><path f d="M19.2 2.6l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7z"/>`,
  // La coupe du vainqueur.
  stade: `<path f d="M7 3h10v5.2a5 5 0 0 1-10 0z"/><path s="1.6" d="M7 5H4.6v1.4a3.2 3.2 0 0 0 3 3.2M17 5h2.4v1.4a3.2 3.2 0 0 1-3 3.2"/><path f d="M10.8 13.4h2.4v3.8h-2.4z"/><rect f x="7.5" y="17.6" width="9" height="3" rx="1"/>`,
  // La feuille et sa tige.
  jungle: `<path f d="M5 19C5 10.5 10.5 4 20 4c0 9.5-6.5 15-15 15z"/><path s="1.6" d="M3 21l5-5"/>`,
  // Les bulles qui montent.
  ocean: `<circle s="1.6" cx="9" cy="15" r="4.5"/><circle s="1.6" cx="16.5" cy="7.5" r="3"/><circle s="1.5" cx="18" cy="16.2" r="1.8"/>`,
  // Le macaron, ses deux coques et sa crème.
  patisserie: `<path f d="M4 10.2a8 4.6 0 0 1 16 0z"/><rect f x="4.6" y="11.4" width="14.8" height="1.8" rx=".9"/><path f d="M4 14.4h16a8 4.6 0 0 1-16 0z"/>`,
  // Le cœur en pixels.
  gameboy: `<path f d="M6 6h4v2H6zM14 6h4v2h-4zM4 8h16v4H4zM6 12h12v2H6zM8 14h8v2H8zM10 16h4v2h-4z"/>`,
  // La feuille d'érable qui tombe.
  foret: `<path f d="M12 2.5l1.5 3.8 2.8-1.2-.6 3.4 3.3-.6-1.4 2.7 2.9 1.2-4.2 2.3.7 2-4-.7.4 5.6h-2.8l.4-5.6-4 .7.7-2-4.2-2.3 2.9-1.2-1.4-2.7 3.3.6-.6-3.4 2.8 1.2z"/>`,
  // Le serpentin et ses confettis.
  carnaval: `<path s="1.9" d="M3 20c2.6-4.2 5.2-1.2 6.6-4.6S11.6 9 14.6 11s3.2-5.6 6.6-6.2"/><circle f cx="5.2" cy="6.4" r="1.7"/><path f d="M10.4 3.2l2.6.8-.8 2.6-2.6-.8z"/><circle f cx="18.6" cy="16.4" r="1.7"/>`,
  // Le soleil sur les vagues.
  plage: `<circle f cx="12" cy="9" r="4.6"/><path s="1.8" d="M2.5 17.5q2.4-2.6 4.8 0t4.7 0 4.7 0 4.8 0"/>`,
  // La corne et son éclat.
  licorne: `<path f d="M8.6 21 12.4 3l3.4 18z"/><path f d="M19 2.8l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>`,
  // Le « boum » d'une case de bande dessinée.
  heros: `<path f d="M12 1.5l2.2 5.2 5.2-2.1-1.6 5.4 5.2 2-5.2 2 1.6 5.4-5.2-2.1L12 22.5l-2.2-5.2-5.2 2.1 1.6-5.4L1 12l5.2-2-1.6-5.4 5.2 2.1z"/>`,
  // La plume d'oie.
  grimoire: `<path f d="M20.5 3C12.5 4 7.4 10 6.3 17.2l2 .9C10.2 11.7 14.3 7 20.5 3z"/><path s="1.6" d="M6.6 17.6 4.4 21.5"/>`,
  // Le feutre du détective.
  filmnoir: `<path f d="M2.5 16.2c3.5 2.6 15.5 2.6 19 0-1.7-1-3-1.2-3-1.2l-1-6.2c-.4-2-2.6-2.6-4.6-1.3-.6.4-1.2.4-1.8 0-2-1.3-4.2-.7-4.6 1.3l-1 6.2s-1.3.2-3 1.2z"/>`,
  // La boule à facettes.
  disco: `<circle s="1.6" cx="12" cy="13.5" r="7"/><path s="1.4" d="M5 13.5h14M12 6.5v14M6.6 10h10.8M6.6 17h10.8M12 2v4.5"/>`,
  // La citrouille et sa queue.
  halloween: `<path f d="M12 7.2c-1.2-.6-2.6-.7-3.8-.2C5 7.8 3 10.2 3 13.6S5.5 20 8.6 20c1.3 0 2.4-.4 3.4-1 1 .6 2.1 1 3.4 1 3.1 0 5.6-3 5.6-6.4S19 7.8 15.8 7c-1.2-.5-2.6-.4-3.8.2z"/><path f d="M11.3 7.3c-.2-2 .3-3.6 1.8-4.6l1 1c-1 .8-1.4 2-1.3 3.6z"/>`,
  // Le flocon.
  neige: `<path s="1.7" d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path s="1.5" d="M9.5 4 12 6.4 14.5 4M9.5 20l2.5-2.4 2.5 2.4"/>`,
  // La fleur de cerisier, ses cinq pétales.
  cerisiers: `<circle f cx="12" cy="7" r="3.3"/><circle f cx="16.8" cy="10.5" r="3.3"/><circle f cx="14.9" cy="16.1" r="3.3"/><circle f cx="9.1" cy="16.1" r="3.3"/><circle f cx="7.2" cy="10.5" r="3.3"/>`,
  // L'éclair de la borne d'arcade.
  neon: `<path f d="M14.5 2 7.5 13.2h4.6L10 22l7.6-11.5H13z"/>`,
  // La colonne grecque.
  olympe: `<path f d="M4 4h16v2.5H4zM6 7.5h12V9H6zM7 10h2v8H7zM11 10h2v8h-2zM15 10h2v8h-2zM5 19h14v2H5z"/>`,
  // La flamme du Phénix.
  braises: `<path f d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2.5 2 4 1-2 1-5 1-8z"/>`,
  // La planète et son anneau.
  cosmos: `<circle f cx="12" cy="12" r="5.2"/><ellipse s="1.6" cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-22 12 12)"/>`,
  // Le bouquet qui éclate.
  feudartifice: `<path s="1.6" d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M5.3 18.7l2.8-2.8M15.9 8.1l2.8-2.8"/><circle f cx="12" cy="12" r="2"/>`,
  // Le voile de l'aurore au-dessus du sapin.
  aurore: `<path s="1.8" d="M2 7.5q5-5 10 0t10 0"/><path f d="M12 9.5 7.6 16.6h2.8L8 21h8l-2.4-4.4h2.8z"/>`,
  // La fêlure réparée à l'or.
  kintsugi: `<path s="1.9" d="M3 4 9 10 7 14 13 16 11 21M9 10 15 8 20 12M13 16 19 15 22 19"/>`,
  // Le masque du théâtre, ses yeux et son sourire.
  theatre: `<path f fill-rule="evenodd" d="M5 4c4.2-1.6 9.8-1.6 14 0 .3 8.4-2.2 15.4-7 16.6C7.2 19.4 4.7 12.4 5 4zM7.9 8.6c.6-1.2 2.6-1.2 3.2 0-.6.6-2.6.6-3.2 0zM12.9 8.6c.6-1.2 2.6-1.2 3.2 0-.6.6-2.6.6-3.2 0zM8.8 13c1.9 2.3 4.5 2.3 6.4 0-1.9 1-4.5 1-6.4 0z"/>`,
  // Le livre ouvert de la bibliothèque infinie.
  babel: `<path f d="M2 6c4-1 7 0 9.3 1.6V20C9 18.5 6 18 2 19z"/><path f d="M22 6c-4-1-7 0-9.3 1.6V20c2.3-1.5 5.3-2 9.3-1z"/>`,
  // Le cadran et ses aiguilles.
  horloge: `<circle s="1.8" cx="12" cy="12" r="8.5"/><path s="1.8" d="M12 7v5l3.5 2.5"/>`,
  // Le soleil et ses rayons.
  ciel: `<circle f cx="12" cy="12" r="4.4"/><path s="2" d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>`,
  // La fleur de lys des enlumineurs.
  heures: `<path f d="M12 2.5c-2.3 3.2-2.3 6.4 0 9.6 2.3-3.2 2.3-6.4 0-9.6zM3.5 8.5c.2 3.9 3 5.9 6.3 5.1-.7-3.2-3.2-5.3-6.3-5.1zM20.5 8.5c-.2 3.9-3 5.9-6.3 5.1.7-3.2 3.2-5.3 6.3-5.1zM10.2 16.6 12 21.5l1.8-4.9z"/><rect f x="6.5" y="14" width="11" height="2" rx="1"/>`,
  // Les Deux Bannières, une plaque par camp : la hure du sanglier des Clans
  // de la Braise et le lion dressé du Royaume d'Azur, tracés d'après leurs
  // emblèmes peints (`server/scripts/anime/decors.ts`, le groupe
  // `bannieres`) — un trait de plus que les autres : en filigrane sous un
  // avatar, on doit y lire la bête, pas une tache.
  'bannieres-clans': `<path f d="${CLANS}"/>`,
  'bannieres-royaume': `<path f d="${ROYAUME}"/>`,
  // La montagne et son drapeau.
  sommet: `<path f d="M2 20.5 9.2 8l4 6.6 2.6-3.8 6.2 9.7z"/><path s="1.3" d="M9.2 8V2.8"/><path f d="M9.6 2.8h4.4l-1.3 1.5 1.3 1.5H9.6z"/>`,
}

/** Le cerne : ce que le ton sombre ajoute autour de chaque forme, en unités du carré de 24. */
const CERNE = 2.2

/** Un dessin en deux tons : son cerne sombre, puis lui, clair. */
export function enDeuxTons(dessin: string, clair: string, sombre: string): string {
  const cerne = dessin
    .replace(/ f /g, ` fill="${sombre}" stroke="${sombre}" stroke-width="${CERNE}" `)
    .replace(/ s="([\d.]+)" /g, (_, w) => ` fill="none" stroke="${sombre}" stroke-width="${Math.round((Number(w) + CERNE) * 10) / 10}" `)
  const lui = dessin.replace(/ f /g, ` fill="${clair}" `).replace(/ s="([\d.]+)" /g, ` fill="none" stroke="${clair}" stroke-width="$1" `)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 26 26" stroke-linejoin="round" stroke-linecap="round">${cerne}${lui}</svg>`
}

// ── Les couleurs ─────────────────────────────────────────────────────────

const rvb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const hex = (c: number[]) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
/** Une couleur poussée vers une autre, d'une part `t` (0 à 1). */
const vers = (de: string, a: string, t: number) => hex(rvb(de).map((v, i) => v + (rvb(a)[i] - v) * t))

/** Le plus faible contraste d'une couleur sur une liste de fonds. */
export const auPire = (couleur: string, fonds: readonly string[]) => Math.min(...fonds.map(f => contraste(couleur, f)))

/**
 * Les fonds sur lesquels une ligne se pose, thème par thème : son `--bg`, et
 * sa surface posée dessus quand elle est translucide (`.lb-row`). Les thèmes
 * clairs d'un côté, les sombres de l'autre — le Velours compris.
 */
export function fondsDesThemes(): { sombres: string[]; clairs: string[] } {
  const clair = new Map(THEMES.map(t => [t.key, t.clair]))
  const sombres: string[] = []
  const clairs: string[] = []
  for (const t of themesDuClient()) {
    const bg = teinte(t.jetons, '--bg')
    const surface = t.jetons.get('--surface') ?? ''
    const fonds = [bg, /^rgba?\(/.test(surface) ? surFond(surface, bg) : /^#[0-9a-f]{6}$/i.test(surface) ? surface : bg]
    if (clair.get(themeDeLaPlaque(t.cle))) clairs.push(...fonds)
    else sombres.push(...fonds)
  }
  return { sombres, clairs }
}

/** Les cinq couleurs de chaque plaque, telles que la feuille les écrit (`.plaque-<clé>`). */
export function couleursDesPlaques(css: string): Map<string, Record<'bg' | 'ink' | 'muted' | 'or' | 'trait', string>> {
  const lues = new Map<string, Record<'bg' | 'ink' | 'muted' | 'or' | 'trait', string>>()
  for (const m of css.matchAll(/^\.plaque-([a-z]+(?:-[a-z]+)?) \{([^}]*--p-bg[^}]*)\}/gm)) {
    const v = new Map([...m[2].matchAll(/--p-([a-z]+):\s*(#[0-9a-f]{6})/gi)].map(x => [x[1], x[2].toLowerCase()]))
    lues.set(m[1], { bg: v.get('bg')!, ink: v.get('ink')!, muted: v.get('muted')!, or: v.get('or')!, trait: v.get('trait')! })
  }
  return lues
}

/**
 * Les deux tons d'une plaque. Le clair : son or, sinon son trait, sinon son
 * trait éclairci, le premier qui se lit sur tous les fonds sombres — et sur
 * sa plaque, si elle est sombre. Le sombre : son or, sinon son trait
 * assombri, le premier qui se lit sur tous les fonds clairs — et sur sa
 * plaque, si elle est claire.
 */
export function tonsDeLaPlaque(p: { bg: string; or: string; trait: string }, plaqueClaire: boolean, fonds: { sombres: string[]; clairs: string[] }) {
  const pourLeClair = plaqueClaire ? fonds.sombres : [...fonds.sombres, p.bg]
  const pourLeSombre = plaqueClaire ? [...fonds.clairs, p.bg] : fonds.clairs
  const premier = (candidats: string[], fondsVises: string[], pousser: (t: number) => string) => {
    for (const c of candidats) if (auPire(c, fondsVises) >= CONTRASTE_D_UN_EMBLEME) return c
    for (let t = 0.04; t <= 1; t += 0.04) {
      const c = pousser(t)
      if (auPire(c, fondsVises) >= CONTRASTE_D_UN_EMBLEME) return c
    }
    throw new Error(`aucun ton ne se lit sur ${fondsVises.join(', ')}`)
  }
  const clair = premier([p.or, p.trait], pourLeClair, t => vers(p.trait, '#ffffff', t))
  const sombre = premier([p.or, p.trait], pourLeSombre, t => vers(p.trait, '#000000', t))
  return { clair, sombre }
}

/** Le bloc de la feuille, tel qu'il doit être. */
export function blocDesEmblemes(css: string): string {
  const fonds = fondsDesThemes()
  const couleurs = couleursDesPlaques(css)
  const clairs = new Map(THEMES.map(t => [t.key, t.clair]))
  const lignes = [
    DEBUT,
    '/* Chaque plaque, ses deux tons — `--p-clair`, qui se lit sur un thème sombre ; `--p-sombre`, sur un thème clair — et son',
    '   emblème, le clair cerné du sombre : lisible sur le fond de tout thème, et sur sa propre plaque. */',
  ]
  // Une plaque par thème, une par camp d'un thème qui en a deux (`PLAQUES`).
  for (const { cle } of PLAQUES) {
    const p = couleurs.get(cle)
    if (!p) throw new Error(`.plaque-${cle} n'a pas ses couleurs dans la feuille`)
    const dessin = EMBLEMES[cle]
    if (!dessin) throw new Error(`${cle} n'a pas d'emblème`)
    const { clair, sombre } = tonsDeLaPlaque(p, !!clairs.get(themeDeLaPlaque(cle)), fonds)
    const svg = encodeURIComponent(enDeuxTons(dessin, clair, sombre)).replace(/%20/g, ' ').replace(/%3D/g, '=').replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%2C/g, ',')
    lignes.push(`.plaque-${cle} { --p-clair: ${clair}; --p-sombre: ${sombre}; --p-embleme: url("data:image/svg+xml,${svg}"); }`)
  }
  lignes.push(FIN)
  return lignes.join('\n')
}

/** La feuille avec son bloc à jour. */
export function feuilleAJour(css: string): string {
  const debut = css.indexOf(DEBUT)
  const fin = css.indexOf(FIN)
  if (debut < 0 || fin < debut) throw new Error('les repères des emblèmes manquent à styles.css')
  return css.slice(0, debut) + blocDesEmblemes(css) + css.slice(fin + FIN.length)
}

if (process.argv[1]?.endsWith('emblemes-des-plaques.ts')) {
  const css = readFileSync(FEUILLE, 'utf8')
  const neuve = feuilleAJour(css)
  if (process.argv.includes('--ecrire')) {
    if (neuve !== css) writeFileSync(FEUILLE, neuve)
    console.log(neuve === css ? 'Les emblèmes étaient à jour.' : 'Les emblèmes sont réécrits dans styles.css.')
  } else if (neuve !== css) {
    console.error('Les emblèmes de styles.css ne sont pas à jour : npx tsx scripts/emblemes-des-plaques.ts --ecrire')
    process.exitCode = 1
  } else console.log('Les emblèmes sont à jour.')
}
