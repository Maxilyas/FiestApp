/**
 * Les quatre formes des réponses : ▲ ◆ ● ■, en SVG plein. Chacune porte sa
 * teinte — rose, champagne, lavande, sauge — et pour qui distingue mal les
 * couleurs, la forme suffit. Décoratives : le texte de la réponse dit tout.
 */
const PATHS = [
  <path key="tri" d="M12 3 22 21H2Z" />,
  <path key="dia" d="M12 2 22 12 12 22 2 12Z" />,
  <circle key="dot" cx="12" cy="12" r="10" />,
  <rect key="sq" x="3" y="3" width="18" height="18" rx="2" />,
]

export function Shape({ index, inline }: { index: number; inline?: boolean }) {
  return (
    <svg
      className={`ans-shape shape-${index}` + (inline ? ' inline' : '')}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[index] ?? PATHS[0]}
    </svg>
  )
}
