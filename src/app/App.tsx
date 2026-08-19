/** El arbol entero: datos, sesion, tema, avisos y rutas. */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import { patrones } from '@/rutas'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Armazon } from './Armazon'
import { Privada } from './Privada'
import { ProveedorSesion } from './Sesion'
import { ProveedorTema } from './Tema'

import { Vacantes } from '@/paginas/vacantes/Vacantes'
import { Vacante } from '@/paginas/vacantes/Vacante'
import { Ingresar } from '@/paginas/cuenta/Ingresar'
import { Registro } from '@/paginas/cuenta/Registro'
import { Postular } from '@/paginas/postular/Postular'
import { Procesos } from '@/paginas/procesos/Procesos'
import { Proceso } from '@/paginas/procesos/Proceso'
import { Evaluacion } from '@/paginas/evaluacion/Evaluacion'
import { Prueba } from '@/paginas/prueba/Prueba'
import { Simulacion } from '@/paginas/simulacion/Simulacion'
import { Decision } from '@/paginas/decision/Decision'
import { Privacidad } from '@/paginas/privacidad/Privacidad'

const datos = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,

      // Insistir con un 401 o un 404 no arregla nada: o no hay sesion, o no es
      // suyo. Los demas fallos si se reintentan.
      retry: (intentos, causa) =>
        causa instanceof ErrorApi && (causa.esSesionCaida || causa.esAjeno)
          ? false
          : intentos < 2,

      // Al leer se intenta siempre. Por defecto la libreria deja la peticion
      // «en pausa» cuando cree que no hay red, y la pantalla se queda girando
      // sin decir nada; `api/cliente.ts` ya convierte un fallo de conexion en
      // un error con su mensaje, y eso se puede enseñar.
      networkMode: 'always',
    },

    // Al escribir es al reves, y por eso se deja el comportamiento de fabrica:
    // si no hay red, la libreria espera y reintenta sola cuando vuelve. Para el
    // guardado automatico de una respuesta a media evaluacion, que se guarde
    // tarde es mejor que fallar y perderla.
  },
})

export function App() {
  return (
    <QueryClientProvider client={datos}>
      <ProveedorTema>
        <ProveedorSesion>
          <ProveedorAvisos>
            <BrowserRouter>
              <Routes>
                <Route element={<Armazon />}>
                  {/* Publico */}
                  <Route path={patrones.vacantes} element={<Vacantes />} />
                  <Route path={patrones.vacante} element={<Vacante />} />
                  <Route path={patrones.ingresar} element={<Ingresar />} />
                  <Route path={patrones.registro} element={<Registro />} />

                  {/* Con cuenta */}
                  <Route
                    path={patrones.postular}
                    element={
                      <Privada>
                        <Postular />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.procesos}
                    element={
                      <Privada>
                        <Procesos />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.proceso}
                    element={
                      <Privada>
                        <Proceso />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.evaluacion}
                    element={
                      <Privada>
                        <Evaluacion />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.prueba}
                    element={
                      <Privada>
                        <Prueba />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.simulacion}
                    element={
                      <Privada>
                        <Simulacion />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.decision}
                    element={
                      <Privada>
                        <Decision />
                      </Privada>
                    }
                  />
                  <Route
                    path={patrones.privacidad}
                    element={
                      <Privada>
                        <Privacidad />
                      </Privada>
                    }
                  />

                  {/* Cualquier otra cosa, a la portada */}
                  <Route path="*" element={<Navigate to={patrones.vacantes} replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ProveedorAvisos>
        </ProveedorSesion>
      </ProveedorTema>
    </QueryClientProvider>
  )
}
