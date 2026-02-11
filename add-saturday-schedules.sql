-- Ajouter les 6 samedis matin de Vento (id_staff=1) en consultation Ophtalmo Clinique (id_department=1)
-- entry_type = 'ADDED', recurrence = Ponctuel (id_recurrence=1), schedule_type = 'FIXED'

INSERT INTO staff_schedules (id_staff, entry_type, schedule_type, id_department, day_of_week, period, id_recurrence, specific_date)
VALUES
  (1, 'ADDED', 'FIXED', 1, 6, 'AM', 1, '2026-01-10'),
  (1, 'ADDED', 'FIXED', 1, 6, 'AM', 1, '2026-02-14'),
  (1, 'ADDED', 'FIXED', 1, 6, 'AM', 1, '2026-03-14'),
  (1, 'ADDED', 'FIXED', 1, 6, 'AM', 1, '2026-04-18'),
  (1, 'ADDED', 'FIXED', 1, 6, 'AM', 1, '2026-05-30'),
  (1, 'ADDED', 'FIXED', 1, 6, 'AM', 1, '2026-06-13');
