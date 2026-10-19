import { useEffect, useRef } from 'react'
import { nicheALaFin, nicheALaRevelation, nicheApresLaRevelation } from '../niche'
import type { ReactionALaRevelation } from '../../../shared/niche'

// La révélation et la fin d'un quiz, dites à la niche du compagnon
// (`client/src/niche.ts`). Posées dans l'écran qu'elles racontent, comme la
// gerbe d'une bonne réponse (`GerbeDeJuste`) : elles jouent à leur
// apparition, et la niche retrouve son calme quand le verdict s'en va. Rien
// du catalogue ni des dessins : la page de la soirée les importe, et sans
// niche, personne ne les écoute.

/**
 * Dans le bandeau du verdict (`.result-banner`) : ses étincelles partent de
 * ce qu'il rapporte (`.big`), sinon du bandeau. `cle` : la question révélée —
 * une nouvelle diffusion de la même ne relance rien.
 */
export function NicheALaRevelation({ cle, reaction }: { cle: string; reaction: ReactionALaRevelation }) {
  const ici = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const bandeau = ici.current?.closest('.result-banner') ?? ici.current?.parentElement ?? null
    nicheALaRevelation(cle, reaction, bandeau?.querySelector('.big') ?? bandeau)
    return () => nicheApresLaRevelation(cle)
    // Une révélation par question : le verdict ne change pas d'une diffusion à l'autre.
  }, [cle]) // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ici} hidden />
}

/** Au podium d'un quiz de soirée : s'il y monte, il sort de sa niche. */
export function NicheALaFin({ podium }: { podium: boolean }) {
  useEffect(() => nicheALaFin(podium), []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
