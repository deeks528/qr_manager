import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDependencies } from '@app/providers/DependenciesProvider';
import { homeQueryKeys } from '@features/home/hooks/useHomeProfiles';
import { settingsQueryKey } from '@features/settings/hooks/useSettings';
import { Profile } from '@domain/models/Profile';

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { profileRepository } = useDependencies();

  return useMutation<Profile, Error, Profile>({
    mutationFn: (profile) => profileRepository.updateProfile(profile),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
        queryClient.invalidateQueries({ queryKey: homeQueryKeys.profiles }),
        queryClient.invalidateQueries({ queryKey: homeQueryKeys.quickProfiles }),
      ]);
    },
  });
}
