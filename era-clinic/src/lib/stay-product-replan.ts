export function shouldCancelProcedureOnStayProductChange(status: string): boolean {
  return status === "PROPOSED" || status === "SCHEDULED";
}

export function shouldKeepProcedureOnStayProductChange(status: string): boolean {
  return status === "COMPLETED" || status === "CHECKED_IN" || status === "NO_SHOW";
}
