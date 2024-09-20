/*
  Warnings:

  - A unique constraint covering the columns `[username_unique]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `metadata` to the `event` table without a default value. This is not possible if the table is not empty.

*/

-- AlterTable
ALTER TABLE "event" ADD COLUMN     "metadata" JSONB;
