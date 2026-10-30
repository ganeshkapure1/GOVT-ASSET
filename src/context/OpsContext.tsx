'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface OpsUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: string;
  designation?: string | null;
  staffCode?: string | null;
  department?: { id: string; name: string; code: string } | null;
  jurisdiction?: { id: string; name: string; code: string; level: string } | null;
}

export interface CorporationInfo {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
}

export interface WardInfo {
  id: string;
  name: string;
  code: string;
}

export interface OpsContextType {
  user: OpsUser | null;
  corporation: CorporationInfo | null;
  city: string | null;
  state: string | null;
  locationLabel: string;
  assignedWard: WardInfo | null;
  authorizedWards: WardInfo[];
  selectedWardId: string;
  selectedWardName: string;
  setSelectedWard: (id: string, name: string) => void;
  hasValidJurisdiction: boolean;
  setupMessage: string | null;
  isLoading: boolean;
  refreshContext: () => Promise<void>;
}

const OpsContext = createContext<OpsContextType | undefined>(undefined);

export function OpsContextProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OpsUser | null>(null);
  const [corporation, setCorporation] = useState<CorporationInfo | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('Loading location...');
  const [assignedWard, setAssignedWard] = useState<WardInfo | null>(null);
  const [authorizedWards, setAuthorizedWards] = useState<WardInfo[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string>('all');
  const [selectedWardName, setSelectedWardName] = useState<string>('All Authorized Areas');
  const [hasValidJurisdiction, setHasValidJurisdiction] = useState<boolean>(true);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchContext = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/ops/context');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const {
            user: userData,
            corporation: corpData,
            city: cityData,
            state: stateData,
            locationLabel: locLabel,
            assignedWard: wardData,
            authorizedWards: wardsData,
            hasValidJurisdiction: isValid,
            setupMessage: message,
          } = json.data;

          setUser(userData);
          setCorporation(corpData);
          setCity(cityData || corpData?.city || null);
          setState(stateData || corpData?.state || null);
          setLocationLabel(
            locLabel ||
            (corpData?.city && corpData?.state
              ? `${corpData.city}, ${corpData.state}`
              : corpData?.city || 'Location not configured')
          );
          setAssignedWard(wardData);
          setAuthorizedWards(wardsData || []);
          setHasValidJurisdiction(isValid !== false);
          setSetupMessage(message || null);

          // By default, select assigned ward if available, else 'all'
          if (wardData && wardData.id) {
            setSelectedWardId(wardData.id);
            setSelectedWardName(wardData.name);
          } else if (wardsData && wardsData.length > 0) {
            setSelectedWardId(wardsData[0].id);
            setSelectedWardName(wardsData[0].name);
          } else {
            setSelectedWardId('all');
            setSelectedWardName(corpData ? `All ${corpData.code} Jurisdictions` : 'All Jurisdictions');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load operational context:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const handleSetSelectedWard = (id: string, name: string) => {
    setSelectedWardId(id);
    setSelectedWardName(name);
  };

  return (
    <OpsContext.Provider
      value={{
        user,
        corporation,
        city,
        state,
        locationLabel,
        assignedWard,
        authorizedWards,
        selectedWardId,
        selectedWardName,
        setSelectedWard: handleSetSelectedWard,
        hasValidJurisdiction,
        setupMessage,
        isLoading,
        refreshContext: fetchContext,
      }}
    >
      {children}
    </OpsContext.Provider>
  );
}

export function useOpsContext(): OpsContextType {
  const context = useContext(OpsContext);
  if (!context) {
    throw new Error('useOpsContext must be used within an OpsContextProvider');
  }
  return context;
}
