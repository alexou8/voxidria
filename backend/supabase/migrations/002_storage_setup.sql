-- =============================================================================
-- Voxidria: Supabase Storage Setup
-- =============================================================================
-- Migration: 002_storage_setup
-- Description: Creates the private audio storage bucket and RLS policies.
--
-- Storage path convention:
--   audio/{auth0_sub}/{session_id}/{task_type}.webm
--
-- The bucket is PRIVATE: clients never access it directly.
-- Edge Functions generate time-limited signed upload/download URLs.
-- The Supabase Service Role key (server-side only) manages objects.
-- =============================================================================

-- Create the private audio bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio',
  'audio',
  false,  -- private: no public access
  52428800,  -- 50 MB per file limit
  ARRAY['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/x-wav']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Row Level Security for storage.objects
-- ---------------------------------------------------------------------------
-- Policy: Users can only manage their own audio files.
-- The path prefix encodes the user's Auth0 sub, so we validate it here.
-- Service Role key bypasses RLS entirely (used by Edge Functions).

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'audio' AND
    (storage.foldername(name))[1] = 'audio' AND
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow authenticated users to read their own audio
CREATE POLICY "Users can read their own audio" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'audio' AND
    (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow authenticated users to delete their own audio
CREATE POLICY "Users can delete their own audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'audio' AND
    (storage.foldername(name))[2] = auth.uid()::text
  );
