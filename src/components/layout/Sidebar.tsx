import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Package, Building2, FileText,
  ShoppingCart, Truck, ArrowLeftRight, Landmark, BarChart3,
  Settings, ChevronDown, ChevronRight, Warehouse, Receipt,
  ClipboardList, TrendingUp, Shield, Database, Link2, Hash, Ban,
  Percent, Clock, Upload, Download, FileCheck, Calculator, Scale,
  Wallet, Activity, Boxes, AlertTriangle, Flame, Turtle, Zap,
  PanelLeftClose, PanelLeft, IndianRupee
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { useUIStore } from '../../store/uiStore'

interface NavItem {
  label: string; path: string; icon: React.ReactNode;
  children?: { label: string; path: string }[]
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: '', items: [{ label: 'Dashboard', path: '/', icon: <LayoutDashboard size={17} /> }] },
  {
    title: 'Master Data',
    items: [
      { label: 'Parties', path: '/masters/parties', icon: <Users size={17} />, children: [
        { label: 'All Parties', path: '/masters/parties' },
        { label: 'Customers', path: '/masters/parties?type=customer' },
        { label: 'Suppliers', path: '/masters/parties?type=supplier' },
      ]},
      { label: 'Items', path: '/masters/items', icon: <Package size={17} />, children: [
        { label: 'All Items', path: '/masters/items' },
        { label: 'Item Mapping', path: '/masters/itemmapping' },
      ]},
      { label: 'Manufacturers', path: '/masters/manufacturers', icon: <Building2 size={17} /> },
      { label: 'Ledgers', path: '/masters/ledgers', icon: <Landmark size={17} /> },
      { label: 'HSN/SAC', path: '/masters/hsn', icon: <Receipt size={17} /> },
      { label: 'Salt Master', path: '/masters/salts', icon: <Boxes size={17} /> },
      { label: 'Locations', path: '/masters/locations', icon: <Warehouse size={17} /> },
      { label: 'Series Master', path: '/masters/series', icon: <Hash size={17} /> },
      { label: 'Comm. Blocking', path: '/masters/communication', icon: <Ban size={17} /> },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { label: 'Sale', path: '/transactions/sale', icon: <FileText size={17} />, children: [
        { label: 'Sale Register', path: '/transactions/sale' },
        { label: 'New Invoice', path: '/transactions/sale/new' },
        { label: 'Delivery Challan', path: '/transactions/sale/challan' },
        { label: 'Counter Sale (POS)', path: '/transactions/sale/counter' },
        { label: 'Sale Return', path: '/transactions/sale-return' },
      ]},
      { label: 'Purchase', path: '/transactions/purchase', icon: <Truck size={17} />, children: [
        { label: 'Purchase Register', path: '/transactions/purchase' },
        { label: 'New Entry', path: '/transactions/purchase/new' },
        { label: 'Purchase Return', path: '/transactions/purchase-return' },
      ]},
      { label: 'Orders', path: '/transactions/orders', icon: <ShoppingCart size={17} /> },
      { label: 'Pendings', path: '/transactions/pendings', icon: <Clock size={17} /> },
      { label: 'Breakage / Expiry', path: '/transactions/breakage', icon: <ArrowLeftRight size={17} /> },
      { label: 'Replacements', path: '/transactions/replacement', icon: <ArrowLeftRight size={17} /> },
      { label: 'Price Difference', path: '/transactions/pricediff', icon: <Percent size={17} /> },
      { label: 'Claims', path: '/transactions/claims', icon: <HandshakeFallback /> },
      { label: 'Import Data', path: '/transactions/import', icon: <Upload size={17} /> },
      { label: 'Server Upload', path: '/transactions/upload', icon: <Download size={17} /> },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Delivery', path: '/delivery', icon: <Truck size={17} /> },
      { label: 'Pricing / Schemes', path: '/pricing', icon: <IndianRupee size={17} /> },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { label: 'Vouchers', path: '/accounting/vouchers', icon: <Receipt size={17} /> },
      { label: 'Day Book', path: '/accounting/daybook', icon: <FileText size={17} /> },
      { label: 'Ledger View', path: '/accounting/ledger', icon: <Landmark size={17} /> },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Stock View', path: '/inventory/stock', icon: <Database size={17} /> },
      { label: 'Batch Tracking', path: '/inventory/batches', icon: <ClipboardList size={17} /> },
      { label: 'Expiry Alerts', path: '/inventory/expiry', icon: <Shield size={17} /> },
      { label: 'Movement', path: '/inventory/movement', icon: <Activity size={17} /> },
      { label: 'Negative Stock', path: '/inventory/negative', icon: <AlertTriangle size={17} /> },
      { label: 'Dump Stock', path: '/inventory/dump', icon: <Flame size={17} /> },
      { label: 'Hold / Ban', path: '/inventory/holdban', icon: <Zap size={17} /> },
    ],
  },
  {
    title: 'GST & Compliance',
    items: [
      { label: 'GSTR-1 Reports', path: '/reports/gst', icon: <Receipt size={17} /> },
      { label: 'GSTR-3B', path: '/reports/gst-3b', icon: <FileText size={17} /> },
      { label: 'GSTR-1 Summary', path: '/reports/gst-summary', icon: <BarChart3 size={17} /> },
      { label: '2A/2B Reconciliation', path: '/gst/reconciliation', icon: <Link2 size={17} /> },
      { label: 'e-Invoice (IRN)', path: '/gst/einvoice', icon: <FileCheck size={17} /> },
      { label: 'GSTR-9 Annual', path: '/gst/gstr9', icon: <ClipboardList size={17} /> },
      { label: 'TDS / TCS', path: '/gst/tds-tcs', icon: <Calculator size={17} /> },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Sales Analytics', path: '/reports/sales', icon: <TrendingUp size={17} /> },
      { label: 'Purchase Analytics', path: '/reports/purchases', icon: <BarChart3 size={17} /> },
      { label: 'Fast / Slow Moving', path: '/reports/fastslow', icon: <Turtle size={17} /> },
      { label: 'Trial Balance', path: '/reports/trial-balance', icon: <Scale size={17} /> },
      { label: 'Profit & Loss', path: '/reports/profit-loss', icon: <Wallet size={17} /> },
      { label: 'Balance Sheet', path: '/reports/balance-sheet', icon: <Landmark size={17} /> },
      { label: 'Ratio Analysis', path: '/reports/ratio', icon: <Activity size={17} /> },
      { label: 'Cash Flow', path: '/reports/cash-flow', icon: <IndianRupee size={17} /> },
      { label: 'Financial Hub', path: '/reports/financial', icon: <FileText size={17} /> },
    ],
  },
]

