-- ==============================================================================
-- WEPI - Fixture Completo y Programado Mundial 2026 (Horarios de Argentina)
-- Ejecutá este script en el SQL Editor de tu Dashboard de Supabase.
-- Limpiará los partidos existentes y precargará el fixture oficial con fase de grupos,
-- partidos clave (incluyendo toda la fase de grupos de Argentina) y llaves eliminatorias.
-- ==============================================================================

-- 1. Limpieza de datos previos (con cascada automática a pronósticos)
DELETE FROM public.mundial_partidos;

-- 2. Inserción de partidos oficiales (Fase de Grupos)
-- Los horarios están definidos en base a la hora de Argentina (GMT-3)
INSERT INTO public.mundial_partidos (equipo_a, equipo_b, bandera_a, bandera_b, fecha_partido, estado, fase) VALUES
-- Jueves 11 de Junio (Partido Inaugural)
('México', 'Sudáfrica', '🇲🇽', '🇿🇦', '2026-06-11 16:00:00-03', 'pendiente', 'Fase de Grupos'),
('Corea del Sur', 'República Checa', '🇰🇷', '🇨🇿', '2026-06-11 23:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Viernes 12 de Junio
('Canadá', 'Bosnia y Herzegovina', '🇨🇦', '🇧🇦', '2026-06-12 16:00:00-03', 'pendiente', 'Fase de Grupos'),
('Estados Unidos', 'Paraguay', '🇺🇸', '🇵🇾', '2026-06-12 22:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Sábado 13 de Junio
('Catar', 'Suiza', '🇶🇦', '🇨🇭', '2026-06-13 16:00:00-03', 'pendiente', 'Fase de Grupos'),
('Brasil', 'Marruecos', '🇧🇷', '🇲🇦', '2026-06-13 19:00:00-03', 'pendiente', 'Fase de Grupos'),
('Haití', 'Escocia', '🇭🇹', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '2026-06-13 22:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Lunes 15 de Junio
('España', 'Cabo Verde', '🇪🇸', '🇨🇻', '2026-06-15 17:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Martes 16 de Junio (DEBUT DE ARGENTINA 🇦🇷)
('Argentina', 'Argelia', '🇦🇷', '🇩🇿', '2026-06-16 16:00:00-03', 'pendiente', 'Fase de Grupos'),
('Francia', 'Senegal', '🇫🇷', '🇸🇳', '2026-06-16 20:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Miércoles 17 de Junio
('Inglaterra', 'Croacia', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇭🇷', '2026-06-17 19:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Viernes 19 de Junio
('Brasil', 'Haití', '🇧🇷', '🇭🇹', '2026-06-19 19:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Domingo 21 de Junio
('España', 'Arabia Saudita', '🇪🇸', '🇸🇦', '2026-06-21 17:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Lunes 22 de Junio (ARGENTINA FECHA 2 🇦🇷)
('Argentina', 'Austria', '🇦🇷', '🇦🇹', '2026-06-22 15:00:00-03', 'pendiente', 'Fase de Grupos'),
('Francia', 'Irak', '🇫🇷', '🇮🇶', '2026-06-22 20:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Miércoles 23 de Junio
('Inglaterra', 'Ghana', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇬🇭', '2026-06-23 19:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Jueves 24 de Junio
('Brasil', 'Escocia', '🇧🇷', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '2026-06-24 19:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Viernes 26 de Junio
('Francia', 'Noruega', '🇫🇷', '🇳🇴', '2026-06-26 20:00:00-03', 'pendiente', 'Fase de Grupos'),

-- Sábado 27 de Junio (ARGENTINA FECHA 3 🇦🇷)
('Jordania', 'Argentina', '🇯🇴', '🇦🇷', '2026-06-27 15:00:00-03', 'pendiente', 'Fase de Grupos'),
('Inglaterra', 'Panamá', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🇵🇦', '2026-06-27 19:00:00-03', 'pendiente', 'Fase de Grupos');


-- 3. Inserción de partidos de Octavos de Final (Llave Eliminatoria en Blanco)
INSERT INTO public.mundial_partidos (equipo_a, equipo_b, bandera_a, bandera_b, fecha_partido, estado, fase) VALUES
('Clasificado 1A', 'Clasificado 2B', '🏳️', '🏳️', '2026-07-04 16:00:00-03', 'pendiente', 'Octavos de Final'),
('Clasificado 1C', 'Clasificado 2D', '🏳️', '🏳️', '2026-07-04 20:00:00-03', 'pendiente', 'Octavos de Final'),
('Clasificado 1E', 'Clasificado 2F', '🏳️', '🏳️', '2026-07-05 16:00:00-03', 'pendiente', 'Octavos de Final'),
('Clasificado 1G', 'Clasificado 2H', '🏳️', '🏳️', '2026-07-05 20:00:00-03', 'pendiente', 'Octavos de Final'),
('Clasificado 1I', 'Clasificado 2J', '🏳️', '🏳️', '2026-07-06 16:00:00-03', 'pendiente', 'Octavos de Final'),
('Clasificado 1K', 'Clasificado 2L', '🏳️', '🏳️', '2026-07-06 20:00:00-03', 'pendiente', 'Octavos de Final');


-- 4. Inserción de partidos de Cuartos de Final (Llave Eliminatoria en Blanco)
INSERT INTO public.mundial_partidos (equipo_a, equipo_b, bandera_a, bandera_b, fecha_partido, estado, fase) VALUES
('Ganador Octavos 1', 'Ganador Octavos 2', '🏳️', '🏳️', '2026-07-10 16:00:00-03', 'pendiente', 'Cuartos de Final'),
('Ganador Octavos 3', 'Ganador Octavos 4', '🏳️', '🏳️', '2026-07-10 20:00:00-03', 'pendiente', 'Cuartos de Final'),
('Ganador Octavos 5', 'Ganador Octavos 6', '🏳️', '🏳️', '2026-07-11 16:00:00-03', 'pendiente', 'Cuartos de Final'),
('Ganador Octavos 7', 'Ganador Octavos 8', '🏳️', '🏳️', '2026-07-11 20:00:00-03', 'pendiente', 'Cuartos de Final');


-- 5. Inserción de partidos de Semifinales (Llave Eliminatoria en Blanco)
INSERT INTO public.mundial_partidos (equipo_a, equipo_b, bandera_a, bandera_b, fecha_partido, estado, fase) VALUES
('Ganador Cuartos 1', 'Ganador Cuartos 2', '🏳️', '🏳️', '2026-07-14 20:00:00-03', 'pendiente', 'Semifinales'),
('Ganador Cuartos 3', 'Ganador Cuartos 4', '🏳️', '🏳️', '2026-07-15 20:00:00-03', 'pendiente', 'Semifinales');


-- 6. Inserción de Tercer Puesto (Llave Eliminatoria en Blanco)
INSERT INTO public.mundial_partidos (equipo_a, equipo_b, bandera_a, bandera_b, fecha_partido, estado, fase) VALUES
('Perdedor Semifinal 1', 'Perdedor Semifinal 2', '🏳️', '🏳️', '2026-07-18 16:00:00-03', 'pendiente', 'Tercer Puesto');


-- 7. Inserción de la Gran Final (Gran Cierre de Campaña 🏆)
INSERT INTO public.mundial_partidos (equipo_a, equipo_b, bandera_a, bandera_b, fecha_partido, estado, fase) VALUES
('Ganador Semifinal 1', 'Ganador Semifinal 2', '🏳️', '🏳️', '2026-07-19 17:00:00-03', 'pendiente', 'Final');
