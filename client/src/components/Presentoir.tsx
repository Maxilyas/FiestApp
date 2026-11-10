import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon } from './Icon'
import { Avatar } from './Avatar'
import { Feuille } from './Pieces'
import { etatDuTheme, gemme } from './Boutique'
import { FicheDuCompagnon, dansLaPhrase } from './RayonDesCompagnons'
import { SaCarte, etatDuFond } from './RayonDesFonds'
import { LigneDePlaque } from './MaPlaque'
import { OBJETS } from './Objets'
import type { Comptoir } from './Comptoir'
import type { ChoixDuProfil } from './choix'
import { apercuDe } from '../apercus'
import { motifDe } from '../api'
import { espacesFines } from '../format'
import { abonnerNiche, nicheActuelle } from '../niche'
import { jusquAuBoutDeSaSaison } from '../../../shared/aLaUne'
import { PRIX_D_UN_COMPAGNON, compagnon as leCompagnon, formesDeLEclat } from '../../../shared/compagnons'
import type { Envie } from '../../../shared/envie'
import { PRIX_D_UN_FOND, fond as leFond } from '../../../shared/fonds'
import type { EssaiDeLaBoutique } from '../../../shared/panier'
import { plaqueDuTheme } from '../../../shared/plaques'
import type { PublicProfileDetail } from '../../../shared/profil'
import { enConfettis, gestesDuPresentoir, rangDansLeRayon, voisinDansLeRayon, type EtapeDuPresentoir, type EtatDeLArticle, type GesteDuPresentoir } from '../../../shared/rayons'
import { avatarDeLApercu } from '../../../shared/sonAvatar'
import { NOM_DE_RARETE, prixDe, theme as leTheme } from '../../../shared/themes'

// Le présentoir de la boutique (la refonte du 10 novembre 2026, la maquette
// validée par le propriétaire) : une seule feuille pour les quatre rayons, qui
// monte du bas. Un thème, un compagnon, un fond, un objet s'y montrent de la
// même façon — son image à gauche, ce qu'il est et son prix à droite, ses
// gestes au pied, sous le pouce —, là où chaque rayon avait sa fiche et sa
// mise en page : un thème dans une feuille, un fond sous sa carte, dans la
// page, un objet dans une autre feuille.
//
// Sa barre feuillette le rayon (‹ ›, « 3 sur 22 ») sans refermer la feuille,
// et porte l'étoile de son envie (`shared/envie.ts`). L'achat s'y fait en
// deux touchers, au même endroit : « L'acheter », qui ne dépense rien, puis
// « Confirmer » ; puis ce qu'on en fait, « Le porter » ou « Plus tard ». Un
// dialogue posé par-dessus la feuille demandait de lire trois boutons —
// « Acheter et porter », « L'acheter seulement », « Plus tard » — avant
// d'avoir rien acheté. Les règles de ses gestes sont pures
// (`gestesDuPresentoir`, `shared/rayons.ts`).

/** Ce qu'il vient d'acheter, et ce qu'il reste à en dire. */
interface Achete {
  /** Combien : plusieurs vies d'un coup. */
  nombre: number
  /** Un compagnon que sa niche a accueilli d'office : rien à choisir. */
  installe?: boolean
  /** Celui qui garde sa niche, quand un autre y vivait déjà. */
  resteLa?: string | null
}

/** Son prix en grand, et ce qu'il fait de son solde : ce qui lui restera, ou ce qui manque encore. */
function LePrix({ prix, solde }: { prix: number; solde: number }) {
  return (
    <div className="presentoir-prix">
      <b>{enConfettis(prix)}</b>
      {prix <= solde ? <span>{`Il t’en restera ${enConfettis(solde - prix)}`}</span> : <span className="presentoir-manque">{`Encore ${enConfettis(prix - solde)} à gagner`}</span>}
    </div>
  )
}

