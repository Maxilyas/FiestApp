import { useState } from 'react'
import { Etoiles } from '../../components/Etoiles'
import { APorter, CeQueTuGagnes, MissionsAccomplies, NouveauxTrophees, emojisAPorter, useNiveauRelu } from '../../components/Gains'
import { Icon } from '../../components/Icon'
import { OeuvrePeinte } from '../../components/OeuvrePeinte'
import { Feuille, PieceTete } from '../../components/Pieces'
import { espacesFines } from '../../format'
import { toucher } from '../../toucher'
import { ETOILES_D_UNE_PARTIE } from '../../../../shared/cabinet/bareme'
import { JEUX } from '../../../../shared/cabinet/jeux/regle'
import { poussieresDites } from '../../../../shared/cabinet/musee'
import { oeuvre as oeuvreDe } from '../../../../shared/cabinet/oeuvres'
import type { IssueDUnePartie, OrigineDUnePartie } from '../../../../shared/cabinet/partie'
import type { GainsDuCabinet, MancheVue, VueDeLaPartie } from '../../../../shared/cabinet/vues'
import { aPorterDesTrophees, partsDeLXp, tropheesTombes, xpDesTrophees, type Tombe } from '../../../../shared/gains'
import { titreAuBilan } from './Cartel'
import type { EcranEfface } from './Partie'
import { GardiensQuiSEveillent } from './Reveil'
import { oeuvreMontree } from './Salle'

// Le bilan d'une partie (§ 2.6) : ce qu'elle a fait à son œuvre, en clair —
// les étoiles manche par manche et leurs notes, le total sur neuf, la
// poussière d'or —, l'œuvre gagnée et son cartel (dorée ou doublée, ce que la
// partie lui a appris : elle garde le cartel d'avant si elle en avait un, et la
// fin dit lequel — `BilanVu.devientSonCartel`), le gardien réveillé en
// grand (`LegendaireOuvert`, avant les gains, comme à la fin d'une
// expédition) et la luciole qui rejoint (`Reveil.tsx`), puis l'écran des
// gains de tous les modes : « Ce que tu gagnes », « Nouveaux trophées »,
// « À porter » (`Gains.tsx`, `gains.test.ts`).
// Ce que dit l'œuvre (« Pas assez d'étoiles cette fois. Il en fallait 6 »)
// est la phrase du serveur (`BilanVu.dit`) : la page ne recompte rien.
//
// Chargé à la demande (`Partie.tsx`) : l'écran des gains et ses catalogues
// ne servent qu'à la fin, et la page du musée ne les télécharge pas.

/** L'issue, en titre. */
const TITRES: Record<IssueDUnePartie, string> = {
  gagnee: 'Une œuvre de plus !',
  'gagnee-doree': 'Gagnée sans faute !',
  doree: 'Son cadre est doré !',
  double: 'Un double !',
  manquee: 'Pas cette fois',
  libre: 'Partie finie',
}

const D_OU: Record<OrigineDUnePartie, string> = { visite: 'La visite du jour', chasse: 'Une chasse', libre: 'Partie libre' }

/** Une manche au bilan : ses étoiles, ce qui les a changées, et comment elle s'est tranchée. */
function LigneDeLaManche({ m, k }: { m: MancheVue; k: number }) {
  const fin = m.etoiles === null ? 'pas jouée' : m.fin === 'expiree' ? 'temps écoulé' : m.fin === 'quittee' ? 'quittée' : null
  return (
    <li>
      <span className="cab-surtitre">{`Manche ${k + 1}`}</span>
      <Etoiles n={Math.min(3, m.etoiles ?? 0)} />
      {m.note && <span className="cab-note">{espacesFines(m.note)}</span>}
      {fin && <span className="cab-compte">{fin}</span>}
    </li>
  )
}

