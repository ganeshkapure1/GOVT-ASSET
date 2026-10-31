'use client';
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, Suspense, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import {
  MapPinIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  CameraIcon,
  AlertTriangleIcon,
  UserCheckIcon,
} from '@/components/ui/icons';
import {
  getAllStates,
  getDistrictsByState,
  getCitiesByDistrict,
  getLocalBodiesByCity,
  LocalBodyDefinition,
} from '@/lib/india-locations';

interface DetectedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  detectedAt: string;
}

interface AuthCitizen {
  userId: string;
  fullName: string;
  phoneNumber: string;
}

function ReportIssueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'CAT_ROADS';

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [category, setCategory] = useState(initialCategory);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [isHazard, setIsHazard] = useState(false);
  const [phone, setPhone] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdReference, setCreatedReference] = useState<string | null>(null);

  // Authenticated Citizen Identity States
  const [authCitizen, setAuthCitizen] = useState<AuthCitizen | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpVerifyLoading, setOtpVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [mockOtpNotice, setMockOtpNotice] = useState<string | null>(null);

  // Pan-India Cascading Location States
  const allStates = getAllStates();
  const [selectedState, setSelectedState] = useState<string>('Maharashtra');
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Chhatrapati Sambhajinagar');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('Chhatrapati Sambhajinagar');
  const [localBodies, setLocalBodies] = useState<LocalBodyDefinition[]>([]);
  const [selectedLocalBodyId, setSelectedLocalBodyId] = useState<string>('csmc-01');
  const [selectedLocalBodyCode, setSelectedLocalBodyCode] = useState<string>('CSMC-01');
  const [customLocality, setCustomLocality] = useState<string>('');

  // Real Geolocation States
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<DetectedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDeclined, setPermissionDeclined] = useState(false);

  // Reverse Geocoding States
  const [addressResolving, setAddressResolving] = useState(false);
  const [hasManuallyEditedAddress, setHasManuallyEditedAddress] = useState(false);
  const [pendingResolvedAddress, setPendingResolvedAddress] = useState<string | null>(null);
  const [geocodeNotice, setGeocodeNotice] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Photo Evidence Upload States
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreviewUrl, setEvidencePreviewUrl] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<{
    fileKey: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
  } | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  // 1. Initial Auth Check on Mount (Purely reads session, NEVER creates a complaint)
  useEffect(() => {
    let isMounted = true;
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (json) => {
        if (!isMounted) return;
        setIsCheckingAuth(false);
        if (json?.success && json?.user && json.user.role === 'CITIZEN') {
          setAuthCitizen({
            userId: json.user.userId,
            fullName: json.user.fullName,
            phoneNumber: json.user.phoneNumber,
          });
          setPhone(json.user.phoneNumber);
        } else {
          // If the visitor has an old staff session (e.g. Sachin / OFFICER), purge it on citizen routes
          if (json?.user && json.user.role !== 'CITIZEN') {
            try {
              if (typeof document !== 'undefined') {
                document.cookie = 'govasset_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
              }
              await fetch('/api/v1/auth/logout', { method: 'POST' });
            } catch {}
          }
          setAuthCitizen(null);
        }
      })
      .catch(() => {
        if (isMounted) setIsCheckingAuth(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Cascade Districts when State changes
  useEffect(() => {
    if (!selectedState) {
      setDistricts([]);
      setSelectedDistrict('');
      return;
    }
    const distList = getDistrictsByState(selectedState);
    setDistricts(distList);
    setSelectedDistrict((prev) => (distList.includes(prev) ? prev : distList[0] || ''));
  }, [selectedState]);

  // 3. Cascade Cities when District changes
  useEffect(() => {
    if (!selectedState || !selectedDistrict) {
      setCities([]);
      setSelectedCity('');
      return;
    }
    const cityList = getCitiesByDistrict(selectedState, selectedDistrict);
    setCities(cityList);
    setSelectedCity((prev) => (cityList.includes(prev) ? prev : cityList[0] || ''));
  }, [selectedState, selectedDistrict]);

  // 4. Cascade Local Bodies when City changes
  useEffect(() => {
    if (!selectedState || !selectedDistrict || !selectedCity) {
      setLocalBodies([]);
      setSelectedLocalBodyId('');
      setSelectedLocalBodyCode('');
      return;
    }
    const lbList = getLocalBodiesByCity(selectedState, selectedDistrict, selectedCity);
    setLocalBodies(lbList);
    setSelectedLocalBodyId((prevId) => {
      const existingMatch = lbList.find((b) => b.id === prevId);
      if (existingMatch) return prevId;
      if (lbList.length > 0) {
        setSelectedLocalBodyCode(lbList[0].shortCode);
        return lbList[0].id;
      }
      setSelectedLocalBodyCode('');
      return '';
    });
  }, [selectedState, selectedDistrict, selectedCity]);

  // 5. Update local body code when Local Body changes
  useEffect(() => {
    if (!selectedLocalBodyId) {
      setSelectedLocalBodyCode('');
      return;
    }

    const currentBody = localBodies.find((b) => b.id === selectedLocalBodyId);
    if (currentBody) {
      setSelectedLocalBodyCode(currentBody.shortCode);
    }
  }, [selectedLocalBodyId, localBodies]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoUploadError(null);

    // Validate type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      setPhotoUploadError('Invalid file type. Only JPEG, PNG, and WebP photographs are permitted.');
      return;
    }

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum limit of 5MB.`);
      return;
    }

    setEvidenceFile(file);
    const localUrl = URL.createObjectURL(file);
    setEvidencePreviewUrl(localUrl);

    // Upload to evidence endpoint
    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/v1/evidence/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setPhotoUploadError(json?.error?.message || 'Failed to upload photo. Please retry.');
      } else {
        setEvidenceData({
          fileKey: json.data.fileKey,
          mimeType: json.data.mimeType,
          sizeBytes: json.data.sizeBytes,
          url: json.data.url,
        });
      }
    } catch {
      setPhotoUploadError('Network error uploading photograph. Please check your connection and retry.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setEvidenceFile(null);
    if (evidencePreviewUrl) {
      URL.revokeObjectURL(evidencePreviewUrl);
    }
    setEvidencePreviewUrl(null);
    setEvidenceData(null);
    setPhotoUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const DEFAULT_CATEGORIES = [
    { id: 'CAT_ROADS', code: 'CAT_POTHOLE', label: 'Damaged Roads & Potholes', dept: 'PWD / Works' },
    { id: 'CAT_STREETLIGHT', code: 'CAT_STREETLIGHT', label: 'Streetlights & Electrical', dept: 'Electrical Dept' },
    { id: 'CAT_DRAINAGE_WATER', code: 'CAT_WATER_LEAK', label: 'Water Leakage & Sewage', dept: 'Water & Sanitation' },
    { id: 'CAT_SANITATION', code: 'CAT_GARBAGE', label: 'Public Sanitation & Dumps', dept: 'Solid Waste Mgmt' },
    { id: 'CAT_BUILDINGS_PARKS', code: 'CAT_PAVER_BLOCKS', label: 'Damaged Footpaths & Parks', dept: 'Civic Assets' },
    { id: 'CAT_DRAIN_COVERS', code: 'CAT_DRAIN_GRATES', label: 'Missing Drain Grates & Safety', dept: 'Stormwater Drainage' },
  ];

  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/v1/complaints/categories')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted && json?.success && Array.isArray(json?.data) && json.data.length > 0) {
          const mapped = json.data.map((cat: any) => ({
            id: cat.id,
            code: cat.code,
            label: cat.nameEn,
            dept: cat.department?.name || 'Municipal Works',
          }));
          setCategoriesList(mapped);

          const catParam = searchParams.get('category');
          if (catParam) {
            const legacyMap: Record<string, string> = {
              CAT_ROADS: 'CAT_POTHOLE',
              CAT_STREETLIGHT: 'CAT_STREETLIGHT',
              CAT_DRAINAGE_WATER: 'CAT_WATER_LEAK',
              CAT_SANITATION: 'CAT_GARBAGE',
              CAT_BUILDINGS_PARKS: 'CAT_PAVER_BLOCKS',
              CAT_DRAIN_COVERS: 'CAT_DRAIN_GRATES',
            };
            const target = legacyMap[catParam.toUpperCase()] || catParam.toUpperCase();
            const matched = mapped.find(
              (m: any) => m.id === catParam || m.code === target || m.code === catParam.toUpperCase()
            );
            if (matched) {
              setCategory(matched.id);
            }
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const categories = categoriesList;

  // User clicks "Use My Current Location" button -> Show In-App Permission Explanation
  const handleLocationButtonClick = () => {
    setLocationError(null);
    setGeocodeNotice(null);
    setPermissionDeclined(false);
    setShowPermissionPrompt(true);
  };

  const handlePermissionNotNow = () => {
    setShowPermissionPrompt(false);
    setPermissionDeclined(true);
    setLocationError(null);
  };

  const handlePermissionContinue = () => {
    setShowPermissionPrompt(false);
    setPermissionDeclined(false);
    setLocationError(null);
    setGeocodeNotice(null);

    if (typeof window === 'undefined' || !navigator || !navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Please select your municipal corporation manually.');
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const locationData: DetectedLocation = {
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6)),
          accuracy: Math.round(accuracy),
          detectedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setDetectedLocation(locationData);
        setGpsLoading(false);
        setLocationError(null);

        // Initiate reverse geocoding to resolve readable address and pan-India administrative unit
        setAddressResolving(true);
        fetch(`/api/geocode/reverse?lat=${locationData.latitude}&lng=${locationData.longitude}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            setAddressResolving(false);
            if (data && data.success && data.address) {
              if (!hasManuallyEditedAddress || !address.trim()) {
                setAddress(data.address);
                setGeocodeNotice({
                  type: 'success',
                  message: `Address auto-populated from GPS (${data.address})`,
                });
              } else {
                setPendingResolvedAddress(data.address);
              }

              // Synchronize State if found
              if (data.state) {
                const matchedState = allStates.find(
                  (s) => s.name.toLowerCase() === data.state.toLowerCase() || data.state.toLowerCase().includes(s.name.toLowerCase())
                );
                if (matchedState) {
                  setSelectedState(matchedState.name);
                }
              }

              // Synchronize City / District if found
              if (data.city) {
                const matchedCity = cities.find(
                  (c) => c.toLowerCase() === data.city.toLowerCase() || data.city.toLowerCase().includes(c.toLowerCase())
                );
                if (matchedCity) {
                  setSelectedCity(matchedCity);
                }
              }
            } else {
              setGeocodeNotice({
                type: 'warning',
                message:
                  'Coordinates confirmed, but street address lookup could not resolve the exact location. Please enter your street address or landmark manually.',
              });
            }
          })
          .catch(() => {
            setAddressResolving(false);
            setGeocodeNotice({
              type: 'warning',
              message:
                'Coordinates confirmed, but reverse-geocoding service was unreachable. Please enter your street address manually.',
            });
          });
      },
      (error) => {
        setGpsLoading(false);
        setDetectedLocation(null);
        setAddressResolving(false);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(
              'Location permission was denied. Please allow location access in your browser settings, or enter the street address manually below.'
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError(
              'Location information is currently unavailable from your device. Please enter the defect location manually below.'
            );
            break;
          case error.TIMEOUT:
            setLocationError(
              'The request to get your location timed out. Please check your signal and try again, or enter the address manually.'
            );
            break;
          default:
            setLocationError(
              'Unable to retrieve your location at this time. Please enter the street address or landmark manually.'
            );
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    setDetectedLocation(null);
    setLocationError(null);
    setPermissionDeclined(false);
    setPendingResolvedAddress(null);
    setGeocodeNotice(null);
    setAddressResolving(false);
  };

  // OTP Verification Handlers (Step 3)
  const handleRequestOtp = async () => {
    if (!phone || phone.trim().length < 10) {
      setOtpError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setOtpError(null);
    setOtpLoading(true);
    setMockOtpNotice(null);

    try {
      const cleanPhone = phone.trim().startsWith('+91')
        ? phone.trim()
        : `+91${phone.replace(/\D/g, '')}`;

      const res = await fetch('/api/v1/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setOtpSent(true);
        if (json.mockNotice) {
          setMockOtpNotice(json.mockNotice);
        }
      } else {
        setOtpError(json?.error?.message || 'Failed to send verification code. Please retry.');
      }
    } catch {
      setOtpError('Network error requesting verification code. Please check your connection.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setOtpError('Please enter the 6-digit verification code.');
      return;
    }

    setOtpError(null);
    setOtpVerifyLoading(true);

    try {
      const cleanPhone = phone.trim().startsWith('+91')
        ? phone.trim()
        : `+91${phone.replace(/\D/g, '')}`;

      const res = await fetch('/api/v1/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          otp: otpCode.trim(),
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data?.user) {
        setAuthCitizen({
          userId: json.data.user.id || json.data.user.userId,
          fullName: json.data.user.fullName || 'Verified Resident',
          phoneNumber: cleanPhone,
        });
        setOtpSent(false);
        setOtpCode('');
        setMockOtpNotice(null);
      } else {
        setOtpError(json?.error?.message || 'Invalid verification code. Please check and retry.');
      }
    } catch {
      setOtpError('Network error verifying code. Please check your connection.');
    } finally {
      setOtpVerifyLoading(false);
    }
  };

  // Complaint Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    // Require authentication
    if (!authCitizen) {
      setSubmitError('Authentication required. Please verify your mobile number with OTP before submitting.');
      setIsSubmitting(false);
      return;
    }

    try {
      const landmarkText = [address, customLocality, selectedCity].filter(Boolean).join(', ');

      const res = await fetch('/api/v1/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          description,
          landmarkAddress: landmarkText || 'Reported civic defect',
          state: selectedState,
          district: selectedDistrict,
          city: selectedCity,
          localBodyCode: selectedLocalBodyCode,
          latitude: detectedLocation?.latitude,
          longitude: detectedLocation?.longitude,
          isHazard,
          evidenceFileKey: evidenceData?.fileKey,
          evidenceMimeType: evidenceData?.mimeType,
          evidenceFileSizeBytes: evidenceData?.sizeBytes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json?.error?.message || 'Failed to submit grievance. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const ref = json.data?.referenceNumber || 'GOV-2026-00482';
      setCreatedReference(ref);
      setIsSubmitting(false);
      setModalOpen(true);
    } catch {
      setSubmitError('Unable to connect to civic service. Please check your network connection.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6 px-4">
      {/* Informative Header Banner */}
      <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3 shadow-xs backdrop-blur-sm transition-colors">
        <ShieldCheckIcon className="w-5 h-5 text-brand-blue dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-sm block text-slate-900 dark:text-white">
            GovAsset • Citizen Grievance Redressal (Pan-India)
          </span>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400">
            Submit verified defect reports to municipal corporations across all 36 Indian States and Union Territories with verified identity and SLA turnaround.
          </p>
        </div>
      </div>

      {/* Stepper Indicator */}
      <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 shadow-xs backdrop-blur-sm transition-colors">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-brand-blue dark:text-blue-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${step >= 1 ? 'bg-brand-blue dark:bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>1</span>
            <span className="hidden sm:inline">Location &amp; Category</span>
            <span className="sm:hidden">Location</span>
          </div>
          <div className="h-0.5 w-6 sm:w-10 bg-slate-200 dark:border-slate-800" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-brand-blue dark:text-blue-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${step >= 2 ? 'bg-brand-blue dark:bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>2</span>
            <span className="hidden sm:inline">Evidence &amp; Details</span>
            <span className="sm:hidden">Details</span>
          </div>
          <div className="h-0.5 w-6 sm:w-10 bg-slate-200 dark:border-slate-800" />
          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-brand-blue dark:text-blue-400 font-extrabold' : 'text-slate-400 dark:text-slate-500'}`}>
            <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${step >= 3 ? 'bg-brand-blue dark:bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>3</span>
            <span className="hidden sm:inline">Verify &amp; Submit</span>
            <span className="sm:hidden">Verify</span>
          </div>
        </div>
      </div>

      {/* Citizen Verification Gate Banner */}
      {!isCheckingAuth && !authCitizen && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-100 text-xs sm:text-sm">
                Citizen Sign-In Required Before Registering Grievance
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                You must be authenticated with a verified mobile number to submit official complaints. Anonymous or staff submissions are not permitted.
              </p>
            </div>
          </div>
          <Link
            href="/login?redirect=/report"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B4FC2] hover:bg-blue-800 text-white text-xs font-bold shrink-0 shadow-2xs"
          >
            Sign In with Mobile OTP &rarr;
          </Link>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSubmit} className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs backdrop-blur-sm space-y-6 transition-colors">
        {/* Step 1: Pan-India Location & Category */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Step 1: Defect Category &amp; Administrative Jurisdiction
            </h2>

            {/* Category Radio Grid */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2.5">
                Select Asset Category <span className="text-danger-700 dark:text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3.5 text-left rounded-xl border text-xs transition-all flex items-center justify-between ${
                      category === cat.id || ((cat as any).code && category === (cat as any).code)
                        ? 'border-brand-blue dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 font-bold text-brand-dark dark:text-blue-200 ring-2 ring-brand-blue/20 dark:ring-blue-500/20 shadow-2xs'
                        : 'border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{cat.label}</p>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{cat.dept}</span>
                    </div>
                    {(category === cat.id || ((cat as any).code && category === (cat as any).code)) && (
                      <CheckCircleIcon className="w-5 h-5 text-brand-blue dark:text-blue-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Device Geolocation Section with In-App Consent */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <MapPinIcon className="w-4 h-4 text-brand-blue dark:text-blue-400" />
                    Device GPS Location (Optional)
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Attach exact geographical coordinates to route to the correct municipal field crew.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {detectedLocation && (
                    <button
                      type="button"
                      onClick={handleClearLocation}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white underline px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                  <Button
                    type="button"
                    variant={detectedLocation ? 'secondary' : 'outline'}
                    size="sm"
                    isLoading={gpsLoading}
                    onClick={handleLocationButtonClick}
                    className="font-semibold text-xs whitespace-nowrap"
                  >
                    {gpsLoading
                      ? 'Locating your position...'
                      : detectedLocation
                      ? 'Re-detect Location'
                      : 'Use My Current Location'}
                  </Button>
                </div>
              </div>

              {/* In-App Permission Prompt */}
              {showPermissionPrompt && (
                <div
                  role="dialog"
                  aria-labelledby="location-permission-title"
                  className="mt-3 p-3.5 bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <ShieldCheckIcon className="w-4 h-4 text-brand-blue dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p id="location-permission-title" className="font-bold text-slate-900 dark:text-white text-xs">
                        Location Access Request
                      </p>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                        Allow GovAsset to access your current location to mark where the civic issue occurred. Your location will be attached to this complaint so municipal repair teams can locate it accurately.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-900/60">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePermissionNotNow}
                      className="text-xs py-1 px-3 bg-white hover:bg-slate-50"
                    >
                      Not now
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handlePermissionContinue}
                      className="text-xs py-1 px-3"
                    >
                      Continue
                    </Button>
                  </div>
                </div>
              )}

              {/* User declined notice */}
              {permissionDeclined && !detectedLocation && !showPermissionPrompt && (
                <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>Location access was skipped. Please manually enter the street address or landmark below.</span>
                  <button
                    type="button"
                    onClick={() => setShowPermissionPrompt(true)}
                    className="text-brand-blue dark:text-blue-400 font-bold underline ml-2 shrink-0"
                  >
                    Enable
                  </button>
                </div>
              )}

              {/* Location Error State with Honest Feedback & Retry */}
              {locationError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="leading-snug">{locationError}</p>
                  </div>
                  <div className="pt-1 flex items-center gap-3 text-[11px]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLocationButtonClick}
                      className="font-bold underline text-rose-900 dark:text-rose-200 hover:text-rose-950"
                    >
                      Try Again
                    </Button>
                    <span>•</span>
                    <span className="text-rose-700 dark:text-rose-400">Manual address entry remains available</span>
                  </div>
                </div>
              )}

              {/* Detected Coordinates Display */}
              {detectedLocation && (
                <div className="p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      Confirmed Coordinates Attached
                    </span>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                      Detected: {detectedLocation.detectedAt}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-emerald-950 dark:text-emerald-100 pl-5">
                    {detectedLocation.latitude}&deg; N, {detectedLocation.longitude}&deg; E (&plusmn;{detectedLocation.accuracy}m)
                  </div>
                </div>
              )}

              {addressResolving && (
                <div className="p-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-[#0B4FC2] dark:text-blue-300 flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-[#0B4FC2] border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Resolving administrative address from coordinates...</span>
                </div>
              )}

              {geocodeNotice && !addressResolving && (
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{geocodeNotice.message}</span>
                  <button
                    type="button"
                    onClick={() => setGeocodeNotice(null)}
                    className="text-[11px] underline font-semibold ml-2"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Pending Resolved Address Suggestion (When user already had custom input) */}
              {pendingResolvedAddress && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <MapPinIcon className="w-4 h-4 text-[#0B4FC2] dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">Detected Address from GPS:</p>
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{pendingResolvedAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setAddress(pendingResolvedAddress);
                        setPendingResolvedAddress(null);
                        setHasManuallyEditedAddress(false);
                        setGeocodeNotice({
                          type: 'success',
                          message: `Address auto-populated from GPS (${pendingResolvedAddress})`,
                        });
                      }}
                      className="text-xs py-1 px-2.5"
                    >
                      Use Detected Address
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingResolvedAddress(null)}
                      className="text-xs py-1 px-2.5 bg-white"
                    >
                      Keep My Manual Address
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Cascading Pan-India Location Selector */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-4">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Jurisdiction Hierarchy (Pan-India)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. State / UT */}
                <div>
                  <label htmlFor="state-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    State / Union Territory <span className="text-danger-700">*</span>
                  </label>
                  <select
                    id="state-select"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none"
                  >
                    {allStates.map((st) => (
                      <option key={st.code} value={st.name}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. District */}
                <div>
                  <label htmlFor="district-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    District <span className="text-danger-700">*</span>
                  </label>
                  <select
                    id="district-select"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none"
                  >
                    {districts.map((dst) => (
                      <option key={dst} value={dst}>
                        {dst}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. City / Town */}
                <div>
                  <label htmlFor="city-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    City / Town <span className="text-danger-700">*</span>
                  </label>
                  <select
                    id="city-select"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none"
                  >
                    {cities.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Local Government Body */}
                <div>
                  <label htmlFor="localbody-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Local Government Body <span className="text-danger-700">*</span>
                  </label>
                  <select
                    id="localbody-select"
                    value={selectedLocalBodyId}
                    onChange={(e) => setSelectedLocalBodyId(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none"
                  >
                    {localBodies.map((lb) => (
                      <option key={lb.id} value={lb.id}>
                        {lb.name} ({lb.shortCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Locality / Neighborhood / Sector */}
              <div>
                <label htmlFor="custom-locality-input" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Locality / Neighborhood / Area
                </label>
                <Input
                  id="custom-locality-input"
                  value={customLocality}
                  onChange={(e) => setCustomLocality(e.target.value)}
                  placeholder="e.g. Sector 18, Commercial Block B, Near Market"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Street Address Input with Strict Anti-Autofill */}
            <Input
              label="Street Name / House No. / Landmark"
              required
              value={address}
              autoComplete="off"
              onChange={(e) => {
                setAddress(e.target.value);
                setHasManuallyEditedAddress(true);
                setPendingResolvedAddress(null);
              }}
              placeholder="e.g. Opp. Town Hall Gate, Lane 2"
              helperText="Auto-populated from GPS if permitted. Review, refine, or enter custom landmarks before continuing."
            />

            <div className="flex justify-end pt-3">
              <Button type="button" variant="primary" size="md" onClick={() => setStep(2)}>
                Continue to Step 2 →
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Evidence & Description */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Step 2: Photographic Proof &amp; Description
            </h2>

            {/* Real Photographic Evidence Uploader */}
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/jpg"
                onChange={handlePhotoSelect}
                className="hidden"
                id="citizen-photo-upload"
              />

              {!evidencePreviewUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-blue dark:hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50/70 dark:bg-slate-800/40 space-y-2 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-brand-blue dark:text-blue-400 shadow-2xs">
                    <CameraIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Attach Defect Photograph (Recommended)
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      JPEG, PNG or WebP up to 5MB. Click to browse files or snap from mobile camera.
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Select Photo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0">
                        <img
                          src={evidencePreviewUrl}
                          alt="Defect preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px] sm:max-w-[300px]">
                          {evidenceFile?.name || 'defect_evidence.jpg'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {evidenceFile ? `${(evidenceFile.size / 1024).toFixed(0)} KB` : 'Image ready'} • {evidenceData ? 'Uploaded & Verified' : isUploadingPhoto ? 'Uploading...' : 'Ready'}
                        </p>
                        {isUploadingPhoto && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#0B4FC2] font-semibold pt-0.5">
                            <span className="w-3 h-3 border-2 border-[#0B4FC2] border-t-transparent rounded-full animate-spin" />
                            <span>Uploading photograph to municipal evidence vault...</span>
                          </div>
                        )}
                        {evidenceData && !isUploadingPhoto && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Evidence linked to complaint
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                        className="text-xs py-1 px-2.5"
                      >
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleRemovePhoto}
                        disabled={isUploadingPhoto}
                        className="text-xs py-1 px-2.5 text-rose-600 dark:text-rose-400"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {photoUploadError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span>{photoUploadError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Description Textarea with Anti-Autofill */}
            <Textarea
              label="Detailed Problem Description"
              required
              showCount
              maxLength={500}
              rows={4}
              value={description}
              autoComplete="off"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the defect, dimensions, impact on traffic, or hazard..."
            />

            {/* Public Safety Hazard Checkbox */}
            <label className="flex items-start gap-3 p-3.5 bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={isHazard}
                onChange={(e) => setIsHazard(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-danger-700 rounded border-slate-300 focus:ring-danger-700"
              />
              <span className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                <strong className="block text-rose-950 dark:text-rose-200 font-bold">Immediate Public Safety Hazard</strong>
                Check this if the issue poses imminent risk to human life (e.g. exposed live electric cable, deep open trench on unlit road).
              </span>
            </label>

            <div className="flex justify-between pt-3">
              <Button type="button" variant="outline" size="md" onClick={() => setStep(1)}>
                ← Back to Step 1
              </Button>
              <Button type="button" variant="primary" size="md" onClick={() => setStep(3)}>
                Continue to Step 3 →
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Citizen Verification & Submit */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
              Step 3: Verification &amp; Review
            </h2>

            {/* Summary Review Card */}
            <div className="bg-slate-50/90 dark:bg-slate-800/60 p-4.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Jurisdiction:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedCity}, {selectedState} ({selectedLocalBodyCode})
                </span>
              </div>
              {customLocality && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Locality / Area:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {customLocality}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Selected Category:</span>
                <span className="font-bold text-slate-900 dark:text-white">{category}</span>
              </div>

              {/* Confirmed Coordinates Row */}
              <div className="flex justify-between items-start">
                <span className="text-slate-500 dark:text-slate-400">Coordinates:</span>
                <span className="font-mono text-right text-slate-900 dark:text-white">
                  {detectedLocation ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                      {detectedLocation.latitude}&deg; N, {detectedLocation.longitude}&deg; E (&plusmn;{detectedLocation.accuracy}m)
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Not geo-tagged (Manual address entry)</span>
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Address / Landmark:</span>
                <span className="font-medium text-slate-900 dark:text-white truncate max-w-[280px]">
                  {address || '(No street address specified)'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Safety Hazard Flag:</span>
                <span className={`font-bold ${isHazard ? 'text-danger-700 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {isHazard ? 'YES (High Priority)' : 'Standard Priority'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Attached Evidence:</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {evidenceData ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      1 Photograph Verified ({evidenceFile ? `${(evidenceFile.size / 1024).toFixed(0)} KB` : 'Attached'})
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">None attached</span>
                  )}
                </span>
              </div>
            </div>

            {/* Verification Check & In-Line OTP Flow */}
            {authCitizen ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <UserCheckIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-bold text-emerald-950 dark:text-emerald-100">
                    Verified Citizen Identity Confirmed
                  </span>
                </div>
                <p className="text-emerald-800 dark:text-emerald-300">
                  Registered under authenticated account: <strong>{authCitizen.fullName}</strong> ({authCitizen.phoneNumber})
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-0.5">
                  Grievance updates will be dispatched via SMS and tracked in My Grievances under your account.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldCheckIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-950 dark:text-amber-100 text-sm">
                      Citizen Verification Required Before Registration
                    </h4>
                    <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                      To prevent unauthorized and ghost complaints, enter your mobile number and verify via OTP. Your entered grievance details are preserved.
                    </p>
                  </div>
                </div>

                {otpError && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-300">
                    {otpError}
                  </div>
                )}

                {!otpSent ? (
                  <div className="space-y-2.5 pt-1">
                    <Input
                      label="Mobile Number (for SMS Verification &amp; Tracking)"
                      required
                      type="tel"
                      placeholder="9876543210"
                      leftAddon="+91"
                      value={phone}
                      autoComplete="off"
                      onChange={(e) => setPhone(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      isLoading={otpLoading}
                      onClick={handleRequestOtp}
                    >
                      Send Verification OTP →
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <Input
                      label={`Enter 6-Digit OTP sent to ${phone}`}
                      required
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 123456"
                      value={otpCode}
                      autoComplete="one-time-code"
                      onChange={(e) => setOtpCode(e.target.value)}
                    />
                    {mockOtpNotice && (
                      <p className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 rounded-lg text-[11px] font-mono border border-blue-200 dark:border-blue-800">
                        {mockOtpNotice}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={otpVerifyLoading}
                        onClick={handleVerifyOtp}
                      >
                        Verify Code &amp; Continue
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode('');
                          setMockOtpNotice(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 underline px-2 py-1"
                      >
                        Change Number
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submission Error Banner */}
            {submitError && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 shadow-2xs"
              >
                <AlertTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Submission Error</span>
                  <p className="text-[11px] leading-relaxed mt-0.5">{submitError}</p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-3">
              <Button type="button" variant="outline" size="md" onClick={() => setStep(2)}>
                ← Back to Step 2
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!authCitizen || isSubmitting}
                isLoading={isSubmitting}
              >
                Submit Civic Complaint
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Confirmation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Grievance Submission Successful!"
        description="Your complaint has been queued for municipal dispatch."
      >
        <div className="space-y-3.5 text-xs text-slate-800 dark:text-slate-200">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-1">
            <p className="font-bold">Grievance Successfully Registered</p>
            <p>
              Reference ticket <span className="font-mono font-bold">{createdReference || 'GOV-2026-00482'}</span> has been provisioned and dispatched to the {selectedCity} municipal engineering team.
            </p>
            {detectedLocation ? (
              <div className="pt-1 text-[11px] text-emerald-900 dark:text-emerald-300 space-y-0.5">
                <p className="font-mono">
                  Attached GPS: {detectedLocation.latitude}&deg; N, {detectedLocation.longitude}&deg; E (&plusmn;{detectedLocation.accuracy}m)
                </p>
                {address && (
                  <p className="font-sans font-medium">
                    Address: {address}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[11px] pt-1 text-emerald-900 dark:text-emerald-300">
                Location: {address || 'Manual street reference recorded.'}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setModalOpen(false);
                router.push(`/track?ref=${encodeURIComponent(createdReference || 'GOV-2026-00482')}`);
              }}
            >
              Preview Tracking Timeline
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setModalOpen(false);
                setStep(1);
                setDetectedLocation(null);
                setAddress('');
                setDescription('');
                setCreatedReference(null);
              }}
            >
              Start New Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function ReportIssuePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-mono">Loading report wizard...</div>}>
      <ReportIssueContent />
    </Suspense>
  );
}
