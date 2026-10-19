-- AlterTable: add CJ fields to Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cjPid" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cjVariantId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Product_cjPid_key" ON "Product"("cjPid");

-- AlterTable: add CJ order ID to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cjOrderId" TEXT;
