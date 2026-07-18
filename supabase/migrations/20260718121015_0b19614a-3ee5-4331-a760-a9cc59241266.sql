
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Spare parts photos - auth read') THEN
    CREATE POLICY "Spare parts photos - auth read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'spare-parts-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Spare parts photos - auth insert') THEN
    CREATE POLICY "Spare parts photos - auth insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'spare-parts-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Spare parts photos - auth update') THEN
    CREATE POLICY "Spare parts photos - auth update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'spare-parts-photos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Spare parts photos - auth delete') THEN
    CREATE POLICY "Spare parts photos - auth delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'spare-parts-photos');
  END IF;
END $$;
