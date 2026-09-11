#!/bin/bash
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT column_name FROM information_schema.columns
WHERE table_name='LabOrder' AND column_name ILIKE '%episode%';
SELECT column_name FROM information_schema.columns
WHERE table_name='ProcedureOrder' AND column_name ILIKE '%episode%';
SELECT column_name FROM information_schema.columns
WHERE table_name='Visit' AND column_name ILIKE '%episode%';
"
