/*
  Warnings:

  - You are about to drop the column `target_id` on the `calendar_visibility` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "calendar_visibility" DROP CONSTRAINT "calendar_visibility_target_id_fkey";

-- DropIndex
DROP INDEX "calendar_visibility_source_id_target_id_key";

-- DropIndex
DROP INDEX "calendar_visibility_target_id_key";

-- AlterTable
ALTER TABLE "calendar_visibility" DROP COLUMN "target_id";
