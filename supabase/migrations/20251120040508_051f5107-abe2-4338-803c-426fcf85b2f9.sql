-- Добавляем политику для удаления бесед
CREATE POLICY "Users can delete conversations they created"
ON public.conversations
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- Добавляем политику для удаления участников бесед
CREATE POLICY "Users can delete participants from conversations they created"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE created_by = auth.uid()
  )
);

-- Добавляем политику для удаления сообщений из бесед
CREATE POLICY "Users can delete messages from conversations they created"
ON public.messages
FOR DELETE
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE created_by = auth.uid()
  )
);