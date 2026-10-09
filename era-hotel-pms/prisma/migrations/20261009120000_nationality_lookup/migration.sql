-- Country names for guest citizenship. Labels live on HotelLookup (name / nameAz / nameRu / nameEn).
ALTER TYPE "HotelLookupKind" ADD VALUE IF NOT EXISTS 'NATIONALITY';
