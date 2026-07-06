/**
 * Convierte el nombre de una ciudad (ej. "Santo Tomé") en su formato slug para URL (ej. "santo-tomé").
 * Conserva caracteres como tildes pero pasa a minúsculas y reemplaza espacios por guiones.
 */
export function getCitySlug(cityName) {
  if (!cityName) return 'santo-tomé'; // Santo Tomé es la ciudad histórica original
  return cityName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

/**
 * Normaliza una cadena para comparaciones insensibles a tildes, mayúsculas, espacios y caracteres especiales.
 */
export function cleanString(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remueve tildes
    .replace(/[^a-z0-9]/g, ''); // Deja solo letras y números
}

/**
 * Compara dos nombres de ciudades de forma flexible.
 */
export function citiesMatch(cityA, cityB) {
  return cleanString(cityA) === cleanString(cityB);
}
