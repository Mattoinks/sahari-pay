-- Contact number and meet-up point for a viewing/signing appointment — collected on the
-- request form so the admin knows how to reach the tenant and where to meet, without having to
-- go back and forth in Messages first.

alter table viewing_requests add column if not exists contact_number text;
alter table viewing_requests add column if not exists meetup_point text;
