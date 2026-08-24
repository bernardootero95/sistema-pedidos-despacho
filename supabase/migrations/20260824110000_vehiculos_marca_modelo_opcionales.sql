-- ============================================================================
-- Marca y modelo del vehículo pasan a ser opcionales
-- ============================================================================
-- La placa sigue siendo el único dato obligatorio para registrar un
-- vehículo. En campo, muchas veces se da de alta la unidad antes de tener
-- a mano la ficha técnica completa (marca/año), y capacidad_peso ya era
-- opcional en la práctica (el frontend siempre mandaba 0 si venía vacío);
-- ahora marca y modelo también aceptan NULL a nivel de base de datos.
-- ============================================================================
ALTER TABLE vehiculos ALTER COLUMN marca DROP NOT NULL;
ALTER TABLE vehiculos ALTER COLUMN modelo DROP NOT NULL;
