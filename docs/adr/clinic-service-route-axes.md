# Clinic service route axes

Package block **kind** stays the category (physio, bath, paraffin, lab, exam, custom). **Fulfillment** is the route (`PROCEDURE_ORDER`, `LAB_ORDER`, `VISIT`). The package editor can change the route. A saved route is honored only when `fulfillmentExplicit` is true. Older rows still let a lab or exam kind override a stored procedure default, so Nafta packages keep booking labs and visits as they do today.

A procedure type has `blockCategory`. A bath block lists only bath procedures when the category is set. A null category still uses the name fallback until the row is classified. The migration backfills paraffin, bath, then physio.

The catalog contour checkbox is gone. A service stays sellable as an extra. A lab analysis (`kind = lab_panel`) can set `autoPaidOnOpen`. Opening an episode then creates one priced order (`forcePaid`, `releaseAfterPay`, `autoPaidStay`). The lab journal sees it before the cashier. The guest blank stays closed until payment. A package order or a finished order of the same code does not block this paid order. An open non-package order does. A missing list price is written on the episode and does not block the open. Day-end and checkout cancel ordinary unpaid extras and leave `autoPaidStay` orders until they are paid or cancelled by hand. Package auto-labs stay free and are unchanged.

A diagnostic service has `menuSurface` (`LAB`, `DIAGNOSTIC`, `VISIT`). The lab list uses that when it is set. An empty surface still follows the modality kind. `schedulingMode` on a diagnostic service is `FIXED` or `OPEN`. The resource matrix still seats procedure orders only.

A diagnostic service may set `broughtInMaxDays`. The episode analyses list then shows a checkbox and the blank date for that row only. A fresh blank is stored on the episode and the in-house order for that code is not created. Nafta data sets 30 days on `LAB-INFECT`. Other panels stay in-house until the catalog number is filled.

Clinic settings are grouped by chips: clinic, working day, baths, procedures, labs and diagnostics (blank signers), money, patient card, print. The stored keys are unchanged.
