-- Move-in charges: a one-time invoice (advance rent + security deposit, multipliers
-- admin-adjustable per lease) generated automatically when a lease is created. Neither app
-- has a category label/icon map (packages/shared/src/format.ts) — line items are always shown
-- by their free-text `description`, so these new categories need no frontend label wiring.
alter type line_item_category add value 'advance_rent';
alter type line_item_category add value 'deposit';
