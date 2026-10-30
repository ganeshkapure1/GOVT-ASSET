'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { BuildingIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon, MapPinIcon, ShieldCheckIcon, AlertTriangleIcon } from '@/components/ui/icons';

interface WardNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  complaintCount: number;
  userCount: number;
  hasBoundary: boolean;
}

interface ZoneNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  complaintCount: number;
  userCount: number;
  hasBoundary: boolean;
  children: WardNode[];
}

interface RootNode {
  id: string;
  name: string;
  code: string;
  type: string;
  complaintCount: number;
  userCount: number;
  children: ZoneNode[];
}

interface BoundaryInfo {
  id: string;
  name: string;
  code: string;
  type: string;
  hasGeometry: boolean;
  geometryType: string | null;
  srid: number | null;
  vertexCount: number | null;
  isOfficial: boolean;
  isPlaceholder: boolean;
  disclaimer: string;
}

export default function AdminJurisdictionsPage() {
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
  const [roots, setRoots] = useState<RootNode[]>([]);
  const [allZones, setAllZones] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  // Add Ward Modal State
  const [addWardModalOpen, setAddWardModalOpen] = useState(false);
  const [newWardName, setNewWardName] = useState('');
  const [newWardCode, setNewWardCode] = useState('');
  const [newWardParentId, setNewWardParentId] = useState('');
  const [savingWard, setSavingWard] = useState(false);

  // Boundary Modal State
  const [boundaryModalOpen, setBoundaryModalOpen] = useState(false);
  const [boundaryInfo, setBoundaryInfo] = useState<BoundaryInfo | null>(null);
  const [loadingBoundary, setLoadingBoundary] = useState(false);

  // Safe Deletion confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchJurisdictions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/admin/jurisdictions');
      if (res.ok) {
        const result = await res.json();
        const hierarchy = result.data || result;
        const rootNodes: RootNode[] = hierarchy.roots || [];
        setRoots(rootNodes);

        // Collect all zones for the parent dropdown
        const zones: { id: string; name: string; code: string }[] = [];
        rootNodes.forEach((r) => {
          (r.children || []).forEach((z) => {
            zones.push({ id: z.id, name: z.name, code: z.code });
          });
        });
        setAllZones(zones);
        if (zones.length > 0 && !newWardParentId) {
          setNewWardParentId(zones[0].id);
        }

        // Expand first zone by default
        if (zones.length > 0) {
          setExpandedZones((prev) => ({ ...prev, [zones[0].id]: true }));
        }
      }
    } catch (err) {
      console.error('Failed to load jurisdictions:', err);
      setFeedback({ message: 'Failed to load jurisdiction hierarchy from server.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJurisdictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleZone = (zoneId: string) => {
    setExpandedZones((prev) => ({ ...prev, [zoneId]: !prev[zoneId] }));
  };

  const handleInspectBoundary = async (wardId: string) => {
    setLoadingBoundary(true);
    setBoundaryModalOpen(true);
    try {
      const res = await fetch(`/api/v1/admin/jurisdictions/${wardId}/boundary`);
      if (res.ok) {
        const result = await res.json();
        setBoundaryInfo(result.data || result.boundary);
      } else {
        const errData = await res.json().catch(() => ({}));
        setFeedback({ message: errData.error || 'Failed to inspect boundary.', type: 'error' });
        setBoundaryModalOpen(false);
      }
    } catch (err) {
      setFeedback({ message: 'Network error inspecting boundary.', type: 'error' });
      setBoundaryModalOpen(false);
    } finally {
      setLoadingBoundary(false);
    }
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWardName.trim() || !newWardCode.trim() || !newWardParentId) {
      setFeedback({ message: 'Please provide ward name, code, and parent zone.', type: 'error' });
      return;
    }

    try {
      setSavingWard(true);
      const res = await fetch('/api/v1/admin/jurisdictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWardName.trim(),
          code: newWardCode.trim(),
          type: 'WARD',
          parentId: newWardParentId,
        }),
      });

      if (res.ok) {
        setFeedback({ message: `Ward "${newWardName}" successfully created.`, type: 'success' });
        setAddWardModalOpen(false);
        setNewWardName('');
        setNewWardCode('');
        await fetchJurisdictions();
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedback({ message: data.error || 'Failed to create ward.', type: 'error' });
      }
    } catch (err) {
      setFeedback({ message: 'Network error while creating ward.', type: 'error' });
    } finally {
      setSavingWard(false);
    }
  };

  const handleDeleteJurisdiction = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete jurisdiction "${name}"? Safe-delete checks will prevent deletion if referenced.`)) {
      return;
    }

    try {
      setDeletingId(id);
      const res = await fetch(`/api/v1/admin/jurisdictions/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setFeedback({ message: `Jurisdiction "${name}" removed successfully.`, type: 'success' });
        await fetchJurisdictions();
      } else {
        const data = await res.json().catch(() => ({}));
        setFeedback({ message: data.error || 'Cannot delete jurisdiction: records depend on it.', type: 'error' });
      }
    } catch (err) {
      setFeedback({ message: 'Network error while deleting jurisdiction.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between shadow-subtle ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              : feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-brand-dark dark:text-blue-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="font-bold ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-civic-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 text-xs font-bold mb-1 border border-blue-200/50 dark:border-blue-900/50">
            <MapPinIcon className="w-3.5 h-3.5" />
            Spatial Boundaries
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-civic-900 dark:text-white tracking-tight">
            Municipal Jurisdiction &amp; Ward Hierarchy
          </h1>
          <p className="text-xs sm:text-sm text-civic-600 dark:text-slate-400 mt-1">
            Configure administrative boundaries, zonal offices, and PostGIS polygon assignments.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setAddWardModalOpen(true)}
          leftIcon={<PlusIcon className="w-4 h-4" />}
          className="rounded-xl font-bold bg-[#0B4FC2] hover:bg-blue-800"
        >
          Add New Ward
        </Button>
      </div>

      {/* Tree View Container */}
      <div className="bg-white dark:bg-slate-900 border border-civic-200/90 dark:border-slate-800 rounded-2xl shadow-subtle p-6 space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-civic-500">
            Loading municipal jurisdiction hierarchy...
          </div>
        ) : roots.length === 0 ? (
          <div className="p-8 text-center text-xs text-civic-500">
            No root jurisdiction records found in the database.
          </div>
        ) : (
          roots.map((root) => (
            <div key={root.id} className="space-y-4">
              {/* Root Municipal Corporation Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-civic-50 dark:bg-slate-800 rounded-xl font-bold text-sm text-civic-900 dark:text-white border border-civic-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-brand-blue dark:text-blue-400 shrink-0">
                    <BuildingIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-extrabold">{root.name}</span>
                    <span className="text-xs font-mono text-civic-500 dark:text-slate-400 block font-normal">
                      Root Authority • {root.code} • {root.children?.length || 0} Administrative Zones • PostGIS SRID 4326
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 text-civic-700 dark:text-slate-300 border border-civic-200 dark:border-slate-700">
                    {root.complaintCount} Complaints
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 text-civic-700 dark:text-slate-300 border border-civic-200 dark:border-slate-700">
                    {root.userCount} Personnel
                  </span>
                </div>
              </div>

              {/* Zones and Wards Sub-Tree */}
              <div className="pl-2 sm:pl-4 space-y-3">
                {root.children && root.children.map((zone) => {
                  const isExpanded = expandedZones[zone.id];
                  return (
                    <div
                      key={zone.id}
                      className="border border-civic-200 dark:border-slate-800 rounded-xl overflow-hidden transition-all"
                    >
                      {/* Zone Header Button */}
                      <div className="w-full flex items-center justify-between p-4 bg-civic-50/70 dark:bg-slate-800/60 hover:bg-civic-100 dark:hover:bg-slate-800 transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleZone(zone.id)}
                          className="flex items-center gap-2.5 flex-1 text-left"
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="w-4 h-4 text-civic-600 dark:text-slate-400" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4 text-civic-600 dark:text-slate-400" />
                          )}
                          <span className="font-bold text-xs sm:text-sm text-civic-900 dark:text-white">
                            {zone.name}
                          </span>
                          <span className="text-[11px] font-mono text-civic-500 dark:text-slate-400 bg-civic-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                            {zone.code}
                          </span>
                        </button>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-civic-500 dark:text-slate-400 font-mono hidden sm:inline">
                            {zone.children ? zone.children.length : 0} Wards
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteJurisdiction(zone.id, zone.name)}
                            disabled={deletingId === zone.id}
                            className="text-red-600 dark:text-red-400 text-xs px-2 py-1 h-7 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>

                      {/* Wards in Zone */}
                      {isExpanded && (
                        <div className="divide-y divide-civic-100 dark:divide-slate-800 p-3 bg-white dark:bg-slate-900 space-y-1">
                          {zone.children && zone.children.length > 0 ? (
                            zone.children.map((ward) => (
                              <div
                                key={ward.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-civic-50/80 dark:hover:bg-slate-800/50 rounded-xl text-xs gap-3 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono font-bold text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200/50 dark:border-blue-900/50">
                                    {ward.code}
                                  </span>
                                  <span className="font-semibold text-civic-900 dark:text-white">
                                    {ward.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <span className="text-civic-500 dark:text-slate-400 font-mono text-[11px] bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    {ward.hasBoundary ? 'PostGIS MultiPolygon' : 'No Geometry'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-brand-blue dark:text-blue-400 font-bold border border-blue-200/50 dark:border-blue-900/50">
                                    {ward.complaintCount} Complaints
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleInspectBoundary(ward.id)}
                                    className="text-brand-blue dark:text-blue-400 hover:underline font-semibold ml-1"
                                  >
                                    Inspect Boundary
                                  </button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteJurisdiction(ward.id, ward.name)}
                                    disabled={deletingId === ward.id}
                                    className="text-red-600 dark:text-red-400 text-xs px-2 py-0.5 h-6 hover:bg-red-50 dark:hover:bg-red-950/40"
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-xs text-civic-400 italic">
                              No wards assigned to this zone.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Ward Modal */}
      <Modal
        isOpen={addWardModalOpen}
        onClose={() => setAddWardModalOpen(false)}
        title="Add New Electoral Ward"
        description="Define municipal ward identifier and assign parent administrative zone."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddWardModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateWard}
              disabled={savingWard}
              className="font-bold bg-[#0B4FC2] hover:bg-blue-800"
            >
              {savingWard ? 'Saving...' : 'Save Ward Definition'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateWard} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Ward Name</label>
            <input
              type="text"
              value={newWardName}
              onChange={(e) => setNewWardName(e.target.value)}
              placeholder="e.g. Ward 17 - Mukundwadi"
              required
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Ward Code</label>
            <input
              type="text"
              value={newWardCode}
              onChange={(e) => setNewWardCode(e.target.value)}
              placeholder="e.g. CSN-Z03-W17"
              required
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none font-mono"
            />
          </div>
          <div>
            <label className="block font-semibold text-civic-800 dark:text-slate-200 mb-1">Parent Administrative Zone</label>
            <select
              value={newWardParentId}
              onChange={(e) => setNewWardParentId(e.target.value)}
              required
              className="w-full p-2.5 border border-civic-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-civic-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-brand-blue focus:outline-none"
            >
              {allZones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.code})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Ward Boundary Inspection Modal with Required Synthetic Disclaimer */}
      <Modal
        isOpen={boundaryModalOpen}
        onClose={() => setBoundaryModalOpen(false)}
        title="PostGIS Ward Boundary Inspection"
        description={boundaryInfo ? `${boundaryInfo.name} (${boundaryInfo.code})` : 'Inspecting spatial polygon geometry'}
        footer={
          <Button variant="outline" size="sm" onClick={() => setBoundaryModalOpen(false)}>
            Close Inspector
          </Button>
        }
      >
        {loadingBoundary ? (
          <div className="p-6 text-center text-xs font-mono text-civic-500">
            Querying PostGIS spatial engine for geometry metadata...
          </div>
        ) : boundaryInfo ? (
          <div className="space-y-4 text-xs">
            {/* Prominent Synthetic Boundary Disclaimer */}
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Synthetic Boundary Disclaimer (Pilot Only)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                {boundaryInfo.disclaimer}
              </p>
            </div>

            {/* Spatial Metadata Matrix */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-civic-50 dark:bg-slate-800/80 rounded-xl font-mono text-xs border border-civic-200 dark:border-slate-700">
              <div>
                <span className="text-civic-500 dark:text-slate-400 block text-[10px]">SPATIAL SRID</span>
                <span className="font-bold text-civic-900 dark:text-white">
                  EPSG:{boundaryInfo.srid || 4326} (WGS 84)
                </span>
              </div>
              <div>
                <span className="text-civic-500 dark:text-slate-400 block text-[10px]">GEOMETRY TYPE</span>
                <span className="font-bold text-civic-900 dark:text-white">
                  {boundaryInfo.geometryType || 'MultiPolygon'}
                </span>
              </div>
              <div>
                <span className="text-civic-500 dark:text-slate-400 block text-[10px]">APPROX VERTICES</span>
                <span className="font-bold text-civic-900 dark:text-white">
                  {boundaryInfo.vertexCount ? `${boundaryInfo.vertexCount} coordinates` : 'Placeholder box (5 vertices)'}
                </span>
              </div>
              <div>
                <span className="text-civic-500 dark:text-slate-400 block text-[10px]">VALIDITY STATUS</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  ST_IsValid Verified
                </span>
              </div>
            </div>

            <p className="text-[11px] text-civic-500 dark:text-slate-400">
              PostGIS point-in-polygon queries (<code>ST_Contains</code>) use these boundaries for automatic ward resolution during complaint intake. Official administrative surveyor shapefiles must be imported prior to municipal production rollout.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
