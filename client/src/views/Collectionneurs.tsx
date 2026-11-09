import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { api, motifDe, UnauthorizedError } from '../api'
import { Feuille, MenuBarre, PieceTete, Sortie } from '../components/Pieces'
import { Avatar, Dessin } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { BlasonDeLigue } from '../components/Blason'
import { useCarteDUnProfil } from '../components/CarteDUnProfil'
import { gemmeDAvatar } from '../gemmes'
import { formatNumber, rang } from '../format'
import { avatarDeLAlbum, NOM_COURT_DE_RARETE_D_AVATAR, NOM_DE_RARETE_D_AVATAR, RARETES_D_AVATAR, type RareteDAvatar } from '../../../shared/album'
import { BRANCHES, branche, portrait } from '../../../shared/branches'
import { legendaire } from '../../../shared/legendaires'
import { formeDeCompagnon } from '../../../shared/compagnons'
import { DIVINS, divin } from '../../../shared/divins'
import { NOM_DE_LA_MATIERE, estUneMatiere } from '../../../shared/matieres'
import {
  CARATS_DE_LA_GEMME,
  CARATS_DE_LA_LIGUE,
  CARATS_DU_SCEAU,
  CARATS_D_UNE_FINITION,
  CARATS_D_UNE_GERBE,
  CARATS_D_UN_ECLAT,
  CARATS_D_UN_FOND,
  CARATS_D_UN_MAITRE,
  CARATS_D_UN_TIMBRE,
  CARATS_D_UN_TROPHEE,
  CATEGORIE,
  CATEGORIES_DE_COLLECTION,
  bilanDuFaceAFace,
  celuiAPasser,
  classerLesCollectionneurs,
  lignesDuFaceAFace,
  rangDeCollection,
  valeurDansLaCategorie,
  type CategorieDeCollection,
  type ClassementDesCollections,
  type FicheDeCollectionneur,
  type PieceDeVitrine,
  type PlaceDeCollectionneur,
  type VitrineDUnCollectionneur,
} from '../../../shared/collectionneurs'

// Les collectionneurs (`/collectionneurs`) : la maquette retenue le 9 novembre
// 2026 (`retours/2026-11-09/classement-des-collections/`, la synthèse
// retouchée — « c'est parfait », le propriétaire). Une seule page :
//
// - sa place en tête, à la catégorie choisie, et qui il passerait ;
// - les Divins tout de suite dessous, en bandeau — leur salle s'ouvre en
//   feuille : ils comptent et se montrent, seul leur chemin reste secret
//   (invariant 21) ;
// - les six puces du palmarès, qui changent sur place sa place, le podium et
//   la liste — chaque ligne dit sa catégorie : ses couronnes, ses sceaux, ses
//   légendaires peints ;
// - « Tous · Mes amis », et le podium en cartes à collectionner ;
// - toucher un joueur ouvre sa vitrine, « Comparer » le face-à-face du
//   palmarès — sans les thèmes, qui s'achètent —, et ce qui manque pour le
//   passer.
//
// Tout vient d'une lecture (`GET /api/collectionneurs`) : le relevé de tous,
// fait en fond, et sa fiche de l'instant ; la vitrine d'un joueur, au toucher.

/** Son avatar, tel qu'il le porte — sa bordure de ligue comprise, jamais sous un Divin (le serveur ne la donne pas). */
function SonAvatar({ f, className, grand }: { f: FicheDeCollectionneur; className?: string; grand?: boolean }) {
  return <Avatar className={className} avatar={f.avatar} finition={f.finition} legendaire={f.legendaire} eclat={f.eclat} bordure={f.bordure} grand={grand} />
}

/** Une gemme, la pierre de l'album : son losange à la couleur de sa rareté ; le carat, à l'or de l'accent. */
function Pierre({ gemme, petite }: { gemme: RareteDAvatar | 'carat'; petite?: boolean }) {
  const style = gemme === 'carat' ? ({ '--gemme': 'var(--accent)' } as CSSProperties) : gemmeDAvatar(gemme)
  return <i className={'cl-pierre' + (petite ? ' cl-pierre-petite' : '') + (gemme === 'divin' ? ' cl-pierre-divin' : '')} style={style} aria-hidden="true" />
}

const carats = (n: number) => (n >= 2 ? 'carats' : 'carat')

/** « 559 carats » : la valeur et son unité, la pierre devant. */
function Carats({ n }: { n: number }) {
  return (
    <span className="cl-carats">
      <Pierre gemme="carat" petite />
      <b>{formatNumber(n)}</b>
      <span>{carats(n)}</span>
    </span>
  )
}

/** Ce qu'une catégorie compte au pied d'une carte ou d'une ligne : « carats », « sur 12 », « niveau ». */
function uniteDe(c: CategorieDeCollection, v: number): string {
  if (c === 'collection') return carats(v)
  if (c === 'niveau') return 'niveau'
  const d = CATEGORIE[c]
  return d.sur ? `sur ${d.sur}` : d.unite[v >= 2 ? 1 : 0]
}

/** Ce qu'il a dans une catégorie, en clair : « 9 maîtres sur 12 », « niveau 47 », « 1 678 carats ». */
function ditDe(c: CategorieDeCollection, f: FicheDeCollectionneur): string {
  const v = valeurDansLaCategorie(f, c)
  if (c === 'collection') return `${formatNumber(f.carats)}\u00a0${carats(f.carats)}`
  if (c === 'niveau') return `niveau ${f.niveau}`
  const d = CATEGORIE[c]
  return `${formatNumber(v)} ${d.unite[v >= 2 ? 1 : 0]}${d.sur ? ` sur ${d.sur}` : ''}`
}

