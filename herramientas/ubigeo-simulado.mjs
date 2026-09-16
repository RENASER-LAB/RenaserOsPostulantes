/*
 * El catalogo de ubigeo del backend simulado: 25 departamentos y 196 provincias.
 *
 * ⚠️ **No esta escrito a mano, y no debe estarlo.** Sale de
 * `V47__la_ciudad_del_candidato.sql` del backend, que es lo que siembra la base
 * de verdad. Una lista tecleada de memoria tiene errores que nadie mira, y aqui
 * la gracia es justamente que el simulado diga lo mismo que el real: hay una
 * prueba e2e que cuenta las opciones del desplegable y exige mas de cien.
 *
 * Va en su propio archivo porque son doscientas filas y el simulado se lee.
 */

/** Provincia a provincia, agrupadas por su departamento. */
const POR_DEPARTAMENTO = {
  'Amazonas': [['0101', 'Chachapoyas'], ['0102', 'Bagua'], ['0103', 'Bongará'], ['0104', 'Condorcanqui'], ['0105', 'Luya'], ['0106', 'Rodríguez de Mendoza'], ['0107', 'Utcubamba']],
  'Apurímac': [['0301', 'Abancay'], ['0302', 'Andahuaylas'], ['0303', 'Antabamba'], ['0304', 'Aymaraes'], ['0305', 'Cotabambas'], ['0306', 'Chincheros'], ['0307', 'Grau']],
  'Arequipa': [['0401', 'Arequipa'], ['0402', 'Camaná'], ['0403', 'Caravelí'], ['0404', 'Castilla'], ['0405', 'Caylloma'], ['0406', 'Condesuyos'], ['0407', 'Islay'], ['0408', 'La Unión']],
  'Ayacucho': [['0501', 'Huamanga'], ['0502', 'Cangallo'], ['0503', 'Huanca Sancos'], ['0504', 'Huanta'], ['0505', 'La Mar'], ['0506', 'Lucanas'], ['0507', 'Parinacochas'], ['0508', 'Páucar del Sara Sara'], ['0509', 'Sucre'], ['0510', 'Víctor Fajardo'], ['0511', 'Vilcas Huamán']],
  'Cajamarca': [['0601', 'Cajamarca'], ['0602', 'Cajabamba'], ['0603', 'Celendín'], ['0604', 'Chota'], ['0605', 'Contumazá'], ['0606', 'Cutervo'], ['0607', 'Hualgayoc'], ['0608', 'Jaén'], ['0609', 'San Ignacio'], ['0610', 'San Marcos'], ['0611', 'San Miguel'], ['0612', 'San Pablo'], ['0613', 'Santa Cruz']],
  'Callao': [['0701', 'Prov. Const. del Callao']],
  'Cusco': [['0801', 'Cusco'], ['0802', 'Acomayo'], ['0803', 'Anta'], ['0804', 'Calca'], ['0805', 'Canas'], ['0806', 'Canchis'], ['0807', 'Chumbivilcas'], ['0808', 'Espinar'], ['0809', 'La Convención'], ['0810', 'Paruro'], ['0811', 'Paucartambo'], ['0812', 'Quispicanchi'], ['0813', 'Urubamba']],
  'Huancavelica': [['0901', 'Huancavelica'], ['0902', 'Acobamba'], ['0903', 'Angaraes'], ['0904', 'Castrovirreyna'], ['0905', 'Churcampa'], ['0906', 'Huaytará'], ['0907', 'Tayacaja']],
  'Huánuco': [['1001', 'Huánuco'], ['1002', 'Ambo'], ['1003', 'Dos de Mayo'], ['1004', 'Huacaybamba'], ['1005', 'Huamalíes'], ['1006', 'Leoncio Prado'], ['1007', 'Marañón'], ['1008', 'Pachitea'], ['1009', 'Puerto Inca'], ['1010', 'Lauricocha'], ['1011', 'Yarowilca']],
  'Ica': [['1101', 'Ica'], ['1102', 'Chincha'], ['1103', 'Nasca'], ['1104', 'Palpa'], ['1105', 'Pisco']],
  'Junín': [['1201', 'Huancayo'], ['1202', 'Concepción'], ['1203', 'Chanchamayo'], ['1204', 'Jauja'], ['1205', 'Junín'], ['1206', 'Satipo'], ['1207', 'Tarma'], ['1208', 'Yauli'], ['1209', 'Chupaca']],
  'La Libertad': [['1301', 'Trujillo'], ['1302', 'Ascope'], ['1303', 'Bolívar'], ['1304', 'Chepén'], ['1305', 'Julcán'], ['1306', 'Otuzco'], ['1307', 'Pacasmayo'], ['1308', 'Pataz'], ['1309', 'Sánchez Carrión'], ['1310', 'Santiago de Chuco'], ['1311', 'Gran Chimú'], ['1312', 'Virú']],
  'Lambayeque': [['1401', 'Chiclayo'], ['1402', 'Ferreñafe'], ['1403', 'Lambayeque']],
  'Lima': [['1501', 'Lima'], ['1502', 'Barranca'], ['1503', 'Cajatambo'], ['1504', 'Canta'], ['1505', 'Cañete'], ['1506', 'Huaral'], ['1507', 'Huarochirí'], ['1508', 'Huaura'], ['1509', 'Oyón'], ['1510', 'Yauyos']],
  'Loreto': [['1601', 'Maynas'], ['1602', 'Alto Amazonas'], ['1603', 'Loreto'], ['1604', 'Mariscal Ramón Castilla'], ['1605', 'Requena'], ['1606', 'Ucayali'], ['1607', 'Datem del Marañón'], ['1608', 'Putumayo']],
  'Madre de Dios': [['1701', 'Tambopata'], ['1702', 'Manu'], ['1703', 'Tahuamanu']],
  'Moquegua': [['1801', 'Mariscal Nieto'], ['1802', 'General Sánchez Cerro'], ['1803', 'Ilo']],
  'Pasco': [['1901', 'Pasco'], ['1902', 'Daniel Alcides Carrión'], ['1903', 'Oxapampa']],
  'Piura': [['2001', 'Piura'], ['2002', 'Ayabaca'], ['2003', 'Huancabamba'], ['2004', 'Morropón'], ['2005', 'Paita'], ['2006', 'Sullana'], ['2007', 'Talara'], ['2008', 'Sechura']],
  'Puno': [['2101', 'Puno'], ['2102', 'Azángaro'], ['2103', 'Carabaya'], ['2104', 'Chucuito'], ['2105', 'El Collao'], ['2106', 'Huancané'], ['2107', 'Lampa'], ['2108', 'Melgar'], ['2109', 'Moho'], ['2110', 'San Antonio de Putina'], ['2111', 'San Román'], ['2112', 'Sandia'], ['2113', 'Yunguyo']],
  'San Martín': [['2201', 'Moyobamba'], ['2202', 'Bellavista'], ['2203', 'El Dorado'], ['2204', 'Huallaga'], ['2205', 'Lamas'], ['2206', 'Mariscal Cáceres'], ['2207', 'Picota'], ['2208', 'Rioja'], ['2209', 'San Martín'], ['2210', 'Tocache']],
  'Tacna': [['2301', 'Tacna'], ['2302', 'Candarave'], ['2303', 'Jorge Basadre'], ['2304', 'Tarata']],
  'Tumbes': [['2401', 'Tumbes'], ['2402', 'Contralmirante Villar'], ['2403', 'Zarumilla']],
  'Ucayali': [['2501', 'Coronel Portillo'], ['2502', 'Atalaya'], ['2503', 'Padre Abad'], ['2504', 'Purús']],
  'Áncash': [['0201', 'Huaraz'], ['0202', 'Aija'], ['0203', 'Antonio Raymondi'], ['0204', 'Asunción'], ['0205', 'Bolognesi'], ['0206', 'Carhuaz'], ['0207', 'Carlos Fermín Fitzcarrald'], ['0208', 'Casma'], ['0209', 'Corongo'], ['0210', 'Huari'], ['0211', 'Huarmey'], ['0212', 'Huaylas'], ['0213', 'Mariscal Luzuriaga'], ['0214', 'Ocros'], ['0215', 'Pallasca'], ['0216', 'Pomabamba'], ['0217', 'Recuay'], ['0218', 'Santa'], ['0219', 'Sihuas'], ['0220', 'Yungay']],
}

/*
 * ⚠️ **`EXT` viaja con `departamento: null`, y de ahi sale su sitio.** El
 * desplegable agrupa por departamento, y esta es la unica opcion que no
 * pertenece a ninguno: por eso queda suelta al final y no dentro de un grupo.
 */
export const UBIGEO = [
  ...Object.entries(POR_DEPARTAMENTO).flatMap(([departamento, provincias]) =>
    provincias.map(([codigo, nombre]) => ({ codigo, nombre, departamento })),
  ),
  { codigo: 'EXT', nombre: 'Fuera del Perú', departamento: null },
]
