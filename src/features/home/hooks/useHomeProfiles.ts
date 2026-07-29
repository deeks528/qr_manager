import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useDependencies } from '@app/providers/DependenciesProvider';
import { settingsQueryKey } from '@features/settings/hooks/useSettings';
import { Profile } from '@domain/models/Profile';

export const homeQueryKeys = {
  defaultProfile: (profileId: string | null) => ['home', 'defaultProfile', profileId] as const,
  quickProfiles: ['home', 'quickProfiles'] as const,
  profiles: ['home', 'profiles'] as const,
};

export function useDefaultProfile(defaultProfileId: string | null | undefined, initialData?: Profile | null) {
  const { profileRepository } = useDependencies();

  return useQuery<Profile | null>({
    queryKey: homeQueryKeys.defaultProfile(defaultProfileId ?? null),
    queryFn: () => (defaultProfileId ? profileRepository.getProfile(defaultProfileId) : Promise.resolve(null)),
    enabled: defaultProfileId !== undefined,
    initialData,
  });
}

export function useQuickProfiles() {
  const { profileRepository } = useDependencies();

  return useQuery<Profile[]>({
    queryKey: homeQueryKeys.quickProfiles,
    queryFn: () => profileRepository.getQuickProfiles(),
  });
}

export function useProfiles() {
  const { profileRepository } = useDependencies();

  return useQuery<Profile[]>({
    queryKey: homeQueryKeys.profiles,
    queryFn: () => profileRepository.getAllProfiles(),
  });
}

export function useSetDefaultProfile() {
  const queryClient = useQueryClient();
  const { profileRepository } = useDependencies();

  return useMutation<void, Error, string>({
    mutationFn: (profileId) => profileRepository.setDefaultProfile(profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
      ]);
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  const { profileRepository } = useDependencies();

  return useMutation<void, Error, string>({
    mutationFn: (profileId) => profileRepository.deleteProfile(profileId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
      ]);
    },
  });
}

