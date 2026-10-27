-- Apply as the owner of the courses and enrollments tables.
BEGIN;

CREATE OR REPLACE FUNCTION public.app_current_user_teaches_course(p_course_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.courses c
        WHERE c.course_id = p_course_id
          AND c.teacher_id = public.current_app_user_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.app_current_user_enrolled_in_course(p_course_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.enrollments e
        WHERE e.course_id = p_course_id
          AND e.student_id = public.current_app_user_id()
    );
$$;

REVOKE ALL ON FUNCTION public.app_current_user_teaches_course(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_current_user_enrolled_in_course(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_current_user_teaches_course(integer) TO classoverflow_app;
GRANT EXECUTE ON FUNCTION public.app_current_user_enrolled_in_course(integer) TO classoverflow_app;

DROP POLICY IF EXISTS courses_select_policy ON public.courses;
CREATE POLICY courses_select_policy ON public.courses FOR SELECT
    USING (
        public.current_app_user_role() = 'ADMIN'
        OR public.app_current_user_teaches_course(course_id)
        OR public.app_current_user_enrolled_in_course(course_id)
    );

DROP POLICY IF EXISTS enrollments_select_policy ON public.enrollments;
CREATE POLICY enrollments_select_policy ON public.enrollments FOR SELECT
    USING (
        public.current_app_user_role() = 'ADMIN'
        OR student_id = public.current_app_user_id()
        OR public.app_current_user_teaches_course(course_id)
    );

DROP POLICY IF EXISTS enrollments_insert_policy ON public.enrollments;
CREATE POLICY enrollments_insert_policy ON public.enrollments FOR INSERT
    WITH CHECK (
        (public.current_app_user_role() = 'STUDENT' AND student_id = public.current_app_user_id())
        OR (
            public.current_app_user_role() = 'TEACHER'
            AND public.app_current_user_teaches_course(course_id)
        )
    );

DROP POLICY IF EXISTS announcements_select_policy ON public.announcements;
CREATE POLICY announcements_select_policy ON public.announcements FOR SELECT
    USING (
        public.current_app_user_role() = 'ADMIN'
        OR public.app_current_user_teaches_course(course_id)
        OR public.app_current_user_enrolled_in_course(course_id)
    );

DROP POLICY IF EXISTS announcements_teacher_write_policy ON public.announcements;
CREATE POLICY announcements_teacher_write_policy ON public.announcements FOR ALL
    USING (
        public.current_app_user_role() = 'TEACHER'
        AND posted_by = public.current_app_user_id()
        AND public.app_current_user_teaches_course(course_id)
    )
    WITH CHECK (
        public.current_app_user_role() = 'TEACHER'
        AND posted_by = public.current_app_user_id()
        AND public.app_current_user_teaches_course(course_id)
    );

COMMIT;
