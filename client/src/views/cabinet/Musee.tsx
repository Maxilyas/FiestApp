import type { ReactNode } from 'react'
import { Dessin } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { PieceTete } from '../../components/Pieces'
import { CARTES_PEINTES } from '../../components/cartes-peintes'
import { espacesFines, formatNumber } from '../../format'
import { ORDRE_DE_LA_TOUR } from '../../../../shared/cabinet/montee'
import { laPartieAttend, poussieresDites } from '../../../../shared/cabinet/musee'
import { OEUVRES, RARETES } from '../../../../shared/cabinet/oeuvres'
import { GARDIENS, GARDIENS_DES_SALLES, salleDuGardien } from '../../../../shared/cabinet/salles'
import type { CaseVue, OeuvreVue, PageDuCabinet, SalleVue, VueDeLaPartie } from '../../../../shared/cabinet/vues'
import { adresseDe } from './ecrans'
import { TaPartieTAttend } from './PartieQuiAttend'

// Ton musée : ta collection, et rien d'autre — une pièce de la barre
// (`Barre.tsx`). L'entrée du Cabinet jusqu'au 31 octobre 2026, il disait dix
// choses à la fois — ce qu'il possède, la bienvenue, la série, la visite du
// jour, le prochain gardien, les salles, les gardiens, tes murs, les jeux
// libres, les règles —, et le propriétaire l'a trouvé « incompréhensible » :
// la tour est l'entrée, « Jouer » a pris la visite, les jeux libres, tes murs
// et les règles. Il reste ce qu'il possède en une ligne, ce qui l'attend, le
// prochain gardien, et les neuf salles en murs de tableaux : ses peintures, la
// plus rare d'abord, et des cadres vides — une peinture qu'il n'a pas ne se
// montre jamais, il la découvrira en la gagnant. Ce que la page montre vient
// de la vue du serveur (`PageDuCabinet`), jamais d'une règle recopiée.

