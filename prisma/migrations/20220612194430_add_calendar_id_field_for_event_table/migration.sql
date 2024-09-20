/*
  Warnings:

  - Added the required column `calendar_id` to the `event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "event" ADD COLUMN     "calendar_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "calendar"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
