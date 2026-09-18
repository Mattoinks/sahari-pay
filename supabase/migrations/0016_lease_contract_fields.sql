-- Whether a lease has a signed fixed-term contract, and when it's set to expire. Distinct from
-- `end_date` (the actual move-out date, only set on termination) — `contract_end_date` is the
-- agreed term the lease was signed for, which may pass without the tenant actually moving out
-- (e.g. rolling into month-to-month) or be cut short by an early termination.
alter table leases add column has_contract boolean not null default false;
alter table leases add column contract_end_date date;
