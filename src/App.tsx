import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import Dashboard from './pages/dashboard/Dashboard'
import PartyList from './pages/masters/PartyList'
import Party360 from './pages/masters/Party360'
import ItemList from './pages/masters/ItemList'
import ItemForm from './pages/masters/ItemForm'
import BatchMaster from './pages/masters/BatchMaster'
import ManufacturerList from './pages/masters/manufacturers/ManufacturerList'
import LedgerList from './pages/masters/ledgers/LedgerList'
import HsnList from './pages/masters/hsn/HsnList'
import SaltMaster from './pages/masters/salts/SaltMaster'
import LocationMaster from './pages/masters/locations/LocationMaster'
import ItemMapping from './pages/masters/itemmapping/ItemMapping'
import SeriesMaster from './pages/masters/SeriesMaster'
import CommunicationBlocking from './pages/masters/CommunicationBlocking'
import SaleEntry from './pages/transactions/SaleEntry'
import SaleRegister from './pages/transactions/SaleRegister'
import SaleReturn from './pages/transactions/SaleReturn'
import PurchaseEntry from './pages/transactions/PurchaseEntry'
import PurchaseRegister from './pages/transactions/PurchaseRegister'
import PurchaseReturn from './pages/transactions/PurchaseReturn'
import Orders from './pages/transactions/Orders'
import BreakageEntry from './pages/transactions/BreakageEntry'
import ReplacementEntry from './pages/transactions/replacements/ReplacementEntry'
import ChallanEntry from './pages/transactions/ChallanEntry'
import CounterSale from './pages/transactions/CounterSale'
import PriceDifference from './pages/transactions/PriceDifference'
import Pendings from './pages/transactions/Pendings'
import TransactionImport from './pages/transactions/TransactionImport'
import ServerUpload from './pages/transactions/ServerUpload'
import ClaimSettlement from './pages/transactions/claims/ClaimSettlement'
import VoucherEntry from './pages/accounting/VoucherEntry'
import DayBook from './pages/accounting/DayBook'
import LedgerView from './pages/accounting/LedgerView'
import SelectedBook from './pages/accounting/SelectedBook'
import NoteBook from './pages/accounting/NoteBook'
import ItemDayBook from './pages/accounting/ItemDayBook'
import StockView from './pages/inventory/StockView'
import StockAgeing from './pages/inventory/StockAgeing'
import StockMovement from './pages/inventory/StockMovement'
import NegativeStock from './pages/inventory/NegativeStock'
import DumpStock from './pages/inventory/DumpStock'
import HoldBanStock from './pages/inventory/HoldBanStock'
import GstReports from './pages/gst/GstReports'
import Gstr3b from './pages/gst/Gstr3b'
import GstrSummary from './pages/gst/GstrSummary'
import GstrReconciliation from './pages/gst/reconciliation/GstrReconciliation'
import EInvoice from './pages/gst/EInvoice'
import Gstr9 from './pages/gst/Gstr9'
import TdsTcs from './pages/gst/TdsTcs'
import DeliveryManagement from './pages/delivery/DeliveryManagement'
import PricingSchemes from './pages/pricing/PricingSchemes'
import SalesAnalytics from './pages/reports/SalesAnalytics'
import SaleAnalysis from './modules/sale-analysis/SaleAnalysis'
import PurchaseAnalysis from './modules/purchase-analysis/PurchaseAnalysis'
import FinancialReports from './pages/reports/FinancialReports'
import TrialBalance from './pages/reports/TrialBalance'
import ProfitLoss from './pages/reports/ProfitLoss'
import BalanceSheet from './pages/reports/BalanceSheet'
import RatioAnalysis from './pages/reports/RatioAnalysis'
import CashFlow from './pages/reports/CashFlow'
import AccountsReports from './pages/reports/AccountsReports'
import FastSlowMoving from './pages/reports/FastSlowMoving'
import SettingsPage from './pages/settings/SettingsPage'
import CrudTablePage from './pages/admin/CrudTablePage'

