-- Добавляем политику для обновления сообщений (пометка как прочитанных)
CREATE POLICY "Users can mark messages as read in their conversations"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
  OR conversation_id IN (
    SELECT id 
    FROM conversations 
    WHERE type = 'public'
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
  OR conversation_id IN (
    SELECT id 
    FROM conversations 
    WHERE type = 'public'
  )
);