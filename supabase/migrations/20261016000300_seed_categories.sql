-- =============================================================================
-- ChambeaYA! - Migration 0003: category catalogue (reference data)
-- Ids match the frontend `CategoryId` type. Idempotent and non-destructive:
-- re-running updates names/descriptions but never deletes rows.
-- =============================================================================

insert into public.categories (id, name, description, sort_order) values
  ('electricity',  'Electricidad', 'Instalaciones y reparaciones', 10),
  ('plumbing',     'Plomería',     'Fugas, cañerías y sanitarios', 20),
  ('technology',   'Tecnología',   'Computadoras y celulares',     30),
  ('cleaning',     'Limpieza',     'Hogares y oficinas',           40),
  ('mechanics',    'Mecánica',     'Diagnóstico y mantenimiento',  50),
  ('construction', 'Construcción', 'Albañilería y obras',          60),
  ('carpentry',    'Carpintería',  'Muebles a medida',             70),
  ('painting',     'Pintura',      'Interiores y exteriores',      80)
on conflict (id) do update
  set name        = excluded.name,
      description = excluded.description,
      sort_order  = excluded.sort_order;
