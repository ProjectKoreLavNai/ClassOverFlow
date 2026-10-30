BEGIN;

DROP POLICY IF EXISTS attendance_sessions_select_policy ON public.attendance_sessions;
CREATE POLICY attendance_sessions_select_policy ON public.attendance_sessions FOR SELECT
    USING (
        (
            public.current_app_user_role() = 'TEACHER'
            AND public.app_current_user_teaches_course(course_id)
        )
        OR (
            public.current_app_user_role() IN ('STUDENT', 'CR')
            AND public.app_current_user_enrolled_in_course(course_id)
        )
    );

DROP POLICY IF EXISTS attendance_records_rls_policy ON public.attendance_records;
CREATE POLICY attendance_records_rls_policy ON public.attendance_records FOR ALL
    USING (
        (
            public.current_app_user_role() IN ('STUDENT', 'CR')
            AND student_id = public.current_app_user_id()
        )
        OR (
            public.current_app_user_role() = 'TEACHER'
            AND EXISTS (
                SELECT 1
                FROM public.attendance_sessions attendance_session
                WHERE attendance_session.session_id = attendance_records.session_id
                  AND public.app_current_user_teaches_course(attendance_session.course_id)
            )
        )
    )
    WITH CHECK (
        public.current_app_user_role() = 'TEACHER'
        AND EXISTS (
            SELECT 1
            FROM public.attendance_sessions attendance_session
            WHERE attendance_session.session_id = attendance_records.session_id
              AND public.app_current_user_teaches_course(attendance_session.course_id)
        )
    );

DROP POLICY IF EXISTS marks_rls_policy ON public.marks;
CREATE POLICY marks_rls_policy ON public.marks FOR ALL
    USING (
        (
            public.current_app_user_role() IN ('STUDENT', 'CR')
            AND student_id = public.current_app_user_id()
        )
        OR (
            public.current_app_user_role() = 'TEACHER'
            AND public.app_current_user_teaches_course(course_id)
        )
    )
    WITH CHECK (
        public.current_app_user_role() = 'TEACHER'
        AND public.app_current_user_teaches_course(course_id)
    );

COMMIT;
