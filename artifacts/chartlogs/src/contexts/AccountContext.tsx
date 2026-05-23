import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useListAccounts } from "@workspace/api-client-react";

type Account = {
  id: number;
  name: string;
  broker: string | null;
  platform: "manual" | "mt4" | "mt5";
  startingBalance: number;
  currency: string;
  isDefault: boolean;
  totalPnl?: number;
  tradeCount?: number;
};

type AccountContextValue = {
  accounts: Account[];
  activeAccountId: number | null;
  setActiveAccountId: (id: number | null) => void;
  isLoading: boolean;
  refetchAccounts: () => void;
};

const AccountContext = createContext<AccountContextValue>({
  accounts: [],
  activeAccountId: null,
  setActiveAccountId: () => {},
  isLoading: false,
  refetchAccounts: () => {},
});

const STORAGE_KEY = "chartlogs_active_account";

export function AccountProvider({ children }: { children: ReactNode }) {
  const [activeAccountId, setActiveAccountIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  });

  const { data: accounts = [], isLoading, refetch } = useListAccounts();

  // Persist selection and validate it still exists
  useEffect(() => {
    if (isLoading || accounts.length === 0) return;
    if (activeAccountId !== null) {
      const exists = accounts.some((a) => a.id === activeAccountId);
      if (!exists) {
        // Account was deleted — fall back to default or null
        const def = accounts.find((a) => a.isDefault);
        const next = def ? def.id : null;
        setActiveAccountIdState(next);
        if (next) localStorage.setItem(STORAGE_KEY, String(next));
        else localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [accounts, activeAccountId, isLoading]);

  const setActiveAccountId = (id: number | null) => {
    setActiveAccountIdState(id);
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(id));
  };

  return (
    <AccountContext.Provider value={{
      accounts: accounts as Account[],
      activeAccountId,
      setActiveAccountId,
      isLoading,
      refetchAccounts: refetch,
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
