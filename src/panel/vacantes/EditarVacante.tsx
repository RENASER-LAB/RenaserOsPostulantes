/**
 * Corregir una vacante que ya existe, con el formulario en el que se escribio.
 *
 * ## Por que vive en un modal
 *
 * Antes se abria encima de la tabla y empujaba las filas hacia abajo: quien
 * pulsaba el lapiz de la fila doce perdia de vista la fila doce. El modal deja
 * la lista quieta detras, que es la referencia de donde se estaba.
 *
 * Es el modal compartido de `src/ui/Modal.tsx` y no otro: alli ya estan
 * resueltos el Escape, el foco atrapado dentro, el fondo que no se opera y la
 * vuelta del foco al boton que lo abrio. Una infraestructura propia de dialogos
 * repetiria esas cuatro cosas y las repetiria peor.
 *
 * ## Lo que esta pantalla tiene que decir antes de que nadie pulse nada
 *
 * Una vacante publicada la esta leyendo gente que ya postulo. Cambiarle el
 * horario no es guardar un campo: es cambiarle las condiciones a quien esta
 * dentro del proceso. Por eso, **debajo del boton y no en otro dialogo**, se
 * dice a cuanta gente le va a llegar el aviso. No se pide confirmacion:
 * corregir una vacante es lo normal, y un «¿estas seguro?» a cada guardado se
 * aprende a despachar sin leerlo.
 *
 * ## Cerrar con algo escrito no tira lo escrito
 *
 * Cancelar, el aspa, Escape y el fondo hacen lo mismo, y lo que hacen depende
 * de si hay cambios: sin ellos cierra, con ellos pregunta. La pregunta se pinta
 * **dentro del mismo modal** en vez de abrir otro encima, y eso no es estetica:
 * el formulario sigue montado detras, asi que «Seguir editando» devuelve lo
 * escrito tal cual estaba. Desmontarlo para preguntar seria perder justo lo que
 * la pregunta intenta salvar.
 *
 * ## Lo que no se puede cambiar, y se dice por que
 *
 * La solicitud y el puesto salen como texto fijo. El puesto decide el nivel y la
 * familia de toda la evaluacion —quien la responde, con que banco, con que
 * pesos—, asi que cambiarlo a mitad de proceso dejaria a la gente medida con una
 * vara y comparada con otra. Un desplegable apagado sin explicacion se lee como
 * una averia; esto lo dice con palabras.
 *
 * ## El sueldo entra aqui
 *
 * Antes tenia que cambiarse en una llamada aparte, asi que mover el sueldo y el
 * horario a la vez mandaba dos avisos por un solo cambio. Ahora va en el mismo
 * guardado, con su motivo cuando la vacante esta publicada. La tarjeta del
 * detalle sigue existiendo para cambiar solo el sueldo.
 */

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { editarVacante, listarPuestos } from '../api/panel'
import type { VacantePanel } from '../api/tipos'
import { Modal } from '@/ui/Modal'
import {
  CamposComunes,
  Campo,
  camposParaGuardar,
  loQueFaltaEnLaVacante,
  vacanteComoFormulario,
  type DatosDeVacante,
} from './CamposDeLaVacante'
import { CamposDeRemuneracion, comoCuerpo, desdeLaVacante, mismoSueldo } from './Remuneracion'
import estilos from './Vacantes.module.css'

/** El id que ata los botones del pie con el formulario del cuerpo del modal. */
const FORMULARIO = 'formulario-editar-vacante'

