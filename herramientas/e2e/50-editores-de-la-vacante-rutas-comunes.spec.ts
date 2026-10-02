import { expect, test } from '@playwright/test'
import { limpiarSiempre } from './base-de-datos'
import { exigir, pedir, tokenDePanel } from './ayuda-preguntas-propias'
import {
  crearVacante,
  empresaB,
  escribirPrueba,
  lugarDe,
  publicarPrueba,
  retirarLoSembrado,
  sembrarEquipoSin,
} from './ayuda-prueba-propia'

/**
 * Los dos editores de una vacante —sus preguntas propias (V66) y su prueba del puesto
 * (V67)— comparten catorce rutas, declaradas una sola vez para los dos. Esta suite las
 * recorre en los dos con tres sesiones: quien puede editar, quien solo puede ver (sin
 * `editar_vacante`) y otra empresa. También las tres rutas de la ficha que viven bajo la
 * postulación. Que cada ruta conteste igual en los dos editores es lo que protege.
 *
 * Solo por la API: las pantallas de los dos editores ya las recorren 45 a 49.
 *
 * ⚠️ **ESCRIBE** en el clon del trabajo; `afterAll` lo retira (marca QA-PE-0067).
 */

const EDITORES = ['preguntas-propias', 'prueba-propia'] as const
type Editor = (typeof EDITORES)[number]
type Llamada = readonly [metodo: string, sufijo: string, cuerpo?: unknown]

const ruta = (editor: Editor, vacante: number, sufijo = '') => `/panel/vacantes/${vacante}/${editor}${sufijo}`

const correos: string[] = []
let equipo = ''
let lector = ''
let otraEmpresa = ''
let origen = 0
let destino = 0
const borrador = {} as Record<Editor, { criterios: number[]; preguntas: number[] }>

/** Dos criterios, una cerrada en cada uno, 100 puntos: se publica en los dos editores. */
async function escribir(editor: Editor, vacante: number, prefijo: string): Promise<any> {
  if (editor === 'prueba-propia') {
    return escribirPrueba(equipo, vacante, {
      criterios: ['Cálculo', 'Orden'].map((nombre) => ({
        nombre: `${prefijo} ${nombre}`,
        preguntas: [
          {
            tipo: 'OPCION_UNICA' as const,
            enunciado: `${prefijo}: ¿${nombre} primero?`,
            puntos: 50,
            opciones: [{ texto: 'Sí', puntos: 50 }, { texto: 'No', puntos: 0 }],
          },
        ],
      })),
      datos: { modalidad: 'CRONOMETRADA', duracionMinutos: 30 },
    })
  }
  let actual: any = null
  for (const nombre of ['Cálculo', 'Orden']) {
    actual = await exigir(ruta(editor, vacante, '/criterios'), equipo, 'POST', { nombre: `${prefijo} ${nombre}` })
    const id = (actual.borrador.criterios as any[]).find((c) => c.nombre === `${prefijo} ${nombre}`).id
    actual = await exigir(ruta(editor, vacante, '/preguntas'), equipo, 'POST', {
      tipo: 'OPCION_UNICA',
      enunciado: `${prefijo}: ¿${nombre} primero?`,
      puntos: 50,
      criterioId: id,
      opciones: [{ texto: 'Sí', puntos: 50 }, { texto: 'No', puntos: 0 }],
    })
  }
  return actual
}

/** El borrador tal como lo ve quien edita: ids y orden de criterios y preguntas. */
async function huella(editor: Editor): Promise<string> {
  const e = await exigir<any>(ruta(editor, destino), equipo)
  return JSON.stringify({
    borrador: e.borrador && {
      id: e.borrador.id,
      criterios: (e.borrador.criterios as any[]).map((c) => [c.id, c.orden, (c.preguntas as any[]).map((p) => p.id)]),
    },
    publicada: e.publicada?.id ?? null,
  })
}

const lecturas = (): Llamada[] => [
  ['GET', ''],
  ['GET', '/copiables'],
  ['GET', `/copiables/${origen}`],
  ['GET', '/recomendaciones'],
]

