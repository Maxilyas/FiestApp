import type { Fiche } from '../../../shared/profil'
import { estimations, pourcent, surQcm } from '../format'

// Ici plutôt que dans `Carriere.tsx` : la carte d'un joueur s'en sert, et
// les importer de là faisait venir la carrière entière — galeries et
// médaillons compris — chez chaque invité qui scannait le QR.

/** Un chiffre : son titre, sa valeur, et sur combien de questions il porte quand ça compte. */
export type Chiffre = [titre: string, valeur: string, base?: string]

/**
 * Des chiffres en grille, chacun sous son titre. La base s'écrit sous la
 * valeur : « Précision 50 % », seul, se lisait pareil sur deux QCM et sur
 * deux cents.
 */
export function Chiffres({ cases, className }: { cases: Chiffre[]; className?: string }) {
  return (
    <dl className={'chiffres' + (className ? ` ${className}` : '')}>
      {cases.map(([titre, valeur, base]) => (
        <div key={titre} className="chiffre">
          <dt className="label">{titre}</dt>
          <dd className="num">{valeur}</dd>
          {base && <dd className="chiffre-base">{base}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** La précision et le coup d'œil d'une fiche, chacun avec sa base. */
export function justesses(fiche: Pick<Fiche, 'precision' | 'qcm' | 'justes' | 'coupDOeil' | 'estimationsComparees'>): Chiffre[] {
  return [
    ['Précision', pourcent(fiche.precision), fiche.qcm > 0 ? surQcm(fiche.justes, fiche.qcm) : undefined],
    [
      'Coup d’œil',
      pourcent(fiche.coupDOeil),
      fiche.estimationsComparees > 0 ? `sur ${estimations(fiche.estimationsComparees)}` : undefined,
    ],
  ]
}
