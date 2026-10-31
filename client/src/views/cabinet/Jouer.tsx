import { Icon } from '../../components/Icon'
import { GrosBouton, PieceTete } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { visiteAJouer, type PageDuCabinet } from '../../../../shared/cabinet/vues'
import { adresseDe } from './ecrans'
import { Bandeau, casesFaites, compte } from './Musee'
import { TaPartieTAttend } from './PartieQuiAttend'

// « Jouer » : ce que le musée disait en plus de ses salles — la visite du
// jour, les jeux libres, tes murs, la série, les chasses, les règles —, sur sa
// page à lui, une pièce de la barre (`Barre.tsx`). Le musée était
// « incompréhensible » (le propriétaire, le 31 octobre 2026) : dix choses à la
// fois, dont deux seulement disaient ce qu'il possède. Ici, trois gros boutons
// et une ligne ; « Comment ça marche ? » au bout.

export function Jouer({ page, onRegles, onReprendre }: { page: PageDuCabinet; onRegles: () => void; onReprendre: () => void }) {
  const visite = page.visite.cases
  // La case en cours n'est pas faite tant qu'elle n'a pas d'issue : « 1 sur 3 faite » laissait croire la partie rechargée perdue.
  const faites = casesFaites(page)
  // « À jouer » par la règle de l'accueil : une case d'un jeu pas encore livré n'attend que si l'échange peut la changer.
  const aJouer = visiteAJouer(page.visite)
  const enCours = page.enCours
  return (
    <div className="player-shell cab-page">
      <PieceTete piece="Le Cabinet de curiosités" titre="Jouer" />
      {enCours && <TaPartieTAttend jeu={enCours.jeu} onReprendre={onReprendre} />}
      {/* Un seul jour, déjà joué, n'est pas encore une série à garder. « Réponds à une manche » : un jour ne compte qu'à sa première
          manche répondue (`jourCompte`) — « Joue aujourd'hui » laissait croire qu'une visite commencée puis quittée la gardait. */}
      {page.serie.jours > 0 && (page.serie.jours > 1 || page.serie.aJouer) && (
        <Bandeau icone={<b className="cab-chiffre">{page.serie.jours}</b>}>
          <span>
            {espacesFines(
              `${compte(page.serie.jours, 'jour')} de visite d’affilée.${page.serie.aJouer ? ' Réponds à une manche aujourd’hui pour garder ta série.' : ''}`,
            )}
          </span>
        </Bandeau>
      )}
      <GrosBouton
        principal={!enCours && aJouer}
        icone={<Icon name="sun" />}
        titre="La visite du jour"
        detail={
          // Faite, la chasse ne se propose que s'il en reste une : sans chasse, elle promettait ce que la salle refusait (Lucas).
          faites === visite.length
            ? espacesFines(page.chasses.restent > 0 ? 'Faite : reviens demain, ou pars à la chasse dans une salle' : 'Faite : reviens demain')
            : espacesFines(`${compte(visite.length, 'petite partie', 'petites parties')} · ${faites} sur ${visite.length} faite${faites > 1 ? 's' : ''}`)
        }
        pastille={aJouer ? 'À jouer' : undefined}
        href={adresseDe({ e: 'visite' })}
      />
      <GrosBouton
        icone={<Icon name="dice" />}
        titre="Jouer librement"
        detail={espacesFines(page.libres.paientEncore > 0 ? 'Autant que tu veux, sans œuvre en jeu' : 'Pour le plaisir, jusqu’à minuit')}
        href={adresseDe({ e: 'libre' })}
      />
      {/* Ce qu'il a appris, à sa place : seules les règles y menaient, d'un lien au milieu d'un paragraphe. */}
      <GrosBouton icone={<Icon name="repere" />} titre="Tes murs" detail={espacesFines('Les lieux et les dates que tes parties t’ont appris')} href={adresseDe({ e: 'murs' })} />
      <p className="cab-ligne cab-compte">{espacesFines(`${compte(page.chasses.restent, 'chasse')} aujourd’hui : touche un cadre vide dans une salle.`)}</p>
      <button type="button" className="btn btn-block cab-comment" onClick={onRegles}>
        <Icon name="help" />
        Comment ça marche ?
      </button>
    </div>
  )
}
