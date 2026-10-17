import { Fragment, useState, type CSSProperties } from 'react'
import { Icon, type IconName } from './Icon'
import { Feuille } from './Pieces'
import { Onglets } from './Onglets'
import { EMBLEME } from './Ecusson'
import { iconeDuSujet } from '../iconeDuSujet'
import { espacesFines } from '../format'
import { nomDuChoix } from '../../../shared/nomDuChoix'
import { FAMILLES_DE_SUJETS, fetesDansLOrdre, rubriquesDeLaCategorie, sujetParCle, type FamilleDeSujet, type Sujet } from '../../../shared/sujets'

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
 * toucher, ou une, ou plusieurs ; une seule s'affine en ses rubriques, sous
 * sa rangée (`RubriquesDuChoix`) —, puis, dans leur onglet, les thèmes, les
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
  /** Les sujets et les rubriques qui ont de quoi faire une partie ; sans sujet, pas d'onglets. */
  sujets: readonly Sujet[]
  categories: readonly string[]
  sujet: string | null
  /** Le nom de « rien de choisi » : toutes les catégories — tout le carnet, au carnet. */
  toutes?: string
  /** Ce que chaque case compte, sous son nom : au carnet, ce qui attend dans chaque catégorie, chaque sujet et chaque rubrique. */
  comptes?: { toutes?: CompteDuChoix; categories: ReadonlyMap<string, CompteDuChoix>; sujets: ReadonlyMap<string, CompteDuChoix> }
  /** Le choix fait : ses catégories (aucune : toutes), et le sujet qui les laisse de côté s'il y en a un. */
  onChoisir: (categories: string[], sujet: string | null) => void
  onFermer: () => void
}) {
  const transverses = sujets.filter(s => s.famille !== 'rubrique')
  const servis = new Map(sujets.map(s => [s.cle, s]))
  const [choisies, setChoisies] = useState<string[]>(() => [...categories])
  const [choisi, setChoisi] = useState<string | null>(sujet)
  // Sur une rubrique, la feuille s'ouvre sur sa catégorie : elle vit sous elle, pas dans l'onglet des thèmes. Le sujet
  // qui en tient une aussi, s'il y a été choisi (`sousSaCategorie`).
  const [onglet, setOnglet] = useState<'categories' | 'sujets'>(
    sujet && transverses.some(s => s.cle === sujet) && !sousSaCategorie(sujetParCle(sujet), categories) ? 'sujets' : 'categories',
  )
  const leSujet = choisi ? sujetParCle(choisi) : undefined
  const rubrique = sousSaCategorie(leSujet, choisies)
  const nom = nomDuChoix(choisies, choisi) ?? toutes.toLowerCase()
  const avecSujets = transverses.length > 0
  // Toucher une catégorie quitte le sujet ; sur un sujet, elle se choisit seule — la basculer retirerait celle qu'on ne voyait plus choisie.
  // Sur une rubrique, sa catégorie touchée se rejoue entière.
  const basculer = (c: string) => {
    setChoisies(choisi ? [c] : choisies.includes(c) ? choisies.filter(x => x !== c) : [...choisies, c])
    setChoisi(null)
  }
  // Une rubrique touchée garde sa catégorie choisie : la quitter la rend entière.
  const choisirRubrique = (cle: string | null, categorie: string) => {
    setChoisies([categorie])
    setChoisi(cle)
  }
  const aucune = !choisi && choisies.length === 0
  // La catégorie qui s'affine : la seule choisie, ou celle de la rubrique choisie.
  const affinee = rubrique?.categorie ?? (!choisi && choisies.length === 1 ? choisies[0] : null)
  const sesRubriques = affinee ? rubriquesDeLaCategorie(affinee).flatMap(cle => servis.get(cle) ?? []) : []
  const apres = sesRubriques.length > 0 ? finDeRangee(categoriesJouables.indexOf(affinee!), categoriesJouables.length, COLONNES_DE_LA_FEUILLE) : -1
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
            { id: 'sujets', nom: `Thèmes · ${transverses.length}` },
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
              {categoriesJouables.map((c, i) => {
                const oui = (!choisi && choisies.includes(c)) || rubrique?.categorie === c
                return (
                  <Fragment key={c}>
                    <button type="button" className={'quoi-case' + (oui ? ' active' : '')} aria-pressed={oui} onClick={() => basculer(c)}>
                      {c}
                      <Compte compte={comptes?.categories.get(c)} />
                    </button>
                    {i === apres && (
                      <RubriquesDuChoix categorie={affinee!} rubriques={sesRubriques} choisi={choisi} comptes={comptes?.sujets} onChoisi={cle => choisirRubrique(cle, affinee!)} />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </>
        ) : (
          <SujetsDuChoix sujets={transverses} choisi={choisi} comptes={comptes?.sujets} onChoisi={setChoisi} />
        )}
      </div>
    </Feuille>
  )
}

/** Les sujets d'une famille, dans l'ordre de leur rangée : les fêtes de la plus proche à la plus lointaine, les autres dans celui du catalogue. */
const deLaFamille = (sujets: readonly Sujet[], famille: FamilleDeSujet): readonly Sujet[] => {
  const ici = sujets.filter(s => s.famille === famille)
  return famille === 'fete' ? fetesDansLOrdre(ici, new Date()) : ici
}

/**
 * L'onglet des thèmes, chaque famille son allure : les fêtes, les thèmes et
 * les univers en tuiles, leur emblème dans un médaillon — la fête la plus
 * proche d'abord ;
 * les époques en frise, dans l'ordre du temps — la première colonne, puis la
 * seconde ; les pays et les fils rouges en pastilles, leur emblème devant. Trente-cinq
 * pastilles toutes pareilles faisaient un mur de mots sur trois écrans (le
 * souhait du propriétaire du 17 octobre 2026 : « plus stylisé, plus agréable
 * à voir »). Toucher de nouveau un sujet le quitte : les catégories
 * reviennent.
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
        const ici = deLaFamille(sujets, famille)
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
            ) : famille === 'theme' || famille === 'fete' || famille === 'univers' ? (
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

/** Les colonnes de `.quoi-grille`, à toutes les largeurs : les rubriques d'une catégorie se posent sous la rangée de sa case. */
const COLONNES_DE_LA_FEUILLE = 2

/**
 * Le sujet choisi, s'il se range sous sa catégorie : une rubrique, toujours ;
 * le sujet qui en tient une, s'il a été touché sous elle — sa catégorie seule
 * choisie avec lui. Touché parmi les thèmes, il y reste : sa catégorie
 * s'ouvrait d'elle-même au-dessus de la tuile, dans le quiz tout prêt, et la
 * repoussait sous le doigt.
 */
const sousSaCategorie = (s: Sujet | undefined, categories: readonly string[]): Sujet | undefined =>
  s?.categorie && (s.famille === 'rubrique' || (categories.length === 1 && categories[0] === s.categorie)) ? s : undefined

/** La dernière case de la rangée où tombe la case `i` — ou la dernière de toutes, sur une rangée qui n'est pas pleine. */
const finDeRangee = (i: number, cases: number, colonnes: number) => Math.min(cases, (Math.floor(i / colonnes) + 1) * colonnes) - 1

/**
 * Les rubriques d'une catégorie choisie seule — « Sport », puis
 * « Football » —, en pastilles sous la rangée de sa case, de toute la largeur
 * de la grille. Toucher une rubrique la choisit ; la toucher encore rend la
 * catégorie entière. Elles ne viennent qu'à une catégorie choisie seule :
 * douze catégories dépliées feraient près de cent pastilles, le mur de mots
 * d'avant.
 */
function RubriquesDuChoix({
  categorie,
  rubriques,
  choisi,
  comptes,
  onChoisi,
}: {
  categorie: string
  rubriques: readonly Sujet[]
  choisi: string | null
  comptes?: ReadonlyMap<string, CompteDuChoix>
  onChoisi: (cle: string | null) => void
}) {
  return (
    <div className="quoi-rubriques" role="group" aria-label={`Ou seulement, dans ${categorie}`}>
      <span className="label">Ou seulement</span>
      {rubriques.map(r => (
        <button key={r.cle} type="button" className={'quoi-rubrique' + (choisi === r.cle ? ' active' : '')} aria-pressed={choisi === r.cle} onClick={() => onChoisi(choisi === r.cle ? null : r.cle)}>
          {r.nom}
          <Compte compte={comptes?.get(r.cle)} />
        </button>
      ))}
    </div>
  )
}

/**
 * La grille des catégories seule : le quiz tout prêt glisse ses réglages
 * entre elle et les sujets, qui font trois rangées de plus — dessous, la
 * difficulté se cherchait au fond de la feuille. Une catégorie choisie seule
 * s'y affine en ses rubriques, comme dans la feuille du choix.
 */
export function GrilleDesCategories({
  categoriesJouables,
  categories,
  sujet,
  rubriques = [],
  onCategories,
  onSujet,
}: {
  categoriesJouables: readonly string[]
  categories: readonly string[]
  sujet: string | null
  /** Les rubriques que la base sert, et les sujets qui en tiennent une ; sans elles, ou sans `onSujet`, une catégorie ne s'affine pas. */
  rubriques?: readonly Sujet[]
  onCategories: (choisies: string[]) => void
  onSujet?: (choisi: string | null) => void
}) {
  // Sur un sujet, toucher une catégorie la choisit seule : la basculer retirerait celle qu'on ne voyait plus choisie.
  const basculer = (c: string) => onCategories(sujet ? [c] : categories.includes(c) ? categories.filter(x => x !== c) : [...categories, c])
  const toutes = !sujet && categories.length === 0
  const leSujet = sujet ? sujetParCle(sujet) : undefined
  const rubrique = sousSaCategorie(leSujet, categories)
  const affinee = rubrique?.categorie ?? (!sujet && categories.length === 1 ? categories[0] : null)
  const servies = new Map(rubriques.map(r => [r.cle, r]))
  const sesRubriques = affinee && onSujet ? rubriquesDeLaCategorie(affinee).flatMap(cle => servies.get(cle) ?? []) : []
  // « Toutes » tient la première case : la rangée d'une catégorie se compte avec elle.
  const apres = sesRubriques.length > 0 ? finDeRangee(categoriesJouables.indexOf(affinee!) + 1, categoriesJouables.length + 1, COLONNES) - 1 : -1
  return (
    <div className="categories-grille" role="group" aria-label="Catégories">
      <button type="button" className={'categorie-case' + (toutes ? ' active' : '')} aria-pressed={toutes} onClick={() => onCategories([])}>
        <Icon name="sparkles" />
        Toutes
      </button>
      {categoriesJouables.map((c, i) => {
        // Sur un sujet, aucune catégorie ne se dit choisie ; sur une rubrique, la sienne : elle en est un morceau.
        const choisie = !sujet && categories.includes(c)
        const pressee = choisie || rubrique?.categorie === c
        return (
          <Fragment key={c}>
            <button type="button" className={'categorie-case' + (pressee ? ' active' : '')} aria-pressed={pressee} onClick={() => basculer(c)}>
              <Icon name={EMBLEME[c] ?? 'star'} />
              {c}
            </button>
            {i === apres && (
              <RubriquesDuChoix
                categorie={affinee!}
                rubriques={sesRubriques}
                choisi={sujet}
                onChoisi={cle => {
                  // Sa catégorie seule d'abord, qui quitte le sujet ; puis la rubrique, ou rien : la catégorie entière.
                  onCategories([affinee!])
                  onSujet!(cle)
                }}
              />
            )}
          </Fragment>
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
        const ici = deLaFamille(sujets, famille)
        if (ici.length === 0) return null
        const choisi = ici.findIndex(s => s.cle === sujet)
        const apres = choisi < 0 ? -1 : finDeRangee(choisi, ici.length, COLONNES)
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