/** Le nom d'une pièce, tel que sa fiche l'écrit : un légendaire, un portrait, une forme de compagnon, un Divin. */
const nomDe = (cle: string): string => divin(cle)?.nom ?? legendaire(cle)?.nom ?? portrait(cle)?.nom ?? formeDeCompagnon(cle)?.nom ?? cle

const nomDuJoueur = (f: FicheDeCollectionneur, moi: string) => (f.id === moi ? 'Toi' : f.nom)

/** Ses Divins en petit, peints, dans leur pastille d'opale — à côté de son prénom. */
function SesDivins({ f }: { f: FicheDeCollectionneur }) {
  if (f.divins.length === 0) return null
  return (
    <span className="cl-opale-pastille" aria-label={`${f.divins.length > 1 ? `${f.divins.length} Divins` : 'Un Divin'} : ${f.divins.map(nomDe).join(', ')}`}>
      {f.divins.map(c => (
        <span key={c} className="cl-opale-bijou" aria-hidden="true">
          <Dessin cle={c} />
        </span>
      ))}
    </span>
  )
}

/** Les douze sentiers en douze crans : d'or, le sentier dont il est maître. */
function Couronnes({ f }: { f: FicheDeCollectionneur }) {
  return (
    <span className="cl-crans" aria-hidden="true">
      {BRANCHES.map(b => (
        <i key={b.key} className={f.maitres.includes(b.key) ? 'cl-cran-plein' : undefined} />
      ))}
    </span>
  )
}

/** Les dix cartes du Cabinet, chacune au métal de son défi le plus haut. */
function Sceaux({ f }: { f: FicheDeCollectionneur }) {
  const metaux = [...Array(f.sceaux.or).fill('or'), ...Array(f.sceaux.argent).fill('argent'), ...Array(f.sceaux.bronze).fill('bronze')] as string[]
  return (
    <span className="cl-sceaux" aria-hidden="true">
      {Array.from({ length: CATEGORIE.cabinet.sur ?? 10 }, (_, i) => (
        <i key={i} className={metaux[i] ? `cl-sceau-${metaux[i]}` : undefined} />
      ))}
    </span>
  )
}

/** Ses premiers légendaires, en petit, peints et figés comme dans toute liste — le reste compté au bout. */
function Medaillons({ cles, n = 4 }: { cles: readonly string[]; n?: number }) {
  return (
    <span className="cl-medaillons" aria-hidden="true">
      {cles.slice(0, n).map(c => (
        <Avatar key={c} className="lb-avatar cl-medaillon" avatar="" legendaire={c} />
      ))}
      {cles.length > n && <span className="cl-plus">{`+${cles.length - n}`}</span>}
    </span>
  )
}

/** Ce que la ligne dit sous le prénom, selon la catégorie : le détail du palmarès. */
function Detail({ c, f }: { c: CategorieDeCollection; f: FicheDeCollectionneur }) {
  const legendaires = `${f.legendaires.length} légendaire${f.legendaires.length > 1 ? 's' : ''}`
  switch (c) {
    case 'maitres':
      return (
        <span className="cl-detail">
          <Couronnes f={f} />
          <span>{`${f.paliers}/144`}</span>
        </span>
      )
    case 'legendaires':
      return (
        <span className="cl-detail">
          <Medaillons cles={f.legendaires} />
        </span>
      )
    case 'cabinet':
      return (
        <span className="cl-detail">
          <Sceaux f={f} />
        </span>
      )
    case 'niveau':
      return <span className="cl-detail">{`${formatNumber(f.carats)}\u00a0${carats(f.carats)}`}</span>
    case 'eclats':
      return <span className="cl-detail">{`${legendaires} · ${formatNumber(f.carats)}\u00a0${carats(f.carats)}`}</span>
    default:
      return <span className="cl-detail">{`${legendaires} · ${f.maitres.length} maître${f.maitres.length > 1 ? 's' : ''}`}</span>
  }
}

/** Une place, sa fiche à la main. */
interface Place {
  fiche: FicheDeCollectionneur
  rang: number
  valeur: number
}

/** Sa place dans la catégorie choisie, et qui il passerait — d'un coup d'œil, en tête. */
function SaPlace({ moi, place, devant, classes, c }: { moi?: FicheDeCollectionneur; place?: Place; devant: { fiche: FicheDeCollectionneur; manque: number } | null; classes: number; c: CategorieDeCollection }) {
  return (
    <section className="cl-sa-place" aria-label="Ta place">
      {moi && <SonAvatar f={moi} />}
      <span className="cl-sa-place-texte">
        {place ? (
          <b>
            {`Tu es ${rang(place.rang)}`}
            <span className="cl-sa-place-sur">{` sur ${formatNumber(classes)}`}</span>
          </b>
        ) : (
          <b>Pas encore au classement</b>
        )}
        {c === 'collection' && moi ? (
          <span className="cl-sa-place-valeur">
            <Carats n={moi.carats} />
            <span className="cl-sa-place-palier">
              <Icon name="landmark" />
              {rangDeCollection(moi.carats).nom}
            </span>
          </span>
        ) : (
          <span className="muted small">{place && moi ? ditDe(c, moi) : CATEGORIE[c].premier}</span>
        )}
        {place && devant && (
          <span className="cl-sa-place-suivant">
            <Icon name="arrow-up" />
            {`Encore ${formatNumber(devant.manque)} ${CATEGORIE[c].unite[devant.manque >= 2 ? 1 : 0]} pour passer ${devant.fiche.nom}`}
          </span>
        )}
      </span>
    </section>
  )
}

