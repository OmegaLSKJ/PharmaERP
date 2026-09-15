-- 018_import_marg_accounting_groups.sql
-- Imports 74 Marg ERP Accounting Groups into public.account_groups and enriches public.chart_of_accounts


CREATE TABLE IF NOT EXISTS public.account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  nature text NOT NULL,
  normal_balance text NOT NULL DEFAULT 'Dr',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_groups_org_code_uniq UNIQUE (organization_id, code),
  CONSTRAINT account_groups_org_name_uniq UNIQUE (organization_id, name)
);

ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'account_groups' AND policyname = 'account_groups_org_isolation'
  ) THEN
    CREATE POLICY account_groups_org_isolation ON public.account_groups
      FOR ALL
      USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
  END IF;
END $$;

-- Add new enriched columns to chart_of_accounts
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS account_group_id uuid REFERENCES public.account_groups(id) ON DELETE SET NULL;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS category text DEFAULT 'Asset';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS nature text DEFAULT 'General';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS normal_balance text DEFAULT 'Dr';
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS marg_group_name text;

DO $$
DECLARE
  org_rec RECORD;
  v_grp_id uuid;
BEGIN
  FOR org_rec IN SELECT id FROM public.organizations LOOP

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-BANKACCO', 'BANK ACCOUNTS', 'Asset', 'Liquid Assets', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-BANKOCCA', 'BANK OCC A/C', 'Liability', 'Bank Borrowings / Overdraft', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-BRANCHDI', 'BRANCH / DIVISIONS', 'Liability', 'Inter-Branch / Divisions', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-CAPITALA', 'CAPITAL ACCOUNT', 'Liability', 'Capital', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-CAPITALW', 'CAPITAL WORK-IN-PROGRESS', 'Asset', 'Fixed Assets in Progress', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-CASHINHA', 'CASH-IN-HAND', 'Asset', 'Cash & Cash Equivalents', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-CURRENTA', 'CURRENT ASSETS', 'Asset', 'Current Assets', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-CURRENTI', 'CURRENT INVESTMENTS', 'Asset', 'Short-Term Investments', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-CURRENTL', 'CURRENT LIABILITIES', 'Liability', 'Current Liabilities', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-DEFERRED', 'DEFERRED TAX ASSET', 'Asset', 'Deferred Taxes', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-DEFERRED', 'DEFERRED TAX LIABILITY', 'Liability', 'Deferred Taxes', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-DUTIESTA', 'DUTIES & TAXES', 'Liability', 'Statutory Taxes & Duties', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-EMPLOYEE', 'EMPLOYEE BENEFIT EXPENSE', 'Expense', 'Indirect Expenses', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-EXCEPTIO', 'EXCEPTIONAL ITEMS', 'Expense', 'P&L Extraordinary Items', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-EXPENDIT', 'EXPENDITURE ACCOUNT', 'Expense', 'Operational Expenditure', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-EXPENSES', 'EXPENSES (Direct) (Mfg./Trdg. Expenses)', 'Expense', 'Direct Trading & Mfg Expenses', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-EXPENSES', 'EXPENSES (Indirect) (Admin. Expenses)', 'Expense', 'Indirect & Administrative Expenses', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-EXTRAORD', 'EXTRAORDINARY ITEMS', 'Income', 'P&L Extraordinary Items', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-FINANCIA', 'FINANCIAL COSTS', 'Expense', 'Bank Charges & Interest', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-FIXEDASS', 'FIXED ASSETS', 'Asset', 'Property, Plant & Equipment', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-INCOMEDI', 'INCOME (Direct)', 'Income', 'Direct Operating Income', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-INCOMEIN', 'INCOME (Indirect)', 'Income', 'Indirect / Other Income', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-INTANGIB', 'INTANGIBLE ASSETS', 'Asset', 'Intangible Assets', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-INTANGIB', 'INTANGIBLE ASSETS UNDER DEVELOPMENT', 'Asset', 'Intangibles in Progress', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-INVESTME', 'INVESTMENTS', 'Asset', 'Non-Current Investments', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-LOANADVA', 'LOAN & ADVANCES (Asset)', 'Asset', 'Loans & Advances Extended', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-LOANSLIA', 'LOANS (Liability)', 'Liability', 'Borrowings & Loans', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-LONGTERM', 'LONG TERM PROVISIONS', 'Liability', 'Non-Current Provisions', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-LONGTERM', 'LONG-TERM BORROWINGS', 'Liability', 'Non-Current Borrowings', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-MISCEXPE', 'MISC. EXPENSES (Asset)', 'Asset', 'Fictitious & Deferred Assets', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-MONEYREC', 'MONEY RECEIVED AGAINST SHARE WARRANTS', 'Liability', 'Shareholders Funds', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-NONREFUN', 'NON REFUNDABLE TAXES', 'Expense', 'Non-Creditable Tax Expense', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-NONCURRE', 'NON-CURRENT INVESTMENTS', 'Asset', 'Long-Term Investments', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-NONCURRE', 'NON-CURRENT LIABILITIES', 'Liability', 'Long-Term Liabilities', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-OTHERCUR', 'OTHER CURRENT ASSETS', 'Asset', 'Other Current Assets', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-OTHERCUR', 'OTHER CURRENT LIABILITIES', 'Liability', 'Other Current Liabilities', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-OTHERDUT', 'OTHER DUTIES & TAXES', 'Liability', 'Statutory Taxes', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-OTHERLON', 'OTHER LONG-TERM LIABILITIES', 'Liability', 'Long-Term Liabilities', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-OTHERNON', 'OTHER NON-CURRENT ASSETS', 'Asset', 'Long-Term Receivables & Deposits', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-PROFITLO', 'PROFIT & LOSS A/C', 'Liability', 'Reserves & Surplus', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-PROVISIO', 'PROVISIONS', 'Liability', 'Provisions', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-PURCHASE', 'PURCHASE ACCOUNT', 'Expense', 'Trading / Purchases', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-PURCHASE', 'PURCHASE CENTRAL', 'Expense', 'Interstate Purchases (IGST)', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-PURCHASE', 'PURCHASE IMPORT', 'Expense', 'Import Purchases', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-PURCHASE', 'PURCHASE LOCAL', 'Expense', 'Intrastate Purchases (CGST/SGST)', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-RESERVES', 'RESERVES & SURPLUS', 'Liability', 'Retained Earnings & Reserves', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-REVENUEA', 'REVENUE ACCOUNT', 'Income', 'Operating Revenue', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SALESACC', 'SALES ACCOUNT', 'Income', 'Trading / Sales', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SALESCEN', 'SALES CENTRAL', 'Income', 'Interstate Sales (IGST)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SALESEXP', 'SALES EXPORT', 'Income', 'Export Sales', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SALESLOC', 'SALES LOCAL', 'Income', 'Intrastate Sales (CGST/SGST)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SECUREDL', 'SECURED LOANS', 'Liability', 'Secured Bank Borrowings', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SECURITY', 'SECURITY & DEPOSIT (Asset)', 'Asset', 'Security & Rental Deposits', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SHAREAPP', 'SHARE APPLICATION MONEY PENDING ALLOT', 'Liability', 'Share Capital', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SHARECAP', 'SHARE CAPITAL', 'Liability', 'Equity / Share Capital', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SHORTTER', 'SHORT-TERM BORROWINGS', 'Liability', 'Short-Term Loans', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SHORTTER', 'SHORT-TERM LOANS & ADVANCES', 'Asset', 'Current Loans & Advances', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SHORTTER', 'SHORT-TERM PROVISIONS', 'Liability', 'Current Provisions', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-STOCKINH', 'STOCK-IN-HAND', 'Asset', 'Inventory / Stock', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYCR', 'SUNDRY CREDITORS', 'Liability', 'Trade Payables (General)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYCR', 'SUNDRY CREDITORS (E-COMMERCE)', 'Liability', 'Trade Payables (E-Commerce)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYCR', 'SUNDRY CREDITORS (EXPENSES PAYABLE)', 'Liability', 'Expense Creditors', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYCR', 'SUNDRY CREDITORS (FIELD STAFF)', 'Liability', 'Staff & Rep Payables', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYCR', 'SUNDRY CREDITORS (MANUFACTURERS)', 'Liability', 'Trade Payables (Pharma Manufacturers)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYCR', 'SUNDRY CREDITORS (SUPPLIERS)', 'Liability', 'Trade Payables (Stockists & Distributors)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYDE', 'SUNDRY DEBTORS', 'Asset', 'Trade Receivables (General)', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYDE', 'SUNDRY DEBTORS (E-COMMERCE)', 'Asset', 'Trade Receivables (Online / E-Commerce)', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUNDRYDE', 'SUNDRY DEBTORS (FIELD STAFF)', 'Asset', 'Staff & Field Imprests', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-SUSPENSE', 'SUSPENSE ACCOUNT (Temporary A/cs)', 'Liability', 'Suspense / Clearing Accounts', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-TANGIBLE', 'TANGIBLE ASSETS', 'Asset', 'Tangible Plant & Equipment', 'Dr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-TAXCGST', 'TAX - CGST', 'Liability', 'Goods & Services Tax (Central)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-TAXIGST', 'TAX - IGST', 'Liability', 'Goods & Services Tax (Integrated)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-TAXSGST', 'TAX - SGST', 'Liability', 'Goods & Services Tax (State)', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;

    INSERT INTO public.account_groups (organization_id, code, name, category, nature, normal_balance, is_active)
    VALUES (org_rec.id, 'GRP-UNSECURE', 'UNSECURED LOANS', 'Liability', 'Unsecured Loans & Advances', 'Cr', true)
    ON CONFLICT (organization_id, name) DO UPDATE
    SET code = EXCLUDED.code, category = EXCLUDED.category, nature = EXCLUDED.nature, normal_balance = EXCLUDED.normal_balance, is_active = true
    RETURNING id INTO v_grp_id;


    -- Link existing chart_of_accounts entries to their corresponding account_groups
    UPDATE public.chart_of_accounts c
    SET account_group_id = g.id,
        category = g.category,
        nature = g.nature,
        normal_balance = g.normal_balance,
        marg_group_name = g.name
    FROM public.account_groups g
    WHERE g.organization_id = org_rec.id
      AND c.organization_id = org_rec.id
      AND UPPER(TRIM(c.account_group)) = UPPER(TRIM(g.name));

    -- Seed standard system ledgers mapped to essential Marg groups
    INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, account_group, opening_balance, is_active, normal_balance)
    VALUES
      (org_rec.id, 'ACC-CASH', 'Cash-in-Hand Account', 'asset', 'CASH-IN-HAND', 0, true, 'Dr'),
      (org_rec.id, 'ACC-BANK', 'Main Bank Account', 'asset', 'BANK ACCOUNTS', 0, true, 'Dr'),
      (org_rec.id, 'ACC-SALES-LOC', 'Sales (Intrastate Local)', 'income', 'SALES LOCAL', 0, true, 'Cr'),
      (org_rec.id, 'ACC-SALES-CEN', 'Sales (Interstate Central)', 'income', 'SALES CENTRAL', 0, true, 'Cr'),
      (org_rec.id, 'ACC-PURC-LOC', 'Purchases (Intrastate Local)', 'expense', 'PURCHASE LOCAL', 0, true, 'Dr'),
      (org_rec.id, 'ACC-PURC-CEN', 'Purchases (Interstate Central)', 'expense', 'PURCHASE CENTRAL', 0, true, 'Dr'),
      (org_rec.id, 'ACC-CGST-OUT', 'Output CGST Account', 'liability', 'TAX - CGST', 0, true, 'Cr'),
      (org_rec.id, 'ACC-SGST-OUT', 'Output SGST Account', 'liability', 'TAX - SGST', 0, true, 'Cr'),
      (org_rec.id, 'ACC-IGST-OUT', 'Output IGST Account', 'liability', 'TAX - IGST', 0, true, 'Cr'),
      (org_rec.id, 'ACC-CGST-IN', 'Input CGST Credit Account', 'asset', 'TAX - CGST', 0, true, 'Dr'),
      (org_rec.id, 'ACC-SGST-IN', 'Input SGST Credit Account', 'asset', 'TAX - SGST', 0, true, 'Dr'),
      (org_rec.id, 'ACC-IGST-IN', 'Input IGST Credit Account', 'asset', 'TAX - IGST', 0, true, 'Dr'),
      (org_rec.id, 'ACC-STOCK', 'Stock-in-Hand Inventory Valuation', 'asset', 'STOCK-IN-HAND', 3885587.14, true, 'Dr')
    ON CONFLICT (organization_id, code) DO UPDATE
    SET name = EXCLUDED.name, account_group = EXCLUDED.account_group, normal_balance = EXCLUDED.normal_balance;

  END LOOP;
END $$;
