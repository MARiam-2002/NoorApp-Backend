CREATE TABLE "zakat_cycles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "assessment" JSONB NOT NULL,
    "dueAmount" DECIMAL(24,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakat_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zakat_payments" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "amount" DECIMAL(24,6) NOT NULL,
    "paidOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zakat_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "charity_reminders" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "localTime" TEXT NOT NULL DEFAULT '12:00',
    "weekdays" JSONB NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charity_reminders_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "charity_send_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "occurrenceKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "charity_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "zakat_cycles_userId_createdAt_idx" ON "zakat_cycles"("userId", "createdAt");

CREATE UNIQUE INDEX "zakat_cycles_userId_requestKey_key" ON "zakat_cycles"("userId", "requestKey");

CREATE INDEX "zakat_payments_cycleId_paidOn_idx" ON "zakat_payments"("cycleId", "paidOn");

CREATE UNIQUE INDEX "zakat_payments_cycleId_requestKey_key" ON "zakat_payments"("cycleId", "requestKey");

CREATE INDEX "charity_send_logs_createdAt_idx" ON "charity_send_logs"("createdAt");

CREATE UNIQUE INDEX "charity_send_logs_userId_occurrenceKey_key" ON "charity_send_logs"("userId", "occurrenceKey");

ALTER TABLE "zakat_cycles" ADD CONSTRAINT "zakat_cycles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "zakat_payments" ADD CONSTRAINT "zakat_payments_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "zakat_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "charity_reminders" ADD CONSTRAINT "charity_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "charity_send_logs" ADD CONSTRAINT "charity_send_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;