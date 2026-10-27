BEGIN;

DROP POLICY IF EXISTS announcements_select_policy ON public.announcements;
CREATE POLICY announcements_select_policy ON public.announcements FOR SELECT
    USING (
        public.app_current_user_teaches_course(course_id)
        OR public.app_current_user_enrolled_in_course(course_id)
    );

DROP POLICY IF EXISTS comments_select_policy ON public.announcement_comments;
CREATE POLICY comments_select_policy ON public.announcement_comments FOR SELECT
    USING (
        public.current_app_user_role() <> 'ADMIN'
        AND EXISTS (
            SELECT 1
            FROM public.announcements a
            WHERE a.announcement_id = announcement_comments.announcement_id
              AND (
                  public.app_current_user_teaches_course(a.course_id)
                  OR public.app_current_user_enrolled_in_course(a.course_id)
              )
        )
    );

DROP POLICY IF EXISTS comments_insert_policy ON public.announcement_comments;
CREATE POLICY comments_insert_policy ON public.announcement_comments FOR INSERT
    WITH CHECK (
        public.current_app_user_role() <> 'ADMIN'
        AND user_id = public.current_app_user_id()
        AND EXISTS (
            SELECT 1
            FROM public.announcements a
            WHERE a.announcement_id = announcement_comments.announcement_id
              AND (
                  public.app_current_user_teaches_course(a.course_id)
                  OR public.app_current_user_enrolled_in_course(a.course_id)
              )
        )
    );

DROP POLICY IF EXISTS comments_delete_policy ON public.announcement_comments;
CREATE POLICY comments_delete_policy ON public.announcement_comments FOR DELETE
    USING (
        public.current_app_user_role() <> 'ADMIN'
        AND (
            user_id = public.current_app_user_id()
            OR EXISTS (
                SELECT 1
                FROM public.announcements a
                WHERE a.announcement_id = announcement_comments.announcement_id
                  AND public.app_current_user_teaches_course(a.course_id)
            )
        )
    );

COMMIT;
