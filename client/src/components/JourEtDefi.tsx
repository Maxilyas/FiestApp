import { useState, type ReactNode } from 'react'
import { Onglets } from './Onglets'

type Lequel = 'jour' | 'defi'

/**
 * Le quiz du jour et le défi de la semaine, au même endroit de l'accueil :
 * une tuile, deux onglets fins — la maquette « la tuile à deux onglets »,
 * choisie par le propriétaire le 19 octobre 2026 (rangé au troisième onglet
 * de la campagne, le défi, beaucoup ne savaient pas qu'il existait). La
 * tuile du quiz du jour garde sa place et sa forme ; elle s'ouvre toujours
 * sur lui, rien ne se retient d'une visite à l'autre. Un point d'or dit
 * l'onglet où quelque chose attend.
 */
export function JourEtDefi({ jour, defi, attend }: { jour: ReactNode; defi: ReactNode; attend: Partial<Record<Lequel, string>> }) {
  const [lequel, setLequel] = useState<Lequel>('jour')
  return (
    <div className="jour-defi">
      <Onglets
        onglets={[
          { id: 'jour', nom: 'Quiz du jour', ...(attend.jour && { point: attend.jour }) },
          { id: 'defi', nom: 'Défi de la semaine', ...(attend.defi && { point: attend.defi }) },
        ]}
        actif={lequel}
        onChoisir={setLequel}
        label="Le quiz du jour et le défi de la semaine"
        idOnglet={l => `jour-defi-${l}`}
        idPanneau={l => `jour-defi-panneau-${l}`}
        className="onglets-fins"
      />
      {/* Les deux panneaux tiennent la même case, l'autre caché : la tuile garde la hauteur du plus grand, et changer
          d'onglet ne fait rien sauter dessous — le pouce qui visait « Les duels » les touche encore. */}
      <div className="jour-defi-panneaux">
        {(['jour', 'defi'] as const).map(l => (
          <div key={l} id={`jour-defi-panneau-${l}`} role="tabpanel" aria-labelledby={`jour-defi-${l}`} aria-hidden={l !== lequel || undefined}>
            {l === 'jour' ? jour : defi}
          </div>
        ))}
      </div>
    </div>
  )
}
