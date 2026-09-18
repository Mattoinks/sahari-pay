-- Adds Instagram as a contact_platform option (used for both the landlord's and a tenant's
-- "social media" contact method).
alter type contact_platform add value if not exists 'instagram';
