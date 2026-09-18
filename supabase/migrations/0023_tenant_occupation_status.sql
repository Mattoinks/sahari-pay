-- Occupation status (student / employed / etc.) — distinct from occupancy_type, which describes
-- household composition (Single / Couple / Family / Shared). Collected at mobile signup and
-- shown to the admin when reviewing a pending self-signup (see 0022_tenant_approval.sql).

alter table profiles add column if not exists occupation_status text
  check (occupation_status is null or occupation_status in
    ('student', 'employed', 'self_employed', 'unemployed', 'retired'));

-- Source of income alongside occupation_status (e.g. a student's occupation_status might pair
-- with source_of_income 'allowance', an employed tenant with 'salary'). Same signup form and
-- admin review screen as occupation_status above. source_of_income_other holds the free-text
-- detail when 'other' is picked (mobile shows a text box only in that case).
alter table profiles add column if not exists source_of_income text
  check (source_of_income is null or source_of_income in
    ('salary', 'business', 'allowance', 'remittance', 'pension', 'other'));

alter table profiles add column if not exists source_of_income_other text;
