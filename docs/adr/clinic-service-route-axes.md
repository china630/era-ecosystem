# Clinic service route axes

Package block **kind** stays the category (physio, bath, paraffin, lab, exam, custom). **Fulfillment** is the route (`PROCEDURE_ORDER`, `LAB_ORDER`, `VISIT`). The package editor can change the route. A saved route is honored only when `fulfillmentExplicit` is true. Older rows still let a lab or exam kind override a stored procedure default, so Nafta packages keep booking labs and visits as they do today.

A procedure type has `blockCategory`. A bath block lists only bath procedures when the category is set. A null category still uses the name fallback until the row is classified. The migration backfills paraffin, bath, then physio.

`usageContour` is `GUEST` or `INTERNAL` on procedure types and diagnostic services. An internal procedure prescribed as an extra is `SCHEDULED` with a zero amount and is not a paid extra. Guest rows stay on the pay path.

A diagnostic service has `menuSurface` (`LAB`, `DIAGNOSTIC`, `VISIT`). The lab list uses that when it is set. An empty surface still follows the modality kind. `schedulingMode` on a diagnostic service is `FIXED` or `OPEN`. The resource matrix still seats procedure orders only.

A diagnostic service may set `broughtInMaxDays`. The episode analyses list then shows a checkbox and the blank date for that row only. A fresh blank is stored on the episode and the in-house order for that code is not created. Nafta data sets 30 days on `LAB-INFECT`. Other panels stay in-house until the catalog number is filled.

Clinic settings are grouped by chips: clinic, working day, baths, procedures, labs and diagnostics (blank signers), money, patient card, print. The stored keys are unchanged.
