-- Reference number is no longer collected for GCash/Bank Transfer/Palawan — tenants are asked to
-- keep it legible in the proof-of-payment screenshot instead. The column stays and is still used
-- for the "Other" payment method, where it holds the custom payment method name the tenant enters.

alter table transactions alter column reference_number drop not null;
