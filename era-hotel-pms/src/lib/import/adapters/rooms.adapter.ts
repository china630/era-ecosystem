import { z } from 'zod';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  cellBool,
  cellNumber,
  cellString,
  mapRoomStatus,
} from '@/lib/import/helpers';
import type { ImportAdapter } from '@/lib/import/types';
import { isShareRoomNumberSuffix } from '@/lib/integration/elektraweb-share-map';

const rowSchema = z.object({
  roomNumber: z.string().min(1),
  roomTypeCode: z.string().min(1),
  floor: z.number().int().optional(),
  description: z.string().optional().nullable(),
  roomState: z.string().optional().nullable(),
  maxBed: z.number().int().optional().nullable(),
  bedTypeCode: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  viewCode: z.string().optional().nullable(),
  disabled: z.boolean().optional(),
  deleted: z.boolean().optional(),
});

export const roomsAdapter: ImportAdapter<z.infer<typeof rowSchema>> = {
  entity: 'rooms',
  label: 'Rooms',
  order: 22,
  permission: PERMISSIONS.MASTER_DATA_MANAGE,
  templateHint: 'Rooms.xlsx',
  headerAliases: {
    'Room No': 'roomNumber',
    'Room Type': 'roomTypeCode',
    Description: 'description',
    Floor: 'floor',
    'Room State': 'roomState',
    'Max Bed': 'maxBed',
    'Bed Type': 'bedTypeCode',
    Location: 'location',
    View: 'viewCode',
    Disabled: 'disabled',
    Deleted: 'deleted',
  },
  rowSchema,
  mapRow: (raw) => ({
    roomNumber: cellString(raw.roomNumber),
    roomTypeCode: cellString(raw.roomTypeCode),
    floor: cellNumber(raw.floor) ?? 1,
    description: cellString(raw.description),
    roomState: cellString(raw.roomState),
    maxBed: cellNumber(raw.maxBed),
    bedTypeCode: cellString(raw.bedTypeCode)?.toUpperCase(),
    location: cellString(raw.location),
    viewCode: cellString(raw.viewCode),
    disabled: cellBool(raw.disabled),
    deleted: cellBool(raw.deleted),
  }),
  upsert: async (tx, row, dryRun) => {
    // EW FO list suffix 707S is not a master room — skip virtual share labels.
    if (isShareRoomNumberSuffix(row.roomNumber)) {
      return 'skipped';
    }
    const roomType = await tx.roomType.findFirst({
      where: {
        OR: [
          { code: row.roomTypeCode.toUpperCase() },
          { name: { equals: row.roomTypeCode, mode: 'insensitive' } },
        ],
      },
    });
    if (!roomType) {
      throw new Error(`Room type not found: ${row.roomTypeCode}`);
    }
    const existing = await tx.room.findFirst({ where: { roomNumber: row.roomNumber } });
    const data = {
      roomTypeId: roomType.id,
      floor: row.floor ?? 1,
      status: mapRoomStatus(row.roomState),
      description: row.description ?? undefined,
      maxBed: row.maxBed ?? undefined,
      bedTypeCode: row.bedTypeCode ?? undefined,
      location: row.location ?? undefined,
      viewCode: row.viewCode ?? undefined,
      disabled: row.disabled ?? false,
      deleted: row.deleted ?? false,
    };
    if (dryRun) return existing ? 'updated' : 'created';
    await tx.room.upsert({
      where: { roomNumber: row.roomNumber } as never,
      create: { roomNumber: row.roomNumber, ...data },
      update: data,
    });
    return existing ? 'updated' : 'created';
  },
};
