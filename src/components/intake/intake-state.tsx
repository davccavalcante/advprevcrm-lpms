"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type IntakeState = {
  confirmedIds: string[];
  reclassifiedIds: string[];
  preparedIds: string[];
  confirmTriage: (id: string) => void;
  reclassifyTriage: (id: string) => void;
  prepareRequest: (id: string) => void;
};

const IntakeStateContext = createContext<IntakeState | null>(null);

/*
 * Local record of the intake actions. It exists so the human confirmation the
 * constitution requires is visible and exercisable in the interface. Nothing
 * here is persisted and no audit event is written yet; the screen says so.
 */
export function IntakeStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [confirmedIds, setConfirmedIds] = useState<string[]>([]);
  const [reclassifiedIds, setReclassifiedIds] = useState<string[]>([]);
  const [preparedIds, setPreparedIds] = useState<string[]>([]);

  const confirmTriage = useCallback((id: string) => {
    setConfirmedIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setReclassifiedIds((current) => current.filter((entry) => entry !== id));
  }, []);

  const reclassifyTriage = useCallback((id: string) => {
    setReclassifiedIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }, []);

  const prepareRequest = useCallback((id: string) => {
    setPreparedIds((current) =>
      current.includes(id) ? current : [...current, id],
    );
  }, []);

  const value = useMemo(
    () => ({
      confirmedIds,
      reclassifiedIds,
      preparedIds,
      confirmTriage,
      reclassifyTriage,
      prepareRequest,
    }),
    [
      confirmedIds,
      reclassifiedIds,
      preparedIds,
      confirmTriage,
      reclassifyTriage,
      prepareRequest,
    ],
  );

  return (
    <IntakeStateContext.Provider value={value}>
      {children}
    </IntakeStateContext.Provider>
  );
}

export function useIntakeState(): IntakeState {
  const context = useContext(IntakeStateContext);
  if (!context) {
    throw new Error("useIntakeState requires IntakeStateProvider");
  }
  return context;
}
