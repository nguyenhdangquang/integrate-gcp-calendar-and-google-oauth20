-- AlterTable
ALTER TABLE "user" ADD COLUMN     "reset_pass_token" TEXT NOT NULL DEFAULT E'',
ADD COLUMN     "reset_pass_token_sent_at" TIMESTAMP(3);
