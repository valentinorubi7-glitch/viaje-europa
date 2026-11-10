// Ideas de qué hacer en cada ciudad, además de lo que ya tienen anotado. Son sugerencias generales
// (no salen de tu Sheet): conviene mirar horarios y feriados antes de ir. Se suman al plan con un toque.

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const IDEAS = {
  paris: [
    ['Sainte-Chapelle', 'Visita', 'Vitrales góticos espectaculares, a pocos pasos de Notre-Dame.'],
    ["Musée d'Orsay", 'Museo', 'Impresionistas en una vieja estación de tren.'],
    ['Arco del Triunfo (subir a la terraza)', 'Visita', 'Vista a los Campos Elíseos y la Torre Eiffel.'],
    ['Catedral de Notre-Dame', 'Visita', 'Ya reabierta: se ve por fuera y por dentro.'],
    ['Barrio Latino y Shakespeare and Company', 'Paseo', 'Callejuelas, cafés y la librería más famosa de París.'],
    ['Jardín de Luxemburgo', 'Paseo', 'Plácido incluso en invierno.'],
    ['Galeries Lafayette (cúpula)', 'Compras', 'Compras y una cúpula de vidrio que vale la pena ver.'],
    ['Canal Saint-Martin', 'Paseo', 'Zona de cafés y gente local.'],
  ],
  londres: [
    ['Borough Market', 'Comida', 'Mercado de comida para almorzar parados.'],
    ['Westminster Abbey y Big Ben', 'Visita', 'Clásicos de Westminster, a pie desde el río.'],
    ['London Eye', 'Visita', 'Vista de la ciudad; mejor al atardecer.'],
    ['Covent Garden', 'Paseo', 'Calles con shows y tiendas.'],
    ['Tate Modern', 'Museo', 'Arte moderno, entrada gratis (South Bank).'],
    ['Notting Hill y Portobello Road', 'Paseo', 'Casas de colores; el mercado grande es los sábados.'],
    ['Camden Market', 'Compras', 'Puestos de comida, ropa y música.'],
    ['Greenwich y el meridiano', 'Visita', 'Observatorio y vista al río.'],
    ['Harrods y Oxford Street', 'Compras', 'Para el modo shopping.'],
  ],
  amsterdam: [
    ['Museo Van Gogh', 'Museo', 'La mayor colección de Van Gogh; se agota, sacar antes.'],
    ['Mercado de flores (Bloemenmarkt)', 'Paseo', 'Puestos flotantes sobre el canal.'],
    ['Vondelpark', 'Paseo', 'El parque grande de la ciudad.'],
    ['Begijnhof', 'Paseo', 'Patio escondido y tranquilo en pleno centro.'],
    ['Heineken Experience', 'Visita', 'Recorrido por la cervecería con degustación.'],
    ['Paseo en barco por los canales', 'Paseo', 'Nocturno si se puede: la ciudad iluminada.'],
    ['Panqueques holandeses (pannenkoeken)', 'Comida', 'Un clásico para probar.'],
    ['NEMO (terraza panorámica)', 'Visita', 'Terraza con vista, gratis.'],
  ],
  berlin: [
    ['East Side Gallery', 'Visita', 'Tramo del Muro pintado por artistas.'],
    ['Memorial del Holocausto', 'Visita', 'Campo de estelas junto a la Puerta de Brandeburgo.'],
    ['Topografía del Terror', 'Museo', 'Historia del nazismo; gratis, con cuadros al aire libre.'],
    ['Isla de los Museos', 'Museo', 'Varios museos en un solo lugar; elegir uno.'],
    ['Checkpoint Charlie', 'Visita', 'Antiguo paso entre Berlín Este y Oeste.'],
    ['Torre de televisión (Fernsehturm)', 'Visita', 'Vista panorámica desde Alexanderplatz.'],
    ['Catedral de Berlín (Berliner Dom)', 'Visita', 'Se puede subir a la cúpula.'],
    ['Currywurst', 'Comida', 'Salchicha con salsa curry, el plato típico.'],
    ['Kreuzberg: arte callejero', 'Paseo', 'Barrio alternativo, con murales y cafés.'],
  ],
  praga: [
    ['Barrio Judío (Josefov) y sinagogas', 'Visita', 'Historia judía de Praga, muy bien conservada.'],
    ['Monasterio de Strahov (biblioteca)', 'Visita', 'Biblioteca barroca; cerca del Castillo.'],
    ['Colina Petřín y su torre', 'Paseo', 'Vista de la ciudad; se sube en funicular.'],
    ['Casa Danzante', 'Visita', 'Edificio moderno a orillas del Moldava.'],
    ['Muro de Lennon', 'Paseo', 'Grafitis en Malá Strana.'],
    ['Café Slavia', 'Comida', 'Café histórico frente al río.'],
    ['Cerveza checa en una cervecería tradicional', 'Comida', 'La cerveza es parte del viaje (U Fleků, entre otras).'],
    ['Paseo nocturno por la Ciudad Vieja', 'Paseo', 'Calles casi vacías y bien iluminadas.'],
  ],
  viena: [
    ['Ópera Estatal de Viena (visita guiada o función)', 'Visita', 'Edificio emblemático; se agota para funciones.'],
    ['Torta Sacher en el Café Sacher', 'Comida', 'La torta típica de Viena.'],
    ['Catedral de San Esteban', 'Visita', 'Se puede subir a la torre.'],
    ['Naschmarkt', 'Comida', 'Mercado con puestos de comida y especias.'],
    ['Palacio Hofburg y Escuela Española de Equitación', 'Visita', 'Palacio imperial en pleno centro.'],
    ['Prater (noria Riesenrad)', 'Visita', 'La noria histórica de Viena.'],
    ['Albertina', 'Museo', 'Arte, con una buena colección impresionista.'],
    ['Karlskirche', 'Visita', 'Iglesia barroca con cúpula.'],
  ],
  budapest: [
    ['Baños Gellért', 'Visita', 'Termas históricas con estilo art nouveau.'],
    ['Basílica de San Esteban (terraza)', 'Visita', 'Vista de 360° de la ciudad.'],
    ['Gran Sinagoga', 'Visita', 'La más grande de Europa.'],
    ['Mercado Central (Nagy Vásárcsarnok)', 'Comida', 'Para probar lángos y paprika.'],
    ['Zapatos a orillas del Danubio', 'Visita', 'Memorial emotivo junto al río.'],
    ['Colina Gellért y Ciudadela', 'Paseo', 'La mejor vista de la ciudad.'],
    ['Isla Margarita', 'Paseo', 'Parque en medio del Danubio.'],
    ['Café New York', 'Comida', 'Café histórico y muy fotogénico.'],
    ['Casa del Terror', 'Museo', 'Sobre los regímenes nazi y comunista.'],
  ],
  madrid: [
    ['Museo del Prado', 'Museo', 'Goya, Velázquez y más; mejor con entrada comprada antes.'],
    ['Museo Reina Sofía (Guernica)', 'Museo', 'Arte del siglo XX, con el Guernica de Picasso.'],
    ['Parque del Retiro y Palacio de Cristal', 'Paseo', 'El gran parque de la ciudad.'],
    ['Templo de Debod', 'Visita', 'Templo egipcio; ideal para el atardecer.'],
    ['Mercado de San Miguel', 'Comida', 'Tapas en un mercado cubierto.'],
    ['Chocolate con churros (San Ginés)', 'Comida', 'Clásico madrileño.'],
    ['El Rastro (domingos)', 'Compras', 'Mercadillo callejero, solo domingos: el 24 de enero cae domingo.'],
    ['Barrio de Las Letras', 'Paseo', 'Calles literarias, con bares y librerías.'],
    ['Santiago Bernabéu (estadio y tour)', 'Visita', 'Para los que les gusta el fútbol.'],
    ['Excursión a Toledo (día completo)', 'Visita', 'Ciudad medieval a 30 minutos en tren.'],
  ],
};

// Devuelve las ideas de esa ciudad que todavía no están en el plan
export function ideasPara(nombreCiudad, yaCargado = []) {
  const lista = IDEAS[norm(nombreCiudad)] || [];
  const tengo = yaCargado.map(norm);
  return lista
    .filter(([t]) => { const n = norm(t); return !tengo.some((x) => x && (x.includes(n) || n.includes(x))); })
    .map(([titulo, categoria, por]) => ({ titulo, categoria, por }));
}
