// La gerbe du profil connecté ici (`shared/gerbes.ts`) : ce qui éclate sur
// ce téléphone à ses bonnes réponses. Posée par les pages qui lisent le
// profil — la soirée, le quiz du jour, la campagne, sa page —, comme le
// thème (`themeJoueur.ts`), et retenue pour le prochain démarrage : la
// première bonne réponse n'attend pas que le profil soit relu. Sans profil,
// aucune — l'invité anonyme n'a rien de plus que ce qu'il avait.

const CLE = 'quizz.gerbe'

/** Celle que la page a lue ; `undefined` : pas encore — on relit celle du dernier démarrage. */
let portee: string | null | undefined

/** La gerbe que le serveur dit portée par le profil connecté ici ; null : aucune, et l'invité sans profil. */
export function porterGerbe(cle: string | null | undefined): void {
  portee = cle ?? null
  try {
    if (portee) localStorage.setItem(CLE, portee)
    else localStorage.removeItem(CLE)
  } catch {
    // Stockage indisponible : la gerbe vaut pour cette page.
  }
}

/** La gerbe portée ici : celle que la page a lue, sinon celle retenue au dernier démarrage. */
export function gerbePortee(): string | null {
  if (portee === undefined) {
    try {
      portee = localStorage.getItem(CLE)
    } catch {
      portee = null
    }
  }
  return portee
}
