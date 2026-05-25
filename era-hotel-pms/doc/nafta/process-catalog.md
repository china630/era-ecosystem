# Elektraweb process catalog (NotebookLM)

Source: NotebookLM export 2026-05-25. E2E processes for ERA mapping — not per-screen specs.

| process_id | name | trigger | actors | main_screens | era_apps | priority | wave |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PROC-01 | Guest Check-in | Guest arrives | Receptionist | Front Office Control Panel, Reservation | hotel-pms | P0 | 3 |
| PROC-02 | Guest Check-out | Guest departs | Receptionist | Folio Transactions, Front Cash | hotel-pms | P0 | 3 |
| PROC-03 | Night Audit (EOD) | End of day | Night Auditor | Daily InHouse List, End of Day Logs | hotel-pms | P0 | 3 |
| PROC-04 | Medical Package EOD Posting | Night Audit run | System | Folio Transactions | hotel-pms | P0 | 3 |
| PROC-05 | Assign Sanatorium Procedures | Doctor prescribes | Doctor, SPA Admin | Spa Reservation List, Medical Records | clinic, hotel-pms | P0 | 3 |
| PROC-06 | Procedure Schedule Conflict Check | Booking a slot | SPA Admin | Spa Reservation List, Places | hotel-pms | P0 | 3 |
| PROC-07 | Lab Order Lifecycle | Doctor requests lab | Doctor, Nurse | Lab Test Forms, Lab Test Results | clinic | P0 | 3 |
| PROC-08 | Transfer IN (Airport) Request | Flight info provided | Concierge | Airport Transfer Confirmation | hotel-pms | P0 | 4 |
| PROC-09 | Transfer OUT (Hotel) Dispatch | Guest departing | Dispatcher | Hotel Transfer, Vehicle List | hotel-pms | P0 | 4 |
| PROC-10 | Post Transfer Charge to Folio | Transfer confirmed | System | Hotel Transfer, Folio Transactions | hotel-pms | P0 | 4 |
| PROC-11 | Banquet Sales & BEO Creation | Client inquiry | Sales Mgr | Banquet Agreements, Saloons | hotel-pms | P0 | 4 |
| PROC-12 | Banquet Space Blocking | BEO confirmed | Sales Mgr | Event Calendar | hotel-pms | P0 | 4 |
| PROC-13 | Banquet Service Day Execution | Event day arrives | F&B Manager | Pos Check List (Table=Banquet) | fb-pos | P0 | 4 |
| PROC-14 | Post Banquet Folio | Event concludes | Receptionist | Folio Transactions | hotel-pms | P0 | 4 |
| PROC-15 | POS Room Charge | Guest orders in F&B | Waiter | Pos Check List | fb-pos, hotel-pms | P0 | 3 |
| PROC-16 | POS Walk-in Payment | Walk-in pays cash/card | Cashier | Pos Check List | fb-pos | P0 | 3 |
| PROC-17 | POS Open Table Management | Guest sits | Waiter | Open Tables, Table Definition | fb-pos | P0 | 3 |
| PROC-18 | Minibar Posting | Maid checks room | Maid, HK | Minibar Control, Quick Posting | hotel-pms | P1 | 3 |
| PROC-19 | Room Status Update (Clean/Dirty) | Guest leaves/Maid cleans | Maid | HK Room Operations | hotel-pms | P0 | 3 |
| PROC-20 | Out of Order (OOO) Blocking | Maintenance issue | HK Mgr | Closed Room List | hotel-pms | P1 | 3 |
| PROC-21 | Agency Ledger Management | Agency pays deposit | Finance | Agency Statement | finance | P1 | 5 |
| PROC-22 | Invoice Generation (Guest) | Checkout request | Receptionist | Hotel Invoice List | hotel-pms | P0 | 3 |
| PROC-23 | Channel Stop-Sell | High occupancy | Res Manager | Stop Sale, Channel logs | hotel-pms | P1 | 5 |
| PROC-24 | Rate Code / Contract Setup | New season | Sales Mgr | Contract Details, Rate Codes | hotel-pms | P0 | 3 |
| PROC-25 | Prepayment / Deposit Handling | Booking deposit | Cashier | Deposit Transactions, Prepayment | hotel-pms | P0 | 3 |
| PROC-26 | Routing Instructions Setup | Package booking | Receptionist | Folio Routing List | hotel-pms | P0 | 3 |
| PROC-27 | Guest Profile Creation (CRM) | First time booking | Receptionist | Guest Cards | hotel-pms | P0 | 3 |
| PROC-28 | Guest Medical Anamnesis | Doctor consultation | Doctor | Guest Medical Info List | clinic | P0 | 3 |
| PROC-29 | VIP/Repeater Recognition | Guest recognized | Receptionist | Repeater Guest Control | hotel-pms | P1 | 3 |
| PROC-30 | Guest Complaints/Tasks | Guest issues | Guest Rel | Reservation Tasks | hotel-pms | P2 | defer |
| PROC-31 | Daily Currency Exchange Setup | Morning routine | Finance | Daily Currency Rates | finance | P0 | 3 |
| PROC-32 | End of Shift Cash Register | Cashier finishes | Cashier | Front Cash Transactions | hotel-pms | P0 | 3 |
| PROC-33 | POS Z-Report Integration | EOD | System | Cash Register Z Report | finance | P1 | 5 |
| PROC-34 | Master GL Journal Entry | Accounting | Accountant | Journal Entries | finance | P1 | 5 |
| PROC-35 | E-Invoice (AZ) Dispatch | Invoice finalized | Accountant | All Invoices | finance | P1 | 5 |
| PROC-36 | Purchase Requisition | Stock low | Storekeeper | Requisitions | defer | skip | defer |
| PROC-37 | Recipe / Costing Deduction | POS item sold | System | Pos Product Sales Recipe | defer | skip | defer |
| PROC-38 | Fixed Asset Depreciation | Month end | Accountant | Fixed Asset Depreciation | defer | skip | defer |
| PROC-39 | Bulk WhatsApp/Email CRM | Promo campaign | Marketing | EMail Campaigns | defer | skip | defer |
| PROC-40 | Mobile App Booking | Guest uses App | Guest | Guest App Definitions | defer | skip | defer |

## ERA implementation map

| Wave | Processes |
|------|-----------|
| 3 (done / in progress) | PROC-01–07, 15–17, 19, 22, 24–28, 31–32 |
| 4 (HN-7, HN-8) | PROC-08–14 |
| 5 | PROC-21, 23, 33–35 |
| defer | PROC-30, 36–40 |
