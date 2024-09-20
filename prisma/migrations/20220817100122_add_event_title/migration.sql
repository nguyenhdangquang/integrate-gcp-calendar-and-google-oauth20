-- AlterTable
ALTER TABLE "event" ADD COLUMN     "title" TEXT,
ALTER COLUMN "details" DROP NOT NULL;
