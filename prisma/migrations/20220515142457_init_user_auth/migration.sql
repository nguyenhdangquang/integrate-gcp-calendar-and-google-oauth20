-- CreateEnum
CREATE TYPE "provider_type" AS ENUM ('google', 'microsoft');

-- CreateTable
CREATE TABLE "language" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" VARCHAR NOT NULL,
    "code" VARCHAR NOT NULL,

    CONSTRAINT "language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "first_name" VARCHAR,
    "last_name" VARCHAR,
    "dob" DATE,
    "email" VARCHAR,
    "phone" VARCHAR,
    "password" VARCHAR,
    "is_active" BOOLEAN DEFAULT true,
    "avatar_url" VARCHAR,
    "selected_language_id" INTEGER,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_authenticator" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "provider_type" "provider_type" NOT NULL,
    "provider_user_id" VARCHAR NOT NULL,
    "access_token" VARCHAR NOT NULL,
    "refresh_token" VARCHAR NOT NULL,
    "id_token" VARCHAR,
    "expires" TIMESTAMP(3),

    CONSTRAINT "external_authenticator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "language_code_key" ON "language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "external_authenticator_user_id_provider_type_provider_user__key" ON "external_authenticator"("user_id", "provider_type", "provider_user_id");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_selected_language_id_fkey" FOREIGN KEY ("selected_language_id") REFERENCES "language"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_authenticator" ADD CONSTRAINT "external_authenticator_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
