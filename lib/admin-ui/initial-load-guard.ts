export type InitialLoadGuardState = {
  started: boolean;
};

export function createInitialLoadGuard(): InitialLoadGuardState {
  return { started: false };
}

export function shouldStartInitialLoad(state: InitialLoadGuardState): boolean {
  if (state.started) {
    return false;
  }

  state.started = true;
  return true;
}