/**
 * « Mes réponses » : chaque manche révélée, comme la partie l'a révélée (le
 * même pli, invariant 14) — au Détail, chacune son tableau entier, à l'indice
 * de son tirage : celui que « Changer » a pris, pas celui de sa manche ; et
 * comment elle s'est tranchée (`fin`) : une partie quittée s'ouvre sur son
 * bilan, c'est donc ici seulement qu'on revoit sa manche quittée, et la
 * Réplique quittée au bon mot y dit qu'il ne compte pas.
 */
export function MesReponses({ vue, ecran, onFermer }: { vue: VueDeLaPartie; ecran: EcranEfface; onFermer: () => void }) {
  return (
    <Feuille titre="Mes réponses" onFermer={onFermer} className="cab-feuille">
      {vue.manches.map((m, k) =>
        m.revelation ? (
          <section key={k} className="cab-reponses-manche" aria-label={`Manche ${k + 1}`}>
            <span className="cab-surtitre">{`Manche ${k + 1} · ${espacesFines(m.revelation.corps.titre)}`}</span>
            <ecran.Revelation corps={m.revelation.corps} partie={vue.id} tirage={m.revelation.tirage} fin={m.revelation.fin} />
            {m.revelation.corps.savais && (
              <p className="card anecdote">
                <Icon name="message" />
                <span>
                  <b>Le savais-tu ?</b> {espacesFines(m.revelation.corps.savais)}
                </span>
              </p>
            )}
          </section>
        ) : null,
      )}
    </Feuille>
  )
}

/**
 * Le profil se relit-il après la partie ? Dès qu'elle a rapporté quelque
 * chose : le niveau qu'elle a fait monter, la forme que son compagnon a
 * atteinte (`useNiveauRelu`) — et la luciole seule, qui s'installe dans la
 * niche de la page : sans la relecture, la fin la promettait « en haut de
 * chaque page », et la niche restait vide jusqu'au rechargement.
 */
export function aRelireApresLaPartie(g: GainsDuCabinet | undefined): boolean {
  return !!g && (g.xp > 0 || g.confettis > 0 || (g.recompenses?.length ?? 0) > 0 || !!g.compagnon)
}

