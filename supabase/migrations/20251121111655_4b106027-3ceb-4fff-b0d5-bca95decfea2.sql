-- Add priority field to calendar_events table
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Средний' CHECK (priority IN ('Высокий', 'Средний', 'Низкий'));