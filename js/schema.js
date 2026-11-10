// Qué datos tiene cada sección. De acá salen los formularios, el Sheet y los respaldos.
// t = tipo: text, long, date, time, datetime, number, select, city, bool, files, json, phone, url

export const PERSONAS_DEF = ['Valentino', 'Vicky'];

export const SCHEMA = {
  config: {
    label: 'Ajustes',
    fields: [
      { k: 'personas', t: 'json' }, { k: 'monedas', t: 'json' }, { k: 'categoriasGasto', t: 'json' },
      { k: 'tc', t: 'json' }, { k: 'fondoFoto', t: 'text' },
    ],
  },
  ciudades: {
    label: 'Ciudades', one: 'ciudad',
    fields: [
      { k: 'nombre', l: 'Ciudad', t: 'text', req: 1 },
      { k: 'pais', l: 'País', t: 'text' },
      { k: 'llegada', l: 'Llegada (día)', t: 'date', req: 1 },
      { k: 'salida', l: 'Salida (día)', t: 'date', req: 1 },
      { k: 'moneda', l: 'Moneda local', t: 'text', ph: 'EUR, GBP, CZK…' },
      { k: 'barrio', l: 'Barrio recomendado', t: 'text' },
      { k: 'lat', l: 'Latitud (para el clima)', t: 'number', adv: 1 },
      { k: 'lon', l: 'Longitud (para el clima)', t: 'number', adv: 1 },
      { k: 'nota', l: 'Notas', t: 'long' },
      { k: 'orden', t: 'number', hide: 1 },
    ],
  },
  actividades: {
    label: 'Actividades', one: 'actividad',
    fields: [
      { k: 'titulo', l: 'Qué hacer', t: 'text', req: 1 },
      { k: 'ciudadId', l: 'Ciudad', t: 'city', req: 1 },
      { k: 'fecha', l: 'Día (vacío = sin día asignado)', t: 'date' },
      { k: 'hora', l: 'Hora', t: 'time' },
      { k: 'categoria', l: 'Tipo', t: 'select', opts: ['', 'Visita', 'Museo', 'Comida', 'Paseo', 'Compras', 'Fiesta', 'Otro'] },
      { k: 'link', l: 'Link (mapa, web)', t: 'url' },
      { k: 'nota', l: 'Notas', t: 'long' },
      { k: 'hecha', l: 'Ya lo hicimos', t: 'bool' },
      { k: 'orden', t: 'number', hide: 1 },
    ],
  },
  transportes: {
    label: 'Transportes', one: 'transporte',
    fields: [
      { k: 'tipo', l: 'Tipo', t: 'select', opts: ['Vuelo', 'Tren', 'Bus', 'Auto', 'Traslado', 'Otro'], req: 1 },
      { k: 'origen', l: 'Origen (estación / aeropuerto)', t: 'text', req: 1 },
      { k: 'destino', l: 'Destino', t: 'text', req: 1 },
      { k: 'salida', l: 'Sale', t: 'datetime', req: 1 },
      { k: 'llegada', l: 'Llega', t: 'datetime' },
      { k: 'compania', l: 'Compañía', t: 'text' },
      { k: 'numero', l: 'Número de vuelo / tren', t: 'text' },
      { k: 'reserva', l: 'Código de reserva', t: 'text' },
      { k: 'asientos', l: 'Asientos / coche', t: 'text' },
      { k: 'estado', l: 'Estado', t: 'select', opts: ['Reservado', 'Falta sacar'], req: 1 },
      { k: 'checkinUrl', l: 'Link del check-in online', t: 'url', solo: 'Vuelo' },
      { k: 'checkinHoras', l: 'El check-in abre (horas antes de salir)', t: 'number', solo: 'Vuelo', ph: '24 o 48' },
      { k: 'checkinDatos', l: 'Datos para el check-in (código y apellidos)', t: 'long', solo: 'Vuelo' },
      { k: 'checkinHecho', l: 'Check-in ya hecho', t: 'bool', solo: 'Vuelo' },
      { k: 'precioUsd', l: 'Costo total (USD)', t: 'number', adv: 1 },
      { k: 'nota', l: 'Notas', t: 'long' },
      { k: 'archivos', l: 'Tickets y archivos', t: 'files' },
    ],
  },
  alojamientos: {
    label: 'Alojamientos', one: 'alojamiento',
    fields: [
      { k: 'nombre', l: 'Nombre', t: 'text', req: 1 },
      { k: 'ciudadId', l: 'Ciudad', t: 'city', req: 1 },
      { k: 'direccion', l: 'Dirección', t: 'text', req: 1 },
      { k: 'checkIn', l: 'Check-in', t: 'datetime', req: 1 },
      { k: 'checkOut', l: 'Check-out', t: 'datetime', req: 1 },
      { k: 'confirmacion', l: 'Código de confirmación', t: 'text' },
      { k: 'anfitrion', l: 'Anfitrión / contacto', t: 'text' },
      { k: 'telefono', l: 'Teléfono', t: 'phone' },
      { k: 'codigoAcceso', l: 'Código de acceso (puerta, caja de llaves)', t: 'text' },
      { k: 'precioUsd', l: 'Precio total (USD)', t: 'number', adv: 1 },
      { k: 'nota', l: 'Notas', t: 'long' },
      { k: 'archivos', l: 'Reserva y archivos', t: 'files' },
    ],
  },
  entradas: {
    label: 'Entradas y reservas', one: 'entrada',
    fields: [
      { k: 'lugar', l: 'Lugar / actividad', t: 'text', req: 1 },
      { k: 'ciudadId', l: 'Ciudad', t: 'city', req: 1 },
      { k: 'estado', l: 'Estado', t: 'select', opts: ['Comprada', 'Falta sacar', 'Gratis, hay que reservar'], req: 1 },
      { k: 'prioridad', l: '¿Se agota rápido?', t: 'select', opts: [{ v: 1, l: 'Sí, sacar ya' }, { v: 2, l: 'Normal' }, { v: 3, l: 'Sin apuro' }] },
      { k: 'fecha', l: 'Fecha', t: 'date' },
      { k: 'hora', l: 'Hora', t: 'time' },
      { k: 'precioUsd', l: 'Costo total (USD)', t: 'number', adv: 1 },
      { k: 'link', l: 'Link para comprar', t: 'url' },
      { k: 'nota', l: 'Notas', t: 'long' },
      { k: 'hecha', l: 'Ya la usamos', t: 'bool' },
      { k: 'archivos', l: 'Entradas y QR', t: 'files' },
    ],
  },
  gastos: {
    label: 'Gastos', one: 'gasto',
    fields: [
      { k: 'fecha', t: 'date' }, { k: 'descripcion', t: 'text' }, { k: 'categoria', t: 'text' },
      { k: 'moneda', t: 'text' }, { k: 'monto', t: 'number' }, { k: 'tc', t: 'number' }, { k: 'usd', t: 'number' },
      { k: 'pagoPor', t: 'text' }, { k: 'pctPagador', t: 'number' }, { k: 'ciudadId', t: 'text' },
      { k: 'enBalance', t: 'bool' }, { k: 'origen', t: 'text' }, { k: 'nota', t: 'text' },
    ],
  },
  checklist: {
    label: 'Valijas y pendientes', one: 'ítem',
    fields: [
      { k: 'texto', l: 'Qué hay que hacer / llevar', t: 'text', req: 1 },
      { k: 'grupo', l: 'Lista', t: 'select', opts: ['Pendientes', 'Valijas'], req: 1 },
      { k: 'hecho', l: 'Listo', t: 'bool' },
      { k: 'nota', l: 'Notas', t: 'long' },
      { k: 'orden', t: 'number', hide: 1 },
    ],
  },
  info: {
    label: 'Info útil', one: 'dato',
    fields: [
      { k: 'grupo', l: 'Grupo', t: 'select', opts: ['Emergencias', 'Enchufes y plata', 'Propinas', 'Apps', 'Frases', 'Tips de enero', 'Otro'], req: 1 },
      { k: 'titulo', l: 'Título', t: 'text', req: 1 },
      { k: 'texto', l: 'Detalle', t: 'long' },
      { k: 'ciudadId', l: 'Ciudad (si es de una sola)', t: 'city', opt: 1 },
      { k: 'orden', t: 'number', hide: 1 },
    ],
  },
  fotos: {
    label: 'Fotos', one: 'foto',
    fields: [
      { k: 'ciudadId', l: 'Ciudad', t: 'city' },
      { k: 'fecha', l: 'Día', t: 'date' },
      { k: 'nota', l: 'Descripción', t: 'text' },
      { k: 'portada', l: 'Portada de la ciudad', t: 'bool' },
      { k: 'archivos', l: 'Foto', t: 'files' },
    ],
  },
};

export const COLS = Object.keys(SCHEMA);
export const SYNC_COLS = COLS;
export const fieldsOf = (col) => SCHEMA[col].fields;

export const MONEDAS_DEF = [
  { cod: 'USD', nombre: 'Dólar', tc: 1 },
  { cod: 'EUR', nombre: 'Euro', tc: 1.15 },
  { cod: 'GBP', nombre: 'Libra esterlina', tc: 1.3 },
  { cod: 'CZK', nombre: 'Corona checa', tc: 0.047 },
  { cod: 'HUF', nombre: 'Florín húngaro', tc: 0.0029 },
];
export const CATEGORIAS_DEF = ['Comida', 'Transporte', 'Alojamiento', 'Entradas', 'Compras', 'Salud', 'Otro'];
