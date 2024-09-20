/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `calendar` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN "username_unique" VARCHAR;
UPDATE "user" SET username_unique = LOWER(REPLACE("display_name", ' ', ''));
-- CreateIndex
CREATE UNIQUE INDEX "calendar_name_key" ON "calendar"("name");
