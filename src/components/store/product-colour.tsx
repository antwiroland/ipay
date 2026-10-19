"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ColourState = [string, (colour: string) => void];

const ColourContext = createContext<ColourState | null>(null);

/** Shares the selected colour between the gallery and the plan calculator on a product page. */
export function ProductColourProvider({ initial, children }: { initial: string; children: ReactNode }) {
  const state = useState(initial);
  return <ColourContext value={state}>{children}</ColourContext>;
}

export function useProductColour(initial: string): ColourState {
  const shared = useContext(ColourContext);
  const local = useState(initial);
  return shared ?? local;
}
