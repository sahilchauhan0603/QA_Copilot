-- ============================================
-- Migration: Add Test Management Tool Enums
-- Date: 2026-02-17
-- Description: Adds Xray, Zephyr, and TestRail to integration_type enum
-- ============================================

-- Add new enum values to integration_type
-- Note: PostgreSQL doesn't support adding enum values in a transaction,
-- so this needs to be run separately or with COMMIT after each ALTER

ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'xray';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'zephyr';
ALTER TYPE integration_type ADD VALUE IF NOT EXISTS 'testrail';

-- Verification query (commented out - uncomment to test)
-- SELECT unnest(enum_range(NULL::integration_type))::text;
