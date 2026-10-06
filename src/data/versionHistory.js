export const CURRENT_VERSION = 'v2.12.0'

export const versionHistory = [
  {
    version: 'v2.12.0',
    date: 'Oct 2026',
    title: 'Shift Rules & Payroll',
    highlights: [
      'Per-shift late fine tiers and half-day rules are applied automatically to attendance',
      'Daily or monthly wage can be set for each employee',
      'Owner-only Payroll report for a branch and month, with CSV export',
      'Staff without an assigned shift keep the old rule',
      'Rule changes apply to new punches, not to past days',
    ],
    details: [
      {
        section: 'Shift Rules',
        items: [
          'Each shift can define late fine tiers and half-day rules',
          'Rules are applied automatically to new punches; past days are not recalculated',
          'Staff without an assigned shift keep the old rule',
        ],
      },
      {
        section: 'Payroll',
        items: [
          'Daily or monthly wage per employee, edited by the owner',
          'Monthly rate divisor can be days in the month or a fixed number of days',
          'Monthly report per branch with totals, warnings and CSV export',
          'Payroll page is visible to the owner only',
        ],
      },
    ],
  },
  {
    version: 'v2.11.0',
    date: 'Oct 2026',
    title: 'Mobile App & Geofenced Attendance',
    highlights: [
      'Installable PWA with app shell and update prompts',
      'Geofenced employee self check-in/out from mobile app',
      'Optional selfie capture during punch, controlled by owner switch',
      'Owner-only geofence management dashboard',
      'Manager view shows app punch source, distance, and selfie thumbnail on attendance page',
    ],
    details: [
      {
        section: 'Progressive Web App',
        items: [
          'App shell architecture — instant load and fast navigation',
          'Install prompt on compatible browsers (mobile and desktop)',
          'Update notification when new version is available',
          'App shell loads from cache; check-in needs a connection',
        ],
      },
      {
        section: 'Geofenced Attendance',
        items: [
          'Mobile app geofence check-in/out — employee punches from app when within branch geofence (one check-in and one check-out per day)',
          'Distance from the branch location is recorded with every app punch',
          'Any-fence match logic — employee can check in/out from any configured geofence boundary',
          'Gate validation re-checked at punch submit to prevent spoofing',
        ],
      },
      {
        section: 'Selfie Capture',
        items: [
          'Optional selfie during punch — controlled by one owner-managed switch for all branches',
          'Selfies are saved securely and only when the selfie switch is on',
          'Selfies appear as small thumbnails in the manager view so pages stay fast',
        ],
      },
      {
        section: 'Geofence Management',
        items: [
          'New Settings → Geofences tab (owner-only)',
          'Create, edit, deactivate branch geofences with center coordinates and radius',
          'Geofence list view with status and edit controls',
        ],
      },
      {
        section: 'Manager Review',
        items: [
          'PunchMeta component — renders app badge, distance, and selfie thumbnail for manager review',
          'Attendance page shows app punch metadata only for app-sourced punches',
          'Selfie link opens full image in new tab',
        ],
      },
    ],
  },
  {
    version: 'v2.10.0',
    date: 'May 2026',
    title: 'Employee Incentive System',
    highlights: [
      'Configurable per-branch incentive engine driving monthly payouts',
      'Strict-priority ladder (P1 sales-based → P2 service tiers → P3 daily fallback) plus additive daily punctuality bonuses',
      'New Reports → Staff Incentives view with live numbers, lock for payroll, and disburse-as-Expense in one click',
      'Per-branch configuration in Settings — punctuality tiers, P1/P2/P3 numbers, and master enable toggle',
      'Replaces the v2.8.0 outside-shift-hours incentive concept',
    ],
    details: [
      {
        section: 'Compute engine',
        items: [
          'Sales attribution: BillItem.totalPrice (post line-discount) where employee is the primary assignee, type=service, bill not cancelled',
          'Month-bucket date: BillItem.serviceDate when set (matches v2.6.0 pending-services credit rule), else Bill.billDate',
          'Free services count toward P2 service count, ₹0 toward P1/P3 revenue',
          'P1 (sales): if monthly revenue ≥ baseSalary × revenueMultiplier (default 4.75), payout = revenue × payoutRate (default 10%)',
          'P2 (service tiers): default 600/525/450 services → 15/12/10% of base salary; descending tiers, highest match wins',
          'P3 (daily fallback): only when P1 and P2 both produce ₹0 — for each day with revenue ≥ baseSalary × ratio (default 10%), accrue dailyBonus (default ₹50)',
          'Strict priority: P1 wins outright, even if P2 would pay more',
          'Punctuality: per attendance day, ₹80 if ≥45 min early, ₹40 if ≥15 min early (defaults). Reference is shift_start, falling back to branch openTime; flexible-timing staff excluded',
          'Always live by default; locked snapshots take over for the month once owner clicks Lock for payroll',
        ],
      },
      {
        section: 'Configuration (per branch)',
        items: [
          'New Settings → Staff Incentives tab (owner-only)',
          'Punctuality tiers, P1 multiplier and rate, P2 service-count tiers and rates, P3 daily threshold and bonus all editable per branch',
          'Add/remove tier rows directly in the form; on save tiers are normalised in descending order',
          'Master enable toggle per branch — when off, all employees there get ₹0 incentive',
          'Reset to defaults button restores the seeded values for that branch',
          'Defaults: ≥45min/₹80, ≥15min/₹40 punctuality; P1 4.75×/10%; P2 600/525/450 → 15/12/10%; P3 10%/₹50',
        ],
      },
      {
        section: 'Reports → Staff Incentives',
        items: [
          'Per-employee row showing base salary, services, revenue, applied priority, monthly bonus, punctuality, and total payout',
          'Expandable details: priority math (which of P1/P2/P3 fired and why) plus per-tier punctuality day counts',
          'Month and branch picker; live indicator when any row is unlocked, locked badge once frozen, disbursed badge after payout',
          'Lock month for payroll — writes EmployeeIncentiveMonth snapshots for every active employee with base_salary set',
          'Recompute snapshot — re-runs the engine for already-locked rows (skipped once disbursed)',
          'Disburse all — one Expense per employee under category "Incentive Payout", linked to the snapshot via disbursedExpenseId',
          'Visible to owner, manager, cashier; hidden from the employee role',
        ],
      },
      {
        section: 'Schema & Migrations',
        items: [
          'New tables: branch_incentive_configs, employee_incentive_months',
          'Reuses EmployeeDetail.base_salary, .shift_start, .has_flexible_timing — no duplicate columns',
          'Seed: "Incentive Payout" expense category; default config row backfilled for every existing branch',
          'Branch creation auto-creates the default config row for the new branch',
        ],
      },
      {
        section: 'Notes',
        items: [
          'Outside-shift hours field is still computed (working-hours pay) but no longer surfaced as an incentive',
          'No proration for partial-month staff — joiners/leavers naturally fall back to P3 daily accruals',
          'Salary mid-month change: live view uses current value, snapshot stores the value at lock time',
          'No auto-lock cron — locking is owner-driven, any time after month-end',
        ],
      },
    ],
  },
  {
    version: 'v2.9.0',
    date: 'May 2026',
    title: 'Skills, Tokens, SKU & Warehouse',
    highlights: [
      'Skill-based employee allocation — auto-assigns the next available staff with the right skill',
      'Customer Token system — branch-scoped daily tokens with bill-page lookup',
      'SKU layer with auto-generated barcodes and bulk label printing',
      'Warehouse management — purchases land at a warehouse, transfer to branches with cost-based ledger',
      'Branch can be flagged as salon, warehouse, or both',
      'Five new warehouse/inventory reports',
    ],
    details: [
      {
        section: 'Skill-based Employee Allocation',
        items: [
          'New Skills page (owner/manager) — free-form skill tags, create/edit/deactivate',
          'Staff form: assign skills to each employee via multi-select',
          'Service form: pick required skills (shows ALL active skills, not just employee-assigned)',
          'Allocation runs when a service is added to the cart and when token services are pulled in',
          'Eligibility: checked-in today, not on break, no in-progress BillItem assigned',
          'Strict per-skill round-robin among eligible staff; tie-break by earliest check-in',
          'Multi-employee services auto-fill the first slot; cashier picks the rest',
          'No-skill or no-eligible-staff: leave blank + inline warning, never block the cart-add',
          'Cashier can always reallocate manually — no hard lock',
          'Branch-scoped: only employees on duty at the current branch are considered',
        ],
      },
      {
        section: 'Customer Token System',
        items: [
          'New Tokens page — issue tokens with optional services, customer name, and phone',
          'Token format: <BRANCH_CODE>-NNN, sequence resets per branch per shop-day (e.g., PUN-001)',
          'Quick customer create inline — phone is the lookup key; matches existing customer if found',
          'Customer name/phone snapshot stored on the token so printed slip stays correct',
          'Token slip print — number-only (no barcode/QR), customer details, services list',
          'Bill page: enter token number or pick from "Open tokens" list to pull services into the cart',
          'Pulled services run through skill-based allocation automatically',
          'Lifecycle: open → consumed | expired | cancelled (rows kept for history, never deleted)',
          'Daily reset cron fires at (branch open time − 2h) IST and expires still-open tokens',
          'Branch-scoped: tokens issued at Branch A cannot be redeemed at Branch B',
          'Multiple open tokens per customer allowed; available to all roles except employee',
        ],
      },
      {
        section: 'SKU & Barcode Printing',
        items: [
          'New SKU layer — products are now variants under an SKU (e.g., "Loreal Shampoo" → 100ml/250ml/500ml)',
          'New SKUs page (owner/manager) for creating and managing SKUs',
          'Products page restructured — every product picks its parent SKU; brand/category live on the SKU',
          'Barcodes auto-generated on product create (10-char base36, unique, Code 128 encoding)',
          'Admin can regenerate a product barcode (audit-logged) when a label is lost',
          'New Barcode Print page — multi-select products, set qty per product, print label sheet',
          'Three label sizes shipped: 50×25 mm, 38×25 mm, 100×50 mm — global setting in Settings',
          'Bill page: scan input resolves a barcode directly to a product variant and adds to cart',
          'Manual product add shows a variant selector when an SKU has multiple products',
        ],
      },
      {
        section: 'Warehouse Management',
        items: [
          'Branch row gains isSalon and isWarehouse flags — a branch can be salon, warehouse, or both',
          'New Warehouses page (owner-only) for managing warehouse-branches',
          'Purchase Batch destination defaults to a warehouse; salon-branch override allowed for emergency buys',
          'Stock Transfers: warehouse → branch transfers valued at sum(qty × costPrice) on completion',
          'Completing a warehouse → branch transfer auto-writes a CashSource at the warehouse and an Expense at the branch (category "Stock from warehouse")',
          'Transfer completion blocks if any product is missing a costPrice — clear error surfaced',
          'Warehouse-only branches hide chairs/staff/billing tabs — only inventory and cash views',
          'Warehouse cash machinery reuses existing PurchaseBatch + PurchasePayment + CashSource flow',
        ],
      },
      {
        section: 'Reports',
        items: [
          'Warehouse stock-on-hand — qty and cost value per product, per warehouse, as-of date',
          'Warehouse purchases ledger — supplier-grouped purchase history per warehouse',
          'Warehouse transfers-out — per-branch transfer summary with valuation',
          'Branch P&L — now includes "Stock from warehouse" as a cost line',
          'Inventory value snapshot — total stock value across warehouses and branches at cost',
        ],
      },
      {
        section: 'Schema & Migrations',
        items: [
          'New tables: skills, employee_skills, service_skills, customer_tokens, skus',
          'Modified: branches (isSalon, isWarehouse), products (skuId required; brand/sku/categoryId removed)',
          'New enum value: CashSourceType.internal_transfer_in; new TokenStatus enum',
          'Dropped: waiting_list table (unused)',
          'Seeds: "Stock from warehouse" expense category, default barcode label size 50×25 mm',
        ],
      },
    ],
  },
  {
    version: 'v2.8.0',
    date: 'Apr 2026',
    title: 'Attendance System, Job Monitoring & Staff Averages',
    highlights: [
      'Full attendance system with punch-machine ingestion and break tracking',
      'Per-branch shop hours (with cross-midnight support) and per-employee shifts',
      'Auto-close scheduler: auto-checkout from last bill, auto-leave for no-shows',
      'Flexible-timing privilege per employee (no late penalty)',
      'New Jobs page (owner/developer) with scheduler execution history',
      'Three new staff averages on Employee Performance: services/day, work/day, revenue/service',
    ],
    details: [
      {
        section: 'Attendance & Shift Tracking',
        items: [
          'New Attendance page showing today\'s roster per branch with live status: On floor / On break / Checked out / Not arrived / On leave',
          'Cashier/manager actions on the roster: Start break, End break, Mark leave',
          'Punch ingest API (POST /api/attendance/punches) — idempotent on (employee_code, punch_time)',
          'Break tracking via punch types (break_start / break_end); working hours subtract break durations',
          'Late penalty per locked rule: 15-min grace, past that max(actual_late_hours, 2)',
          'Outside-shift hours computed on checkout (eligible for incentive)',
          'Cross-midnight shop-day semantics — early-morning punches attribute to the prior shop-day',
          'Orphan punches preserved as audit trail when machine or employee can\'t be resolved',
          'Per-employee shift start/end and "Flexible timing" toggle on the staff form',
          'All times in IST',
        ],
      },
      {
        section: 'Branch & Machine Settings',
        items: [
          'Branch edit form: Open time and Close time fields (HH:MM IST); cross-midnight support (e.g., 09:30 → 02:00)',
          'New Machines page (owner/developer) for registering punch machines per branch',
          'Machine → Branch resolution is authoritative: punches from a machine attribute to that branch',
          'Machine registration, edit, activate/deactivate, and delete',
        ],
      },
      {
        section: 'Auto-close Scheduler',
        items: [
          'In-process node-cron, one job per branch, fires at (close time + 10 min) IST',
          'Auto-checkout: employees with a check-in but no check-out are closed using their last completed bill timestamp',
          'Auto-leave: employees with no punch recorded for the day are marked on_leave',
          'Recomputes working hours, late penalty, and outside-shift hours after each auto-close',
          'Scheduler re-arms automatically when branch hours or active state change',
          'Manual recovery: POST /api/attendance/run-auto-close (owner/developer) for missed windows',
        ],
      },
      {
        section: 'Billing & Staff Picker',
        items: [
          'Bill create page excludes employees marked on_leave for the current shop-day from all staff pickers',
          'Roster data auto-refreshes every 60 seconds to reflect late-day changes',
        ],
      },
      {
        section: 'Reports & Staff Averages (Feature 1)',
        items: [
          'Employee Performance now returns three new per-staff metrics:',
          '  • avg_services_per_day = total services ÷ attendance days',
          '  • avg_work_per_day = total revenue ÷ attendance days',
          '  • avg_revenue_per_service = total revenue ÷ total services',
          'Denominator uses attendance days (present + half_day) within the range',
          'Revenue queries now honor shop-day windows when branch-scoped (cross-midnight bills included in the right day)',
          'New response flag using_shop_day indicates when shop-day semantics are applied',
          'Backfill script (scripts/recompute-performance-shopday.js) to re-aggregate historical EmployeePerformance by shop-day — manually triggered, never auto-run',
        ],
      },
      {
        section: 'Job Monitoring',
        items: [
          'New Jobs page (owner/developer) — scheduler execution history with filters, status badges, and detail modal',
          'Shows currently-scheduled cron jobs per branch with the actual cron expression',
          'Every scheduled and manually-triggered job records a JobRun audit row (status, duration, summary, error stack)',
          'Records retained for 30 days; daily retention prune runs at 03:00 IST and logs itself',
          'REST endpoints: GET /api/jobs, /api/jobs/:id, /api/jobs/names, /api/jobs/scheduled',
          '30-second auto-refresh on the Jobs table',
        ],
      },
    ],
  },
  {
    version: 'v2.7.0',
    date: 'Apr 2026',
    title: 'Maintenance Tracker, Filter Persistence & Cashier Permissions',
    highlights: [
      'New Maintenance Tracker module for repair/servicing tracking',
      'Filter persistence via URL parameters — filters survive navigation',
      'Cashier can now create/edit UPI accounts and packages',
      'Employee ID search across staff list',
      'Assets tab visible on new staff form with save-first prompt',
    ],
    details: [
      {
        section: 'Maintenance Tracker',
        items: [
          'New standalone module to track items sent for repair or servicing',
          'Record item details, vendor info (name, phone, address), costs, and dates',
          'Status workflow: Sent → In Progress → Ready → Returned (or Cancelled)',
          'Filter by branch, status, and date range with pagination',
          'Accessible to all user roles — create/edit for owner, manager, cashier; delete for owner only',
          'Sidebar navigation item visible to all roles',
        ],
      },
      {
        section: 'Filter Persistence',
        items: [
          'Staff Performance filters now sync to URL search parameters',
          'Clicking a bill from Staff Performance and pressing back restores all filters',
          'New reusable useFilterParams hook for any page with filters',
          'Bill detail page back button respects returnTo parameter from referring pages',
        ],
      },
      {
        section: 'Cashier Permissions',
        items: [
          'Cashier role can now create and edit UPI/API accounts',
          'Cashier role can now create and edit service packages',
          'Delete access remains restricted to owner/developer roles',
        ],
      },
      {
        section: 'Staff Management',
        items: [
          'Employee ID (employee code) now searchable in the staff list',
          'Assets tab always visible on staff form — shows "Save staff member first" prompt for new staff',
        ],
      },
    ],
  },
  {
    version: 'v2.6.0',
    date: 'Mar 2026',
    title: 'Pending Services, Searchable Employees & Staff Access',
    highlights: [
      'Pending services overhaul — removed partial billing',
      'Same employee for all services in package billing',
      'Searchable employee dropdown in billing forms',
      'Staff performance visible to cashier and manager',
      'Optional time field on expenses',
      'Employee credit based on actual service date',
    ],
    details: [
      {
        section: 'Billing — Pending Services',
        items: [
          'Removed partial billing — bills are always fully completed with full payment upfront',
          'Individual services can be marked as "pending" during bill completion (to be performed later)',
          'Employee assignment is cleared for pending services — assigned when service is actually completed',
          'New "Pending Services" tab on Bills page showing all pending items with "Complete" action',
          '"Complete" button on pending items in bill detail page',
          'Revenue recognized at bill date regardless of pending services',
          'Employee credit attributed to the actual service date, not the bill date',
        ],
      },
      {
        section: 'Billing — Employee Selection',
        items: [
          '"Same employee for all services" checkbox for package billing — pick one employee for all services',
          'Searchable employee dropdown replaces native select in all billing forms',
          'Type to filter employees by name instead of scrolling through long lists',
          'Available in compact size for inline package service rows',
        ],
      },
      {
        section: 'Staff Performance',
        items: [
          'Staff performance page now accessible to cashier and manager roles',
          'Manager/cashier view shows service counts, star points, and daily averages only',
          'Financial data (earnings, sales, incentives, revenue chart) hidden for non-owner roles',
          'Branch auto-filtered for non-owner roles (no branch selector)',
          'CSV export restricted to owner/developer roles',
        ],
      },
      {
        section: 'Expenses',
        items: [
          'Optional time field added to expense creation and editing',
          'Time displayed alongside date in expenses list when present',
        ],
      },
      {
        section: 'Reporting',
        items: [
          'Employee performance reports use actual service date for credit attribution',
          'Pending items (no employee assigned) excluded from performance reports',
          'Services completed later appear in reports on their actual service date',
        ],
      },
    ],
  },
  {
    version: 'v2.5.0',
    date: 'Mar 2026',
    title: 'Expenses, Savings Pot Access & Staff Performance',
    highlights: [
      'Savings pot deposits auto-create expense records',
      'Manager & cashier roles can create, edit, and deposit into savings pots',
      'Staff performance matrix rows grouped by bill number',
      'Employee pills show earnings alongside star points',
      'Page totals in staff performance matrix',
      'Expenses page layout improvements',
      'UPI account dropdown fix in expense modal',
    ],
    details: [
      {
        section: 'Expenses',
        items: [
          'Auto-expense on savings pot deposit — each deposit batch creates an expense under "Savings Pot Deposit" category so it appears in expense reports',
          'Cascade delete — deleting a savings pot also removes its linked expense records',
          'Layout reorder — search and filters moved above stat cards for faster access',
          'Stat cards simplified — Total Expenses and Expense Count in a clean two-column row',
          'UPI dropdown fix — expense modal now correctly shows UPI account names when payment mode is UPI',
        ],
      },
      {
        section: 'Savings Pots — Role Access',
        items: [
          'Manager and cashier roles can now create new savings pots',
          'Manager and cashier roles can edit existing savings pots',
          'Cashier role can now make deposits (previously manager and above only)',
          'Edit button visibility based on manager/cashier/owner role',
          'Delete button restricted to owner role only',
          'Person management (add/edit/delete) remains owner-only',
        ],
      },
      {
        section: 'Staff Performance',
        items: [
          'Employee pills show service earnings next to star points for quick comparison',
          'Matrix column headers show star points instead of service count',
          'Matrix rows grouped by bill number — collapsed by default, click to expand individual bills',
          'Single-service bills render as simple rows without expand/collapse',
          'Multi-service bills show a summary parent row with summed amounts per employee',
          'Page total footer row — shows per-employee totals for the current page',
        ],
      },
    ],
  },
  {
    version: 'v2.4.0',
    date: 'Mar 2026',
    title: 'Savings Pot Validation, Hard Delete & Timestamps',
    highlights: [
      'Duplicate account number validation on savings pots',
      'Hard delete for savings pots with confirmation dialog',
      'Full timestamps on deposits and withdrawals',
      'Styled confirmation dialog replaces browser popups',
    ],
    details: [
      {
        section: 'Savings Pots',
        items: [
          'Duplicate account number check — friendly error when creating or editing a pot with an account number already in use',
          'Hard delete — deleting a pot now permanently removes it along with all deposit and withdrawal records (previously soft-deleted)',
          'Full timestamps — deposit and withdrawal dates now store the exact date and time instead of date only',
          'Inactive pot cleanup — all previously soft-deleted pots have been permanently removed from the database',
        ],
      },
      {
        section: 'UI Improvements',
        items: [
          'Confirmation dialog — styled modal with warning icon replaces browser confirm() popups for delete actions',
          'Loading state shown on confirm button while delete is in progress',
          'Reusable ConfirmDialog component with destructive and default variants',
        ],
      },
    ],
  },
  {
    version: 'v2.3.0',
    date: 'Mar 2026',
    title: 'Savings Pot Persons, Cash Drawer & Setup Guide',
    highlights: [
      'Savings Pot person management with grouped accordion view',
      'Cash drawer overhaul with opening balance carry-forward',
      '"Other" text fields for expense category & payment mode',
      'Setup checklist in Settings for system prerequisites',
      'Bill number column in Staff Performance services-by-time',
      'Employee removal on billing page packages',
    ],
    details: [
      {
        section: 'Savings Pots',
        items: [
          'Person management — create, edit, delete persons who own savings pots (branch-scoped)',
          'Grouped accordion view — persons as collapsible sections, each showing their pots with totals',
          'Person-scoped deposits — select person in deposit modal, only their pots shown for allocation',
          'Branch auto-inferred from person when creating a new pot — no separate branch dropdown needed',
          'Payment mode on deposits — track cash, card, UPI, online, or other (only cash affects drawer)',
        ],
      },
      {
        section: 'Cash Drawer',
        items: [
          'Opening balance carry-forward — uses last reconciliation actual cash, or branch starting balance, or zero',
          'Cash reconciliation records — upsert per branch per date, replaces old CashSource approach',
          'Starting cash balance — owner sets once per branch as the initial seed value',
          'Dashboard cash status — per-branch cash drawer overview on Owner Dashboard',
          'Savings pot cash deposits now subtracted from expected cash in daily summary',
        ],
      },
      {
        section: 'Expenses',
        items: [
          '"Other" category text box — specify custom category name when expense category is "Others"',
          '"Other" payment mode text box — specify custom payment method when mode is "other"',
          'Both fields displayed inline in the expenses list and included in expense records',
        ],
      },
      {
        section: 'Settings & Setup',
        items: [
          'Setup Guide tab in Settings — checklist of prerequisites to make the system work correctly',
          'Progress bar showing completion status across 9 setup items',
          'Three tiers: Essential (branches, employees, services), Recommended (chairs, business info, cash balance), Optional (UPI, categories, savings persons)',
          'Direct links to relevant pages for each incomplete setup item',
          'Counter Withdrawals and Bank Receipts hidden from sidebar navigation (data preserved)',
        ],
      },
      {
        section: 'Billing & Staff',
        items: [
          'Bill number column in Staff Performance services-by-time table and CSV export',
          'Employee removal buttons on package service slots in billing page (add and remove employees)',
        ],
      },
    ],
  },
  {
    version: 'v2.2.0',
    date: 'Mar 2026',
    title: 'Privacy, Branch Colors & Bank Receipts',
    highlights: [
      'Mobile-friendly sidebar navigation',
      'Role-based phone number privacy',
      'UPI account selection in expenses',
      'Branch color coding across the app',
      'Savings pot account numbers',
      'Bank Receipts page for cashiers',
    ],
    details: [
      {
        section: 'Mobile Experience',
        items: [
          'Slide-out navigation drawer on mobile — hamburger menu now opens a proper sidebar with smooth animation',
          'Auto-close drawer on page navigation for seamless browsing',
          'Tap-to-dismiss backdrop overlay when drawer is open',
          'Correct z-index layering so drawer renders above header and content',
        ],
      },
      {
        section: 'Privacy & Security',
        items: [
          'Phone numbers masked for cashier and employee roles — password-style input on forms, masked display in lists',
          'Admin and manager roles retain full phone number visibility',
        ],
      },
      {
        section: 'Finance',
        items: [
          'UPI account selection when recording UPI expenses — dropdown of active accounts with validation',
          'UPI account name displayed alongside payment mode in expense list',
          'Savings pots now require an account number — displayed prominently on pot cards',
          'Active/Inactive status badge always shown on savings pot cards',
          'Bank Receipts — new dedicated page for viewing and editing bank deposit records',
          'Cashiers can view last 3 days of bank deposits with edit access controlled per record',
          'Admin/Manager can view full deposit history with date and branch filters',
        ],
      },
      {
        section: 'Branch Management',
        items: [
          'Branch color picker — assign a hex color to each branch from branch settings',
          'Color-coded branch dots displayed across Staff list, Staff Performance, Branches, Counter Withdrawals, and Owner Dashboard',
          'Multi-branch employees show multiple color dots in performance reports',
        ],
      },
    ],
  },
  {
    version: 'v2.1.0',
    date: 'Mar 2026',
    title: 'Billing UI Redesign',
    highlights: [
      'Collapsible sidebar navigation (global)',
      'Single-screen POS-style billing layout',
      'Cart + Checkout merged into one panel',
      'Compact inline employee assignment for packages',
      'Two-column service grid in cart for packages',
      'Payment modes show icon + label text',
    ],
    details: [
      {
        section: 'Collapsible Sidebar (Global)',
        items: [
          'Sidebar toggles between full width (256px) and icon-only rail (64px)',
          'Flyout menus on hover for grouped nav items when collapsed',
          'Collapse/expand toggle button at bottom of sidebar',
          'Content area max-width constraint removed when sidebar is collapsed',
        ],
      },
      {
        section: 'Billing Page — Layout Overhaul',
        items: [
          'Sidebar auto-collapses on billing page entry, restores on exit',
          'Top section condensed from a full Card to a compact inline strip',
          'Bottom checkout bar eliminated — merged into the right cart panel',
          'Cart panel widened from 400px to 480px for better content density',
          'Barcode scanner only shown when Products tab is selected',
        ],
      },
      {
        section: 'Package UX Improvements',
        items: [
          'Inline single-row employee assignment — service name, price, and staff dropdowns on one row',
          'OR group service selector and employees on one compact row',
          'Package services in cart displayed in a two-column grid layout',
          'Employee name badges styled with primary color and white text for visibility',
        ],
      },
      {
        section: 'Payment & Checkout',
        items: [
          'Payment mode buttons show icon + label text (Cash, Card, UPI) instead of icon-only',
          'Discount, payment splits, notes, and submit buttons in scrollable cart panel',
          'Sticky cart header and submit buttons — always visible while cart content scrolls',
        ],
      },
    ],
  },
  {
    version: 'v2.0.0',
    date: 'Mar 2026',
    title: 'Finance & Inventory Expansion',
    highlights: [
      'Savings Pots for cash management',
      'Counter Withdrawals tracking',
      'UPI Account management',
      'Suppliers & Purchase Batches',
      'Product Incentive configuration',
      'Barcode scanning for products',
      '80mm thermal receipt printing',
      'Service Liability & Supplier Credit reports',
    ],
    details: [
      {
        section: 'Finance Module',
        items: [
          'Savings Pots — create pots, deposit, withdraw, and view full transaction history',
          'Counter Withdrawals — track cash removed from the counter with reason and approvals',
          'UPI Account management — add and manage UPI payment accounts for the salon',
        ],
      },
      {
        section: 'Inventory & Procurement',
        items: [
          'Suppliers — full supplier directory with contact details and credit tracking',
          'Purchase Batches — create purchase orders, track batches with cost price and quantities',
          'Barcode scanning — scan product barcodes during billing and inventory operations',
        ],
      },
      {
        section: 'Staff & Incentives',
        items: [
          'Product Incentives — configure per-product incentive rules for staff members',
        ],
      },
      {
        section: 'Billing & Receipts',
        items: [
          '80mm thermal receipt support — compact receipt layout optimized for thermal printers',
        ],
      },
      {
        section: 'Reports',
        items: [
          'Service Liability report — track outstanding service commitments from packages',
          'Supplier Credit report — monitor unpaid supplier balances',
        ],
      },
    ],
  },
  {
    version: 'v1.5.0',
    date: 'Feb 27, 2026',
    title: 'Bill Details & Staff CSV Export',
    highlights: [
      'Editable book number in bill detail',
      'CSV download in Staff Performance',
    ],
    details: [
      {
        section: 'Billing',
        items: [
          'Book number field is now editable directly from the bill detail page',
        ],
      },
      {
        section: 'Staff Performance',
        items: [
          'Download staff performance data as CSV for external analysis',
        ],
      },
    ],
  },
  {
    version: 'v1.4.0',
    date: 'Feb 22-25, 2026',
    title: 'Billing Enhancements & Expenses',
    highlights: [
      'Free service handling in bills',
      'Add customer directly from billing',
      'Expenses module',
      'Fuzzy search in item selection',
      'Book number field in bills',
      'IST date formatting throughout',
    ],
    details: [
      {
        section: 'Billing',
        items: [
          'Free service handling — mark services as free with reason tracking',
          'Add new customer directly from the billing page without navigating away',
          'Fuzzy search — quickly find services and products with approximate matching',
          'Book number field — assign physical bill book numbers to bills',
          'IST date formatting — all dates now display in Indian Standard Time',
        ],
      },
      {
        section: 'Finance',
        items: [
          'Expenses module — record and categorize salon expenses with date and notes',
        ],
      },
    ],
  },
  {
    version: 'v1.3.0',
    date: 'Feb 17-20, 2026',
    title: 'Service Selection & Printing',
    highlights: [
      'Optional service selection in bills',
      'Bill printing improvements',
      'Staff assets tab',
      'Package service filtering',
    ],
    details: [
      {
        section: 'Billing',
        items: [
          'Optional service selection — services can be individually toggled on/off in bills',
          'Bill printing improvements — cleaner layout and better formatting for printed bills',
        ],
      },
      {
        section: 'Staff',
        items: [
          'Assets tab — track equipment and tools assigned to each staff member',
        ],
      },
      {
        section: 'Packages',
        items: [
          'Service filtering — filter and search services when creating or editing packages',
        ],
      },
    ],
  },
  {
    version: 'v1.2.0',
    date: 'Feb 13, 2026',
    title: 'Salon Floor / Chair Management',
    highlights: [
      'Chair management system',
      'Real-time chair status tracking',
    ],
    details: [
      {
        section: 'Salon Floor',
        items: [
          'Chair Management — add, edit, and organize salon chairs/stations',
          'Real-time status tracking — see which chairs are occupied, available, or under maintenance',
        ],
      },
    ],
  },
  {
    version: 'v1.1.0',
    date: 'Feb 11, 2026',
    title: 'Performance & Management Tools',
    highlights: [
      'Employee star performance ratings',
      'Service & package management',
      'Bill receipt printing',
      'Customer ID formatting',
      'Frontend/backend architecture split',
    ],
    details: [
      {
        section: 'Staff',
        items: [
          'Star performance ratings — rate employee performance with a star-based system',
        ],
      },
      {
        section: 'Catalog',
        items: [
          'Service management — full CRUD for salon services with pricing and duration',
          'Package management — create service bundles with discounted pricing',
        ],
      },
      {
        section: 'Billing',
        items: [
          'Receipt printing — generate and print professional receipts from bill detail',
          'Customer ID formatting — cleaner display of customer identifiers',
        ],
      },
      {
        section: 'Architecture',
        items: [
          'Frontend/backend split — separated into independent deployable units',
        ],
      },
    ],
  },
  {
    version: 'v1.0.0',
    date: 'Feb 7-10, 2026',
    title: 'Initial Release',
    highlights: [
      'Dashboard with key metrics',
      'Customer management',
      'Billing system',
      'Services & Products catalog',
      'Inventory tracking',
      'Reports & Analytics',
      'Staff management',
      'Multi-branch support',
      'Settings & configuration',
    ],
    details: [
      {
        section: 'Dashboard',
        items: [
          'Role-based dashboards for Owner, Manager, Cashier, and Employee',
          'Key business metrics — revenue, bills, customer counts at a glance',
        ],
      },
      {
        section: 'Customers',
        items: [
          'Customer directory with search and filtering',
          'Customer detail pages with visit history and billing records',
        ],
      },
      {
        section: 'Billing',
        items: [
          'Create bills with services, packages, and products',
          'Multiple payment methods — cash, card, UPI',
          'Bill listing with status tracking (pending, completed, cancelled)',
        ],
      },
      {
        section: 'Catalog',
        items: [
          'Services — define salon services with name, price, duration, and category',
          'Products — manage retail products with stock tracking',
        ],
      },
      {
        section: 'Inventory',
        items: [
          'Stock level monitoring across branches',
          'Stock transfer between branches with approval workflow',
        ],
      },
      {
        section: 'Reports',
        items: [
          'Revenue reports with date range filtering',
          'Service and product performance analytics',
        ],
      },
      {
        section: 'Administration',
        items: [
          'Staff management with role-based access control',
          'Multi-branch setup and configuration',
          'Application settings and preferences',
        ],
      },
    ],
  },
]
