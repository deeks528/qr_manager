export const schemaSql = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  defaultProfileId TEXT NULL,
  maxHeaderProfiles INTEGER NOT NULL CHECK (maxHeaderProfiles BETWEEN 1 AND 4),
  installationId TEXT NOT NULL,
  schemaVersion INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  type INTEGER NOT NULL CHECK (type IN (0, 1, 2)),
  nickname TEXT NOT NULL CHECK (length(nickname) <= 24),
  logoPath TEXT NULL,
  avatarColor TEXT NOT NULL,
  displayOrder INTEGER UNIQUE NOT NULL,
  quickAccessSlot INTEGER UNIQUE NULL CHECK (quickAccessSlot BETWEEN 0 AND 3),
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS upi_profiles (
  profileId TEXT PRIMARY KEY,
  upiId TEXT UNIQUE NOT NULL,
  minimumAmount REAL NULL,
  defaultDescription TEXT NULL,
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_profiles (
  profileId TEXT PRIMARY KEY,
  mobileNumber TEXT UNIQUE NOT NULL,
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS other_profiles (
  profileId TEXT PRIMARY KEY,
  qrImagePath TEXT NOT NULL,
  FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_display_order ON profiles(displayOrder);
CREATE INDEX IF NOT EXISTS idx_profiles_quick_access_slot ON profiles(quickAccessSlot);
CREATE INDEX IF NOT EXISTS idx_upi_profiles_upi_id ON upi_profiles(upiId);
CREATE INDEX IF NOT EXISTS idx_whatsapp_profiles_mobile_number ON whatsapp_profiles(mobileNumber);
`;