/** Ce qu'il a déjà : une coche, et ce qu'il en fait. */
function ALui({ children }: { children: ReactNode }) {
  return (
    <p className="presentoir-a-toi">
      <Icon name="check" />
      <span>{children}</span>
    </p>
  )
}

export function Presentoir({
  profil,
  ouvert,
  etapeDeDepart = 'fiche',
  rayon,
  essai,
  busy,
  comptoir,
  onVoisin,
  onEssayer,
  onEnvie,
  acheter,
  acheterCompagnon,
  acheterFond,
  enregistrer,
  onPorte,
  onFermer,
}: {
  profil: PublicProfileDetail
  /** L'article montré : sa sorte, et sa clé dans son catalogue. */
  ouvert: Envie
  /** Ouvert sur « Confirmer » : « Garder », dans la barre de l'essai — le premier toucher est déjà donné. */
  etapeDeDepart?: 'fiche' | 'confirmer'
  /** Les articles de son rayon, dans l'ordre : ce que ses flèches feuillettent. */
  rayon: readonly string[]
  essai: EssaiDeLaBoutique
  busy: boolean
  comptoir: Comptoir
  onVoisin: (cle: string) => void
  onEssayer: (sorte: 'theme' | 'compagnon', cle: string) => void
  /** Pose son envie, ou la retire : rend le refus du serveur, ou null. */
  onEnvie: (envie: Envie | null) => Promise<string | null>
  /** Achètent sans porter — le présentoir le propose ensuite : rendent le motif d'un refus, ou null. */
  acheter: (cle: string, porter: boolean) => Promise<string | null>
  acheterCompagnon: (cle: string, installer: boolean) => Promise<string | null>
  acheterFond: (cle: string, porter: boolean) => Promise<string | null>
  /** Porte ce qu'il vient d'acheter : vrai s'il a pris. Absent d'une page qui ne sait pas l'enregistrer : elle ne propose rien. */
  enregistrer?: (patch: ChoixDuProfil) => Promise<boolean> | void
  /** Porté : l'essai qui le montrait devient le sien. */
  onPorte?: (article: Envie) => void
  onFermer: () => void
}) {
  const id = `${ouvert.sorte}:${ouvert.cle}`
  // L'étape vaut pour un article : feuilleté, le présentoir repart de la fiche du suivant.
  const [pas, setPas] = useState<{ pour: string; etape: EtapeDuPresentoir; nombre: number; achete?: Achete }>({ pour: id, etape: etapeDeDepart, nombre: 1 })
  const [erreur, setErreur] = useState('')
  /** Un achat, un enregistrement en route : un à la fois, quoi que dise la page. */
  const enRoute = useRef(false)
  const gestesAuPied = useRef<HTMLDivElement>(null)
  // Celui qui vit dans sa niche — l'essai n'y change rien : un compagnon adopté s'y installe s'il n'y a personne.
  const nicheIci = useSyncExternalStore(abonnerNiche, nicheActuelle, () => null)
  const ici = pas.pour === id ? pas : { pour: id, etape: 'fiche' as const, nombre: 1 }

  // D'une étape à l'autre, le geste attendu change sous le doigt : le focus le suit — au clavier, il serait tombé sur la page
  // avec le bouton d'avant. Pas à l'ouverture : la feuille prend le sien (`useModale`).
  const premiere = useRef(true)
  useEffect(() => {
    if (premiere.current) {
      premiere.current = false
      return
    }
    gestesAuPied.current?.querySelector<HTMLElement>('.btn-primary')?.focus({ preventScroll: true })
  }, [ici.etape])

  const boutique = profil.boutique
  if (!boutique) return null
  const solde = boutique.confettis.solde
  const dansLaNiche = nicheIci?.compagnon ?? profil.niche

  // ── Ce qu'il est, sorte par sorte : son nom, son prix, ce qu'il est pour lui ──
  const t = ouvert.sorte === 'theme' ? leTheme(ouvert.cle) : undefined
  const c = ouvert.sorte === 'compagnon' ? leCompagnon(ouvert.cle) : undefined
  const f = ouvert.sorte === 'fond' ? leFond(ouvert.cle) : undefined
  const o = ouvert.sorte === 'objet' ? OBJETS.find(x => x.cle === ouvert.cle) : undefined
  const etatDuT = t ? etatDuTheme(t, profil.theme ?? 'velours', new Set(boutique.possedes), solde, boutique.jour) : null
  const sien = c ? boutique.compagnons?.find(a => a.compagnon === c.key) : undefined
  const etatDuF = f ? etatDuFond(f, profil.fond ?? null, new Set(profil.fonds ?? []), solde) : null
  const maximum = o ? comptoir.maximum(o) : 1
  const nombre = Math.max(1, Math.min(ici.nombre, maximum))
  const nom = t?.nom ?? c?.nom ?? f?.nom ?? o?.nom
  if (!nom) return null
  const aLUnite = t ? prixDe(t) : c ? PRIX_D_UN_COMPAGNON : f ? PRIX_D_UN_FOND : (o?.prix ?? 0)
  const prix = aLUnite * nombre
  const etat: EtatDeLArticle = t
    ? etatDuT === 'a-vendre' || etatDuT === 'trop-cher'
      ? etatDuT
      : etatDuT === 'porte' || etatDuT === 'a-toi'
        ? 'a-toi'
        : 'ferme'
    : c
      ? sien
        ? 'a-toi'
        : solde >= aLUnite
          ? 'a-vendre'
          : 'trop-cher'
      : f
        ? etatDuF === 'a-vendre' || etatDuF === 'trop-cher'
          ? etatDuF
          : 'a-toi'
        : maximum < 1
          ? 'ferme'
          : solde >= aLUnite
            ? 'a-vendre'
            : 'trop-cher'
  const enVente = etat === 'a-vendre' || etat === 'trop-cher'
  const manque = etat === 'a-vendre' ? Math.max(0, prix - solde) : 0
  // « Garder », ouvert sur « Confirmer », retombe sur la fiche quand il n'a pas de quoi : elle dit ce qui manque.
  const etape: EtapeDuPresentoir = ici.etape === 'confirmer' && (etat !== 'a-vendre' || manque > 0) ? 'fiche' : ici.etape
  const sonEnvie = boutique.envie?.sorte === ouvert.sorte && boutique.envie.cle === ouvert.cle
  const aLEssai = (ouvert.sorte === 'theme' && essai.theme === ouvert.cle) || (ouvert.sorte === 'compagnon' && essai.compagnon === ouvert.cle)
  const achete = etape === 'achete' ? ici.achete : undefined
  // Un compagnon vit déjà dans sa niche : adopté, celui-ci attend son tour, et il choisit ensuite qui y grandit.
  const autre = c && dansLaNiche && dansLaNiche !== c.key ? profil.compagnons?.find(a => a.compagnon === dansLaNiche) : undefined
  const resident = autre ? ((nicheIci?.compagnon === autre.compagnon ? nicheIci.nom : autre.nom) ?? dansLaPhrase(leCompagnon(autre.compagnon)!)) : null

  const gestes = gestesDuPresentoir({
    sorte: ouvert.sorte,
    etape,
    etat,
    prix,
    manque,
    aLEssai,
    sonEnvie,
    aPorter: ouvert.sorte !== 'objet' && !achete?.installe && !!enregistrer,
  })
  const rang = etape === 'fiche' ? rangDansLeRayon(rayon, ouvert.cle) : null
  const precedent = rang && voisinDansLeRayon(rayon, ouvert.cle, -1)
  const suivant = rang && voisinDansLeRayon(rayon, ouvert.cle, 1)

  const aller = (etapeVoulue: EtapeDuPresentoir, fait?: Achete) => {
    setErreur('')
    setPas({ pour: id, etape: etapeVoulue, nombre, achete: fait })
  }
  /** Un geste qui attend le serveur : un à la fois, et son refus se dit au pied de la feuille. */
  const attendre = async (geste: () => Promise<string | null>): Promise<boolean> => {
    if (busy || enRoute.current) return false
    enRoute.current = true
    setErreur('')
    try {
      const refus = await geste()
      if (refus) setErreur(refus)
      return !refus
    } finally {
      enRoute.current = false
    }
  }
  const basculerLEnvie = () => void attendre(() => onEnvie(sonEnvie ? null : ouvert))
  const confirmer = async () => {
    // Sa niche vide accueille celui qu'il adopte ; habitée, elle garde le sien jusqu'à son choix.
    const installe = !!c && !resident
    const pris = await attendre(async () => {
      if (t) return acheter(t.key, false)
      if (c) return acheterCompagnon(c.key, installe)
      if (f) return acheterFond(f.key, false)
      try {
        await comptoir.acheter(o!, nombre)
        return null
      } catch (e) {
        return motifDe(e)
      }
    })
    if (!pris) return
    // Un objet se rachète : son envie tenue, c'est la page qui la retire (`shared/envie.ts`).
    if (o && sonEnvie) void onEnvie(null)
    aller('achete', { nombre, installe, resteLa: resident })
  }
  const porter = async () => {
    if (!enregistrer) return
    const porte = await attendre(async () => {
      const pris = await enregistrer(t ? { theme: t.key } : c ? { niche: c.key } : { fond: f!.key })
      return pris === false ? 'Ça n’a pas pris. Réessaie, ou porte-le depuis ta loge.' : null
    })
    if (!porte) return
    onPorte?.(ouvert)
    onFermer()
  }
  const agir = (g: GesteDuPresentoir) => {
    if (g.eteint) return
    if (g.geste === 'fermer') return onFermer()
    if (g.geste === 'essayer') return onEssayer(ouvert.sorte as 'theme' | 'compagnon', ouvert.cle)
    if (g.geste === 'envie') return basculerLEnvie()
    if (g.geste === 'acheter') return aller('confirmer')
    if (g.geste === 'annuler') return aller('fiche')
    if (g.geste === 'confirmer') return void confirmer()
    return void porter()
  }

  // ── Ce qu'elle montre ──
  const possede = o ? comptoir.possede(o) : null
  // L'Éclat se montre sur ce qu'il porte, sauf un Divin, qui n'en prend pas : l'aperçu se tait (`avatarDeLApercu`).
  const lui = o?.cle === 'eclat' ? avatarDeLApercu(profil) : null
  // Un compagnon éclaté ne change que de paillettes : sa version rare est sa métamorphose (`formesDeLEclat`).
  const metamorphose = lui && formesDeLEclat(lui.legendaire)
  const fin = t ? jusquAuBoutDeSaSaison(t) : null
  const ilResteDit = `Il te reste ${enConfettis(solde)}.`

  const corps = achete ? (
    <div className="presentoir-acquis" role="status">
      <span className="presentoir-coche" aria-hidden="true">
        <Icon name="check" />
      </span>
      <h3 className="presentoir-nom">
        {o
          ? o.cle === 'vie'
            ? `${achete.nombre > 1 ? `${achete.nombre} vies ajoutées` : 'Une vie ajoutée'} à ta réserve`
            : o.cle === 'sablier'
              ? `${achete.nombre > 1 ? `${achete.nombre} sabliers gardent` : 'Un sablier garde'} ta série`
              : 'Ton Éclat t’attend en réserve'
          : `${nom} est à toi`}
      </h3>
      <p>
        {c && achete.installe && espacesFines(`${c.le === 'la' ? 'Elle' : 'Il'} s’installe dans ta niche, en haut de tes pages. `)}
        {c && !achete.installe && achete.resteLa && espacesFines(`${achete.resteLa.charAt(0).toUpperCase()}${achete.resteLa.slice(1)} garde ta niche : c’est celui de ta niche qui grandit. `)}
        {ilResteDit}
      </p>
      {c && achete.installe && (
        <a className="link-inline" href="/profil#compagnon">
          Lui donner un nom
        </a>
      )}
      {o && (
        <a className="link-inline" href={o.cle === 'vie' ? '/campagne#sentiers' : o.cle === 'sablier' ? '/jour' : '/profil#avatar'}>
          {o.cle === 'vie' ? 'Les sentiers' : o.cle === 'sablier' ? 'Le quiz du jour' : 'Le dépenser dans ma loge'}
        </a>
      )}
    </div>
  ) : c ? (
    <FicheDuCompagnon key={c.key} c={c} sien={sien} porte={profil.legendaire} dansLaNiche={dansLaNiche === c.key} busy={busy} onInstaller={enregistrer && (() => void enregistrer({ niche: c.key }))}>
      {!sien && <LePrix prix={prix} solde={solde} />}
    </FicheDuCompagnon>
  ) : (
    <div className="presentoir-corps" style={t ? gemme(t.rarete) : undefined}>
      <div className="presentoir-fiche">
        {t && (
          <span className="presentoir-image presentoir-apercu">{apercuDe(t.key) && <img src={apercuDe(t.key)} alt={`Une question sous le thème ${t.nom}`} width={180} height={225} decoding="async" />}</span>
        )}
        {f && (
          <span className="presentoir-image presentoir-carte">
            <SaCarte f={f} profil={profil} />
          </span>
        )}
        {o && <span className={`presentoir-image presentoir-objet objet-dessin objet-${o.cle}`}>{o.dessin()}</span>}
        {/* Feuilleté par ses flèches, le présentoir reste la même fenêtre : le lecteur d'écran n'entendrait rien du suivant. */}
        <div className="presentoir-texte" aria-live="polite">
          <span className="presentoir-sorte">
            {t && <i className="article-gemme" aria-hidden="true" />}
            {t ? `Thème · ${NOM_DE_RARETE[t.rarete]}${fin && enVente ? ` · ${fin}` : ''}` : f ? `Fond de carte · ${f.savoir}` : o!.pour}
          </span>
          <h3 className="presentoir-nom">{nom}</h3>
          <p>{t ? t.humeur : f ? espacesFines('Le décor de ta carte, quand quelqu’un touche ton nom.') : o!.dit}</p>
          {possede && <p className="presentoir-possede">{`Tu en as : ${possede.long}`}</p>}
          {enVente && <LePrix prix={prix} solde={solde} />}
          {etatDuT === 'porte' && <ALui>{`${nom} habille tes pages.`}</ALui>}
          {etatDuT === 'a-toi' && (
            <ALui>
              {'À toi : '}
              <a className="link-inline" href="/profil#theme">
                le porter
              </a>
              {' quand tu veux.'}
            </ALui>
          )}
          {etatDuF === 'porte' && <ALui>Il tapisse ta carte.</ALui>}
          {etatDuF === 'a-toi' && (
            <ALui>
              {'À toi : '}
              <a className="link-inline" href={`/profil?essayer=${f!.key}#fond`}>
                le porter
              </a>
              {' quand tu veux.'}
            </ALui>
          )}
        </div>
      </div>
      {/* L'Éclat, sur son avatar : tel qu'il est, puis éclaté. */}
      {lui?.avatar && (
        <span className="comptoir-eclat" aria-hidden="true">
          <Avatar {...lui} {...(metamorphose && { legendaire: metamorphose.avant })} eclat={false} finition={profil.finition} className="comptoir-eclat-avant" />
          <Icon name="arrow-right" />
          <Avatar {...lui} {...(metamorphose && { legendaire: metamorphose.apres })} eclat finition={profil.finition} className="comptoir-eclat-apres" />
        </span>
      )}
      {/* Combien : la place qui reste pour le sablier. Figé à « Confirmer » : c'est ce nombre qu'on confirme. */}
      {o && enVente && maximum > 1 && etape === 'fiche' && (
        <div className="presentoir-quantite">
          <span className="vies-pas" role="group" aria-label={`Combien : ${o.compte(nombre)}`}>
            <button type="button" className="vies-pas-btn" aria-label="Un de moins" disabled={nombre <= 1} onClick={() => setPas({ ...ici, nombre: nombre - 1 })}>
              −
            </button>
            <output aria-live="polite">{nombre}</output>
            <button type="button" className="vies-pas-btn" aria-label="Un de plus" disabled={nombre >= maximum} onClick={() => setPas({ ...ici, nombre: nombre + 1 })}>
              +
            </button>
          </span>
          <span className="small">{`${o.compte(nombre)} · ${enConfettis(prix)}`}</span>
        </div>
      )}
      {/* Sa plaque : la part du thème que les autres voient, montrée sur sa propre ligne (`shared/plaques.ts`). */}
      {t && plaqueDuTheme(t.key) && (
        <div className="presentoir-plaque">
          <span className="label">Sa plaque · les autres te verront ainsi</span>
          <LigneDePlaque profil={profil} plaque={t.key} />
        </div>
      )}
      {t && enVente && (
        <p className="presentoir-dit">
          {espacesFines('Il habille toutes tes pages ; l’écran commun garde le sien.')}
          {t.saison && ` En boutique ${t.saison.periode}, et gardé toute l’année.`}
        </p>
      )}
      {/* Ouvert par son adresse hors de sa saison, ou un thème qui se gagne : la fiche dit pourquoi rien ne s'y achète. */}
      {etatDuT === 'hors-saison' && t?.saison && <p className="presentoir-dit">{`En boutique ${t.saison.periode} seulement — acheté, il se garde toute l’année.`}</p>}
      {etatDuT === 'a-gagner' && t?.gagne && (
        <p className="presentoir-dit">
          {espacesFines(`Il ne se vend pas : il se gagne avec ${t.gagne.regle}. `)}
          <a className="link-inline" href={t.gagne.ou.lien}>
            {t.gagne.ou.nom}
          </a>
        </p>
      )}
      {o && etat === 'ferme' && (
        <p className="presentoir-dit" role="status">
          {o.plein ?? 'Tu en as autant qu’il se peut.'}
        </p>
      )}
    </div>
  )

  return (
    <Feuille
      titre={nom}
      onFermer={onFermer}
      className="feuille-boutique"
      barre={
        <div className="presentoir-barre">
          {precedent && suivant && (
            <>
              <button type="button" className="presentoir-rond" aria-label="Le précédent" onClick={() => onVoisin(precedent)}>
                <Icon name="arrow-left" />
              </button>
              <button type="button" className="presentoir-rond" aria-label="Le suivant" onClick={() => onVoisin(suivant)}>
                <Icon name="arrow-right" />
              </button>
            </>
          )}
          <span className="presentoir-rang">{rang ? `${rang.rang} sur ${rang.sur}` : ''}</span>
          {/* Un interrupteur : son nom ne change pas, `aria-pressed` dit si c'est son envie. */}
          {enVente && etape === 'fiche' && (
            <button type="button" className="presentoir-rond presentoir-etoile" aria-pressed={sonEnvie} aria-label="En faire mon envie" onClick={basculerLEnvie}>
              <Icon name="star" />
            </button>
          )}
        </div>
      }
      pied={
        <>
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
          <div ref={gestesAuPied} className={'presentoir-gestes' + (gestes.length === 1 ? ' presentoir-geste-seul' : '')}>
            {gestes.map(g => (
              <button key={g.geste} type="button" className={`btn ${g.principal ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={g.presse} aria-disabled={g.eteint || (busy && g.geste !== 'fermer') || undefined} onClick={() => agir(g)}>
                {g.geste === 'envie' && <Icon name="star" />}
                {g.nom}
              </button>
            ))}
          </div>
        </>
      }
    >
      {corps}
    </Feuille>
  )
}
