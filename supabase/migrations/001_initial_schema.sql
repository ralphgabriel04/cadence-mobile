-- ============================================================================
-- Cadence — Initial Database Schema
-- 14 tables with RLS, soft delete, indexes, and triggers
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('coach', 'athlete');
CREATE TYPE relationship_status AS ENUM ('pending', 'active', 'inactive');
CREATE TYPE program_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE assignment_status AS ENUM ('active', 'completed', 'paused');
CREATE TYPE session_log_status AS ENUM ('in_progress', 'completed', 'skipped');
CREATE TYPE exercise_category AS ENUM ('strength', 'cardio', 'flexibility', 'mobility', 'plyometrics', 'other');
CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE message_type AS ENUM ('text', 'image', 'session_log');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto-create profile when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'athlete')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 1. PROFILES
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'athlete',
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'America/Toronto',
  preferred_language TEXT DEFAULT 'fr',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (NOT is_deleted);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 2. COACH_ATHLETES
-- ============================================================================

CREATE TABLE coach_athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status relationship_status NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE (coach_id, athlete_id)
);

ALTER TABLE coach_athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their relationships"
  ON coach_athletes FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Athletes can view their relationships"
  ON coach_athletes FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted);

CREATE TRIGGER update_coach_athletes_updated_at
  BEFORE UPDATE ON coach_athletes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_coach_athletes_coach ON coach_athletes(coach_id) WHERE NOT is_deleted;
CREATE INDEX idx_coach_athletes_athlete ON coach_athletes(athlete_id) WHERE NOT is_deleted;

-- ============================================================================
-- 3. EXERCISES (Coach Exercise Library)
-- ============================================================================

CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category exercise_category NOT NULL DEFAULT 'strength',
  equipment TEXT,
  muscle_groups TEXT[],
  video_url TEXT,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can CRUD their exercises"
  ON exercises FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);

CREATE TRIGGER update_exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_exercises_coach ON exercises(coach_id) WHERE NOT is_deleted;

-- ============================================================================
-- 4. PROGRAMS
-- ============================================================================

CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_weeks INTEGER,
  goal TEXT,
  difficulty difficulty_level DEFAULT 'intermediate',
  status program_status NOT NULL DEFAULT 'draft',
  is_template BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can CRUD their programs"
  ON programs FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Athletes can view assigned programs"
  ON programs FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM program_assignments pa
      WHERE pa.program_id = programs.id
        AND pa.athlete_id = auth.uid()
        AND NOT pa.is_deleted
    )
  );

CREATE TRIGGER update_programs_updated_at
  BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_programs_coach ON programs(coach_id) WHERE NOT is_deleted;

-- ============================================================================
-- 5. SESSIONS
-- ============================================================================

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 1 AND 7),
  week_number INTEGER CHECK (week_number >= 1),
  order_index INTEGER NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can CRUD sessions in their programs"
  ON sessions FOR ALL
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = sessions.program_id
        AND p.coach_id = auth.uid()
        AND NOT p.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM programs p
      WHERE p.id = sessions.program_id
        AND p.coach_id = auth.uid()
        AND NOT p.is_deleted
    )
  );

CREATE POLICY "Athletes can view sessions in assigned programs"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM program_assignments pa
      JOIN programs p ON p.id = pa.program_id
      WHERE p.id = sessions.program_id
        AND pa.athlete_id = auth.uid()
        AND NOT pa.is_deleted
        AND NOT p.is_deleted
    )
  );

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_sessions_program ON sessions(program_id) WHERE NOT is_deleted;

-- ============================================================================
-- 6. SESSION_EXERCISES (Junction: Session ↔ Exercise)
-- ============================================================================

CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  sets INTEGER,
  reps TEXT,
  weight_suggestion TEXT,
  rest_seconds INTEGER,
  tempo TEXT,
  notes TEXT,
  superset_group INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can CRUD session_exercises in their programs"
  ON session_exercises FOR ALL
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN programs p ON p.id = s.program_id
      WHERE s.id = session_exercises.session_id
        AND p.coach_id = auth.uid()
        AND NOT s.is_deleted
        AND NOT p.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN programs p ON p.id = s.program_id
      WHERE s.id = session_exercises.session_id
        AND p.coach_id = auth.uid()
        AND NOT s.is_deleted
        AND NOT p.is_deleted
    )
  );

CREATE POLICY "Athletes can view session_exercises in assigned programs"
  ON session_exercises FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN program_assignments pa ON pa.program_id = s.program_id
      WHERE s.id = session_exercises.session_id
        AND pa.athlete_id = auth.uid()
        AND NOT s.is_deleted
        AND NOT pa.is_deleted
    )
  );

CREATE TRIGGER update_session_exercises_updated_at
  BEFORE UPDATE ON session_exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_session_exercises_session ON session_exercises(session_id) WHERE NOT is_deleted;
CREATE INDEX idx_session_exercises_exercise ON session_exercises(exercise_id) WHERE NOT is_deleted;

-- ============================================================================
-- 7. PROGRAM_ASSIGNMENTS
-- ============================================================================

CREATE TABLE program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  status assignment_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage assignments for their programs"
  ON program_assignments FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Athletes can view their assignments"
  ON program_assignments FOR SELECT
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted);

CREATE TRIGGER update_program_assignments_updated_at
  BEFORE UPDATE ON program_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_program_assignments_program ON program_assignments(program_id) WHERE NOT is_deleted;
CREATE INDEX idx_program_assignments_athlete ON program_assignments(athlete_id) WHERE NOT is_deleted;

-- ============================================================================
-- 8. SESSION_LOGS
-- ============================================================================

CREATE TABLE session_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_assignment_id UUID REFERENCES program_assignments(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  overall_rpe INTEGER CHECK (overall_rpe BETWEEN 1 AND 10),
  notes TEXT,
  status session_log_status NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can manage their session logs"
  ON session_logs FOR ALL
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view their athletes session logs"
  ON session_logs FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.athlete_id = session_logs.athlete_id
        AND ca.coach_id = auth.uid()
        AND ca.status = 'active'
        AND NOT ca.is_deleted
    )
  );

CREATE TRIGGER update_session_logs_updated_at
  BEFORE UPDATE ON session_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_session_logs_athlete ON session_logs(athlete_id) WHERE NOT is_deleted;
CREATE INDEX idx_session_logs_session ON session_logs(session_id) WHERE NOT is_deleted;

-- ============================================================================
-- 9. EXERCISE_LOGS
-- ============================================================================

CREATE TABLE exercise_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_log_id UUID NOT NULL REFERENCES session_logs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  session_exercise_id UUID REFERENCES session_exercises(id) ON DELETE SET NULL,
  set_number INTEGER NOT NULL,
  reps_completed INTEGER,
  weight_kg NUMERIC,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  duration_seconds INTEGER,
  distance_meters NUMERIC,
  is_pr BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can manage their exercise logs"
  ON exercise_logs FOR ALL
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM session_logs sl
      WHERE sl.id = exercise_logs.session_log_id
        AND sl.athlete_id = auth.uid()
        AND NOT sl.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_logs sl
      WHERE sl.id = exercise_logs.session_log_id
        AND sl.athlete_id = auth.uid()
        AND NOT sl.is_deleted
    )
  );

CREATE POLICY "Coaches can view their athletes exercise logs"
  ON exercise_logs FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM session_logs sl
      JOIN coach_athletes ca ON ca.athlete_id = sl.athlete_id
      WHERE sl.id = exercise_logs.session_log_id
        AND ca.coach_id = auth.uid()
        AND ca.status = 'active'
        AND NOT sl.is_deleted
        AND NOT ca.is_deleted
    )
  );

CREATE TRIGGER update_exercise_logs_updated_at
  BEFORE UPDATE ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_exercise_logs_session_log ON exercise_logs(session_log_id) WHERE NOT is_deleted;

