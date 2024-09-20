/*
  Warnings:

  - You are about to drop the column `expires` on the `external_authenticator` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "external_authenticator" DROP COLUMN "expires";