function HandshakeFallback() {
  return <ArrowLeftRight size={17} />
}

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (label: string) => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }))

  return (
    <aside className={cn(
      'h-screen flex flex-col shrink-0 z-20 transition-[width,transform] duration-300 ease-out sticky top-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[280px]',
      'bg-gradient-to-b from-slate-950 via-[hsl(var(--sidebar))] to-slate-950',
      'border-r border-white/[0.06]',
      collapsed ? 'w-[64px]' : 'w-[248px]',
      mobileSidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
    )}>
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] shrink-0', collapsed && 'justify-center px-0')}>
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-glow">
            <span className="text-white font-bold text-sm font-mono">Rx</span>
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-white leading-tight tracking-tight">PharmaERP</div>
            <div className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Distribution Suite</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2.5 space-y-4 sidebar-scroll">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.title && !collapsed && (
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">{section.title}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-white/[0.07] to-transparent" />
              </div>
            )}
            {section.title && collapsed && <div className="mx-auto mb-1.5 h-px w-6 bg-white/[0.08]" />}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() => toggle(item.label)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-200',
                          collapsed ? 'justify-center' : '',
                          expanded[item.label]
                            ? 'text-white bg-white/[0.06]'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.04] hover:translate-x-0.5'
                        )}
                      >
                        <span className={cn('shrink-0 transition-colors', expanded[item.label] ? 'text-indigo-400' : 'text-slate-500 group-hover:text-indigo-400')}>{item.icon}</span>
                        {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                        {!collapsed && (expanded[item.label]
                          ? <ChevronDown size={13} className="text-slate-500" />
                          : <ChevronRight size={13} className="text-slate-600 group-hover:text-slate-400" />)}
                        {collapsed && !expanded[item.label] && null}
                      </button>
                      {expanded[item.label] && !collapsed && (
                        <div className="mt-0.5 ml-[19px] pl-3.5 border-l border-white/[0.07] space-y-0.5 py-0.5">
                          {item.children.map((child) => (
                            <NavLink key={child.path} to={child.path}
                              className={({ isActive }) => cn(
                                'block px-2.5 py-1.5 rounded-md text-xs transition-all duration-150',
                                isActive ? 'text-indigo-300 bg-indigo-500/10 font-medium' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
                              )}>
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <NavLink to={item.path} title={collapsed ? item.label : undefined}
                      className={({ isActive }) => cn(
                        'relative group flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-200',
                        collapsed ? 'justify-center' : '',
                        isActive
                          ? 'text-white bg-gradient-to-r from-blue-700 to-blue-600 shadow-glow'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.04] hover:translate-x-0.5'
                      )}>
                      {({ isActive }) => (<>
                        {isActive && <span className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500 shadow-glow" />}
                        <span className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-400')}>{item.icon}</span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>)}
                    </NavLink>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] p-2.5 space-y-0.5 shrink-0">
        <NavLink to="/settings" title={collapsed ? 'Settings' : undefined}
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] transition-all duration-200',
            collapsed ? 'justify-center' : '',
            isActive ? 'text-white bg-gradient-to-r from-blue-700 to-blue-600 shadow-glow' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          )}>
          {({ isActive }) => (<>
            <Settings size={17} className={isActive ? 'text-white' : 'text-slate-500'} />
            {!collapsed && <span>Settings</span>}
          </>)}
        </NavLink>
        <button onClick={toggleSidebar}
          className={cn('w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all', collapsed && 'justify-center')}>
          {collapsed ? <PanelLeft size={17} /> : <><PanelLeftClose size={17} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
