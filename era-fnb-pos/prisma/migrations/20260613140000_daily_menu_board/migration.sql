CREATE TABLE "daily_menu_entries" (
    "id" TEXT NOT NULL,
    "outlet_id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "board_date" DATE NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_menu_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "daily_menu_entries_outlet_id_menu_item_id_board_date_key" ON "daily_menu_entries"("outlet_id", "menu_item_id", "board_date");
CREATE INDEX "daily_menu_entries_outlet_id_board_date_idx" ON "daily_menu_entries"("outlet_id", "board_date");

ALTER TABLE "daily_menu_entries" ADD CONSTRAINT "daily_menu_entries_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_menu_entries" ADD CONSTRAINT "daily_menu_entries_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
