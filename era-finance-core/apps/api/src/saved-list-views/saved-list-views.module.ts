import { Module } from "@nestjs/common";
import { SavedListViewsController } from "./saved-list-views.controller";
import { SavedListViewsService } from "./saved-list-views.service";

@Module({
  controllers: [SavedListViewsController],
  providers: [SavedListViewsService],
  exports: [SavedListViewsService],
})
export class SavedListViewsModule {}
