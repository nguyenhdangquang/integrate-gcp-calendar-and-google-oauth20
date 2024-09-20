/*
  Warnings:

  - Added the required column `available_end_time` to the `calendar` table without a default value. This is not possible if the table is not empty.
  - Added the required column `available_start_time` to the `calendar` table without a default value. This is not possible if the table is not empty.
  - Added the required column `available_week_days` to the `calendar` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "calendar" ADD COLUMN     "available_end_time" TIME NOT NULL DEFAULT '17:00:00',
ADD COLUMN     "available_start_time" TIME NOT NULL DEFAULT '09:00:00',
ADD COLUMN     "available_week_days" SMALLINT NOT NULL DEFAULT 31;
