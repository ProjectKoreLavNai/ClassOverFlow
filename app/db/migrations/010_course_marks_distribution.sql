BEGIN;

ALTER TABLE public.courses
    ADD COLUMN marks_distribution JSONB NOT NULL
    DEFAULT '[
        {"name": "Attendance", "total_marks": 5},
        {"name": "Assignment/presentation", "total_marks": 5},
        {"name": "CT", "total_marks": 10},
        {"name": "Mid term", "total_marks": 20},
        {"name": "Final", "total_marks": 60}
    ]'::jsonb
    CHECK (jsonb_typeof(marks_distribution) = 'array');

COMMIT;
