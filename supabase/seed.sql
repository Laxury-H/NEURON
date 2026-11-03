-- NEURON Seed Data Script (Optional development and testing fixture)
-- Note: Replace '00000000-0000-0000-0000-000000000000' with your actual Supabase auth.users ID if seeding directly via SQL.

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000000';
  v_sem1_id UUID := gen_random_uuid();
  v_sem2_id UUID := gen_random_uuid();
  v_c1_id UUID := gen_random_uuid();
  v_c2_id UUID := gen_random_uuid();
  v_c3_id UUID := gen_random_uuid();
  v_c4_id UUID := gen_random_uuid();
  v_c5_id UUID := gen_random_uuid();
  v_p1_id UUID := gen_random_uuid();
  v_p2_id UUID := gen_random_uuid();
  v_p3_id UUID := gen_random_uuid();
  v_p4_id UUID := gen_random_uuid();
  v_d1_id UUID := gen_random_uuid();
  v_d2_id UUID := gen_random_uuid();
  v_d3_id UUID := gen_random_uuid();
  v_d4_id UUID := gen_random_uuid();
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, timezone, theme_preference)
  VALUES (v_user_id, 'Alex Vance', 'Asia/Ho_Chi_Minh', 'light')
  ON CONFLICT (id) DO UPDATE SET display_name = 'Alex Vance';

  -- 1. Semesters
  INSERT INTO public.semesters (id, user_id, name, academic_year, start_date, end_date, sort_order, is_active)
  VALUES 
    (v_sem1_id, v_user_id, 'Semester 1', 'Academic Year 2026–2027', '2026-09-01', '2027-01-20', 1, true),
    (v_sem2_id, v_user_id, 'Semester 2', 'Academic Year 2026–2027', '2027-02-15', '2027-06-30', 2, false);

  -- 2. Courses for Semester 1
  INSERT INTO public.courses (id, user_id, semester_id, course_code, course_name, lecturer, credits, description)
  VALUES
    (v_c1_id, v_user_id, v_sem1_id, 'EE4010', 'Power System Analysis', 'Prof. Nguyen Van A', 4, 'Study of power transmission lines, admittance matrix, power flow solutions (Newton-Raphson, Gauss-Seidel), and fault analysis.'),
    (v_c2_id, v_user_id, v_sem1_id, 'EE3101', 'Renewable Energy Sources', 'Dr. Tran Thi B', 3, 'Principles of solar photovoltaic systems, wind turbine generators, microgrids and energy storage integration.'),
    (v_c3_id, v_user_id, v_sem1_id, 'EE3140', 'Electrical Machines', 'Prof. Le Van C', 3, 'Operational characteristics of synchronous generators, induction motors, and transformers under transient conditions.'),
    (v_c4_id, v_user_id, v_sem1_id, 'EE3410', 'Power Electronics', 'Dr. Pham Van D', 3, 'Switching power converters, PWM inverters, harmonics mitigation, and semiconductor control.'),
    (v_c5_id, v_user_id, v_sem1_id, 'EE3810', 'Capstone Project I', 'Prof. Hoang Van E', 3, 'Independent academic capstone project focusing on hardware-in-the-loop grid simulation.');

  -- 3. People
  INSERT INTO public.people (id, user_id, full_name, nickname, email, phone, contact_links, class_name, major, skills, notes)
  VALUES
    (v_p1_id, v_user_id, 'Nguyen Van A', 'Prof. Nguyen', 'nguyen.vana@univ.edu', '+84 901 234 567', '{"office": "Room 402, Building C"}'::jsonb, 'Faculty', 'Electrical Engineering', ARRAY['Power Systems', 'Grid Stability', 'MATLAB', 'Newton-Raphson'], 'Office hours on Tuesdays and Thursdays 14:00-16:00.'),
    (v_p2_id, v_user_id, 'Pham Minh Tuan', 'Tuan P.', 'tuan.pm@student.univ.edu', '+84 912 345 678', '{"zalo": "tuanpm26", "github": "tuan-ee"}'::jsonb, 'EE-K65', 'Electrical Engineering', ARRAY['Power World', 'MATLAB', 'Python', 'LaTeX'], 'Teammate for EE4010 course project and Capstone I.'),
    (v_p3_id, v_user_id, 'Le Thi Mai', 'Mai Le', 'mai.lt@student.univ.edu', '+84 923 456 789', '{"facebook": "facebook.com/mai.le.ee"}'::jsonb, 'EE-K65', 'Electrical Engineering', ARRAY['Simulink', 'Circuit Analysis', 'Numerical Methods'], 'Study group partner for midterm preparation.'),
    (v_p4_id, v_user_id, 'Tran Thi B', 'Dr. Tran', 'tran.thib@univ.edu', '+84 934 567 890', '{"office": "Room 512, Building B"}'::jsonb, 'Faculty', 'Renewable Energy Systems', ARRAY['Photovoltaics', 'Wind Turbines', 'HOMER Pro'], 'Advisor for renewable integration research.');

  -- 4. Course - People connections
  INSERT INTO public.course_people (user_id, course_id, person_id, relationship_type, knowledge_topics, context_note)
  VALUES
    (v_user_id, v_c1_id, v_p1_id, 'Lecturer', ARRAY['Transmission Line Modeling', 'Newton-Raphson Load Flow'], 'Course lecturer and exam creator.'),
    (v_user_id, v_c1_id, v_p2_id, 'Project teammate', ARRAY['MATLAB Implementation', 'Y-Bus Matrix'], 'Group partner for computer simulation assignment 2.'),
    (v_user_id, v_c1_id, v_p3_id, 'Classmate', ARRAY['Symmetrical Components', 'Fault Analysis'], 'Collaborates on weekly practice problem sets.'),
    (v_user_id, v_c2_id, v_p4_id, 'Lecturer', ARRAY['PV Array Sizing', 'MPPT Algorithms'], 'Course head for Renewable Sources.'),
    (v_user_id, v_c2_id, v_p2_id, 'Project teammate', ARRAY['HOMER Simulation'], 'Also working together on solar microgrid case study.');

  -- 5. Documents
  INSERT INTO public.documents (id, user_id, original_file_name, storage_path, mime_type, file_size, category, description)
  VALUES
    (v_d1_id, v_user_id, 'EE4010_Lec01_AdmittanceMatrix.pdf', 'seeds/EE4010_Lec01_AdmittanceMatrix.pdf', 'application/pdf', 2457600, 'Lecture', 'Introduction to nodal admittance matrix formulation and Kron reduction.'),
    (v_d2_id, v_user_id, 'EE4010_Assign01_NewtonRaphson.pdf', 'seeds/EE4010_Assign01_NewtonRaphson.pdf', 'application/pdf', 1048576, 'Assignment', 'Numerical power flow problem sheet using Jacobian derivative matrix.'),
    (v_d3_id, v_user_id, 'Power_Systems_Analysis_Grainger_Stevenson.pdf', 'seeds/Power_Systems_Analysis_Grainger_Stevenson.pdf', 'application/pdf', 15728640, 'Textbook', 'Primary reference textbook for electrical power systems analysis.'),
    (v_d4_id, v_user_id, 'EE4010_Past_Midterm_2025.pdf', 'seeds/EE4010_Past_Midterm_2025.pdf', 'application/pdf', 838860, 'Past Exam', 'Previous year exam paper with solved line parameters solutions.');

  -- 6. Course - Document connections
  INSERT INTO public.course_documents (user_id, course_id, document_id, display_order)
  VALUES
    (v_user_id, v_c1_id, v_d1_id, 1),
    (v_user_id, v_c1_id, v_d2_id, 2),
    (v_user_id, v_c1_id, v_d3_id, 3),
    (v_user_id, v_c1_id, v_d4_id, 4);

  -- 7. Events
  INSERT INTO public.events (user_id, semester_id, course_id, title, description, event_type, location, start_at, end_at, all_day, recurrence_rule, reminder_offsets_minutes, deadline_status)
  VALUES
    (v_user_id, v_sem1_id, v_c1_id, 'EE4010 Lecture: Power Flow Methods', 'Weekly core lecture covering Newton-Raphson iteration', 'CLASS', 'Hall C2-101', '2026-09-08 07:30:00+07', '2026-09-08 10:00:00+07', false, 'FREQ=WEEKLY;BYDAY=TU', ARRAY[15, 30], 'pending'),
    (v_user_id, v_sem1_id, v_c2_id, 'EE3101 Lecture: Solar Photovoltaics', 'Weekly renewable lecture', 'CLASS', 'Hall B1-204', '2026-09-09 13:00:00+07', '2026-09-09 15:30:00+07', false, 'FREQ=WEEKLY;BYDAY=WE', ARRAY[15], 'pending'),
    (v_user_id, v_sem1_id, v_c1_id, 'Assignment 01 Submission: Y-Bus Coding', 'Submit MATLAB code and PDF report via student portal', 'DEADLINE', 'Online Portal', '2026-10-15 23:59:00+07', '2026-10-15 23:59:00+07', false, NULL, ARRAY[1440, 4320], 'pending'),
    (v_user_id, v_sem1_id, v_c1_id, 'EE4010 Midterm Examination', 'Covers chapters 1 through 5, open-notes exam', 'EXAM', 'Auditorium A1', '2026-11-10 09:00:00+07', '2026-11-10 11:00:00+07', false, NULL, ARRAY[1440], 'pending'),
    (v_user_id, v_sem1_id, NULL, 'Academic Advisor Consultation', 'Review course progress and capstone milestone with advisor', 'PERSONAL', 'Dean Office 301', '2026-10-20 14:00:00+07', '2026-10-20 15:00:00+07', false, NULL, ARRAY[30], 'pending');

  -- 8. Course Graph Layout
  INSERT INTO public.course_graph_layouts (user_id, course_id, positions, viewport)
  VALUES (
    v_user_id,
    v_c1_id,
    '{
      "course": {"x": 400, "y": 300},
      "relationships": {"x": 100, "y": 180},
      "files": {"x": 700, "y": 180}
    }'::jsonb,
    '{"x": 0, "y": 0, "zoom": 1}'::jsonb
  )
  ON CONFLICT (user_id, course_id) DO NOTHING;

END $$;