/** Les Divins en bandeau, sous sa place : les six, peints ou voilés, et qui les a — leur salle s'ouvre au toucher. */
function BandeauDesDivins({ etat, fiches, onOuvrir }: { etat: ClassementDesCollections; fiches: ReadonlyMap<string, FicheDeCollectionneur>; onOuvrir: () => void }) {
  const porteur = (cle: string) => fiches.get(etat.divins.find(d => d.cle === cle)?.porteurs[0] ?? '')
  const descendus = etat.divins.length
  const chez = etat.divins.flatMap(d => {
    const lui = porteur(d.cle)
    return lui ? [`${nomDe(d.cle)} chez ${nomDuJoueur(lui, etat.moi)}`] : []
  })
  return (
    <button
      type="button"
      className="cl-divins-bandeau"
      onClick={onOuvrir}
      aria-label={`Les Divins : ${descendus} descendu${descendus > 1 ? 's' : ''} sur ${DIVINS.length}${chez.length > 0 ? `, ${chez.join(', ')}` : ''}. Ouvrir leur salle`}
    >
      <span className="cl-divins-bandeau-tete" aria-hidden="true">
        <b className="cl-divins-titre cl-divins-titre-petit">Les Divins</b>
        <span>{`${descendus} descendu${descendus > 1 ? 's' : ''} sur ${DIVINS.length} · ${CARATS_DE_LA_GEMME.divin}\u00a0carats`}</span>
        <Icon name="chevron-down" className="cl-divins-bandeau-chevron" />
      </span>
      <span className="cl-divins-rangee" aria-hidden="true">
        {DIVINS.map(d => {
          const lui = porteur(d.key)
          return (
            <span key={d.key} className={'cl-divins-case' + (lui ? '' : ' cl-divins-case-voile')}>
              <span className="cl-divins-case-bijou">
                <Dessin cle={d.key} verrouille={!lui} grand={!!lui} />
              </span>
              {lui && <SonAvatar f={lui} className="lb-avatar cl-divins-case-porteur" />}
            </span>
          )
        })}
      </span>
    </button>
  )
}

/**
 * La salle des Divins, en feuille : ceux qui sont descendus peints — leur
 * nom, qui le garde —, les autres sous leur voile, sans nom, comme dans
 * l'album. Toucher un porteur ouvre sa vitrine. Rien ne dit comment ils
 * descendent, ni quand.
 */
