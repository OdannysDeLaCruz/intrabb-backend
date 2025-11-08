/*
  Warnings:

  - A unique constraint covering the columns `[document_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "document_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_document_number_key" ON "users"("document_number");
