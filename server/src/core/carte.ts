// La carte d'un joueur, du côté de son profil : son niveau, ses médaillons,
// sa vitrine, ses écussons, ses chiffres. La même en soirée, quand on touche
// son nom, et sur sa propre page (« Voir ma carte ») : la carte qu'il compose
// est celle que la salle verra.
import type { ProfileRec, ProfileStore } from '../auth/profiles'
import type { JourStore } from './jour'
import { PRIX_INDIVIDUELS } from './stats'
import type { CarteDeJoueur } from '../../../shared/carte'
import type { BadgePorte } from '../../../shared/badges'
import { ecussonsDe, plusBeauxEcussons } from '../../../shared/ecussons'
import { VITRINE_MAX, cleRangee, plusBeaux } from '../../../shared/hautsfaits'
import { ficheDe } from '../../../shared/profil'

/**
 * La vitrine d'une carte : les hauts faits qu'il a choisis, dans son ordre —
 * un haut fait de carrière à son plus haut palier, qui monte avec lui —, ou,
 * s'il n'a rien choisi, ses trois plus beaux (`plusBeaux`).
 */
export function vitrineDeLaCarte(etagere: BadgePorte[], choisie: string[] | null, recompenses: ReadonlyMap<string, number>): BadgePorte[] {
  if (!choisie) return plusBeaux(etagere, VITRINE_MAX)
  const parCle = new Map(etagere.map(b => [b.key, b]))
  return choisie.flatMap(cle => {
    const rangee = cleRangee(cle, recompenses)
    const badge = rangee ? parCle.get(rangee) : undefined
    return badge ? [badge] : []
  })
}

/** La moitié « profil » d'une carte. */
export async function profilDeCarte(
  profiles: ProfileStore,
  jour: Pick<JourStore, 'resumeDe' | 'categoriesDe'> | undefined,
  profil: ProfileRec,
): Promise<NonNullable<CarteDeJoueur['profil']>> {
  const [vitrine, carriere, resume, categoriesDuJour] = await Promise.all([
    profiles.badgesOf(profil.id),
    profiles.careerOf(profil.id),
    jour?.resumeDe(profil.id).catch(() => null),
    // Une base qui se tait ôte ses écussons du quiz du jour à la carte, pas la carte.
    jour?.categoriesDe(profil.id).catch(() => ({})) ?? {},
  ])
  const ecussons = plusBeauxEcussons(ecussonsDe(carriere.categories, categoriesDuJour)).map(e => ({
    categorie: e.categorie,
    palier: e.palier as 1 | 2 | 3,
  }))
  const fiche = ficheDe(carriere)
  const recompenses = profiles.recompensesOf(profil.id)
  const titre = profiles.titrePorte(profil)
  const fond = profiles.fondPorte(profil, carriere.jour)
  return {
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
    ...(ecussons.length > 0 && { ecussons }),
    ...(fond && { fond }),
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
}
