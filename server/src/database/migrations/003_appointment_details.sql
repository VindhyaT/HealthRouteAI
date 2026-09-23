ALTER TABLE appointment_guidance
  ADD COLUMN appointment_recommended BOOLEAN,
  ADD COLUMN how_to_schedule TEXT,
  ADD COLUMN documents_to_bring TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN arrival_guidance TEXT,
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;

-- Enrich only recognized starter records; leave custom guidance intact.
UPDATE appointment_guidance a SET
  appointment_recommended = s.name <> 'Urgent care visit',
  how_to_schedule = CASE WHEN s.name = 'Urgent care visit'
    THEN 'Demo: Walk-ins are accepted. Call the listed location to confirm hours and current availability.'
    ELSE 'Demo: Call the listed location and ask to schedule this service. Confirm the date, time, and location with the scheduling team.' END,
  documents_to_bring = ARRAY['Photo ID', 'Insurance card, if applicable', 'Appointment confirmation, if available', 'Referral or service order, if your scheduling team requested one'],
  arrival_guidance = 'Demo: Arrive 15 minutes before the scheduled time for check-in. For a walk-in visit, check in at reception. For a virtual visit, use the check-in details in your appointment confirmation.',
  is_demo = TRUE,
  booking_url = CASE WHEN a.booking_url = '/appointments/request' THEN NULL ELSE a.booking_url END
FROM services s WHERE a.service_id = s.id AND a.title = 'How to arrange ' || s.name
  AND s.name IN ('Annual wellness visit','Family medicine','Cardiology consultation','Echocardiogram','OB/GYN care','Physical therapy','Orthopedic consultation','Diagnostic imaging','Dermatology consultation','Laboratory testing','Urgent care visit');

-- Remove the old generic fasting suggestion from unreviewed demo content.
UPDATE services SET appointment_info = 'Call the listed location to schedule laboratory testing and confirm any requested documents.'
WHERE name = 'Laboratory testing' AND appointment_info = 'Bring your order and insurance card. Fasting may be required for some tests.';
UPDATE appointment_guidance SET instructions = 'Call the listed location to schedule laboratory testing and confirm any requested documents.'
WHERE title = 'How to arrange Laboratory testing' AND instructions = 'Bring your order and insurance card. Fasting may be required for some tests.';
