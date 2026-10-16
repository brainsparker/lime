export interface NavigationGuardState {
  dirty: boolean;
  saving: boolean;
}

export type RegisterNavigationGuard = (
  state: NavigationGuardState,
) => () => void;

export interface NavigationGuard {
  register: RegisterNavigationGuard;
  pendingNavigation: boolean;
  saving: boolean;
  clearPendingNavigation: () => void;
  discardPendingNavigation: () => void;
}
