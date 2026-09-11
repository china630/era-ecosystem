#!/bin/bash
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT 'LabResult' AS t, column_name FROM information_schema.columns WHERE table_name='LabResult' AND (column_name ILIKE '%item%' OR column_name ILIKE '%order%')
UNION ALL
SELECT 'LabOrderItem', column_name FROM information_schema.columns WHERE table_name='LabOrderItem' AND column_name ILIKE '%order%';
"
