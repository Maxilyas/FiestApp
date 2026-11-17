import { useState, type CSSProperties, type RefObject } from 'react'
import { EnteteDeLaPiece, ceQueDitLaVignette, classesDeLaVignette } from './LigneDeCollection'
import { Legendaire } from './Legendaire'
import { Icon } from './Icon'
import { useFiche } from './Boutique'
import { gemme } from '../gemmes'
import { espacesFines, formatNumber } from '../format'
import type { PropsDUnePiece } from './choix'
import { NOM_PALIER, VITRINE_MAX, ceQuIlAFallu, cleRangee, hautFait, hautsFaitsGagnes, palierDe, titreDePalier } from '../../../shared/hautsfaits'
import { NOM_RARETE } from '../../../shared/badges'
import { rareteMesuree } from '../../../shared/pistes'
import { vitrineDeLaCarte } from '../../../shared/carte'
import { hautFaitPrincipal, legendaire } from '../../../shared/legendaires'
import { lePremierHautFait, recompensesDe, type Proche } from '../../../shared/proches'
import type { PublicProfileDetail } from '../../../shared/profil'

// Les pièces des trophées que d'autres écrans reprennent : sa vitrine — ce
// que sa carte montre à la salle, qui se règle dans la loge (« M'habiller »,
// pièce « Vitrine ») — et un objectif commencé. L'album lui-même vit dans
// `AlbumDesTrophees`, sous « Ma collection ».

/**
 * Ce que sa vitrine montre — celle que la carte montre, essai compris (`montree` :
 * la vitrine choisie, sinon ses trois plus beaux, la règle de la carte,
 * `vitrineDeLaCarte`) —, et de quoi la choisir.
 */
export function laVitrine(profil: PublicProfileDetail, montree: readonly string[] | null) {
  const recompenses = recompensesDe(profil.hautsFaits)
  const parCle = new Map(profil.vitrine.map(b => [b.key, b]))
  const badgeDe = (cle: string) => {
    const rangee = cleRangee(cle, recompenses)
    return rangee ? parCle.get(rangee) : undefined
  }
  const gagnes = hautsFaitsGagnes(recompenses).filter(cle => badgeDe(cle))
  const montres = vitrineDeLaCarte(profil.vitrine, montree, recompenses)
  return { badgeDe, gagnes, montres }
}

/** Le nom d'un trophée sans son métal : « L'Habitué · Argent » se dit « L'Habitué », le liseré dit l'argent. */
const sansMetal = (titre: string) => titre.split(' · ')[0]
/** Une place sur la carte, au féminin (règle `css.md`) : « 1ʳᵉ place », « 2ᵉ place ». */
const place = (i: number) => `${i + 1}${i === 0 ? 'ʳᵉ' : 'ᵉ'} place`

/** Quatre médailles par rangée, partout (`.loge-medailles`, `--loge-colonnes: 4`) : la pointe de la fiche vise la sienne. */
const COLONNES_DES_MEDAILLES = 4

/** Ce que la vitrine sans état reçoit en plus d'une pièce : la fiche ouverte, le geste qui l'ouvre, et où la poser. */
interface PropsDeLaVitrine extends PropsDUnePiece {
  ouvert: string | null
  onOuvrir: (cle: string) => void
  fiche?: RefObject<HTMLDivElement | null>
}

