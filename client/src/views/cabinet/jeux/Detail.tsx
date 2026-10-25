import { useEffect, useState } from 'react'
import { Etoiles } from '../../../components/Etoiles'
import { Icon } from '../../../components/Icon'
import { TableauEntier } from '../../../components/TableauEntier'
import { espacesFines } from '../../../format'
import { toucher } from '../../../toucher'
import { ETOILES_AU_CADRAGE } from '../../../../../shared/cabinet/bareme'
import { QUESTION_DU_TABLEAU, adresseDUnCadrage, type DetailMontre, type DetailRevele } from '../../../../../shared/cabinet/jeux/detail'
import type { JeuALEcran, OuEstLaManche, PropsDUneManche } from '../Partie'

// Le Détail à l'écran (§ 3.4) : un tableau à reconnaître, d'un détail au
// tableau entier. La manche s'ouvre sur le premier cadrage ; « Reculer d'un
// pas » en montre plus, et la réponse vaut une étoile de moins — ce qu'elle
// vaut, la vue le dit (`vaut`) : la page ne recompte rien. Quatre titres,
// chacun son peintre, dans l'ordre figé au départ ; ceux qu'Éclairer a effacés
// restent à leur place, en sourdine.
//
// L'image d'un cadrage se demande à sa route, par la partie et l'indice de son
// tirage dans le plan figé (`adresseDUnCadrage`), jamais par la manche : après
// « Changer », la même manche joue un autre tableau, et le cache du téléphone
// aurait rendu l'image d'avant. La route ne sert que le cadrage atteint : la
// page ne demande jamais le suivant d'avance — il se refuserait, et le tableau
// entier se serait téléchargé avant la réponse (invariant 1). Rien ne nomme le
// tableau avant le verdict, pas même son texte à l'oreille.
//
// La page ne tient rien d'une manche du Détail : « Reculer » et la réponse
// partent au toucher. À l'échéance, la réponse part vide, et la manche se juge
// sur ce que le serveur sait.

/** Les cadrages d'un tableau, du détail au tableau entier : autant que le barème en compte — la règle les compte ainsi (`detail.ts`). */
const CADRAGES = ETOILES_AU_CADRAGE.length

/** Un cadrage perdu en route — le réseau d'un téléphone — se redemande, un peu plus tard chaque fois, puis la page attend la suivante. */
const ESSAIS_D_UNE_IMAGE = 5

/**
 * L'adresse où l'image d'un cadrage se demande, et sa reprise après un échec :
 * une adresse neuve à chaque essai (`?essai=`, que la route ignore), comme le
 * détail de l'Expédition (`TableauDuDetail.tsx`) — la même `src` ne relance
 * pas une balise d'image. Au cadrage suivant, la première adresse.
 */
function useAdresseQuiInsiste(adresse: string | null): { src: string | null; rate: () => void } {
  const [essai, setEssai] = useState({ adresse, n: 0 })
  const [rate, setRate] = useState<{ adresse: string | null; n: number } | null>(null)
  const n = essai.adresse === adresse ? essai.n : 0
  useEffect(() => {
    // Seul l'échec de l'adresse d'à présent se redemande : un pas de plus entre-temps en a posé une autre, qui n'a rien raté.
    if (!rate || rate.adresse !== adresse || rate.n >= ESSAIS_D_UNE_IMAGE) return
    const suivant = rate.n + 1
    const id = setTimeout(() => setEssai({ adresse, n: suivant }), 600 * suivant)
    return () => clearTimeout(id)
  }, [rate, adresse])
  return { src: adresse === null ? null : n === 0 ? adresse : `${adresse}?essai=${n}`, rate: () => setRate({ adresse, n }) }
}

/**
 * Le tableau sous les yeux : le cadrage atteint, dans un cadre de hauteur fixe
 * — un détail en largeur, puis un en hauteur, ne font pas sauter les titres
 * sous le doigt —, et la jauge de ses pas, posée dans le cadre : une ligne de
 * moins au-dessus des titres. Une seule balise d'image, gardée d'un cadrage à
 * l'autre : le navigateur garde l'image d'avant à l'écran tant que la suivante
 * arrive, et le tableau ne clignote pas à chaque pas. Un autre tableau —
 * « Changer » — a la sienne (`key`) : l'image d'avant n'est pas la sienne.
 */
function TableauSousLesYeux({ m, partie, tirage }: { m: DetailMontre } & OuEstLaManche) {
  const { src, rate } = useAdresseQuiInsiste(tirage === undefined ? null : adresseDUnCadrage(partie, tirage, m.cadrage))
  const entier = m.cadrage >= m.cadrages
  return (
    <div className="cab-detail-cadre">
      {src && <img key={tirage} src={src} alt={entier ? 'Le tableau entier' : `Un détail du tableau, cadrage ${m.cadrage} sur ${m.cadrages}`} onError={rate} />}
      <div className="cab-detail-pas" role="progressbar" aria-label="Le tableau, pas à pas" aria-valuemin={1} aria-valuemax={m.cadrages} aria-valuenow={m.cadrage}>
        {Array.from({ length: m.cadrages }, (_, i) => (
          <i key={i} className={i < m.cadrage ? 'cab-detail-vu' : undefined} />
        ))}
      </div>
    </div>
  )
}

