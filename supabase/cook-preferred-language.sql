ALTER TABLE public.cook_profiles
ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

UPDATE public.cook_profiles
SET preferred_language = 'en'
WHERE preferred_language NOT IN ('en', 'hi', 'te');

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'cook_profiles_preferred_language_check'
			AND conrelid = 'public.cook_profiles'::regclass
	) THEN
		ALTER TABLE public.cook_profiles
			ADD CONSTRAINT cook_profiles_preferred_language_check
			CHECK (preferred_language IN ('en', 'hi', 'te'));
	END IF;
END $$;