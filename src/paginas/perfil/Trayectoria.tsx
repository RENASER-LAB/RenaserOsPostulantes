/**
 * Tu trayectoria: una sola cronología.
 *
 * THESIS · Empleos, estudios y certificaciones dejan de ser tres listas y pasan
 * a colgar de un raíl único ordenado por fecha. Rechaza el acordeón de secciones
 * iguales que usa cualquier portal de empleo: una vida laboral no son tres
 * cajones, es una línea con huecos.
 *
 * OWN-WORLD · El mundo de EX sin tocar —Mulish, tema claro, tokens del canto—.
 * Lo que esta superficie añade es el raíl: una línea de 2px con un nodo por
 * hecho, el icono de su especie dentro, y la palabra de la especie al lado
 * porque un icono solo es un jeroglífico.
 *
 * STORY · Quien entra ve su vida en orden sin haberla ordenado, entiende de un
 * vistazo dónde hay huecos, y sabe qué le toca revisar porque esas entradas son
 * las únicas con caja.
 *
 * FIRST VIEWPORT · Identidad a sangre, «Acerca de ti» debajo, y el raíl
 * empezando por lo más reciente. La acción principal —«Está bien»— vive dentro
 * de la entrada que la pide, no en una barra.
 *
 * FORM · La columna de tiempo, la 7.ª de mi lista ordenada; elegida por el
 * usuario el 06/09/2026 sobre el reparto del dado (clave c5d8200b).
 *
 * FINISH · unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, DESIGN.md, and every shipping raster carrying its
 * provenance.
 *
 * ⚠️ **Ordena por fecha, y por eso ya no hay flechas.** Existían porque la
 * lectura del currículum añadía sus filas al final y alguien tenía que
 * arreglarlo a mano, de una en una y con un viaje al servidor por paso. Con la
 * cronología ese trabajo desaparece en vez de facilitarse. El `orden` del
 * backend se queda como está: no estorba y otra pantalla podría usarlo.
 */

import { useMemo } from "react";
import type {
  CertificacionPerfil,
  EducacionPerfil,
  ExperienciaPerfil,
  OpcionCatalogo,
} from "@/api/tipos";
import { IconoBirrete, IconoMaletin, IconoSello } from "@/ui/Iconos";
import {
  ElDiploma,
  estaVencida,
  Fila,
  Hueco,
  Marca,
  nombreDelNivelEducativo,
  periodo,
  Seccion,
  useCertificados,
  useEmpleos,
  useEstudios,
} from "./Listas";
import { duracion, huecoEntre } from "./textos";
import estilos from "./Perfil.module.css";

type Entrada =
  | { especie: "empleo"; fila: ExperienciaPerfil }
  | { especie: "estudio"; fila: EducacionPerfil }
  | { especie: "certificado"; fila: CertificacionPerfil };

/** Cuándo empieza cada especie. */
function desdeDe(e: Entrada): string | null {
  if (e.especie === "certificado") return e.fila.emitidaEn;
  return e.fila.desde;
}

/**
 * Hasta cuándo llega, para ordenar.
 *
 * ⚠️ **Lo que sigue vivo va arriba.** Ordenando solo por la fecha de inicio, un
 * certificado de 2024 quedaba por encima de un empleo empezado en 2022 que la
 * persona **todavía tiene**, y el primer renglón de la línea dejaba de ser lo
 * que está pasando ahora. Un tramo abierto ordena como si terminara hoy.
 */
function hastaDe(e: Entrada): string {
  if (e.especie === "certificado") return e.fila.emitidaEn ?? "";
  if (e.especie === "estudio" && e.fila.enCurso) return "9999";
  const hasta = e.fila.hasta;
  return hasta ?? "9999";
}

const LA_ESPECIE = {
  empleo: { palabra: "Empleo", Icono: IconoMaletin },
  estudio: { palabra: "Estudios", Icono: IconoBirrete },
  certificado: { palabra: "Certificación", Icono: IconoSello },
} as const;

/**
 * ⚠️ **Sin fecha no hay sitio en la línea, y no se inventa uno.** Un dato leído
 * de un currículum puede llegar sin fecha de inicio; ponerlo «hoy» lo colocaría
 * arriba del todo y afirmaría algo falso. Van al final, bajo su propio rótulo.
 */
function ordenar(entradas: Entrada[]): { conFecha: Entrada[]; sinFecha: Entrada[] } {
  const conFecha = entradas.filter((e) => desdeDe(e) !== null);
  const sinFecha = entradas.filter((e) => desdeDe(e) === null);
  conFecha.sort(
    (a, b) =>
      hastaDe(b).localeCompare(hastaDe(a)) ||
      (desdeDe(b) ?? "").localeCompare(desdeDe(a) ?? ""),
  );
  return { conFecha, sinFecha };
}

