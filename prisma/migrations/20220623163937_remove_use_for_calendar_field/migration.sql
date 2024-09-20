/*
  Warnings:

  - You are about to drop the column `use_for_calendar` on the `external_authenticator` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "external_authenticator" DROP COLUMN "use_for_calendar";