/**
 * Sa vitrine : les hauts faits que sa carte montre à qui touche son nom.
 * D'office, les trois plus durs à obtenir (`plusBeaux`) ; il peut aussi les
 * choisir — un coup du sort compris, s'il en est fier —, dans l'ordre où la
 * carte les montrera. Un haut fait de carrière s'y montre à son plus haut
 * palier, qui monte avec lui.
 *
 * La vitrine d'office est une option de la liste, en tête, comme « Aucun »
 * parmi les titres : un bouton qui ne paraissait qu'une vitrine choisie
 * partait sous le doigt qui le touchait, et le focus tombait sur la page.
 * Elle se choisit d'un toucher — elle n'a pas d'exploit à lire, et ses trois
 * ✨ s'allument dans les places, juste au-dessus.
 *
 * Des médailles, quatre par rangée au téléphone (le souhait du propriétaire du
 * 17 novembre 2026 : « on est obligé de scroller trop […] la présentation ne
 * donne pas trop envie ») : l'emoji du trophée en grand dans un rond, son nom
 * dessous, et, choisi, son rang sur la carte en pastille d'or au coin. Le mot
 * reste « trophée » : la médaille n'est que le dessin.
 *
 * Sous l'en-tête, « Sur ta carte » : ses trois places, 1, 2, 3, chacune
 * l'emoji du trophée qui l'occupe, vide en pointillé ; d'office, une ✨ à la
 * place du numéro (« Pour la vitrine est ce que l'on sait sur quoi on
 * clique ? », le propriétaire, le même jour). Une place prise touchée le rend.
 *
 * **On choisit par l'exploit** (le propriétaire, le même jour : « Pour la
 * vitrine il faut que je sache ce que font les trophées de manière élégante.
 * Sinon on choisit plus par l'exploit mais juste par l'icône et c'est nul »).
 * Un toucher posait la médaille sur la carte, et ce qu'il avait fallu pour
 * l'avoir ne se disait qu'à l'oreille : on choisissait un emoji. Toucher une
 * médaille ouvre maintenant sa fiche sous sa rangée, comme une case de l'album
 * de « Ma collection » — le geste que l'application a déjà appris à ses
 * joueurs pour un trophée : la médaille en plus grand, son nom, ce qu'il a
 * fallu, son métal et sa rareté, puis un seul geste, « Sur ma carte » ou
 * « Retirer de ma carte ». Une fiche à la fois : retouchée, elle se referme,
 * une autre la déplace. Sans consigne ni légende : « pas besoin de mettre du
 * texte à chaque fois, ça doit être compréhensible et intuitif. Ça fait perdre
 * de la place pour rien » (le propriétaire, plus tôt le même jour).
 *
 * La fiche ouverte vit ici, et rien d'autre : la vitrine elle-même est sans
 * état (`LaVitrine`), ses gestes se touchent tels quels (`loge.test.ts`).
 */
export function MaVitrine(props: PropsDUnePiece) {
  const [ouvert, setOuvert] = useState<string | null>(null)
  // Ouverte, la fiche prend le focus sur son nom et vient en vue (le geste de l'album). Rien ne la referme d'elle-même :
  // le bouton d'or bascule sous le doigt, et la fiche reste là pour qu'on voie ce qu'il a fait.
  const fiche = useFiche(ouvert, 'vitrine')
  return <LaVitrine {...props} ouvert={ouvert} onOuvrir={cle => setOuvert(o => (o === cle ? null : cle))} fiche={fiche} />
}

