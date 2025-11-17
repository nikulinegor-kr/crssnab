-- Remove static check constraints for status and priority
-- These constraints prevent adding new statuses/priorities dynamically
-- The application will validate against request_statuses and request_priorities tables instead

ALTER TABLE public.requests 
DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests 
DROP CONSTRAINT IF EXISTS requests_priority_check;