function SalleDesDivins({ etat, fiches, onVitrine, onFermer }: { etat: ClassementDesCollections; fiches: ReadonlyMap<string, FicheDeCollectionneur>; onVitrine: (id: string) => void; onFermer: () => void }) {
  const descendus = etat.divins.length
  return (
    <Feuille titre="Les Divins" onFermer={onFermer}>
      <section className="cl-divins" aria-label={`${descendus} descendu${descendus > 1 ? 's' : ''} sur ${DIVINS.length}`}>
        <header className="cl-divins-tete">
          <span className="cl-divins-titre">Les Divins</span>
          <span>{`${descendus} descendu${descendus > 1 ? 's' : ''} sur ${DIVINS.length} · ${CARATS_DE_LA_GEMME.divin}\u00a0carats chacun`}</span>
        </header>
        <ul className="cl-divins-liste">
          {DIVINS.map(d => {
            const porteurs = (etat.divins.find(x => x.cle === d.key)?.porteurs ?? []).flatMap(id => fiches.get(id) ?? [])
            if (porteurs.length === 0) {
              return (
                <li key={d.key} className="cl-divin cl-divin-voile">
                  <span className="cl-divin-bijou" aria-hidden="true">
                    <Dessin cle={d.key} verrouille />
                  </span>
                  <span className="cl-divin-nom">Pas encore descendu</span>
                </li>
              )
            }
            const [premier, ...autres] = porteurs
            return (
              <li key={d.key} className="cl-divin">
                <button type="button" onClick={() => onVitrine(premier.id)} aria-label={`${d.nom} : chez ${porteurs.map(p => nomDuJoueur(p, etat.moi)).join(', ')}. Sa vitrine`}>
                  <span className="cl-divin-bijou" aria-hidden="true">
                    <Dessin cle={d.key} grand />
                  </span>
                  <span className="cl-divin-nom">{d.nom}</span>
                  <span className="cl-divin-porteur">
                    <SonAvatar f={premier} className="lb-avatar" />
                    {nomDuJoueur(premier, etat.moi)}
                    {autres.length > 0 && <span className="cl-divin-autres">{` +${autres.length}`}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="cl-divins-secret">Comment ils descendent ne se dit pas.</p>
      </section>
    </Feuille>
  )
}

/** Une carte du podium : le cadre de sa ligue, son avatar, son rang en gemme, ce qu'on classe — ses Divins en opale. */
function CarteDuPodium({ place: p, c, moi, premier, onOuvrir }: { place: Place; c: CategorieDeCollection; moi: string; premier?: boolean; onOuvrir: (id: string) => void }) {
  const f = p.fiche
  return (
    <button
      type="button"
      className={`cl-carte cadre-${f.ligue ?? 'aucune'} cl-carte-podium` + (premier ? ' cl-carte-premier' : '') + (f.divins.length > 0 ? ' cl-carte-divine' : '') + (f.id === moi ? ' cl-carte-moi' : '')}
      onClick={() => onOuvrir(f.id)}
      aria-label={`${nomDuJoueur(f, moi)}, ${rang(p.rang)}, ${ditDe(c, f)} : sa vitrine`}
    >
      <span className="cl-carte-dedans">
        <span className="cl-carte-rang" aria-hidden="true">
          <span>{p.rang}</span>
        </span>
        {f.ligue && <BlasonDeLigue ligue={f.ligue} taille={16} decoratif className="cl-carte-blason" />}
        <span className="cl-carte-illu">
          <SonAvatar f={f} className="cl-carte-av" />
        </span>
        <span className="cl-carte-nom">{nomDuJoueur(f, moi)}</span>
        <span className="cl-carte-valeur">
          {c === 'collection' && <Pierre gemme="carat" petite />}
          {formatNumber(p.valeur)}
          {c !== 'collection' && <span className="cl-carte-unite">{uniteDe(c, p.valeur)}</span>}
        </span>
        <SesDivins f={f} />
      </span>
    </button>
  )
}

/** Une ligne du classement : sa place, son avatar, ses Divins à côté du prénom, le détail de la catégorie, son nombre. */
function Ligne({ place: p, c, moi, onOuvrir }: { place: Place; c: CategorieDeCollection; moi: string; onOuvrir: (id: string) => void }) {
  const f = p.fiche
  return (
    <li>
      <button
        type="button"
        className={'lb-row lb-ouvrable cl-ligne' + (f.id === moi ? ' me' : '') + (f.divins.length > 0 ? ' cl-ligne-divine' : '')}
        aria-label={`${nomDuJoueur(f, moi)}, ${rang(p.rang)}, ${ditDe(c, f)}${f.id === moi ? '' : ' : sa vitrine'}`}
        onClick={() => onOuvrir(f.id)}
      >
        <span className={'lb-rank' + (p.rang <= 3 ? ` rank-${p.rang}` : '')}>{p.rang}</span>
        <SonAvatar f={f} className="lb-avatar" />
        <span className="cl-nom">
          <b>
            {nomDuJoueur(f, moi)}
            {/* À côté du prénom, sur la ligne qu'on lit d'abord : dessous, ils poussaient le détail hors de la ligne. */}
            <SesDivins f={f} />
          </b>
          <Detail c={c} f={f} />
        </span>
        <span className="cl-score">
          <span className="lb-score">{formatNumber(p.valeur)}</span>
          <span className="cl-unite">{uniteDe(c, p.valeur)}</span>
        </span>
      </button>
    </li>
  )
}

/** Une pièce maîtresse sur son socle : un Divin sur l'opale, rayons compris ; les autres à la couleur de leur gemme, leur matière dite. */
function Socle({ piece: p }: { piece: PieceDeVitrine }) {
  const estDivin = p.gemme === 'divin'
  const matiere = estUneMatiere(p.eclat) ? p.eclat : null
  const emoji = avatarDeLAlbum(p.cle)?.sorte === 'emoji'
  return (
    <figure className={'cl-socle' + (estDivin ? ' cl-socle-divin' : '')} style={gemmeDAvatar(p.gemme)}>
      <span className="cl-socle-piece">
        {estDivin ? (
          <span className="cl-socle-dv" aria-hidden="true">
            <Dessin cle={p.cle} grand />
          </span>
        ) : emoji ? (
          <Avatar className="cl-socle-av" avatar={p.cle} eclat={p.eclat} />
        ) : (
          // Sa matière, peinte : le Phénix taillé dans le jade se montre en jade.
          <Avatar className="cl-socle-av" avatar="" legendaire={p.cle} eclat={p.eclat} grand />
        )}
      </span>
      <span className="cl-socle-pied" aria-hidden="true" />
      <figcaption>
        <b>{emoji ? NOM_DE_RARETE_D_AVATAR[p.gemme] : nomDe(p.cle)}</b>
        <span className={estDivin ? 'cl-opale-texte' : undefined}>
          <Pierre gemme={p.gemme} petite /> {NOM_DE_RARETE_D_AVATAR[p.gemme]}
          {matiere ? ` · ${NOM_DE_LA_MATIERE[matiere].toLowerCase()}` : p.eclat ? ' · éclaté' : ''}
        </span>
        <span className="cl-socle-valeur">{`${formatNumber(p.carats)}\u00a0${carats(p.carats)}`}</span>
      </figcaption>
    </figure>
  )
}

/** Sa vitrine : ses Divins d'abord, puis ses plus belles pièces ; sa collection gemme par gemme, à côté de la mienne. */
function Vitrine({ id, moi, fiches, onComparer, onCarte, onFermer }: { id: string; moi?: FicheDeCollectionneur; fiches: ReadonlyMap<string, FicheDeCollectionneur>; onComparer: (lui: FicheDeCollectionneur) => void; onCarte: (id: string) => void; onFermer: () => void }) {
  const [vitrine, setVitrine] = useState<VitrineDUnCollectionneur | null>(null)
  const [erreur, setErreur] = useState('')
  useEffect(() => {
    let vivant = true
    api.collectionneurs
      .vitrine(id)
      .then(v => vivant && setVitrine(v))
      .catch(e => vivant && setErreur(motifDe(e)))
    return () => {
      vivant = false
    }
  }, [id])
  const lui = vitrine?.fiche ?? fiches.get(id)
  const soi = !!moi && id === moi.id
  const titre = soi ? 'Ta vitrine' : lui ? `La vitrine de ${lui.nom}` : 'Sa vitrine'
  return (
    <Feuille
      titre={titre}
      onFermer={onFermer}
      pied={
        soi || !lui ? undefined : (
          <div className="cl-pied">
            <button type="button" className="btn" onClick={() => onCarte(lui.id)}>
              <Icon name="eye" /> Sa carte
            </button>
            {moi && (
              <button type="button" className="btn btn-primary" onClick={() => onComparer(lui)}>
                <Icon name="users" /> Comparer
              </button>
            )}
          </div>
        )
      }
    >
      {erreur ? (
        <p className="error" role="alert">
          {erreur}
        </p>
      ) : !lui ? (
        <p className="muted small">Chargement…</p>
      ) : (
        <>
          <div className="cl-vitrine-tete">
            <SonAvatar f={lui} className="player-avatar big" />
            <span>
              <b>{soi ? 'Toi' : lui.nom}</b>
              <span className="muted small">{`${vitrine?.rang ? `${rang(vitrine.rang)} sur ${formatNumber(vitrine.classes)} · ` : ''}niveau ${lui.niveau}`}</span>
            </span>
            <span className="cl-vitrine-valeur">
              <b>{formatNumber(lui.carats)}</b>
              <span>{carats(lui.carats)}</span>
            </span>
          </div>
          {lui.divins.length > 0 && (
            <p className="cl-vitrine-divine">
              <Pierre gemme="divin" />
              {lui.divins.length > 1 ? `${lui.divins.length} Divins veillent sur sa collection` : 'Un Divin veille sur sa collection'}
            </p>
          )}
          {vitrine && vitrine.pieces.length > 0 && (
            <>
              <h3 className="label">{soi ? 'Tes pièces maîtresses' : 'Ses pièces maîtresses'}</h3>
              <div className="cl-socles">
                {vitrine.pieces.map(p => (
                  <Socle key={p.cle} piece={p} />
                ))}
              </div>
            </>
          )}
          <h3 className="label">Gemme par gemme</h3>
          <table className="cl-gemmes">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Gemme</span>
                </th>
                {RARETES_D_AVATAR.map(g => (
                  <th key={g} scope="col" aria-label={NOM_DE_RARETE_D_AVATAR[g]}>
                    <Pierre gemme={g} />
                    <span aria-hidden="true">{NOM_COURT_DE_RARETE_D_AVATAR[g]}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">{soi ? 'Toi' : lui.nom}</th>
                {RARETES_D_AVATAR.map(g => (
                  <td key={g} className={!soi && moi && lui.gemmes[g] > moi.gemmes[g] ? 'cl-gemme-plus' : undefined}>
                    {/* Ses Divins dans leur pastille d'opale : la case qu'on cherche des yeux. */}
                    {g === 'divin' && lui.gemmes[g] > 0 ? <span className="cl-opale-texte">{lui.gemmes[g]}</span> : lui.gemmes[g]}
                  </td>
                ))}
              </tr>
              {!soi && moi && (
                <tr>
                  <th scope="row">Toi</th>
                  {RARETES_D_AVATAR.map(g => (
                    <td key={g} className={moi.gemmes[g] > lui.gemmes[g] ? 'cl-gemme-plus' : undefined}>
                      {moi.gemmes[g]}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
          <div className="cl-vitrine-trophees">
            <span>
              <span className="label">{`Maîtres · ${lui.maitres.length}`}</span>
              <Couronnes f={lui} />
            </span>
            <span>
              <span className="label">{`Cabinet · ${lui.sceaux.or} or`}</span>
              <Sceaux f={lui} />
            </span>
          </div>
        </>
      )}
    </Feuille>
  )
}

/**
 * Le face-à-face, celui du palmarès (le choix du propriétaire, le 9 novembre
 * 2026) : les deux avatars, qui mène sur combien de lignes, puis ligne à
 * ligne la barre de chacun et l'or à qui mène — les Divins d'abord, en
 * opale ; pas de thèmes. Puis ce qui manque pour le passer, s'il est devant,
 * et ce que chacun a que l'autre n'a pas : ses Divins d'abord — comment ils
 * descendent ne se dit pas —, ses légendaires, ses maîtres.
 */
function FaceAFace({ moi, lui, onCarte, onFermer }: { moi: FicheDeCollectionneur; lui: FicheDeCollectionneur; onCarte: (id: string) => void; onFermer: () => void }) {
  const lignes = lignesDuFaceAFace(moi, lui)
  const bilan = bilanDuFaceAFace(lignes)
  const ecart = lui.carats - moi.carats
  const verdict =
    bilan.lui === bilan.moi
      ? `À égalité : ${bilan.moi} ligne${bilan.moi > 1 ? 's' : ''} chacun`
      : bilan.lui > bilan.moi
        ? `${lui.nom} mène sur ${bilan.lui} ligne${bilan.lui > 1 ? 's' : ''}, toi sur ${bilan.moi}`
        : `Tu mènes sur ${bilan.moi} ligne${bilan.moi > 1 ? 's' : ''}, ${lui.nom} sur ${bilan.lui}`
  const sesDivins = lui.divins.filter(c => !moi.divins.includes(c))
  const mesDivins = moi.divins.filter(c => !lui.divins.includes(c))
  const sesLegendaires = lui.legendaires.filter(c => !moi.legendaires.includes(c))
  const mesLegendaires = moi.legendaires.filter(c => !lui.legendaires.includes(c))
  const sesMaitres = lui.maitres.filter(b => !moi.maitres.includes(b))
  const mesMaitres = moi.maitres.filter(b => !lui.maitres.includes(b))
  // Une seule pièce qui vaut l'écart à elle seule : on sait par où commencer.
  const plusBelle = Math.max(0, ...sesDivins.map(() => CARATS_DE_LA_GEMME.divin), ...sesMaitres.map(() => CARATS_D_UN_MAITRE), ...sesLegendaires.map(() => CARATS_DE_LA_GEMME.legendaire))
  const pieces = (divins: readonly string[], legendaires: readonly string[], maitres: readonly string[], n: number) => (
    <div className="cl-manque-pieces">
      {divins.map(c => (
        <span key={c} className="cl-piece cl-piece-divine">
          <span className="cl-piece-dv" aria-hidden="true">
            <Dessin cle={c} />
          </span>
          <span>{nomDe(c)}</span>
          <span className="cl-opale-texte">Divin</span>
        </span>
      ))}
      {legendaires.slice(0, Math.max(0, n - divins.length)).map(c => (
        <span key={c} className="cl-piece">
          <Avatar className="cl-piece-av" avatar="" legendaire={c} />
          <span>{nomDe(c)}</span>
        </span>
      ))}
      {maitres.slice(0, 3).map(b => (
        <span key={b} className="cl-piece">
          <span className="cl-couronne" aria-hidden="true">
            <Icon name="crown" />
          </span>
          <span>{`Maître · ${branche(b)?.nom ?? b}`}</span>
        </span>
      ))}
    </div>
  )
  return (
    <Feuille
      titre={`Toi et ${lui.nom}`}
      onFermer={onFermer}
      pied={
        <div className="cl-pied">
          <button type="button" className="btn" onClick={() => onCarte(lui.id)}>
            <Icon name="eye" /> Sa carte
          </button>
          <a className="btn btn-primary" href={`/duels#defier-${encodeURIComponent(lui.id)}`}>
            <Icon name="swords" /> Défier
          </a>
        </div>
      }
    >
      <div className="cl-vs">
        <div className="cl-vs-cote">
          <SonAvatar f={moi} className="player-avatar big" />
          <b>Toi</b>
          <Carats n={moi.carats} />
        </div>
        <span className="cl-vs-milieu" aria-hidden="true">
          contre
        </span>
        <div className="cl-vs-cote">
          <SonAvatar f={lui} className="player-avatar big" />
          <b>{lui.nom}</b>
          <Carats n={lui.carats} />
        </div>
      </div>
      <p className="cl-verdict">
        {verdict}
        {bilan.egalites > 0 && ` · ${bilan.egalites === 1 ? 'une égalité' : `${bilan.egalites} égalités`}`}
      </p>
      <ul className="cl-duel">
        {lignes.map(l => {
          const max = Math.max(l.moi, l.lui, 1)
          const mene = l.moi > l.lui ? 'moi' : l.lui > l.moi ? 'lui' : 'egal'
          return (
            <li key={l.nom} className={`cl-duel-ligne cl-mene-${mene}` + (l.divine ? ' cl-duel-divine' : '')} aria-label={`${l.nom} : toi ${l.moi}, ${lui.nom} ${l.lui}`}>
              <span className="cl-duel-moi" aria-hidden="true">
                {formatNumber(l.moi)}
              </span>
              <span className="cl-duel-milieu" aria-hidden="true">
                <span className="cl-duel-nom">
                  {l.divine && <Pierre gemme="divin" petite />}
                  {l.nom}
                </span>
                <span className="cl-duel-barres">
                  <span className="cl-barre cl-barre-moi">
                    <span style={{ width: `${(l.moi / max) * 100}%` }} />
                  </span>
                  <span className="cl-barre cl-barre-lui">
                    <span style={{ width: `${(l.lui / max) * 100}%` }} />
                  </span>
                </span>
              </span>
              <span className="cl-duel-lui" aria-hidden="true">
                {formatNumber(l.lui)}
              </span>
            </li>
          )
        })}
      </ul>
      {(sesDivins.length > 0 || sesLegendaires.length > 0 || sesMaitres.length > 0) && (
        <section className="cl-manque">
          <h3 className="label">{`Ce que ${lui.nom} a et pas toi`}</h3>
          {ecart > 0 && (
            <p className="muted small cl-manque-phrase">{`Pour le passer, il te manque ${formatNumber(ecart + 1)}\u00a0${carats(ecart + 1)}${plusBelle > ecart ? ' : une seule de ces pièces suffit.' : '.'}`}</p>
          )}
          {pieces(sesDivins, sesLegendaires, sesMaitres, 5)}
          {sesDivins.length > 0 && <p className="cl-divins-secret cl-divins-secret-petit">Comment un Divin descend ne se dit pas.</p>}
        </section>
      )}
      {(mesDivins.length > 0 || mesLegendaires.length > 0 || mesMaitres.length > 0) && (
        <section className="cl-manque">
          <h3 className="label">{`Ce que tu as et pas ${lui.nom}`}</h3>
          {pieces(mesDivins, mesLegendaires, mesMaitres, 4)}
        </section>
      )}
    </Feuille>
  )
}

/** Le barème, replié sous le classement : ce que vaut chaque pièce. */
function LeBareme() {
  return (
    <details className="cl-bareme">
      <summary>Comment se compte la valeur ?</summary>
      <p className="muted small">Chaque avatar de l’album vaut sa gemme :</p>
      <ul className="cl-bareme-gemmes">
        {RARETES_D_AVATAR.map(g => (
          <li key={g}>
            <Pierre gemme={g} />
            {/* Abrégée comme sous les gemmes de l'album : « Peu commune » passait sur deux lignes et décalait son chiffre. */}
            <span aria-label={NOM_DE_RARETE_D_AVATAR[g]}>{NOM_COURT_DE_RARETE_D_AVATAR[g]}</span>
            <b>{CARATS_DE_LA_GEMME[g]}</b>
          </li>
        ))}
      </ul>
      <p className="muted small">
        {`Un Éclat vaut un légendaire (${CARATS_D_UN_ECLAT}), qu’il fasse éclater un avatar ou y taille une matière — l’Opale, offerte par les quatre, ne compte pas. Un maître de sentier en vaut un aussi (${CARATS_D_UN_MAITRE}) ; un sceau du Cabinet ${CARATS_DU_SCEAU.bronze}, ${CARATS_DU_SCEAU.argent} ou ${CARATS_DU_SCEAU.or} selon son métal ; un autre trophée et un timbre ${CARATS_D_UN_TROPHEE} et ${CARATS_D_UN_TIMBRE}. Un thème vaut sa gemme, un fond et une gerbe ${CARATS_D_UN_FOND} et ${CARATS_D_UNE_GERBE}, une finition ${CARATS_D_UNE_FINITION}, une bordure de ligue de ${CARATS_DE_LA_LIGUE.bronze} au bronze à ${CARATS_DE_LA_LIGUE.maitre} chez les maîtres. Un Divin vaut huit légendaires — comment il descend ne se dit pas.`}
      </p>
    </details>
  )
}

/** Combien de fois la page redemande un premier relevé qui se fait encore, et à quel rythme. */
const ESSAIS_DU_PREMIER_RELEVE = 8
const ATTENTE_DU_PREMIER_RELEVE_MS = 2_000

export function CollectionneursApp() {
  const [etat, setEtat] = useState<ClassementDesCollections | null>(null)
  const [erreur, setErreur] = useState<{ motif: string; connexion: boolean } | null>(null)
  const [essais, setEssais] = useState(0)
  const [c, setC] = useState<CategorieDeCollection>('collection')
  const [amis, setAmis] = useState(false)
  const [vitrine, setVitrine] = useState<string | null>(null)
  const [face, setFace] = useState<FicheDeCollectionneur | null>(null)
  const [salle, setSalle] = useState(false)
  const { ouvrir: ouvrirLaCarte, carte } = useCarteDUnProfil()

  useEffect(() => {
    let vivant = true
    // Le premier relevé se fait en fond, après un tout premier démarrage : la page le redemande, quelques fois.
    const attente = essais === 0 ? 0 : ATTENTE_DU_PREMIER_RELEVE_MS
    const minuterie = setTimeout(() => {
      api.collectionneurs
        .classement()
        .then(e => vivant && setEtat(e))
        .catch(e => vivant && setErreur({ motif: motifDe(e), connexion: e instanceof UnauthorizedError }))
    }, attente)
    return () => {
      vivant = false
      clearTimeout(minuterie)
    }
  }, [essais])
  // Chaque réponse qui dit le relevé encore en route en redemande une, et une seule. Relancé aussi par `essais`, qu'il
  // change lui-même, cet effet enchaînait les huit essais d'un coup : une seule demande partait, deux secondes après,
  // et sur un serveur dont le premier relevé dure plus, la page restait sur « Le classement se prépare ».
  useEffect(() => {
    if (etat?.enPreparation) setEssais(n => Math.min(n + 1, ESSAIS_DU_PREMIER_RELEVE))
  }, [etat])

  const fiches = useMemo(() => new Map((etat?.fiches ?? []).map(f => [f.id, f])), [etat])
  const moi = etat ? fiches.get(etat.moi) : undefined

  // Les places de la catégorie choisie : celles du serveur pour tous ; entre amis, reclassés ici, lui compris.
  const vue = useMemo(() => {
    if (!etat) return null
    const lire = (p: PlaceDeCollectionneur): Place[] => {
      const f = fiches.get(p.id)
      return f ? [{ fiche: f, rang: p.rang, valeur: p.valeur }] : []
    }
    if (amis) {
      const cercle = [...new Set([etat.moi, ...etat.amis])].flatMap(id => fiches.get(id) ?? [])
      const classes = classerLesCollectionneurs(cercle, c).map(x => ({ fiche: x.item, rang: x.rang, valeur: valeurDansLaCategorie(x.item, c) }))
      const i = classes.findIndex(p => p.fiche.id === etat.moi)
      return { classes: classes.length, tete: classes, place: i >= 0 ? classes[i] : undefined, autour: [] as Place[], devant: i >= 0 ? celuiAPasser(classes.map(p => ({ item: p.fiche, rang: p.rang })), i, f => valeurDansLaCategorie(f, c)) : null, tous: cercle.length }
    }
    const cat = etat.categories[c]
    const tete = cat.tete.flatMap(lire)
    const place = cat.moi ? lire(cat.moi)[0] : undefined
    const autour = cat.autour.flatMap(lire)
    // Celui à passer : le plus proche devant lui, parmi ce que la page a sous les yeux — sa liste et ses voisins.
    const connus = [...tete, ...autour.filter(p => !tete.some(t => t.fiche.id === p.fiche.id))]
    const i = connus.findIndex(p => p.fiche.id === etat.moi)
    const devant = i >= 0 ? celuiAPasser(connus.map(p => ({ item: p.fiche, rang: p.rang })), i, f => valeurDansLaCategorie(f, c)) : null
    return { classes: cat.classes, tete, place, autour, devant: devant && { item: devant.item, manque: devant.manque }, tous: etat.categories.collection.classes }
  }, [etat, fiches, amis, c])

  if (erreur) {
    return (
      <div className="player-shell cl-page">
        <Sortie vers="Mon profil" href="/profil" />
        <PieceTete piece="Profil" titre="Les collectionneurs" />
        <p className="error" role="alert">
          {erreur.motif}
        </p>
        {erreur.connexion && (
          <a className="btn btn-primary" href="/">
            Me connecter
          </a>
        )}
        <MenuBarre ici="profil" />
      </div>
    )
  }

  const [premier, deuxieme, troisieme, ...reste] = vue?.tete ?? []
  const unite = CATEGORIE[c].unite[0]
  const voyelle = /^[aeiouyéèêàâîôûÉ]/i.test(unite)
  const personne = vue && vue.classes < vue.tous ? `Les autres n’ont pas encore ${voyelle ? 'd’' : 'de '}${unite}.` : null
  const ouvrir = (id: string) => setVitrine(id)
  return (
    <div className="player-shell cl-page">
      <Sortie vers="Mon profil" href="/profil" />
      <PieceTete piece="Profil" titre="Les collectionneurs" />
      {!etat || !vue ? (
        <p className="muted small">Chargement…</p>
      ) : (
        <>
          <SaPlace moi={moi} place={vue.place} devant={vue.devant && { fiche: vue.devant.item, manque: vue.devant.manque }} classes={vue.classes} c={c} />
          {etat.enPreparation && <p className="muted small cl-legende">Le classement se prépare : il paraît dans un instant.</p>}
          <BandeauDesDivins etat={etat} fiches={fiches} onOuvrir={() => setSalle(true)} />
          <div className="cl-classement-tete">
            <h2 className="label">Le classement</h2>
            <div className="onglets onglets-puces cl-cercle-petit" role="tablist" aria-label="Qui classer">
              <button type="button" role="tab" aria-selected={!amis} className={'onglet' + (!amis ? ' actif' : '')} onClick={() => setAmis(false)}>
                Tous
              </button>
              <button type="button" role="tab" aria-selected={amis} className={'onglet' + (amis ? ' actif' : '')} onClick={() => setAmis(true)}>
                Mes amis
              </button>
            </div>
          </div>
          <div className="onglets onglets-puces cl-puces" role="tablist" aria-label="Ce qu’on classe">
            {CATEGORIES_DE_COLLECTION.map(x => (
              <button key={x} type="button" role="tab" aria-selected={c === x} className={'onglet' + (c === x ? ' actif' : '')} onClick={() => setC(x)}>
                {CATEGORIE[x].court}
              </button>
            ))}
          </div>
          {premier ? (
            <div className="cl-podium">
              {deuxieme ? <CarteDuPodium place={deuxieme} c={c} moi={etat.moi} onOuvrir={ouvrir} /> : <span />}
              <CarteDuPodium place={premier} c={c} moi={etat.moi} premier onOuvrir={ouvrir} />
              {troisieme ? <CarteDuPodium place={troisieme} c={c} moi={etat.moi} onOuvrir={ouvrir} /> : <span />}
            </div>
          ) : (
            <p className="muted small cl-legende">{amis ? 'Personne encore parmi tes amis.' : 'Personne encore.'}</p>
          )}
          <ol className="leaderboard cl-liste">
            {reste.map(p => (
              <Ligne key={p.fiche.id} place={p} c={c} moi={etat.moi} onOuvrir={ouvrir} />
            ))}
            {vue.autour.length > 0 && (
              <>
                <li className="muted center small cl-ellipse" aria-hidden="true">
                  …
                </li>
                {vue.autour.map(p => (
                  <Ligne key={p.fiche.id} place={p} c={c} moi={etat.moi} onOuvrir={ouvrir} />
                ))}
              </>
            )}
          </ol>
          {personne && <p className="muted small cl-legende">{personne}</p>}
          {premier && <p className="muted small cl-legende">Touche un joueur : sa vitrine, et de quoi vous comparer.</p>}
          <LeBareme />
          {salle && !vitrine && !face && <SalleDesDivins etat={etat} fiches={fiches} onVitrine={setVitrine} onFermer={() => setSalle(false)} />}
          {vitrine && !face && (
            <Vitrine
              id={vitrine}
              moi={moi}
              fiches={fiches}
              onComparer={lui => {
                setFace(lui)
                setVitrine(null)
              }}
              onCarte={ouvrirLaCarte}
              onFermer={() => setVitrine(null)}
            />
          )}
          {face && moi && <FaceAFace moi={moi} lui={face} onCarte={ouvrirLaCarte} onFermer={() => setFace(null)} />}
          {carte}
        </>
      )}
      <MenuBarre ici="profil" />
    </div>
  )
}
