/**
 * El logotipo de EX.
 *
 * Es una palabra —EX— con la hormiga metida dentro de la X. La hormiga no sale
 * de ahi: no se anima, no camina y no aparece suelta como mascota.
 *
 * `acento` la pinta en champagne, y solo se usa en el pie. En la cabecera va
 * monocroma, que es la que aguanta los 24 px sin convertirse en una mancha.
 */

interface Props {
  /** Alto de las letras, en pixeles. La hormiga escala con ellas. */
  tamano?: number
  acento?: boolean
}

export function Marca({ tamano = 24, acento = false }: Props) {
  return (
    <span className="marca" style={{ fontSize: `${tamano}px` }}>
      <span className="marca-letras">EX</span>
      <svg className="marca-hormiga" viewBox="0 0 24 24" aria-hidden="true" style={acento ? { color: 'var(--acento)' } : undefined}>
        <path
          d="M10.3 5.4 8 2.9M13.7 5.4 16 2.9M9.5 10 6 8M9.4 12.2 5.6 12.7M9.8 14.2 6.4 16.6M14.5 10 18 8M14.6 12.2 18.4 12.7M14.2 14.2 17.6 16.6"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx="12" cy="6.1" rx="2.1" ry="1.9" fill="currentColor" />
        <ellipse cx="12" cy="10.4" rx="1.6" ry="2" fill="currentColor" />
        <ellipse cx="12" cy="16" rx="2.5" ry="3.3" fill="currentColor" />
      </svg>
    </span>
  )
}
