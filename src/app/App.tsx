/** El arbol entero: datos, sesion, tema, avisos y rutas. */

import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { patrones } from '@/rutas'
import { ProveedorAvisos } from '@/ui/Avisos'
import { Armazon } from './Armazon'
import { crearClienteDeDatos } from './datos'
import { Privada } from './Privada'
import { Salvavidas } from './Salvavidas'
import { ProveedorSesion } from './Sesion'

import { Vacantes } from '@/paginas/vacantes/Vacantes'
import { BuscarVacantes } from '@/paginas/vacantes/BuscarVacantes'
import { Vacante } from '@/paginas/vacantes/Vacante'
import { Ingresar } from '@/paginas/cuenta/Ingresar'
import { Acceso } from '@/paginas/cuenta/Acceso'
import { Registro } from '@/paginas/cuenta/Registro'
import { Clave } from '@/paginas/cuenta/Clave'
import { Restablecer } from '@/paginas/cuenta/Restablecer'
import { Postular } from '@/paginas/postular/Postular'
import { Perfil } from '@/paginas/perfil/Perfil'
import { Procesos } from '@/paginas/procesos/Procesos'
import { Proceso } from '@/paginas/procesos/Proceso'
import { Evaluacion } from '@/paginas/evaluacion/Evaluacion'
import { Prueba } from '@/paginas/prueba/Prueba'
import { CuestionarioTecnico } from '@/paginas/cuestionario/CuestionarioTecnico'
import { Simulacion } from '@/paginas/simulacion/Simulacion'
import { Validacion } from '@/paginas/validacion/Validacion'
import { Decision } from '@/paginas/decision/Decision'
import { PoliticaPublica } from '@/paginas/privacidad/PoliticaPublica'
import { Privacidad } from '@/paginas/privacidad/Privacidad'

import { ProveedorSesionPanel } from '@/panel/Sesion'
import { ArmazonPanel } from '@/panel/Armazon'
import { EntrarPanel } from '@/panel/entrar/Entrar'
import { InvitacionPanel } from '@/panel/entrar/Invitacion'
import { ClavePanel } from '@/panel/entrar/ClavePanel'
import { RestablecerPanel } from '@/panel/entrar/RestablecerPanel'
import { VacantesPanel } from '@/panel/vacantes/Vacantes'
import { VacantesArchivadas } from '@/panel/vacantes/VacantesArchivadas'
import { VacantePanelDetalle } from '@/panel/vacantes/Vacante'
import { PruebaTecnica } from '@/panel/vacantes/prueba-tecnica/PruebaTecnica'
import { SesionesPanel } from '@/panel/simulacion/Sesiones'
import { PlantillasDePrueba } from '@/panel/pruebas/PlantillasDePrueba'
import { ComponerPrueba } from '@/panel/pruebas/ComponerPrueba'
import { ConfiguracionPanel } from '@/panel/configuracion/Configuracion'

const datos = crearClienteDeDatos()

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
                  {/*
                    Canjear la invitacion. Suelta y NO dentro de ArmazonPanel:
                    ese armazon manda a `/admin/entrar` a quien no tiene sesion,
                    y quien viene de una invitacion es justo eso.

                    Tampoco entra en el armazon del portal, a diferencia de las
                    tres puertas de abajo: a esta no se llega desde el portal
                    sino desde un enlace del correo, y quien la abre no viene de
                    ninguna cabecera de la que echar en falta la vuelta.
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
                    <Route
                      path={patrones.adminVacantesArchivadas}
                      element={<VacantesArchivadas />}
                    />
                    <Route path={patrones.adminVacante} element={<VacantePanelDetalle />} />
                    <Route path={patrones.adminPruebaTecnica} element={<PruebaTecnica />} />
                    <Route path={patrones.adminSesiones} element={<SesionesPanel />} />
                    <Route path={patrones.adminPruebas} element={<PlantillasDePrueba />} />
                    <Route path={patrones.adminComponerPrueba} element={<ComponerPrueba />} />
                    <Route path={patrones.adminConfiguracion} element={<ConfiguracionPanel />} />
                  </Route>

                  <Route element={<Armazon />}>
                    {/*
                      Las tres puertas del panel, DENTRO del armazon del portal.

                      Vivian sueltas, sin ninguna cabecera, y por eso al pasar
                      del pie del portal —«Entrar al panel de empresas»— a
                      `/admin/entrar` la barra de arriba desaparecia de golpe.
                      Se trajeron aqui el 24/09/2026 por peticion.

                      ⚠️ **La cabecera que se ve es la del candidato**, con
                      «Iniciar sesion» llevando a `/ingresar`. Es a sabiendas: la
                      pantalla pasa a tener dos entradas distintas, la del equipo
                      en su tarjeta y la del candidato en la barra. Si algun dia
                      molesta, la alternativa era una barra propia con la marca y
                      «Volver al portal».

                      ⚠️ **Siguen fuera de `ArmazonPanel`**, que es lo que
                      importa para el candado: ese armazon manda a
                      `/admin/entrar` a quien no tiene sesion de equipo, y quien
                      llega a estas tres es justo eso. Meterlas alli seria un
                      bucle.

                      Cada una conserva su `ProveedorSesionPanel`: la sesion del
                      equipo es otra que la del candidato, y el armazon del
                      portal solo aporta la barra y el pie.
                    */}
                    <Route
                      path={patrones.adminEntrar}
                      element={
                        <ProveedorSesionPanel>
                          <EntrarPanel />
                        </ProveedorSesionPanel>
                      }
                    />
                    {/*
                      La contraseña olvidada del panel: pedir el enlace y elegir
                      la nueva. Sin ruta suelta para `/restablecer`: esa es la del
                      candidato, y el backend arma el enlace del equipo siempre
                      con `/admin`.
                    */}
                    <Route
                      path={patrones.adminClave}
                      element={
                        <ProveedorSesionPanel>
                          <ClavePanel />
                        </ProveedorSesionPanel>
                      }
                    />
                    <Route
                      path={patrones.adminRestablecer}
                      element={
                        <ProveedorSesionPanel>
                          <RestablecerPanel />
                        </ProveedorSesionPanel>
                      }
                    />

                    {/* Publico */}
                    <Route path={patrones.inicio} element={<Vacantes />} />
                    <Route path={patrones.vacantes} element={<BuscarVacantes />} />
                    <Route path={patrones.vacante} element={<Vacante />} />
                    <Route path={patrones.ingresar} element={<Ingresar />} />
                    {/* La entrada por el enlace del correo: sin contrasena. */}
                    <Route path={patrones.acceso} element={<Acceso />} />
                    <Route path={patrones.registro} element={<Registro />} />
                    <Route path={patrones.clave} element={<Clave />} />
                    {/* El enlace del correo de «me olvidé mi contraseña». */}
                    <Route path={patrones.restablecer} element={<Restablecer />} />
                    {/* La politica, sin sesion: Play exige poder leerla sin cuenta. */}
                    <Route path={patrones.politica} element={<PoliticaPublica />} />

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
                      path={patrones.cuestionarioTecnico}
                      element={
                        <Privada>
                          <CuestionarioTecnico />
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
                    <Route path="*" element={<Navigate to={patrones.inicio} replace />} />
                  </Route>
                </Routes>
              </BrowserRouter>
            </ProveedorAvisos>
          </ProveedorSesion>
      </QueryClientProvider>
    </Salvavidas>
  )
}
