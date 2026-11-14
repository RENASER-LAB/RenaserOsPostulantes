/**
 * El panel conserva «El cielo despejado».
 *
 * Desde el 13/11/2026 el portal del candidato lleva el estilo Northstar, y
 * `mundo.css` y `piezas.module.css` son globales: sin esto el panel se habría
 * repintado con él. Lo que hace es poner la clase `mundo-panel` en `<html>`
 * mientras el panel está montado; todo lo Northstar está escrito bajo
 * `html:not(.mundo-panel)`, así que con la clase puesta el panel ve los tokens,
 * las letras y las piezas de antes, sin tocar ninguna de sus hojas.
 *
 * En `<html>` y no en un `<div>` del armazón porque así alcanza también el
 * fondo de la página, el `::backdrop` de los `<dialog>` y lo que se pinte fuera
 * del árbol del armazón. Con `useLayoutEffect` para que no haya un cuadro con
 * el estilo equivocado al entrar.
 */

import { useLayoutEffect } from 'react'

export const CLASE_DEL_PANEL = 'mundo-panel'

export function usarMundoDelPanel() {
  useLayoutEffect(() => {
    const raiz = document.documentElement
    raiz.classList.add(CLASE_DEL_PANEL)
    return () => raiz.classList.remove(CLASE_DEL_PANEL)
  }, [])
}
