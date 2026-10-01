DO $$
DECLARE
    single_device_index record;
BEGIN
    FOR single_device_index IN
        SELECT index_table.relname AS index_name, constraint_table.conname AS constraint_name
        FROM pg_index index_info
        JOIN pg_class index_table ON index_table.oid = index_info.indexrelid
        LEFT JOIN pg_constraint constraint_table ON constraint_table.conindid = index_info.indexrelid
        WHERE index_info.indrelid = 'public.cook_devices'::regclass
          AND index_info.indisunique
          AND NOT index_info.indisprimary
          AND (
              SELECT array_agg(column_info.attname ORDER BY column_info.attname)
              FROM unnest(index_info.indkey) WITH ORDINALITY AS index_column(attnum, position)
              JOIN pg_attribute column_info ON column_info.attrelid = index_info.indrelid AND column_info.attnum = index_column.attnum
              WHERE index_column.position <= index_info.indnkeyatts
          ) IN (ARRAY['cook_profile_id'], ARRAY['cook_profile_id', 'platform'])
    LOOP
        IF single_device_index.constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.cook_devices DROP CONSTRAINT %I', single_device_index.constraint_name);
        ELSE
            EXECUTE format('DROP INDEX public.%I', single_device_index.index_name);
        END IF;
    END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cook_devices_push_token_unique ON public.cook_devices (push_token);