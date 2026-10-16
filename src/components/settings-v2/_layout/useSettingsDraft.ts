import { createContext, useContext, useLayoutEffect } from "react";
import type {
  NavigationGuardState,
  RegisterNavigationGuard,
} from "@/lib/navigationGuard";

export const SettingsDraftContext =
  createContext<RegisterNavigationGuard | null>(null);

export function useSettingsDraft({ dirty, saving }: NavigationGuardState) {
  const register = useContext(SettingsDraftContext);
  useLayoutEffect(() => {
    if (!dirty && !saving) return;
    return register?.({ dirty, saving });
  }, [register, dirty, saving]);
}
