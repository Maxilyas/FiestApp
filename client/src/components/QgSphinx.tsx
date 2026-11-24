import { useEffect, useMemo, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from './Icon'
import { Feuille } from './Pieces'
import { Chiffre } from './QgModes'
import { GrapheDuTemps, type SerieDuGraphe } from './QgGraphes'
import { CopierLeTableau } from './CopierLeTableau'
import { confirmDialog } from './Dialog'
import { showToast } from '../state'
import { espacesFines } from '../format'
import { formatNumber } from '../../../shared/typographie'
import { jourDe, jourEnToutesLettres } from '../../../shared/jour'
import { jourAbrege } from '../../../shared/qg'
import { partEcrite } from '../../../shared/qgJoueurs'
import { ISSUES_DES_VISITES, NOM_DE_L_ISSUE, reussiteDe, type EnigmeAuQg, type PageDuSphinxAuQg, type ReponseDuSphinxAuQg } from '../../../shared/qgSphinx'
import type { EtatDeLaMaintenance } from '../../../shared/maintenance'

/**
 * Le Sphinx de l'accueil au QG (`/admin#sphinx`, l'étape 3 du plan du 24 novembre 2026,
 * `retours/2026-11-24/le-sphinx/plan.md`) : le Divin du moment et combien de ses mots tous ont trouvés, les phrases
 * reconstituées, l'audience, les visites jour par jour, la réussite de chaque énigme, et la porte de la maintenance,
 * où il s'ouvre (testeurs, puis tous).
 *
 * Le propriétaire joue aussi. La page ne dit ni un mot d'une phrase, ni sa forme, ni lesquels ont été trouvés, ni le
 * texte d'une phrase reconstituée ; les vers d'une énigme ne se montrent qu'au toucher de sa ligne, et sa réponse
 * derrière un geste, confirmé, qui la retire de ses propres visites — elle n'arrive au navigateur que par sa route.
 * Rien d'un joueur n'y est nommé.
 */
export function QgSphinx({ maintenance, versLaMaintenance }: { maintenance: EtatDeLaMaintenance | null; versLaMaintenance: () => void }) {
  const [page, setPage] = useState<PageDuSphinxAuQg | null>(null)
  const [error, setError] = useState('')
  const [relire, setRelire] = useState(0)
  useEffect(() => {
    api.admin.sphinx().then(
      p => {
        setPage(p)
        setError('')
      },
      e => setError(motifDe(e)),
    )
  }, [relire])
  if (error && !page) return <p className="error">{error}</p>
  if (!page) return <p className="serif-note">Chargement…</p>
  return <SphinxAuQg page={page} maintenance={maintenance} versLaMaintenance={versLaMaintenance} apresUnGeste={() => setRelire(n => n + 1)} />
}

/** Une espace insécable : « 0 » ne finit pas une ligne dont le mot ouvrirait la suivante. */
const INSECABLE = ' '
const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formatNumber(n)}${INSECABLE}${n > 1 ? motPluriel : mot}`

/** Les issues, de bas en haut de la pile, aux couleurs d'état de la console : une issue n'est pas un mode. */
const CLASSE_DE_L_ISSUE: Record<(typeof ISSUES_DES_VISITES)[number], string> = {
  proposee: 'qg-sphinx-proposee',
  'plus-tard': 'qg-sphinx-remise',
  abandonnee: 'qg-sphinx-chat',
  perdue: 'qg-sphinx-perdue',
  resolue: 'qg-sphinx-resolue',
}

const NOM_DE_LA_DIFFICULTE: Record<EnigmeAuQg['difficulte'], string> = { facile: 'Facile', moyenne: 'Moyenne', difficile: 'Difficile' }
const RANG_DE_LA_DIFFICULTE: Record<EnigmeAuQg['difficulte'], number> = { facile: 0, moyenne: 1, difficile: 2 }
const nomDeLaSorte = (e: Pick<EnigmeAuQg, 'sorte'>) => (e.sorte === 'charade' ? 'Charade' : 'Énigme')
const titreDe = (e: Pick<EnigmeAuQg, 'sorte' | 'numero'>) => `${e.sorte === 'charade' ? 'La charade' : 'L’énigme'} n° ${e.numero}`

export function SphinxAuQg({
  page,
  maintenance,
  versLaMaintenance,
  apresUnGeste,
}: {
  page: PageDuSphinxAuQg
  maintenance: EtatDeLaMaintenance | null
  versLaMaintenance: () => void
  apresUnGeste?: () => void
}) {
  const [ouverte, setOuverte] = useState<EnigmeAuQg | null>(null)
  return (
    <>
      <p className="muted small">
        {espacesFines(
          'Ce que les visites du Sphinx disent, sans rien dévoiler : du Divin du moment, combien de ses mots tous ont trouvés — jamais lesquels ; d’une énigme, ses comptes — ses vers au toucher de sa ligne, sa réponse derrière un geste.',
        )}
      </p>
      <LeDivinDuMoment page={page} />
      <LAudience page={page} />
      <EnigmeParEnigme page={page} ouvrir={setOuverte} />
      <SaPorte maintenance={maintenance} versLaMaintenance={versLaMaintenance} />
      {ouverte && <FeuilleDeLEnigme key={ouverte.numero} e={ouverte} profil={page.profil} onFermer={() => setOuverte(null)} apresUnGeste={apresUnGeste} />}
    </>
  )
}

// ── Le Divin du moment, les phrases reconstituées ──────────────────────────

function LeDivinDuMoment({ page }: { page: PageDuSphinxAuQg }) {
  const m = page.moment
  const pct = m && m.aTrouver > 0 ? Math.round((m.parTous / m.aTrouver) * 100) : 0
  return (
    <div className="qg-deux qg-deux-haut">
      <section className="qg-carte" aria-labelledby="sphinx-moment">
        <div className="qg-carte-tete qg-carte-tete-pile">
          <h2 id="sphinx-moment">Le Divin du moment</h2>
          <span className="muted small">le même pour tout le serveur, jusqu’à ce que tous aient trouvé sa phrase</span>
        </div>
        {m ? (
          <div className="qg-sphinx-moment">
            <b className="qg-sphinx-divin">{m.divin.nom}</b>
            <span className="qg-part qg-sphinx-jauge">
              <span className="qg-part-piste" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
              <span className="num">{`${formatNumber(m.parTous)} sur ${formatNumber(m.aTrouver)}`}</span>
            </span>
            <span className="muted small">{espacesFines('de ses mots cachés trouvés par tous les habitués — lesquels, la page ne le dit pas : tu les cherches aussi.')}</span>
          </div>
        ) : (
          <p className="muted small">Tous les Divins ont leur phrase reconstituée : le Sphinx n’a plus rien à souffler.</p>
        )}
      </section>
      <section className="qg-carte" aria-labelledby="sphinx-reconstituees">
        <div className="qg-carte-tete qg-carte-tete-pile">
          <h2 id="sphinx-reconstituees">Les phrases reconstituées</h2>
          <span className="muted small">le jour où tous en ont trouvé le dernier mot</span>
        </div>
        {page.reconstituees.length === 0 ? (
          <p className="muted small">Aucune pour l’instant.</p>
        ) : (
          <ul className="qg-liste qg-sphinx-reconstituees">
            {page.reconstituees.map(r => (
              <li key={r.divin.key}>
                <b>{r.divin.nom}</b>
                <span className="muted small">{r.le === null ? 'date inconnue' : jourEnToutesLettres(jourDe(r.le))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── L'audience, les visites jour par jour ──────────────────────────────────

/** Sous l'axe, un jour sur quelques-uns, comptés depuis aujourd'hui : autant qu'il en tient. */
function axeDesJours(jours: readonly string[]) {
  return (i: number, largeur: number): string | null => {
    const n = jours.length
    const saut = Math.ceil(n / Math.max(2, Math.floor((largeur - 40) / 72)))
    if ((n - 1 - i) % saut !== 0) return null
    return i === n - 1 ? 'aujourd’hui' : jourAbrege(jours[i])
  }
}

function LAudience({ page }: { page: PageDuSphinxAuQg }) {
  const series: SerieDuGraphe[] = ISSUES_DES_VISITES.map(issue => ({
    cle: issue,
    nom: NOM_DE_L_ISSUE[issue],
    valeurs: page.jours.map(j => j[issue]),
    classe: CLASSE_DE_L_ISSUE[issue],
  }))
  const total = (issue: (typeof ISSUES_DES_VISITES)[number]) => page.jours.reduce((n, j) => n + j[issue], 0)
  const parJour = page.jours.map(j => ISSUES_DES_VISITES.reduce((n, issue) => n + j[issue], 0))
  const visites = parJour.reduce((n, v) => n + v, 0)
  const closes = total('resolue') + total('perdue') + total('abandonnee')
  const aujourdhui = page.jours.at(-1)
  return (
    <>
      <section className="qg-jour" aria-labelledby="sphinx-audience">
        <div className="qg-section-tete">
          <h2 className="compte-groupe" id="sphinx-audience">
            L’audience
          </h2>
          <span className="muted small">aujourd’hui, et les trente derniers jours</span>
        </div>
        <ul className="qg-tuiles">
          <Chiffre nom="Habitués aujourd’hui" valeur={formatNumber(page.habitues)} detail="vus sur leur accueil depuis minuit, ou visités" />
          <Chiffre nom="Visites aujourd’hui" valeur={formatNumber(parJour.at(-1) ?? 0)} detail={aujourdhui ? `${pluriel(aujourdhui.resolue, 'résolue')}` : undefined} />
          <Chiffre nom="Visites, trente jours" valeur={formatNumber(visites)} detail={`${pluriel(total('plus-tard') + total('proposee'), 'encore ouverte')}`} />
          <Chiffre nom="Résolues" valeur={formatNumber(total('resolue'))} detail={closes > 0 ? `${partEcrite(total('resolue'), closes)} des closes` : 'aucune close'} />
          <Chiffre nom="Perdues" valeur={formatNumber(total('perdue'))} detail="les trois essais passés" />
          <Chiffre nom="Langue au chat" valeur={formatNumber(total('abandonnee'))} detail="la réponse demandée" />
        </ul>
      </section>
      <section className="qg-carte qg-ecran" aria-labelledby="sphinx-par-jour">
        <div className="qg-carte-tete qg-carte-tete-pile">
          <h2 id="sphinx-par-jour">Jour par jour</h2>
          <span className="muted small">les visites, au jour où le Sphinx est passé, par ce qu’elles sont devenues</span>
        </div>
        {visites === 0 ? (
          <p className="muted small">Aucune visite ces trente jours.</p>
        ) : (
          <>
            <GrapheDuTemps
              etiquettes={page.jours.map(j => jourEnToutesLettres(j.jour))}
              axe={axeDesJours(page.jours.map(j => j.jour))}
              series={series}
              empile
              nomDuTotal="visite"
              resume={`Les visites du Sphinx jour par jour, sur trente jours, par ce qu’elles sont devenues : ${formatNumber(visites)} en tout, ${formatNumber(parJour.at(-1) ?? 0)} aujourd’hui.`}
            />
            <div className="qg-legende">
              <ul>
                {[...series].reverse().map(s => (
                  <li key={s.cle}>
                    <i className={`qg-pastille-mode ${s.classe}`} aria-hidden="true" />
                    {s.nom} <b className="num">{formatNumber(s.valeurs.reduce((n, v) => n + v, 0))}</b>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </>
  )
}

// ── Énigme par énigme ──────────────────────────────────────────────────────

type CleDuTri = 'numero' | 'sorte' | 'difficulte' | 'vues' | 'resolues' | 'perdues' | 'chat' | 'reussite'

const COLONNES: { cle: CleDuTri; nom: string; titre: string; nombre?: boolean; detail?: boolean }[] = [
  { cle: 'numero', nom: 'N°', titre: 'Son numéro dans le recueil de 1858' },
  { cle: 'sorte', nom: 'Sorte', titre: 'Énigme ou charade', detail: true },
  { cle: 'difficulte', nom: 'Difficulté', titre: 'Mesurée à l’aveugle', detail: true },
  { cle: 'vues', nom: 'Vues', titre: 'Les visites qui l’ont posée, de tout temps', nombre: true },
  { cle: 'resolues', nom: 'Résolues', titre: 'Trouvées', nombre: true, detail: true },
  { cle: 'perdues', nom: 'Perdues', titre: 'Les trois essais passés', nombre: true, detail: true },
  { cle: 'chat', nom: 'Chat', titre: 'Langue au chat', nombre: true, detail: true },
  { cle: 'reussite', nom: 'Réussite', titre: 'Ses résolues sur ses visites closes', nombre: true },
]

function valeurDuTri(e: EnigmeAuQg, cle: CleDuTri): number | string {
  if (cle === 'numero') return Number(e.numero)
  if (cle === 'sorte') return e.sorte
  if (cle === 'difficulte') return RANG_DE_LA_DIFFICULTE[e.difficulte]
  if (cle === 'reussite') {
    const r = reussiteDe(e)
    // Sans visite close, rien à juger : au bout dans les deux sens, comme le vide des questions.
    return r ? r.resolues / r.sur : Number.NaN
  }
  return e[cle]
}

function comparer(a: EnigmeAuQg, b: EnigmeAuQg, cle: CleDuTri, sens: 'monte' | 'descend'): number {
  const x = valeurDuTri(a, cle)
  const y = valeurDuTri(b, cle)
  const videX = typeof x === 'number' && Number.isNaN(x)
  const videY = typeof y === 'number' && Number.isNaN(y)
  if (videX || videY) return videX === videY ? Number(a.numero) - Number(b.numero) : videX ? 1 : -1
  const c = typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number)
  return (sens === 'monte' ? c : -c) || Number(a.numero) - Number(b.numero)
}

/** Sa réussite écrite : « 3 sur 5 » sous vingt closes, en pour cent au-delà ; un tiret sans visite close. */
function ReussiteEcrite({ e }: { e: EnigmeAuQg }) {
  const r = reussiteDe(e)
  if (!r) return <span className="muted">–</span>
  const pct = Math.round((r.resolues / r.sur) * 100)
  return (
    <span className="qg-part" title={`${pluriel(r.resolues, 'résolue')} sur ${pluriel(r.sur, 'visite close', 'visites closes')}`}>
      <span className="qg-part-piste" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      {partEcrite(r.resolues, r.sur)}
    </span>
  )
}

function EnigmeParEnigme({ page, ouvrir }: { page: PageDuSphinxAuQg; ouvrir: (e: EnigmeAuQg) => void }) {
  const [tri, setTri] = useState<{ cle: CleDuTri; sens: 'monte' | 'descend' }>({ cle: 'vues', sens: 'descend' })
  const triees = useMemo(() => [...page.enigmes].sort((a, b) => comparer(a, b, tri.cle, tri.sens)), [page.enigmes, tri])
  const trier = (cle: CleDuTri) =>
    setTri(t => (t.cle === cle ? { cle, sens: t.sens === 'monte' ? 'descend' : 'monte' } : { cle, sens: cle === 'numero' || cle === 'sorte' || cle === 'difficulte' ? 'monte' : 'descend' }))
  const vues = page.enigmes.filter(e => e.vues > 0).length
  return (
    <section className="qg-carte" aria-labelledby="sphinx-enigmes">
      <div className="qg-carte-tete qg-carte-tete-pile">
        <h2 id="sphinx-enigmes">Énigme par énigme</h2>
        <span className="muted small">{`${pluriel(page.enigmes.length, 'pièce')} dans la réserve, ${formatNumber(vues)} déjà posée${vues > 1 ? 's' : ''} — touche une ligne pour ses vers`}</span>
      </div>
      <div className="qg-outils">
        <CopierLeTableau nom="les énigmes du Sphinx" />
      </div>
      <div className="qg-table-cadre">
        <table className="qg-table qg-jouees-table qg-sphinx-table">
          <caption className="sr-only">{`Les énigmes du Sphinx, triées par ${COLONNES.find(c => c.cle === tri.cle)?.nom.toLowerCase()}`}</caption>
          <thead>
            <tr>
              {COLONNES.map(c => (
                <th
                  key={c.cle}
                  scope="col"
                  className={(c.nombre ? 'qg-nombre' : '') + (c.detail ? ' qg-colonne-detail' : '')}
                  aria-sort={tri.cle === c.cle ? (tri.sens === 'monte' ? 'ascending' : 'descending') : undefined}
                >
                  <button type="button" className="qg-tri" title={c.titre} onClick={() => trier(c.cle)}>
                    {c.nom}
                    {tri.cle === c.cle && <Icon name={tri.sens === 'monte' ? 'arrow-up' : 'arrow-down'} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {triees.map(e => (
              <tr key={e.numero}>
                <th scope="row">
                  <button type="button" className="qg-jouee" aria-haspopup="dialog" onClick={() => ouvrir(e)}>
                    <span className="qg-jouee-texte">
                      {`n° ${e.numero}`}
                      {e.aToi && <span className="etiquette qg-sphinx-a-toi">{e.aToi === 'aujourdhui' ? 'la tienne aujourd’hui' : 'vue'}</span>}
                    </span>
                    <span className="qg-jouee-sous">{`${nomDeLaSorte(e)} · ${NOM_DE_LA_DIFFICULTE[e.difficulte].toLowerCase()} · ${formatNumber(e.resolues)} résolue${e.resolues > 1 ? 's' : ''}, ${formatNumber(e.perdues)} perdue${e.perdues > 1 ? 's' : ''}, ${formatNumber(e.chat)} au chat`}</span>
                  </button>
                </th>
                <td className="qg-colonne-detail">{nomDeLaSorte(e)}</td>
                <td className="qg-colonne-detail">{NOM_DE_LA_DIFFICULTE[e.difficulte]}</td>
                <td className="qg-nombre">{formatNumber(e.vues)}</td>
                <td className="qg-nombre qg-colonne-detail">{formatNumber(e.resolues)}</td>
                <td className="qg-nombre qg-colonne-detail">{formatNumber(e.perdues)}</td>
                <td className="qg-nombre qg-colonne-detail">{formatNumber(e.chat)}</td>
                <td className="qg-nombre">
                  <ReussiteEcrite e={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {espacesFines(
          'La réussite : ses résolues sur ses visites closes — résolues, perdues, ou la langue au chat ; une visite remise à plus tard ou pas encore jouée n’y compte pas. « Vue » : ton profil l’a déjà vue, le Sphinx ne te la posera pas.',
        )}
      </p>
    </section>
  )
}

/**
 * Une énigme ouverte : ses vers, ce que ton profil en sait, et « Voir la réponse » — confirmé, parce que ce geste la
 * range parmi les énigmes que tu as vues : le Sphinx ne te la proposera jamais. La réponse n'arrive que par lui.
 */
function FeuilleDeLEnigme({ e, profil, onFermer, apresUnGeste }: { e: EnigmeAuQg; profil: boolean; onFermer: () => void; apresUnGeste?: () => void }) {
  const [reponse, setReponse] = useState<ReponseDuSphinxAuQg | null>(null)
  const [occupe, setOccupe] = useState(false)
  const voir = async () => {
    if (occupe) return
    const deja = e.aToi === 'vue'
    const oui = await confirmDialog({
      title: 'Voir la réponse ?',
      message: deja
        ? `Tu connais déjà ${titreDe(e).toLowerCase()} : la lire ne te coûte rien.`
        : `Ce geste retire ${titreDe(e).toLowerCase()} de tes propres visites : le Sphinx ne te la proposera jamais, et tu ne pourras plus la chercher toi-même.`,
      confirmLabel: 'Voir la réponse',
      cancelLabel: 'Ne pas la voir',
      prudent: !deja,
    })
    if (!oui) return
    setOccupe(true)
    try {
      setReponse(await api.admin.reponseDuSphinx(e.numero))
      apresUnGeste?.()
    } catch (err) {
      showToast({ kind: 'error', message: motifDe(err) })
    } finally {
      setOccupe(false)
    }
  }
  return (
    <Feuille titre={titreDe(e)} onFermer={onFermer}>
      <p className="muted small">{`${nomDeLaSorte(e)} · ${NOM_DE_LA_DIFFICULTE[e.difficulte].toLowerCase()} · ${pluriel(e.vues, 'visite')}`}</p>
      <blockquote className="qg-sphinx-vers">
        {e.vers.map((v, i) => (
          <span key={i}>{espacesFines(v)}</span>
        ))}
      </blockquote>
      <dl className="qg-cote-chiffres qg-sphinx-chiffres">
        <div>
          <dt>Résolues</dt>
          <dd className="num">{formatNumber(e.resolues)}</dd>
        </div>
        <div>
          <dt>Perdues</dt>
          <dd className="num">{formatNumber(e.perdues)}</dd>
        </div>
        <div>
          <dt>Langue au chat</dt>
          <dd className="num">{formatNumber(e.chat)}</dd>
        </div>
        <div>
          <dt>Réussite</dt>
          <dd className="num">
            <ReussiteEcrite e={e} />
          </dd>
        </div>
      </dl>
      {reponse ? (
        <div className="qg-sphinx-reponse" role="status">
          <span className="qg-etiquette">La réponse</span>
          <b>{espacesFines(`« ${reponse.solution} »`)}</b>
          {reponse.cle && <span className="muted small">{espacesFines(`Son découpage : ${reponse.cle}`)}</span>}
          {reponse.acceptees.length > 0 && <span className="muted small">{espacesFines(`Le Sphinx accepte aussi : ${reponse.acceptees.join(', ')}`)}</span>}
          {reponse.presque.length > 0 && <span className="muted small">{espacesFines(`Brûlent, sans coûter d’essai : ${reponse.presque.join(', ')}`)}</span>}
          <span className="muted small">{reponse.deja ? 'Tu l’avais déjà vue.' : 'Elle est rangée parmi tes énigmes vues : le Sphinx ne te la posera pas.'}</span>
        </div>
      ) : e.aToi === 'aujourdhui' ? (
        <p className="muted small">{espacesFines('Le Sphinx te la pose aujourd’hui : réponds-lui sur ton accueil, ou donne ta langue au chat, avant de lire sa réponse ici.')}</p>
      ) : !profil ? (
        <p className="muted small">{espacesFines('Ton compte n’a pas de profil où ranger cette énigme : connecte-toi à ton profil pour lire sa réponse.')}</p>
      ) : (
        <button type="button" className="btn btn-ghost qg-sphinx-voir" disabled={occupe} onClick={() => void voir()}>
          <Icon name="eye" />
          Voir la réponse
        </button>
      )}
    </Feuille>
  )
}

// ── La porte : la maintenance ──────────────────────────────────────────────

function SaPorte({ maintenance, versLaMaintenance }: { maintenance: EtatDeLaMaintenance | null; versLaMaintenance: () => void }) {
  const testeurs = maintenance?.testeurs.sphinx.length ?? 0
  const etat = !maintenance
    ? null
    : maintenance.pages.sphinx !== null
      ? 'En maintenance : il ne passe chez personne.'
      : maintenance.bientot.sphinx !== null
        ? `Bientôt disponible : il ne passe que chez ${testeurs === 0 ? 'toi' : `ses ${pluriel(testeurs, 'testeur')} et toi`}.`
        : 'Ouvert à tous : il passe chez chaque habitué.'
  return (
    <section className="qg-carte" aria-labelledby="sphinx-porte">
      <div className="qg-carte-tete">
        <h2 id="sphinx-porte">Ce qu’on y fait</h2>
      </div>
      <a
        className="qg-ligne qg-cabinet-lien"
        href="/admin#maintenance"
        onClick={ev => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return
          ev.preventDefault()
          versLaMaintenance()
        }}
      >
        <span className="qg-rond">
          <Icon name="lock" />
        </span>
        <span className="qg-ligne-texte">
          <b>L’ouvrir à quelques testeurs, puis à tous</b>
          <span className="muted small">{espacesFines(etat ? `${etat} La maintenance, ligne « Le Sphinx de l’accueil ».` : 'La maintenance, ligne « Le Sphinx de l’accueil ».')}</span>
        </span>
        <Icon name="chevron-right" className="qg-chevron" />
      </a>
    </section>
  )
}
