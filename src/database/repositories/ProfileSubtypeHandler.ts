import { SqlClient } from '@database/sqlite/SqlClient';
import {
  Profile,
  ProfileType,
} from '@domain/models/Profile';
import { ValidationService } from '@domain/services/ValidationService';
import { ValidationError } from '@domain/errors/DomainErrors';
import RNFS from 'react-native-fs';

export class ProfileSubtypeHandler {
  static async insert(client: SqlClient, profile: Profile): Promise<void> {
    switch (profile.type) {
      case ProfileType.UPI:
        await client.execute(
          'INSERT INTO upi_profiles (profileId, upiId, minimumAmount, defaultDescription) VALUES (?, ?, ?, ?)',
          [
            profile.id,
            ValidationService.validateUPIId(profile.upiId),
            ValidationService.validateAmount(profile.minimumAmount),
            profile.defaultDescription,
          ],
        );
        break;

      case ProfileType.WhatsApp:
        await client.execute('INSERT INTO whatsapp_profiles (profileId, mobileNumber) VALUES (?, ?)', [
          profile.id,
          ValidationService.validateMobileNumber(profile.mobileNumber),
        ]);
        break;

      case ProfileType.Custom:
        await client.execute('INSERT INTO custom_profiles (profileId, text) VALUES (?, ?)', [
          profile.id,
          ValidationService.validateCustomText(profile.text),
        ]);
        break;

      case ProfileType.Other:
        await client.execute('INSERT INTO other_profiles (profileId, imagePath, extractedText) VALUES (?, ?, ?)', [
          profile.id,
          requireImagePath(profile.imagePath),
          profile.extractedText ?? null,
        ]);
        break;
    }
  }

  static async update(client: SqlClient, profile: Profile): Promise<void> {
    switch (profile.type) {
      case ProfileType.UPI:
        await client.execute(
          'UPDATE upi_profiles SET upiId = ?, minimumAmount = ?, defaultDescription = ? WHERE profileId = ?',
          [
            ValidationService.validateUPIId(profile.upiId),
            ValidationService.validateAmount(profile.minimumAmount),
            profile.defaultDescription,
            profile.id,
          ],
        );
        break;

      case ProfileType.WhatsApp:
        await client.execute('UPDATE whatsapp_profiles SET mobileNumber = ? WHERE profileId = ?', [
          ValidationService.validateMobileNumber(profile.mobileNumber),
          profile.id,
        ]);
        break;

      case ProfileType.Custom:
        await client.execute('UPDATE custom_profiles SET text = ? WHERE profileId = ?', [
          ValidationService.validateCustomText(profile.text),
          profile.id,
        ]);
        break;

      case ProfileType.Other:
        await client.execute('UPDATE other_profiles SET imagePath = ?, extractedText = ? WHERE profileId = ?', [
          requireImagePath(profile.imagePath),
          profile.extractedText ?? null,
          profile.id,
        ]);
        break;
    }
  }

  static async deleteAll(client: SqlClient, profile: Profile): Promise<void> {
    const profileId = profile.id;

    // If it's an "Other" profile, delete the associated image file
    if (profile.type === ProfileType.Other && profile.imagePath) {
      try {
        const filePath = profile.imagePath.replace('file://', '');
        const exists = await RNFS.exists(filePath);
        if (exists) {
          await RNFS.unlink(filePath);
          console.log('Deleted physical image file:', filePath);
        }
      } catch (error) {
        console.error('Error deleting image file:', error);
        // We continue anyway to ensure the DB record is deleted
      }
    }

    await client.execute('DELETE FROM upi_profiles WHERE profileId = ?', [profileId]);
    await client.execute('DELETE FROM whatsapp_profiles WHERE profileId = ?', [profileId]);
    await client.execute('DELETE FROM custom_profiles WHERE profileId = ?', [profileId]);
    await client.execute('DELETE FROM other_profiles WHERE profileId = ?', [profileId]);
  }
}

function requireImagePath(path: string): string {
  if (!path.trim()) {
    throw new ValidationError('Image path is required for this profile type.');
  }
  return path;
}
