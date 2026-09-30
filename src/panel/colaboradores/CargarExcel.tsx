/**
 * «Cargar Excel»: descargar la plantilla, subir el archivo y ver el resultado.
 *
 * Todo o nada, como en el backend: si el archivo tiene un solo error no se
 * guarda nada, y aquí se enseñan **todos** en una tabla —fila, columna, valor y
 * qué pasa— para corregirlo de una pasada. La importación del banco devolvía la
 * misma lista y su pantalla no la enseñaba; esta sí.
 */

import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/ui/Modal'
import { ErrorApi } from '../api/cliente'
import { cargarExcel, descargarPlantilla } from '../api/colaboradores'
import type { ErrorDeCarga, ResultadoCarga } from '../api/tiposPersonas'
import tabla from '../ui/Tabla.module.css'
import estilos from './Colaboradores.module.css'
import propios from './CargarExcel.module.css'
import { useRetenerLaSesion } from '../Sesion'
import { AvisoDeFallo, explicarFallo, useUnaVez } from '../ui/Envio'

const DIEZ_MB = 10 * 1024 * 1024

export function CargarExcel({ alCerrar }: { alCerrar: () => void }) {
  const cache = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [aviso, setAviso] = useState<ReactNode>(null)
  const [errores, setErrores] = useState<ErrorDeCarga[] | null>(null)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)

  const plantilla = useMutation({
    mutationFn: descargarPlantilla,
    onSuccess: (bajado) => {
      const url = URL.createObjectURL(bajado.contenido)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = bajado.nombre ?? 'plantilla-colaboradores.xlsx'
      enlace.click()
      URL.revokeObjectURL(url)
    },
    onError: (causa) => setAviso(explicarFallo(causa, 'No se pudo descargar la plantilla.')),
  })

  const carga = useMutation({
    mutationFn: () => cargarExcel(archivo!),
    onSuccess: async (hecho) => {
      setResultado(hecho)
      setErrores(null)
      setAviso(null)
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['panel-colaboradores'] }),
        cache.invalidateQueries({ queryKey: ['panel-colaboradores-pendientes'] }),
      ])
    },
    onError: (causa) => {
      setResultado(null)
      const lista = causa instanceof ErrorApi ? (causa.cuerpo as { errores?: ErrorDeCarga[] } | null)?.errores : null
      if (Array.isArray(lista) && lista.length > 0) {
        setErrores(lista)
        setAviso(null)
      } else {
        setErrores(null)
        setAviso(explicarFallo(causa, 'No se pudo cargar el archivo.'))
      }
    },
  })

  // El archivo elegido se queda si la sesión caduca: basta con volver a entrar y cargar.
  useRetenerLaSesion(true)
  const unaVez = useUnaVez()

  function validarYCargar() {
    if (archivo === null) return
    unaVez(() => {
      setResultado(null)
      setErrores(null)
      setAviso(null)
      return carga.mutateAsync()
    })
  }

  function elegir(elegido: File | null) {
    setResultado(null)
    setErrores(null)
    setAviso(null)
    if (!elegido) {
      setArchivo(null)
      return
    }
    // Lo que el backend rechazaría igual, dicho antes de subir nada.
    if (!elegido.name.toLowerCase().endsWith('.xlsx')) {
      setArchivo(null)
      setAviso('El archivo tiene que ser un Excel .xlsx. Descarga la plantilla y guárdala en ese formato.')
      return
    }
    if (elegido.size > DIEZ_MB) {
      setArchivo(null)
      setAviso('El archivo pesa más de 10 MB.')
      return
    }
    setArchivo(elegido)
  }

  return (
    <Modal
      abierto
      pantallaCompleta
      titulo="Cargar colaboradores desde Excel"
      onCerrar={alCerrar}
    >
      <ol className={propios.pasos}>
        <li className={propios.paso}>
          <span className={propios.numero} aria-hidden="true">
            1
          </span>
          <div className={propios.contenido}>
            <h3 className={propios.tituloPaso}>Descarga la plantilla</h3>
            <p className={estilos.explica}>
              Trae las columnas, con las obligatorias marcadas, y la hoja «Valores» con las sedes,
              áreas y cargos que valen hoy.
            </p>
            <button
              className={estilos.secundario}
              type="button"
              disabled={plantilla.isPending}
              onClick={() => unaVez(() => plantilla.mutateAsync())}
            >
              {plantilla.isPending ? 'Descargando…' : 'Descargar plantilla'}
            </button>
          </div>
        </li>
        <li className={propios.paso}>
          <span className={propios.numero} aria-hidden="true">
            2
          </span>
          <div className={propios.contenido}>
            <h3 className={propios.tituloPaso}>Sube el archivo</h3>
            <p className={estilos.explica}>
              Una fila por persona. Si el documento no existe, es un alta; si ya es colaborador, se
              actualizan sus datos personales. Hasta 5.000 filas y 10 MB.
            </p>
            <div className={propios.subir}>
              <label className={estilos.campoModal}>
                <span className={estilos.rotulo}>Archivo .xlsx</span>
                <input
                  ref={entrada}
                  className={propios.archivo}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => elegir(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                className={estilos.crear}
                type="button"
                disabled={archivo === null || carga.isPending}
                onClick={validarYCargar}
              >
                {carga.isPending ? 'Validando…' : 'Validar y cargar'}
              </button>
            </div>
          </div>
        </li>
        <li className={propios.paso}>
          <span className={propios.numero} aria-hidden="true">
            3
          </span>
          <div className={propios.contenido} aria-live="polite">
            <h3 className={propios.tituloPaso}>Resultado</h3>
            {aviso && <AvisoDeFallo className={estilos.avisoMalo}>{aviso}</AvisoDeFallo>}
            {resultado && (
              <p className={estilos.avisoBueno} role="status">
                Se dieron de alta {resultado.altas}{' '}
                {resultado.altas === 1 ? 'colaborador' : 'colaboradores'} y se actualizaron{' '}
                {resultado.actualizados}.
              </p>
            )}
            {errores && (
              <>
                <AvisoDeFallo className={estilos.avisoMalo}>
                  {errores.length === 1
                    ? 'El archivo tiene 1 error. No se guardó nada.'
                    : `El archivo tiene ${errores.length} errores. No se guardó nada.`}
                </AvisoDeFallo>
                <div className={tabla.envoltura}>
                  <table className={tabla.tabla} aria-label="Errores del archivo">
                    <thead>
                      <tr>
                        <th className={tabla.cifra}>Fila</th>
                        <th>Columna</th>
                        <th>Valor</th>
                        <th>Qué pasa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {errores.map((e, i) => (
                        <tr key={`${e.fila}-${e.columna}-${i}`}>
                          <td className={tabla.cifra}>{e.fila > 0 ? e.fila : '—'}</td>
                          <td>{e.columna}</td>
                          <td className={propios.valor}>{e.valor || '—'}</td>
                          <td>{e.mensaje}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!aviso && !resultado && !errores && (
              <p className={estilos.explica}>Aquí verás lo que se guardó, o todos los errores si hay alguno.</p>
            )}
          </div>
        </li>
      </ol>
    </Modal>
  )
}
