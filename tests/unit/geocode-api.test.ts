import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/geocode/reverse/route';
import { NextRequest } from 'next/server';

describe('GET /api/geocode/reverse', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 400 when lat or lng is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/geocode/reverse?lat=18.5204');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/both latitude.*and longitude.*required/i);
  });

  it('returns 400 for out of bounds coordinates', async () => {
    const req = new NextRequest('http://localhost:3000/api/geocode/reverse?lat=95.0&lng=73.85');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/invalid coordinate range/i);
  });

  it('formats address components into a readable string on successful reverse geocode', async () => {
    const mockNominatimData = {
      display_name: 'Karve Road, Kothrud, Pune, Maharashtra, 411038, India',
      address: {
        road: 'Karve Road',
        suburb: 'Kothrud',
        city: 'Pune',
        state: 'Maharashtra',
        postcode: '411038',
        country: 'India',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockNominatimData,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/geocode/reverse?lat=18.5089&lng=73.8152');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.address).toBe('Karve Road, Kothrud, Pune, Maharashtra, 411038');
    expect(data.components.street).toBe('Karve Road');
    expect(data.components.city).toBe('Pune');
  });

  it('handles geocoding fetch failures gracefully without throwing unhandled exceptions', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connectivity failure'));

    const req = new NextRequest('http://localhost:3000/api/geocode/reverse?lat=18.5089&lng=73.8152');
    const res = await GET(req);
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.address).toBeNull();
    expect(data.error).toMatch(/failed to connect to reverse geocoding service/i);
  });
});
