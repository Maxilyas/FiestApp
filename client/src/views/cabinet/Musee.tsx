import type { ReactNode } from 'react'
import { Dessin } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { GrosBouton, PieceTete, Sortie } from '../../components/Pieces'
import { CARTES_PEINTES } from '../../components/cartes-peintes'
import { espacesFines, formatNumber } from '../../format'
import { laPartieAttend, poussieresDites } from '../../../../shared/cabinet/musee'
import { OEUVRES, RARETES } from '../../../../shared/cabinet/oeuvres'
import { GARDIENS, salleDuGardien } from '../../../../shared/cabinet/salles'
import { visiteAJouer, type CaseVue, type OeuvreVue, type PageDuCabinet, type SalleVue, type VueDeLaPartie } from '../../../../shared/cabinet/vues'
import { adresseDe } from './ecrans'
import { TaPartieTAttend } from './PartieQuiAttend'

// Le musée : l'entrée du Cabinet (la maquette jouable, `retours/2026-10-24/
// maquette/`). Ce qu'il possède en une ligne, ce qui l'attend aujourd'hui — la
// partie en cours d'abord, puis la visite du jour —, le gardien le plus
// proche, les neuf salles en portes, les gardiens, tes murs, les jeux libres. Pas un
// paragraphe de règle : « Comment ça marche ? » les dit (règle `cabinet.md`,
// la leçon de l'Expédition). Ce que la page montre vient de la vue du serveur
// (`PageDuCabinet`), jamais d'une règle recopiée.

