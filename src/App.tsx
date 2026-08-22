import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import Dashboard from './pages/dashboard/Dashboard'
import PartyList from './pages/masters/PartyList'
import Party360 from './pages/masters/Party360'
import ItemList from './pages/masters/ItemList'
import ItemForm from './pages/masters/ItemForm'
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
import PurchaseAnalytics from './pages/reports/PurchaseAnalytics'
import FinancialReports from './pages/reports/FinancialReports'
import TrialBalance from './pages/reports/TrialBalance'
import ProfitLoss from './pages/reports/ProfitLoss'
import BalanceSheet from './pages/reports/BalanceSheet'
import RatioAnalysis from './pages/reports/RatioAnalysis'
import CashFlow from './pages/reports/CashFlow'
import FastSlowMoving from './pages/reports/FastSlowMoving'
import SettingsPage from './pages/settings/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/masters/parties" element={<PartyList />} />
          <Route path="/masters/parties/:id" element={<Party360 />} />
<Route path="/masters/items" element={<ItemList />} />
<Route path="/masters/items/new" element={<ItemForm />} />
<Route path="/masters/items/:id" element={<ItemForm />} />
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
          <Route path="/transactions/sale/challan" element={<ChallanEntry />} />
          <Route path="/transactions/sale/counter" element={<CounterSale />} />
          <Route path="/transactions/sale-return" element={<SaleReturn />} />
          <Route path="/transactions/purchase" element={<PurchaseRegister />} />
          <Route path="/transactions/purchase/new" element={<PurchaseEntry />} />
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
          <Route path="/inventory/stock" element={<StockView />} />
          <Route path="/inventory/batches" element={<StockView />} />
          <Route path="/inventory/expiry" element={<StockAgeing />} />
          <Route path="/inventory/movement" element={<StockMovement />} />
          <Route path="/inventory/negative" element={<NegativeStock />} />
          <Route path="/inventory/dump" element={<DumpStock />} />
          <Route path="/inventory/holdban" element={<HoldBanStock />} />
          <Route path="/gst/reconciliation" element={<GstrReconciliation />} />
          <Route path="/reports/gst" element={<GstReports />} />
          <Route path="/reports/gst-3b" element={<Gstr3b />} />
          <Route path="/reports/gst-summary" element={<GstrSummary />} />
          <Route path="/gst/einvoice" element={<EInvoice />} />
          <Route path="/gst/gstr9" element={<Gstr9 />} />
          <Route path="/gst/tds-tcs" element={<TdsTcs />} />
          <Route path="/reports/sales" element={<SalesAnalytics />} />
          <Route path="/reports/purchases" element={<PurchaseAnalytics />} />
          <Route path="/reports/fastslow" element={<FastSlowMoving />} />
          <Route path="/reports/trial-balance" element={<TrialBalance />} />
          <Route path="/reports/profit-loss" element={<ProfitLoss />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="/reports/ratio" element={<RatioAnalysis />} />
          <Route path="/reports/cash-flow" element={<CashFlow />} />
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
