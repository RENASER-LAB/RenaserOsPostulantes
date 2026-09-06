/**
 * Los iconos del portal, dibujados a mano.
 *
 * **Sin librería, y es una decisión.** El proyecto ya dibuja sus SVG así
 * (`Marca.tsx`, `Canto.tsx`), y una dependencia nueva por catorce iconos añade
 * un paquete que hay que actualizar, un estilo que no es el de la casa y peso
 * en un portal que se abre desde el teléfono.
 *
 * Todos comparten la misma rejilla —24×24, trazo de 1,5, extremos redondeados—
 * y **pintan en `currentColor`**: el icono es del color del texto que acompaña,
 * nunca de un color propio. Eso es lo que impide que se conviertan en decoración
 * y lo que mantiene la regla del violeta: si un icono no puede elegir color, no
 * puede robarle su significado al acento.
 *
 * ⚠️ **Son decorativos.** Van con `aria-hidden`, siempre al lado de un texto que
 * dice lo mismo. Un icono solo, sin palabra, es un jeroglífico — y esta es una
 * pantalla que rellena gente que busca trabajo, no gente que conoce la interfaz.
 */

interface PropsIcono {
  /** El lado del cuadrado, en píxeles. 20 va con la prosa; 16 con lo menor. */
  tamano?: number
  className?: string
}

function Icono({ tamano = 20, className, children }: PropsIcono & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconoMaletin(props: PropsIcono) {
  return (
    <Icono {...props}>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7" />
      <path d="M2.5 12h19" />
    </Icono>
  )
}

export function IconoBirrete(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6 10.7v4.6c0 1.5 2.7 2.7 6 2.7s6-1.2 6-2.7v-4.6" />
      <path d="M21.5 8.5V14" />
    </Icono>
  )
}

export function IconoIdioma(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
    </Icono>
  )
}

export function IconoSello(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M8.5 13.8 7.5 21l4.5-2.4L16.5 21l-1-7.2" />
    </Icono>
  )
}

export function IconoEnlace(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M10 13.5a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.6 1.6" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.6-1.6" />
    </Icono>
  )
}

export function IconoDocumento(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M14 2.8H7a2 2 0 0 0-2 2v14.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.8L14 2.8Z" />
      <path d="M14 2.8v5h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </Icono>
  )
}

export function IconoSubir(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 16V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M4 15v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V15" />
    </Icono>
  )
}

export function IconoDescargar(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 4v12" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M4 15v3.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V15" />
    </Icono>
  )
}

export function IconoPapelera(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4 6.5h16" />
      <path d="M9.5 6.5V4.8a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v1.7" />
      <path d="M6.5 6.5 7.4 20a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13.5" />
    </Icono>
  )
}

export function IconoLapiz(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6 3.5 3.5" />
    </Icono>
  )
}

export function IconoUbicacion(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 21.5s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10.3" r="2.6" />
    </Icono>
  )
}

export function IconoReloj(props: PropsIcono) {
  return (
    <Icono {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.3l3.3 2" />
    </Icono>
  )
}

export function IconoMas(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Icono>
  )
}

export function IconoVisto(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="m5 12.8 4.5 4.5L19 7.5" />
    </Icono>
  )
}

export function IconoCamara(props: PropsIcono) {
  return (
    <Icono {...props}>
      <path d="M3 8.5h3.2l1.4-2.3a1.5 1.5 0 0 1 1.3-.7h6.2a1.5 1.5 0 0 1 1.3.7l1.4 2.3H21a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.8" r="3.4" />
    </Icono>
  )
}

/** El tipo de enlace decide el icono; lo que no se reconoce cae en la cadena. */
export function IconoDeEnlace({ tipo, ...props }: PropsIcono & { tipo: string }) {
  if (tipo === 'LINKEDIN') {
    return (
      <Icono {...props}>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <path d="M7.5 10.5V17M7.5 7.4v.1" />
        <path d="M11.5 17v-4a2.5 2.5 0 0 1 5 0v4" />
      </Icono>
    )
  }
  if (tipo === 'GITHUB') {
    return (
      <Icono {...props}>
        <path d="M9 20c-4.5 1.4-4.5-2.3-6.3-2.8M15 21.5v-3.4c0-1 .1-1.4-.5-2 2.5-.3 4.8-1.2 4.8-5.3a4.1 4.1 0 0 0-1.1-2.8 3.8 3.8 0 0 0-.1-2.9s-.9-.3-3 1.1a10.4 10.4 0 0 0-5.4 0C7.6 4.8 6.7 5.1 6.7 5.1a3.8 3.8 0 0 0-.1 2.9 4.1 4.1 0 0 0-1.1 2.9c0 4 2.3 4.9 4.8 5.2-.6.6-.6 1.2-.5 2v3.4" />
      </Icono>
    )
  }
  return <IconoEnlace {...props} />
}