/** La vitrine, sans état : ses places, ses médailles, et la fiche que `ouvert` désigne. */
export function LaVitrine({ profil, essai, essayer, neufs, ouvert, onOuvrir, fiche }: PropsDeLaVitrine) {
  const choisie = profil.vitrineChoisie ?? null
  // Ce que la carte montre : la vitrine essayée, sinon celle qu'il porte ; null, celle d'office.
  const montree = essai.vitrine !== undefined ? essai.vitrine : choisie
  const { badgeDe, gagnes, montres } = laVitrine(profil, montree)
  const complet = (montree?.length ?? 0) >= VITRINE_MAX
  // Le trophée qui vient de prendre sa place — le dernier de l'essai, s'il ne la tenait pas déjà — : seule la sienne
  // s'allume, une fois, en paraissant. Dérivé de l'essai, sans état : les places d'office, à l'ouverture, n'en ont pas.
  // Pleine, le bouton éteint d'une fiche touché fait frémir les places (`:has(…:active)`, la feuille) : c'est là qu'on en
  // libère une.
  const vient = montree && montree.length > 0 && !(choisie ?? []).includes(montree[montree.length - 1]) ? montree[montree.length - 1] : null
  const basculer = (cle: string) => {
    const avant = montree ?? []
    if (!avant.includes(cle) && complet) return
    const apres = avant.includes(cle) ? avant.filter(k => k !== cle) : [...avant, cle]
    essayer({ vitrine: apres.length > 0 ? apres : null })
  }
  // La vitrine d'office, par la règle de toutes les pièces : montrée par la carte, portée.
  const office = { montre: montree === null, porte: choisie === null }
  const plusDurs = Math.min(VITRINE_MAX, gagnes.length)
  // Les trois places de la carte : chacune son trophée — la clé que la vitrine retient, pour le rendre —, d'office sans clé.
  const places = Array.from({ length: VITRINE_MAX }, (_, i) => {
    const cle = montree?.[i]
    const b = cle ? badgeDe(cle) : montree === null ? montres[i] : undefined
    return b ? { cle: cle ?? null, b } : null
  })

  if (gagnes.length > 0) {
    return (
      <section className="loge-vitrine-piece">
        {/* Sa pièce s'appelle « Vitrine » : l'en-tête dit ce qu'elle range, des trophées — le mot de l'album et des fins de partie. */}
        <EnteteDeLaPiece id="loge-vitrine-entete" titre="Mes trophées" compte={`${gagnes.length} à toi`} />
        {/* Ses trois places sur la carte, dans l'ordre où elle les montre : là se voit ce que le bouton d'une fiche fait. Une
            place prise se touche pour la vider — sans fiche : rendre un trophée ne demande pas de relire son exploit, et sa
            médaille peut être trois écrans plus bas chez un vétéran. Trois boutons qui ne partent jamais, rangés par leur
            numéro : vidée, la place reste sous le doigt et le focus avec — les suivantes y remontent ; d'office ou vide, il
            n'y a rien à y faire (`aria-disabled`). */}
        <ol className={'loge-emplacements' + (montree === null ? ' d-office' : '')} aria-label="Sur ta carte">
          {places.map((p, i) => {
            const cle = p?.cle ?? null
            return (
              <li key={i}>
                <button
                  type="button"
                  className={'loge-emplacement' + (p ? '' : ' vide') + (cle !== null && vient === cle ? ' vient' : '')}
                  aria-disabled={cle === null || undefined}
                  aria-describedby={cle !== null ? `loge-vitrine-regle-${cle}` : undefined}
                  onClick={cle !== null ? () => basculer(cle) : undefined}
                >
                  <span className="loge-emplacement-numero" aria-hidden="true">
                    {montree === null && p ? '✨' : i + 1}
                  </span>
                  {p && (
                    <span className="loge-emplacement-emoji" aria-hidden="true">
                      {p.b.emoji}
                    </span>
                  )}
                  {/* Son nom, à l'oreille seulement : coupé au tiers d'une rangée (« Le San… », « Le Phé… »), il
                      alourdissait la place sans se lire, et l'emoji est celui de sa médaille, juste dessous. */}
                  <span className="sr-only">{!p ? `${place(i)}, libre` : `${sansMetal(p.b.title)}, ${place(i)}${cle === null ? ', d’office' : ' : le retirer'}`}</span>
                </button>
              </li>
            )
          })}
        </ol>
        {/* Une liste, pas un groupe : `role="group"` lui retirait ses éléments. La fiche ouverte y est un élément de plus,
            juste après sa médaille, sur toute la largeur : la grille la pose sous la rangée (`grid-auto-flow: dense`) et
            les voisines de la médaille restent à leur place — rien ne bouge sous le doigt ni au-dessus, seules les rangées
            du dessous descendent. */}
        <ul className="loge-vignettes loge-medailles" aria-labelledby="loge-vitrine-entete">
          <li>
            <button
              type="button"
              className={'loge-vignette loge-medaille' + classesDeLaVignette(office)}
              aria-pressed={office.montre}
              aria-describedby="loge-vitrine-office"
              onClick={() => essayer({ vitrine: null })}
            >
              <span className="loge-vignette-image" aria-hidden="true">
                <span className="loge-medaille-emoji">✨</span>
              </span>
              {/* « Les plus durs, d'office » sur trois lignes dans une médaille : « d'office » se dit à l'oreille, et la ✨ des places le montre. */}
              <span className="loge-vignette-nom">
                Les plus durs<span className="sr-only">, d’office</span>
              </span>
              {ceQueDitLaVignette(office) && <span className="sr-only">{ceQueDitLaVignette(office)}</span>}
            </button>
          </li>
          {gagnes.flatMap((cle, i) => {
            const b = badgeDe(cle)!
            const rang = montree ? montree.indexOf(cle) : -1
            // La règle de toutes les pièces : montré par la carte (son rang), porté (dans la vitrine qu'il porte), neuf.
            // D'office, aucun n'est « montré » ici : ses places le disent, et « Les plus durs » est l'option choisie.
            const e = { montre: rang >= 0, porte: choisie?.includes(cle) ?? false, neuve: neufs?.has(cle) }
            // Une piste de carrière se range à un métal, que la médaille porte en liseré (bronze, argent, or) ; son nom
            // le dit encore à l'oreille : « Le Sans-Faute · Bronze » devenait « Le Sans-Faute · … » sur deux lignes.
            const metal = palierDe(b.key)?.palier
            const [nom, ...suite] = b.title.split(' · ')
            const estOuvert = ouvert === cle
            const medaille = (
              <li key={cle}>
                {/* Un bouton qui ouvre sa fiche, comme une case de l'album : plus d'`aria-pressed` — le toucher ne choisit
                    plus, il montre —, son état et son rang toujours dits après son nom. */}
                <button
                  type="button"
                  className={'loge-vignette loge-medaille' + (metal ? ` loge-medaille-m${metal}` : '') + classesDeLaVignette(e)}
                  aria-expanded={estOuvert}
                  aria-controls={estOuvert ? 'loge-vitrine-fiche' : undefined}
                  onClick={() => onOuvrir(cle)}
                >
                  <span className="loge-vignette-image" aria-hidden="true">
                    <span className="loge-medaille-emoji">{b.emoji}</span>
                  </span>
                  <span className="loge-vignette-nom">
                    {nom}
                    {suite.length > 0 && <span className="sr-only">{` · ${suite.join(' · ')}`}</span>}
                  </span>
                  {ceQueDitLaVignette(e) && <span className="sr-only">{ceQueDitLaVignette(e)}</span>}
                  {/* Son rang sur la carte, dit aussi à l'oreille : il n'était qu'à l'œil. */}
                  {e.montre && (
                    <span className="loge-medaille-rang">
                      <span className="sr-only">, montré </span>
                      {rang + 1}
                      <span className="sr-only">{rang === 0 ? 'ᵉʳ' : 'ᵉ'}</span>
                    </span>
                  )}
                </button>
              </li>
            )
            if (!estOuvert) return [medaille]
            return [
              medaille,
              <FicheDeLaMedaille
                key={`${cle}-fiche`}
                badge={b}
                nom={nom}
                metal={metal}
                // « Les plus durs » tient la première case : la médaille de rang i est dans la colonne (i + 1) modulo quatre.
                colonne={(i + 1) % COLONNES_DES_MEDAILLES}
                montre={e.montre}
                pleine={complet}
                onBasculer={() => basculer(cle)}
                fiche={fiche}
              />,
            ]
          })}
        </ul>
        {/* Ce que les places et « Les plus durs » décrivent, hors d'eux : `hidden` le tait au lecteur qui parcourt la page,
            et `aria-describedby` le lit quand même — une seule fois, après le nom. La médaille, elle, l'écrit dans sa fiche. */}
        <div hidden>
          <span id="loge-vitrine-office">{plusDurs > 1 ? `Ta carte choisit tes ${plusDurs} plus durs.` : 'Ta carte le montre d’office.'}</span>
          {gagnes.map(cle => (
            <span key={cle} id={`loge-vitrine-regle-${cle}`}>
              {ceQuIlAFallu(badgeDe(cle)!.key)}
            </span>
          ))}
        </div>
        {/* Pas de « N trophées à gagner » ici : compté comme l'album, il disait 277 à une habituée, à côté des
            « 78 titres à gagner » de la pièce voisine, qui mène au même album — un chiffre qui étonne, et du texte de plus
            (« pas besoin de mettre du texte à chaque fois », le propriétaire, le 17 novembre 2026). La vitrine d'avant
            n'en avait pas. */}
      </section>
    )
  }

  return (
    <section className="loge-vitrine-piece">
      <EnteteDeLaPiece id="loge-vitrine-entete" titre="Sur ta carte" />
      <p className="muted small">
        {/* « À la fin de chaque soirée », disait-elle : faux pour qui joue seul — le quiz du jour et la
            campagne ont leurs hauts faits —, et il concluait que la vitrine n'était pas pour lui
            (l'experte du jeu solo, le 11 octobre 2026). */}
        Ta carte montrera tes trois plus beaux trophées : ils se gagnent en soirée, au quiz du jour et en campagne.
      </p>
      <PremierHautFait profil={profil} />
    </section>
  )
}

