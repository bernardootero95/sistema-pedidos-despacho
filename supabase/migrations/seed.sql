-- Asegurar que la extensión de encriptación está activa
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    nuevo_usuario_id UUID := gen_random_uuid();
    rol_soporte_id INTEGER;
    -- VARIABLES DE CONFIGURACIÓN (Puedes cambiarlas si tu dominio es distinto)
    v_email VARCHAR := 'soporte@empresa.com';
    v_password VARCHAR := 'Admin123!';
    v_username VARCHAR := 'soporte';
    v_fullname VARCHAR := 'Administrador de Soporte';
BEGIN
    -- 1. Obtener el ID del rol 'soporte' creado en nuestro esquema base
    SELECT id INTO rol_soporte_id FROM public.roles WHERE nombre = 'soporte';

    IF rol_soporte_id IS NULL THEN
        RAISE EXCEPTION 'El rol de soporte no existe. Ejecuta primero el esquema de tablas.';
    END IF;

    -- 2. Insertar en la tabla nativa de Supabase Auth con hash de contraseña
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, confirmation_token, recovery_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', 
        nuevo_usuario_id, 
        'authenticated', 
        'authenticated', 
        v_email, 
        crypt(v_password, gen_salt('bf')),
        NOW(), 
        '{"provider": "email", "providers": ["email"]}', 
        '{}',
        NOW(), 
        NOW(), 
        '', 
        ''
    );

    -- 3. Insertar la identidad (Requisito interno de Supabase para iniciar sesión)
    INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), 
        nuevo_usuario_id, 
        nuevo_usuario_id::text, 
        format('{"sub": "%s", "email": "%s"}', nuevo_usuario_id, v_email)::jsonb, 
        'email', 
        NOW(), 
        NOW(), 
        NOW()
    );

    -- 4. Insertar en nuestra tabla de perfiles (Vinculación de Lógica de Negocio/Marca Blanca)
    INSERT INTO public.perfiles (
        id, nombre_usuario, nombre_completo, rol_id, estado
    ) VALUES (
        nuevo_usuario_id, 
        v_username, 
        v_fullname, 
        rol_soporte_id, 
        true
    );

    RAISE NOTICE 'Usuario maestro creado exitosamente. Puedes iniciar sesión con el usuario: % y contraseña: %', v_username, v_password;
END $$;