export function BilanDeLaPartie({ vue, ecran, onMusee, onRejouer }: { vue: VueDeLaPartie; ecran: EcranEfface | null; onMusee: () => void; onRejouer?: () => void }) {
  const [reponses, setReponses] = useState(false)
  const b = vue.bilan
  const g = b?.gains
  const cles = (g?.recompenses ?? []).map(r => r.key)
  const niveau = useNiveauRelu(aRelireApresLaPartie(g))
  if (!b) {
    return (
      <div className="player-shell cab-page">
        <p className="cab-ligne">{espacesFines('Cette partie est finie : ton musée l’a comptée.')}</p>
        <button type="button" className="btn btn-primary btn-big btn-block" {...toucher(onMusee)}>
          Revenir au musée
        </button>
      </div>
    )
  }
  const o = b.oeuvre ? oeuvreDe(b.oeuvre) : undefined
  const doree = b.issue === 'gagnee-doree' || b.issue === 'doree'
  // Un gardien qui veillait déjà — une salle complète, trente jours d'affilée, un légendaire gagné ailleurs : rien de neuf à
  // fêter, la fin le dit (§ 5.3), par ce qui l'a réveillé.
  const veillaient = (b.gardiens ?? []).filter(x => !x.neuf)
  // Ceux que la fin a réveillés, le verdict du serveur : eux seuls disent leur raison.
  const reveilles = (b.gardiens ?? []).filter(x => x.neuf).map(x => x.legendaire)
  return (
    <div className="player-shell cab-page cab-bilan">
      <section className="cab-bilan-tete" role="status">
        <PieceTete piece={`${D_OU[vue.origine]} · ${JEUX[vue.jeu].nom}`} titre={TITRES[b.issue]} />
        <p className="cab-total-grand">
          <b>{b.total}</b>
          {` étoile${b.total > 1 ? 's' : ''} sur ${ETOILES_D_UNE_PARTIE}`}
        </p>
        <ol className="cab-manches-du-bilan">
          {vue.manches.map((m, k) => (
            <LigneDeLaManche key={k} m={m} k={k} />
          ))}
        </ol>
        <p className="cab-ligne cab-dit">{espacesFines(b.dit)}</p>
        {b.quittee && <p className="cab-ligne">{espacesFines('Tu as quitté la partie : elle compte avec ses étoiles.')}</p>}
        {b.lendemain && <p className="cab-ligne">{espacesFines('Laissée en route, elle s’est close avec les étoiles de son jour.')}</p>}
        {b.poussiere > 0 && (
          <p className="cab-poussiere">
            <Icon name="sparkles" />
            {`+${poussieresDites(b.poussiere)}`}
          </p>
        )}
      </section>
      {o && (
        <section className="cab-oeuvre-gagnee" aria-label={o.nom}>
          <div className="cab-oeuvre-levee">
            <OeuvrePeinte oeuvre={oeuvreMontree(o, o.salle)} taille="levee" doree={doree} />
          </div>
          {b.cartel && (
            <div className="cab-cartel">
              {/* Les mots du cartel du musée — dorée en jouant, une œuvre achetée ne se dit pas gagnée —, et « Son cartel » seulement
                  quand la fin dit que l'œuvre le prend, ou, relue sans la fin, gagnée (`titreAuBilan`, `devientSonCartel`). */}
              <span className="cab-cartel-titre">{titreAuBilan(b)}</span>
              <p className="cab-cartel-sujet">{espacesFines(b.cartel.sujet)}</p>
              <p className="cab-cartel-reponse">{espacesFines(b.cartel.reponse)}</p>
              {b.cartel.anecdote && <p className="cab-cartel-phrase">{espacesFines(b.cartel.anecdote)}</p>}
            </div>
          )}
        </section>
      )}
      {/* Le gardien que la partie réveille, en grand, avant les gains, sa raison au-dessus — celle d'un gardien que le serveur dit
          neuf (`BilanVu.gardiens`) ; celui qui veillait déjà, sa ligne ; la luciole, à la première salle complète. Les légendaires
          que ses paliers ouvrent passent par les mêmes cartes, sans raison : un gardien a d'autres voies que le Cabinet. */}
      <GardiensQuiSEveillent neufs={g?.legendaires ?? []} parLeCabinet={reveilles} veillaient={veillaient.map(x => x.legendaire)} compagnon={g?.compagnon} />
      {g && (
        <CeQueTuGagnes
          parts={partsDeLXp([
            { nom: 'ta partie', xp: g.xp },
            { nom: 'tes trophées', xp: xpDesTrophees(cles) },
          ])}
          confettis={g.confettis}
          niveau={niveau}
        />
      )}
      <NouveauxTrophees trophees={tropheesTombes((g?.recompenses ?? []) as readonly Tombe[])} lien />
      <APorter objets={[...aPorterDesTrophees(cles), ...emojisAPorter(niveau)]} />
      <MissionsAccomplies key={vue.id} profil />
      {/* Au lever du doigt (`toucher`) : le bilan prend la place de « Voir le bilan », et le `click` qui suit ne part pas d'ici. */}
      <div className="fin-actions">
        <button type="button" className="btn btn-primary btn-big btn-block" {...toucher(onMusee)}>
          Revenir au musée
        </button>
        {ecran && vue.manches.some(m => m.revelation) && (
          <button type="button" className="btn btn-block" {...toucher(() => setReponses(true))}>
            Mes réponses
          </button>
        )}
        {onRejouer && (
          <button type="button" className="btn btn-block" {...toucher(onRejouer)}>
            {`Rejouer · ${JEUX[vue.jeu].nom}`}
          </button>
        )}
      </div>
      {reponses && ecran && <MesReponses vue={vue} ecran={ecran} onFermer={() => setReponses(false)} />}
    </div>
  )
}
