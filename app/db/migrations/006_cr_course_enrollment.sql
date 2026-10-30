BEGIN;

DROP POLICY IF EXISTS enrollments_insert_policy ON public.enrollments;
CREATE POLICY enrollments_insert_policy ON public.enrollments FOR INSERT
    WITH CHECK (
        (
            public.current_app_user_role() IN ('STUDENT', 'CR')
            AND student_id = public.current_app_user_id()
        )
        OR (
            public.current_app_user_role() = 'TEACHER'
            AND public.app_current_user_teaches_course(course_id)
        )
    );

COMMIT;
