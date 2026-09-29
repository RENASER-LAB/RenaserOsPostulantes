/**
 * Un .xlsx mínimo, escrito a mano, para las cargas por Excel de los E2E (V64).
 *
 * La suite no trae ninguna librería de hojas de cálculo y no merece una
 * dependencia nueva para escribir una hoja de texto: un .xlsx es un zip con
 * cinco XML. Aquí van **sin comprimir** (método 0 del zip), con celdas de texto
 * en línea (`inlineStr`), que es lo que el backend lee con Apache POI.
 *
 * Solo sirve para escribir una hoja con texto. Para cualquier otra cosa, la
 * plantilla de verdad la genera el backend.
 */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabla[n] = c >>> 0
  }
  return tabla
})()

function crc32(datos: Buffer): number {
  let c = 0xffffffff
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(archivos: Array<{ nombre: string; contenido: string }>): Buffer {
  const locales: Buffer[] = []
  const centrales: Buffer[] = []
  let desplazamiento = 0
  for (const { nombre, contenido } of archivos) {
    const nombreB = Buffer.from(nombre, 'utf8')
    const datos = Buffer.from(contenido, 'utf8')
    const crc = crc32(datos)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // nombres en UTF-8
    local.writeUInt16LE(0, 8) // sin comprimir
    local.writeUInt32LE(0, 10)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(datos.length, 18)
    local.writeUInt32LE(datos.length, 22)
    local.writeUInt16LE(nombreB.length, 26)
    local.writeUInt16LE(0, 28)
    locales.push(local, nombreB, datos)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt32LE(0, 12)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(datos.length, 20)
    central.writeUInt32LE(datos.length, 24)
    central.writeUInt16LE(nombreB.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(desplazamiento, 42)
    centrales.push(central, nombreB)

    desplazamiento += local.length + nombreB.length + datos.length
  }
  const directorio = Buffer.concat(centrales)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(0, 4)
  fin.writeUInt16LE(0, 6)
  fin.writeUInt16LE(archivos.length, 8)
  fin.writeUInt16LE(archivos.length, 10)
  fin.writeUInt32LE(directorio.length, 12)
  fin.writeUInt32LE(desplazamiento, 16)
  fin.writeUInt16LE(0, 20)
  return Buffer.concat([...locales, directorio, fin])
}

const escapar = (texto: string) =>
  texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

function columna(indice: number): string {
  let letras = ''
  let n = indice + 1
  while (n > 0) {
    const resto = (n - 1) % 26
    letras = String.fromCharCode(65 + resto) + letras
    n = Math.floor((n - 1) / 26)
  }
  return letras
}

/** Un libro con una sola hoja de texto: la primera fila son los encabezados. */
export function libroDeUnaHoja(hoja: string, filas: string[][]): Buffer {
  const xmlFilas = filas
    .map((celdas, f) => {
      const xmlCeldas = celdas
        .map((valor, c) =>
          valor === ''
            ? ''
            : `<c r="${columna(c)}${f + 1}" t="inlineStr"><is><t xml:space="preserve">${escapar(valor)}</t></is></c>`,
        )
        .join('')
      return `<row r="${f + 1}">${xmlCeldas}</row>`
    })
    .join('')
  const ns = 'http://schemas.openxmlformats.org'
  return zip([
    {
      nombre: '[Content_Types].xml',
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `</Types>`,
    },
    {
      nombre: '_rels/.rels',
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    },
    {
      nombre: 'xl/workbook.xml',
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" ` +
        `xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>` +
        `<sheet name="${escapar(hoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nombre: 'xl/_rels/workbook.xml.rels',
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
        `</Relationships>`,
    },
    {
      nombre: 'xl/worksheets/sheet1.xml',
      contenido:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}/spreadsheetml/2006/main">` +
        `<sheetData>${xmlFilas}</sheetData></worksheet>`,
    },
  ])
}