const complianceCrud = {
  licenses: [{key:'license_number',label:'License number',required:true},{key:'license_type',label:'License type',required:true},{key:'party_id',label:'Party UUID'},{key:'issued_on',label:'Issued on',type:'date' as const},{key:'expires_on',label:'Expires on',type:'date' as const},{key:'issuing_authority',label:'Issuing authority'},{key:'status',label:'Status',type:'select' as const,options:['active','expired','suspended']},{key:'document_url',label:'Document URL'}],
  recalls: [{key:'recall_number',label:'Recall number',required:true},{key:'manufacturer_id',label:'Manufacturer UUID'},{key:'initiated_on',label:'Initiated on',type:'date' as const},{key:'severity',label:'Severity',type:'select' as const,options:['low','medium','high','critical']},{key:'status',label:'Status',type:'select' as const,options:['open','in_progress','closed']},{key:'reason',label:'Reason'},{key:'regulatory_reference',label:'Regulatory reference'},{key:'closed_at',label:'Closed at',type:'datetime-local' as const}],
  controlled: [{key:'patient_name',label:'Patient name',required:true},{key:'prescriber_name',label:'Prescriber name',required:true},{key:'prescription_reference',label:'Prescription reference',required:true},{key:'sale_invoice_id',label:'Sale invoice UUID'},{key:'sale_invoice_line_id',label:'Sale line UUID'},{key:'dispensed_at',label:'Dispensed at',type:'datetime-local' as const}],
}
const inventoryCrud = {
  reservations: [{key:'item_batch_id',label:'Item batch UUID',required:true},{key:'warehouse_id',label:'Warehouse UUID',required:true},{key:'source_type',label:'Source type',required:true},{key:'source_id',label:'Source UUID'},{key:'quantity',label:'Quantity',type:'number' as const,required:true},{key:'status',label:'Status',type:'select' as const,options:['active','released','expired']},{key:'expires_at',label:'Expires at',type:'datetime-local' as const},{key:'released_at',label:'Released at',type:'datetime-local' as const}],
  adjustments: [{key:'adjustment_number',label:'Adjustment number',required:true},{key:'adjustment_date',label:'Date',type:'date' as const,required:true},{key:'reason',label:'Reason',required:true},{key:'status',label:'Status',type:'select' as const,options:['draft','posted','cancelled']},{key:'posted_at',label:'Posted at',type:'datetime-local' as const}],
  lines: [{key:'adjustment_id',label:'Adjustment UUID',required:true},{key:'item_batch_id',label:'Item batch UUID',required:true},{key:'warehouse_id',label:'Warehouse UUID',required:true},{key:'quantity_delta',label:'Quantity delta',type:'number' as const,required:true},{key:'reason',label:'Reason'}],
}