/**
 * La fiche d'une médaille, sous sa rangée : courte, comme le veut la loge —
 * la médaille en plus grand, son liseré de métal ; son nom au serif de la
 * carte ; son métal et sa rareté sur une ligne d'étiquette ; ce qu'il a fallu,
 * en une phrase (`ceQuIlAFallu`) ; puis le bouton d'or, seul geste de la fiche.
 * Rien d'autre : ni ce qu'il ouvre, ni son expérience, ni le chemin où le
 * regagner — l'album de « Ma collection » les dit, ici on choisit ce que la
 * salle verra.
 *
 * La rareté est celle que l'album montre (`rareteMesuree`, la part des joueurs
 * qui l'ont, `PART_DES_JOUEURS` — celle qui fait choisir les trois plus beaux
 * de la vitrine d'office, `plusBeaux`), dite par son nom et sa gemme, jamais
 * par un chiffre. Carte pleine, le bouton s'éteint sans une phrase : les trois
 * places, au-dessus, frémissent sous le doigt qui insiste (la feuille) — c'est
 * là qu'on en libère une ; l'oreille l'entend dans le nom du bouton.
 */
function FicheDeLaMedaille({
  badge,
  nom,
  metal,
  colonne,
  montre,
  pleine,
  onBasculer,
  fiche,
}: {
  badge: { key: string; emoji: string }
  nom: string
  metal: number | undefined
  colonne: number
  montre: boolean
  pleine: boolean
  onBasculer: () => void
  fiche?: RefObject<HTMLDivElement | null>
}) {
  const rarete = rareteMesuree(badge.key)
  const eteint = !montre && pleine
  const regle = ceQuIlAFallu(badge.key)
  return (
    <li className="loge-fiche" style={{ '--loge-fiche-colonne': colonne, ...gemme(rarete ?? 'offert') } as CSSProperties}>
      <div id="loge-vitrine-fiche" className="loge-fiche-corps" ref={fiche}>
        <span className={'loge-fiche-medaille' + (metal ? ` loge-fiche-m${metal}` : '')} aria-hidden="true">
          {badge.emoji}
        </span>
        <span className="loge-fiche-tete">
          {/* `galerie-detail-nom` : le nom que `useFiche` focalise à l'ouverture, comme une fiche de l'album. */}
          <b className="galerie-detail-nom loge-fiche-nom">{nom}</b>
          {(metal || rarete) && (
            <span className="loge-fiche-sous">
              {metal && <span className={`metal-texte-${metal}`}>{NOM_PALIER[metal - 1]}</span>}
              {rarete && (
                <span className="loge-fiche-rarete">
                  <i aria-hidden="true" />
                  {NOM_RARETE[rarete]}
                </span>
              )}
            </span>
          )}
        </span>
        {regle && <p className="loge-fiche-regle">{espacesFines(`${regle}.`)}</p>}
        {/* Le bouton d'or : il prend la première place libre — elle s'allume au-dessus (`.vient`) — ou rend la sienne.
            Éteint par `aria-disabled`, pas `disabled` : il garde son focus et son `:active`, qui fait frémir les places. */}
        <button type="button" className="btn btn-primary loge-fiche-geste" aria-disabled={eteint || undefined} onClick={eteint ? undefined : onBasculer}>
          <Icon name={montre ? 'x' : 'plus'} />
          {montre ? 'Retirer de ma carte' : 'Sur ma carte'}
          {eteint && <span className="sr-only"> : tes trois places sont prises</span>}
        </button>
      </div>
    </li>
  )
}

