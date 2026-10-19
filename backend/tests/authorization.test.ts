// Authorization tests: authentication gates (401), role gates (403), owner-to-owner
// data isolation, boarder-to-boarder data isolation, and what public listing
// endpoints are allowed to show.
// Run with: npm test      (uses its own database file: backend/prisma/test-authorization.db)
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { TestClient } from './helpers/testClient';

const TEST_DATABASE_URL = 'file:./test-authorization.db';
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

describe('Authorization', () => {
  let server: Server;
  let baseUrl = '';
  let prisma: typeof import('../src/lib/prisma').prisma;

  const password = 'Passw0rd123';
  const ownerAInfo = { name: 'Alma Owner', email: 'auth-owner-a@example.com', password, role: 'OWNER' };
  const ownerBInfo = { name: 'Benjamin Owner', email: 'auth-owner-b@example.com', password, role: 'OWNER' };
  const boarderOneInfo = { name: 'Bella Boarder', email: 'auth-boarder-one@example.com', password, role: 'BOARDER' };
  const boarderTwoInfo = { name: 'Brent Boarder', email: 'auth-boarder-two@example.com', password, role: 'BOARDER' };
  const adminInfo = { name: 'Ada Admin', email: 'auth-admin@example.com', password };

  let ownerA: TestClient;
  let ownerB: TestClient;
  let boarderOne: TestClient;
  let boarderTwo: TestClient;
  let admin: TestClient;

  const validProperty = {
    name: 'Authorization Boarding House',
    propertyType: 'BOARDING_HOUSE',
    description: 'Clean and safe boarding house used by the authorization test suite.',
    monthlyPrice: 1800,
    municipality: 'San Jose',
    address: 'Purok 3, Poblacion, San Jose',
    availableRooms: 4,
    availability: 'AVAILABLE',
    amenities: ['wifi'],
    imageUrls: ['https://example.com/auth.jpg'],
  };

  async function createAs(client: TestClient, overrides: Record<string, unknown> = {}) {
    const res = await client.request('POST', '/api/owner/properties', { ...validProperty, ...overrides });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    return res.data!.property as Record<string, any>;
  }

  before(async () => {
    const backendDir = path.resolve(__dirname, '..');
    const testDbFile = path.join(backendDir, 'prisma', 'test-authorization.db');
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
    boarderOne = new TestClient(baseUrl);
    boarderTwo = new TestClient(baseUrl);
    admin = new TestClient(baseUrl);
    await ownerA.request('POST', '/api/auth/register', ownerAInfo);
    await ownerB.request('POST', '/api/auth/register', ownerBInfo);
    await boarderOne.request('POST', '/api/auth/register', boarderOneInfo);
    await boarderTwo.request('POST', '/api/auth/register', boarderTwoInfo);
    const login = await admin.request('POST', '/api/auth/login', { email: adminInfo.email, password });
    assert.equal(login.status, 200);
  });

  after(async () => {
    server?.close();
    await prisma?.$disconnect();
  });

  describe('unauthenticated access', () => {
    it('answers 401 without a session cookie', async () => {
      const anonymous = new TestClient(baseUrl);
      const attempts: [string, string, unknown?][] = [
        ['GET', '/api/owner/properties'],
        ['POST', '/api/owner/properties', validProperty],
        ['GET', '/api/owner/settings'],
        ['GET', '/api/owner/payments'],
        ['GET', '/api/boarder/favorites'],
        ['GET', '/api/boarder/settings'],
        ['POST', '/api/boarder/inquiries', { propertyId: 'some-property', message: 'An anonymous visitor question.' }],
        ['GET', '/api/boarder/reviews'],
        ['GET', '/api/admin'],
        ['GET', '/api/admin/users'],
        ['GET', '/api/admin/properties'],
        ['PATCH', '/api/admin/properties/some-property/status', { status: 'APPROVED' }],
      ];
      for (const [method, url, body] of attempts) {
        const res = await anonymous.request(method, url, body);
        assert.equal(res.status, 401, `${method} ${url}`);
      }
    });
  });

  describe('role restrictions', () => {
    it('gives a boarder 403 on owner and admin endpoints', async () => {
      const target = await createAs(ownerA, { name: 'Authorization Role Target Boarder' });
      const attempts: [string, string, unknown?][] = [
        ['GET', '/api/owner/properties'],
        ['POST', '/api/owner/properties', validProperty],
        ['GET', `/api/owner/properties/${target.id}`],
        ['GET', '/api/owner/payments'],
        ['GET', '/api/owner/settings'],
        ['GET', '/api/admin'],
        ['GET', '/api/admin/users'],
        ['GET', '/api/admin/properties'],
        ['PATCH', `/api/admin/properties/${target.id}/status`, { status: 'APPROVED' }],
      ];
      for (const [method, url, body] of attempts) {
        const res = await boarderOne.request(method, url, body);
        assert.equal(res.status, 403, `${method} ${url}`);
      }
      // The role gate runs before the status change can happen.
      const stored = await prisma.property.findUniqueOrThrow({ where: { id: target.id } });
      assert.equal(stored.status, 'PENDING');
    });

    it('gives an owner 403 on boarder and admin endpoints', async () => {
      const attempts: [string, string, unknown?][] = [
        ['GET', '/api/boarder/favorites'],
        ['POST', '/api/boarder/favorites/any-property'],
        ['POST', '/api/boarder/inquiries', { propertyId: 'some-property', message: 'An owner cannot ask this way.' }],
        ['GET', '/api/boarder/reviews'],
        ['GET', '/api/boarder/settings'],
        ['GET', '/api/admin'],
        ['GET', '/api/admin/users'],
        ['PATCH', '/api/admin/properties/some-property/status', { status: 'APPROVED' }],
      ];
      for (const [method, url, body] of attempts) {
        const res = await ownerA.request(method, url, body);
        assert.equal(res.status, 403, `${method} ${url}`);
      }
    });

    it('gives an admin 403 on owner and boarder endpoints', async () => {
      const attempts: [string, string, unknown?][] = [
        ['GET', '/api/owner/properties'],
        ['POST', '/api/owner/properties', validProperty],
        ['GET', '/api/owner/payments'],
        ['GET', '/api/owner/settings'],
        ['GET', '/api/boarder/favorites'],
        ['POST', '/api/boarder/inquiries', { propertyId: 'some-property', message: 'An admin cannot ask this way.' }],
        ['GET', '/api/boarder/reviews'],
        ['GET', '/api/boarder/settings'],
      ];
      for (const [method, url, body] of attempts) {
        const res = await admin.request(method, url, body);
        assert.equal(res.status, 403, `${method} ${url}`);
      }
    });
  });

  describe('owner data isolation', () => {
    it('hides owner B data from owner A (404) and leaves it unchanged', async () => {
      // Owner B's records: a property with a room, an image, a payment and an inquiry.
      const bProperty = await createAs(ownerB, { name: 'Authorization Owner B Property', imageUrls: [], amenities: [] });
      await prisma.property.update({ where: { id: bProperty.id }, data: { status: 'APPROVED' } });
      const bRoom = (await ownerB.request('POST', `/api/owner/properties/${bProperty.id}/rooms`, {
        name: 'Authorization Room B1',
        monthlyPrice: 2500,
        capacity: 1,
        isAvailable: true,
      })).data!.room as Record<string, any>;
      const bImage = await prisma.propertyImage.create({
        data: { propertyId: bProperty.id, url: 'https://example.com/auth-b-image.jpg', isPrimary: true, sortOrder: 0 },
      });
      const bPayment = (await ownerB.request('POST', '/api/owner/payments', {
        propertyId: bProperty.id,
        roomId: bRoom.id,
        boarderName: 'Resident of Owner B',
        amount: 2500,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'CASH',
      })).data!.record as Record<string, any>;
      const bInquiry = (await boarderOne.request('POST', '/api/boarder/inquiries', {
        propertyId: bProperty.id,
        message: 'Is the Authorization Room B1 still open?',
      })).data!.inquiry as Record<string, any>;

      // Owner A's own lists never include owner B's data.
      const aProperties = await ownerA.request('GET', '/api/owner/properties');
      assert.equal(aProperties.status, 200);
      assert.equal(aProperties.data!.properties.some((p: { id: string }) => p.id === bProperty.id), false);
      const aPayments = await ownerA.request('GET', '/api/owner/payments');
      assert.equal(aPayments.status, 200);
      assert.equal(aPayments.data!.records.some((r: { id: string }) => r.id === bPayment.id), false);
      const aInquiries = await ownerA.request('GET', '/api/owner/inquiries');
      assert.equal(aInquiries.status, 200);
      assert.equal(aInquiries.data!.inquiries.some((i: { id: string }) => i.id === bInquiry.id), false);

      // Owner A cannot read or change owner B's property.
      assert.equal((await ownerA.request('GET', `/api/owner/properties/${bProperty.id}`)).status, 404);
      assert.equal((await ownerA.request('PUT', `/api/owner/properties/${bProperty.id}`, {
        ...validProperty,
        name: 'Hijacked Property',
      })).status, 404);
      assert.equal((await ownerA.request('DELETE', `/api/owner/properties/${bProperty.id}`)).status, 404);

      // ... nor list or modify owner B's rooms.
      assert.equal((await ownerA.request('GET', `/api/owner/properties/${bProperty.id}/rooms`)).status, 404);
      assert.equal((await ownerA.request('POST', `/api/owner/properties/${bProperty.id}/rooms`, {
        name: 'Planted Room',
        monthlyPrice: 1000,
        capacity: 1,
        isAvailable: true,
      })).status, 404);
      assert.equal((await ownerA.request('PUT', `/api/owner/rooms/${bRoom.id}`, {
        name: 'Authorization Room B1',
        monthlyPrice: 2000,
        capacity: 1,
        isAvailable: false,
      })).status, 404);
      assert.equal((await ownerA.request('DELETE', `/api/owner/rooms/${bRoom.id}`)).status, 404);

      // ... nor list or modify owner B's payments.
      assert.equal((await ownerA.request('GET', `/api/owner/payments/${bPayment.id}`)).status, 404);
      assert.equal((await ownerA.request('POST', '/api/owner/payments', {
        propertyId: bProperty.id,
        boarderName: 'Planted Resident',
        amount: 1000,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'CASH',
      })).status, 404);

      // ... nor modify owner B's inquiries.
      assert.equal((await ownerA.request('PATCH', `/api/owner/inquiries/${bInquiry.id}`, {
        response: 'This response was written by owner A.',
      })).status, 404);

      // ... nor modify owner B's property images.
      const imageForm = new FormData();
      imageForm.append(
        'images',
        new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' }),
        'planted.png',
      );
      assert.equal((await ownerA.request('POST', `/api/owner/properties/${bProperty.id}/images`, imageForm)).status, 404);
      assert.equal((await ownerA.request('DELETE', `/api/owner/properties/${bProperty.id}/images/${bImage.id}`)).status, 404);
      assert.equal((await ownerA.request('PATCH', `/api/owner/properties/${bProperty.id}/images/${bImage.id}/cover`)).status, 404);

      // Every attempt left owner B's data unchanged.
      const stored = await prisma.property.findUniqueOrThrow({
        where: { id: bProperty.id },
        include: { rooms: true, images: true, paymentRecords: true, inquiries: true },
      });
      assert.equal(stored.name, 'Authorization Owner B Property');
      assert.equal(stored.rooms.length, 1);
      assert.equal(stored.images.length, 1);
      assert.equal(stored.paymentRecords.length, 1);
      assert.equal(stored.inquiries[0].response, null);
    });
  });

  describe('boarder data isolation', () => {
    it('keeps favorites, inquiries and reviews private between boarders', async () => {
      // One approved listing per boarder, so the favorite lists cannot be confused.
      const listingX = await createAs(ownerA, { name: 'Authorization Favorite Property One', imageUrls: [], amenities: [] });
      const listingY = await createAs(ownerA, { name: 'Authorization Favorite Property Two', imageUrls: [], amenities: [] });
      await prisma.property.updateMany({
        where: { id: { in: [listingX.id, listingY.id] } },
        data: { status: 'APPROVED' },
      });

      const favoriteX = await boarderOne.request('POST', `/api/boarder/favorites/${listingX.id}`);
      const inquiryOne = (await boarderOne.request('POST', '/api/boarder/inquiries', {
        propertyId: listingX.id,
        message: 'Boarder One would like to view this room.',
      })).data!.inquiry as Record<string, any>;
      const reviewOne = (await boarderOne.request('POST', `/api/boarder/properties/${listingX.id}/reviews`, {
        rating: 5,
        content: 'Boarder One liked this property very much.',
      })).data!.review as Record<string, any>;
      const favoriteY = await boarderTwo.request('POST', `/api/boarder/favorites/${listingY.id}`);
      assert.equal(favoriteX.status, 201);
      assert.equal(favoriteY.status, 201);

      // Each boarder's favorite list only contains their own rows.
      const oneFavorites = await boarderOne.request('GET', '/api/boarder/favorites');
      assert.ok(oneFavorites.data!.favorites.some((f: { property: { id: string } }) => f.property.id === listingX.id));
      assert.equal(oneFavorites.data!.favorites.some((f: { property: { id: string } }) => f.property.id === listingY.id), false);
      const twoFavorites = await boarderTwo.request('GET', '/api/boarder/favorites');
      assert.ok(twoFavorites.data!.favorites.some((f: { property: { id: string } }) => f.property.id === listingY.id));
      assert.equal(twoFavorites.data!.favorites.some((f: { property: { id: string } }) => f.property.id === listingX.id), false);

      // Deleting a favorite only ever removes the caller's own row.
      assert.equal((await boarderTwo.request('DELETE', `/api/boarder/favorites/${listingX.id}`)).status, 200);
      assert.equal(await prisma.favorite.count({
        where: { propertyId: listingX.id, boarder: { email: boarderOneInfo.email } },
      }), 1);

      // Inquiries and reviews never leak into another boarder's lists.
      const twoInquiries = await boarderTwo.request('GET', '/api/boarder/inquiries');
      assert.equal(twoInquiries.data!.inquiries.some((i: { id: string }) => i.id === inquiryOne.id), false);
      assert.ok((await boarderOne.request('GET', '/api/boarder/inquiries')).data!.inquiries.some((i: { id: string }) => i.id === inquiryOne.id));

      const twoReviews = await boarderTwo.request('GET', '/api/boarder/reviews');
      assert.equal(twoReviews.data!.reviews.some((r: { id: string }) => r.id === reviewOne.id), false);
      assert.ok((await boarderOne.request('GET', '/api/boarder/reviews')).data!.reviews.some((r: { id: string }) => r.id === reviewOne.id));

      // Removing their own favorite works and still leaves the other boarder's row alone.
      assert.equal((await boarderTwo.request('DELETE', `/api/boarder/favorites/${listingY.id}`)).status, 200);
      assert.equal(await prisma.favorite.count({
        where: { propertyId: listingY.id, boarder: { email: boarderTwoInfo.email } },
      }), 0);
      assert.equal(await prisma.favorite.count({
        where: { propertyId: listingX.id, boarder: { email: boarderOneInfo.email } },
      }), 1);
    });
  });

  describe('public listing visibility', () => {
    it('never serves PENDING, REJECTED or INACTIVE listings on public endpoints', async () => {
      const pending = await createAs(ownerB, { name: 'Authorization Visibility Pending', imageUrls: [], amenities: [] });
      const rejected = await createAs(ownerB, { name: 'Authorization Visibility Rejected', imageUrls: [], amenities: [] });
      const inactive = await createAs(ownerB, { name: 'Authorization Visibility Inactive', imageUrls: [], amenities: [] });
      const approved = await createAs(ownerB, { name: 'Authorization Visibility Approved', imageUrls: [], amenities: [] });
      await prisma.property.update({
        where: { id: rejected.id },
        data: { status: 'REJECTED', rejectionReason: 'Photos do not match the address.' },
      });
      await prisma.property.update({ where: { id: inactive.id }, data: { status: 'INACTIVE' } });
      await prisma.property.update({ where: { id: approved.id }, data: { status: 'APPROVED' } });

      const anonymous = new TestClient(baseUrl);
      const list = await anonymous.request('GET', '/api/properties?q=Authorization%20Visibility');
      assert.equal(list.status, 200);
      assert.equal(list.data!.pagination.total, 1);
      assert.equal(list.data!.properties[0].id, approved.id);

      for (const hidden of [pending.id, rejected.id, inactive.id]) {
        assert.equal((await anonymous.request('GET', `/api/properties/${hidden}`)).status, 404, hidden);
      }
      assert.equal((await anonymous.request('GET', `/api/properties/${approved.id}`)).status, 200);
    });
  });

  describe('admin status endpoint', () => {
    it('lets only admins change a listing status', async () => {
      const target = await createAs(ownerB, { name: 'Authorization Status Target', imageUrls: [], amenities: [] });

      const anonymous = new TestClient(baseUrl);
      assert.equal(
        (await anonymous.request('PATCH', `/api/admin/properties/${target.id}/status`, { status: 'APPROVED' })).status,
        401,
      );
      assert.equal(
        (await boarderOne.request('PATCH', `/api/admin/properties/${target.id}/status`, { status: 'APPROVED' })).status,
        403,
      );
      assert.equal(
        (await ownerA.request('PATCH', `/api/admin/properties/${target.id}/status`, { status: 'APPROVED' })).status,
        403,
      );
      assert.equal(
        (await prisma.property.findUniqueOrThrow({ where: { id: target.id } })).status,
        'PENDING',
      );

      // Positive control: the endpoint does work for an admin, so the 401/403s
      // above come from the role gate and not from a broken route.
      const approved = await admin.request('PATCH', `/api/admin/properties/${target.id}/status`, { status: 'APPROVED' });
      assert.equal(approved.status, 200);
      assert.equal(approved.data!.property.status, 'APPROVED');
    });
  });
});