/** « 5 œuvres », « 1 gardien » : le nombre ne quitte pas son mot à la ligne. */
export const compte = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)} ${n > 1 ? motPluriel : mot}`

/** Une phrase du catalogue après deux-points : « Éclairer : un indice… », pas « Éclairer : Un indice… ». */
export const apresDeuxPoints = (phrase: string) => phrase.replace(/^./, c => c.toLowerCase())

/** Une ligne qui commence par un morceau du catalogue écrit pour suivre une phrase : « Garder ★ · parier et réussir ★★★ ». */
export const enDebutDeLigne = (phrase: string) => phrase.replace(/^./, c => c.toUpperCase())

/** Les œuvres qu'il a dans une salle. */
export const possedeesDe = (s: SalleVue) => s.oeuvres.filter(o => o.possedee).length

/**
 * Les salles dans l'ordre des étages de la tour (`ORDRE_DE_LA_TOUR`), le Vestibule d'abord : la salle d'un étage est celle du
 * musée qu'il remplit, au même rang — dans l'ordre de la vue, le Vestibule, l'étage 1, venait en dernier. Une salle que l'ordre
 * ne connaîtrait pas suit.
 */
export const sallesDansLOrdreDeLaTour = (page: Pick<PageDuCabinet, 'salles'>): SalleVue[] => {
  const rang = (s: SalleVue) => {
    const k = ORDRE_DE_LA_TOUR.indexOf(s.cle)
    return k < 0 ? ORDRE_DE_LA_TOUR.length : k
  }
  return [...page.salles].sort((a, b) => rang(a) - rang(b))
}

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
 * Ce que la cimaise d'une salle montre au musée, en une rangée de cinq qui tient en 360 de large : ses peintures, la plus rare
 * d'abord — à rareté égale, l'ordre du mur —, puis des cadres vides, et ce qui reste en compte (« +5 »), la cinquième place.
 */
export function tableauxDuMur(s: SalleVue, places = 4): { siennes: OeuvreVue[]; vides: number; reste: number } {
  const rang = (o: OeuvreVue) => RARETES.indexOf(o.rarete)
  const siennes = s.oeuvres.filter(o => o.possedee).sort((a, b) => rang(b) - rang(a)).slice(0, places)
  const vides = Math.min(places - siennes.length, s.oeuvres.length - possedeesDe(s))
  return { siennes, vides, reste: s.oeuvres.length - siennes.length - vides }
}

/**
 * Une salle, en mur de tableaux : son gardien en médaillon — en couleur s'il veille —, son nom, ce qu'il en a, et la rangée de
 * ses peintures. Une salle dont il n'a rien ne montre que des cadres vides.
 */
function Porte({ salle, veille }: { salle: SalleVue; veille: boolean }) {
  const n = possedeesDe(salle)
  const { siennes, vides, reste } = tableauxDuMur(salle)
  return (
    <a className={'cab-porte' + (salle.complete ? ' cab-complete' : '')} href={adresseDe({ e: 'salle', salle: salle.cle })}>
      <span className="cab-porte-haut">
        <span className="cab-medaillon cab-medaillon-petit" aria-hidden="true">
          <Dessin cle={GARDIENS_DES_SALLES[salle.cle][0]} verrouille={!veille} />
        </span>
        <b className="cab-porte-nom">{salle.nom}</b>
        <span className="cab-compte">
          {n} sur {salle.oeuvres.length}
          {salle.complete && <span className="sr-only">, complète</span>}
        </span>
      </span>
      {/* La cimaise : le mur d'une salle (`.cab-mur`) a déjà ce nom. */}
      <span className="cab-cimaise" aria-hidden="true">
        {siennes.map(o => {
          const peinture = CARTES_PEINTES[o.cle]
          return (
            <span key={o.cle} className="cab-toile">
              {peinture && <img src={peinture[1]} alt="" loading="lazy" decoding="async" />}
            </span>
          )
        })}
        {Array.from({ length: vides }, (_, k) => (
          <span key={k} className="cab-toile cab-toile-vide">
            ?
          </span>
        ))}
        {reste > 0 && <span className="cab-toile cab-toile-reste">{`+${reste}`}</span>}
      </span>
    </a>
  )
}

/** Une ligne qui se dit tant qu'elle vaut : sa fête, sa série, l'expédition qui l'attend. */
export function Bandeau({ icone, children, geste }: { icone: ReactNode; children: ReactNode; geste?: ReactNode }) {
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

export function Musee({ page, onReprendre }: { page: PageDuCabinet; onReprendre: () => void }) {
  const oeuvres = page.salles.reduce((n, s) => n + possedeesDe(s), 0)
  const reveilles = page.gardiens.tous.filter(g => g.reveille).length
  const prochain = page.gardiens.prochain
  const salleDuProchain = prochain && salleDuGardien(prochain.legendaire)
  const enCours = page.enCours
  const veille = (legendaire: string) => page.gardiens.tous.some(g => g.legendaire === legendaire && g.reveille)
  return (
    <div className="player-shell cab-page cab-musee">
      <PieceTete piece="Le Cabinet de curiosités" titre="Ton musée" />
      {/* Deux chiffres en grand, ce qu'il a : la ligne « 12 œuvres sur 84 · 3 gardiens sur 23 » se lisait comme une règle. */}
      <div className="cab-possede">
        <div className="cab-possede-chiffres">
          <p>
            <b className="cab-chiffre">{formatNumber(oeuvres)}</b> {oeuvres > 1 ? 'œuvres' : 'œuvre'} sur {OEUVRES.length}
          </p>
          <p>
            <b className="cab-chiffre">{formatNumber(reveilles)}</b> {reveilles > 1 ? 'gardiens' : 'gardien'} sur {GARDIENS.length}
          </p>
        </div>
        <span className="cab-jauge" aria-hidden="true">
          <span style={{ width: `${Math.round((100 * oeuvres) / OEUVRES.length)}%` }} />
        </span>
        <p className="cab-poussiere">
          <Icon name="sparkles" />
          {poussieresDites(page.poussiere)}
        </p>
      </div>

      {/* Une partie à la fois : celle qui l'attend passe devant tout, dans les mots du refus d'un second départ (`cadreDuDepart`). */}
      {enCours && <TaPartieTAttend jeu={enCours.jeu} onReprendre={onReprendre} />}
      {/* Une expédition en route se finit à ses règles, sans rien rapporter au Cabinet (le choix du propriétaire du 25 octobre 2026). */}
      {page.expedition === 'en-route' && (
        <Bandeau icone={<Icon name="flag" />}>
          <a className="cab-lien" href="/expedition">
            {espacesFines('Ton expédition t’attend : la finir')}
          </a>
        </Bandeau>
      )}
      {/* La fête ne se dit qu'avec ce qu'elle promet : son gardien réveillé, il ne restait que « Halloween » et une icône. */}
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
        <h2 id="cab-les-salles">Les salles</h2>
        <div className="cab-portes">
          {sallesDansLOrdreDeLaTour(page).map(s => (
            <Porte key={s.cle} salle={s} veille={veille(GARDIENS_DES_SALLES[s.cle][0])} />
          ))}
        </div>
      </section>
    </div>
  )
}
