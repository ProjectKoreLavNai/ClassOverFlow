BEGIN;

DROP POLICY IF EXISTS announcements_select_policy ON public.announcements;
CREATE POLICY announcements_select_policy ON public.announcements FOR SELECT
    USING (
        public.current_app_user_role() = 'ADMIN'
        OR public.app_current_user_teaches_course(course_id)
        OR public.app_current_user_enrolled_in_course(course_id)
    );

COMMIT;
