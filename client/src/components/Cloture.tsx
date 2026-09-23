import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { ClotureDeSoiree, ProgresDeQuiz } from '../../../shared/fin'
import { distinctions } from '../../../shared/profil'
import { legendaire } from '../../../shared/legendaires'
import { Avatar } from './Avatar'
import { Legendaire } from './Legendaire'
import { FinalPodium } from './Podium'
import { Niveau } from './Niveau'

/**
 * La clôture, sur l'écran commun : ce que la salle a fait de sa soirée.
 *
 * Le podium de la soirée, les avatars légendaires débloqués — en grand, c'est
 * ce qu'on veut voir —, les montées de niveau, et les hauts faits de chacun,
 * éclats et ombres mêlés : la Lanterne Rouge se proclame aussi fort que le
 * Grand Chelem. Le QR mène au souvenir de la soirée qu'on vient de clore.
 */
export function ClotureEcran({ cloture, souvenirUrl }: { cloture: ClotureDeSoiree; souvenirUrl: string }) {
  const c = cloture
  return (
    <div className="quiz-host stage-scroll cloture">
      <header className="cloture-tete">
        <span className="label">La soirée est close</span>
        <h2>{c.soiree.titre}</h2>
      </header>

      <div className="cloture-grille">
        <div>
          {c.podium.length > 0 && (
            <FinalPodium
              rows={c.podium.map(p => ({ name: p.nom, avatar: p.avatar, points: p.points, rank: p.rang, ...distinctions(p) }))}
            />
          )}
        </div>
        <div className="cloture-colonne">
          {c.legendaires.length > 0 && (
            <section className="cloture-bloc">
              <h3>Avatars légendaires débloqués</h3>
              <div className="cloture-legendaires">
                {c.legendaires.map((l, i) => (
                  <div
                    key={`${l.nom}-${l.gagne}-${i}`}
                    className="cloture-legendaire"
                    style={{ animationDelay: `${300 + i * 400}ms` }}
                  >
                    <span className="cloture-medaillon">
                      <Legendaire cle={l.gagne} />
                    </span>
                    <b>{l.nom}</b>
                    <span className="muted">{legendaire(l.gagne)?.nom}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {c.montees.length > 0 && (
            <section className="cloture-bloc">
              <h3>Ils montent de niveau</h3>
              <div className="cloture-montees">
                {c.montees.map((m, i) => (
                  <span key={`${m.nom}-${i}`} className="cloture-montee">
                    <Avatar className="lb-avatar" avatar={m.avatar} finition={m.finition} eclat={m.eclat} legendaire={m.legendaire} />
                    <b>{m.nom}</b>
                    <Niveau niveau={m.avant} big />
                    <span aria-hidden="true">→</span>
                    <Niveau niveau={m.apres} big />
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {c.hautsFaits.length > 0 && (
        <section className="cloture-bloc">
          <h3>Les hauts faits de la soirée</h3>
          <div className="cloture-faits">
            {c.hautsFaits.map((h, i) => (
              <div key={`${h.nom}-${i}`} className="cloture-fait">
                <span className="cloture-qui">
                  <Avatar className="lb-avatar" avatar={h.avatar} finition={h.finition} eclat={h.eclat} legendaire={h.legendaire} />
                  <b>{h.nom}</b>
                </span>
                <span className="cloture-puces">
                  {h.faits.map(f => (
                    <span key={f.key} className={`fait-puce fait-${f.ton}`}>
                      <span aria-hidden="true">{f.emoji}</span> {f.title}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="stage-foot">
        <div className="qr-stack">
          <div className="qr-box">
            <QRCodeSVG value={souvenirUrl} size={84} bgColor="#ffffff" fgColor="#1a1412" />
          </div>
          <div className="qr-text">
            <span className="label">Le souvenir de la soirée</span>
            <span className="join-url">{souvenirUrl}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Au podium d'un quiz, les montées de niveau s'annoncent à la salle : un
 * bandeau en haut de l'écran, le temps qu'on applaudisse, puis il s'efface.
 */
export function AnnoncesDeNiveau({ progres, onFin }: { progres: ProgresDeQuiz; onFin: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFin, 9000)
    return () => clearTimeout(t)
  }, [progres, onFin])
  if (progres.montees.length === 0) return null
  return (
    <div className="annonces-niveau" role="status">
      {progres.montees.slice(0, 6).map((m, i) => (
        <span key={`${m.nom}-${i}`} className="annonce-niveau" style={{ animationDelay: `${i * 250}ms` }}>
          <Avatar className="lb-avatar" avatar={m.avatar} finition={m.finition} eclat={m.eclat} legendaire={m.legendaire} />
          <b>{m.nom}</b>
          <span>passe niveau</span>
          <Niveau niveau={m.apres} big />
        </span>
      ))}
      {progres.montees.length > 6 && <span className="annonce-niveau">et {progres.montees.length - 6} autres</span>}
    </div>
  )
}
