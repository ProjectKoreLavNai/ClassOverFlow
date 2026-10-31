BEGIN;

DROP POLICY IF EXISTS comments_update_policy ON public.announcement_comments;
CREATE POLICY comments_update_policy ON public.announcement_comments FOR UPDATE
    USING (
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
    )
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

COMMIT;
