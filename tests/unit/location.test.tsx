import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportIssuePage from '@/app/(citizen)/report/page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => ({
    get: (param: string) => (param === 'category' ? 'CAT_ROADS' : null),
  }),
}));

describe('Part B: Real Location Detection & Permission Flow', () => {
  let originalGeolocation: Geolocation;

  beforeEach(() => {
    originalGeolocation = navigator.geolocation;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: originalGeolocation,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('renders the "Use My Current Location" button by default', () => {
    render(<ReportIssuePage />);
    const locationBtn = screen.getByRole('button', { name: /use my current location/i });
    expect(locationBtn).toBeInTheDocument();
  });

  it('shows in-app permission explanation when clicking location button, without accessing geolocation prematurely', () => {
    const getCurrentPositionMock = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    render(<ReportIssuePage />);
    const locationBtn = screen.getByRole('button', { name: /use my current location/i });
    fireEvent.click(locationBtn);

    // In-app explanation is visible
    expect(screen.getByText(/allow govasset to access your current location/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();

    // Geolocation API has NOT been invoked yet
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
  });

  it('cancels gracefully when user chooses "Not now" without calling geolocation or setting sample coordinates', () => {
    const getCurrentPositionMock = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    render(<ReportIssuePage />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /not now/i }));

    // Permission prompt is dismissed
    expect(screen.queryByText(/allow govasset to access your current location/i)).not.toBeInTheDocument();
    // Explanation note that location was skipped
    expect(screen.getByText(/location access was skipped/i)).toBeInTheDocument();
    // Geolocation API was never called
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
    // No fake coordinates attached
    expect(screen.queryByText(/confirmed coordinates attached/i)).not.toBeInTheDocument();
  });

  it('invokes geolocation on "Continue" and attaches real coordinates and accuracy on success', async () => {
    const mockCoords = {
      latitude: 18.52043,
      longitude: 73.85674,
      accuracy: 14,
    };

    const getCurrentPositionMock = vi.fn((successCallback) => {
      successCallback({
        coords: mockCoords,
        timestamp: Date.now(),
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    render(<ReportIssuePage />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(getCurrentPositionMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/confirmed coordinates attached/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/18.52043° N, 73.85674° E/)).toBeInTheDocument();
    expect(screen.getByText(/±14m/)).toBeInTheDocument();
  });

  it('handles permission denied error without injecting sample coordinates', async () => {
    const getCurrentPositionMock = vi.fn((_, errorCallback) => {
      errorCallback({
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    render(<ReportIssuePage />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/location permission was denied/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/confirmed coordinates attached/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('handles timeout error gracefully', async () => {
    const getCurrentPositionMock = vi.fn((_, errorCallback) => {
      errorCallback({
        code: 3, // TIMEOUT
        message: 'Timeout expired',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    render(<ReportIssuePage />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/request to get your location timed out/i)).toBeInTheDocument();
    });
  });

  it('automatically populates the address input from detected coordinates via reverse geocoding', async () => {
    const mockCoords = {
      latitude: 18.5089,
      longitude: 73.8152,
      accuracy: 12,
    };

    const getCurrentPositionMock = vi.fn((successCallback) => {
      successCallback({
        coords: mockCoords,
        timestamp: Date.now(),
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    // Mock fetch for /api/geocode/reverse
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        address: 'Karve Road, Kothrud, Pune, Maharashtra 411038',
      }),
    } as any);

    render(<ReportIssuePage />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/confirmed coordinates attached/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      const addressInput = screen.getByLabelText(/street name \/ house no\. \/ landmark/i) as HTMLInputElement;
      expect(addressInput.value).toBe('Karve Road, Kothrud, Pune, Maharashtra 411038');
    });

    expect(screen.getByText(/address auto-populated from gps/i)).toBeInTheDocument();
  });

  it('preserves user manual edits to the address and does not silently overwrite them', async () => {
    const mockCoords = {
      latitude: 18.5089,
      longitude: 73.8152,
      accuracy: 15,
    };

    const getCurrentPositionMock = vi.fn((successCallback) => {
      successCallback({
        coords: mockCoords,
        timestamp: Date.now(),
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        address: 'Auto Resolved Street, Area 5, Pune',
      }),
    } as any);

    render(<ReportIssuePage />);

    // User types manual address first
    const addressInput = screen.getByLabelText(/street name \/ house no\. \/ landmark/i) as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: 'My Custom Shop Landmark #42' } });
    expect(addressInput.value).toBe('My Custom Shop Landmark #42');

    // Now user detects location
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/confirmed coordinates attached/i)).toBeInTheDocument();
    });

    // Manual address should NOT be silently overwritten
    expect(addressInput.value).toBe('My Custom Shop Landmark #42');

    // Prompt suggests detected address with options
    await waitFor(() => {
      expect(screen.getByText(/detected address from gps:/i)).toBeInTheDocument();
      expect(screen.getByText(/Auto Resolved Street, Area 5, Pune/i)).toBeInTheDocument();
    });

    // If user clicks "Use Detected Address", it updates
    fireEvent.click(screen.getByRole('button', { name: /use detected address/i }));
    expect(addressInput.value).toBe('Auto Resolved Street, Area 5, Pune');
  });

  it('keeps confirmed coordinates even if reverse geocoding fails, displaying a clear notice', async () => {
    const mockCoords = {
      latitude: 18.52043,
      longitude: 73.85674,
      accuracy: 20,
    };

    const getCurrentPositionMock = vi.fn((successCallback) => {
      successCallback({
        coords: mockCoords,
        timestamp: Date.now(),
      });
    });

    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: getCurrentPositionMock },
      configurable: true,
      writable: true,
    });

    // Geocode returns failure
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        address: null,
        error: 'No address found',
      }),
    } as any);

    render(<ReportIssuePage />);
    fireEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => {
      expect(screen.getByText(/confirmed coordinates attached/i)).toBeInTheDocument();
    });

    // Shows clear message that lookup failed, but coordinates are attached
    await waitFor(() => {
      expect(screen.getByText(/street address lookup could not resolve the exact location/i)).toBeInTheDocument();
    });

    // Coordinates are still intact
    expect(screen.getByText(/18.52043° N, 73.85674° E/)).toBeInTheDocument();

    // User can manually type address
    const addressInput = screen.getByLabelText(/street name \/ house no\. \/ landmark/i) as HTMLInputElement;
    fireEvent.change(addressInput, { target: { value: 'Near Old Water Tank' } });
    expect(addressInput.value).toBe('Near Old Water Tank');
  });
});