/** Un objectif commencé : le légendaire en silhouette dorée, ou l'emoji du haut fait — ce qu'on compte, et la jauge. */
export function UnProche({ p }: { p: Proche }) {
  const l = legendaire(p.key)
  const palier = palierDe(p.key)
  // La voie qui le représente : celle qu'il avance le plus. Une voie qui en
  // demande plusieurs à la fois (la Chimère) n'a pas de haut fait à elle :
  // elle se compte en conditions tenues.
  const cleDuHautFait = p.hautFait ?? (l ? hautFaitPrincipal(l) : null)
  const h = l ? (cleDuHautFait ? hautFait(cleDuHautFait) : undefined) : palier?.hautFait
  if (!h && !l) return null
  const titre = l ? l.nom : titreDePalier(palier!.hautFait, palier!.palier)
  const compte = !h
    ? `${p.acquis} conditions sur ${p.requis}`
    : h.famille === 'carriere'
      ? `${formatNumber(p.acquis)} sur ${formatNumber(p.requis)} ${p.requis < 2 ? h.mesureUne : h.mesure}`
      : `${h.title} : ${p.acquis} fois sur ${p.requis}`
  return (
    <div className="approche">
      {l ? (
        <span className="approche-medaillon">
          <Legendaire cle={p.key} verrouille />
        </span>
      ) : (
        <span className="approche-emoji" aria-hidden="true">
          {h?.emoji}
        </span>
      )}
      <div className="approche-corps">
        <b>{titre}</b>
        <span className="muted small">{compte}</span>
        <span className="jauge" aria-label={`${p.acquis} sur ${p.requis}`}>
          <span className="jauge-plein" style={{ width: `${Math.min(100, (p.acquis / p.requis) * 100)}%` }} />
        </span>
      </div>
    </div>
  )
}

