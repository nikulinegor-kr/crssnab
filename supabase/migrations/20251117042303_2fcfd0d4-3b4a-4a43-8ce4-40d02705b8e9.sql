-- Add amount field to requests table
ALTER TABLE public.requests 
ADD COLUMN amount NUMERIC(12, 2) DEFAULT 0;