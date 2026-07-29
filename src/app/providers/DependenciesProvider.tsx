import React, { createContext, useContext } from 'react';

import { AppDependencies } from '@app/bootstrap/createAppDependencies';

const DependenciesContext = createContext<AppDependencies | null>(null);

interface DependenciesProviderProps {
  dependencies: AppDependencies;
  children: React.ReactNode;
}

export function DependenciesProvider({ dependencies, children }: DependenciesProviderProps): React.JSX.Element {
  return <DependenciesContext.Provider value={dependencies}>{children}</DependenciesContext.Provider>;
}

export function useDependencies(): AppDependencies {
  const dependencies = useContext(DependenciesContext);

  if (!dependencies) {
    throw new Error('App dependencies are not available.');
  }

  return dependencies;
}
