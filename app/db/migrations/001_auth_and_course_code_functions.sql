-- Apply as the owner of the existing tables so SECURITY DEFINER operations can pass RLS.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP FUNCTION IF EXISTS public.app_register_user(text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.app_register_user(
    p_role text,
    p_full_name text,
    p_username text,
    p_email text,
    p_password_hash text,
    p_phone text
)
RETURNS TABLE (
    user_id integer,
    role varchar,
    full_name varchar,
    username varchar,
    email varchar,
    phone varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    new_user_id integer;
    normalized_role text := upper(p_role);
BEGIN
    IF normalized_role IS NULL OR normalized_role NOT IN ('STUDENT', 'TEACHER')
        OR p_full_name IS NULL
        OR p_username IS NULL
        OR p_email IS NULL
        OR p_password_hash IS NULL
        OR (p_phone IS NOT NULL AND char_length(p_phone) > 20) THEN
        RAISE EXCEPTION 'Invalid registration data' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('email:' || lower(p_email)));
    PERFORM pg_advisory_xact_lock(hashtext('username:' || lower(p_username)));

    IF EXISTS (
        SELECT 1
        FROM public.students s
        WHERE lower(s.email) = lower(p_email) OR lower(s.username) = lower(p_username)
        UNION ALL
        SELECT 1
        FROM public.teachers t
        WHERE lower(t.email) = lower(p_email) OR lower(t.username) = lower(p_username)
        UNION ALL
        SELECT 1
        FROM public.admins a
        WHERE lower(a.email) = lower(p_email) OR lower(a.username) = lower(p_username)
    ) THEN
        RAISE EXCEPTION 'Email or username already exists' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.users (role)
    VALUES (normalized_role)
    RETURNING public.users.user_id INTO new_user_id;

    IF normalized_role = 'STUDENT' THEN
        INSERT INTO public.students (student_id, full_name, username, email, password_hash, phone)
        VALUES (new_user_id, p_full_name, p_username, lower(p_email), p_password_hash, p_phone);
        RETURN QUERY
        SELECT new_user_id, normalized_role::varchar, p_full_name::varchar, p_username::varchar,
               lower(p_email)::varchar, p_phone::varchar;
    ELSE
        INSERT INTO public.teachers (teacher_id, full_name, username, email, password_hash, phone)
        VALUES (new_user_id, p_full_name, p_username, lower(p_email), p_password_hash, p_phone);
        RETURN QUERY
        SELECT new_user_id, normalized_role::varchar, p_full_name::varchar, p_username::varchar,
               lower(p_email)::varchar, p_phone::varchar;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_user_profile(p_user_id integer)
RETURNS TABLE (
    user_id integer,
    role varchar,
    full_name varchar,
    username varchar,
    email varchar,
    phone varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT u.user_id, u.role, s.full_name, s.username, s.email, s.phone
    FROM public.users u
    JOIN public.students s ON s.student_id = u.user_id
    WHERE u.user_id = p_user_id AND u.role = 'STUDENT'
      AND (p_user_id = public.current_app_user_id() OR public.current_app_user_role() = 'ADMIN')
    UNION ALL
    SELECT u.user_id, u.role, t.full_name, t.username, t.email, t.phone
    FROM public.users u
    JOIN public.teachers t ON t.teacher_id = u.user_id
    WHERE u.user_id = p_user_id AND u.role = 'TEACHER'
      AND (p_user_id = public.current_app_user_id() OR public.current_app_user_role() = 'ADMIN')
    UNION ALL
    SELECT u.user_id, u.role, a.full_name, a.username, a.email, NULL::varchar
    FROM public.users u
    JOIN public.admins a ON a.admin_id = u.user_id
    WHERE u.user_id = p_user_id AND u.role = 'ADMIN'
      AND (p_user_id = public.current_app_user_id() OR public.current_app_user_role() = 'ADMIN');
$$;

CREATE OR REPLACE FUNCTION public.app_update_user_profile(
    p_user_id integer,
    p_role text,
    p_full_name text,
    p_username text,
    p_email text,
    p_phone text
)
RETURNS TABLE (
    user_id integer,
    role varchar,
    full_name varchar,
    username varchar,
    email varchar,
    phone varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    normalized_role text := upper(p_role);
    affected_rows integer;
BEGIN
    IF p_user_id IS DISTINCT FROM public.current_app_user_id()
        OR normalized_role IS DISTINCT FROM public.current_app_user_role() THEN
        RAISE EXCEPTION 'Profile access denied' USING ERRCODE = '42501';
    END IF;

    IF p_phone IS NOT NULL AND char_length(p_phone) > 20 THEN
        RAISE EXCEPTION 'Phone number is too long' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('profile-user:' || p_user_id::text));
    PERFORM pg_advisory_xact_lock(hashtext('email:' || lower(p_email)));
    PERFORM pg_advisory_xact_lock(hashtext('username:' || lower(p_username)));

    IF EXISTS (
        SELECT 1 FROM public.students s
        WHERE (lower(s.email) = lower(p_email) OR lower(s.username) = lower(p_username))
          AND s.student_id <> p_user_id
        UNION ALL
        SELECT 1 FROM public.teachers t
        WHERE (lower(t.email) = lower(p_email) OR lower(t.username) = lower(p_username))
          AND t.teacher_id <> p_user_id
        UNION ALL
        SELECT 1 FROM public.admins a
        WHERE (lower(a.email) = lower(p_email) OR lower(a.username) = lower(p_username))
          AND a.admin_id <> p_user_id
    ) THEN
        RAISE EXCEPTION 'Email or username already exists' USING ERRCODE = '23505';
    END IF;

    IF normalized_role = 'STUDENT' THEN
        UPDATE public.students s
        SET full_name = p_full_name, username = p_username, email = lower(p_email), phone = p_phone
        WHERE s.student_id = p_user_id;
    ELSIF normalized_role = 'TEACHER' THEN
        UPDATE public.teachers t
        SET full_name = p_full_name, username = p_username, email = lower(p_email), phone = p_phone
        WHERE t.teacher_id = p_user_id;
    ELSIF normalized_role = 'ADMIN' THEN
        UPDATE public.admins a
        SET full_name = p_full_name, username = p_username, email = lower(p_email)
        WHERE a.admin_id = p_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid user role' USING ERRCODE = '22023';
    END IF;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows = 0 THEN
        RETURN;
    END IF;

    RETURN QUERY SELECT * FROM public.app_get_user_profile(p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_authenticate_user(p_email text)
RETURNS TABLE (
    user_id integer,
    role varchar,
    full_name varchar,
    username varchar,
    email varchar,
    password_hash varchar
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT u.user_id,
           CASE WHEN s.cr_status THEN 'CR'::varchar ELSE u.role END AS role,
           s.full_name, s.username, s.email, s.password_hash
    FROM public.users u
    JOIN public.students s ON s.student_id = u.user_id
    WHERE u.role = 'STUDENT' AND lower(s.email) = lower(p_email)
    UNION ALL
    SELECT u.user_id, u.role, t.full_name, t.username, t.email, t.password_hash
    FROM public.users u
    JOIN public.teachers t ON t.teacher_id = u.user_id
    WHERE u.role = 'TEACHER' AND lower(t.email) = lower(p_email)
    UNION ALL
    SELECT u.user_id, u.role, a.full_name, a.username, a.email, a.password_hash
    FROM public.users u
    JOIN public.admins a ON a.admin_id = u.user_id
    WHERE u.role = 'ADMIN' AND lower(a.email) = lower(p_email);
$$;

CREATE OR REPLACE FUNCTION public.app_find_course_by_code(p_class_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    crypto_schema text;
    matched_course_id integer;
BEGIN
    SELECT n.nspname
    INTO STRICT crypto_schema
    FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto';

    EXECUTE format(
        'SELECT c.course_id FROM public.courses c '
        'WHERE %I.crypt($1, c.class_code_hash) = c.class_code_hash LIMIT 1',
        crypto_schema
    )
    INTO matched_course_id
    USING p_class_code;

    RETURN matched_course_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_hash_course_code(p_class_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    crypto_schema text;
    generated_hash text;
BEGIN
    SELECT n.nspname
    INTO STRICT crypto_schema
    FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto';

    EXECUTE format('SELECT %I.crypt($1, %I.gen_salt(''bf''))', crypto_schema, crypto_schema)
    INTO generated_hash
    USING p_class_code;

    RETURN generated_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_course_code_exists(p_course_code text, p_exclude_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(lower(p_course_code)));
    RETURN EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE lower(c.course_code) = lower(p_course_code)
          AND (p_exclude_id IS NULL OR c.course_id <> p_exclude_id)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.app_register_user(text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_get_user_profile(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_update_user_profile(integer, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_authenticate_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_find_course_by_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_hash_course_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_course_code_exists(text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_register_user(text, text, text, text, text, text) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_get_user_profile(integer) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_update_user_profile(integer, text, text, text, text, text) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_authenticate_user(text) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_find_course_by_code(text) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_hash_course_code(text) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_course_code_exists(text, integer) TO classoverflow_app;
