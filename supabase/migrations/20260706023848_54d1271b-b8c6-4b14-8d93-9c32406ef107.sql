
-- 1) messages: remove public-type bypass
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_participants
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can mark messages as read in their conversations" ON public.messages;
CREATE POLICY "Users can mark messages as read in their conversations"
ON public.messages FOR UPDATE
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_participants
    WHERE user_id = auth.uid()
  )
);

-- 2) requests: drop redundant broad SELECT policy
DROP POLICY IF EXISTS "Users can view organization requests" ON public.requests;

-- 3) max_updates: explicit deny SELECT policy (defense-in-depth)
CREATE POLICY "Deny direct read of raw webhook payloads"
ON public.max_updates FOR SELECT
USING (false);
