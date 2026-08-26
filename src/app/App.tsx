/** El arbol entero: datos, sesion, tema, avisos y rutas. */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorApi } from '@/api/cliente'
import { patrones } from '@/rutas'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Armazon } from './Armazon'
import { Privada } from './Privada'
import { Salvavidas } from './Salvavidas'
import { ProveedorSesion } from './Sesion'

import { Vacantes } from '@/paginas/vacantes/Vacantes'
import { Vacante } from '@/paginas/vacantes/Vacante'
import { Ingresar } from '@/paginas/cuenta/Ingresar'
import { Acceso } from '@/paginas/cuenta/Acceso'
import { Registro } from '@/paginas/cuenta/Registro'
import { Clave } from '@/paginas/cuenta/Clave'
import { Postular } from '@/paginas/postular/Postular'
import { Perfil } from '@/paginas/perfil/Perfil'
import { Procesos } from '@/paginas/procesos/Procesos'
import { Proceso } from '@/paginas/procesos/Proceso'
import { Evaluacion } from '@/paginas/evaluacion/Evaluacion'
import { Prueba } from '@/paginas/prueba/Prueba'
import { Simulacion } from '@/paginas/simulacion/Simulacion'
import { Validacion } from '@/paginas/validacion/Validacion'
import { Decision } from '@/paginas/decision/Decision'
import { Privacidad } from '@/paginas/privacidad/Privacidad'

import { ProveedorSesionPanel } from '@/panel/Sesion'
import { ArmazonPanel } from '@/panel/Armazon'
import { EntrarPanel } from '@/panel/entrar/Entrar'
import { InvitacionPanel } from '@/panel/entrar/Invitacion'
import { VacantesPanel } from '@/panel/vacantes/Vacantes'
import { VacantePanelDetalle } from '@/panel/vacantes/Vacante'
import { SesionesPanel } from '@/panel/simulacion/Sesiones'
import { ConfiguracionPanel } from '@/panel/configuracion/Configuracion'

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

/**
 * `/invitacion` → `/admin/invitacion`, conservando el token.
 *
 * Existe solo por si `renaser.panel.url` del backend no lleva el `/admin`. Es
 * una linea que puede borrarse el dia que esa propiedad este puesta en todos
 * los entornos; mientras tanto, es lo que evita que un enlace de invitacion
 * muera en la portada del candidato.
 */
function HaciaLaInvitacion() {
  return <Navigate to={`${patrones.adminInvitacion}${window.location.search}`} replace />
}

export function App() {
  return (
    <Salvavidas>
      <QueryClientProvider client={datos}>
          <ProveedorSesion>
            <ProveedorAvisos>
              <BrowserRouter>
                <Routes>
                  {/* ---------- El panel del equipo ---------- */}
                  {/* Va antes que el portal y fuera de su armazon: otra persona,
                      otra sesion, otra cabecera. El candado vive en ArmazonPanel. */}
                  <Route
                    path={patrones.adminEntrar}
                    element={
                      <ProveedorSesionPanel>
                        <EntrarPanel />
                      </ProveedorSesionPanel>
                    }
                  />
                  {/*
                    Canjear la invitacion. Suelta y NO dentro de ArmazonPanel:
                    ese armazon manda a `/admin/entrar` a quien no tiene sesion,
                    y quien viene de una invitacion es justo eso.
                  */}
                  <Route
                    path={patrones.adminInvitacion}
                    element={
                      <ProveedorSesionPanel>
                        <InvitacionPanel />
                      </ProveedorSesionPanel>
                    }
                  />
                  {/*
                    El backend arma el enlace con `renaser.panel.url`, que puede
                    no llevar el `/admin`. Sin esta linea el comodin del final se
                    traga la direccion y el token se pierde sin decir nada.
                  */}
                  <Route path={patrones.invitacionSuelta} element={<HaciaLaInvitacion />} />
                  <Route
                    element={
                      <ProveedorSesionPanel>
                        <ArmazonPanel />
                      </ProveedorSesionPanel>
                    }
                  >
                    <Route path={patrones.adminVacantes} element={<VacantesPanel />} />
                    <Route path={patrones.adminVacante} element={<VacantePanelDetalle />} />
                    <Route path={patrones.adminSesiones} element={<SesionesPanel />} />
                    <Route path={patrones.adminConfiguracion} element={<ConfiguracionPanel />} />
                  </Route>

                  <Route element={<Armazon />}>
                    {/* Publico */}
                    <Route path={patrones.vacantes} element={<Vacantes />} />
                    <Route path={patrones.vacante} element={<Vacante />} />
                    <Route path={patrones.ingresar} element={<Ingresar />} />
                    {/* La entrada por el enlace del correo: sin contrasena. */}
                    <Route path={patrones.acceso} element={<Acceso />} />
                    <Route path={patrones.registro} element={<Registro />} />
                    <Route path={patrones.clave} element={<Clave />} />

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
                      path={patrones.perfil}
                      element={
                        <Privada>
                          <Perfil />
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
                    {/* Existe y funciona, pero todavia no se enlaza desde
                        ningun sitio: ver el comentario de `Validacion.tsx`. */}
                    <Route
                      path={patrones.validacion}
                      element={
                        <Privada>
                          <Validacion />
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
      </QueryClientProvider>
    </Salvavidas>
  )
}
