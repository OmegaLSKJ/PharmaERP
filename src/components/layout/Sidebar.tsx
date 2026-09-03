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
  { title: '', items: [{ label: 'Dashboard', path: '/', icon: <LayoutDashboard size={16} /> }] },
  {
    title: 'Master Data',
    items: [
      { label: 'Parties', path: '/masters/parties', icon: <Users size={16} />, children: [
        { label: 'All Parties', path: '/masters/parties' },
        { label: 'Customers', path: '/masters/parties?type=customer' },
        { label: 'Suppliers', path: '/masters/parties?type=supplier' },
      ]},
      { label: 'Items', path: '/masters/items', icon: <Package size={16} />, children: [
        { label: 'All Items', path: '/masters/items' },
        { label: 'Item Mapping', path: '/masters/itemmapping' },
      ]},
      { label: 'Manufacturers', path: '/masters/manufacturers', icon: <Building2 size={16} /> },
      { label: 'Ledgers', path: '/masters/ledgers', icon: <Landmark size={16} /> },
      { label: 'HSN/SAC', path: '/masters/hsn', icon: <Receipt size={16} /> },
      { label: 'Salt Master', path: '/masters/salts', icon: <Boxes size={16} /> },
      { label: 'Locations', path: '/masters/locations', icon: <Warehouse size={16} /> },
      { label: 'Series Master', path: '/masters/series', icon: <Hash size={16} /> },
      { label: 'Comm. Blocking', path: '/masters/communication', icon: <Ban size={16} /> },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { label: 'Sale', path: '/transactions/sale', icon: <FileText size={16} />, children: [
        { label: 'Sale Register', path: '/transactions/sale' },
        { label: 'New Invoice', path: '/transactions/sale/new' },
        { label: 'Delivery Challan', path: '/transactions/sale/challan' },
        { label: 'Counter Sale (POS)', path: '/transactions/sale/counter' },
        { label: 'Sale Return', path: '/transactions/sale-return' },
      ]},
      { label: 'Purchase', path: '/transactions/purchase', icon: <Truck size={16} />, children: [
        { label: 'Purchase Register', path: '/transactions/purchase' },
        { label: 'New Entry', path: '/transactions/purchase/new' },
        { label: 'Purchase Return', path: '/transactions/purchase-return' },
      ]},
      { label: 'Orders', path: '/transactions/orders', icon: <ShoppingCart size={16} /> },
      { label: 'Pendings', path: '/transactions/pendings', icon: <Clock size={16} /> },
      { label: 'Breakage / Expiry', path: '/transactions/breakage', icon: <ArrowLeftRight size={16} /> },
      { label: 'Replacements', path: '/transactions/replacement', icon: <ArrowLeftRight size={16} /> },
      { label: 'Price Difference', path: '/transactions/pricediff', icon: <Percent size={16} /> },
      { label: 'Claims', path: '/transactions/claims', icon: <ArrowLeftRight size={16} /> },
      { label: 'Import Data', path: '/transactions/import', icon: <Upload size={16} /> },
      { label: 'Server Upload', path: '/transactions/upload', icon: <Download size={16} /> },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Delivery', path: '/delivery', icon: <Truck size={16} /> },
      { label: 'Pricing / Schemes', path: '/pricing', icon: <IndianRupee size={16} /> },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { label: 'Vouchers', path: '/accounting/vouchers', icon: <Receipt size={16} /> },
      { label: 'Day Book', path: '/accounting/daybook', icon: <FileText size={16} /> },
      { label: 'Ledger View', path: '/accounting/ledger', icon: <Landmark size={16} /> },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { label: 'Stock View', path: '/inventory/stock', icon: <Database size={16} /> },
      { label: 'Batch Tracking', path: '/inventory/batches', icon: <ClipboardList size={16} /> },
      { label: 'Expiry Alerts', path: '/inventory/expiry', icon: <Shield size={16} /> },
      { label: 'Movement', path: '/inventory/movement', icon: <Activity size={16} /> },
      { label: 'Negative Stock', path: '/inventory/negative', icon: <AlertTriangle size={16} /> },
      { label: 'Dump Stock', path: '/inventory/dump', icon: <Flame size={16} /> },
      { label: 'Hold / Ban', path: '/inventory/holdban', icon: <Zap size={16} /> },
    ],
  },
  {
    title: 'GST & Compliance',
    items: [
      { label: 'GSTR-1 Reports', path: '/reports/gst', icon: <Receipt size={16} /> },
      { label: 'GSTR-3B', path: '/reports/gst-3b', icon: <FileText size={16} /> },
      { label: 'GSTR-1 Summary', path: '/reports/gst-summary', icon: <BarChart3 size={16} /> },
      { label: '2A/2B Reconciliation', path: '/gst/reconciliation', icon: <Link2 size={16} /> },
      { label: 'e-Invoice (IRN)', path: '/gst/einvoice', icon: <FileCheck size={16} /> },
      { label: 'GSTR-9 Annual', path: '/gst/gstr9', icon: <ClipboardList size={16} /> },
      { label: 'TDS / TCS', path: '/gst/tds-tcs', icon: <Calculator size={16} /> },
    ],
  },
  {
    title: 'Reports',
    items: [
      { label: 'Sales Analytics', path: '/reports/sales', icon: <TrendingUp size={16} /> },
      { label: 'Purchase Analytics', path: '/reports/purchases', icon: <BarChart3 size={16} /> },
      { label: 'Fast / Slow Moving', path: '/reports/fastslow', icon: <Turtle size={16} /> },
      { label: 'Trial Balance', path: '/reports/trial-balance', icon: <Scale size={16} /> },
      { label: 'Profit & Loss', path: '/reports/profit-loss', icon: <Wallet size={16} /> },
      { label: 'Balance Sheet', path: '/reports/balance-sheet', icon: <Landmark size={16} /> },
      { label: 'Ratio Analysis', path: '/reports/ratio', icon: <Activity size={16} /> },
      { label: 'Cash Flow', path: '/reports/cash-flow', icon: <IndianRupee size={16} /> },
      { label: 'Financial Hub', path: '/reports/financial', icon: <FileText size={16} /> },
    ],
  },
]

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen)
  const company = useUIStore((s) => s.company)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggle = (label: string) => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }))

  return (
    <aside className={cn(
      'no-print h-screen flex flex-col shrink-0 z-20 transition-[width,transform] duration-200 ease-out sticky top-0 max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:w-[280px]',
      'bg-[hsl(var(--sidebar))] border-r border-border/80 text-[hsl(var(--sidebar-foreground))]',
      collapsed ? 'w-[60px]' : 'w-[240px]',
      mobileSidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'
    )}>
      {/* Brand Logo Header */}
      <div className={cn('flex items-center gap-3 px-4 h-14 border-b border-border/80 shrink-0', collapsed && 'justify-center px-0')}>
        <div className="relative">
          <img src="/favicon.png" alt={`${company.companyName} Logo`} className="w-8 h-8 object-contain rounded" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[hsl(var(--sidebar))]" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-foreground leading-tight tracking-tight truncate" title={company.companyName}>
              {company.companyName}
            </div>
            <div className="text-[9px] text-muted-foreground/60 font-semibold tracking-wider uppercase">Distribution Suite</div>
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-3 sidebar-scroll">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className="space-y-1">
            {section.title && !collapsed && (
              <div className="flex items-center gap-2 px-2.5 py-1">
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">{section.title}</span>
                <span className="h-px flex-1 bg-border/40" />
              </div>
            )}
            {section.title && collapsed && <div className="mx-auto mb-1.5 h-px w-5 bg-border/50" />}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() => toggle(item.label)}
                        title={collapsed ? item.label : undefined}
                        aria-expanded={expanded[item.label]}
                        aria-label={collapsed ? item.label : undefined}
                        className={cn(
                          'group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] transition-all duration-150',
                          collapsed ? 'justify-center' : '',
                          expanded[item.label]
                            ? 'text-foreground bg-secondary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                        )}
                      >
                        <span className={cn('shrink-0 transition-colors', expanded[item.label] ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-primary')}>{item.icon}</span>
                        {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                        {!collapsed && (expanded[item.label]
                          ? <ChevronDown size={12} className="text-muted-foreground/50" />
                          : <ChevronRight size={12} className="text-muted-foreground/50 group-hover:text-muted-foreground/80" />)}
                      </button>
                      {expanded[item.label] && !collapsed && (
                        <div className="mt-0.5 ml-[18px] pl-3.5 border-l border-border/80 space-y-0.5 py-0.5">
                          {item.children.map((child) => (
                            <NavLink key={child.path} to={child.path}
                              className={({ isActive }) => cn(
                                'block px-2.5 py-1 rounded text-[11px] transition-all duration-150',
                                isActive ? 'text-primary bg-primary/10 font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                              )}>
                              {child.label}
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <NavLink to={item.path} title={collapsed ? item.label : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      className={({ isActive }) => cn(
                        'relative group flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] transition-all duration-150',
                        collapsed ? 'justify-center' : '',
                        isActive
                          ? 'text-primary bg-primary/10 border-l-2 border-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                      )}>
                      {({ isActive }) => (<>
                        <span className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-primary')}>{item.icon}</span>
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

      {/* Sidebar Footer Controls */}
      <div className="border-t border-border/80 p-2 space-y-0.5 shrink-0">
        <NavLink to="/settings" title={collapsed ? 'Settings' : undefined}
          aria-label={collapsed ? 'Settings' : undefined}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] transition-all duration-150',
            collapsed ? 'justify-center' : '',
            isActive ? 'text-primary bg-primary/10 border-l-2 border-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          )}>
          {({ isActive }) => (<>
            <Settings size={16} className={isActive ? 'text-primary' : 'text-muted-foreground/80'} />
            {!collapsed && <span>Settings</span>}
          </>)}
        </NavLink>
        <button onClick={toggleSidebar}
          className={cn('w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all', collapsed && 'justify-center')}>
          {collapsed ? <PanelLeft size={16} /> : <><PanelLeftClose size={16} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  )
}
