"use client";

import { Suspense } from "react";
import ProgressBar from "./ProgressBar";
import "./nprogress.css";

export function TopBar() {
  return (
    <Suspense>
      <ProgressBar />
    </Suspense>
  );
}