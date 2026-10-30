BEGIN;

CREATE OR REPLACE FUNCTION public.reject_future_attendance_session_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.session_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Attendance date cannot be in the future'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_sessions_reject_future_date
    ON public.attendance_sessions;
CREATE TRIGGER attendance_sessions_reject_future_date
    BEFORE INSERT OR UPDATE ON public.attendance_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_future_attendance_session_date();

CREATE OR REPLACE FUNCTION public.reject_future_mark_recorded_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.recorded_at > CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Mark date cannot be in the future'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marks_reject_future_recorded_at ON public.marks;
CREATE TRIGGER marks_reject_future_recorded_at
    BEFORE INSERT OR UPDATE ON public.marks
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_future_mark_recorded_at();

COMMIT;
