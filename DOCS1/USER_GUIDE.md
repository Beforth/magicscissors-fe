# User Guide

This guide is for people who **use** Salon ERP day to day — not for programmers. If you need setup or API details, see the [Developer Guide](./DEVELOPER_GUIDE.md).

## How to access the project

1. Open the Salon ERP website in your browser (your manager or IT will give you the address).
2. On the login screen, enter your **username** and **password**.
3. Choose **Log in** (or the equivalent button on that screen).
4. You land on **Dashboard** for your role.

If you were given demo accounts on a training system, they may look like `owner`, `manager1`, `cashier1`, or `employee1` — ask your administrator; do not share passwords.

⚠️ **NEEDS CONFIRMATION:** The live production URL is not fixed in the code. Use the link your team provides.

## Getting to know the screen

After login you usually see:

- **Left sidebar** — main menu. Some items are single links; **Catalog**, **Inventory**, and **Finance** open a short list when you click them.
- **Top header** — notifications (bell), check-in related controls, and your user menu (Settings, Log out). Profile in that menu currently does not open a real page.
- **Main area** — the page for whatever you clicked.
- **Brand** — “Salon ERP” at the top of the sidebar. The version text under it opens **Version history** (no sidebar on that page).

**Lists:** Most screens show a table or card list with search/filters and buttons like Add / New / Edit.

**Forms:** Fill fields, then save. Required fields usually block save until filled.

**Roles and menus:** You only see menu items allowed for your job. That does **not** always mean every page is blocked if someone pastes a link — ask an owner if you see something you should not.

| Role (typical) | What you usually see |
| --- | --- |
| Owner / developer | Full menu including Branches, Settings, Jobs, Machines |
| Manager | Most operations plus Reports and Shift; not Branches/Settings/Jobs/Machines |
| Cashier | Floor, billing, inventory, finance, staff, attendance — not Reports or Shift |
| Employee | Dashboard, Maintenance, Docs |

## Glossary

| Term | Plain meaning |
| --- | --- |
| Branch | One salon or warehouse location |
| Token | A numbered ticket for a customer visit that day |
| Salon Floor | The chair board — who sits where |
| Bill | The charge sheet for services, packages, and products |
| SKU | The product “family” name before size/variant |
| Stock transfer | Moving stock between locations |
| Cash Drawer | Counting and reconciling till cash |
| UPI account | A named UPI destination used when recording payments |
| Savings pot | A savings scheme tracked in the app |
| Attendance | Who punched in/out (or was marked) for the day |

## Quick start — most common tasks

| Task | What to click |
| --- | --- |
| Start a visit / token | Sidebar **Tokens** |
| See chairs / floor | Sidebar **Salon Floor** |
| Create or find a bill | Sidebar **Billing** |
| Look up a customer | Sidebar **Customers** |
| Check today’s money | Sidebar **Finance** → **Cash Drawer** |
| See your home screen | Sidebar **Dashboard** |

## Screens and what you can do

### Login (how you get here: open the app while logged out)

Sign in with username and password. If you are already signed in, the app sends you to your dashboard.

### Dashboard (sidebar: **Dashboard**)

Role-specific home with shortcuts (for example to billing or customers). Owners see a broader picture; cashiers see till-oriented shortcuts.

### Customers (sidebar: **Customers**)

Browse and search customers. Open a row to see that customer’s detail and history. Create or edit when your role allows.

**Customer detail** — not in the sidebar. Reach it by clicking a customer on the Customers list.

### Salon Floor (sidebar: **Salon Floor**)

Chair board for the branch: status, assign/release chairs as your process requires.

### Billing (sidebar: **Billing**)

List of bills. Start a new bill or open an existing one.

**New bill** — not in the sidebar. Use **Billing** then the new/create control, or shortcuts from some dashboards.  
**Bill detail** — not in the sidebar. Open a bill from the list (or after create).

Typical bill flow:

1. Open **Billing**.
2. Start a new bill (or open an open bill).
3. Attach customer, services/packages/products, staff as needed.
4. Complete payment and finish the bill when ready.

### Employee Status (sidebar: **Employee Status**)

Floor view of who is busy / available related to service work.

### Tokens (sidebar: **Tokens**)

Create and manage daily customer tokens (lookup, cancel when allowed).

### Catalog → Services (sidebar: **Catalog**, then **Services**)

Service menu: list, add, edit.  
**New / edit service** — from buttons on this page (not separate sidebar items).

### Catalog → Packages (sidebar: **Catalog**, then **Packages**)

Package offers and related setup.

### Catalog → Skills (sidebar: **Catalog**, then **Skills**)

Skills used to match staff to work.

### Inventory → SKUs (sidebar: **Inventory**, then **SKUs**)

Product families (SKUs).

### Inventory → Products (sidebar: **Inventory**, then **Products**)

Sellable/stocked variants (barcodes, prices). New/edit via page buttons.

### Inventory → Warehouses (sidebar: **Inventory**, then **Warehouses**)

Warehouse locations. Creating a warehouse uses a page reached from here (**Warehouses** → new), not the main nav.

### Inventory → Stock Levels (sidebar: **Inventory**, then **Stock Levels**)

On-hand quantities; adjust or inspect as your role allows. Low-stock alerts on some dashboards also send you here.

### Inventory → Stock Transfers (sidebar: **Inventory**, then **Stock Transfers**)

Create and approve/reject/cancel transfers between locations. Header notifications for stock transfers can also open this page.

