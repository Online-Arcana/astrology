import { renderChartWheel as renderVendorChartWheel } from "astral-chart-wheel";
import type { ChartWheelCalculation } from "astral-chart-wheel";
import { addChartWheelPointControls } from "./chartWheelPointControls.js";

export const renderChartWheel = (calculation: ChartWheelCalculation): HTMLElement => {
  const wheel = renderVendorChartWheel(calculation);
  addChartWheelPointControls(wheel);
  return wheel;
};
