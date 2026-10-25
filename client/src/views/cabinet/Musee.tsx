import type { ReactNode } from 'react'
import { Dessin } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { GrosBouton, PieceTete, Sortie } from '../../components/Pieces'
import { CARTES_PEINTES } from '../../components/cartes-peintes'
import { espacesFines, formatNumber } from '../../format'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import { poussieresDites } from '../../../../shared/cabinet/musee'
import { OEUVRES, RARETES } from '../../../../shared/cabinet/oeuvres'
import { GARDIENS, salleDuGardien } from '../../../../shared/cabinet/salles'
import type { OeuvreVue, PageDuCabinet, SalleVue } from '../../../../shared/cabinet/vues'
import { adresseDe } from './ecrans'

// Le musée : l'entrée du Cabinet (la maquette jouable, `retours/2026-10-24/
// maquette/`). Ce qu'il possède en une ligne, ce qui l'attend aujourd'hui — la
// partie en cours d'abord, puis la visite du jour —, le gardien le plus
// proche, les neuf salles en portes, les gardiens, les jeux libres. Pas un
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
  accueil,
  onRegles,
  onReprendre,
  onLu,
}: {
  page: PageDuCabinet
  /** Ce que le musée ne dit qu'une fois : la bienvenue, tant que les règles ne sont pas lues ; les œuvres rapportées déjà annoncées. */
  accueil: { bienvenue: boolean; rapportees: number }
  onRegles: () => void
  onReprendre: () => void
  onLu: (quoi: 'bienvenue' | 'rapportees') => void
}) {
  const oeuvres = page.salles.reduce((n, s) => n + possedeesDe(s), 0)
  const reveilles = page.gardiens.tous.filter(g => g.reveille).length
  const visite = page.visite.cases
  const faites = visite.filter(c => c.faite).length
  const prochain = page.gardiens.prochain
  const salleDuProchain = prochain && salleDuGardien(prochain.legendaire)
  const rapportees = page.rapportees > accueil.rapportees ? page.rapportees : 0
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

      {accueil.bienvenue && (
        <Bandeau
          icone={<Icon name="landmark" />}
          geste={
            <span className="cab-gestes">
              <button type="button" className="btn btn-primary" onClick={onRegles}>
                Comment ça marche ?
              </button>
              <button type="button" className="btn" onClick={() => onLu('bienvenue')}>
                C’est parti
              </button>
            </span>
          }
        >
          <b>Bienvenue au Cabinet.</b>
          <span>{espacesFines('Chaque œuvre peinte se gagne en jouant à de petits jeux de deux minutes : remplis tes salles, réveille leurs gardiens.')}</span>
        </Bandeau>
      )}
      {rapportees > 0 && (
        <Bandeau
          icone={<Icon name="flag" />}
          geste={
            <button type="button" className="btn" onClick={() => onLu('rapportees')}>
              Compris
            </button>
          }
        >
          <span>{espacesFines(`Tu as rapporté ${compte(rapportees, 'œuvre')} de l’Expédition : elles t’attendent dans leurs salles.`)}</span>
        </Bandeau>
      )}
      {page.expedition === 'en-route' && (
        <Bandeau icone={<Icon name="flag" />}>
          <a className="cab-lien" href="/expedition">
            {espacesFines('Ton expédition t’attend : la finir')}
          </a>
        </Bandeau>
      )}
      {page.fete && (
        <Bandeau icone={page.fete.gardien ? <span className="cab-medaillon cab-medaillon-petit"><Dessin cle={page.fete.gardien.legendaire} verrouille /></span> : <Icon name="calendar" />}>
          <b>{page.fete.nom}</b>
          {page.fete.gardien && <span>{espacesFines(page.fete.gardien.dit)}</span>}
        </Bandeau>
      )}
      {/* Un seul jour, déjà joué, n'est pas encore une série à garder : la ligne attendait le musée de qui venait d'arriver. */}
      {page.serie.jours > 0 && (page.serie.jours > 1 || page.serie.aJouer) && (
        <Bandeau icone={<b className="cab-chiffre">{page.serie.jours}</b>}>
          <span>
            {espacesFines(
              `${compte(page.serie.jours, 'jour')} de visite d’affilée.${page.serie.aJouer ? ' Joue aujourd’hui pour garder ta série.' : ''}`,
            )}
          </span>
        </Bandeau>
      )}

      {/* Une partie à la fois : celle qui l'attend passe devant tout, dans les mots du refus d'un second départ
          (`cadreDuDepart`) — « Ta partie au Pari t'attend ». */}
      {enCours && (
        <GrosBouton
          principal
          icone={<Icon name="play" />}
          titre={espacesFines(`Ta partie ${JEUX[enCours.jeu].a} t’attend`)}
          detail="Reprends-la où tu l’as laissée"
          onClick={onReprendre}
        />
      )}
      <GrosBouton
        principal={!enCours && faites < visite.length}
        icone={<Icon name="sun" />}
        titre="La visite du jour"
        detail={
          faites === visite.length
            ? espacesFines('Faite : reviens demain, ou pars à la chasse dans une salle')
            : espacesFines(`${compte(visite.length, 'partie')} de deux minutes · ${faites} sur ${visite.length} faite${faites > 1 ? 's' : ''}`)
        }
        pastille={faites < visite.length ? 'À jouer' : undefined}
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
