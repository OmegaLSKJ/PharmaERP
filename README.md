# PharmaERP

Production-ready pharmaceutical distribution ERP for inventory, batch and expiry tracking, sales, purchases, billing, accounting, GST, compliance, and role-based operations.

Live application: [pharama-erp.vercel.app](https://pharama-erp.vercel.app)

## Technology stack

### Languages used in this repository

| Language | Where it is used |
| --- | --- |
| **TypeScript / TSX** | React user interface, ERP workflows, API routes, validation, reports, and tests |
| **PL/pgSQL** | Supabase/PostgreSQL functions, accounting postings, stock controls, audit workflows, and migrations |
| **CSS** | Responsive design system, blue/green/white theme, print styles, and glass UI effects |
| **JavaScript** | Build tooling and supporting web scripts |
| **Python** | Data-processing and utility scripts |
| **HTML** | Web document and static markup assets |

GitHub calculates the compact Languages card automatically. Smaller languages may appear under **Other**, but every language above is present in the repository and listed here explicitly.

### Platform and libraries

- Next.js, React, TypeScript, Tailwind CSS, and shadcn-style components
- Supabase PostgreSQL, authentication, row-level security, and server-only database access
- Vercel production deployment
- CSV and Excel import workflows

## Major ERP modules

- Master data: parties, items, batches, manufacturers, salts, HSN/SAC, locations, ledgers, and series
- Transactions: sales, purchases, delivery challans, returns, orders, price differences, claims, and counter sales
- Inventory: stock position, movements, ageing, reservations, adjustments, negative stock, expiry, and recalls
- Accounting: vouchers, day books, ledgers, cash flow, trial balance, profit and loss, balance sheet, and GST reports
- Compliance: drug licences, controlled-drug register, prescription controls, and product recalls
- Reports: sales, purchase, inventory, financial, account, debtor, creditor, and management reports

## Verification

The project includes automated tests and a production build check. The production application is deployed through GitHub-to-Vercel continuous deployment.
