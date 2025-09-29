-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('Pending', 'InReview', 'Approved', 'Declined', 'Abandoned');

-- CreateEnum
CREATE TYPE "user_address_type" AS ENUM ('billing', 'shipping', 'home', 'office');

-- CreateEnum
CREATE TYPE "quotation_status" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled', 'not_selected');

-- CreateEnum
CREATE TYPE "counter_offer_status" AS ENUM ('pending', 'accepted', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled', 'in_progress', 'rescheduled');

-- CreateEnum
CREATE TYPE "service_request_status" AS ENUM ('receiving_offers', 'receiving_applications', 'offer_accepted', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "request_type" AS ENUM ('quotation_based', 'fixed_price');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('pending', 'selected', 'rejected');

-- CreateEnum
CREATE TYPE "commission_service_type" AS ENUM ('quotation_based', 'fixed_price');

-- CreateEnum
CREATE TYPE "modality_type" AS ENUM ('remote', 'in_person', 'hybrid');

-- CreateEnum
CREATE TYPE "category_parameter_type" AS ENUM ('text', 'number', 'boolean', 'select');

-- CreateEnum
CREATE TYPE "pricing_type" AS ENUM ('per_hour', 'per_day', 'per_job');

-- CreateEnum
CREATE TYPE "availability_type" AS ENUM ('immediate', 'next_day', 'in_days');

-- CreateEnum
CREATE TYPE "wallet_transaction_type" AS ENUM ('payment_received', 'withdrawal', 'refund', 'top_up', 'adjustment');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('pending', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "verification_channel" AS ENUM ('didit', 'manual');

-- CreateEnum
CREATE TYPE "commission_payment_status" AS ENUM ('pending', 'partial_paid', 'fully_paid', 'overdue', 'waived');

-- CreateEnum
CREATE TYPE "incident_type" AS ENUM ('accident', 'emergency', 'delay', 'inconsistency', 'other');

-- CreateEnum
CREATE TYPE "incident_severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role_id" INTEGER NOT NULL,
    "name" TEXT,
    "lastname" TEXT,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "gender" "gender",
    "password_hash" TEXT,
    "username" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_login" TIMESTAMP(3),
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Valledupar',
    "state" TEXT NOT NULL DEFAULT 'Cesar',
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Colombia',
    "type" "user_address_type" NOT NULL DEFAULT 'home',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "label" TEXT,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_verifications" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified_at" TIMESTAMP(3),
    "email_verified_at" TIMESTAMP(3),
    "last_verification_sent" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intrabbler_profiles" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "profession" TEXT NOT NULL,
    "bio" TEXT,
    "rating_avg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intrabbler_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifiable_documents" (
    "id" SERIAL NOT NULL,
    "intrabbler_profile_id" INTEGER NOT NULL,
    "document_type_id" INTEGER NOT NULL,
    "document_url" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'Pending',
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3),
    "verification_channel" "verification_channel" NOT NULL DEFAULT 'manual',
    "didit_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifiable_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "service_coverage" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "icon_url" TEXT,
    "cover_photo_url" TEXT,
    "parent_id" INTEGER,
    "has_fixed_price" BOOLEAN NOT NULL DEFAULT false,
    "fixed_price_amount" DECIMAL(65,30),
    "price_currency" TEXT NOT NULL DEFAULT 'COP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" SERIAL NOT NULL,
    "client_id" UUID NOT NULL,
    "service_category_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "location_address_id" INTEGER,
    "description" TEXT,
    "preferred_date" TIMESTAMP(3),
    "status" "service_request_status" NOT NULL DEFAULT 'receiving_offers',
    "accepted_counter_offer_id" INTEGER,
    "initial_budget_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "request_type" "request_type" NOT NULL DEFAULT 'quotation_based',
    "amount" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_images" (
    "id" SERIAL NOT NULL,
    "service_request_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "image_order" INTEGER NOT NULL DEFAULT 1,
    "alt_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_request_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_parameters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parameter_type" "category_parameter_type" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "options_json" JSONB,
    "min_value" DOUBLE PRECISION,
    "max_value" DOUBLE PRECISION,
    "service_category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_parameter_values" (
    "id" SERIAL NOT NULL,
    "service_request_id" INTEGER NOT NULL,
    "category_parameter_id" INTEGER NOT NULL,
    "value_number" DOUBLE PRECISION,
    "value_text" TEXT,
    "value_boolean" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_parameter_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimated_prices_quotations" (
    "id" SERIAL NOT NULL,
    "estimated_unit_quantity" DOUBLE PRECISION NOT NULL,
    "estimated_unit_price" DOUBLE PRECISION NOT NULL,
    "estimated_total" DOUBLE PRECISION NOT NULL,
    "pricing_type" "pricing_type" NOT NULL,
    "additional_costs" DOUBLE PRECISION DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimated_prices_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initial_budgets" (
    "id" SERIAL NOT NULL,
    "budget_unit_quantity" DOUBLE PRECISION NOT NULL,
    "budget_unit_price" DOUBLE PRECISION NOT NULL,
    "budget_total" DOUBLE PRECISION NOT NULL,
    "pricing_type" "pricing_type" NOT NULL,
    "additional_costs" DOUBLE PRECISION DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initial_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "status" "quotation_status" NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "estimated_distance_km" DOUBLE PRECISION,
    "availability_type" "availability_type" NOT NULL,
    "availability_in_days" INTEGER DEFAULT 0,
    "service_request_id" INTEGER NOT NULL,
    "intrabbler_id" UUID NOT NULL,
    "estimated_price_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_offers" (
    "id" SERIAL NOT NULL,
    "service_request_id" INTEGER NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "parent_counter_offer_id" INTEGER,
    "offered_by_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "message" TEXT,
    "status" "counter_offer_status" NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counter_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_appointments" (
    "id" SERIAL NOT NULL,
    "appointment_date" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "order_status" NOT NULL DEFAULT 'pending',
    "modality" "modality_type" NOT NULL DEFAULT 'in_person',
    "cancelation_reason" TEXT,
    "cancelation_at" TIMESTAMP(3),
    "client_id" UUID NOT NULL,
    "intrabbler_id" UUID NOT NULL,
    "service_request_id" INTEGER NOT NULL,
    "location_address_id" INTEGER NOT NULL,
    "quotation_id" INTEGER,
    "application_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_incidents" (
    "id" SERIAL NOT NULL,
    "appointment_id" INTEGER NOT NULL,
    "reported_by" UUID NOT NULL,
    "incident_type" "incident_type" NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "incident_severity" NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "resolution_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "service_appointment_id" INTEGER NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" "wallet_transaction_type" NOT NULL,
    "description" TEXT,
    "status" "transaction_status" NOT NULL DEFAULT 'pending',
    "transaction_id" TEXT NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "payment_method_id" INTEGER,
    "related_service_appointment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_services_offered" (
    "id" SERIAL NOT NULL,
    "intrabbler_profile_id" INTEGER NOT NULL,
    "service_category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_services_offered_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_records" (
    "id" SERIAL NOT NULL,
    "service_appointment_id" INTEGER NOT NULL,
    "commission_percentage_due" DOUBLE PRECISION NOT NULL,
    "commission_amount_due" DOUBLE PRECISION NOT NULL,
    "commission_percentage_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commission_amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_paid_full" BOOLEAN NOT NULL DEFAULT false,
    "payment_status" "commission_payment_status" NOT NULL DEFAULT 'pending',
    "due_date" TIMESTAMP(3),
    "first_payment_at" TIMESTAMP(3),
    "fully_paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payments" (
    "id" SERIAL NOT NULL,
    "commission_record_id" INTEGER NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL,
    "percentage_paid" DOUBLE PRECISION NOT NULL,
    "payment_method_id" INTEGER NOT NULL,
    "wallet_transaction_id" INTEGER NOT NULL,
    "processed_by_id" UUID,
    "processed_automatically" BOOLEAN NOT NULL DEFAULT false,
    "processing_system" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" SERIAL NOT NULL,
    "service_request_id" INTEGER NOT NULL,
    "intrabbler_id" UUID NOT NULL,
    "message" TEXT,
    "status" "application_status" NOT NULL DEFAULT 'pending',
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ally_availability" (
    "id" SERIAL NOT NULL,
    "intrabbler_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ally_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_settings" (
    "id" SERIAL NOT NULL,
    "service_type" "commission_service_type" NOT NULL,
    "commission_percentage" DECIMAL(65,30) NOT NULL,
    "min_commission_amount" DECIMAL(65,30),
    "max_commission_amount" DECIMAL(65,30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "fcm_token" TEXT NOT NULL,
    "expo_token" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "device_id" TEXT,
    "app_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_notifications" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "notification_type" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_method" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "failed_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "document_types_name_key" ON "document_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_verifications_user_id_key" ON "user_verifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "intrabbler_profiles_user_id_key" ON "intrabbler_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verifiable_documents_document_type_id_key" ON "verifiable_documents"("document_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_name_idx" ON "service_categories"("name");

-- CreateIndex
CREATE INDEX "service_categories_is_active_idx" ON "service_categories"("is_active");

-- CreateIndex
CREATE INDEX "service_categories_parent_id_idx" ON "service_categories"("parent_id");

-- CreateIndex
CREATE INDEX "service_categories_name_is_active_idx" ON "service_categories"("name", "is_active");

-- CreateIndex
CREATE INDEX "service_categories_has_fixed_price_idx" ON "service_categories"("has_fixed_price");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_accepted_counter_offer_id_key" ON "service_requests"("accepted_counter_offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_initial_budget_id_key" ON "service_requests"("initial_budget_id");

-- CreateIndex
CREATE INDEX "service_requests_request_type_idx" ON "service_requests"("request_type");

-- CreateIndex
CREATE UNIQUE INDEX "category_parameters_code_key" ON "category_parameters"("code");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_estimated_price_id_key" ON "quotations"("estimated_price_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_appointments_service_request_id_key" ON "service_appointments"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_appointments_quotation_id_key" ON "service_appointments"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_appointments_application_id_key" ON "service_appointments"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_transaction_id_key" ON "wallet_transactions"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_records_service_appointment_id_key" ON "commission_records"("service_appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_payments_wallet_transaction_id_key" ON "commission_payments"("wallet_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "applications_service_request_id_intrabbler_id_key" ON "applications"("service_request_id", "intrabbler_id");

-- CreateIndex
CREATE UNIQUE INDEX "ally_availability_intrabbler_id_day_of_week_start_time_end__key" ON "ally_availability"("intrabbler_id", "day_of_week", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_fcm_token_key" ON "device_tokens"("fcm_token");

-- CreateIndex
CREATE INDEX "device_tokens_user_id_idx" ON "device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "device_tokens_is_active_idx" ON "device_tokens"("is_active");

-- CreateIndex
CREATE INDEX "failed_notifications_user_id_idx" ON "failed_notifications"("user_id");

-- CreateIndex
CREATE INDEX "failed_notifications_is_resolved_idx" ON "failed_notifications"("is_resolved");

-- CreateIndex
CREATE INDEX "failed_notifications_next_retry_at_idx" ON "failed_notifications"("next_retry_at");

-- CreateIndex
CREATE INDEX "failed_notifications_notification_type_idx" ON "failed_notifications"("notification_type");

-- CreateIndex
CREATE INDEX "failed_notifications_priority_idx" ON "failed_notifications"("priority");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verifications" ADD CONSTRAINT "user_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intrabbler_profiles" ADD CONSTRAINT "intrabbler_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiable_documents" ADD CONSTRAINT "verifiable_documents_intrabbler_profile_id_fkey" FOREIGN KEY ("intrabbler_profile_id") REFERENCES "intrabbler_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiable_documents" ADD CONSTRAINT "verifiable_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiable_documents" ADD CONSTRAINT "verifiable_documents_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_location_address_id_fkey" FOREIGN KEY ("location_address_id") REFERENCES "user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_accepted_counter_offer_id_fkey" FOREIGN KEY ("accepted_counter_offer_id") REFERENCES "counter_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_initial_budget_id_fkey" FOREIGN KEY ("initial_budget_id") REFERENCES "initial_budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_images" ADD CONSTRAINT "service_request_images_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_parameters" ADD CONSTRAINT "category_parameters_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_parameter_values" ADD CONSTRAINT "request_parameter_values_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_parameter_values" ADD CONSTRAINT "request_parameter_values_category_parameter_id_fkey" FOREIGN KEY ("category_parameter_id") REFERENCES "category_parameters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_intrabbler_id_fkey" FOREIGN KEY ("intrabbler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_estimated_price_id_fkey" FOREIGN KEY ("estimated_price_id") REFERENCES "estimated_prices_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_parent_counter_offer_id_fkey" FOREIGN KEY ("parent_counter_offer_id") REFERENCES "counter_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_offers" ADD CONSTRAINT "counter_offers_offered_by_id_fkey" FOREIGN KEY ("offered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_intrabbler_id_fkey" FOREIGN KEY ("intrabbler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_location_address_id_fkey" FOREIGN KEY ("location_address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_appointments" ADD CONSTRAINT "service_appointments_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_incidents" ADD CONSTRAINT "appointment_incidents_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "service_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_incidents" ADD CONSTRAINT "appointment_incidents_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_incidents" ADD CONSTRAINT "appointment_incidents_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_appointment_id_fkey" FOREIGN KEY ("service_appointment_id") REFERENCES "service_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_related_service_appointment_id_fkey" FOREIGN KEY ("related_service_appointment_id") REFERENCES "service_appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_services_offered" ADD CONSTRAINT "professional_services_offered_intrabbler_profile_id_fkey" FOREIGN KEY ("intrabbler_profile_id") REFERENCES "intrabbler_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_services_offered" ADD CONSTRAINT "professional_services_offered_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_records" ADD CONSTRAINT "commission_records_service_appointment_id_fkey" FOREIGN KEY ("service_appointment_id") REFERENCES "service_appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_commission_record_id_fkey" FOREIGN KEY ("commission_record_id") REFERENCES "commission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_wallet_transaction_id_fkey" FOREIGN KEY ("wallet_transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payments" ADD CONSTRAINT "commission_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_intrabbler_id_fkey" FOREIGN KEY ("intrabbler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ally_availability" ADD CONSTRAINT "ally_availability_intrabbler_id_fkey" FOREIGN KEY ("intrabbler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "failed_notifications" ADD CONSTRAINT "failed_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
