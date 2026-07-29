import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useDependencies } from '@app/providers/DependenciesProvider';
import { Settings } from '@domain/models/Settings';
import { ExportService } from '@domain/services/ExportService';
import { ImportService } from '@domain/services/ImportService';

export const settingsQueryKey = ['settings'] as const;

export function useSettings() {
  const { settingsRepository } = useDependencies();

  return useQuery<Settings>({
    queryKey: settingsQueryKey,
    queryFn: () => settingsRepository.getSettings(),
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { settingsRepository } = useDependencies();

  return useMutation<Settings, Error, Settings>({
    mutationFn: (settings) => settingsRepository.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

export function useExportBackup() {
  const { settingsRepository, profileRepository } = useDependencies();

  return useMutation<string, Error, void>({
    mutationFn: async () => {
      const [settings, profiles] = await Promise.all([
        settingsRepository.getSettings(),
        profileRepository.getAllProfiles(),
      ]);
      const backupObj = ExportService.createBackup(settings, profiles);
      return JSON.stringify(backupObj);
    },
  });
}

export function useImportBackup() {
  const queryClient = useQueryClient();
  const { profileRepository } = useDependencies();

  return useMutation<void, Error, string>({
    mutationFn: async (jsonBackup) => {
      const backup = ImportService.parseBackup(jsonBackup);
      await ImportService.restore(backup, profileRepository);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
      queryClient.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