const escrituras = (editor: Editor): Llamada[] => {
  const [c1] = borrador[editor].criterios
  const [p1] = borrador[editor].preguntas
  return [
    ['POST', '/borrador'],
    ['DELETE', '/borrador'],
    ['DELETE', `/criterios/${c1}`],
    ['POST', `/criterios/${c1}/movimiento`, { direccion: 'ABAJO' }],
    ['DELETE', `/preguntas/${p1}`],
    ['POST', `/preguntas/${p1}/movimiento`, { direccion: 'ABAJO' }],
    ['POST', '/publicacion'],
    ['POST', '/publicada/recalificacion'],
    ['POST', '/copia', { vacanteOrigenId: origen }],
    ['POST', '/recomendaciones', {}],
  ]
}

test.describe('Las rutas comunes de los dos editores de la vacante', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    equipo = await tokenDePanel()
    const lugar = await lugarDe(equipo)
    origen = await crearVacante(equipo, 'Rutas comunes · de dónde se copia', lugar)
    destino = await crearVacante(equipo, 'Rutas comunes · la que se edita', lugar)
    for (const editor of EDITORES) {
      await escribir(editor, origen, 'Origen')
      const publicada = editor === 'prueba-propia'
        ? await publicarPrueba(equipo, origen)
        : await pedir(ruta(editor, origen, '/publicacion'), equipo, 'POST')
      expect(publicada.estado, `publicar ${editor} en la vacante de origen`).toBe(200)
      const e = await escribir(editor, destino, 'Destino')
      const criterios = (e.borrador.criterios as any[])
      borrador[editor] = {
        criterios: criterios.map((c) => c.id),
        preguntas: criterios.flatMap((c) => (c.preguntas as any[]).map((p) => p.id)),
      }
      expect(borrador[editor].criterios).toHaveLength(2)
      expect(borrador[editor].preguntas).toHaveLength(2)
    }
    lector = await tokenDePanel(sembrarEquipoSin('rutas-comunes', ['editar_vacante', 'ajustar_nota', 'abrir_ficha_candidato']))
    otraEmpresa = (await empresaB(correos)).token
  })

  test.afterAll(async () => {
    await limpiarSiempre([() => retirarLoSembrado(correos)])
  })

  for (const editor of EDITORES) {
    test(`${editor}: sin editar_vacante se lee todo y las diez escrituras son 403 sin tocar el borrador`, async () => {
      const antes = await huella(editor)
      for (const [metodo, sufijo] of lecturas()) {
        const r = await pedir(ruta(editor, destino, sufijo), lector, metodo)
        expect.soft(r.estado, `${metodo} ${sufijo || '(editor)'}`).toBe(200)
      }
      expect((await exigir<any>(ruta(editor, destino), lector)).puedeEditar).toBe(false)
      for (const [metodo, sufijo, cuerpo] of escrituras(editor)) {
        const r = await pedir(ruta(editor, destino, sufijo), lector, metodo, cuerpo)
        expect.soft(r.estado, `${metodo} ${sufijo}`).toBe(403)
      }
      expect(await huella(editor)).toBe(antes)
    })

    test(`${editor}: otra empresa recibe 404 en las catorce rutas y nada cambia`, async () => {
      const antes = await huella(editor)
      for (const [metodo, sufijo, cuerpo] of [...lecturas(), ...escrituras(editor)]) {
        const r = await pedir(ruta(editor, destino, sufijo), otraEmpresa, metodo, cuerpo)
        expect.soft(r.estado, `${metodo} ${sufijo || '(editor)'}`).toBe(404)
      }
      expect(await huella(editor)).toBe(antes)
    })

    test(`${editor}: quien edita usa las catorce rutas de punta a punta`, async () => {
      const [c1, c2] = borrador[editor].criterios
      const [p1] = borrador[editor].preguntas
      const r = (sufijo: string) => ruta(editor, destino, sufijo)

      // Leer: el editor, lo copiable (sin la propia), la vista previa y la recomendación
      expect((await exigir<any>(r(''), equipo)).puedeEditar).toBe(true)
      const copiables = await exigir<any[]>(r('/copiables'), equipo)
      expect(copiables.map((c) => c.vacanteId)).toContain(origen)
      expect(copiables.map((c) => c.vacanteId)).not.toContain(destino)
      const previa = await exigir<any>(r(`/copiables/${origen}`), equipo)
      expect((previa.criterios as any[]).map((c) => c.nombre)).toEqual(['Origen Cálculo', 'Origen Orden'])
      expect((await pedir(r('/recomendaciones'), equipo)).estado).toBe(200)

      // Mover y quitar en el borrador
      let e = await exigir<any>(r(`/criterios/${c1}/movimiento`), equipo, 'POST', { direccion: 'ABAJO' })
      expect((e.borrador.criterios as any[]).map((c) => c.id)).toEqual([c2, c1])
      e = await exigir<any>(r(`/preguntas/${p1}/movimiento`), equipo, 'POST', { direccion: 'ARRIBA' })
      expect(e.borrador.criterios.find((c: any) => c.id === c1).preguntas.map((p: any) => p.id)).toEqual([p1])
      e = await exigir<any>(r(`/preguntas/${p1}`), equipo, 'DELETE')
      expect(e.borrador.criterios.find((c: any) => c.id === c1).preguntas).toHaveLength(0)
      e = await exigir<any>(r(`/criterios/${c1}`), equipo, 'DELETE')
      expect((e.borrador.criterios as any[]).map((c) => c.id)).toEqual([c2])

      // Faltan 50 puntos, pero la IA está apagada en el preview: no se encola nada
      const pedida = await pedir(r('/recomendaciones'), equipo, 'POST', {})
      expect(pedida.estado).toBe(200)
      expect(pedida.cuerpo.encolada).toBe(false)

      // Con 50 puntos no se publica: 400 con la lista entera
      const incompleta = await pedir(r('/publicacion'), equipo, 'POST')
      expect(incompleta.estado).toBe(400)
      expect(incompleta.cuerpo.faltas.length).toBeGreaterThan(0)

      // Copiar la de origen reemplaza el borrador; publicarla sí se puede
      e = await exigir<any>(r('/copia'), equipo, 'POST', { vacanteOrigenId: origen })
      expect((e.borrador.criterios as any[]).map((c) => c.nombre)).toEqual(['Origen Cálculo', 'Origen Orden'])
      e = await exigir<any>(r('/publicacion'), equipo, 'POST')
      expect(e.publicada).not.toBeNull()
      expect(e.borrador ?? null).toBeNull()

      // Con la publicada: nadie la rindió, no hay a quién recalificar
      expect(await exigir<any>(r('/publicada/recalificacion'), equipo, 'POST')).toMatchObject({ personas: 0 })

      // Abrir un borrador desde la publicada y descartarlo
      e = await exigir<any>(r('/borrador'), equipo, 'POST')
      expect((e.borrador.criterios as any[]).map((c) => c.nombre)).toEqual(['Origen Cálculo', 'Origen Orden'])
      e = await exigir<any>(r('/borrador'), equipo, 'DELETE')
      expect(e.borrador ?? null).toBeNull()
      expect(e.publicada).not.toBeNull()
    })
  }

  test('las rutas de la ficha que viven bajo la postulación conservan permiso y corte', async () => {
    const ajuste = { puntaje: 1, motivo: 'QA: comprobar el permiso' }
    const rutas: Llamada[] = [
      ['PUT', '/panel/postulaciones/2147480000/evaluacion/respuestas/2147480000/nota', ajuste],
      ['GET', '/panel/postulaciones/2147480000/prueba-propia'],
      ['PUT', '/panel/postulaciones/2147480000/prueba-propia/criterios/2147480000/nota', ajuste],
    ]
    for (const [metodo, sufijo, cuerpo] of rutas) {
      expect.soft((await pedir(sufijo, lector, metodo, cuerpo)).estado, `lector ${metodo} ${sufijo}`).toBe(403)
      expect.soft((await pedir(sufijo, equipo, metodo, cuerpo)).estado, `equipo ${metodo} ${sufijo}`).toBe(404)
    }
  })
})
