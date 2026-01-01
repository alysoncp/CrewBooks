import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type TaxYearContextType = {
  taxYear: number;
  setTaxYear: (year: number) => void;
  availableYears: number[];
  setAvailableYears: (years: number[]) => void;
};

const TaxYearContext = createContext<TaxYearContextType | undefined>(undefined);

const STORAGE_KEY = "crewbooks-tax-year";

export function TaxYearProvider({
  children,
}: {
  children: ReactNode;
}) {
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYearState] = useState<number>(() => {
    // Initialize from localStorage if available, otherwise use current year
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 2000 && parsed <= currentYear + 1) {
        return parsed;
      }
    }
    return currentYear;
  });

  const [availableYears, setAvailableYears] = useState<number[]>([currentYear]);

  // Persist to localStorage when tax year changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, taxYear.toString());
  }, [taxYear]);

  const setTaxYear = (year: number) => {
    setTaxYearState(year);
  };

  const value = {
    taxYear,
    setTaxYear,
    availableYears,
    setAvailableYears,
  };

  return (
    <TaxYearContext.Provider value={value}>
      {children}
    </TaxYearContext.Provider>
  );
}

export const useTaxYear = () => {
  const context = useContext(TaxYearContext);
  if (context === undefined) {
    throw new Error("useTaxYear must be used within a TaxYearProvider");
  }
  return context;
};

