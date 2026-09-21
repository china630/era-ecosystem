#!/bin/bash
docker exec -i era-postgres psql -U era -d era_mdm -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
ORDER BY 1;
"
