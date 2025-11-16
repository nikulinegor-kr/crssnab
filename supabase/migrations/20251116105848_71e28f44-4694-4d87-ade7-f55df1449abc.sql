-- Add telegram auto-send settings to organizations table
ALTER TABLE organizations 
ADD COLUMN telegram_auto_send_on_create boolean DEFAULT true,
ADD COLUMN telegram_auto_send_on_status_change boolean DEFAULT true;