/**
 * Le plus simple pour commencer, à qui n'a rien commencé : une série de
 * campagne y suffit, sans personne et à toute heure — Le Lève-tôt demande de
 * jouer avant huit heures, Le Sans-Faute un quiz du jour sans une faute.
 */
const LE_PLUS_SIMPLE = 'hf:alpiniste'

/**
 * Ce que disent « Mon titre » et « Ma vitrine » à qui n'a encore aucun haut
 * fait : « 53 titres à gagner » ne disait pas comment gagner le premier, et
 * le crayon du vestiaire menait à une page sans choix (l'experte du jeu solo,
 * le 11 octobre 2026). Celui qu'il a le plus avancé, avec sa jauge ; sinon le
 * plus simple, sans jauge : « 0 sur 10 » ne s'approche de rien.
 */
export function PremierHautFait({ profil }: { profil: Pick<PublicProfileDetail, 'hautsFaits' | 'legendaires'> }) {
  const proche = lePremierHautFait(profil.hautsFaits, profil.legendaires)
  if (proche) {
    return (
      <div className="proches">
        <span className="label">Le plus proche</span>
        <UnProche p={proche} />
      </div>
    )
  }
  const h = hautFait(LE_PLUS_SIMPLE)
  if (h?.famille !== 'carriere') return null
  return (
    <div className="proches">
      <span className="label">Le plus simple pour commencer</span>
      <div className="approche">
        <span className="approche-emoji" aria-hidden="true">
          {h.emoji}
        </span>
        <div className="approche-corps">
          <b>{titreDePalier(h, 1)}</b>
          <span className="muted small">{`${formatNumber(h.paliers[0])} ${h.paliers[0] < 2 ? h.mesureUne : h.mesure}`}</span>
        </div>
      </div>
    </div>
  )
}
