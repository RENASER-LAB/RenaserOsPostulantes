/**
 * Corregir una vacante que ya existe, con el formulario en el que se escribio.
 *
 * ## Lo que esta pantalla tiene que decir antes de que nadie pulse nada
 *
 * Una vacante publicada la esta leyendo gente que ya postulo. Cambiarle el
 * horario no es guardar un campo: es cambiarle las condiciones a quien esta
 * dentro del proceso. Por eso, **debajo del boton y no en un dialogo**, se dice
 * a cuanta gente le va a llegar el aviso. No se pide confirmacion: corregir una
 * vacante es lo normal, y un «¿estas seguro?» a cada guardado se aprende a
 * despachar sin leerlo.
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
 * Y es la novedad. Antes tenia que cambiarse en una llamada aparte, asi que
 * mover el sueldo y el horario a la vez mandaba dos avisos por un solo cambio.
 * Ahora va en el mismo guardado, con su motivo cuando la vacante esta publicada.
 * La tarjeta del detalle sigue existiendo para cambiar solo el sueldo.
 */

import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { editarVacante, listarPuestos } from '../api/panel'
import type { VacantePanel } from '../api/tipos'
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

export function FormularioDeEdicion({
  vacante,
  alTerminar,
}: {
  vacante: VacantePanel
  /** Se llama con lo que el panel tiene que decir en voz alta al cerrar. */
  alTerminar: (mensaje: string) => void
}) {
  const [datos, setDatos] = useState<DatosDeVacante>(() => vacanteComoFormulario(vacante))
  const [remuneracion, setRemuneracion] = useState(() => desdeLaVacante(vacante.remuneracion))
  const [motivo, setMotivo] = useState('')
  const [fallo, setFallo] = useState<string | null>(null)
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
     * puede perderlos porque el sueldo llevara un cero de más.
     *
     * Y la lista se refresca, aunque el guardado fallara. El fallo que importa
     * es que alguien haya CERRADO la vacante mientras se corregía: el backend lo
     * rechaza entero —no se guarda nada—, y sin volver a pedir la lista la fila
     * seguiría diciendo «Publicada» y el lápiz seguiría invitando a reintentar
     * algo que ya no se puede.
     */
    onError: (causa) => {
      setFallo(causa instanceof Error ? causa.message : 'No se pudo guardar la vacante.')
      void cache.invalidateQueries({ queryKey: ['panel-vacantes'] })
    },
  })

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
    <form className={estilos.alta} onSubmit={alEnviar} noValidate>
      <h2 className={estilos.tituloAlta}>Editar vacante</h2>

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

      <button className={estilos.enviar} type="submit" disabled={guardado.isPending}>
        {guardado.isPending ? 'Guardando…' : 'Guardar cambios'}
      </button>

      {/*
        Debajo del botón, sin pedir confirmación. Es información, no un permiso
        que haya que dar: quien corrige una vacante tiene derecho a hacerlo, y lo
        único que le falta es saber que no lo hace en privado.
      */}
      {publicada && enCarrera > 0 && (
        <p className={estilos.avisoPrevio}>
          Al guardar, avisaremos en su portal a {enCarrera} postulante
          {enCarrera === 1 ? '' : 's'} en carrera de lo que cambies
        </p>
      )}
    </form>
  )
}