### Inventory → Suppliers (sidebar: **Inventory**, then **Suppliers**)

Supplier records.

### Inventory → Purchase Batches (sidebar: **Inventory**, then **Purchase Batches**)

Purchase orders/batches, receive stock, record payments. Detail and “new batch” pages open from this list.

### Inventory → Print Barcodes (sidebar: **Inventory**, then **Print Barcodes**)

Print barcode labels for products.

### Maintenance (sidebar: **Maintenance**)

Equipment / maintenance records. Employees can open this item.

### Reports (sidebar: **Reports**) — manager / owner / developer

Sales, inventory, consumption, and other reports your role is allowed to see.

### Finance → Savings Pots (sidebar: **Finance**, then **Savings Pots**)

Create pots, record deposits and withdrawals, view history.

### Finance → Cash Drawer (sidebar: **Finance**, then **Cash Drawer**)

Daily cash summary, reconciliation, deposits as shown on that screen.

### Finance → Expenses (sidebar: **Finance**, then **Expenses**)

Record and review branch expenses and categories (where allowed).

### Finance → UPI Accounts (sidebar: **Finance**, then **UPI Accounts**)

Manage named UPI accounts and related daily collection views.

### Staff (sidebar: **Staff**)

Staff list; add/edit opens form pages from this screen. Performance-related tools also appear under **Staff Performance**.

### Shift (sidebar: **Shift**) — manager / owner / developer

Shift definitions. Day assignments open from this page (**assignments** for a date) — not a top-level sidebar link.

### Attendance (sidebar: **Attendance**)

Daily/monthly attendance, leave marking, time corrections (as allowed). Machines may punch in automatically if configured by an owner.

### Staff Performance (sidebar: **Staff Performance**)

Performance and incentive-related views for allowed roles. Some roles are redirected away if they should not use this page.

### Branches (sidebar: **Branches**) — owner / developer

List and edit branches; new/edit forms open from this page.

### Settings (sidebar: **Settings**) — owner / developer in sidebar

System settings, setup checklist, attendance API keys, incentive-related configuration surfaces.  
**Also:** header user menu → **Settings** (visible even when Settings is hidden from the sidebar for your role).

### Jobs (sidebar: **Jobs**) — owner / developer

Background job run history and scheduled job info.

### Machines (sidebar: **Machines**) — owner / developer

Attendance / biometric machine records.

### Docs (sidebar: **Docs**)

In-app help documents (and first-time prompts where enabled).

### Version history (how to reach it: click the **version text** under “Salon ERP” in the sidebar)

Lists product version notes. No main sidebar layout on this page.

### Screens with no normal menu link

| Screen | How to reach it |
| --- | --- |
| Counter withdrawals | No link found in the app — direct URL only (`/counter-withdrawals`) if your team uses it |
| Bank receipts / bank deposits page | No link found — direct URL only (`/bank-deposits`). Cash Drawer may show related deposit data without opening this page |
| Profile | Header **Profile** currently goes nowhere useful (no profile page) |

## Example workflows

### A. Walk-in customer to paid bill (cashier)

1. Sidebar **Tokens** — create a token for the customer (or look up an existing one).
2. Sidebar **Salon Floor** — place the guest on a chair if that is your process.
3. Sidebar **Billing** — create a bill, add services/products, assign staff as needed.
4. Complete payments (cash / UPI / etc.) and finish the bill.
5. Optional: Sidebar **Finance** → **Cash Drawer** later to reconcile cash.

### B. Receive supplier stock (manager / cashier with access)

1. Sidebar **Inventory** → **Suppliers** — ensure the supplier exists.
2. **Inventory** → **Purchase Batches** — create a batch, add lines, receive stock when goods arrive.
3. **Inventory** → **Stock Levels** — confirm quantities.
4. If moving to a salon store: **Stock Transfers**.

### C. Owner checks the business

1. **Dashboard**.
2. **Reports** for sales / inventory views.
3. **Branches** / **Settings** for configuration.
4. **Jobs** if investigating automated overnight tasks.

## FAQ

### “I can’t find X in the menu”

Menus change by role. Cashiers do not get **Reports**, **Shift**, **Branches**, **Settings**, **Jobs**, or **Machines**. Employees mainly see **Dashboard**, **Maintenance**, and **Docs**. Ask an owner to change your role or do the task for you.

### “Login failed” / “I keep getting logged out”

Check username/password with your admin. If the session expires, sign in again. On shared PCs, always **Log out** from the user menu.

### “Settings is missing for me but I need it”

Owners/developers see **Settings** in the sidebar. Others may still open **Settings** from the header user menu; if the page will not let you change anything, you need a higher role.

### “Profile does nothing”

Known gap: header **Profile** does not open a working page. Use **Settings** (password change may be available there depending on build) or ask an admin to reset your password.

### “Where are counter withdrawals / bank deposit pages?”

They are not listed under **Finance** in the sidebar. Only open them if your team gave you a direct link.

## Further reading

- [README](./README.md) — what the product is
- [Developer Guide](./DEVELOPER_GUIDE.md) — technical setup and API
- In-app **Docs**, and repo [HELP_BOOK.md](../HELP_BOOK.md) for longer help text

## What changed in this update

- Replaced TODO scaffold with a zero-jargon guide driven by real sidebar labels in `Sidebar.jsx`.
- Documented nested Catalog / Inventory / Finance clicks, non-nav routes, and dead Profile / URL-only finance pages.
- Added quick-start table, three workflows, and FAQ for role and login confusion.
