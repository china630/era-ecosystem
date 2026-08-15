try {
  const m = require("@era/satellite-kit/ui");
  console.log("ColorLegend", typeof m.ColorLegend);
  console.log("EraListFilterBar", typeof m.EraListFilterBar);
  console.log("FieldSelect", typeof m.FieldSelect);
  console.log("PageHeader", typeof m.PageHeader);
} catch (e) {
  console.error("ERR", e && e.message ? e.message : e);
}
