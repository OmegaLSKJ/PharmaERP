-- Migration 002: Add missing tables, columns, and views
-- Borgang Drug Distributors ERP
-- Apply in Supabase SQL Editor

-- ─── Missing columns on existing tables ────────────────────────────────────

ALTER TABLE items ADD COLUMN IF NOT EXISTS schedule_class text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS prescription_required boolean NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS cold_chain boolean NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS controlled_substance boolean NOT NULL DEFAULT false;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_recalled boolean NOT NULL DEFAULT false;

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS warehouse_type text NOT NULL DEFAULT 'Store Room';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS capacity numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE salts ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE salts ADD COLUMN IF NOT EXISTS composition text;
ALTER TABLE salts ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS account_group text NOT NULL DEFAULT 'General';
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) NOT NULL DEFAULT 0;

-- ─── Missing tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES organizations(id),
  financial_year_id      uuid NOT NULL REFERENCES financial_years(id),
  party_id               uuid NOT NULL REFERENCES parties(id),
  invoice_number         text NOT NULL,
  supplier_invoice_number text,
  invoice_date           date NOT NULL,
  status                 document_status NOT NULL DEFAULT 'draft',
  subtotal               numeric(14,2) NOT NULL DEFAULT 0,
  discount_total         numeric(14,2) NOT NULL DEFAULT 0,
  tax_total              numeric(14,2) NOT NULL DEFAULT 0,
  grand_total            numeric(14,2) NOT NULL DEFAULT 0,
  voucher_id             uuid UNIQUE REFERENCES vouchers(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, financial_year_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id       uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  item_id          uuid NOT NULL REFERENCES items(id),
  item_batch_id    uuid REFERENCES item_batches(id),
  quantity         numeric(14,3) NOT NULL CHECK (quantity > 0),
  free_quantity    numeric(14,3) NOT NULL DEFAULT 0,
  rate             numeric(14,2) NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  gst_rate         numeric(5,2) NOT NULL DEFAULT 0,
  line_total       numeric(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS document_series (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations(id),
  document_type        text NOT NULL,
  prefix               text NOT NULL DEFAULT '',
  suffix               text,
  next_number          integer NOT NULL DEFAULT 1,
  padding              integer NOT NULL DEFAULT 4,
  financial_year_reset boolean NOT NULL DEFAULT true,
  is_active            boolean NOT NULL DEFAULT true,
  UNIQUE (organization_id, document_type)
);

CREATE TABLE IF NOT EXISTS business_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  document_type   text NOT NULL,
  document_number text NOT NULL,
  document_date   date NOT NULL,
  party_id        uuid REFERENCES parties(id),
  status          document_status NOT NULL DEFAULT 'draft',
  total           numeric(14,2) NOT NULL DEFAULT 0,
  details         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, document_type, document_number)
);

CREATE TABLE IF NOT EXISTS communication_blocks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  channel         text NOT NULL,
  destination     text NOT NULL,
  reason          text,
  blocked_on      date NOT NULL DEFAULT CURRENT_DATE
);

-- ─── Indexes for new tables ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_org_date   ON purchase_invoices (organization_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_party      ON purchase_invoices (party_id);
CREATE INDEX IF NOT EXISTS idx_business_docs_org_type       ON business_documents (organization_id, document_type, document_date DESC);
CREATE INDEX IF NOT EXISTS idx_doc_series_org               ON document_series (organization_id, document_type);

-- ─── Required views ──────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW erp_stock_position AS
SELECT
  sm.organization_id,
  i.name            AS item_name,
  ib.batch_number,
  ib.expiry_on,
  w.name            AS warehouse_name,
  i.schedule_class,
  i.is_recalled,
  ib.mrp,
  i.purchase_rate,
  SUM(sm.quantity)  AS quantity,
  0::numeric        AS reserved_quantity
FROM stock_movements sm
JOIN item_batches ib ON ib.id = sm.item_batch_id
JOIN items        i  ON i.id  = ib.item_id
JOIN warehouses   w  ON w.id  = sm.warehouse_id
GROUP BY
  sm.organization_id,
  i.name, ib.batch_number, ib.expiry_on,
  w.name, i.schedule_class, i.is_recalled,
  ib.mrp, i.purchase_rate;

CREATE OR REPLACE VIEW erp_trial_balance AS
SELECT
  coa.organization_id,
  coa.name,
  coa.account_group,
  COALESCE(SUM(vl.debit),  0) + GREATEST(coa.opening_balance,  0) AS debit,
  COALESCE(SUM(vl.credit), 0) + GREATEST(-coa.opening_balance, 0) AS credit,
  coa.opening_balance + COALESCE(SUM(vl.debit) - SUM(vl.credit), 0) AS balance
FROM chart_of_accounts coa
LEFT JOIN voucher_lines vl ON vl.account_id = coa.id
GROUP BY
  coa.organization_id,
  coa.id,
  coa.name,
  coa.account_group,
  coa.opening_balance;

-- ─── Seed default document series for Borgang Drug Distributors ──────────────
-- Run after organizations row exists. Idempotent via ON CONFLICT DO NOTHING.

INSERT INTO document_series (organization_id, document_type, prefix, padding, next_number)
SELECT o.id, s.document_type, s.prefix, s.padding, 1
FROM organizations o,
  (VALUES
    ('Sale Invoice',      'SI-', 4),
    ('Sale Return',       'SR-', 3),
    ('Purchase Bill',     'PB-', 4),
    ('Purchase Return',   'PR-', 3),
    ('Challan',           'CH-', 4),
    ('Credit Note',       'CN-', 3),
    ('Debit Note',        'DN-', 3),
    ('Sales Order',       'SO-', 3),
    ('Purchase Order',    'PO-', 3)
  ) AS s(document_type, prefix, padding)
WHERE o.name = 'Borgang Drug Distributors'
ON CONFLICT (organization_id, document_type) DO NOTHING;
