-- CreateEnum
CREATE TYPE "gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "gender" "gender";
