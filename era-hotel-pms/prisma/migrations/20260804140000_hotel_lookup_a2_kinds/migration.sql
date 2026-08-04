-- A2: note / concierge / event line kinds on HotelLookup
ALTER TYPE "HotelLookupKind" ADD VALUE 'NOTE_TYPE';
ALTER TYPE "HotelLookupKind" ADD VALUE 'CONCIERGE_CATEGORY';
ALTER TYPE "HotelLookupKind" ADD VALUE 'EVENT_LINE_KIND';
