-- Lets a tenant look up who their landlord is (name + property) — needed for the "who am I
-- messaging" contact header in the mobile Messages screen. Previously tenants had no read access
-- to properties at all, and profiles only let a user read their own row, so this join silently
-- came back empty for tenants even though the query itself was valid.

create policy "tenant reads own property"
  on properties for select
  using (
    id in (
      select property_id from units where id in (
        select unit_id from leases where tenant_id = auth.uid()
      )
    )
  );

create policy "tenant reads own landlord profile"
  on profiles for select
  using (
    id in (
      select owner_id from properties where id in (
        select property_id from units where id in (
          select unit_id from leases where tenant_id = auth.uid()
        )
      )
    )
  );