export default function App() {
  useEffect(() => {
    const handleDateClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (el && el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'date') {
        try {
          (el as HTMLInputElement).showPicker?.()
        } catch {}
      }
    }
    document.addEventListener('click', handleDateClick)
    return () => document.removeEventListener('click', handleDateClick)
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/masters/parties" element={<PartyList />} />
          <Route path="/masters/parties/:id" element={<Party360 />} />
          <Route path="/masters/items" element={<ItemList />} />
          <Route path="/inventory/items" element={<ItemList />} />
          <Route path="/masters/items/new" element={<ItemForm />} />
          <Route path="/masters/items/:id" element={<ItemForm />} />
          <Route path="/masters/batches" element={<BatchMaster />} />
          <Route path="/masters/manufacturers" element={<ManufacturerList />} />
          <Route path="/masters/ledgers" element={<LedgerList />} />
          <Route path="/masters/hsn" element={<HsnList />} />
          <Route path="/masters/salts" element={<SaltMaster />} />
          <Route path="/masters/locations" element={<LocationMaster />} />
          <Route path="/masters/itemmapping" element={<ItemMapping />} />
          <Route path="/masters/series" element={<SeriesMaster />} />
          <Route path="/masters/communication" element={<CommunicationBlocking />} />
          <Route path="/transactions/sale" element={<SaleRegister />} />
          <Route path="/transactions/sale/new" element={<SaleEntry />} />
          <Route path="/transactions/sale/edit/:id" element={<SaleEntry />} />
          <Route path="/transactions/sale/:id" element={<SaleEntry />} />
          <Route path="/transactions/sale/challan" element={<ChallanEntry />} />
          <Route path="/transactions/sale/counter" element={<CounterSale />} />
          <Route path="/transactions/sale-return" element={<SaleReturn />} />
          <Route path="/transactions/purchase" element={<PurchaseRegister />} />
          <Route path="/transactions/purchase/new" element={<PurchaseEntry />} />
          <Route path="/transactions/purchase/edit/:id" element={<PurchaseEntry />} />
          <Route path="/transactions/purchase/:id" element={<PurchaseEntry />} />
          <Route path="/transactions/purchase-return" element={<PurchaseReturn />} />
          <Route path="/transactions/orders" element={<Orders />} />
          <Route path="/transactions/breakage" element={<BreakageEntry />} />
          <Route path="/transactions/replacement" element={<ReplacementEntry />} />
          <Route path="/transactions/pricediff" element={<PriceDifference />} />
          <Route path="/transactions/pendings" element={<Pendings />} />
          <Route path="/transactions/import" element={<TransactionImport />} />
          <Route path="/transactions/upload" element={<ServerUpload />} />
          <Route path="/transactions/claims" element={<ClaimSettlement />} />
          <Route path="/accounting/vouchers" element={<VoucherEntry />} />
          <Route path="/accounting/daybook" element={<DayBook />} />
          <Route path="/accounting/ledger" element={<LedgerView />} />
          <Route path="/accounting/selected-book" element={<SelectedBook />} />
          <Route path="/accounting/debit-note" element={<NoteBook type="debit" />} />
          <Route path="/accounting/credit-note" element={<NoteBook type="credit" />} />
          <Route path="/accounting/item-daybook" element={<ItemDayBook />} />
          <Route path="/inventory/stock" element={<StockView />} />
          <Route path="/inventory/batches" element={<StockView />} />
          <Route path="/inventory/expiry" element={<StockAgeing />} />
          <Route path="/inventory/movement" element={<StockMovement />} />
          <Route path="/inventory/negative" element={<NegativeStock />} />
          <Route path="/inventory/dump" element={<DumpStock />} />
          <Route path="/inventory/holdban" element={<HoldBanStock />} />
          <Route path="/inventory/reservations" element={<CrudTablePage title="Stock Reservations" description="Create, release, edit and remove inventory reservations." resource="reservations" fields={inventoryCrud.reservations} />} />
          <Route path="/inventory/adjustments" element={<CrudTablePage title="Inventory Adjustments" description="Maintain adjustment headers and posting state." resource="inventory-adjustment-records" fields={inventoryCrud.adjustments} />} />
          <Route path="/inventory/adjustment-lines" element={<CrudTablePage title="Adjustment Lines" description="Maintain batch and warehouse quantities for adjustment records." resource="inventory-adjustment-lines" fields={inventoryCrud.lines} />} />
          <Route path="/gst/reconciliation" element={<GstrReconciliation />} />
          <Route path="/reports/gst" element={<GstReports />} />
          <Route path="/reports/gst-3b" element={<Gstr3b />} />
          <Route path="/reports/gst-summary" element={<GstrSummary />} />
          <Route path="/gst/einvoice" element={<EInvoice />} />
          <Route path="/gst/gstr9" element={<Gstr9 />} />
          <Route path="/gst/tds-tcs" element={<TdsTcs />} />
          <Route path="/compliance/drug-licenses" element={<CrudTablePage title="Drug Licenses" description="Maintain party licences, authorities, validity and document references." resource="drug-licenses" fields={complianceCrud.licenses} />} />
          <Route path="/compliance/recalls" element={<CrudTablePage title="Product Recalls" description="Maintain recall cases, severity, regulatory references and closure." resource="product-recalls" fields={complianceCrud.recalls} />} />
          <Route path="/compliance/controlled-drugs" element={<CrudTablePage title="Controlled Drug Register" description="Maintain patient, prescriber and prescription dispensing records." resource="controlled-drug-register" fields={complianceCrud.controlled} />} />
          <Route path="/reports/sales" element={<SalesAnalytics />} />
          <Route path="/reports/sale-analysis" element={<SaleAnalysis />} />
          <Route path="/reports/purchases" element={<PurchaseAnalysis />} />
          <Route path="/reports/fastslow" element={<FastSlowMoving />} />
          <Route path="/reports/trial-balance" element={<TrialBalance />} />
          <Route path="/reports/profit-loss" element={<ProfitLoss />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="/reports/ratio" element={<RatioAnalysis />} />
          <Route path="/reports/cash-flow" element={<CashFlow />} />
          <Route path="/reports/accounts" element={<AccountsReports />} />
          <Route path="/reports/financial" element={<FinancialReports />} />
          <Route path="/delivery" element={<DeliveryManagement />} />
          <Route path="/pricing" element={<PricingSchemes />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
