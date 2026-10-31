// La carte d'un joueur, du côté de son profil : son niveau, ses médaillons,
// sa vitrine, ses écussons, ses chiffres, son savoir par catégorie et ses
// sentiers — de ce qu'elle lisait déjà. La même en soirée, quand on touche
// son nom, et sur sa propre page (« Voir ma carte ») : la carte qu'il compose
// est celle que la salle verra.
import type { ProfileRec, ProfileStore } from '../auth/profiles'
import type { JourStore } from './jour'
import { PRIX_INDIVIDUELS } from './stats'
import { vitrineDeLaCarte, type CarteDeJoueur } from '../../../shared/carte'
import { additionnerCategories, ecussonsDe, plusBeauxEcussons } from '../../../shared/ecussons'
import { ficheDe } from '../../../shared/profil'
import { maitresDe } from '../../../shared/sentiers'
import { bordurePortee } from '../../../shared/duels'
import { divin } from '../../../shared/divins'
import { CATEGORIES } from '../../../shared/categories'
import { BRANCHES, type Paliers } from '../../../shared/branches'

/**
 * La moitié « profil » d'une carte, et la bordure de ligue autour de son
 * avatar, lue avec sa cote : en soirée, elle fait foi sur celle que la salle
 * tient de mémoire (`badgeDe`).
 */
export async function carteDuProfil(
  profiles: ProfileStore,
  jour: Pick<JourStore, 'resumeDe'> | undefined,
  profil: ProfileRec,
): Promise<Required<Pick<CarteDeJoueur, 'profil'>> & Pick<CarteDeJoueur, 'bordure'>> {
  const [vitrine, carriere, resume, ailleurs, paliers, duels, campagne] = await Promise.all([
    profiles.badgesOf(profil.id),
    profiles.careerOf(profil.id),
    jour?.resumeDe(profil.id).catch(() => null),
    // Ses écussons et sa précision comptent tous les modes de jeu, comme sa
    // page : le quiz du jour et la campagne s'ajoutent à ses soirées.
    profiles.savoirHorsSoirees(profil.id),
    // Ses maîtres ouvrent le Cabinet de curiosités ; muets, ils ne l'ôtent qu'à cette lecture.
    profiles.paliersDe(profil.id).catch(() => ({})),
    // Sa ligue des duels : une base qui se tait l'ôte, pas la carte.
    profiles.duelsDe?.(profil.id).catch(() => null) ?? null,
    // Sa campagne, de même.
    profiles.statsDeCampagne?.(profil.id).catch(() => null) ?? null,
  ])
  // Les paliers validés de tous ses sentiers : chacun compte jusqu'au plus haut qu'il a validé.
  const paliersValides = Object.values(paliers).reduce((n, p) => n + (p ?? 0), 0)
  const ecussons = plusBeauxEcussons(ecussonsDe(carriere.categories, ailleurs.categories)).map(e => ({
    categorie: e.categorie,
    palier: e.palier as 1 | 2 | 3,
  }))
  const fiche = ficheDe(carriere, ailleurs)
  // Son savoir catégorie par catégorie, pour le radar de sa face « Son
  // savoir » : la même addition que ses écussons et « Ma carrière »
  // (`additionnerCategories`) — la salle ne lit pas d'autres chiffres que
  // lui. Seulement les douze catégories, et celles où il a joué.
  const parCategorie = additionnerCategories(carriere.categories, ailleurs.categories)
  const savoir = CATEGORIES.flatMap(categorie => {
    const c = parCategorie[categorie]
    return c && c.questions > 0 ? [{ categorie, questions: c.questions, justes: c.justes }] : []
  })
  // Ses sentiers commencés, pour sa face « Ses sentiers » : les paliers déjà lus pour ses maîtres.
  const lus: Paliers = paliers
  const sentiers: Paliers = Object.fromEntries(BRANCHES.flatMap(b => ((lus[b.key] ?? 0) > 0 ? [[b.key, lus[b.key]]] : [])))
  const recompenses = profiles.recompensesOf(profil.id)
  const titre = profiles.titrePorte(profil)
  const fond = profiles.fondPorte(profil, carriere.jour, maitresDe(paliers).length)
  // La bordure de ligue autour de son avatar, lue avec sa cote — jamais sous un Divin, qui a sa propre lumière.
  const porte = profiles.legendairePorte(profil)
  const bordure = duels && !(porte && divin(porte)) ? bordurePortee(profil.bordure, duels.bordures) : null
  // Le compagnon de sa niche, tel qu'elle le montre — sa forme, ses
  // ornements — et avec son nom (le propriétaire, le 19 octobre 2026 : « Le
  // compagnon sur la carte doit avoir son nom ») : la carte se lit quand on
  // l'ouvre, rien de lui ne part à la salle. De mémoire, comme sa niche.
  const niche = profiles.compagnonDeLaNiche(profil)
  const compagnon = niche ? profiles.compagnonsOf(profil.id).find(a => a.compagnon === niche) : undefined
  const sonProfil: NonNullable<CarteDeJoueur['profil']> = {
    prenom: profil.name,
    niveau: profiles.niveauOf(profil),
    legendaires: profiles.legendairesOf(profil.id),
    divins: profiles.divinsOf(profil.id),
    // Ceux qu'il a choisis, s'il en a choisi ; sinon ses trois plus beaux,
    // les plus rares à décrocher. Rangée à la rareté du serveur, muette
    // sous dix profils, la vitrine tombait sur les prix les plus souvent
    // gagnés : six fois L'Éclair, que la salle voit remettre à chaque soirée.
    vitrine: vitrineDeLaCarte(vitrine, profiles.vitrineChoisie(profil), recompenses),
    // Un palier de carrière compte pour son haut fait, pas pour trois.
    hautsFaits: new Set([...recompenses.keys()].filter(k => k.startsWith('hf:')).map(k => k.replace(/:[123]$/, ''))).size,
    prix: { eus: PRIX_INDIVIDUELS.filter(k => recompenses.has(k)).length, total: PRIX_INDIVIDUELS.length },
    ...(titre && { titre }),
    ...(resume && resume.joues > 0 && { jour: resume }),
    ...(duels && { duels: { ligue: duels.ligue, cote: duels.cote } }),
    // Absente tant qu'il n'y a rien gagné : l'absence, pas « 0 ».
    ...(campagne && (campagne.justes > 0 || paliersValides > 0) && { campagne: { record: campagne.record, justes: campagne.justes, paliers: paliersValides } }),
    ...(ecussons.length > 0 && { ecussons }),
    ...(savoir.length > 0 && { savoir }),
    ...(Object.keys(sentiers).length > 0 && { sentiers }),
    ...(fond && { fond }),
    ...(compagnon && { compagnon }),
    fiche: {
      soirees: fiche.soirees,
      precision: fiche.precision,
      qcm: fiche.qcm,
      justes: fiche.justes,
      coupDOeil: fiche.coupDOeil,
      estimationsComparees: fiche.estimationsComparees,
      reflexeMoyenMs: fiche.reflexeMoyenMs,
      quizGagnes: fiche.quizGagnes,
      meilleureSerie: fiche.meilleureSerie,
    },
  }
  return { profil: sonProfil, ...(bordure && { bordure }) }
}
