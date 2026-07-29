import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useDependencies } from '@app/providers/DependenciesProvider';
import { CreateProfileData } from '@database/repositories/ProfileRepository';
import { homeQueryKeys } from '@features/home/hooks/useHomeProfiles';
import { settingsQueryKey } from '@features/settings/hooks/useSettings';
import { Profile } from '@domain/models/Profile';

export function useCreateProfile() {
  const queryClient = useQueryClient();
  const { profileRepository, settingsRepository } = useDependencies();

  return useMutation<Profile, Error, CreateProfileData>({
    mutationFn: async (profile) => {
      const createdProfile = await profileRepository.createProfile({ profile });
      const settings = await settingsRepository.getSettings();

      if (!settings.defaultProfileId) {
        await profileRepository.setDefaultProfile(createdProfile.id);
      }

      return createdProfile;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: homeQueryKeys.profiles }),
        queryClient.invalidateQueries({ queryKey: homeQueryKeys.quickProfiles }),
        queryClient.invalidateQueries({ queryKey: settingsQueryKey }),
      ]);
    },
  });
}
