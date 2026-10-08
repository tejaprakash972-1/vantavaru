# Cook UI Languages

Apply `cook-preferred-language.sql` in the Supabase SQL Editor before deploying
the app. The script adds `cook_profiles.preferred_language`, with an English
default (`en`) and accepted values `en`, `hi`, and `te`. It does not change
`cook_profiles.languages`, which remains the list of spoken languages.

The cook profile selector saves the preference through `/api/cook/language`.
The API authenticates the session and updates only that user's cook profile.
Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and server-only `SUPABASE_SERVICE_ROLE_KEY` in the deployed environment.

Cook home, profile and document views, service areas, booking requests, and
registration use the English, Hindi, and Telugu dictionaries. Customer/admin
pages and shared unauthenticated login screens are not localized by this cook
preference. Names, addresses, file names, and customer-entered notes remain
unchanged; the app does not machine-translate saved user content.

Verify with a signed-in cook:

1. Select Hindi in Cook Profile, then navigate to Cook Home.
2. Reload and confirm the language remains Hindi.
3. Sign in on another device and confirm the saved preference loads.
4. Select Telugu and check Service Areas, Documents, and Booking Request.
5. Switch back to English; confirm spoken-language selections are unchanged.