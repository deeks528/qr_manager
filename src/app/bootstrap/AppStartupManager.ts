import { AppDependencies } from './createAppDependencies';
import { Profile } from '@domain/models/Profile';
import { QRPayloadService } from '@domain/services/QRPayloadService';
import { STARTUP_CACHE_KEYS, StartupCache } from '@database/mmkv/StartupCache';

export interface AppStartupResult {
  cachedDefaultProfileId: string | null;
  dependencies: AppDependencies | null;
  initialDefaultProfile: Profile | null;
  initialDefaultPayload: string | null;
  error: Error | null;
}

export class AppStartupManager {
  static async performStartup(
    startupCache: StartupCache,
    createDependencies: () => Promise<AppDependencies>,
  ): Promise<AppStartupResult> {
    const result: AppStartupResult = {
      cachedDefaultProfileId: null,
      dependencies: null,
      initialDefaultProfile: null,
      initialDefaultPayload: null,
      error: null,
    };

    try {
      result.cachedDefaultProfileId = startupCache.getString(STARTUP_CACHE_KEYS.defaultProfileId) ?? null;
    } catch (err) {
      // If MMKV is unavailable, proceed without cached values
      result.cachedDefaultProfileId = null;
    }

    try {
      const dependencies = await createDependencies();
      result.dependencies = dependencies;

      if (result.cachedDefaultProfileId) {
        try {
          const profile = await dependencies.profileRepository.getProfile(result.cachedDefaultProfileId);
          result.initialDefaultProfile = profile ?? null;

          if (profile) {
            try {
              result.initialDefaultPayload =
                profile.type === 0
                  ? QRPayloadService.createUPIPayload(profile as any, null)
                  : QRPayloadService.createWhatsAppPayload(profile as any);
            } catch {
              result.initialDefaultPayload = null;
            }
          }
        } catch (err) {
          result.initialDefaultProfile = null;
          result.initialDefaultPayload = null;
        }
      }
    } catch (error: unknown) {
      result.error = error instanceof Error ? error : new Error('Startup failed.');
    }

    return result;
  }
}