export function FormularioDeEdicion({
  vacante,
  alCerrar,
  alTerminar,
  alFallar,
}: {
  vacante: VacantePanel
  /** Cerrar sin guardar: cancelar, el aspa, Escape o el fondo. */
  alCerrar: () => void
  /** Se llama con lo que el panel tiene que decir en voz alta al cerrar. */
  alTerminar: (mensaje: string) => void
  /**
   * El mismo fallo, repetido FUERA del modal por si el modal no sobrevive.
   *
   * Ver el comentario de `onError`: el error se escribe dentro del formulario, y
   * eso basta mientras el formulario siga en pantalla. Cuando la vacante ya no
   * existe, la fila se va de la lista y el modal se desmonta con ella —el
   * mensaje incluido—, asi que el panel necesita tenerlo tambien fuera.
   */
  alFallar: (mensaje: string) => void
}) {
  const [datos, setDatos] = useState<DatosDeVacante>(() => vacanteComoFormulario(vacante))
  const [remuneracion, setRemuneracion] = useState(() => desdeLaVacante(vacante.remuneracion))
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
  /** Si se pidio cerrar con cambios sin guardar y falta decidir que se hace. */
  const [preguntandoSiDescartar, setPreguntandoSiDescartar] = useState(false)
  const cache = useQueryClient()
  const puestos = useQuery({ queryKey: ['panel-puestos'], queryFn: listarPuestos })

  const poner = (campo: keyof DatosDeVacante) => (valor: string) =>
    setDatos((actuales) => ({ ...actuales, [campo]: valor }))

  const publicada = vacante.estado === 'PUBLICADA'
  const sueldoNuevo = comoCuerpo(remuneracion)
  // Con el sueldo a medio escribir se asume que cambia: lo que decide si se pide
  // el motivo no puede depender de que la cifra ya sea valida.
  const cambiaElSueldo =
    'error' in sueldoNuevo || !mismoSueldo(sueldoNuevo.datos, vacante.remuneracion)
  const enCarrera = vacante.postulantesEnCarrera
  const puesto = (puestos.data ?? []).find((p) => p.id === vacante.puestoId)

  const guardado = useMutation({
    mutationFn: () => {
      const sueldo = comoCuerpo(remuneracion)
      if ('error' in sueldo) return Promise.reject(new Error(sueldo.error))
      return editarVacante(vacante.id, {
        solicitudTalentoId: vacante.solicitudTalentoId,
        ...camposParaGuardar(datos),
        remuneracion: sueldo.datos,
        motivoRemuneracion: cambiaElSueldo ? motivo.trim() : undefined,
      })
    },
    onSuccess: (respuesta) => {
      if (!respuesta.huboCambios) {
        alTerminar('No había cambios que guardar')
        return
      }
      const avisados = respuesta.postulantesAvisados
      alTerminar(
        avisados === 0
          ? 'Cambios guardados'
          : `Cambios guardados. Avisamos a ${avisados} postulante${
              avisados === 1 ? '' : 's'
            } en su portal`,
      )
    },
    /*
     * Lo escrito se queda donde estaba: quien acaba de redactar tres párrafos no
     * puede perderlos porque el sueldo llevara un cero de más. Y el modal sigue
     * abierto, que es la otra mitad de lo mismo.
     *
     * Y la lista se refresca, aunque el guardado fallara. El fallo que importa
     * es que alguien haya CERRADO o ARCHIVADO la vacante mientras se corregía:
     * el backend lo rechaza entero —no se guarda nada—, y sin volver a pedir la
     * lista la fila seguiría diciendo «Publicada» y el lápiz seguiría invitando
     * a reintentar algo que ya no se puede.
     *
     * ⚠️ Y desde que una vacante se puede ELIMINAR, ese refresco puede llevarse
     * por delante este mismo modal: si la vacante ya no existe, su fila
     * desaparece de la lista y el formulario se desmonta con ella. El mensaje
     * que se acaba de escribir aquí se iría con el modal, y quien estaba
     * corrigiendo la convocatoria vería exactamente lo mismo que cuando el
     * guardado funciona: el formulario cerrándose sin decir nada. Por eso el
     * fallo se cuenta TAMBIÉN hacia fuera, donde nada lo desmonta.
     */
    onError: (causa) => {
      const mensaje = causa instanceof Error ? causa.message : 'No se pudo guardar la vacante.'
      setFallo(mensaje)
      alFallar(mensaje)
      void cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
    },
  })

  /**
   * Si hay algo escrito que se perderia al cerrar.
   *
   * Se compara contra lo que la vacante tiene guardado AHORA y no contra lo que
   * tenia al abrir: si el guardado refresco la fila, lo que ya esta guardado
   * deja de ser un cambio pendiente.
   */
  const hayCambiosSinGuardar =
    JSON.stringify(datos) !== JSON.stringify(vacanteComoFormulario(vacante))
    || cambiaElSueldo
    || motivo.trim() !== ''

  /*
   * La unica puerta de salida sin guardar, para las cuatro formas de pedirlo:
   * Cancelar, el aspa, Escape y el fondo. Que sea una sola es lo que hace que
   * las cuatro se comporten igual — escrita cuatro veces, la cuarta se olvida.
   *
   * Mientras la peticion esta en vuelo no se cierra: el guardado ya salio y
   * cerrar aqui dejaria al panel sin saber como acabo.
   */
  function intentarCerrar() {
    if (guardado.isPending) return
    if (hayCambiosSinGuardar) {
      setPreguntandoSiDescartar(true)
      return
    }
    alCerrar()
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault()
    setFallo(null)
    const falta = loQueFaltaEnLaVacante(datos)
    if (falta) {
      setFallo(falta)
      return
    }
    const sueldo = comoCuerpo(remuneracion)
    if ('error' in sueldo) {
      setFallo(sueldo.error)
      return
    }
    // La misma regla que el backend, dicha antes de pulsar: en una publicada, el
    // cambio de sueldo le llega a cada persona en carrera y la auditoría tiene
    // que poder contestar por qué.
    if (publicada && cambiaElSueldo && motivo.trim() === '') {
      setFallo('Escribe por qué cambia el sueldo: queda en la auditoría de la vacante.')
      return
    }
    guardado.mutate()
  }

  return (
    <Modal
      abierto
      titulo="Editar vacante"
      onCerrar={intentarCerrar}
      pie={
        <>
          <button
            className={estilos.secundarioModal}
            type="button"
            onClick={intentarCerrar}
            disabled={guardado.isPending}
          >
            Cancelar
          </button>
          <button
            className={estilos.guardar}
            type="submit"
            form={FORMULARIO}
            disabled={guardado.isPending}
          >
            {guardado.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </>
      }
    >
      {/*
        La pregunta va aquí arriba y el formulario sigue montado debajo: es lo
        que hace que «Seguir editando» devuelva lo escrito tal cual estaba.
      */}
      {preguntandoSiDescartar && (
        <div className={estilos.descartar} role="alertdialog" aria-label="Cambios sin guardar">
          <p className={estilos.descartarTexto}>
            Hay cambios sin guardar en esta vacante.
          </p>
          <div className={estilos.descartarBotones}>
            <button
              className={estilos.secundarioModal}
              type="button"
              onClick={() => {
                setPreguntandoSiDescartar(false)
                alCerrar()
              }}
            >
              Descartar cambios
            </button>
            <button
              className={estilos.seguirEditando}
              type="button"
              autoFocus
              onClick={() => setPreguntandoSiDescartar(false)}
            >
              Seguir editando
            </button>
          </div>
        </div>
      )}

      <form id={FORMULARIO} className={estilos.enElModal} onSubmit={alEnviar} noValidate>
        <div className={`${estilos.puestoResumen} ${estilos.anchoEntero}`}>
          <span className={estilos.etiqueta}>Solicitud y puesto</span>
          <strong>
            Solicitud #{vacante.solicitudTalentoId} ·{' '}
            {puesto?.nombre ?? `Puesto ${vacante.puestoId}`}
          </strong>
          <span className={estilos.clasificacionPuesto}>
            El puesto decide el nivel y la familia de la evaluación; para cambiarlo, crea otra
            vacante
          </span>
        </div>

        <div className={estilos.rejilla}>
          <CamposComunes datos={datos} poner={poner} />
        </div>

        <div className={estilos.bloqueRemuneracion}>
          <CamposDeRemuneracion
            valor={remuneracion}
            alCambiar={setRemuneracion}
            /*
             * Publicar el sueldo o no publicarlo se decide ANTES de publicar la
             * vacante: quien postulo bajo una regla no puede quedarse con la otra.
             * El monto sí se cambia, y es justo lo que se avisa.
             */
            visibilidadCongelada={publicada}
            laEnsenaba={vacante.remuneracion?.tipo !== 'OCULTA'}
          />
          {publicada && cambiaElSueldo && (
            <Campo
              etiqueta="Por qué cambia el sueldo"
              valor={motivo}
              alCambiar={setMotivo}
              ancho
            />
          )}
        </div>

        {fallo && (
          <p className={`${estilos.aviso} ${estilos.malo}`} role="alert">
            {fallo}
          </p>
        )}

        {/*
          Debajo de los campos y encima del pie, sin pedir confirmación. Es
          información, no un permiso que haya que dar: quien corrige una vacante
          tiene derecho a hacerlo, y lo único que le falta es saber que no lo
          hace en privado.
        */}
        {publicada && enCarrera > 0 && (
          <p className={estilos.avisoPrevio}>
            Al guardar, avisaremos en su portal a {enCarrera} postulante
            {enCarrera === 1 ? '' : 's'} en carrera de lo que cambies
          </p>
        )}
      </form>
    </Modal>
  )
}
