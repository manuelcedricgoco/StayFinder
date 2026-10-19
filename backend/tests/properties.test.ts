// Integration tests for Phase 4: property CRUD, ownership, validation, admin approval, Prisma relations.
// Run with: npm test      (uses its own database file: backend/prisma/test-properties.db)
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { TestClient } from './helpers/testClient';

const TEST_DATABASE_URL = 'file:./test-properties.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

describe('Phase 4 property management', () => {
  let server: Server;
  let baseUrl = '';
  let prisma: typeof import('../src/lib/prisma').prisma;

  const password = 'Passw0rd123';
  const ownerAInfo = { name: 'Olivia Owner', email: 'olivia@example.com', password, role: 'OWNER' };
  const ownerBInfo = { name: 'Oscar Owner', email: 'oscar@example.com', password, role: 'OWNER' };
  const boarderInfo = { name: 'Ben Boarder', email: 'ben@example.com', password, role: 'BOARDER' };
  const adminInfo = { name: 'Ada Admin', email: 'ada@example.com', password };

  let ownerA: TestClient;
  let ownerB: TestClient;
  let boarder: TestClient;
  let admin: TestClient;
  let ownerAId = '';
  let ownerBId = '';

  const validProperty = {
    name: 'Sampaguita Student Boarding House',
    propertyType: 'BOARDING_HOUSE',
    description: 'Clean and safe boarding house near the public market, ideal for students.',
    monthlyPrice: 1800,
    municipality: 'San Jose',
    address: 'Purok 3, Poblacion, San Jose',
    availableRooms: 4,
    availability: 'AVAILABLE',
    amenities: ['wifi', 'study-area'],
    imageUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  };

  async function createAs(client: TestClient, overrides: Record<string, unknown> = {}) {
    const res = await client.request('POST', '/api/owner/properties', { ...validProperty, ...overrides });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data!.property as Record<string, any>;
  }

  before(async () => {
    const backendDir = path.resolve(__dirname, '..');
    const testDbFile = path.join(backendDir, 'prisma', 'test-properties.db');
    for (const file of [testDbFile, `${testDbFile}-journal`]) fs.rmSync(file, { force: true });

    execSync('npx prisma db push --skip-generate', {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
    assert.ok(fs.existsSync(testDbFile), 'Test database was not created - aborting.');

    // Import AFTER DATABASE_URL is set so everything uses the test database.
    ({ prisma } = await import('../src/lib/prisma'));
    const { hashPassword } = await import('../src/lib/password');
    const { seedReferenceData } = await import('../prisma/seedData');
    const { createApp } = await import('../src/app');

    await seedReferenceData(prisma);
    server = createApp().listen(0);
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await prisma.user.create({
      data: { name: adminInfo.name, email: adminInfo.email, role: 'ADMIN', passwordHash: await hashPassword(password) },
    });

    ownerA = new TestClient(baseUrl);
    ownerB = new TestClient(baseUrl);
    boarder = new TestClient(baseUrl);
    admin = new TestClient(baseUrl);
    ownerAId = (await ownerA.request('POST', '/api/auth/register', ownerAInfo)).data!.user.id;
    ownerBId = (await ownerB.request('POST', '/api/auth/register', ownerBInfo)).data!.user.id;
    await boarder.request('POST', '/api/auth/register', boarderInfo);
    const login = await admin.request('POST', '/api/auth/login', { email: adminInfo.email, password });
    assert.equal(login.status, 200);
  });

  after(async () => {
    server?.close();
    await prisma?.$disconnect();
  });

  describe('reference data', () => {
    it('serves municipalities and amenities publicly (no login needed)', async () => {
      const anon = new TestClient(baseUrl);
      const locations = await anon.request('GET', '/api/locations');
      const amenities = await anon.request('GET', '/api/amenities');
      assert.equal(locations.status, 200);
      assert.equal(locations.data!.locations.length, 11);
      assert.ok(locations.data!.locations.some((l: { name: string }) => l.name === 'Mamburao'));
      assert.equal(amenities.status, 200);
      assert.ok(amenities.data!.amenities.some((a: { slug: string }) => a.slug === 'wifi'));
    });
  });

  describe('public property search', () => {
    it('lets boarders save approved listings and submit inquiries, moderated reviews, and reports', async () => {
      const listing = await createAs(ownerA, { name: 'Boarder Features Listing' });
      await prisma.property.update({ where: { id: listing.id }, data: { status: 'APPROVED' } });
      const anonymous = new TestClient(baseUrl);

      assert.equal((await anonymous.request('GET', '/api/boarder/favorites')).status, 401);
      assert.equal((await ownerA.request('POST', `/api/boarder/favorites/${listing.id}`)).status, 403);
      assert.equal((await ownerA.request('POST', `/api/boarder/properties/${listing.id}/reviews`, {
        rating: 5,
        content: 'Owner should not post boarder reviews.',
      })).status, 403);

      const favorite = await boarder.request('POST', `/api/boarder/favorites/${listing.id}`);
      const duplicateFavorite = await boarder.request('POST', `/api/boarder/favorites/${listing.id}`);
      assert.equal(favorite.status, 201);
      assert.equal(duplicateFavorite.status, 201);
      assert.equal(duplicateFavorite.data!.favorite.id, favorite.data!.favorite.id);
      const favorites = await boarder.request('GET', '/api/boarder/favorites');
      assert.ok(favorites.data!.favorites.some((item: { property: { id: string } }) => item.property.id === listing.id));

      const inquiry = await boarder.request('POST', '/api/boarder/inquiries', {
        propertyId: listing.id,
        message: 'I would like to ask about viewing this room.',
      });
      assert.equal(inquiry.status, 201);
      assert.equal(inquiry.data!.inquiry.status, 'PENDING');
      assert.equal(inquiry.data!.inquiry.owner.name, ownerAInfo.name);
      assert.equal((await boarder.request('GET', '/api/boarder/inquiries')).data!.inquiries.length, 1);

      const review = await boarder.request('POST', `/api/boarder/properties/${listing.id}/reviews`, {
        rating: 5,
        content: 'A clear and helpful review of this property.',
      });
      assert.equal(review.status, 201);
      assert.equal(review.data!.review.status, 'PENDING');
      assert.equal(
        (await boarder.request('POST', `/api/boarder/properties/${listing.id}/reviews`, {
          rating: 4,
          content: 'A second review of this property.',
        })).status,
        409,
      );
      assert.equal(
        (await boarder.request('POST', `/api/boarder/properties/${listing.id}/reviews`, {
          rating: 6,
          content: 'This invalid rating should be rejected.',
        })).status,
        400,
      );
      assert.equal((await boarder.request('GET', '/api/boarder/reviews')).data!.reviews.length, 1);

      const report = await boarder.request('POST', `/api/boarder/properties/${listing.id}/reports`, {
        reason: 'INCORRECT_INFORMATION',
        details: 'The listing gives a wrong location detail.',
      });
      assert.equal(report.status, 201);
      assert.equal(report.data!.report.status, 'PENDING');
      assert.equal((await ownerA.request('POST', `/api/boarder/properties/${listing.id}/reports`, {
        reason: 'SCAM',
      })).status, 403);
      assert.equal((await boarder.request('GET', '/api/boarder/reports')).data!.reports.length, 1);
      assert.equal((await boarder.request('POST', `/api/boarder/properties/${listing.id}/reports`, {
        reason: 'NOT_A_REASON',
      })).status, 400);
      assert.equal((await boarder.request('POST', '/api/boarder/inquiries', {
        propertyId: listing.id,
        message: 'short',
      })).status, 400);

      await prisma.property.update({ where: { id: listing.id }, data: { status: 'PENDING' } });
      assert.equal((await boarder.request('POST', `/api/boarder/favorites/${listing.id}`)).status, 404);
      assert.equal((await boarder.request('POST', `/api/boarder/properties/${listing.id}/reports`, {
        reason: 'SCAM',
      })).status, 404);
    });

    it('serves only approved property details and excludes private owner data', async () => {
      const listing = await createAs(ownerA, {
        name: 'Public Detail Listing',
        latitude: 13.0123,
        longitude: 120.1234,
      });
      const anonymous = new TestClient(baseUrl);
      assert.equal((await anonymous.request('GET', `/api/properties/${listing.id}`)).status, 404);

      await prisma.property.update({ where: { id: listing.id }, data: { status: 'APPROVED' } });
      await prisma.room.create({
        data: {
          propertyId: listing.id,
          name: 'Room A',
          monthlyPrice: 1900,
          capacity: 2,
          isAvailable: true,
        },
      });

      const response = await anonymous.request('GET', `/api/properties/${listing.id}`);
      assert.equal(response.status, 200);
      assert.equal(response.data!.property.name, 'Public Detail Listing');
      assert.equal(response.data!.property.latitude, 13.0123);
      assert.equal(response.data!.property.longitude, 120.1234);
      assert.deepEqual(response.data!.property.owner, { name: ownerAInfo.name, isVerified: false });
      assert.equal(response.data!.property.rooms[0].name, 'Room A');
      assert.equal('email' in response.data!.property.owner, false);
      assert.equal('ownerId' in response.data!.property, false);
      assert.equal('status' in response.data!.property, false);

      await prisma.property.update({ where: { id: listing.id }, data: { status: 'PENDING' } });
      assert.equal((await anonymous.request('GET', `/api/properties/${listing.id}`)).status, 404);
      assert.equal((await anonymous.request('GET', '/api/properties/unknown-id')).status, 404);
    });

    it('returns approved listings only and supports the public search filters', async () => {
      const approved = await createAs(ownerA, {
        name: 'Public Search Sampaguita',
        monthlyPrice: 1800,
        amenities: ['wifi', 'study-area'],
      });
      await prisma.property.update({ where: { id: approved.id }, data: { status: 'APPROVED' } });
      await createAs(ownerA, { name: 'Private Search Sampaguita' });
      const inactive = await createAs(ownerA, { name: 'Inactive Search Sampaguita' });
      await prisma.property.update({ where: { id: inactive.id }, data: { status: 'INACTIVE' } });

      const response = await new TestClient(baseUrl).request(
        'GET',
        '/api/properties?q=Sampaguita&municipality=San%20Jose&propertyType=BOARDING_HOUSE&minPrice=1500&maxPrice=2000&availability=AVAILABLE&amenities=wifi,study-area&sort=PRICE_ASC',
      );
      assert.equal(response.status, 200);
      assert.equal(response.data!.pagination.total, 1);
      assert.equal(response.data!.properties[0].id, approved.id);
      assert.equal('ownerId' in response.data!.properties[0], false);
      assert.equal('status' in response.data!.properties[0], false);
      assert.equal('rejectionReason' in response.data!.properties[0], false);
      await prisma.property.updateMany({
        where: { id: { in: [approved.id, inactive.id] } },
        data: { status: 'PENDING' },
      });
    });

    it('paginates matching listings and sorts them by monthly price', async () => {
      const listings = [];
      for (let index = 0; index < 13; index += 1) {
        const listing = await createAs(ownerA, {
          name: `Search Pagination Listing ${index}`,
          monthlyPrice: 2000 + index,
        });
        listings.push(listing);
        await prisma.property.update({ where: { id: listing.id }, data: { status: 'APPROVED' } });
      }

      const client = new TestClient(baseUrl);
      const firstPage = await client.request(
        'GET',
        '/api/properties?q=Search%20Pagination%20Listing&sort=PRICE_ASC',
      );
      const secondPage = await client.request(
        'GET',
        '/api/properties?q=Search%20Pagination%20Listing&sort=PRICE_ASC&page=2',
      );
      assert.equal(firstPage.status, 200);
      assert.equal(firstPage.data!.pagination.total, 13);
      assert.equal(firstPage.data!.pagination.totalPages, 2);
      assert.equal(firstPage.data!.properties.length, 12);
      assert.equal(secondPage.data!.properties.length, 1);
      assert.equal(firstPage.data!.properties[0].monthlyPrice, 2000);
      assert.equal(secondPage.data!.properties[0].monthlyPrice, 2012);
      await prisma.property.updateMany({
        where: { id: { in: listings.map((listing) => listing.id) } },
        data: { status: 'PENDING' },
      });
    });

    it('rejects invalid filter and pagination values', async () => {
      const client = new TestClient(baseUrl);
      for (const query of [
        'minPrice=3000&maxPrice=1000',
        'propertyType=PALACE',
        'amenities=wifi,not%20valid',
        'page=0',
      ]) {
        const response = await client.request('GET', `/api/properties?${query}`);
        assert.equal(response.status, 400, query);
      }
    });
  });

  describe('owner authorization', () => {
    it('rejects visitors who are not logged in (401)', async () => {
      const anon = new TestClient(baseUrl);
      assert.equal((await anon.request('GET', '/api/owner/properties')).status, 401);
      assert.equal((await anon.request('POST', '/api/owner/properties', validProperty)).status, 401);
      assert.equal((await anon.request('GET', '/api/owner/settings')).status, 401);
    });

    it('rejects boarders and admins on owner routes (403)', async () => {
      for (const client of [boarder, admin]) {
        assert.equal((await client.request('GET', '/api/owner/properties')).status, 403);
        assert.equal((await client.request('POST', '/api/owner/properties', validProperty)).status, 403);
        assert.equal((await client.request('GET', '/api/owner/payments')).status, 403);
        assert.equal((await client.request('POST', '/api/owner/payments', {})).status, 403);
        assert.equal((await client.request('GET', '/api/owner/settings')).status, 403);
        assert.equal((await client.request('POST', '/api/owner/password', {})).status, 403);
      }
    });
  });

  describe('owner account settings', () => {
    it('persists owner preferences and only returns the authenticated owner’s data', async () => {
      const ownProperty = await createAs(ownerA, {
        name: 'Settings Owner Property',
        imageUrls: [],
        amenities: [],
      });
      const otherProperty = await createAs(ownerB, {
        name: 'Settings Other Owner Property',
        imageUrls: [],
        amenities: [],
      });
      const initial = await ownerA.request('GET', '/api/owner/settings');
      assert.equal(initial.status, 200, JSON.stringify(initial.data));
      assert.equal(initial.data!.settings.account.email, ownerAInfo.email);
      assert.equal(initial.data!.settings.account.accountStatusAvailable, false);
      assert.equal(initial.data!.settings.account.hasLocalPassword, true);
      assert.ok(!('passwordHash' in initial.data!.settings.account));
      assert.ok(!initial.data!.settings.properties.some((property: { id: string }) => property.id === otherProperty.id));
      assert.ok(initial.data!.settings.sessions.some((session: { isCurrent: boolean }) => session.isCurrent));
      assert.ok(!('tokenHash' in initial.data!.settings.sessions[0]));
      assert.ok(initial.data!.settings.loginHistory.length > 0);

      const preferences = {
        defaultPropertyId: ownProperty.id,
        notifyNewInquiry: false,
        notifyNewReview: true,
        notifyListingStatus: false,
        notifyVerification: true,
        notifyPayment: false,
        notifyAnnouncements: true,
        emailNotifications: false,
        inAppNotifications: true,
      };
      const saved = await ownerA.request('PUT', '/api/owner/settings/preferences', preferences);
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      assert.equal(saved.data!.preferences.defaultPropertyId, ownProperty.id);
      assert.equal((await ownerA.request('GET', '/api/owner/settings')).data!.settings.preferences.notifyNewInquiry, false);
      assert.equal((await ownerA.request('PUT', '/api/owner/settings/preferences', {
        ...preferences,
        defaultPropertyId: otherProperty.id,
      })).status, 400);
      assert.equal((await ownerB.request('GET', '/api/owner/settings')).data!.settings.preferences.defaultPropertyId, null);

      const updatedProfile = await ownerA.request('PATCH', '/api/owner/profile', {
        name: ownerAInfo.name,
        phoneNumber: '+639123456789',
        avatarUrl: null,
      });
      assert.equal(updatedProfile.status, 200, JSON.stringify(updatedProfile.data));
      assert.equal((await ownerA.request('GET', '/api/owner/settings')).data!.settings.account.phoneNumber, '+639123456789');

      const avatar = new FormData();
      avatar.append('avatar', new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), 'profile.png');
      const uploaded = await ownerA.request('POST', '/api/owner/profile/avatar', avatar);
      assert.equal(uploaded.status, 200, JSON.stringify(uploaded.data));
      assert.match(uploaded.data!.user.avatarUrl, /^\/api\/uploads\/avatars\/[a-f0-9-]+\.png$/);
      assert.equal((await ownerA.request('PATCH', '/api/owner/profile', {
        name: ownerAInfo.name,
        phoneNumber: '+639123456789',
        avatarUrl: uploaded.data!.user.avatarUrl,
      })).status, 200);
      const invalidAvatar = new FormData();
      invalidAvatar.append('avatar', new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' }), 'invalid.png');
      assert.equal((await ownerA.request('POST', '/api/owner/profile/avatar', invalidAvatar)).status, 400);
      assert.equal((await ownerA.request('DELETE', '/api/owner/profile/avatar')).status, 200);
      assert.equal((await ownerA.request('GET', '/api/owner/settings')).data!.settings.account.avatarUrl, null);
    });

    it('changes passwords only after verifying the current password and revokes other sessions', async () => {
      const otherSession = new TestClient(baseUrl);
      assert.equal((await otherSession.request('POST', '/api/auth/login', {
        email: ownerAInfo.email,
        password,
      })).status, 200);
      const sessions = await ownerA.request('GET', '/api/owner/settings');
      assert.ok(sessions.data!.settings.sessions.some((session: { isCurrent: boolean }) => !session.isCurrent));
      const revoked = await ownerA.request('POST', '/api/owner/sessions/revoke-others');
      assert.equal(revoked.status, 200);
      assert.equal(revoked.data!.revokedCount, 1);
      assert.equal((await otherSession.request('GET', '/api/auth/me')).status, 401);

      const passwordSession = new TestClient(baseUrl);
      assert.equal((await passwordSession.request('POST', '/api/auth/login', {
        email: ownerAInfo.email,
        password,
      })).status, 200);

      assert.equal((await ownerA.request('POST', '/api/owner/password', {
        currentPassword: 'WrongPass123',
        newPassword: 'NewPass4567',
        confirmPassword: 'NewPass4567',
      })).status, 400);
      assert.equal((await ownerA.request('POST', '/api/owner/password', {
        currentPassword: password,
        newPassword: 'NewPass4567',
        confirmPassword: 'Mismatch4567',
      })).status, 400);
      const changed = await ownerA.request('POST', '/api/owner/password', {
        currentPassword: password,
        newPassword: 'NewPass4567',
        confirmPassword: 'NewPass4567',
      });
      assert.equal(changed.status, 200, JSON.stringify(changed.data));
      assert.equal((await ownerA.request('GET', '/api/owner/settings')).status, 200, 'Current session should remain signed in.');
      assert.equal((await passwordSession.request('GET', '/api/auth/me')).status, 401, 'Password change should revoke other sessions.');
      assert.ok((await prisma.securityEvent.findFirst({
        where: { userId: ownerAId, action: 'PASSWORD_CHANGED' },
      })));

      const newLogin = new TestClient(baseUrl);
      assert.equal((await newLogin.request('POST', '/api/auth/login', {
        email: ownerAInfo.email,
        password: 'NewPass4567',
      })).status, 200);
    });
  });

  describe('boarder settings', () => {
    it('persists search preferences and profile data for only the authenticated boarder', async () => {
      const anonymous = new TestClient(baseUrl);
      assert.equal((await anonymous.request('GET', '/api/boarder/settings')).status, 401);
      assert.equal((await ownerA.request('GET', '/api/boarder/settings')).status, 403);
      assert.equal((await admin.request('GET', '/api/boarder/settings')).status, 403);

      const initial = await boarder.request('GET', '/api/boarder/settings');
      assert.equal(initial.status, 200, JSON.stringify(initial.data));
      assert.equal(initial.data!.settings.account.email, boarderInfo.email);
      assert.equal(initial.data!.settings.account.hasLocalPassword, true);
      assert.ok(!('passwordHash' in initial.data!.settings.account));
      assert.ok(initial.data!.settings.sessions.some((session: { isCurrent: boolean }) => session.isCurrent));
      assert.ok(!('tokenHash' in initial.data!.settings.sessions[0]));
      assert.ok(initial.data!.settings.loginHistory.length > 0);

      const location = await prisma.location.findUniqueOrThrow({ where: { name: 'Mamburao' } });
      const amenity = await prisma.amenity.findUniqueOrThrow({ where: { slug: 'wifi' } });
      const preferences = {
        preferredLocationId: location.id,
        minBudget: 3000,
        maxBudget: 8000,
        propertyType: 'BOARDING_HOUSE',
        occupants: 2,
        preferredAmenityIds: [amenity.id],
        notifyInquiryReplies: false,
        notifyFavoriteUpdates: true,
        notifyListingUpdates: false,
        notifyReviewUpdates: true,
        notifyAnnouncements: false,
        emailNotifications: false,
        inAppNotifications: true,
      };
      const saved = await boarder.request('PUT', '/api/boarder/settings/preferences', preferences);
      assert.equal(saved.status, 200, JSON.stringify(saved.data));
      assert.equal(saved.data!.preferences.preferredLocationId, location.id);
      assert.deepEqual(saved.data!.preferences.preferredAmenityIds, [amenity.id]);
      assert.equal((await boarder.request('GET', '/api/boarder/settings')).data!.settings.preferences.maxBudget, 8000);
      assert.equal((await ownerA.request('PUT', '/api/boarder/settings/preferences', preferences)).status, 403);
      assert.equal((await boarder.request('PUT', '/api/boarder/settings/preferences', {
        ...preferences,
        preferredLocationId: 'not-a-municipality',
      })).status, 400);
      assert.equal((await boarder.request('PUT', '/api/boarder/settings/preferences', {
        ...preferences,
        minBudget: 9000,
        maxBudget: 8000,
      })).status, 400);

      const updatedProfile = await boarder.request('PATCH', '/api/boarder/profile', {
        name: boarderInfo.name,
        phoneNumber: '+639123456700',
        avatarUrl: null,
      });
      assert.equal(updatedProfile.status, 200, JSON.stringify(updatedProfile.data));
      assert.equal((await boarder.request('GET', '/api/boarder/settings')).data!.settings.account.phoneNumber, '+639123456700');
      assert.equal((await ownerA.request('PATCH', '/api/boarder/profile', {
        name: ownerAInfo.name,
        phoneNumber: null,
        avatarUrl: null,
      })).status, 403);

      const avatar = new FormData();
      avatar.append('avatar', new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }), 'boarder.png');
      const uploaded = await boarder.request('POST', '/api/boarder/profile/avatar', avatar);
      assert.equal(uploaded.status, 200, JSON.stringify(uploaded.data));
      assert.match(uploaded.data!.user.avatarUrl, /^\/api\/uploads\/avatars\/[a-f0-9-]+\.png$/);
      const invalidAvatar = new FormData();
      invalidAvatar.append('avatar', new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/png' }), 'invalid.png');
      assert.equal((await boarder.request('POST', '/api/boarder/profile/avatar', invalidAvatar)).status, 400);
      assert.equal((await boarder.request('DELETE', '/api/boarder/profile/avatar')).status, 200);
    });

    it('changes boarder passwords using the shared hash/session security flow', async () => {
      const secondSession = new TestClient(baseUrl);
      assert.equal((await secondSession.request('POST', '/api/auth/login', {
        email: boarderInfo.email,
        password,
      })).status, 200);
      const revoked = await boarder.request('POST', '/api/boarder/sessions/revoke-others');
      assert.equal(revoked.status, 200, JSON.stringify(revoked.data));
      assert.equal(revoked.data!.revokedCount, 1);
      assert.equal((await secondSession.request('GET', '/api/auth/me')).status, 401);

      const changed = await boarder.request('POST', '/api/boarder/password', {
        currentPassword: password,
        newPassword: 'BoarderUpdated123',
        confirmPassword: 'BoarderUpdated123',
      });
      assert.equal(changed.status, 200, JSON.stringify(changed.data));
      assert.equal((await boarder.request('GET', '/api/boarder/settings')).status, 200);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: boarderInfo.email } });
      assert.notEqual(user.passwordHash, 'BoarderUpdated123');
      assert.ok(await prisma.securityEvent.findFirst({
        where: { userId: user.id, action: 'PASSWORD_CHANGED', role: 'BOARDER' },
      }));
    });
  });

  describe('property image uploads', () => {
    const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webpHeader = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

    function imageForm(count: number, mimeType = 'image/png', bytes = pngHeader) {
      const form = new FormData();
      for (let index = 0; index < count; index += 1) {
        form.append('images', new Blob([bytes], { type: mimeType }), `property-${index}.png`);
      }
      return form;
    }

    it('uploads multiple verified images, persists cover changes, and only removes explicitly selected images', async () => {
      const property = await createAs(ownerA, { imageUrls: [] });
      try {
        assert.equal((await ownerB.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(1))).status, 404);
        const uploaded = await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(2));
        assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
        let images = uploaded.data!.property.images;
        assert.equal(images.length, 2);
        assert.equal(images[0].isPrimary, true);
        assert.match(images[0].url, /^\/api\/uploads\/properties\/[a-f0-9-]+\.png$/);
        assert.equal((await fetch(`${baseUrl}${images[0].url}`)).status, 200);

        const foreignRemoval = await ownerB.request('DELETE', `/api/owner/properties/${property.id}/images/${images[0].id}`);
        assert.equal(foreignRemoval.status, 404);

        const changedCover = await ownerA.request('PATCH', `/api/owner/properties/${property.id}/images/${images[1].id}/cover`);
        assert.equal(changedCover.status, 200);
        images = changedCover.data!.property.images;
        assert.equal(images[0].id, uploaded.data!.property.images[1].id);
        assert.equal(images[0].isPrimary, true);

        const updated = await ownerA.request('PUT', `/api/owner/properties/${property.id}`, {
          ...validProperty,
          imageUrls: [],
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.data!.property.images.length, 2);

        const removed = await ownerA.request('DELETE', `/api/owner/properties/${property.id}/images/${images[0].id}`);
        assert.equal(removed.status, 200);
        assert.equal(removed.data!.property.images.length, 1);
        assert.equal(removed.data!.property.images[0].isPrimary, true);
      } finally {
        await ownerA.request('DELETE', `/api/owner/properties/${property.id}`);
      }
    });

    it('rejects invalid content, unsupported formats, oversized files, and an eleventh image', async () => {
      const property = await createAs(ownerA, { imageUrls: [] });
      try {
        assert.equal((await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(1, 'image/png', new Uint8Array([1, 2, 3])))).status, 400);
        assert.equal((await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(1, 'text/plain'))).status, 400);
        assert.equal((await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(1, 'image/png', new Uint8Array(5 * 1024 * 1024 + 1)))).status, 413);

        const tenImages = await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(10));
        assert.equal(tenImages.status, 201, JSON.stringify(tenImages.data));
        assert.equal(tenImages.data!.property.images.length, 10);
        const eleventh = await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(1));
        assert.equal(eleventh.status, 400);
        assert.match(eleventh.data!.message, /up to 10 images/i);
      } finally {
        await ownerA.request('DELETE', `/api/owner/properties/${property.id}`);
      }
    });

    it('accepts WebP signatures and rejects empty uploads', async () => {
      const property = await createAs(ownerA, { imageUrls: [] });
      try {
        const noFile = await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, new FormData());
        assert.equal(noFile.status, 400);
        const webp = await ownerA.request('POST', `/api/owner/properties/${property.id}/images`, imageForm(1, 'image/webp', webpHeader));
        assert.equal(webp.status, 201, JSON.stringify(webp.data));
        assert.match(webp.data!.property.images[0].url, /\.webp$/);
      } finally {
        await ownerA.request('DELETE', `/api/owner/properties/${property.id}`);
      }
    });
  });

  describe('owner dashboard features', () => {
    it('keeps room APIs scoped to property ownership and syncs availability', async () => {
      const property = await createAs(ownerA);
      const created = await ownerA.request('POST', `/api/owner/properties/${property.id}/rooms`, {
        name: 'Room 101',
        monthlyPrice: 2200,
        capacity: 2,
        isAvailable: true,
      });
      assert.equal(created.status, 201);
      const roomId = created.data!.room.id;
      assert.equal((await ownerB.request('GET', `/api/owner/properties/${property.id}/rooms`)).status, 404);
      assert.equal((await ownerB.request('PUT', `/api/owner/rooms/${roomId}`, {
        name: 'Room 101',
        monthlyPrice: 2200,
        capacity: 2,
        isAvailable: false,
      })).status, 404);
      assert.equal(
        (await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).availableRooms,
        1,
      );

      const unavailable = await ownerA.request('PUT', `/api/owner/rooms/${roomId}`, {
        name: 'Room 101',
        monthlyPrice: 2200,
        capacity: 2,
        isAvailable: false,
      });
      assert.equal(unavailable.status, 200);
      assert.equal(
        (await prisma.property.findUniqueOrThrow({ where: { id: property.id } })).availability,
        'FULLY_OCCUPIED',
      );
      assert.equal((await ownerA.request('DELETE', `/api/owner/rooms/${roomId}`)).status, 200);
    });

    it('provides owner statistics, inquiry responses, reviews, profile and verification', async () => {
      const property = await createAs(ownerA, { name: 'Owner Dashboard Listing' });
      await prisma.property.update({ where: { id: property.id }, data: { status: 'APPROVED' } });
      await ownerA.request('POST', `/api/owner/properties/${property.id}/rooms`, {
        name: 'Available Room',
        monthlyPrice: null,
        capacity: 1,
        isAvailable: true,
      });
      await ownerA.request('POST', `/api/owner/properties/${property.id}/rooms`, {
        name: 'Occupied Room',
        monthlyPrice: null,
        capacity: 1,
        isAvailable: false,
      });
      const inquiry = await boarder.request('POST', '/api/boarder/inquiries', {
        propertyId: property.id,
        message: 'Could I schedule a viewing this week?',
      });
      assert.equal(inquiry.status, 201);

      const dashboard = await ownerA.request('GET', '/api/owner/dashboard');
      assert.equal(dashboard.status, 200);
      assert.ok(dashboard.data!.stats.totalProperties >= 1);
      assert.ok(dashboard.data!.stats.approvedProperties >= 1);
      assert.ok(dashboard.data!.stats.totalInquiries >= 1);
      assert.ok(dashboard.data!.stats.newInquiries >= 1);
      assert.equal(dashboard.data!.stats.verificationStatus, 'NOT_VERIFIED');
      assert.equal(dashboard.data!.stats.earnings.available, false);
      assert.equal(dashboard.data!.stats.bookings.available, false);
      assert.ok(dashboard.data!.stats.propertyPerformance.some((item: { id: string; location: string }) =>
        item.id === property.id && item.location === 'San Jose'));
      assert.ok(dashboard.data!.stats.recentInquiries.some((item: { id: string; message: string }) =>
        item.id === inquiry.data!.inquiry.id && item.message === 'Could I schedule a viewing this week?'));

      const ownerInquiries = await ownerA.request('GET', '/api/owner/inquiries');
      assert.ok(ownerInquiries.data!.inquiries.some((item: { id: string }) => item.id === inquiry.data!.inquiry.id));
      assert.equal((await ownerB.request('PATCH', `/api/owner/inquiries/${inquiry.data!.inquiry.id}`, {
        response: 'Not your inquiry.',
      })).status, 404);
      const response = await ownerA.request('PATCH', `/api/owner/inquiries/${inquiry.data!.inquiry.id}`, {
        response: 'Yes, you can schedule a viewing this Friday.',
      });
      assert.equal(response.status, 200);
      assert.equal(response.data!.inquiry.status, 'RESPONDED');
      const boarderInquiries = await boarder.request('GET', '/api/boarder/inquiries');
      assert.equal(
        boarderInquiries.data!.inquiries.find((item: { id: string }) => item.id === inquiry.data!.inquiry.id).response,
        'Yes, you can schedule a viewing this Friday.',
      );
      assert.equal((await ownerA.request('PATCH', `/api/owner/inquiries/${inquiry.data!.inquiry.id}`, {
        status: 'CLOSED',
      })).data!.inquiry.status, 'CLOSED');

      const review = await boarder.request('POST', `/api/boarder/properties/${property.id}/reviews`, {
        rating: 4,
        content: 'A helpful review of this listing.',
      });
      await prisma.review.update({ where: { id: review.data!.review.id }, data: { status: 'APPROVED' } });
      const managedProperties = await ownerA.request('GET', '/api/owner/properties');
      const managedProperty = managedProperties.data!.properties.find(
        (item: { id: string }) => item.id === property.id,
      );
      assert.equal(managedProperty.rooms.length, 2);
      assert.equal(managedProperty.monthlyInquiries, 1);
      assert.equal(managedProperty.averageRating, 4);
      assert.equal(managedProperty.approvedReviewCount, 1);
      assert.equal(managedProperty.municipality, 'San Jose');
      const ownerReviews = await ownerA.request('GET', '/api/owner/reviews');
      assert.ok(ownerReviews.data!.reviews.some((item: { id: string }) => item.id === review.data!.review.id));
      const dashboardAfterReview = await ownerA.request('GET', '/api/owner/dashboard');
      assert.equal(dashboardAfterReview.data!.stats.propertyPerformance.find(
        (item: { id: string }) => item.id === property.id,
      ).averageRating, 4);
      assert.ok(dashboardAfterReview.data!.stats.recentReviews.some(
        (item: { id: string }) => item.id === review.data!.review.id,
      ));

      const profile = await ownerA.request('PATCH', '/api/owner/profile', {
        name: 'Olivia Updated',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      assert.equal(profile.status, 200);
      assert.equal(profile.data!.user.name, 'Olivia Updated');
      assert.equal('passwordHash' in profile.data!.user, false);
      await ownerA.request('PATCH', '/api/owner/profile', { name: ownerAInfo.name, avatarUrl: null });

      assert.equal((await ownerA.request('GET', '/api/owner/verification')).data!.verification, null);
      const verification = await ownerA.request('POST', '/api/owner/verification', {
        legalName: 'Olivia Owner',
        phoneNumber: '+639123456789',
        documentType: 'NATIONAL_ID',
        documentUrl: 'https://example.com/private-verification.pdf',
        additionalInfo: 'Please review my ID.',
      });
      assert.equal(verification.status, 201);
      assert.equal(verification.data!.verification.status, 'PENDING');
      assert.equal((await ownerB.request('GET', '/api/owner/verification')).data!.verification, null);
      assert.equal((await ownerA.request('POST', '/api/owner/verification', {
        legalName: 'Olivia Owner',
        phoneNumber: '+639123456789',
        documentType: 'NATIONAL_ID',
        documentUrl: 'https://example.com/private-verification.pdf',
      })).status, 409);
      await prisma.ownerVerification.update({
        where: { ownerId: ownerAId },
        data: { status: 'APPROVED' },
      });
      assert.equal((await ownerA.request('POST', '/api/owner/verification', {
        legalName: 'Olivia Owner',
        phoneNumber: '+639123456789',
        documentType: 'NATIONAL_ID',
        documentUrl: 'https://example.com/private-verification.pdf',
      })).status, 409);
      await prisma.property.update({ where: { id: property.id }, data: { status: 'PENDING' } });
    });
  });

  describe('owner payment tracking', () => {
    it('records confirmed paid entries, filters by owner and date/search, and exports safe owner-only CSV', async () => {
      const ownedProperty = await createAs(ownerA, {
        name: 'Payment Ledger Owned Property',
        imageUrls: [],
        amenities: [],
      });
      const foreignProperty = await createAs(ownerB, {
        name: 'Payment Ledger Foreign Property',
        imageUrls: [],
        amenities: [],
      });
      const roomResponse = await ownerA.request('POST', `/api/owner/properties/${ownedProperty.id}/rooms`, {
        name: 'Payment Room 1',
        monthlyPrice: 2200,
        capacity: 1,
        isAvailable: false,
      });
      assert.equal(roomResponse.status, 201, JSON.stringify(roomResponse.data));

      const paymentDate = new Date().toISOString();
      const ownPayment = await ownerA.request('POST', '/api/owner/payments', {
        propertyId: ownedProperty.id,
        roomId: roomResponse.data!.room.id,
        boarderName: 'Mina Resident',
        amount: 2200,
        paymentDate,
        paymentMethod: 'GCASH',
        referenceNumber: 'OWN-REFERENCE-001',
        notes: '=HYPERLINK("https://example.com")',
      });
      assert.equal(ownPayment.status, 201, JSON.stringify(ownPayment.data));
      assert.equal(ownPayment.data!.record.status, 'PAID');
      assert.equal(ownPayment.data!.record.room.name, 'Payment Room 1');

      const foreignPayment = await ownerB.request('POST', '/api/owner/payments', {
        propertyId: foreignProperty.id,
        boarderName: 'Foreign Resident',
        amount: 3400,
        paymentDate,
        paymentMethod: 'CASH',
      });
      assert.equal(foreignPayment.status, 201, JSON.stringify(foreignPayment.data));

      const ownerRecords = await ownerA.request('GET', '/api/owner/payments');
      assert.equal(ownerRecords.status, 200, JSON.stringify(ownerRecords.data));
      assert.equal(ownerRecords.data!.pagination.total, 1);
      assert.equal(ownerRecords.data!.records[0].property.id, ownedProperty.id);
      assert.equal(ownerRecords.data!.summary.totalCollected, 2200);
      assert.equal(ownerRecords.data!.summary.completedCount, 1);
      assert.ok(ownerRecords.data!.properties.some((item: { id: string }) => item.id === ownedProperty.id));
      assert.ok(!ownerRecords.data!.properties.some((item: { id: string }) => item.id === foreignProperty.id));

      const dateFilter = paymentDate.slice(0, 10);
      const filtered = await ownerA.request(
        'GET',
        `/api/owner/payments?search=OWN-REFERENCE-001&propertyId=${ownedProperty.id}&paymentMethod=GCASH&from=${dateFilter}&to=${dateFilter}`,
      );
      assert.equal(filtered.status, 200, JSON.stringify(filtered.data));
      assert.equal(filtered.data!.pagination.total, 1);
      assert.equal((await ownerA.request('GET', '/api/owner/payments?paymentMethod=NOT_A_METHOD')).status, 400);
      assert.equal((await ownerA.request('GET', '/api/owner/payments?from=2026-02-30')).status, 400);
      assert.equal((await ownerA.request(
        'POST',
        '/api/owner/payments',
        {
          propertyId: ownedProperty.id,
          roomId: roomResponse.data!.room.id,
          boarderName: 'Invalid Resident',
          amount: 0,
          paymentDate,
          paymentMethod: 'CASH',
        },
      )).status, 400);
      assert.equal((await ownerA.request('POST', '/api/owner/payments', {
        propertyId: ownedProperty.id,
        boarderName: 'Future Resident',
        amount: 1000,
        paymentDate: new Date(Date.now() + 86_400_000).toISOString(),
        paymentMethod: 'CASH',
      })).status, 400);
      assert.equal((await ownerA.request('POST', '/api/owner/payments', {
        propertyId: ownedProperty.id,
        roomId: 'not-a-room-in-this-property',
        boarderName: 'Invalid Room Resident',
        amount: 1000,
        paymentDate,
        paymentMethod: 'CASH',
      })).status, 400);

      assert.equal(
        (await ownerB.request('GET', `/api/owner/payments/${ownPayment.data!.record.id}`)).status,
        404,
      );
      const auditEntry = await prisma.securityEvent.findFirst({
        where: { action: 'PAYMENT_RECORDED', userId: ownerAId, target: { contains: ownPayment.data!.record.id } },
      });
      assert.ok(auditEntry, 'Recording a payment should create an audit event.');

      const exportResponse = await fetch(`${baseUrl}/api/owner/payments/export.csv`, {
        headers: { Cookie: ownerA.cookie },
      });
      assert.equal(exportResponse.status, 200);
      const csv = await exportResponse.text();
      assert.match(csv, /OWN-REFERENCE-001/);
      assert.match(csv, /'=HYPERLINK/);
      assert.doesNotMatch(csv, /Payment Ledger Foreign Property|Foreign Resident|FOREIGN/);
      assert.equal((await ownerB.request('GET', `/api/owner/payments/${foreignPayment.data!.record.id}`)).status, 200);
      assert.equal((await ownerA.request('DELETE', `/api/owner/properties/${ownedProperty.id}`)).status, 409);
      assert.equal(await prisma.paymentRecord.count({ where: { id: ownPayment.data!.record.id } }), 1);
    });

    it('rejects payment records for properties owned by another account', async () => {
      const property = await createAs(ownerA, {
        name: 'Payment Ownership Boundary Property',
        imageUrls: [],
        amenities: [],
      });
      const response = await ownerB.request('POST', '/api/owner/payments', {
        propertyId: property.id,
        boarderName: 'Unauthorized Resident',
        amount: 1500,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'CASH',
      });
      assert.equal(response.status, 404);
    });
  });

  describe('owner inquiry management', () => {
    it('filters and paginates owner inquiries, reports status counts, and supports close/reopen', async () => {
      const reviewOwner = new TestClient(baseUrl);
      const reviewOwnerInfo = { name: 'Casey Inquiry Owner', email: 'casey-inquiry@example.com', password, role: 'OWNER' };
      assert.equal((await reviewOwner.request('POST', '/api/auth/register', reviewOwnerInfo)).status, 201);
      const ownerRecord = await prisma.user.findUniqueOrThrow({ where: { email: reviewOwnerInfo.email } });
      const boarderRecord = await prisma.user.findUniqueOrThrow({ where: { email: boarderInfo.email } });
      const propertyIds: string[] = [];

      for (let index = 0; index < 11; index += 1) {
        const property = await createAs(reviewOwner, {
          name: `Inquiry Center Property ${index}`,
          imageUrls: [],
          amenities: [],
        });
        await prisma.property.update({ where: { id: property.id }, data: { status: 'APPROVED' } });
        propertyIds.push(property.id);
        await prisma.inquiry.create({
          data: {
            senderId: boarderRecord.id,
            ownerId: ownerRecord.id,
            propertyId: property.id,
            message: `Question about inquiry center room ${index}`,
          },
        });
      }

      const otherOwnerProperty = await createAs(ownerB, {
        name: 'Private Other Owner Inquiry Property',
        imageUrls: [],
        amenities: [],
      });
      await prisma.property.update({ where: { id: otherOwnerProperty.id }, data: { status: 'APPROVED' } });
      const foreignInquiry = await prisma.inquiry.create({
        data: {
          senderId: boarderRecord.id,
          ownerId: ownerBId,
          propertyId: otherOwnerProperty.id,
          message: 'Private inquiry must not leak.',
        },
      });

      const firstPage = await reviewOwner.request('GET', '/api/owner/inquiries?page=1');
      assert.equal(firstPage.status, 200);
      assert.equal(firstPage.data!.pagination.pageSize, 10);
      assert.equal(firstPage.data!.pagination.total, 11);
      assert.equal(firstPage.data!.inquiries.length, 10);
      assert.equal(firstPage.data!.summary.total, 11);
      assert.equal(firstPage.data!.summary.waiting, 11);
      assert.equal(firstPage.data!.properties.some((item: { id: string }) => item.id === otherOwnerProperty.id), false);
      assert.equal(firstPage.data!.inquiries.some((item: { id: string }) => item.id === foreignInquiry.id), false);

      const secondPage = await reviewOwner.request('GET', '/api/owner/inquiries?page=2');
      assert.equal(secondPage.data!.inquiries.length, 1);
      const target = [...firstPage.data!.inquiries, ...secondPage.data!.inquiries]
        .find((item: { property: { id: string } }) => item.property.id === propertyIds[0]);
      assert.ok(target);

      const response = await reviewOwner.request('PATCH', `/api/owner/inquiries/${target.id}`, {
        response: 'Yes, this room is available next month.',
      });
      assert.equal(response.status, 200);
      assert.equal(response.data!.inquiry.status, 'RESPONDED');
      const closed = await reviewOwner.request('PATCH', `/api/owner/inquiries/${target.id}`, { status: 'CLOSED' });
      assert.equal(closed.data!.inquiry.status, 'CLOSED');
      const reopened = await reviewOwner.request('PATCH', `/api/owner/inquiries/${target.id}`, { status: 'RESPONDED' });
      assert.equal(reopened.status, 200);
      assert.equal(reopened.data!.inquiry.status, 'RESPONDED');

      const filtered = await reviewOwner.request('GET',
        `/api/owner/inquiries?propertyId=${target.property.id}&status=RESPONDED&search=available`);
      assert.equal(filtered.status, 200);
      assert.equal(filtered.data!.pagination.total, 1);
      assert.equal(filtered.data!.inquiries[0].id, target.id);
      assert.equal((await ownerB.request('PATCH', `/api/owner/inquiries/${target.id}`, { status: 'CLOSED' })).status, 404);
      assert.equal((await reviewOwner.request('GET', `/api/owner/inquiries?propertyId=${otherOwnerProperty.id}`)).data!.pagination.total, 0);
      for (const query of ['status=NEW', 'page=0', 'sort=RANDOM']) {
        assert.equal((await reviewOwner.request('GET', `/api/owner/inquiries?${query}`)).status, 400);
      }
    });
  });

  describe('owner review management', () => {
    it('returns owner-scoped review aggregates, filters, and paginates without exposing other owners', async () => {
      const boarderRecord = await prisma.user.findUniqueOrThrow({ where: { email: boarderInfo.email } });
      const reviewOwner = new TestClient(baseUrl);
      const reviewOwnerInfo = { name: 'Riley Review Owner', email: 'riley-review@example.com', password, role: 'OWNER' };
      assert.equal((await reviewOwner.request('POST', '/api/auth/register', reviewOwnerInfo)).status, 201);
      const ownerProperties: { id: string }[] = [];

      for (let index = 0; index < 11; index += 1) {
        const property = await createAs(reviewOwner, {
          name: `Review Center Property ${index}`,
          imageUrls: [],
          amenities: [],
        });
        ownerProperties.push({ id: property.id });
        await prisma.review.create({
          data: {
            boarderId: boarderRecord.id,
            propertyId: property.id,
            rating: index < 10 ? (index % 5) + 1 : 1,
            content: `Owner review center feedback ${index}`,
            status: index < 10 ? 'APPROVED' : 'PENDING',
          },
        });
      }

      const otherOwnerProperty = await createAs(ownerB, {
        name: 'Private Other Owner Review Property',
        imageUrls: [],
        amenities: [],
      });
      await prisma.review.create({
        data: {
          boarderId: boarderRecord.id,
          propertyId: otherOwnerProperty.id,
          rating: 5,
          content: 'Private feedback must not leak.',
          status: 'APPROVED',
        },
      });

      const firstPage = await reviewOwner.request('GET', '/api/owner/reviews?page=1');
      assert.equal(firstPage.status, 200);
      assert.equal(firstPage.data!.pagination.pageSize, 10);
      assert.equal(firstPage.data!.pagination.total, 11);
      assert.equal(firstPage.data!.reviews.length, 10);
      assert.equal(firstPage.data!.summary.total, 11);
      assert.equal(firstPage.data!.summary.approved, 10);
      assert.equal(firstPage.data!.summary.pending, 1);
      assert.equal(firstPage.data!.summary.averageRating, 3);
      assert.equal(firstPage.data!.summary.ratingBreakdown.find((item: { rating: number }) => item.rating === 5).count, 2);
      assert.equal(firstPage.data!.properties.some((item: { id: string }) => item.id === otherOwnerProperty.id), false);
      assert.equal(firstPage.data!.reviews.some((item: { content: string }) => item.content.includes('Private feedback')), false);

      const lastPage = await reviewOwner.request('GET', '/api/owner/reviews?page=2');
      assert.equal(lastPage.data!.reviews.length, 1);
      assert.equal(lastPage.data!.pagination.totalPages, 2);

      const filtered = await reviewOwner.request('GET',
        `/api/owner/reviews?propertyId=${ownerProperties[4].id}&rating=5&status=APPROVED&search=feedback%204`);
      assert.equal(filtered.status, 200);
      assert.equal(filtered.data!.pagination.total, 1);
      assert.equal(filtered.data!.reviews[0].property.id, ownerProperties[4].id);

      const foreignPropertyFilter = await reviewOwner.request('GET', `/api/owner/reviews?propertyId=${otherOwnerProperty.id}`);
      assert.equal(foreignPropertyFilter.status, 200);
      assert.equal(foreignPropertyFilter.data!.pagination.total, 0);
      for (const query of ['rating=6', 'status=REPORTED', 'page=0']) {
        assert.equal((await reviewOwner.request('GET', `/api/owner/reviews?${query}`)).status, 400);
      }
    });
  });

  describe('create', () => {
    it('creates a PENDING listing owned by the logged-in owner', async () => {
      const res = await ownerA.request('POST', '/api/owner/properties', validProperty);
      assert.equal(res.status, 201);
      const p = res.data!.property;
      assert.equal(p.status, 'PENDING');
      assert.equal(p.ownerId, ownerAId);
      assert.equal(p.municipality, 'San Jose');
      assert.equal(p.propertyType, 'BOARDING_HOUSE');
      assert.deepEqual(p.amenities.map((a: { slug: string }) => a.slug).sort(), ['study-area', 'wifi']);
      assert.equal(p.images.length, 2);
      assert.equal(p.images[0].isPrimary, true);
      assert.equal(p.images[1].isPrimary, false);
    });

    it('ignores attempts to choose status, owner or id (mass assignment)', async () => {
      const p = await createAs(ownerA, { status: 'APPROVED', ownerId: ownerBId, id: 'hacked', rejectionReason: 'x' });
      assert.equal(p.status, 'PENDING');
      assert.equal(p.ownerId, ownerAId);
      assert.notEqual(p.id, 'hacked');
    });

    it('stores 0 available rooms for a FULLY_OCCUPIED listing', async () => {
      const p = await createAs(ownerA, { availability: 'FULLY_OCCUPIED', availableRooms: 3 });
      assert.equal(p.availableRooms, 0);
    });

    it('works with no amenities, no images and optional coordinates', async () => {
      const p = await createAs(ownerA, { amenities: [], imageUrls: [], latitude: 13.2, longitude: 120.6 });
      assert.equal(p.amenities.length, 0);
      assert.equal(p.images.length, 0);
      assert.equal(p.latitude, 13.2);
    });
  });

  describe('validation', () => {
    it('rejects missing fields with field errors', async () => {
      const res = await ownerA.request('POST', '/api/owner/properties', {});
      assert.equal(res.status, 400);
      const fields = (res.data!.errors as { field: string }[]).map((e) => e.field);
      for (const f of ['name', 'propertyType', 'description', 'monthlyPrice', 'municipality', 'address', 'availableRooms', 'availability']) {
        assert.ok(fields.includes(f), `expected an error for ${f}`);
      }
    });

    it('rejects each kind of invalid value and creates nothing', async () => {
      const before = await prisma.property.count({ where: { ownerId: ownerAId } });
      const cases: [Record<string, unknown>, string][] = [
        [{ name: 'ab' }, 'name'],
        [{ propertyType: 'MANSION' }, 'propertyType'],
        [{ description: 'too short' }, 'description'],
        [{ monthlyPrice: 0 }, 'monthlyPrice'],
        [{ monthlyPrice: -50 }, 'monthlyPrice'],
        [{ monthlyPrice: '2500' }, 'monthlyPrice'],
        [{ monthlyPrice: 1500.5 }, 'monthlyPrice'],
        [{ address: 'x' }, 'address'],
        [{ availableRooms: -1 }, 'availableRooms'],
        [{ availability: 'AVAILABLE', availableRooms: 0 }, 'availableRooms'],
        [{ availability: 'SOMETIMES' }, 'availability'],
        [{ imageUrls: ['javascript:alert(1)'] }, 'imageUrls.0'],
        [{ imageUrls: ['http://insecure.example.com/a.jpg'] }, 'imageUrls.0'],
        [{ imageUrls: Array(11).fill('https://example.com/a.jpg') }, 'imageUrls'],
        [{ latitude: 12.5 }, 'latitude'],
        [{ latitude: 999, longitude: 120.9 }, 'latitude'],
        [{ municipality: 'Atlantis' }, 'municipality'],
        [{ amenities: ['does-not-exist'] }, 'amenities'],
        [{ amenities: ['Wi-Fi!'] }, 'amenities.0'],
      ];
      for (const [overrides, field] of cases) {
        const res = await ownerA.request('POST', '/api/owner/properties', { ...validProperty, ...overrides });
        assert.equal(res.status, 400, `${JSON.stringify(overrides)} should be rejected`);
        const fields = (res.data!.errors as { field: string }[]).map((e) => e.field);
        assert.ok(fields.includes(field), `${JSON.stringify(overrides)} should report "${field}", got ${fields}`);
      }
      assert.equal(await prisma.property.count({ where: { ownerId: ownerAId } }), before);
    });
  });

  describe('read', () => {
    it('lists only the logged-in owner\'s properties', async () => {
      const mine = await createAs(ownerB, { name: 'Oscar Private Room', propertyType: 'ROOM' });
      const listB = await ownerB.request('GET', '/api/owner/properties');
      assert.equal(listB.status, 200);
      assert.ok(listB.data!.properties.every((p: { ownerId: string }) => p.ownerId === ownerBId));
      assert.ok(listB.data!.properties.some((p: { id: string }) => p.id === mine.id));

      const listA = await ownerA.request('GET', '/api/owner/properties');
      assert.ok(!listA.data!.properties.some((p: { id: string }) => p.id === mine.id));
    });

    it('filters by status and rejects an invalid status filter', async () => {
      const pending = await ownerA.request('GET', '/api/owner/properties?status=PENDING');
      assert.equal(pending.status, 200);
      assert.ok(pending.data!.properties.every((p: { status: string }) => p.status === 'PENDING'));
      const approved = await ownerA.request('GET', '/api/owner/properties?status=APPROVED');
      assert.equal(approved.data!.properties.length, 0);
      assert.equal((await ownerA.request('GET', '/api/owner/properties?status=BANANA')).status, 400);
    });

    it('returns own property, and 404 for someone else\'s or a missing one', async () => {
      const p = await createAs(ownerA);
      assert.equal((await ownerA.request('GET', `/api/owner/properties/${p.id}`)).status, 200);
      assert.equal((await ownerB.request('GET', `/api/owner/properties/${p.id}`)).status, 404);
      assert.equal((await ownerA.request('GET', '/api/owner/properties/doesnotexist')).status, 404);
    });
  });

  describe('update', () => {
    it('updates fields without removing existing images and appends legacy image URLs', async () => {
      const p = await createAs(ownerA);
      const res = await ownerA.request('PUT', `/api/owner/properties/${p.id}`, {
        ...validProperty,
        name: 'Renamed Boarding House',
        monthlyPrice: 2200,
        municipality: 'Mamburao',
        amenities: ['parking'],
        imageUrls: ['https://example.com/new.jpg'],
      });
      assert.equal(res.status, 200);
      const u = res.data!.property;
      assert.equal(u.name, 'Renamed Boarding House');
      assert.equal(u.monthlyPrice, 2200);
      assert.equal(u.municipality, 'Mamburao');
      assert.deepEqual(u.amenities.map((a: { slug: string }) => a.slug), ['parking']);
      assert.equal(u.images.length, 3);
      assert.equal(u.images[0].url, 'https://example.com/a.jpg');
      assert.equal(u.images[0].isPrimary, true);
      assert.equal(u.images.some((image: { url: string }) => image.url === 'https://example.com/new.jpg'), true);
      assert.equal(await prisma.propertyImage.count({ where: { propertyId: p.id } }), 3);
    });

    it('does not let another owner update it, and leaves the data unchanged', async () => {
      const p = await createAs(ownerA);
      const res = await ownerB.request('PUT', `/api/owner/properties/${p.id}`, { ...validProperty, name: 'Stolen listing' });
      assert.equal(res.status, 404);
      const stored = await prisma.property.findUniqueOrThrow({ where: { id: p.id } });
      assert.equal(stored.name, validProperty.name);
    });

    it('validates updates too', async () => {
      const p = await createAs(ownerA);
      const res = await ownerA.request('PUT', `/api/owner/properties/${p.id}`, { ...validProperty, monthlyPrice: -1 });
      assert.equal(res.status, 400);
    });

    it('sends an APPROVED listing back to PENDING when edited', async () => {
      const p = await createAs(ownerA);
      await prisma.property.update({ where: { id: p.id }, data: { status: 'APPROVED' } });
      const res = await ownerA.request('PUT', `/api/owner/properties/${p.id}`, { ...validProperty, name: 'Edited after approval' });
      assert.equal(res.data!.property.status, 'PENDING');
    });
  });

  describe('delete', () => {
    it('does not let another owner delete it', async () => {
      const p = await createAs(ownerA);
      assert.equal((await ownerB.request('DELETE', `/api/owner/properties/${p.id}`)).status, 404);
      assert.equal(await prisma.property.count({ where: { id: p.id } }), 1);
    });

    it('deletes own property together with its images', async () => {
      const p = await createAs(ownerA);
      assert.equal((await ownerA.request('DELETE', `/api/owner/properties/${p.id}`)).status, 200);
      assert.equal((await ownerA.request('GET', `/api/owner/properties/${p.id}`)).status, 404);
      assert.equal(await prisma.propertyImage.count({ where: { propertyId: p.id } }), 0);
      assert.equal((await ownerA.request('DELETE', `/api/owner/properties/${p.id}`)).status, 404);
    });
  });

  describe('admin approval structure', () => {
    it('blocks owners and boarders from the admin endpoints (403) and visitors (401)', async () => {
      const p = await createAs(ownerA);
      for (const client of [ownerA, boarder]) {
        assert.equal((await client.request('GET', '/api/admin/properties')).status, 403);
        assert.equal((await client.request('PATCH', `/api/admin/properties/${p.id}/status`, { status: 'APPROVED' })).status, 403);
      }
      assert.equal((await new TestClient(baseUrl).request('GET', '/api/admin/properties')).status, 401);
      const stored = await prisma.property.findUniqueOrThrow({ where: { id: p.id } });
      assert.equal(stored.status, 'PENDING');
    });

    it('lets an admin review the queue, approve, reject and deactivate', async () => {
      const p = await createAs(ownerA, { name: 'Needs Review Apartment', propertyType: 'APARTMENT' });

      const queue = await admin.request('GET', '/api/admin/properties?status=PENDING');
      assert.equal(queue.status, 200);
      const entry = queue.data!.properties.find((x: { id: string }) => x.id === p.id);
      assert.ok(entry);
      assert.equal(entry.owner.email, ownerAInfo.email);
      assert.ok(!('passwordHash' in entry.owner));

      const approved = await admin.request('PATCH', `/api/admin/properties/${p.id}/status`, { status: 'APPROVED' });
      assert.equal(approved.status, 200);
      assert.equal(approved.data!.property.status, 'APPROVED');

      const noReason = await admin.request('PATCH', `/api/admin/properties/${p.id}/status`, { status: 'REJECTED' });
      assert.equal(noReason.status, 400);

      const rejected = await admin.request('PATCH', `/api/admin/properties/${p.id}/status`, {
        status: 'REJECTED',
        rejectionReason: 'Photos do not match the address.',
      });
      assert.equal(rejected.data!.property.status, 'REJECTED');

      const seenByOwner = await ownerA.request('GET', `/api/owner/properties/${p.id}`);
      assert.equal(seenByOwner.data!.property.status, 'REJECTED');
      assert.equal(seenByOwner.data!.property.rejectionReason, 'Photos do not match the address.');

      // Owner fixes and resubmits: back to PENDING, reason cleared
      const resubmitted = await ownerA.request('PUT', `/api/owner/properties/${p.id}`, validProperty);
      assert.equal(resubmitted.data!.property.status, 'PENDING');
      assert.equal(resubmitted.data!.property.rejectionReason, null);

      const inactive = await admin.request('PATCH', `/api/admin/properties/${p.id}/status`, { status: 'INACTIVE' });
      assert.equal(inactive.data!.property.status, 'INACTIVE');
    });

    it('rejects invalid status values and unknown ids', async () => {
      const p = await createAs(ownerA);
      assert.equal((await admin.request('PATCH', `/api/admin/properties/${p.id}/status`, { status: 'PENDING' })).status, 400);
      assert.equal((await admin.request('PATCH', `/api/admin/properties/${p.id}/status`, { status: 'DELETED' })).status, 400);
      assert.equal((await admin.request('PATCH', '/api/admin/properties/doesnotexist/status', { status: 'APPROVED' })).status, 404);
    });
  });

  describe('admin moderation', () => {
    it('protects dashboards and moderation queues from non-admin users', async () => {
      for (const client of [ownerA, boarder]) {
        assert.equal((await client.request('GET', '/api/admin/dashboard')).status, 403);
        assert.equal((await client.request('GET', '/api/admin/users')).status, 403);
        assert.equal((await client.request('PATCH', '/api/admin/profile', {
          name: 'Changed Name',
          email: 'changed@example.com',
        })).status, 403);
        assert.equal((await client.request('GET', '/api/admin/export/summary')).status, 403);
        assert.equal((await client.request('GET', '/api/admin/export')).status, 403);
        assert.equal((await client.request('GET', '/api/admin/reviews')).status, 403);
        assert.equal((await client.request('GET', '/api/admin/reports')).status, 403);
        assert.equal((await client.request('GET', '/api/admin/verifications')).status, 403);
      }
      const anonymous = new TestClient(baseUrl);
      assert.equal((await anonymous.request('GET', '/api/admin/dashboard')).status, 401);
      assert.equal((await anonymous.request('GET', '/api/admin/users')).status, 401);
      assert.equal((await anonymous.request('GET', '/api/admin/export')).status, 401);
    });

    it('provides queue metrics and moderates reviews, reports, and owner verification', async () => {
      const avatarForm = new FormData();
      avatarForm.append(
        'avatar',
        new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/b0cAAAAASUVORK5CYII=', 'base64')], {
          type: 'image/png',
        }),
        'profile.png',
      );
      const uploadedAvatar = await admin.request('POST', '/api/admin/profile/avatar', avatarForm);
      assert.equal(uploadedAvatar.status, 200);
      assert.match(uploadedAvatar.data!.user.avatarUrl, /^\/api\/uploads\/avatars\/[a-f0-9-]+\.png$/);
      const servedAvatar = await fetch(`${baseUrl}${uploadedAvatar.data!.user.avatarUrl}`);
      assert.equal(servedAvatar.status, 200);
      assert.equal(servedAvatar.headers.get('content-type'), 'image/png');
      const removedAvatar = await admin.request('DELETE', '/api/admin/profile/avatar');
      assert.equal(removedAvatar.status, 200);
      assert.equal(removedAvatar.data!.user.avatarUrl, null);
      assert.equal((await fetch(`${baseUrl}${uploadedAvatar.data!.user.avatarUrl}`)).status, 404);

      const invalidAvatarForm = new FormData();
      invalidAvatarForm.append('avatar', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
      assert.equal((await admin.request('POST', '/api/admin/profile/avatar', invalidAvatarForm)).status, 400);

      const userList = await admin.request('GET', '/api/admin/users');
      assert.equal(userList.status, 200);
      assert.ok(userList.data!.pagination.total >= 4);
      assert.ok(userList.data!.users.some((user: { email: string }) => user.email === ownerAInfo.email));
      assert.equal('passwordHash' in userList.data!.users[0], false);
      const filteredUsers = await admin.request('GET', '/api/admin/users?role=OWNER&q=olivia');
      assert.equal(filteredUsers.status, 200);
      assert.equal(filteredUsers.data!.pagination.total, 1);
      assert.equal(filteredUsers.data!.users[0].email, ownerAInfo.email);
      assert.equal((await admin.request('GET', '/api/admin/users?role=INVALID')).status, 400);
      assert.equal((await admin.request('GET', '/api/admin/users?page=0')).status, 400);

      const publicSettings = await new TestClient(baseUrl).request('GET', '/api/settings');
      assert.equal(publicSettings.status, 200);
      assert.equal(publicSettings.data!.settings.siteName, 'StayFinder');
      assert.equal(publicSettings.data!.settings.allowRegistrations, true);

      const initialProfile = await admin.request('PATCH', '/api/admin/profile', {
        name: 'Ada Updated',
        email: 'ada.updated@example.com',
      });
      assert.equal(initialProfile.status, 200);
      assert.equal(initialProfile.data!.user.name, 'Ada Updated');
      assert.equal(initialProfile.data!.user.email, 'ada.updated@example.com');
      assert.equal('passwordHash' in initialProfile.data!.user, false);
      assert.equal((await admin.request('PATCH', '/api/admin/profile', {
        name: 'Ada Updated',
        email: 'ada.updated@example.com',
        currentPassword: 'wrong-password',
        newPassword: 'NewAdminPass456',
      })).status, 400);
      const changedPassword = await admin.request('PATCH', '/api/admin/profile', {
        name: 'Ada Updated',
        email: 'ada.updated@example.com',
        currentPassword: password,
        newPassword: 'NewAdminPass456',
      });
      assert.equal(changedPassword.status, 200);
      const updatedLogin = new TestClient(baseUrl);
      assert.equal((await updatedLogin.request('POST', '/api/auth/login', {
        email: 'ada.updated@example.com',
        password: 'NewAdminPass456',
      })).status, 200);
      assert.equal((await updatedLogin.request('POST', '/api/auth/login', {
        email: 'ada.updated@example.com',
        password,
      })).status, 401);
      const restoredProfile = await admin.request('PATCH', '/api/admin/profile', {
        name: adminInfo.name,
        email: adminInfo.email,
        currentPassword: 'NewAdminPass456',
        newPassword: password,
      });
      assert.equal(restoredProfile.status, 200);

      const settings = await admin.request('GET', '/api/admin/settings');
      assert.equal(settings.status, 200);
      assert.equal(settings.data!.settings.autoApproveListings, false);
      assert.equal((await ownerA.request('GET', '/api/admin/settings')).status, 403);
      assert.equal((await admin.request('PUT', '/api/admin/settings', {
        siteName: 'A',
        allowRegistrations: true,
        autoApproveListings: false,
      })).status, 400);

      const disabledSettings = await admin.request('PUT', '/api/admin/settings', {
        siteName: 'StayFinder Test',
        allowRegistrations: false,
        autoApproveListings: true,
      });
      assert.equal(disabledSettings.status, 200);
      const blockedRegistration = await new TestClient(baseUrl).request('POST', '/api/auth/register', {
        name: 'New Boarder',
        email: 'new-boarder@example.com',
        password,
        role: 'BOARDER',
      });
      assert.equal(blockedRegistration.status, 403);
      assert.equal(blockedRegistration.data!.message, 'New account registration is currently disabled.');

      const autoApprovedProperty = await createAs(ownerA, { name: 'Auto Approved Settings Listing' });
      assert.equal(autoApprovedProperty.status, 'APPROVED');
      const restoredSettings = await admin.request('PUT', '/api/admin/settings', {
        siteName: 'StayFinder',
        allowRegistrations: true,
        autoApproveListings: false,
      });
      assert.equal(restoredSettings.status, 200);

      const summary = await admin.request('GET', '/api/admin/export/summary');
      assert.equal(summary.status, 200);
      assert.ok(summary.data!.counts.users >= 4);
      assert.ok(summary.data!.counts.properties >= 1);

      const dataExport = await admin.request('GET', '/api/admin/export');
      assert.equal(dataExport.status, 200);
      assert.deepEqual(dataExport.data!.excludedTables, ['sessions', 'oauth_accounts']);
      assert.ok(dataExport.data!.data.users.length >= 4);
      assert.equal('passwordHash' in dataExport.data!.data.users[0], false);
      assert.ok(dataExport.data!.data.properties.length >= 1);

      const property = await createAs(ownerA, { name: 'Admin Moderation Listing' });
      await prisma.property.update({ where: { id: property.id }, data: { status: 'APPROVED' } });

      const review = await boarder.request('POST', `/api/boarder/properties/${property.id}/reviews`, {
        rating: 5,
        content: 'A review awaiting the administrator.',
      });
      const report = await boarder.request('POST', `/api/boarder/properties/${property.id}/reports`, {
        reason: 'INCORRECT_INFORMATION',
        details: 'The listing address appears to be incomplete.',
      });
      const verification = await ownerB.request('POST', '/api/owner/verification', {
        legalName: 'Oscar Owner',
        phoneNumber: '+639123456780',
        documentType: 'PASSPORT',
        documentUrl: 'https://example.com/private-owner-document.pdf',
      });
      assert.equal(review.status, 201);
      assert.equal(report.status, 201);
      assert.equal(verification.status, 201);

      const dashboard = await admin.request('GET', '/api/admin/dashboard');
      assert.equal(dashboard.status, 200);
      assert.ok(dashboard.data!.stats.totalUsers >= 4);
      assert.ok(dashboard.data!.stats.pendingProperties >= 1);
      assert.ok(dashboard.data!.stats.pendingReviews >= 1);
      assert.ok(dashboard.data!.stats.pendingReports >= 1);
      assert.ok(dashboard.data!.stats.pendingVerifications >= 1);

      const reviewQueue = await admin.request('GET', '/api/admin/reviews?status=PENDING');
      assert.ok(reviewQueue.data!.reviews.some((item: { id: string }) => item.id === review.data!.review.id));
      const beforeApproval = await new TestClient(baseUrl).request('GET', `/api/properties/${property.id}`);
      assert.equal(beforeApproval.data!.property.reviews.some((item: { id: string }) => item.id === review.data!.review.id), false);
      assert.equal((await admin.request('GET', '/api/admin/reviews?status=UNKNOWN')).status, 400);
      assert.equal((await admin.request('PATCH', `/api/admin/reviews/${review.data!.review.id}/status`, {
        status: 'APPROVED',
      })).status, 200);
      assert.equal((await boarder.request('GET', '/api/boarder/reviews')).data!.reviews
        .find((item: { id: string }) => item.id === review.data!.review.id).status, 'APPROVED');

      const reportQueue = await admin.request('GET', '/api/admin/reports?status=PENDING');
      assert.ok(reportQueue.data!.reports.some((item: { id: string }) => item.id === report.data!.report.id));
      assert.equal((await admin.request('PATCH', `/api/admin/reports/${report.data!.report.id}/status`, {
        status: 'RESOLVED',
      })).status, 200);
      assert.equal((await boarder.request('GET', '/api/boarder/reports')).data!.reports
        .find((item: { id: string }) => item.id === report.data!.report.id).status, 'RESOLVED');
      const publicListing = await new TestClient(baseUrl).request('GET', `/api/properties/${property.id}`);
      assert.ok(publicListing.data!.property.reviews.some((item: { content: string }) => item.content === 'A review awaiting the administrator.'));
      assert.equal('boarderId' in publicListing.data!.property.reviews[0], false);

      const verificationQueue = await admin.request('GET', '/api/admin/verifications?status=PENDING');
      const privateRecord = verificationQueue.data!.verifications
        .find((item: { id: string }) => item.id === verification.data!.verification.id);
      assert.ok(privateRecord);
      assert.equal(privateRecord.documentUrl, 'https://example.com/private-owner-document.pdf');
      assert.equal((await admin.request('PATCH', `/api/admin/verifications/${verification.data!.verification.id}/status`, {
        status: 'REJECTED',
      })).status, 400);
      const rejected = await admin.request('PATCH', `/api/admin/verifications/${verification.data!.verification.id}/status`, {
        status: 'REJECTED',
        rejectionReason: 'The document image is not readable.',
      });
      assert.equal(rejected.status, 200);
      assert.equal(rejected.data!.verification.rejectionReason, 'The document image is not readable.');
      const resubmitted = await ownerB.request('POST', '/api/owner/verification', {
        legalName: 'Oscar Owner',
        phoneNumber: '+639123456780',
        documentType: 'PASSPORT',
        documentUrl: 'https://example.com/private-owner-document.pdf',
      });
      assert.equal(resubmitted.status, 201);
      assert.equal(resubmitted.data!.verification.status, 'PENDING');

      const ownerBProperty = await createAs(ownerB, { name: 'Verified Owner Public Listing' });
      await prisma.property.update({ where: { id: ownerBProperty.id }, data: { status: 'APPROVED' } });
      assert.equal((await admin.request('PATCH', `/api/admin/verifications/${verification.data!.verification.id}/status`, {
        status: 'APPROVED',
      })).status, 200);
      const verifiedPublicProperty = await new TestClient(baseUrl).request('GET', `/api/properties/${ownerBProperty.id}`);
      assert.equal(verifiedPublicProperty.data!.property.owner.isVerified, true);
    });
  });

  describe('Prisma database', () => {
    it('links property to owner, location and amenities', async () => {
      const p = await createAs(ownerA, { municipality: 'Sablayan', amenities: ['wifi', 'cctv', 'parking'] });
      const row = await prisma.property.findUniqueOrThrow({
        where: { id: p.id },
        include: { owner: true, location: true, amenities: true, images: true },
      });
      assert.equal(row.owner.email, ownerAInfo.email);
      assert.equal(row.location.name, 'Sablayan');
      assert.equal(row.amenities.length, 3);
      assert.equal(row.status, 'PENDING');
    });

    it('prevents deleting a municipality that still has properties', async () => {
      await createAs(ownerA, { municipality: 'Paluan' });
      await assert.rejects(prisma.location.delete({ where: { name: 'Paluan' } }));
    });

    it('cascades: deleting a user removes their properties, images and rooms', async () => {
      const temp = await prisma.user.create({ data: { name: 'Temp Owner', email: 'temp@example.com', role: 'OWNER' } });
      const location = await prisma.location.findUniqueOrThrow({ where: { name: 'Looc' } });
      const property = await prisma.property.create({
        data: {
          ownerId: temp.id,
          locationId: location.id,
          name: 'Temp Property',
          description: 'A temporary property used to test cascading deletes.',
          propertyType: 'ROOM',
          monthlyPrice: 1000,
          address: 'Somewhere in Looc',
          images: { create: [{ url: 'https://example.com/t.jpg', isPrimary: true }] },
          rooms: { create: [{ name: 'Room 1', capacity: 2 }] },
        },
      });
      assert.equal(await prisma.room.count({ where: { propertyId: property.id } }), 1);

      await prisma.user.delete({ where: { id: temp.id } });
      assert.equal(await prisma.property.count({ where: { id: property.id } }), 0);
      assert.equal(await prisma.propertyImage.count({ where: { propertyId: property.id } }), 0);
      assert.equal(await prisma.room.count({ where: { propertyId: property.id } }), 0);
    });

    it('seeding reference data twice does not create duplicates', async () => {
      const { seedReferenceData } = await import('../prisma/seedData');
      await seedReferenceData(prisma);
      assert.equal(await prisma.location.count(), 11);
    });
  });
});