function MancheDuDetail({ montree: m, partie, tirage, envoyer, garde, busy }: PropsDUneManche<DetailMontre, null>) {
  const reculer = () => m.peutReculer && !busy && garde() && envoyer({ quoi: 'reculer' })
  return (
    <>
      <div className="cab-tete-question">
        <span className="cab-surtitre">{espacesFines(QUESTION_DU_TABLEAU)}</span>
      </div>
      <TableauSousLesYeux m={m} partie={partie} tirage={tirage} />
      <div className="cab-detail-gestes">
        {/* Au tableau entier, la réponse ne vaut plus rien : trois étoiles vides s'y lisaient comme trois étoiles. */}
        {m.vaut > 0 ? (
          <p className="cab-vaut">
            Ta réponse vaut <Etoiles n={m.vaut} />
          </p>
        ) : (
          <p className="cab-vaut">{espacesFines('Ta réponse ne vaut plus d’étoile')}</p>
        )}
        <button type="button" className="btn cab-reculer" aria-disabled={!m.peutReculer || busy || undefined} {...toucher(reculer)}>
          <Icon name="maximize" />
          Reculer d’un pas
        </button>
      </div>
      <ol className="cab-titres">
        {m.titres.map((x, i) => (
          // La clé dit le titre : après « Changer », les quatre d'un autre tableau ne continuent pas ceux d'avant.
          <li key={`${i}:${x.titre}`}>
            <button
              type="button"
              className={'ans-btn cab-titre' + (x.efface ? ' cab-effacee' : '')}
              aria-disabled={x.efface || busy || undefined}
              {...toucher(() => !x.efface && !busy && garde() && envoyer({ quoi: 'repondre', reponse: { detail: { titre: i } } }))}
            >
              <span className="ans-text">
                <b className="cab-titre-nom">{espacesFines(x.titre)}</b>
                <span className="cab-titre-peintre">{espacesFines(x.peintre)}</span>
              </span>
              {x.efface && <span className="sr-only">, effacé</span>}
            </button>
          </li>
        ))}
      </ol>
    </>
  )
}

/** Où il en était à sa réponse : « Au premier coup d'œil », « Après 2 pas en arrière ». */
const ouIlEnEtait = (cadrage: number) => (cadrage <= 1 ? 'Au premier coup d’œil' : `Après ${cadrage - 1} pas en arrière`)

/**
 * La révélation : le tableau entier — à l'adresse de son tirage, la manche
 * tranchée : la route les sert tous (`TableauEntier`, celui de « Mes
 * réponses » de la campagne) —, son titre, son peintre et son année au-dessus
 * de lui, et le titre qu'il avait choisi, barré, quand ce n'était pas le bon.
 * Le nom d'abord : sous « C'était… » et le tableau, il tombait sous le pli du
 * 360 × 640, derrière « Manche suivante ». Sans tirage (une révélation écrite
 * à la main), son nom seul : rien à demander.
 */
function RevelationDuDetail({ corps: r, partie, tirage }: { corps: DetailRevele } & OuEstLaManche) {
  return (
    <section className="cab-tableau-revele" aria-label="Le tableau">
      <span className="cab-surtitre">{ouIlEnEtait(r.cadrage)}</span>
      {tirage !== undefined ? (
        <TableauEntier src={adresseDUnCadrage(partie, tirage, CADRAGES)} titre={r.tableau.titre} peintre={r.tableau.peintre} annee={r.tableau.annee} />
      ) : (
        <p className="cab-tableau-nom">{espacesFines(`« ${r.tableau.titre} », ${r.tableau.peintre}, ${r.tableau.annee}`)}</p>
      )}
      {r.repondu && (
        <p className="corrige-reponse corrige-sienne">
          <span className="corrige-legende">
            <Icon name="x" />
            Ta réponse
          </span>
          <span className="corrige-mot">
            <s>{espacesFines(r.repondu)}</s>
          </span>
        </p>
      )}
    </section>
  )
}

export const DETAIL: JeuALEcran<DetailMontre, DetailRevele, null> = {
  localDe: () => null,
  // Le contenu d'une manche, ce sont ses quatre titres : « Changer » en pose d'autres, le cadrage n'en change aucun.
  cleDe: m => m.titres.map(x => `${x.titre}|${x.peintre}`).join('·'),
  aLEcheance: () => undefined,
  // « Reculer » élargit le tableau sous les mêmes titres et le même bouton : la demi-seconde de garde repart — un double toucher
  // sur « Reculer » coûtait deux étoiles, et le second toucher d'un titre tombait sur un tableau qu'on n'avait pas regardé.
  sousEcranDe: m => String(m.cadrage),
  Manche: MancheDuDetail,
  Revelation: RevelationDuDetail,
}
