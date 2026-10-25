import { useEffect, useId, useState } from 'react'
import { Dessin } from '../../components/Avatar'
import { OeuvrePeinte, type OeuvreMontree } from '../../components/OeuvrePeinte'
import { Feuille, PieceTete, Sortie } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { ETOILES_D_UNE_PARTIE, SEUILS_DES_RARETES } from '../../../../shared/cabinet/bareme'
import { CLES_DES_JEUX, JEUX, type CleDeJeu } from '../../../../shared/cabinet/jeux/regle'
import { POUVOIRS, ceQueFaitLaCarte, forceDe, pouvoirDe, type CleDePouvoir, type Force } from '../../../../shared/cabinet/pouvoirs'
import type { PageDuCabinet, VueDeLaPartie } from '../../../../shared/cabinet/vues'
import { legendaire } from '../../../../shared/legendaires'
import type { PartieDemandee } from './ecrans'
import { enDebutDeLigne, laPartieQuiAttend } from './Musee'
import { oeuvreDeLaPage } from './Oeuvre'
import { ecranDuJeu } from './Partie'
import { oeuvreMontree } from './Salle'
import { enJeuDit } from './Visite'

// L'annonce d'une partie (§ 2.2) : tout ce qu'elle montre, la page l'a déjà —
// le jeu, son geste, son barème dit (`JEUX`), ce qui est en jeu sans nommer
// l'œuvre d'une visite, le seuil, et la carte-bonus qu'il emporte avec ce
// qu'elle fait à ce jeu (`ceQueFaitLaCarte` : « Changer ne sert pas à la
// Frise »). Rien n'y est consommé : revenir au musée ne coûte ni visite ni
// chasse, tout part à « Commencer » (`POST /api/cabinet/partie`). La carte
// choisie se retient sur le téléphone, profil par profil (`retenu.ts`).
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
  /** Les étoiles qu'il faut pour gagner l'œuvre, à sa rareté ; rien pour dorer, ni sans œuvre. */
  seuil: number | null
  /** Une œuvre à lui, à dorer : toutes ses manches parfaites, sans pouvoir. */
  dorer: boolean
}

/**
 * Ce qu'annonce une partie demandée, lu dans la page : la case de la visite
 * dit son enjeu (jamais son œuvre), une chasse son cadre, une partie libre son
 * jeu. Null pour ce que la page ne montre plus — une case, une œuvre, un jeu
 * inconnus.
 */
export function annonceDe(page: PageDuCabinet, demande: PartieDemandee): CeQuElleAnnonce | null {
  switch (demande.origine) {
    case 'visite': {
      const c = page.visite.cases[demande.case]
      if (!c) return null
      return { jeu: c.jeu, piece: 'La visite du jour', enJeu: enJeuDit(c.enJeu), seuil: 'rarete' in c.enJeu ? SEUILS_DES_RARETES[c.enJeu.rarete] : null, dorer: 'pourDorer' in c.enJeu }
    }
    case 'chasse': {
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

/** Une carte-bonus en une ligne : sa peinture ou son médaillon, son nom, ce qu'elle fait à ce jeu. */
function LigneDeCarte({ carte, jeu, detail = false }: { carte: CarteBonus; jeu: CleDeJeu; detail?: boolean }) {
  const pouvoir = POUVOIRS[carte.pouvoir]
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
        {detail && carte.pouvoir !== 'eclairer' && <span className="cab-raison">{espacesFines(pouvoir.dit)}</span>}
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

/** Ce que la page dit sous « Commencer » : ce qui part avec lui, rien avant. */
const avantDeCommencer = (demande: PartieDemandee): string | null =>
  demande.origine === 'libre' ? null : `Rien ne compte avant « Commencer » : revenir au musée ne coûte pas ${demande.origine === 'chasse' ? 'ta chasse' : 'ta partie de la visite'}.`

export function Annonce({
  page,
  demande,
  carte,
  busy,
  onCarte,
  onCommencer,
  onRetour,
}: {
  page: PageDuCabinet
  demande: PartieDemandee
  /** La carte-bonus retenue sur ce téléphone ; une carte qu'il n'a plus (un téléphone partagé) ne se propose pas. */
  carte: string | null
  busy: boolean
  onCarte: (cle: string | null) => void
  onCommencer: (carte: string | null) => void
  onRetour: () => void
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
  const avant = avantDeCommencer(demande)
  return (
    <div className="player-shell cab-page cab-annonce">
      {retour}
      <PieceTete piece={a.piece} titre={j.nom} />
      {a.enJeu && <p className="cab-enjeu">{espacesFines(a.enJeu)}</p>}
      <section className="cab-bloc" aria-label="Le jeu">
        <p className="cab-ligne">{espacesFines(j.geste)}</p>
        <p className="cab-ligne cab-bareme-annonce">
          <span className="cab-surtitre">{'Chaque manche '}</span>
          {espacesFines(enDebutDeLigne(j.bareme))}
        </p>
      </section>
      {a.seuil !== null && (
        <p className="cab-ligne cab-seuil">
          Il faut{' '}
          <b>
            {a.seuil} étoiles sur {ETOILES_D_UNE_PARTIE}
          </b>{' '}
          pour la gagner.
        </p>
      )}
      {a.dorer && <p className="cab-ligne cab-seuil">{espacesFines('Pour la dorer : toutes ses manches parfaites, sans qu’un pouvoir ait servi.')}</p>}
      <section className="cab-bloc" aria-labelledby="cab-ta-carte">
        <h2 id="cab-ta-carte">Ta carte-bonus</h2>
        {choisie ? <LigneDeCarte carte={choisie} jeu={a.jeu} detail /> : <p className="cab-ligne">{espacesFines('Sans carte-bonus : tu joues sans pouvoir.')}</p>}
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
      {attend ? (
        <p id={idDeLAttente} className="cab-raison">
          {espacesFines(attend)}
        </p>
      ) : (
        avant && <p className="cab-raison">{espacesFines(avant)}</p>
      )}
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
