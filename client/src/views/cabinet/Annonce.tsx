import { useEffect, useId, useState } from 'react'
import { Dessin } from '../../components/Avatar'
import { OeuvrePeinte, type OeuvreMontree } from '../../components/OeuvrePeinte'
import { Feuille, PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { ETOILES_D_UNE_PARTIE, ETOILES_DU_PARI, ETOILES_PAR_MANCHE, MANCHES_PAR_PARTIE } from '../../../../shared/cabinet/bareme'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import type { EnjeuDUneCase } from '../../../../shared/cabinet/musee'
import { ceQueFaitLaCarte, ditALAnnonce, forceDe, pouvoirDe, sertA, type CleDePouvoir, type Force } from '../../../../shared/cabinet/pouvoirs'
import type { PageDuCabinet, VueDeLaPartie } from '../../../../shared/cabinet/vues'
import { legendaire } from '../../../../shared/legendaires'
import { EnEtoiles } from './EnEtoiles'
import type { PartieDemandee } from './ecrans'
import { enDebutDeLigne, laPartieQuiAttend } from './Musee'
import { oeuvreDeLaPage } from './Oeuvre'
import { ecranDuJeu } from './Partie'
import { PartieQuiAttend } from './PartieQuiAttend'
import { oeuvreMontree } from './Salle'
import { dejaDoree, enJeuDit } from './Visite'

// L'annonce d'une partie (§ 2.2) : tout ce qu'elle montre, la page l'a déjà —
// le jeu, son geste, son barème dit (`JEUX`), ce qui est en jeu sans nommer
// l'œuvre d'une visite, le seuil que le serveur dit de la case (`CaseVue.seuil`
// — la page le redérivait du barème), le cadre doré, et la carte-bonus qu'il
// emporte avec ce qu'elle fait à ce jeu (`ceQueFaitLaCarte` : « Changer ne sert
// pas à la Frise ») et ce qui lui ôterait le cadre. Rien n'y est consommé :
// revenir au musée ne coûte ni visite ni chasse, tout part à « Commencer »
// (`POST /api/cabinet/partie`). La carte choisie se retient sur le téléphone,
// profil par profil (`retenu.ts`). Les règles qui comptent se disent ici, au
// moment où elles comptent : Théo a misé, fait 9 sur 9, et gagné l'œuvre sans
// cadre doré ; Camille ne savait pas qu'une case de la visite ne se joue
// qu'une fois (la tablée du 25 octobre 2026).
//
// L'écran du jeu se demande dès l'annonce (`ecranDuJeu`) : la première manche
// s'ouvre avec la réponse de « Commencer », son chrono déjà parti.

/** Ce qu'une partie demandée annonce : son jeu, d'où elle vient, ce qu'elle met en jeu, le seuil et la dorure. */
export interface CeQuElleAnnonce {
  jeu: CleDeJeu
  /** « La visite du jour », « Une chasse », « Partie libre ». */
  piece: string
  /** « Peut te faire gagner une œuvre rare de la salle du Devin », « Pour dorer Bastion » ; rien en partie libre. */
  enJeu: string | null
  /** Les étoiles qu'il faut pour gagner l'œuvre, celles que le serveur dit ; rien pour dorer, ni sans œuvre. */
  seuil: number | null
  /** Une œuvre à lui, à dorer : toutes ses manches parfaites, sans pouvoir. Son cadre déjà doré, il n'y a plus que le double. */
  dorer: boolean
  /**
   * Une case de la visite pour dorer : les étoiles qui font son double (`CaseVue.seuilDuDouble`) — sans le cadre doré, ou son cadre
   * déjà doré dans la journée (`dorer` faux).
   */
  double?: number
}

/**
 * Ce qu'une case annonce, lu dans la vue du serveur : son enjeu, jamais son
 * œuvre ; son seuil, ou pour dorer celui de son double — le serveur les dit
 * (`CaseVue.seuil`, `seuilDuDouble`), la page ne relit pas le barème. Une case
 * pour dorer dont l'œuvre a pris son cadre dans la journée ne promet plus que
 * le double (`dejaDoree`) : l'annonce disait « Pour la dorer », et la
 * carte-bonus ce qui ôterait un cadre déjà là.
 */
function laCase(c: PageDuCabinet['visite']['cases'][number], piece: string, page: PageDuCabinet): CeQuElleAnnonce {
  const doree = dejaDoree(page, c.enJeu)
  const pourDorer = 'pourDorer' in c.enJeu
  return {
    jeu: c.jeu,
    piece,
    enJeu: enJeuDit(c.enJeu, doree),
    seuil: 'rarete' in c.enJeu ? (c.seuil ?? null) : null,
    dorer: pourDorer && !doree,
    ...(pourDorer && c.seuilDuDouble !== undefined && { double: c.seuilDuDouble }),
  }
}

/**
 * Ce qu'annonce une partie demandée, lu dans la page : la case de la visite
 * dit son enjeu (jamais son œuvre), une chasse son cadre, « Retenter » l'enjeu
 * de sa case — la demande la vise, et le serveur seul sait l'œuvre —, une
 * partie libre son jeu. Null pour ce que la page ne montre plus — une case,
 * une œuvre, un jeu inconnus.
 */
export function annonceDe(page: PageDuCabinet, demande: PartieDemandee): CeQuElleAnnonce | null {
  switch (demande.origine) {
    case 'visite': {
      const c = page.visite.cases[demande.case]
      return c ? laCase(c, 'La visite du jour', page) : null
    }
    case 'chasse': {
      if ('retente' in demande) {
        const c = page.visite.cases[demande.case]
        // Une chasse au jeu de la case, pour l'œuvre qu'elle visait : à gagner, à son seuil — sans double, il n'y en a pas en chasse.
        return c ? { ...laCase(c, 'Une chasse', page), dorer: false } : null
      }
      const lue = oeuvreDeLaPage(page, demande.oeuvre)
      if (!lue) return null
      const o = lue.oeuvre
      return { jeu: o.jeu, piece: 'Une chasse', enJeu: o.possedee ? `Pour dorer ${o.nom}` : enJeuDit({ rarete: o.rarete, salle: lue.salle.cle }), seuil: o.possedee ? null : o.seuil, dorer: o.possedee }
    }
    case 'libre': {
      const jeu = CLES_DES_JEUX.find(j => j === demande.jeu)
      return jeu ? { jeu, piece: 'Partie libre', enJeu: null, seuil: null, dorer: false } : null
    }
  }
}

/**
 * La partie qui attend est-elle celle qu'on demandait ? « Commencer » dont la
 * réponse s'est perdue a pu la laisser commencée, son chrono parti : la page
 * relue la trouve. Une seule partie à la fois, que le serveur refuse de
 * doubler : la même origine et le même jeu suffisent à la reconnaître.
 */
export function estLaPartieDemandee(attend: Pick<VueDeLaPartie, 'origine' | 'jeu'>, demande: PartieDemandee, jeu: CleDeJeu): boolean {
  return attend.origine === demande.origine && attend.jeu === jeu
}

/** Une carte-bonus qu'il peut emporter : une œuvre à lui, les quatre de départ comprises, ou un gardien réveillé. */
export interface CarteBonus {
  cle: string
  nom: string
  pouvoir: CleDePouvoir
  force: Force
  /** Sa peinture ; un gardien n'en a pas, il montre son médaillon. */
  oeuvre?: OeuvreMontree
}

const ORDRE_DES_POUVOIRS: readonly CleDePouvoir[] = ['eclairer', 'proteger', 'temps', 'miser', 'changer']

/**
 * Les cartes-bonus qu'il a, lues dans la page : ses œuvres et ses gardiens
 * réveillés — par quelque voie que ce soit, jamais un Divin : la page ne
 * montre que les vingt-trois gardiens. Rangées par pouvoir, puis de la plus
 * forte à la plus faible, dans l'ordre du Cabinet à force égale.
 */
export function cartesBonusDe(page: PageDuCabinet): CarteBonus[] {
  const cartes: CarteBonus[] = []
  for (const g of page.gardiens.tous) {
    const force = forceDe(g.legendaire)
    if (g.reveille && force) cartes.push({ cle: g.legendaire, nom: legendaire(g.legendaire)?.nom ?? g.legendaire, pouvoir: g.pouvoir, force })
  }
  for (const s of page.salles) {
    for (const o of s.oeuvres) {
      const force = forceDe(o.cle)
      const pouvoir = pouvoirDe(o.cle)
      if (o.possedee && force && pouvoir) cartes.push({ cle: o.cle, nom: o.nom, pouvoir, force, oeuvre: oeuvreMontree(o, s.cle) })
    }
  }
  const rang = (c: CarteBonus) => ORDRE_DES_POUVOIRS.indexOf(c.pouvoir) * 10 - c.force
  // `sort` est stable : à pouvoir et force égaux, les gardiens d'abord, puis l'ordre des salles.
  return cartes.sort((a, b) => rang(a) - rang(b))
}

/**
 * Ce qui ôte le cadre doré, pouvoir par pouvoir (le cadre doré : toutes les
 * manches parfaites, sans qu'un pouvoir ait servi — `cadreDore`) : Éclairer,
 * Changer et Miser dès qu'on s'en sert ; Prendre son temps quand la réponse
 * arrive dans le temps qu'il donne en plus — emporté, il ne coûte rien.
 * Protéger ne relève qu'une manche imparfaite : le cadre était déjà perdu,
 * rien à en dire.
 */
const CE_QUI_OTE_LE_CADRE: Readonly<Record<CleDePouvoir, string | null>> = {
  eclairer: 'T’en servir ôte le cadre doré.',
  changer: 'T’en servir ôte le cadre doré.',
  miser: 'T’en servir ôte le cadre doré.',
  temps: 'Répondre dans le temps en plus ôte le cadre doré.',
  proteger: null,
}

/** « trois » : le nombre de manches d'une partie, en lettres. */
const EN_LETTRES: Readonly<Record<number, string>> = { 1: 'une', 2: 'deux', 3: 'trois', 4: 'quatre', 5: 'cinq' }

/**
 * Ce que demande le cadre doré à ce jeu : toutes ses manches parfaites — au
 * Pari, une manche parfaite ne se gagne qu'en pariant, garder n'en vaut que
 * deux (`ETOILES_DU_PARI`) : « trois paris gagnés ». Se dorer en gardant y
 * était impossible, et rien ne le disait (la tablée du 25 octobre 2026).
 */
function ceQueDemandeLeCadre(jeu: CleDeJeu): string {
  if (jeu === 'pari' && ETOILES_DU_PARI.garder < ETOILES_PAR_MANCHE) return `${EN_LETTRES[MANCHES_PAR_PARTIE] ?? MANCHES_PAR_PARTIE} paris gagnés`
  return 'toutes ses manches parfaites'
}

/**
 * Une carte-bonus en une ligne : sa peinture ou son médaillon, son nom, ce qu'elle fait à ce jeu — et, un cadre doré en jeu, ce qui
 * l'ôterait. Une carte qui ne sert pas à ce jeu (`sertA` : Changer à la Frise) ne dit que cela : ni ce qu'elle ferait, ni ce
 * qu'elle ôterait — l'annonce d'une chasse à la Frise, Échange emporté, disait « Changer ne sert pas à la Frise », puis
 * « T'en servir ôte le cadre doré » (la relecture du 26 octobre 2026). Sous la ligne de sa force, sa phrase moins ce qui ne
 * vaut qu'à un autre jeu (`ditALAnnonce`) : « au Pari, une manche gardée ne compte pas » se lisait sous Prudence à chaque jeu.
 */
function LigneDeCarte({ carte, jeu, detail = false, cadre = false }: { carte: CarteBonus; jeu: CleDeJeu; detail?: boolean; cadre?: boolean }) {
  const sert = sertA(carte.pouvoir, jeu)
  const oteLeCadre = cadre && sert ? CE_QUI_OTE_LE_CADRE[carte.pouvoir] : null
  return (
    <span className="cab-carte">
      <span className="cab-carte-vignette" aria-hidden="true">
        {carte.oeuvre ? (
          <OeuvrePeinte oeuvre={carte.oeuvre} taille="main" />
        ) : (
          <span className="cab-medaillon cab-medaillon-petit">
            <Dessin cle={carte.cle} />
          </span>
        )}
      </span>
      <span className="cab-carte-texte">
        <b className="cab-carte-nom">{carte.nom}</b>
        <span className="cab-ligne">{espacesFines(ceQueFaitLaCarte(carte.pouvoir, carte.force, jeu))}</span>
        {/* Éclairer se dit déjà jeu par jeu ; les autres disent ici ce qu'ils font, la mise surtout — avant une manche, sans l'avoir vue. */}
        {detail && sert && carte.pouvoir !== 'eclairer' && <span className="cab-raison">{espacesFines(ditALAnnonce(carte.pouvoir))}</span>}
        {detail && oteLeCadre && <span className="cab-raison">{espacesFines(oteLeCadre)}</span>}
      </span>
    </span>
  )
}

/** Le choix de la carte-bonus, dans sa feuille : « Sans carte-bonus », puis chacune ; un nom fixe, l'état par `aria-pressed`. */
export function ChoixDeLaCarte({ cartes, jeu, carte, onChoisir }: { cartes: readonly CarteBonus[]; jeu: CleDeJeu; carte: string | null; onChoisir: (cle: string | null) => void }) {
  return (
    <ul className="cab-cartes">
      <li>
        <button type="button" className="cab-choix-carte" aria-pressed={carte === null} onClick={() => onChoisir(null)}>
          <span className="cab-carte">
            <span className="cab-carte-vignette cab-sans-carte" aria-hidden="true">
              –
            </span>
            <span className="cab-carte-texte">
              <b className="cab-carte-nom">Sans carte-bonus</b>
              <span className="cab-ligne">Tu joues sans pouvoir.</span>
            </span>
          </span>
        </button>
      </li>
      {cartes.map(c => (
        <li key={c.cle}>
          <button type="button" className="cab-choix-carte" aria-pressed={carte === c.cle} onClick={() => onChoisir(c.cle)}>
            <LigneDeCarte carte={c} jeu={jeu} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Ce que la page dit sous « Commencer » : ce qui part avec lui, rien avant — et
 * qu'une case de la visite, ensuite, se joue une fois : manquée, elle est
 * faite, et seule son œuvre se retente, au même jeu, pour une chasse (rien à
 * retenter pour dorer ni pour la poussière d'or). L'annonce rassurait d'un
 * « Rien ne compte avant », et Camille a cru pouvoir rejouer sa case perdue.
 */
function avantDeCommencer(demande: PartieDemandee, enJeu: EnjeuDUneCase | undefined): string | null {
  if (demande.origine === 'libre') return null
  const rien = `Rien ne compte avant « Commencer » : revenir au musée ne coûte pas ${demande.origine === 'chasse' ? 'ta chasse' : 'ta partie de la visite'}.`
  if (demande.origine === 'chasse') return rien
  return `${rien} Ensuite, elle se joue une fois aujourd’hui${enJeu && 'rarete' in enJeu ? ' — manquée, son œuvre se retente au même jeu pour une chasse' : ''}.`
}

export function Annonce({
  page,
  demande,
  carte,
  busy,
  onCarte,
  onCommencer,
  onRetour,
  onReprendre,
}: {
  page: PageDuCabinet
  demande: PartieDemandee
  /** La carte-bonus retenue sur ce téléphone ; une carte qu'il n'a plus (un téléphone partagé) ne se propose pas. */
  carte: string | null
  busy: boolean
  onCarte: (cle: string | null) => void
  onCommencer: (carte: string | null) => void
  onRetour: () => void
  /** La partie qui attend, rouverte : « Commencer » s'éteint sous elle, « Reprendre » y ramène. */
  onReprendre?: () => void
}) {
  const [choisir, setChoisir] = useState(false)
  const idDeLAttente = useId()
  const a = annonceDe(page, demande)
  const jeu = a?.jeu
  useEffect(() => {
    if (jeu) ecranDuJeu(jeu)?.charger().catch(() => {})
  }, [jeu])
  const retour = <Sortie vers="Le Cabinet" href="/cabinet" onClick={onRetour} />
  if (!a) {
    return (
      <div className="player-shell cab-page">
        {retour}
        <p className="cab-ligne">{espacesFines('Cette partie n’est plus proposée : le musée te dit ce qui reste à jouer.')}</p>
      </div>
    )
  }
  const j = JEUX[a.jeu]
  const cartes = cartesBonusDe(page)
  const choisie = cartes.find(c => c.cle === carte) ?? null
  // Une partie qui attend — commencée d'un autre onglet, et que la page relue vient d'apprendre — : « Commencer » s'éteint, sa
  // raison dessous à la place de ce qu'il coûterait, comme les départs du musée (`laPartieQuiAttend`).
  const attend = laPartieQuiAttend(page)
  const avant = avantDeCommencer(demande, demande.origine === 'visite' ? page.visite.cases[demande.case]?.enJeu : undefined)
  // Un cadre doré en jeu : une œuvre à gagner, ou à dorer. Sans œuvre — en libre, pour la poussière d'or —, rien à perdre.
  const cadre = a.seuil !== null || a.dorer
  return (
    <div className="player-shell cab-page cab-annonce">
      {retour}
      <PieceTete piece={a.piece} titre={j.nom} />
      {a.enJeu && <p className="cab-enjeu">{espacesFines(a.enJeu)}</p>}
      <section className="cab-bloc" aria-label="Le jeu">
        <p className="cab-ligne">{espacesFines(j.geste)}</p>
        <p className="cab-ligne cab-bareme-annonce">
          <span className="cab-surtitre">{'Chaque manche '}</span>
          <EnEtoiles texte={espacesFines(enDebutDeLigne(j.bareme))} />
        </p>
        {j.avertissement && <p className="cab-ligne">{espacesFines(j.avertissement)}</p>}
      </section>
      {a.seuil !== null && (
        <>
          <p className="cab-ligne cab-seuil">
            Il faut{' '}
            <b>
              {a.seuil} étoiles sur {ETOILES_D_UNE_PARTIE}
            </b>{' '}
            pour la gagner.
          </p>
          <p className="cab-ligne">{espacesFines(`${enDebutDeLigne(ceQueDemandeLeCadre(a.jeu))}, sans qu’un pouvoir serve : son cadre doré.`)}</p>
        </>
      )}
      {a.dorer && <p className="cab-ligne cab-seuil">{espacesFines(`Pour la dorer : ${ceQueDemandeLeCadre(a.jeu)}, sans qu’un pouvoir ait servi.`)}</p>}
      {a.double !== undefined && (
        <p className="cab-ligne">
          {espacesFines(
            a.dorer
              ? `Sans cadre doré, ${a.double} étoiles sur ${ETOILES_D_UNE_PARTIE} font un double : sa poussière d’or en plus.`
              : `Son cadre est déjà doré : ${a.double} étoiles sur ${ETOILES_D_UNE_PARTIE} font un double, sa poussière d’or en plus.`,
          )}
        </p>
      )}
      <section className="cab-bloc" aria-labelledby="cab-ta-carte">
        <h2 id="cab-ta-carte">Ta carte-bonus</h2>
        {choisie ? <LigneDeCarte carte={choisie} jeu={a.jeu} detail cadre={cadre} /> : <p className="cab-ligne">{espacesFines('Sans carte-bonus : tu joues sans pouvoir.')}</p>}
        {cartes.length > 0 && (
          <button type="button" className="btn btn-block" onClick={() => setChoisir(true)}>
            {choisie ? 'Choisir une autre carte-bonus' : 'Choisir une carte-bonus'}
          </button>
        )}
      </section>
      <button
        type="button"
        className="btn btn-primary btn-big btn-block"
        aria-disabled={busy || attend !== null || undefined}
        aria-describedby={attend === null ? undefined : idDeLAttente}
        onClick={() => !busy && attend === null && onCommencer(choisie?.cle ?? null)}
      >
        Commencer
      </button>
      {attend ? <PartieQuiAttend page={page} id={idDeLAttente} onReprendre={onReprendre} /> : avant && <p className="cab-raison">{espacesFines(avant)}</p>}
      {choisir && (
        <Feuille titre="Ta carte-bonus" onFermer={() => setChoisir(false)} className="cab-feuille">
          <ChoixDeLaCarte
            cartes={cartes}
            jeu={a.jeu}
            carte={choisie?.cle ?? null}
            onChoisir={cle => {
              onCarte(cle)
              setChoisir(false)
            }}
          />
        </Feuille>
      )}
    </div>
  )
}
