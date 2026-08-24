/**
 * La red de seguridad de toda la aplicacion.
 *
 * Sin esto, cualquier error al pintar una pantalla deja la pagina **en negro y
 * sin un solo mensaje**: React desmonta el arbol entero y el candidato se queda
 * mirando el fondo, sin saber si es su conexion, su navegador o el sistema. En
 * un portal donde alguien puede estar a mitad de una prueba cronometrada, eso
 * es lo peor que puede pasar.
 *
 * Aqui se para el golpe y se enseña que ocurrio, con una salida.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import estilos from '@/ui/Estados.module.css'

interface Props {
  children: ReactNode
}

interface Estado {
  error: Error | null
}

export class Salvavidas extends Component<Props, Estado> {
  override state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Queda en la consola para poder mirarlo. Cuando haya donde mandarlo,
    // este es el sitio.
    console.error('El portal se rompió al pintar una pantalla:', error, info)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className={estilos.marco}>
        <span className={estilos.eti}>Error inesperado</span>
        <h1 className={estilos.titulo}>Algo se rompió en esta pantalla.</h1>
        <p className={estilos.texto}>
          No es culpa tuya y no has perdido nada: lo que hayas respondido está
          guardado. Vuelve a cargar la página para continuar.
        </p>

        <div className={estilos.detalle}>
          <b className={estilos.tituloDetalle}>Detalle técnico</b>
          <p className={estilos.mensajeDetalle}>{error.message}</p>
        </div>

        <div className={estilos.botones}>
          <button
            className={estilos.principal}
            type="button"
            onClick={() => location.reload()}
          >
            Recargar la página
          </button>
          <a href="/">Ir al inicio</a>
        </div>
      </div>
    )
  }
}