-- ============================================================================
-- 10. READINESS_LOGS
-- ============================================================================

CREATE TABLE readiness_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
  muscle_soreness INTEGER CHECK (muscle_soreness BETWEEN 1 AND 5),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 5),
  motivation INTEGER CHECK (motivation BETWEEN 1 AND 5),
  overall_readiness NUMERIC GENERATED ALWAYS AS (
    (COALESCE(sleep_quality, 3) + COALESCE(energy_level, 3) + COALESCE(motivation, 3)
     + (6 - COALESCE(muscle_soreness, 3)) + (6 - COALESCE(stress_level, 3))) / 5.0
  ) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE (athlete_id, log_date)
);

ALTER TABLE readiness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can manage their readiness logs"
  ON readiness_logs FOR ALL
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view their athletes readiness logs"
  ON readiness_logs FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.athlete_id = readiness_logs.athlete_id
        AND ca.coach_id = auth.uid()
        AND ca.status = 'active'
        AND NOT ca.is_deleted
    )
  );

CREATE TRIGGER update_readiness_logs_updated_at
  BEFORE UPDATE ON readiness_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_readiness_logs_athlete_date ON readiness_logs(athlete_id, log_date DESC) WHERE NOT is_deleted;

-- ============================================================================
-- 11. CONVERSATIONS
-- ============================================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  UNIQUE (coach_id, athlete_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    (auth.uid() = coach_id OR auth.uid() = athlete_id)
  );

CREATE POLICY "Participants can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = coach_id OR auth.uid() = athlete_id);

CREATE POLICY "Participants can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    NOT is_deleted AND
    (auth.uid() = coach_id OR auth.uid() = athlete_id)
  );

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_conversations_coach ON conversations(coach_id) WHERE NOT is_deleted;
CREATE INDEX idx_conversations_athlete ON conversations(athlete_id) WHERE NOT is_deleted;

-- ============================================================================
-- 12. MESSAGES
-- ============================================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type message_type NOT NULL DEFAULT 'text',
  related_session_log_id UUID REFERENCES session_logs(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.coach_id = auth.uid() OR c.athlete_id = auth.uid())
        AND NOT c.is_deleted
    )
  );

CREATE POLICY "Participants can send messages in their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.coach_id = auth.uid() OR c.athlete_id = auth.uid())
        AND NOT c.is_deleted
    )
  );

CREATE POLICY "Participants can update messages (read receipts)"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.coach_id = auth.uid() OR c.athlete_id = auth.uid())
        AND NOT c.is_deleted
    )
  );

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC) WHERE NOT is_deleted;

-- ============================================================================
-- 13. SESSION_IMAGES
-- ============================================================================

CREATE TABLE session_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_log_id UUID NOT NULL REFERENCES session_logs(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE session_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can manage their session images"
  ON session_images FOR ALL
  TO authenticated
  USING (auth.uid() = athlete_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Coaches can view their athletes session images"
  ON session_images FOR SELECT
  TO authenticated
  USING (
    NOT is_deleted AND
    EXISTS (
      SELECT 1 FROM coach_athletes ca
      WHERE ca.athlete_id = session_images.athlete_id
        AND ca.coach_id = auth.uid()
        AND ca.status = 'active'
        AND NOT ca.is_deleted
    )
  );

CREATE TRIGGER update_session_images_updated_at
  BEFORE UPDATE ON session_images
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 14. COACH_NOTES
-- ============================================================================

CREATE TABLE coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_log_id UUID REFERENCES session_logs(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ
);

ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;

-- Coach notes are ONLY visible to the coach — never to the athlete
CREATE POLICY "Coaches can manage their notes"
  ON coach_notes FOR ALL
  TO authenticated
  USING (auth.uid() = coach_id AND NOT is_deleted)
  WITH CHECK (auth.uid() = coach_id);

CREATE TRIGGER update_coach_notes_updated_at
  BEFORE UPDATE ON coach_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_coach_notes_coach_athlete ON coach_notes(coach_id, athlete_id) WHERE NOT is_deleted;
