import { Fragment, useState, type CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { Feuille } from './Pieces'
import { Onglets } from './Onglets'
import { EMBLEME } from './Ecusson'
import { iconeDuSujet } from '../iconeDuSujet'
import { espacesFines } from '../format'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import { FAMILLES_DE_SUJETS, sujetParCle, type Sujet } from '../../../shared/sujets'

/**
 * Ce que joue une partie de la campagne — des catégories, toutes d'office,
 * ou un sujet qui les traverse (`shared/sujets.ts`) —, sur une seule ligne :
 * ce qui est choisi, et « Changer » au bout, qui ouvre la feuille du choix
 * (`FeuilleDuChoix`). La série, « Défier quelqu'un » et le dé la partagent. Les
 * douze catégories et les vingt-cinq sujets, en grille sous les yeux,
 * faisaient trois écrans de cases et repoussaient « Jouer le duel » tout en
 * bas (la remarque du propriétaire du 12 octobre 2026 : « trop
 * impressionnant » ; la proposition 1 de la maquette, validée le même jour).
 */
export function LigneDuChoix({
  categories,
  sujet,
  sur,
  toutes = 'Toutes les catégories',
  detail: detailDonne,
  uneLigne,
  onChanger,
}: {
  categories: readonly string[]
  /** Le sujet choisi : ses catégories restent de côté, sans être oubliées. */
  sujet: string | null
  /** « Sur » devant le choix — la série, où rien d'autre ne le dit ; au défi, « Sur quoi ? » le titre déjà. */
  sur?: boolean
  /** Le nom de « rien de choisi » : toutes les catégories — tout le carnet, au carnet. */
  toutes?: string
  /** Ce que la ligne dit dessous, à la place de ce qu'elle en dirait : au carnet, ce qui y attend. */
  detail?: string
  /** Ce qu'elle dit dessous tient sur une ligne, coupé au bout : le carnet garde les parcours de thème sur le premier écran. */
  uneLigne?: boolean
  onChanger: () => void
}) {
  const leSujet = sujet ? sujetParCle(sujet) : undefined
  const icone: IconName = leSujet ? iconeDuSujet(leSujet) : categories.length === 1 ? (EMBLEME[categories[0]] ?? 'star') : 'sparkles'
  // Plusieurs catégories se nomment par leur nombre (« 4 catégories ») : la ligne d'en dessous les dit.
  const detail =
    detailDonne ?? (leSujet ? leSujet.description : categories.length > 1 ? categories.join(', ') : categories.length === 0 ? 'ou une catégorie, un thème, une époque…' : null)
  return (
    <button type="button" className={'quoi-ligne' + (uneLigne ? ' quoi-une-ligne' : '')} aria-haspopup="dialog" onClick={onChanger}>
      <Icon name={icone} />
      <span className="quoi-texte">
        {sur && <span className="muted small">Sur</span>}
        <b>{nomDuChoix(categories, sujet) ?? toutes}</b>
        {detail && <span className="muted small">{espacesFines(detail)}</span>}
      </span>
      <span className="quoi-changer">
        Changer
        <Icon name="chevron-right" />
      </span>
    </button>
  )
}

/**
 * Ce qu'une case du choix compte, sous son nom — au carnet, ce qui y attend :
 * « 4 à revoir », vif, ou « 9 au carnet » quand rien n'est dû aujourd'hui.
 */
export interface CompteDuChoix {
  texte: string
  vif?: boolean
}

/** Le compte d'une case, s'il en a un : après une espace, que le lecteur d'écran ne colle pas au nom. */
function Compte({ compte }: { compte: CompteDuChoix | undefined }) {
  if (!compte) return null
  return (
    <>
      {' '}
      <span className={'quoi-compte' + (compte.vif ? ' vif' : '')}>{compte.texte}</span>
    </>
  )
}

/**
 * La feuille du choix, par-dessus la page : les catégories — toutes d'un
 * toucher, ou une, ou plusieurs —, puis, dans leur onglet, les thèmes, les
 * époques et les fils rouges, chaque famille sa rangée et son allure
 * (`SujetsDuChoix`). Rien ne change avant « Choisir » : « Fermer » rend le
 * choix d'avant. Sa hauteur ne suit pas son onglet : « Choisir » restait
 * sous le doigt d'un onglet à l'autre. Le carnet la reprend, chaque case
 * disant ce qui y attend (`comptes`).
 */
export function FeuilleDuChoix({
  categoriesJouables,
  sujets,
  categories,
  sujet,
  toutes = 'Toutes les catégories',
  comptes,
  onChoisir,
  onFermer,
}: {
  /** Les catégories que la base sert. */
  categoriesJouables: readonly string[]
  /** Les sujets qui ont de quoi faire une partie ; sans eux, pas d'onglets. */
  sujets: readonly Sujet[]
  categories: readonly string[]
  sujet: string | null
  /** Le nom de « rien de choisi » : toutes les catégories — tout le carnet, au carnet. */
  toutes?: string
  /** Ce que chaque case compte, sous son nom : au carnet, ce qui attend dans chaque catégorie et chaque sujet. */
  comptes?: { toutes?: CompteDuChoix; categories: ReadonlyMap<string, CompteDuChoix>; sujets: ReadonlyMap<string, CompteDuChoix> }
  /** Le choix fait : ses catégories (aucune : toutes), et le sujet qui les laisse de côté s'il y en a un. */
  onChoisir: (categories: string[], sujet: string | null) => void
  onFermer: () => void
}) {
  const [choisies, setChoisies] = useState<string[]>(() => [...categories])
  const [choisi, setChoisi] = useState<string | null>(sujet)
  const [onglet, setOnglet] = useState<'categories' | 'sujets'>(sujet && sujets.length > 0 ? 'sujets' : 'categories')
  const leSujet = choisi ? sujetParCle(choisi) : undefined
  const nom = nomDuChoix(choisies, choisi) ?? toutes.toLowerCase()
  const avecSujets = sujets.length > 0
  // Toucher une catégorie quitte le sujet ; sur un sujet, elle se choisit seule — la basculer retirerait celle qu'on ne voyait plus choisie.
  const basculer = (c: string) => {
    setChoisies(choisi ? [c] : choisies.includes(c) ? choisies.filter(x => x !== c) : [...choisies, c])
    setChoisi(null)
  }
  const aucune = !choisi && choisies.length === 0
  return (
    <Feuille
      titre="Sur quoi ?"
      className="feuille-du-choix"
      onFermer={onFermer}
      pied={
        <>
          {leSujet && <p className="muted small centre quoi-description">{espacesFines(leSujet.description)}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block quoi-choisir"
            onClick={() => {
              onChoisir(choisies, choisi)
              onFermer()
            }}
          >
            {`Choisir · ${nom}`}
          </button>
        </>
      }
    >
      {avecSujets && (
        <Onglets
          onglets={[
            { id: 'categories', nom: 'Catégories' },
            { id: 'sujets', nom: `Thèmes · ${sujets.length}` },
          ]}
          actif={onglet}
          onChoisir={setOnglet}
          label="Choisir parmi"
          idOnglet={o => `quoi-${o}`}
          idPanneau={() => 'quoi-panneau'}
          className="onglets-petits"
        />
      )}
      <div className="quoi-panneau" {...(avecSujets ? { id: 'quoi-panneau', role: 'tabpanel', 'aria-labelledby': `quoi-${onglet}` } : {})}>
        {onglet === 'categories' || !avecSujets ? (
          <>
            <button
              type="button"
              className={'quoi-toutes' + (aucune ? ' active' : '')}
              aria-pressed={aucune}
              onClick={() => {
                setChoisies([])
                setChoisi(null)
              }}
            >
              <Icon name="sparkles" />
              <span>{toutes}</span>
              <Compte compte={comptes?.toutes} />
              {aucune && <Icon name="check" />}
            </button>
            <p className="label">Ou une, ou plusieurs</p>
            <div className="quoi-grille" role="group" aria-label="Catégories">
              {categoriesJouables.map(c => {
                const oui = !choisi && choisies.includes(c)
                return (
                  <button key={c} type="button" className={'quoi-case' + (oui ? ' active' : '')} aria-pressed={oui} onClick={() => basculer(c)}>
                    {c}
                    <Compte compte={comptes?.categories.get(c)} />
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <SujetsDuChoix sujets={sujets} choisi={choisi} comptes={comptes?.sujets} onChoisi={setChoisi} />
        )}
      </div>
    </Feuille>
  )
}

/**
 * L'onglet des thèmes, chaque famille son allure : les thèmes en tuiles, leur
 * emblème dans un médaillon ; les époques en frise, dans l'ordre du temps —
 * la première colonne, puis la seconde ; les fils rouges en pastilles, leur
 * emblème devant. Trente-cinq pastilles toutes pareilles faisaient un mur de
 * mots sur trois écrans (le souhait du propriétaire du 17 octobre 2026 :
 * « plus stylisé, plus agréable à voir »). Toucher de nouveau un sujet le
 * quitte : les catégories reviennent.
 */
function SujetsDuChoix({
  sujets,
  choisi,
  comptes,
  onChoisi,
}: {
  sujets: readonly Sujet[]
  choisi: string | null
  comptes: ReadonlyMap<string, CompteDuChoix> | undefined
  onChoisi: (cle: string | null) => void
}) {
  const basculer = (cle: string) => onChoisi(choisi === cle ? null : cle)
  return (
    <>
      {FAMILLES_DE_SUJETS.map(({ famille, nom: nomDeLaFamille }) => {
        const ici = sujets.filter(s => s.famille === famille)
        if (ici.length === 0) return null
        // La frise remplit ses colonnes de haut en bas : autant de rangs que la moitié de ses époques.
        const rangs = Math.ceil(ici.length / 2)
        return (
          <div key={famille} className="quoi-famille">
            <p className="label quoi-titre">{nomDeLaFamille}</p>
            {famille === 'epoque' ? (
              <div className="quoi-frise" role="group" aria-label={nomDeLaFamille} style={{ '--rangs': rangs } as CSSProperties}>
                {ici.map((s, i) => (
                  <button
                    key={s.cle}
                    type="button"
                    className={
                      'quoi-epoque' +
                      (i % rangs === 0 ? ' quoi-epoque-debut' : '') +
                      (i % rangs === rangs - 1 || i === ici.length - 1 ? ' quoi-epoque-fin' : '') +
                      (choisi === s.cle ? ' active' : '')
                    }
                    aria-pressed={choisi === s.cle}
                    onClick={() => basculer(s.cle)}
                  >
                    <span className="quoi-jalon" />
                    <span className="quoi-nom">
                      {s.nom}
                      <Compte compte={comptes?.get(s.cle)} />
                    </span>
                  </button>
                ))}
              </div>
            ) : famille === 'theme' ? (
              <div className="quoi-tuiles" role="group" aria-label={nomDeLaFamille}>
                {ici.map(s => (
                  <button key={s.cle} type="button" className={'quoi-tuile' + (choisi === s.cle ? ' active' : '')} aria-pressed={choisi === s.cle} onClick={() => basculer(s.cle)}>
                    <span className="quoi-medaillon">
                      <Icon name={iconeDuSujet(s)} />
                    </span>
                    <span className="quoi-nom">
                      {s.nom}
                      <Compte compte={comptes?.get(s.cle)} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="quoi-fils" role="group" aria-label={nomDeLaFamille}>
                {ici.map(s => (
                  <button key={s.cle} type="button" className={'quoi-fil' + (choisi === s.cle ? ' active' : '')} aria-pressed={choisi === s.cle} onClick={() => basculer(s.cle)}>
                    <Icon name={iconeDuSujet(s)} />
                    <span className="quoi-nom">
                      {s.nom}
                      <Compte compte={comptes?.get(s.cle)} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * La grille des catégories seule : le quiz tout prêt glisse ses réglages
 * entre elle et les sujets, qui font trois rangées de plus — dessous, la
 * difficulté se cherchait au fond de la feuille.
 */
export function GrilleDesCategories({
  categoriesJouables,
  categories,
  sujet,
  onCategories,
}: {
  categoriesJouables: readonly string[]
  categories: readonly string[]
  sujet: string | null
  onCategories: (choisies: string[]) => void
}) {
  // Sur un sujet, toucher une catégorie la choisit seule : la basculer retirerait celle qu'on ne voyait plus choisie.
  const basculer = (c: string) => onCategories(sujet ? [c] : categories.includes(c) ? categories.filter(x => x !== c) : [...categories, c])
  const toutes = !sujet && categories.length === 0
  return (
    <div className="categories-grille" role="group" aria-label="Catégories">
      <button type="button" className={'categorie-case' + (toutes ? ' active' : '')} aria-pressed={toutes} onClick={() => onCategories([])}>
        <Icon name="sparkles" />
        Toutes
      </button>
      {categoriesJouables.map(c => {
        const choisie = !sujet && categories.includes(c)
        return (
          <button key={c} type="button" className={'categorie-case' + (choisie ? ' active' : '')} aria-pressed={choisie} onClick={() => basculer(c)}>
            <Icon name={EMBLEME[c] ?? 'star'} />
            {c}
          </button>
        )
      })}
    </div>
  )
}

/** Les colonnes de `.categories-grille`, à toutes les largeurs : la phrase d'un sujet se pose sous la rangée de sa tuile. */
const COLONNES = 3

/**
 * Les sujets, chaque famille sa rangée ; rien sans sujet jouable. La phrase
 * du sujet choisi se lit sous la rangée de sa tuile : sous la dernière des
 * trois familles, elle tombait hors de l'écran — on touchait « Les animaux »
 * sans rien voir s'écrire (l'expert du quiz tout prêt, le 11 octobre 2026).
 */
export function GrilleDesSujets({ sujets, sujet, onSujet }: { sujets: readonly Sujet[]; sujet: string | null; onSujet: (choisi: string | null) => void }) {
  if (sujets.length === 0) return null
  return (
    <div className="campagne-sujets">
      <p className="sujets-titre">Ou un sujet, au-delà des catégories</p>
      {FAMILLES_DE_SUJETS.map(({ famille, nom }) => {
        const ici = sujets.filter(s => s.famille === famille)
        if (ici.length === 0) return null
        const choisi = ici.findIndex(s => s.cle === sujet)
        // La dernière tuile de sa rangée — ou de la famille, sur une rangée qui n'est pas pleine.
        const apres = choisi < 0 ? -1 : Math.min(ici.length, (Math.floor(choisi / COLONNES) + 1) * COLONNES) - 1
        return (
          <div key={famille}>
            <p className="label">{nom}</p>
            <div className="categories-grille" role="group" aria-label={nom}>
              {ici.map((s, i) => (
                <Fragment key={s.cle}>
                  <button
                    type="button"
                    className={'categorie-case' + (sujet === s.cle ? ' active' : '')}
                    aria-pressed={sujet === s.cle}
                    onClick={() => onSujet(sujet === s.cle ? null : s.cle)}
                  >
                    <Icon name={iconeDuSujet(s)} />
                    {s.nom}
                  </button>
                  {i === apres && <p className="muted small sujet-phrase">{espacesFines(ici[choisi].description)}</p>}
                </Fragment>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
