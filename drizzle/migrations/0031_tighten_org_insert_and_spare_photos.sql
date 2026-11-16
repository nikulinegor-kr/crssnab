DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Spare parts photos - auth read" ON storage.objects;
DROP POLICY IF EXISTS "Spare parts photos - auth insert" ON storage.objects;
DROP POLICY IF EXISTS "Spare parts photos - auth update" ON storage.objects;
DROP POLICY IF EXISTS "Spare parts photos - auth delete" ON storage.objects;
CREATE POLICY "Spare parts photos - org read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'spare-parts-photos' AND public.user_has_org_access((select auth.uid()), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Spare parts photos - org insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'spare-parts-photos' AND public.user_has_org_access((select auth.uid()), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Spare parts photos - org update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'spare-parts-photos' AND public.user_has_org_access((select auth.uid()), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Spare parts photos - org delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'spare-parts-photos' AND public.user_has_org_access((select auth.uid()), ((storage.foldername(name))[1])::uuid));