export function Trayectoria({
  experiencia,
  educacion,
  certificaciones,
  niveles,
}: {
  experiencia: ExperienciaPerfil[];
  educacion: EducacionPerfil[];
  certificaciones: CertificacionPerfil[];
  niveles: OpcionCatalogo[];
}) {
  const empleos = useEmpleos();
  const estudios = useEstudios({ niveles });
  const certificados = useCertificados();

  const { conFecha, sinFecha } = useMemo(
    () =>
      ordenar([
        ...experiencia.map((fila) => ({ especie: "empleo", fila }) as Entrada),
        ...educacion.map((fila) => ({ especie: "estudio", fila }) as Entrada),
        ...certificaciones.map((fila) => ({ especie: "certificado", fila }) as Entrada),
      ]),
    [experiencia, educacion, certificaciones],
  );

  const todas = [...conFecha, ...sinFecha];
  const sinConfirmar = todas.filter(
    (e) => e.fila.origen === "CURRICULUM" && !e.fila.confirmado,
  ).length;

  /*
    El hueco se mide entre EMPLEOS, saltándose lo que haya en medio: un curso
    entre dos trabajos no llena un vacío laboral, y decir lo contrario sería
    exactamente el tipo de dato inventado que esta pantalla existe para evitar.
  */
  const huecoAntesDe = (i: number): number | null => {
    const actual = conFecha[i];
    if (!actual || actual.especie !== "empleo") return null;
    const anterior = conFecha
      .slice(i + 1)
      .find((e): e is Extract<Entrada, { especie: "empleo" }> => e.especie === "empleo");
    if (!anterior) return null;
    const meses = huecoEntre(anterior.fila.hasta, actual.fila.desde);
    if (meses === null) return null;

    /*
      ⚠️ **Y solo si de verdad no había nada.** Si en esos meses la persona
      estaba estudiando o sacándose un certificado, el hueco NO está vacío:
      decirle «sin empleo registrado» a quien estuvo esos meses en la
      universidad es afirmar algo falso sobre su vida, en la pantalla que le
      pide que valide lo que dedujo una máquina. Se calla y ya está.
    */
    const desde = anterior.fila.hasta;
    const hasta = actual.fila.desde;
    const ocupado = conFecha.some((e) => {
      if (e === actual || e === anterior || e.especie === "empleo") return null;
      const eDesde = desdeDe(e);
      if (!eDesde || !desde || !hasta) return false;
      const eHasta = e.especie === "estudio" ? (e.fila.hasta ?? hasta) : eDesde;
      return eDesde <= hasta && eHasta >= desde;
    });
    return ocupado ? null : meses;
  };

  const abierto = empleos.editando ?? estudios.editando ?? certificados.editando;
  const ocupado = empleos.ocupado || estudios.ocupado || certificados.ocupado;
  const fallo = empleos.fallo ?? estudios.fallo ?? certificados.fallo;

  return (
    <Seccion
      titulo="Tu trayectoria"
      explicacion="Tus empleos, tus estudios y tus certificaciones en una sola línea, de lo más reciente a lo más antiguo. El orden lo pone la fecha."
      cuantosSinConfirmar={sinConfirmar}
      vacia="Todavía no hay nada aquí. Empieza por donde quieras."
      hayAlgo={todas.length > 0}
      fallo={fallo}
    >
      {todas.length > 0 && (
        <ul className={`${estilos.filas} ${estilos.trayectoria}`} role="list">
          {conFecha.map((e, i) => (
            <EnLaLinea
              key={`${e.especie}-${e.fila.id}`}
              entrada={e}
              niveles={niveles}
              ocupado={ocupado}
              empleos={empleos}
              estudios={estudios}
              certificados={certificados}
              hueco={huecoAntesDe(i)}
            />
          ))}
          {sinFecha.length > 0 && (
            <li className={estilos.sinFecha}>Sin fecha, así que no entran en la línea</li>
          )}
          {sinFecha.map((e) => (
            <EnLaLinea
              key={`${e.especie}-${e.fila.id}`}
              entrada={e}
              niveles={niveles}
              ocupado={ocupado}
              empleos={empleos}
              estudios={estudios}
              certificados={certificados}
              hueco={null}
            />
          ))}
        </ul>
      )}

      {/*
        Un formulario a la vez: los tres ganchos comparten la línea, así que
        abrir uno tiene que cerrar los otros dos o saldrían dos formularios.
      */}
      {abierto !== null && abierto !== undefined ? (
        <>
          {empleos.editando !== null && empleos.formulario}
          {estudios.editando !== null && estudios.formulario}
          {certificados.editando !== null && certificados.formulario}
        </>
      ) : (
        <div className={estilos.anadirTres}>
          <button className={estilos.anadir} type="button" onClick={empleos.abrirNueva}>
            Añadir un empleo
          </button>
          <button className={estilos.anadir} type="button" onClick={estudios.abrirNueva}>
            Añadir estudios
          </button>
          <button className={estilos.anadir} type="button" onClick={certificados.abrirNueva}>
            Añadir una certificación
          </button>
        </div>
      )}
    </Seccion>
  );
}

