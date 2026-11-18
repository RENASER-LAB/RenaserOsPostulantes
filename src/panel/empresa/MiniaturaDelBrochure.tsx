/**
 * La miniatura de la primera hoja de cada plantilla del brochure (V86), teñida
 * con el color elegido y con la foto de portada si la hay: un dibujo, no el PDF.
 * Copia las de la maqueta (`specs/…/brochure-de-la-empresa/maqueta/panel-*.html`).
 *
 * Sin foto de portada, «Portada» es el color entero y «Columnas» no lleva franja:
 * como el PDF, ninguna deja un hueco.
 */

import type { CodigoDePlantilla } from './brochure'

const LINEA = '#d4d6d3'
const CAJA = '#f5f7fb'
const FILETE = '#e6e7e4'

export function MiniaturaDelBrochure({
  plantilla,
  color,
  portada,
}: {
  plantilla: CodigoDePlantilla
  color: string
  portada: string | null
}) {
  if (plantilla === 'PORTADA') return <MiniaturaPortada color={color} portada={portada} />
  if (plantilla === 'COLUMNAS') return <MiniaturaColumnas color={color} portada={portada} />
  return <MiniaturaClasica color={color} />
}

function MiniaturaClasica({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 210 297" aria-hidden="true">
      <rect width="210" height="297" fill="#fff" />
      <rect x="18" y="20" width="22" height="22" rx="3" fill={color} />
      <rect x="18" y="52" width="120" height="10" fill="#111312" />
      <rect x="18" y="68" width="80" height="4" fill="#687170" />
      <rect x="18" y="84" width="174" height="1.5" fill={color} />
      <rect x="18" y="96" width="40" height="3" fill={color} />
      <rect x="18" y="104" width="174" height="3" fill={LINEA} />
      <rect x="18" y="111" width="160" height="3" fill={LINEA} />
      <rect x="18" y="118" width="168" height="3" fill={LINEA} />
      <rect x="18" y="134" width="174" height="34" fill={CAJA} />
      <rect x="26" y="144" width="120" height="5" fill={color} />
      <rect x="26" y="154" width="100" height="5" fill={color} />
      <rect x="18" y="182" width="82" height="3" fill={color} />
      <rect x="110" y="182" width="82" height="3" fill={color} />
      <rect x="18" y="190" width="82" height="22" fill={FILETE} />
      <rect x="110" y="190" width="82" height="22" fill={FILETE} />
      <rect x="18" y="226" width="40" height="3" fill={color} />
      <rect x="18" y="234" width="50" height="10" rx="2" fill={FILETE} />
      <rect x="72" y="234" width="44" height="10" rx="2" fill={FILETE} />
      <rect x="120" y="234" width="54" height="10" rx="2" fill={FILETE} />
    </svg>
  )
}

function MiniaturaPortada({ color, portada }: { color: string; portada: string | null }) {
  return (
    <svg viewBox="0 0 210 297" aria-hidden="true">
      {portada ? (
        <>
          <image href={portada} x="0" y="0" width="210" height="297" preserveAspectRatio="xMidYMid slice" />
          <rect width="210" height="297" fill="#111312" opacity="0.55" />
        </>
      ) : (
        <rect width="210" height="297" fill={color} />
      )}
      <rect x="18" y="196" width="28" height="28" rx="3" fill="#fff" />
      <rect x="18" y="232" width="150" height="12" fill="#fff" />
      <rect x="18" y="250" width="110" height="4" fill="#fff" opacity="0.7" />
      <rect x="18" y="262" width="170" height="3" fill="#fff" opacity="0.5" />
      <rect x="18" y="269" width="150" height="3" fill="#fff" opacity="0.5" />
      <rect x="0" y="291" width="210" height="6" fill={color} />
    </svg>
  )
}

function MiniaturaColumnas({ color, portada }: { color: string; portada: string | null }) {
  // Sin franja de foto, lo de la derecha sube: no queda un hueco arriba.
  const sube = portada ? 0 : 40
  return (
    <svg viewBox="0 0 210 297" aria-hidden="true">
      <rect width="210" height="297" fill="#fff" />
      <rect width="64" height="297" fill={color} />
      <rect x="10" y="20" width="22" height="22" rx="3" fill="#fff" />
      <rect x="10" y="52" width="44" height="7" fill="#fff" />
      <rect x="10" y="64" width="34" height="3" fill="#fff" opacity="0.7" />
      <rect x="10" y="90" width="44" height="2.5" fill="#fff" opacity="0.5" />
      <rect x="10" y="96" width="38" height="2.5" fill="#fff" opacity="0.5" />
      <rect x="10" y="102" width="40" height="2.5" fill="#fff" opacity="0.5" />
      <rect x="10" y="240" width="40" height="2.5" fill="#fff" opacity="0.5" />
      <rect x="10" y="246" width="34" height="2.5" fill="#fff" opacity="0.5" />
      {portada && (
        <image href={portada} x="76" y="16" width="118" height="30" preserveAspectRatio="xMidYMid slice" />
      )}
      <g transform={`translate(0 ${-sube})`}>
        <rect x="76" y="56" width="40" height="3" fill={color} />
        <rect x="76" y="64" width="118" height="3" fill={LINEA} />
        <rect x="76" y="71" width="110" height="3" fill={LINEA} />
        <rect x="76" y="78" width="114" height="3" fill={LINEA} />
        <rect x="76" y="92" width="118" height="30" fill={CAJA} />
        <rect x="76" y="132" width="40" height="3" fill={color} />
        <rect x="76" y="139" width="118" height="3" fill={LINEA} />
        <rect x="76" y="146" width="56" height="3" fill={color} />
        <rect x="76" y="154" width="56" height="22" fill={FILETE} />
        <rect x="138" y="146" width="56" height="3" fill={color} />
        <rect x="138" y="154" width="56" height="22" fill={FILETE} />
      </g>
    </svg>
  )
}
