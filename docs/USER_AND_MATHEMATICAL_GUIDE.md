# PharmaERP — Complete User Manual & Simple Math Guide

**A Step-by-Step Practical Handbook for Distributors, Stockists, Accountants, and Counter Staff**

---

# Table of Contents
1. [The Simple Mathematics of Wholesale Pharma (Step-by-Step Examples)](#1-the-simple-mathematics-of-wholesale-pharma-step-by-step-examples)
   - [Example 1: How a Sale Bill is Calculated](#example-1-how-a-sale-bill-is-calculated)
   - [Example 2: How Promotional Schemes (10 + 1 Free) are Calculated](#example-2-how-promotional-schemes-10--1-free-are-calculated)
   - [Example 3: Cash Profit, Margin % and Markup %](#example-3-cash-profit-margin--and-markup-)
   - [Example 4: Chemist Retail Profit from MRP](#example-4-chemist-retail-profit-from-mrp)
   - [Example 5: GST Calculation (Local Sale vs Outside State Sale)](#example-5-gst-calculation-local-sale-vs-outside-state-sale)
   - [Example 6: Round-Off to the Nearest Rupee](#example-6-round-off-to-the-nearest-rupee)
   - [Example 7: Customer Ledger Balance Calculation](#example-7-customer-ledger-balance-calculation)
   - [Example 8: Daily Cash Drawer Balancing (Day Book)](#example-8-daily-cash-drawer-balancing-day-book)
   - [Example 9: First-Expiry, First-Out (FEFO) Stock Allocation](#example-9-first-expiry-first-out-fefo-stock-allocation)
   - [Example 10: Warehouse Stock Valuation (Average Cost)](#example-10-warehouse-stock-valuation-average-cost)
   - [Example 11: Net GST Tax Payable in GSTR-3B](#example-11-net-gst-tax-payable-in-gstr-3b)
   - [Example 12: TCS Tax Calculation on Large Turnovers](#example-12-tcs-tax-calculation-on-large-turnovers)
   - [Example 13: Financial Health Ratios (Current Ratio & Collection Days)](#example-13-financial-health-ratios-current-ratio--collection-days)
2. [Step-by-Step Screen Guide & Navigation](#2-step-by-step-screen-guide--navigation)
   - [Dashboard & Daily Overview](#dashboard--daily-overview)
   - [Master Data (Medicines, Customers, Suppliers, Taxes)](#master-data-medicines-customers-suppliers-taxes)
   - [Billing & Daily Transactions](#billing--daily-transactions)
   - [Inventory & Warehouse Management](#inventory--warehouse-management)
   - [Pricing, Schemes & Margins](#pricing-schemes--margins)
   - [Accounting, Day Book & Vouchers](#accounting-day-book--vouchers)
   - [Business Reports (P&L, Balance Sheet, Analytics)](#business-reports-pl-balance-sheet-analytics)
   - [GST Reports & Tax Filings](#gst-reports--tax-filings)
3. [Speed Keys (Keyboard Shortcuts for Fast Billing)](#3-speed-keys-keyboard-shortcuts-for-fast-billing)

---

# 1. The Simple Mathematics of Wholesale Pharma (Step-by-Step Examples)

Below is the exact arithmetic the software performs for every transaction, written in clean, simple plain text that anyone can understand immediately.

---

### Example 1: How a Sale Bill is Calculated

**Scenario**: You sell **10 strips** of Dolo 650mg to Apollo Pharmacy at **₹100 per strip**, with a **5% trade discount** and **12% GST**.

#### Step 1: Gross Value
Gross Amount = Quantity × Rate  
Gross Amount = 10 × ₹100 = **₹1,000.00**

#### Step 2: Trade Discount Deduction
Discount Amount = Gross Amount × 5%  
Discount Amount = ₹1,000.00 × 0.05 = **₹50.00**

#### Step 3: Taxable Value (Base Amount for GST)
Taxable Value = Gross Amount - Discount Amount  
Taxable Value = ₹1,000.00 - ₹50.00 = **₹950.00**  
*(GST is applied only on this ₹950.00, never on the original ₹1,000.00).*

#### Step 4: Add 12% GST
GST Tax Amount = Taxable Value × 12%  
GST Tax Amount = ₹950.00 × 0.12 = **₹114.00**

#### Step 5: Final Line Total
Item Total = Taxable Value + GST Tax Amount  
Item Total = ₹950.00 + ₹114.00 = **₹1,064.00**

---

### Example 2: How Promotional Schemes (10 + 1 Free) are Calculated

Manufacturers often give free promotional stock. Here is how the software calculates the free items and the true cost per strip:

#### Scenario A: Calculating Free Strips
* **Active Scheme**: Buy 10, Get 1 Free (10 + 1).
* **Chemist Orders**: **25 strips**.

Complete Deals Qualified = 25 ÷ 10 = **2 full deals** (with 5 extra strips)  
Free Strips Awarded = 2 deals × 1 free strip = **2 Free Strips**  
Total Strips Given to Chemist = 25 paid + 2 free = **27 strips**  
*(The chemist takes home 27 strips, but the bill charges only for 25 strips).*

---

#### Scenario B: The Chemist's Real Cost per Strip (Landed Rate)
Even though the rate printed on the bill is ₹100, what did the chemist really pay per strip?

Total Money Paid by Chemist = 10 strips × ₹100 = **₹1,000.00**  
Total Strips Received = 10 paid + 1 free = **11 strips**  
Real Cost per Strip = ₹1,000.00 ÷ 11 = **₹90.91 per strip**  

Effective Scheme Discount = ((₹100.00 - ₹90.91) ÷ ₹100.00) × 100 = **9.09% automatic discount**

---

### Example 3: Cash Profit, Margin % and Markup %

Suppose you buy a bottle of cough syrup from Cipla at **₹80.00** (Purchase Rate) and sell it to a chemist at **₹100.00** (Sale Rate).

#### 1. Cash Profit per Bottle
Profit = Sale Rate - Purchase Rate = ₹100 - ₹80 = **₹20**

#### 2. Margin Percentage (Your Profit Compared to Sale Price)
Margin tells you how many paise you keep out of every ₹1.00 that enters your cash drawer:  
Margin % = (Profit ÷ Sale Rate) × 100  
Margin % = (₹20.00 ÷ ₹100.00) × 100 = **20.00% Margin**

#### 3. Markup Percentage (Your Profit Compared to What You Paid)
Markup tells you how much you marked up the price over what you paid:  
Markup % = (Profit ÷ Purchase Rate) × 100  
Markup % = (₹20.00 ÷ ₹80.00) × 100 = **25.00% Markup**

#### The 3 Color Badges in PharmaERP:
* **Green Badge (High Profit)**: Margin is **25% or higher** (e.g. buying at ₹70, selling at ₹100 = 30% margin).
* **Blue Badge (Standard Trade)**: Margin is between **15% and 25%** (e.g. 20% margin above).
* **Amber Badge (Thin Profit)**: Margin is **below 15%** (e.g. buying at ₹90, selling at ₹100 = 10% margin; warns you to avoid deep discounts).

---

### Example 4: Chemist Retail Profit from MRP

Suppose the Maximum Retail Price (MRP) printed on the medicine box is **₹120.00**, and you sell it to the chemist at **₹100.00**.

#### Chemist's Retail Profit per Box
Chemist Profit = MRP - Wholesale Sale Rate  
Chemist Profit = ₹120.00 - ₹100.00 = **₹20.00**

#### Chemist's Retail Margin %
Chemist Margin % = (₹20.00 ÷ ₹120.00) × 100 = **16.67% Retail Margin**

---

### Example 5: GST Calculation (Local Sale vs Outside State Sale)

On a taxable medicine amount of **₹950.00** with **12% GST**:

#### Case A: Sale to a Chemist in the Same State (Local Sale)
The 12% GST is split equally into 6% Central Tax and 6% State Tax:  
Central Tax (CGST 6%) = ₹950.00 × 6% = **₹57.00**  
State Tax (SGST 6%) = ₹950.00 × 6% = **₹57.00**  
Total GST = ₹57.00 + ₹57.00 = **₹114.00**

#### Case B: Sale to a Chemist in Another State (Inter-State Sale)
The 12% GST is kept as a single integrated tax:  
Integrated Tax (IGST 12%) = ₹950.00 × 12% = **₹114.00**

---

### Example 6: Round-Off to the Nearest Rupee

Wholesale bills must end in whole rupees so customers can pay cleanly by cash, cheque, or bank transfer.

#### Rule:
* **1 to 49 paise**: Rounds **down** to ₹0.00.
* **50 to 99 paise**: Rounds **up** to the next full ₹1.00.

#### Case A: Bill ending in 30 paise
* Exact Total: **₹1,245.30**  
Final Payable Bill = **₹1,245.00**  
Round-Off Difference = ₹1,245.00 - ₹1,245.30 = **-₹0.30** (You absorbed 30 paise)

#### Case B: Bill ending in 75 paise
* Exact Total: **₹1,245.75**  
Final Payable Bill = **₹1,246.00**  
Round-Off Difference = ₹1,246.00 - ₹1,245.75 = **+₹0.25** (Customer pays 25 paise extra)

The software automatically deposits these paise adjustments into the **Round Off Account** in your ledgers.

---

### Example 7: Customer Ledger Balance Calculation

Here is how PharmaERP calculates a chemist's running balance in their statement:

#### Scenario for Apollo Pharmacy:
* Opening Balance on 1st of the month: **₹10,000.00** (Debit - they owe you ₹10,000)
* On 5th: You sell a new invoice: **+₹5,000.00**
* On 12th: They pay you by NEFT / Bank Transfer: **-₹8,000.00**

Closing Balance = Opening Balance + New Sales (Debit) - Payments Received (Credit)  
Closing Balance = ₹10,000.00 + ₹5,000.00 - ₹8,000.00 = **₹7,000.00 (Debit)**  
*(Apollo Pharmacy currently owes your shop ₹7,000.00).*

---

### Example 8: Daily Cash Drawer Balancing (Day Book)

At 8:00 PM every evening, the Day Book proves whether the physical cash in your drawer matches system records:

* Cash in drawer this morning (Opening Balance): **₹5,000.00**
* Plus cash collected from today's sales: **+₹12,000.00**
* Minus shop expenses paid in cash (tea, cleaning, courier): **-₹500.00**
* Minus cash taken from drawer and deposited into bank: **-₹10,000.00**

Expected Cash in Drawer = ₹5,000.00 + ₹12,000.00 - ₹500.00 - ₹10,000.00 = **₹6,500.00**  
*(You must count exactly ₹6,500.00 in physical currency notes in your drawer).*

---

### Example 9: First-Expiry, First-Out (FEFO) Stock Allocation

**Scenario**: A chemist orders **30 bottles** of Cough Syrup. You have two batches in the warehouse:
* Batch A (Expires in October 2026): 20 bottles in stock.
* Batch B (Expires in December 2026): 50 bottles in stock.

#### How the software allocates the bottles:
1. **Take all 20 bottles from Batch A** (because October expires before December).
2. Remaining bottles needed = 30 - 20 = **10 bottles**.
3. **Take 10 bottles from Batch B**.
4. Remaining stock in warehouse:
   * Batch A: 20 - 20 = **0 bottles left** (Sold out cleanly).
   * Batch B: 50 - 10 = **40 bottles left**.

---

### Example 10: Warehouse Stock Valuation (Average Cost)

Suppose you bought Paracetamol tablets in two separate purchase consignments:
* Consignment 1: 100 strips at ₹80.00 per strip = 100 × ₹80.00 = **₹8,000.00**
* Consignment 2: 200 strips at ₹85.00 per strip = 200 × ₹85.00 = **₹17,000.00**

#### Total Stock Valuation:
Total Strips in Warehouse = 100 + 200 = **300 strips**  
Total Money Invested in Stock = ₹8,000.00 + ₹17,000.00 = **₹25,000.00**  
Average Cost per Strip = ₹25,000.00 ÷ 300 = **₹83.33 per strip**

---

### Example 11: Net GST Tax Payable in GSTR-3B

Every month, the software calculates how much cash tax you owe the government:

* Output Tax Collected (Tax you collected on your sales bills): **₹50,000.00**
* Input Tax Credit / ITC (Tax you already paid when buying from manufacturers): **₹35,000.00**

Net Tax to Pay to Government = Output Tax Collected - Input Tax Credit  
Net Tax to Pay to Government = ₹50,000.00 - ₹35,000.00 = **₹15,000.00**  
*(You pay only ₹15,000.00 to the government. The ₹35,000.00 is deducted as your legal tax credit).*

---

### Example 12: TCS Tax Calculation on Large Turnovers

Under Indian tax law (Section 206C(1H)), if a customer buys more than **₹50 Lakhs (₹50,00,000)** from you in a single financial year, you must collect a tiny **0.1% TCS tax** on the excess:

* Customer's Total Purchases this Year: **₹65,00,000.00 (₹65 Lakhs)**
* Government Free Threshold: **₹50,00,000.00 (₹50 Lakhs)**

Turnover Subject to TCS = ₹65,00,000.00 - ₹50,00,000.00 = **₹15,00,000.00**  
TCS Tax to Collect (0.1%) = ₹15,00,000.00 × 0.1% = **₹1,500.00**

---

### Example 13: Financial Health Ratios (Current Ratio & Collection Days)

#### 1. Current Ratio (Can You Pay Your Bills?)
Current Ratio = Total Current Assets ÷ Total Current Liabilities

* If your total assets (cash, bank, stock, chemist dues) are **₹40 Lakhs** and you owe suppliers **₹20 Lakhs**:
Current Ratio = ₹40,00,000 ÷ ₹20,00,000 = **2.0**  
*(A ratio of **2.0** means you have ₹2.00 of liquid assets for every ₹1.00 of debt. Your business is in very strong financial health).*

---

#### 2. Debtor Collection Velocity (How Many Days Chemists Take to Pay You)
* Suppose customers owe you an average of **₹15 Lakhs** at any time.
* Your total sales for the year are **₹1.20 Crore (₹120 Lakhs)**.

Average Collection Days = (Money Owed by Customers ÷ Total Yearly Sales) × 365 days  
Average Collection Days = (₹15,00,000 ÷ ₹1,20,00,000) × 365 = **45.6 days**  
*(It takes your business an average of **46 days** to collect cash after cutting a bill).*

---

# 2. Step-by-Step Screen Guide & Navigation

Below is the straightforward guide on how to navigate and use every screen in PharmaERP.

---

## Dashboard & Daily Overview

### 1. Main Executive Dashboard
* **How to open**: Click **Dashboard** at the top of the left-hand menu.
* **What you see**:
  * **Today's Sales**: Total value of bills cut today.
  * **Today's Purchases**: Total value of new stock received today.
  * **Total Money to Collect (Debtors)**: Total money all chemists owe you.
  * **Total Money to Pay (Creditors)**: Total money you owe to pharmaceutical companies.
  * **Expiring Soon Alert**: Count of medicine batches expiring within 60 days.
* **What to do**: Click the quick buttons to immediately cut a new sale bill, enter a purchase, or check the Day Book.

### 2. Settings & Company Profile
* **How to open**: Click **Settings** at the bottom of the left-hand menu.
* **What to do**:
  * Enter your company legal name, trade name, GSTIN, and Drug License numbers (Form 20B & 21B).
  * Choose your active financial year.
  * Choose your invoice printing style: full-page A4 laser layout or 80mm thermal receipt.

---

## Master Data (Medicines, Customers, Suppliers, Taxes)

### 3. Item Master (List of Medicines)
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **Item Master**.
* **What you see**: List of all medicines with packaging, manufacturer, rack location, MRP, sale rate, and stock.
* **What to do**:
  * Click **+ New Item** to add a new medicine.
  * Click the **Pencil icon** next to any item to change its rate or packaging.
  * Click **Export Excel** to download your full price list to your computer.

### 4. Item Mapping (The Wide Stock Table)
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **Item Mapping**.
* **What it is**: A wide spreadsheet view of your entire catalog (over 11,000 items) showing 18 columns at once.
* **Special features**:
  * **Top Scrollbar**: An extra scrollbar right at the top of the screen so you don't have to scroll all the way down to move sideways.
  * **Quick Jump Buttons**: Click *Jump to Rates* or *Jump to Stock* to slide across the table instantly.

### 5. Batch Master
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **Batch Master**.
* **What you see**: Every batch number with expiry date, MRP, and quantity left.
* **Color codes**:
  * **Red**: Expired batch (billing is automatically blocked).
  * **Orange**: Expiring in the next 60 days.
  * **Green**: Fresh stock.

### 6. Party Master (Customers and Suppliers)
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **Party Master**.
* **What you see**: Chemist shops (customers) and pharmaceutical companies (suppliers) with their phone number, GST number, and current ledger balance.
* **Special feature**: If a party is both a customer and a supplier, set their role to **Both**. You do not need to create two separate accounts.

### 7. Party 360 (Complete Customer Profile)
* **How to open**: Click on any customer's name in the Party Master.
* **What you see**: A complete commercial history: every bill bought, every payment made, average days to pay, and returned goods history.

### 8. Manufacturer Master
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **Manufacturers**.
* **What you see**: All registered brands (Cipla, Sun Pharma, Alkem, Mankind, etc.).
* **Action**: Click **View Medicines** next to any brand to see every single product carried from that company.

### 9. Salt Master (Generic Compositions)
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **Salt Master**.
* **What it is**: Connects brand names with their generic salt chemical names. If a prescribed brand is out of stock, use this screen to find the substitute generic product immediately.

### 10. HSN / Tax Code Master
* **How to open**: Left menu $\rightarrow$ **Masters** $\rightarrow$ **HSN Master**.
* **What you see**: Official HSN tax codes and GST rates (5%, 12%, 18%). When an item has an HSN code, the software automatically knows the exact GST rate to apply.

---

## Billing & Daily Transactions

### 11. Wholesale Sale Entry (Cutting a Bill)
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Sale Entry** (or press **F2** on your keyboard).
* **Two ways to bill**:
  * **Desktop Matrix Mode**: Fast keyboard typing. Type customer $\rightarrow$ item $\rightarrow$ batch $\rightarrow$ quantity $\rightarrow$ press Enter.
  * **Mobile Touch Mode**: Perfect for tablets and phones with plus/minus steppers and easy search.
* **What happens automatically**:
  * The software warns if you bill more quantity than you have in stock.
  * The software blocks expired batches.
  * It auto-applies free schemes (like 10+1 free).
  * It computes discounts, GST, and round-offs.
* **To finish**: Press **Ctrl + S** to save, or click **Print Bill** to immediately print a tax invoice.

### 12. Sale Register
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Sale Register**.
* **What you see**: A list of every bill cut this month with date, chemist name, and amount.
* **Actions**: Click any bill to view details, reprint it, or cancel it if made by mistake.

### 13. Counter Sale (Retail / Cash Memo)
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Counter Sale**.
* **What it is**: Designed for walk-in retail cash transactions where creating a permanent customer account is unnecessary. Takes 10 seconds to cut a bill and print a cash receipt.

### 14. Purchase Entry (Stock Inward)
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Purchase Entry** (or press **F3** on your keyboard).
* **When to use**: Whenever a delivery arrives from a pharmaceutical company or super-stockist.
* **Steps**:
  1. Select the supplier.
  2. Type in their invoice number and date.
  3. Enter the medicines: batch, expiry, quantity received, free quantity received, purchase rate, and MRP.
  4. Click **Save**: Stock increases in the warehouse, and the supplier's balance is updated.

### 15. Sale Returns & Credit Notes
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Sale Return**.
* **When to use**: When a chemist returns medicines.
* **What happens**: The software reduces the chemist's balance, adds the medicine back to warehouse stock, and prints a Credit Note.

### 16. Purchase Returns & Debit Notes
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Purchase Return**.
* **When to use**: When returning damaged, near-expiry, or recalled stock back to the manufacturer. Reduces the money owed to the supplier and prints a Debit Note.

### 17. Breakage & Expiry Loss Entry
* **How to open**: Left menu $\rightarrow$ **Transactions** $\rightarrow$ **Breakages**.
* **When to use**: When a bottle breaks or a medicine expires.
* **What happens**: Removes the item from available stock and writes it off into the **Breakage and Expiry Loss Account** for tax loss claims.

---

## Inventory & Warehouse Management

### 18. Stock View
* **How to open**: Left menu $\rightarrow$ **Inventory** $\rightarrow$ **Stock View**.
* **What you see**: Live stock count for every medicine, total cost valuation, and total MRP valuation.

### 19. Stock Movement (Item Passbook / Bin Card)
* **How to open**: Left menu $\rightarrow$ **Inventory** $\rightarrow$ **Stock Movement**.
* **What it is**: A passbook for medicine bottles. Select any medicine to trace its entire history: *Opening stock $\rightarrow$ Purchases added $\rightarrow$ Sales deducted $\rightarrow$ Current balance*.

### 20. Stock Ageing (How Long Stock Has Been Sitting)
* **How to open**: Left menu $\rightarrow$ **Inventory** $\rightarrow$ **Stock Ageing**.
* **What it shows**: Groups stock into holding duration buckets:
  * **0 to 30 Days**: Fresh fast-moving stock.
  * **31 to 60 Days**: Normal stock.
  * **61 to 90 Days**: Slowing down.
  * **90+ Days**: Dead stock risk (alerting your sales team to clear it before near-expiry).

### 21. Hold & Banned Drugs
* **How to open**: Left menu $\rightarrow$ **Inventory** $\rightarrow$ **Hold / Ban Stock**.
* **When to use**: If the government or a company recalls a specific batch, freeze it here. It is instantly blocked from billing across all counters.

---

## Pricing, Schemes & Margins

### 22. Schemes and Margin Analysis
* **How to open**: Left menu $\rightarrow$ **Pricing** $\rightarrow$ **Schemes & Margins**.
* **What it shows**:
  * Your overall average profit margin across your entire product range.
  * How many items make you high profit (>25%).
* **How to set up a scheme deal**:
  1. Click **Configure Scheme Deal**.
  2. Pick the medicine.
  3. Choose the deal: for example, **Buy 10, Get 1 Free** or **5% Special Discount**.
  4. Save. It applies automatically during billing.

---

## Accounting, Day Book & Vouchers

### 23. Chart of Accounts (List of Ledgers)
* **How to open**: Left menu $\rightarrow$ **Accounting** $\rightarrow$ **Chart of Accounts**.
* **What you see**: All accounting ledgers organized into the official **74 Marg Accounting Groups**.
* **Useful feature**: Click **Purge Zero Accounts** to hide accounts with zero balances so the screen stays clean.

### 24. Ledger Statements (Party Statements)
* **How to open**: Left menu $\rightarrow$ **Accounting** $\rightarrow$ **Ledger View**.
* **How to use**:
  1. Select a customer or supplier.
  2. Pick the date range.
  3. View their full statement: every invoice, payment, and running balance.
  4. **Click-to-view**: Click on any transaction in the list to immediately open the original bill.

### 25. Voucher Entry (Entering Payments & Receipts)
* **How to open**: Left menu $\rightarrow$ **Accounting** $\rightarrow$ **Voucher Entry** (or press **F5**).
* **The 4 Voucher Types**:
  * **Payment (F5)**: Paying money to a supplier, or paying rent, tea, or transport.
  * **Receipt (F6)**: When a customer pays cash, cheque, or UPI.
  * **Contra (F7)**: Moving money between own accounts (e.g. depositing counter cash into bank).
  * **Journal (F8)**: Adjusting balances without cash moving.
* **Physical Reference**: Includes a box for the physical receipt slip number matching your signed paper receipt pad.

### 26. Day Book
* **How to open**: Left menu $\rightarrow$ **Accounting** $\rightarrow$ **Day Book**.
* **What it is**: Your daily cash and credit diary. Pick any date to see every single rupee that came in and went out on that day to balance the cash drawer.

---

## Business Reports (P&L, Balance Sheet, Analytics)

### 27. Trial Balance
* **How to open**: Left menu $\rightarrow$ **Reports** $\rightarrow$ **Trial Balance**.
* **What it is**: The ultimate accounting test. Lists all accounts and verifies that Total Debits equal Total Credits.

### 28. Profit and Loss Statement (P&L)
* **How to open**: Left menu $\rightarrow$ **Reports** $\rightarrow$ **Profit & Loss**.
* **What it shows**:
  * **Sales Revenue**
  * *Minus* **Cost of Goods Sold**
  * *Equals* **Gross Profit**
  * *Minus* **Expenses (Rent, Salaries, Electricity, Damaged Stock)**
  * *Equals* **Net Profit (The actual money taken home)**.

### 29. Balance Sheet
* **How to open**: Left menu $\rightarrow$ **Reports** $\rightarrow$ **Balance Sheet**.
* **What it shows**: Financial health snapshot:
  * **Assets (What you own)**: Cash, bank, stock, customer dues.
  * **Liabilities (What you owe)**: Supplier dues and bank loans.
  * **Net Worth (Capital)**: Assets minus Liabilities.

### 30. Sales & Customer Analytics
* **How to open**: Left menu $\rightarrow$ **Reports** $\rightarrow$ **Sales Analytics**.
* **What it shows**: Top 20% chemists generating 80% of revenue, and fastest-selling therapeutic lines.

---

## GST Reports & Tax Filings

### 31. GST Overview & Summary
* **How to open**: Left menu $\rightarrow$ **GST Reports** $\rightarrow$ **Overview**.
* **What you see**: Total Tax Collected on Sales (Output Tax), Total Tax Paid on Purchases (Input Tax Credit), and Net Tax to pay to the Government.

### 32. GSTR-3B Monthly Return
* **How to open**: Left menu $\rightarrow$ **GST Reports** $\rightarrow$ **GSTR-3B**.
* **What it does**: Automatically summarizes monthly sales tax, purchase tax credit, and tax payable into official government return boxes. Click **Export Excel** to hand it directly to your accountant.

### 33. GSTR-9 Annual Return
* **How to open**: Left menu $\rightarrow$ **GST Reports** $\rightarrow$ **GSTR-9**.
* **What it does**: Summarizes the entire 12-month financial year for annual tax return filing.

### 34. E-Invoice & E-Way Bill
* **How to open**: Left menu $\rightarrow$ **GST Reports** $\rightarrow$ **E-Invoice**.
* **What it does**: Formats data ready for the government portal for wholesale shipments requiring an official E-Way Bill or E-Invoice.

---

# 3. Speed Keys (Keyboard Shortcuts for Fast Billing)

| Key | What It Does |
| :--- | :--- |
| **`F2`** | Open **New Sale Bill** immediately |
| **`F3`** | Open **New Purchase Entry** immediately |
| **`F5`** | Open **Payment Voucher** (paying money out) |
| **`F6`** | Switch Voucher to **Receipt** (receiving money in) |
| **`F7`** | Switch Voucher to **Contra** (cash to bank transfer) |
| **`F8`** | Switch Voucher to **Journal Entry** |
| **`Ctrl + S`** | **Save** current bill or voucher |
| **`Ctrl + P`** | **Save and Print** the tax bill immediately |
| **`Tab`** | Move to next box in billing line |
| **`Enter`** | Add a new medicine line to bill |
| **`Esc`** | Close popup window or cancel |
| **`Ctrl + F`** | Jump directly to search box on any screen |

---

*PharmaERP Plain-Language Handbook — Built for Everyday Wholesale Operations.*
