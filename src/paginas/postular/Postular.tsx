/**
 * El formulario de postulacion: CV, enlaces y el resultado del que se siente
 * orgulloso.
 *
 * Lo que el mockup no tenia: los requisitos indispensables de la vacante. El
 * backend los manda y el candidato tiene que confirmarlos, porque son lo unico
 * que puede detener una postulacion sin que intervenga una persona.
 */

import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { postular, verVacante } from '@/api/portal'
import { rutas } from '@/rutas'
import { useAviso } from '@/ui/Avisos'
import { Cargando, Fallo } from '@/ui/Mensajes'

const MAXIMO_CV = 10 * 1024 * 1024

export function Postular() {
  const { vacanteId = '' } = useParams()
  const navegar = useNavigate()
  const avisar = useAviso()
  const cache = useQueryClient()
  const campoArchivo = useRef<HTMLInputElement>(null)

  const [cv, setCv] = useState<File | null>(null)
  const [resultado, setResultado] = useState('')
  const [portafolio, setPortafolio] = useState('')
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub] = useState('')
  const [confirmados, setConfirmados] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const vacante = useQuery({
    queryKey: ['vacante', vacanteId],
    queryFn: () => verVacante(vacanteId),
    enabled: vacanteId !== '',
  })

  const envio = useMutation({
    mutationFn: postular,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['postulaciones'] })
      avisar('Postulación recibida. Te avisaremos cuando avance.')
      navegar(rutas.procesos(), { replace: true })
    },
    onError: (causa) => {
      setError(causa instanceof Error ? causa.message : 'No pudimos enviar la postulación.')
    },
  })

  if (vacante.isPending) return <Cargando que="Preparando el formulario…" />
  if (vacante.isError) {
    return <Fallo error={vacante.error} reintentar={() => void vacante.refetch()} />
  }

  // Se copia a una constante para que el cierre de `enviar` la vea sin dudas.
  const v = vacante.data
  const requisitos = v.requisitosObjetivos
  const faltanRequisitos = requisitos.length > 0 && confirmados.length !== requisitos.length

  function alternarRequisito(id: number) {
    setConfirmados((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id],
    )
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!cv) return setError('Selecciona tu CV para continuar.')
    if (cv.size > MAXIMO_CV) return setError('El CV no puede pesar más de 10 MB.')
    if (!resultado.trim()) return setError('Cuéntanos al menos un resultado del que te sientas orgulloso.')
    if (faltanRequisitos) return setError('Confirma todos los requisitos indispensables.')

    envio.mutate({
      vacanteId: v.id,
      cv,
      resultadoOrgulloso: resultado.trim(),
      portafolio: portafolio.trim() || undefined,
      linkedin: linkedin.trim() || undefined,
      github: github.trim() || undefined,
      requisitosConfirmados: confirmados,
    })
  }

  return (
    <>
      <Link className="back" to={rutas.vacante(vacanteId)}>
        ← Volver a la vacante
      </Link>

      <div className="pagehead">
        <div>
          <div className="eyebrow">Postulación</div>
          <h1>{v.titulo}</h1>
          <p>
            Comparte tu experiencia y evidencia. Podrás revisar esta información antes de
            enviarla.
          </p>
        </div>
      </div>

      <form className="card form-card" onSubmit={enviar} noValidate>
        <div className="upload">
          <input
            ref={campoArchivo}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setCv(e.target.files?.[0] ?? null)}
          />
          <b>{cv ? cv.name : 'Sube tu CV'}</b>
          <span>PDF o Word · máximo 10 MB</span>
          <button className="btn" type="button" onClick={() => campoArchivo.current?.click()}>
            {cv ? 'Cambiar archivo' : 'Seleccionar archivo'}
          </button>
        </div>

        <div className="formgrid" style={{ marginTop: 18 }}>
          <div className="field full">
            <label htmlFor="portafolio">Portafolio o sitio personal</label>
            <input
              id="portafolio"
              placeholder="https://"
              value={portafolio}
              onChange={(e) => setPortafolio(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="linkedin">LinkedIn</label>
            <input
              id="linkedin"
              placeholder="https://linkedin.com/in/..."
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="github">GitHub u otro proyecto</label>
            <input
              id="github"
              placeholder="https://"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
            />
          </div>
          <div className="field full">
            <label htmlFor="resultado">Resultado del que te sientas orgulloso</label>
            <textarea
              id="resultado"
              placeholder="Cuéntanos qué cambió gracias a tu trabajo y cómo lo comprobaste."
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
            />
          </div>
        </div>

        {requisitos.length > 0 && (
          <>
            <div className="sectionhead">
              <div>
                <h2>Requisitos indispensables</h2>
                <p>Confirma cada uno. Es lo único que puede detener una postulación solo.</p>
              </div>
            </div>
            <div className="stack">
              {requisitos.map((r) => (
                <label className="consent" key={r.id}>
                  <input
                    type="checkbox"
                    checked={confirmados.includes(r.id)}
                    onChange={() => alternarRequisito(r.id)}
                  />
                  <div>
                    <b>{r.descripcion}</b>
                    <p>Confirmo que cumplo este requisito.</p>
                  </div>
                </label>
              ))}
            </div>
          </>
        )}

        {error && <div className="error">{error}</div>}

        <div className="row" style={{ marginTop: 20 }}>
          <span className="small">Podrás retirar tu postulación desde tu panel.</span>
          <button className="btn primary large" type="submit" disabled={envio.isPending}>
            {envio.isPending ? 'Enviando…' : 'Enviar postulación'}
          </button>
        </div>
      </form>
    </>
  )
}
