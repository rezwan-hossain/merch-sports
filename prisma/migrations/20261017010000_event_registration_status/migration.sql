-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('OPEN', 'COMING_SOON', 'SOLD_OUT', 'CLOSED');

-- AlterTable: existing events stay open, so nothing changes until an admin edits one.
ALTER TABLE "events" ADD COLUMN     "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'OPEN';
