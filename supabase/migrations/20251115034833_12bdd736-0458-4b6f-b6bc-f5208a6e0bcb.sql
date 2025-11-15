-- Add applicant and executor columns to requests table
ALTER TABLE public.requests
ADD COLUMN applicant text,
ADD COLUMN executor text;