/** « 5 œuvres », « 1 gardien » : le nombre ne quitte pas son mot à la ligne. */
export const compte = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`

/** Une phrase du catalogue après deux-points : « Éclairer : un indice… », pas « Éclairer : Un indice… ». */
export const apresDeuxPoints = (phrase: string) => phrase.replace(/^./, c => c.toLowerCase())

/** Une ligne qui commence par un morceau du catalogue écrit pour suivre une phrase : « Garder ★ · parier et réussir ★★★ ». */
export const enDebutDeLigne = (phrase: string) => phrase.replace(/^./, c => c.toUpperCase())

/** Les œuvres qu'il a dans une salle. */
export const possedeesDe = (s: SalleVue) => s.oeuvres.filter(o => o.possedee).length

/**
 * La partie qui attend, dans les mots du serveur (`laPartieAttend`) : tant
 * qu'elle n'est pas finie, rien ne part ni ne se dépense — le premier refus du
 * départ (`cadreDuDepart`) et de la dépense (`refusDeLAchat`). Chaque écran qui
 * fait partir ou dépenser en éteint ses gestes, et le dit une fois ; null :
 * rien n'attend.
 */
export const laPartieQuiAttend = (page: PageDuCabinet): string | null => (page.enCours ? laPartieAttend(page.enCours.jeu) : null)

/**
 * La case de la partie qui attend : commencée sans issue, quand c'est une
 * partie de la visite qui attend — la vue de la partie ne dit pas sa case, et
 * une seule partie attend à la fois. Le serveur la dit faite dès son départ
 * (`caseCommencee` : elle ne se rejoue pas) ; la visite l'écrivait
 * « Commencée », la comptait faite, et ne la reprenait pas — la partie
 * rechargée se croyait perdue (la tablée du 25 octobre 2026).
 */
export const caseEnCours = (c: Pick<CaseVue, 'faite' | 'issue'>, enCours: Pick<VueDeLaPartie, 'origine'> | null): boolean =>
  enCours?.origine === 'visite' && c.faite && c.issue === undefined

/** Les cases faites, au musée comme à la visite : la case en cours ne l'est pas tant qu'elle n'est pas finie. */
export const casesFaites = (page: Pick<PageDuCabinet, 'visite' | 'enCours'>): number =>
  page.visite.cases.filter(c => c.faite && !caseEnCours(c, page.enCours)).length

/**
 * La plus rare des œuvres qu'il a dans une salle, à l'ordre des raretés
 * (`RARETES`) — jamais au rang du mur : le Vestibule range ses épiques avant
 * ses maudites, et la dernière possédée y montrait une maudite à qui avait
 * une épique. À rareté égale, la première au mur.
 */
export const laPlusRare = (s: SalleVue): OeuvreVue | undefined =>
  s.oeuvres.reduce<OeuvreVue | undefined>((belle, o) => (o.possedee && (!belle || RARETES.indexOf(o.rarete) > RARETES.indexOf(belle.rarete)) ? o : belle), undefined)

/**
 * La porte d'une salle : en arche, la plus rare de ses œuvres à lui, sinon
 * rien qu'un « ? » : une peinture qu'il n'a pas ne se montre pas, il la
 * découvrira en la gagnant.
 */
function Porte({ salle }: { salle: SalleVue }) {
  const n = possedeesDe(salle)
  const belle = laPlusRare(salle)
  const peinture = belle && CARTES_PEINTES[belle.cle]
  return (
    <a className={'cab-porte' + (salle.complete ? ' cab-complete' : '')} href={adresseDe({ e: 'salle', salle: salle.cle })}>
      <span className="cab-arche" aria-hidden="true">
        {peinture ? <img src={peinture[1]} alt="" loading="lazy" decoding="async" /> : <span className="cab-inconnue">?</span>}
      </span>
      <b className="cab-porte-nom">{salle.nom}</b>
      <span className="cab-compte">
        {n} sur {salle.oeuvres.length}
        {salle.complete && <span className="sr-only">, complète</span>}
      </span>
    </a>
  )
}

/** Une ligne du musée qui se dit une fois, ou tant qu'elle vaut : la bienvenue, ce qui l'attend, sa fête, sa série. */
function Bandeau({ icone, children, geste }: { icone: ReactNode; children: ReactNode; geste?: ReactNode }) {
  return (
    <div className="cab-bandeau" role="note">
      <span className="cab-bandeau-icone" aria-hidden="true">
        {icone}
      </span>
      <div className="cab-bandeau-texte">
        {children}
        {geste}
      </div>
    </div>
  )
}

export function Musee({
  page,
  bienvenue,
  onRegles,
  onReprendre,
  onBienvenueLue,
}: {
  page: PageDuCabinet
  /** Ce que le musée ne dit qu'une fois : la bienvenue, tant que les règles ne sont pas lues. */
  bienvenue: boolean
  onRegles: () => void
  onReprendre: () => void
  onBienvenueLue: () => void
}) {
  const oeuvres = page.salles.reduce((n, s) => n + possedeesDe(s), 0)
  const reveilles = page.gardiens.tous.filter(g => g.reveille).length
  const visite = page.visite.cases
  // La case en cours n'est pas faite tant qu'elle n'a pas d'issue : « 1 sur 3 faite » laissait croire la partie rechargée perdue.
  const faites = casesFaites(page)
  // « À jouer » par la règle de l'accueil : une case d'un jeu pas encore livré n'attend que si l'échange peut la changer.
  const aJouer = visiteAJouer(page.visite)
  const prochain = page.gardiens.prochain
  const salleDuProchain = prochain && salleDuGardien(prochain.legendaire)
  const enCours = page.enCours
  return (
    <div className="player-shell cab-page">
      <Sortie />
      <PieceTete piece="Le Cabinet de curiosités" titre="Ton musée" />
      <div className="cab-possede">
        <p className="cab-ligne">
          {compte(oeuvres, 'œuvre')} sur {OEUVRES.length} · {compte(reveilles, 'gardien')} sur {GARDIENS.length}
        </p>
        <span className="cab-jauge" aria-hidden="true">
          <span style={{ width: `${Math.round((100 * oeuvres) / OEUVRES.length)}%` }} />
        </span>
        <p className="cab-poussiere">
          <Icon name="sparkles" />
          {poussieresDites(page.poussiere)}
        </p>
      </div>

      {bienvenue && (
        <Bandeau
          icone={<Icon name="landmark" />}
          geste={
            <span className="cab-gestes">
              <button type="button" className="btn btn-primary" onClick={onRegles}>
                Comment ça marche ?
              </button>
              <button type="button" className="btn" onClick={onBienvenueLue}>
                C’est parti
              </button>
            </span>
          }
        >
          <b>Bienvenue au Cabinet.</b>
          {/* « De quelques minutes » : le Mot en donne deux par manche, six au plus, et « deux minutes » se lisait comme une promesse
              (Ophélie, à la tablée du 26 octobre 2026) : 53 parties sur 54 la tenaient, pas toutes. */}
          <span>{espacesFines('Chaque œuvre peinte se gagne en jouant à de petits jeux de quelques minutes : remplis tes salles, réveille leurs gardiens.')}</span>
        </Bandeau>
      )}
      {/* Une expédition en route se finit à ses règles, sans rien rapporter au Cabinet : tout le monde y commence avec ses quatre
          œuvres offertes (le choix du propriétaire du 25 octobre 2026). */}
      {page.expedition === 'en-route' && (
        <Bandeau icone={<Icon name="flag" />}>
          <a className="cab-lien" href="/expedition">
            {espacesFines('Ton expédition t’attend : la finir')}
          </a>
        </Bandeau>
      )}
      {/* La fête ne se dit qu'avec ce qu'elle promet : son gardien réveillé, il ne restait que « Halloween » et une icône — cinq
          joueurs sur six l'ont relevé (la tablée du 25 octobre 2026). */}
      {page.fete?.gardien && (
        <Bandeau
          icone={
            <span className="cab-medaillon cab-medaillon-petit">
              <Dessin cle={page.fete.gardien.legendaire} verrouille />
            </span>
          }
        >
          <b>{page.fete.nom}</b>
          <span>{espacesFines(page.fete.gardien.dit)}</span>
        </Bandeau>
      )}
      {/* Un seul jour, déjà joué, n'est pas encore une série à garder : la ligne attendait le musée de qui venait d'arriver.
          « Réponds à une manche » : un jour ne compte qu'à sa première manche répondue (`jourCompte`) — « Joue aujourd'hui » laissait
          croire qu'une visite commencée puis quittée la gardait. La visite le dit des mêmes mots (`Visite.tsx`). */}
      {page.serie.jours > 0 && (page.serie.jours > 1 || page.serie.aJouer) && (
        <Bandeau icone={<b className="cab-chiffre">{page.serie.jours}</b>}>
          <span>
            {espacesFines(
              `${compte(page.serie.jours, 'jour')} de visite d’affilée.${page.serie.aJouer ? ' Réponds à une manche aujourd’hui pour garder ta série.' : ''}`,
            )}
          </span>
        </Bandeau>
      )}

      {/* Une partie à la fois : celle qui l'attend passe devant tout, dans les mots du refus d'un second départ
          (`cadreDuDepart`) — « Ta partie au Pari t'attend ». */}
      {enCours && <TaPartieTAttend jeu={enCours.jeu} onReprendre={onReprendre} />}
      <GrosBouton
        principal={!enCours && aJouer}
        icone={<Icon name="sun" />}
        titre="La visite du jour"
        detail={
          // Faite, la chasse ne se propose que s'il en reste une : sans chasse, elle promettait ce que la salle refusait (Lucas).
          faites === visite.length
            ? espacesFines(page.chasses.restent > 0 ? 'Faite : reviens demain, ou pars à la chasse dans une salle' : 'Faite : reviens demain')
            : // « Petites », sans durée : « de deux minutes » se lisait comme une promesse (la bienvenue le dit plus haut), et « de
              // quelques minutes » couchait la ligne sur trois en 360, à côté de « À jouer ».
              espacesFines(`${compte(visite.length, 'petite partie', 'petites parties')} · ${faites} sur ${visite.length} faite${faites > 1 ? 's' : ''}`)
        }
        pastille={aJouer ? 'À jouer' : undefined}
        href={adresseDe({ e: 'visite' })}
      />
      {prochain && (
        <a className="cab-tuile" href={salleDuProchain ? adresseDe({ e: 'salle', salle: salleDuProchain }) : adresseDe({ e: 'gardiens' })}>
          <span className="cab-medaillon" aria-hidden="true">
            <Dessin cle={prochain.legendaire} verrouille />
          </span>
          <span className="cab-tuile-texte">
            <span className="cab-surtitre">Le prochain gardien</span>
            <span>{espacesFines(prochain.dit)}</span>
          </span>
        </a>
      )}

      <section className="cab-salles" aria-labelledby="cab-les-salles">
        <div className="cab-entre">
          <h2 id="cab-les-salles">Les salles</h2>
          <span className="cab-compte">{espacesFines(`${compte(page.chasses.restent, 'chasse')} aujourd’hui`)}</span>
        </div>
        <div className="cab-portes">
          {page.salles.map(s => (
            <Porte key={s.cle} salle={s} />
          ))}
        </div>
      </section>

      <GrosBouton icone={<Icon name="crown" />} titre="Les gardiens" detail={`${reveilles} sur ${GARDIENS.length} réveillés`} href={adresseDe({ e: 'gardiens' })} />
      {/* Ce qu'il a appris, à sa place : seules les règles y menaient, d'un lien au milieu d'un paragraphe. Les murs se demandent
          à l'ouverture de leur écran : le bouton n'en dit pas le compte, que la page du musée n'a pas. */}
      <GrosBouton
        icone={<Icon name="repere" />}
        titre="Tes murs"
        detail={espacesFines('Les lieux et les dates que tes parties t’ont appris')}
        href={adresseDe({ e: 'murs' })}
      />
      <GrosBouton
        icone={<Icon name="dice" />}
        titre="Jouer librement"
        detail={espacesFines(page.libres.paientEncore > 0 ? 'Autant que tu veux, sans œuvre en jeu' : 'Pour le plaisir, jusqu’à minuit')}
        href={adresseDe({ e: 'libre' })}
      />
      <button type="button" className="btn btn-block cab-comment" onClick={onRegles}>
        <Icon name="help" />
        Comment ça marche ?
      </button>
    </div>
  )
}
