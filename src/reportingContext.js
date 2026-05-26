import { createContext, useContext } from "react";

export const ReportingSheetsContext = createContext({ sheets: [], setSheets: () => {} });
export function useReportingSheets() {
  return useContext(ReportingSheetsContext);
}
