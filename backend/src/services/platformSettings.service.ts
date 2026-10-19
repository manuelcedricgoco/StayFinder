import { prisma } from '../lib/prisma';

const GLOBAL_SETTINGS_ID = 'global';

const platformSettingsSelect = {
  id: true,
  siteName: true,
  allowRegistrations: true,
  autoApproveListings: true,
  updatedAt: true,
} as const;

export async function getPlatformSettings() {
  return prisma.platformSettings.upsert({
    where: { id: GLOBAL_SETTINGS_ID },
    update: {},
    create: { id: GLOBAL_SETTINGS_ID },
    select: platformSettingsSelect,
  });
}

export async function updatePlatformSettings(input: {
  siteName: string;
  allowRegistrations: boolean;
  autoApproveListings: boolean;
}) {
  return prisma.platformSettings.upsert({
    where: { id: GLOBAL_SETTINGS_ID },
    update: input,
    create: { id: GLOBAL_SETTINGS_ID, ...input },
    select: platformSettingsSelect,
  });
}

export async function getPublicPlatformSettings() {
  const settings = await getPlatformSettings();
  return {
    siteName: settings.siteName,
    allowRegistrations: settings.allowRegistrations,
  };
}
