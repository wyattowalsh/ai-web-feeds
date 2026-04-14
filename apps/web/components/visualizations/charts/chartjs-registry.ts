"use client";

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";

let hasRegisteredChartJs = false;

export function ensureChartJsRegistered() {
  if (hasRegisteredChartJs) {
    return;
  }

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    BarElement,
    BarController,
    ArcElement,
    PieController,
    Title,
    Tooltip,
    Legend,
    Filler,
    MatrixController,
    MatrixElement,
  );

  hasRegisteredChartJs = true;
}
