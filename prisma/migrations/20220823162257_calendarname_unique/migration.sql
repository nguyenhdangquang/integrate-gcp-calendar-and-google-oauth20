/*
  Warnings:

  - A unique constraint covering the columns `[calendarname_unique]` on the table `calendar` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `calendarname_unique` to the `calendar` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "calendar" ADD COLUMN     "calendarname_unique" VARCHAR;
UPDATE "calendar" SET calendarname_unique = LOWER(REPLACE(name, ' ', ''));
ALTER TABLE "calendar" ALTER COLUMN "calendarname_unique" SET NOT NULL;

