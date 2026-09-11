CREATE TYPE "VerificationChannel" AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE "VerificationPurpose" AS ENUM ('ACCOUNT_VERIFY');

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3), ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = "verifiedAt" WHERE "verifiedAt" IS NOT NULL;
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

CREATE TABLE "VerificationOtp" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "VerificationChannel" NOT NULL,
  "purpose" "VerificationPurpose" NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationOtp_userId_purpose_channel_createdAt_idx" ON "VerificationOtp"("userId", "purpose", "channel", "createdAt");
CREATE INDEX "VerificationOtp_expiresAt_idx" ON "VerificationOtp"("expiresAt");
ALTER TABLE "VerificationOtp" ADD CONSTRAINT "VerificationOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
