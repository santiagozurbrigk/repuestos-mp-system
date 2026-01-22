-- Script para convertir un usuario en administrador
-- Reemplaza 'tu-email@ejemplo.com' con el email del usuario que quieres hacer admin

UPDATE user_profiles 
SET role = 'admin' 
WHERE email = 'tu-email@ejemplo.com';

-- Para verificar que se actualizó correctamente:
SELECT id, email, role 
FROM user_profiles 
WHERE email = 'tu-email@ejemplo.com';
