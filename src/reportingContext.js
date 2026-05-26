import { createContext, useContext } from "react";

export const ReportingSheetsContext = createContext({
  sheets: [],
  setSheets: () => {},
  periodLabel: "All data",
  setPeriodLabel: () => {},
});

export function useReportingSheets() {
  return useContext(ReportingSheetsContext);
}