function EnLaLinea({
  entrada,
  niveles,
  ocupado,
  empleos,
  estudios,
  certificados,
  hueco,
}: {
  entrada: Entrada;
  niveles: OpcionCatalogo[];
  ocupado: boolean;
  empleos: ReturnType<typeof useEmpleos>;
  estudios: ReturnType<typeof useEstudios>;
  certificados: ReturnType<typeof useCertificados>;
  hueco: number | null;
}) {
  const { palabra, Icono } = LA_ESPECIE[entrada.especie];

  const comun = {
    dato: entrada.fila,
    ocupado,
    especie: (
      <span className={estilos.especie}>
        <Icono tamano={14} />
        {palabra}
      </span>
    ),
  };

  if (entrada.especie === "empleo") {
    const f = entrada.fila;
    return (
      <>
        <Fila
          {...comun}
          queEs={`${f.puesto} en ${f.empresa}`}
          onConfirmar={() => empleos.confirmar(f.id)}
          onEditar={() => empleos.abrir(f)}
          onQuitar={() => empleos.quitar(f)}
        >
          <div className={estilos.conCuando}>
            <div className={estilos.queYDonde}>
              <span className={estilos.queEs}>{f.puesto}</span>
              <span className={estilos.donde}>{f.empresa}</span>
              <Marca dato={f} />
            </div>
            <p className={estilos.cuando}>
              {periodo(f.desde, f.hasta)}
              {duracion(f.desde, f.hasta) && (
                <span className={estilos.duracion}> · {duracion(f.desde, f.hasta)}</span>
              )}
            </p>
          </div>
          {f.descripcion && <p className={estilos.detalleFila}>{f.descripcion}</p>}
        </Fila>
        <Hueco meses={hueco} />
      </>
    );
  }

  if (entrada.especie === "estudio") {
    const f = entrada.fila;
    const nivel = nombreDelNivelEducativo(niveles, f.nivelCodigo);
    return (
      <Fila
        {...comun}
        queEs={`${f.titulo} en ${f.institucion}`}
        onConfirmar={() => estudios.confirmar(f.id)}
        onEditar={() => estudios.abrir(f)}
        onQuitar={() => estudios.quitar(f)}
      >
        <div className={estilos.conCuando}>
          <div className={estilos.queYDonde}>
            <span className={estilos.queEs}>{f.titulo}</span>
            <span className={estilos.donde}>{f.institucion}</span>
            {nivel && <span className={`${estilos.marca} ${estilos.atributo}`}>{nivel}</span>}
            <Marca dato={f} />
          </div>
          <p className={estilos.cuando}>{periodo(f.desde, f.hasta, f.enCurso)}</p>
        </div>
      </Fila>
    );
  }

  const f = entrada.fila;
  return (
    <Fila
      {...comun}
      queEs={f.nombre}
      onConfirmar={() => certificados.confirmar(f.id)}
      onEditar={() => certificados.abrir(f)}
      onQuitar={() => certificados.quitar(f)}
    >
      <div className={estilos.conCuando}>
        <div className={estilos.queYDonde}>
          <span className={estilos.queEs}>{f.nombre}</span>
          {f.entidad && <span className={estilos.donde}>{f.entidad}</span>}
          {estaVencida(f.venceEn) && (
            <span className={`${estilos.marca} ${estilos.vencida}`}>Vencida</span>
          )}
          <Marca dato={f} />
        </div>
        <p className={estilos.cuando}>
          {[
            f.emitidaEn ? `Emitida` : null,
            f.venceEn ? `vence ${f.venceEn.slice(0, 4)}` : "no caduca",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <ElDiploma certificacion={f} ocupado={ocupado} refrescar={certificados.refrescar} />
    </Fila>
  );
}
