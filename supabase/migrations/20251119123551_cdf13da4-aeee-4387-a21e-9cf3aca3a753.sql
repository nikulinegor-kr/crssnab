-- Add assignee to calendar events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_assignee ON calendar_events(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);