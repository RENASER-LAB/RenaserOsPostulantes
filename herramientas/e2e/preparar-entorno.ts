import type { FullConfig } from '@playwright/test'
import { baseDeDatos } from './base-de-datos'

export default function prepararEntorno(config: FullConfig) {
  if (config.workers !== 1 || config.fullyParallel) throw new Error('E2E requiere un worker y ejecución secuencial por clon.')
  const db = baseDeDatos()
  process.env.E2E_CONTAINER_ID = db.id
  return db.reservar()
}
