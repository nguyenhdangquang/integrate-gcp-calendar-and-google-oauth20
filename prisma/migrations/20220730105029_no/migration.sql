/*
  Warnings:

  - Added the required column `email` to the `event_attendee` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "event_attendee" DROP CONSTRAINT "event_attendee_user_id_fkey";

-- AlterTable
ALTER TABLE "calendar" ALTER COLUMN "available_end_time" DROP DEFAULT,
ALTER COLUMN "available_start_time" DROP DEFAULT,
ALTER COLUMN "available_week_days" DROP DEFAULT;

-- AlterTable
ALTER TABLE "event_attendee" ADD COLUMN     "email" VARCHAR NOT NULL,
ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "event_attendee" ADD CONSTRAINT "event_attendee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
