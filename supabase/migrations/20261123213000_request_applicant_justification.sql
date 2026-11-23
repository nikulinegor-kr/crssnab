alter table public.requests
  add column applicant_justification text
  check (char_length(applicant_justification) <= 2000);
