-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "labels_per_unit" INTEGER NOT NULL,
    "base_price" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_mappings" (
    "id" SERIAL NOT NULL,
    "marketplace_sku" TEXT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "color_variant" TEXT,
    "size_variant" TEXT,
    "platform" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "sku_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "meesho_supplier_id" TEXT,
    "meesho_username" TEXT,
    "meesho_password" TEXT,
    "meesho_sync_status" TEXT,
    "meesho_sync_error" TEXT,
    "meesho_last_sync" TIMESTAMP(3),
    "flipkart_supplier_id" TEXT,
    "flipkart_username" TEXT,
    "flipkart_password" TEXT,
    "flipkart_sync_status" TEXT,
    "flipkart_sync_error" TEXT,
    "flipkart_last_sync" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_prices" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "account_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_records" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "account_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "marketplace_sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "labels_total" INTEGER NOT NULL,
    "revenue" BIGINT NOT NULL,
    "source_pdf_name" TEXT NOT NULL,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_imports" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "account_id" INTEGER NOT NULL,
    "import_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "records_extracted" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_skus" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "marketplace_sku" TEXT NOT NULL,
    "product_id" INTEGER,
    "title" TEXT,
    "color_variant" TEXT,
    "size_variant" TEXT,
    "catalog_id" TEXT,
    "catalog_name" TEXT,
    "style_id" TEXT,
    "image_url" TEXT,
    "price" INTEGER,
    "inventory" INTEGER,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_skus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "sku_mappings_marketplace_sku_key" ON "sku_mappings"("marketplace_sku");

-- CreateIndex
CREATE UNIQUE INDEX "account_prices_account_id_product_id_key" ON "account_prices"("account_id", "product_id");

-- CreateIndex
CREATE INDEX "sales_records_account_id_idx" ON "sales_records"("account_id");

-- CreateIndex
CREATE INDEX "sales_records_date_idx" ON "sales_records"("date");

-- CreateIndex
CREATE INDEX "sales_records_order_id_idx" ON "sales_records"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_imports_filename_account_id_key" ON "pdf_imports"("filename", "account_id");

-- CreateIndex
CREATE UNIQUE INDEX "imported_skus_account_id_marketplace_sku_key" ON "imported_skus"("account_id", "marketplace_sku");

-- AddForeignKey
ALTER TABLE "sku_mappings" ADD CONSTRAINT "sku_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_prices" ADD CONSTRAINT "account_prices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_prices" ADD CONSTRAINT "account_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_records" ADD CONSTRAINT "sales_records_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_imports" ADD CONSTRAINT "pdf_imports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_skus" ADD CONSTRAINT "imported_skus_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_skus" ADD CONSTRAINT "imported_skus_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
