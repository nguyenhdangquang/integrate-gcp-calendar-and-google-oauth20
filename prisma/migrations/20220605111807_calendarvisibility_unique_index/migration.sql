/*
  Warnings:

  - A unique constraint covering the columns `[source_id,target_id]` on the table `calendar_visibility` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "calendar_visibility_source_id_target_id_key" ON "calendar_visibility"("source_id", "target_id");
