import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sliders,
  ShieldCheck,
  ShieldAlert,
  Users,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Check,
  Ban,
  UserCheck,
  XCircle,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context';
import { adminApi, ApiError, getApiUrl } from '../api/client';
import type {
  UserResponse,
  ReportResponse,
  AuditLogResponse,
} from '../types';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'approvals' | 'users' | 'reports' | 'audit'>('approvals');

  // Approvals State
  const [pendingOrganizers, setPendingOrganizers] = useState<UserResponse[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState<boolean>(false);

  // User Moderation State
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedUserForSuspend, setSelectedUserForSuspend] = useState<UserResponse | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>('');

  // Reports State
  const [reports, setReports] = useState<ReportResponse[]>([]);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');
  const [selectedReportForResolve, setSelectedReportForResolve] = useState<ReportResponse | null>(null);
  const [resolveStatus, setResolveStatus] = useState<'resolved' | 'dismissed'>('resolved');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogResponse[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [actionFilter, setActionFilter] = useState<string>('');

  // Global status & errors
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // 1. Fetch Pending Organizers
  const fetchPendingOrganizers = useCallback(async () => {
    try {
      setLoadingApprovals(true);
      setErrorMsg(null);
      const data = await adminApi.listPendingOrganizers();
      setPendingOrganizers(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setLoadingApprovals(false);
    }
  }, []);

  // 2. Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      setErrorMsg(null);
      const params: { role?: string; search?: string } = {};
      if (userRoleFilter !== 'all') params.role = userRoleFilter;
      if (userSearch.trim()) params.search = userSearch.trim();
      const data = await adminApi.listUsers(params);
      setUsers(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setLoadingUsers(false);
    }
  }, [userRoleFilter, userSearch]);

  // 3. Fetch Reports
  const fetchReports = useCallback(async () => {
    try {
      setLoadingReports(true);
      setErrorMsg(null);
      const data = await adminApi.listReports({ status: reportStatusFilter });
      setReports(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setLoadingReports(false);
    }
  }, [reportStatusFilter]);

  // 4. Fetch Audit Logs
  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      setErrorMsg(null);
      const params: { action?: string } = {};
      if (actionFilter) params.action = actionFilter;
      const data = await adminApi.getAuditLogs(params);
      setAuditLogs(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setLoadingLogs(false);
    }
  }, [actionFilter]);

  // Initial tab loading
  useEffect(() => {
    if (user?.role !== 'admin') return;
    let ignore = false;
    if (activeTab === 'approvals') {
      adminApi
        .listPendingOrganizers()
        .then((data) => {
          if (!ignore) {
            setPendingOrganizers(data);
            setLoadingApprovals(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setLoadingApprovals(false);
            if (err instanceof ApiError) setErrorMsg(err.message);
          }
        });
    } else if (activeTab === 'users') {
      const params: { role?: string; search?: string } = {};
      if (userRoleFilter !== 'all') params.role = userRoleFilter;
      if (userSearch.trim()) params.search = userSearch.trim();
      adminApi
        .listUsers(params)
        .then((data) => {
          if (!ignore) {
            setUsers(data);
            setLoadingUsers(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setLoadingUsers(false);
            if (err instanceof ApiError) setErrorMsg(err.message);
          }
        });
    } else if (activeTab === 'reports') {
      adminApi
        .listReports({ status: reportStatusFilter })
        .then((data) => {
          if (!ignore) {
            setReports(data);
            setLoadingReports(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setLoadingReports(false);
            if (err instanceof ApiError) setErrorMsg(err.message);
          }
        });
    } else if (activeTab === 'audit') {
      const params: { action?: string } = {};
      if (actionFilter) params.action = actionFilter;
      adminApi
        .getAuditLogs(params)
        .then((data) => {
          if (!ignore) {
            setAuditLogs(data);
            setLoadingLogs(false);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setLoadingLogs(false);
            if (err instanceof ApiError) setErrorMsg(err.message);
          }
        });
    }
    return () => {
      ignore = true;
    };
  }, [user, activeTab, userRoleFilter, userSearch, reportStatusFilter, actionFilter]);

  // Approve Organizer Action
  const handleApproveOrganizer = async (organizerId: string) => {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const approved = await adminApi.approveOrganizer(organizerId);
      setSuccessMsg(`Organizer @${approved.username} approved successfully.`);
      await fetchPendingOrganizers();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Failed to approve organizer.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend User Action
  const handleSuspendUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForSuspend) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await adminApi.suspendUser(selectedUserForSuspend.id, { reason: suspensionReason });
      setSuccessMsg(`User @${selectedUserForSuspend.username} has been suspended.`);
      setSelectedUserForSuspend(null);
      setSuspensionReason('');
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Reactivate User Action
  const handleReactivateUser = async (targetUser: UserResponse) => {
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await adminApi.reactivateUser(targetUser.id);
      setSuccessMsg(`User @${targetUser.username} reactivated successfully.`);
      await fetchUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Resolve Report Action
  const handleResolveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportForResolve) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      await adminApi.resolveReport(selectedReportForResolve.id, {
        status: resolveStatus,
        resolution_notes: resolutionNotes,
      });
      setSuccessMsg(`Report marked as ${resolveStatus.toUpperCase()}.`);
      setSelectedReportForResolve(null);
      setResolutionNotes('');
      await fetchReports();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-entrance">
      {/* Super-Admin Header */}
      <div className="p-8 rounded-3xl card-glass-heavy border border-amber-700/40 shadow-[0_0_40px_rgba(245,158,11,0.18)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-40 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center space-x-5 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-rose-600 p-[1.5px] shadow-[0_0_24px_rgba(245,158,11,0.4)]">
            <div className="w-full h-full bg-[#0a0b14] rounded-[14px] flex items-center justify-center text-amber-400">
              <Sliders className="w-8 h-8" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">
                Platform Administration
              </h1>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-950/90 border border-amber-600/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Super-admin governance, organizer verification, player suspensions, dispute moderation, and immutable audit trails.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 relative z-10">
          <Link
            to="/organizer"
            className="px-4 py-2.5 rounded-xl bg-[#111422] hover:bg-[#1a1d30] border border-violet-800/40 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <span>Organizer Console</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => {
              if (activeTab === 'approvals') fetchPendingOrganizers();
              else if (activeTab === 'users') fetchUsers();
              else if (activeTab === 'reports') fetchReports();
              else if (activeTab === 'audit') fetchAuditLogs();
            }}
            className="p-2.5 rounded-xl bg-[#111422] hover:bg-[#1a1d30] border border-violet-800/40 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-200 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/50 text-emerald-200 text-xs flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Security Health Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Authentication</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-white">Argon2id + JWT</p>
          <p className="text-[11px] text-gray-500">Sliding token rate-limiting</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Encryption</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-base font-bold text-white">AES-256-GCM</p>
          <p className="text-[11px] text-gray-500">Authenticated room ciphers</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Entry Model</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-base font-bold text-white">100% Free-to-Play</p>
          <p className="text-[11px] text-gray-500">Zero fees • Zero gambling</p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e101a] border border-violet-900/30 space-y-1">
          <div className="flex items-center justify-between text-gray-400 text-xs font-semibold">
            <span>Audit Trail</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-base font-bold text-white">Continuous Log</p>
          <p className="text-[11px] text-gray-500">Immutable admin history</p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-violet-900/30 space-x-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('approvals')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'approvals' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Organizer Approvals</span>
          {pendingOrganizers.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black">
              {pendingOrganizers.length}
            </span>
          )}
          {activeTab === 'approvals' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'users' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>User Moderation</span>
          {activeTab === 'users' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'reports' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Disputes & Reports</span>
          {activeTab === 'reports' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 flex items-center space-x-2 transition-colors relative ${
            activeTab === 'audit' ? 'text-amber-400' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Audit Logs</span>
          {activeTab === 'audit' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
          )}
        </button>
      </div>

      {/* TAB 1: ORGANIZER APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#0e101a] border border-violet-900/30 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Pending Organizer Applications ({pendingOrganizers.length})
            </h3>
            <button
              onClick={fetchPendingOrganizers}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              Refresh Queue
            </button>
          </div>

          {loadingApprovals ? (
            <div className="p-12 text-center text-xs text-gray-400">Loading pending organizers...</div>
          ) : pendingOrganizers.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Queue Clear</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                There are no pending organizer verification requests at this time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-violet-900/30 bg-[#0e101a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141624] text-gray-400 font-semibold border-b border-violet-900/30">
                  <tr>
                    <th className="p-4">Organizer</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Registered Date</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-900/20 text-gray-300">
                  {pendingOrganizers.map((org) => (
                    <tr key={org.id} className="hover:bg-[#141624]/40">
                      <td className="p-4 font-bold text-white">@{org.username}</td>
                      <td className="p-4 text-gray-300 font-mono">{org.email}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-950 text-violet-300 border border-violet-800">
                          {org.role}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{new Date(org.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleApproveOrganizer(org.id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold inline-flex items-center space-x-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve Organizer</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: USER MODERATION */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#0e101a] border border-violet-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by username or email..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-xs text-gray-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Role:</span>
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white"
              >
                <option value="all">All Roles</option>
                <option value="player">Player</option>
                <option value="organizer">Organizer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {loadingUsers ? (
            <div className="p-12 text-center text-xs text-gray-400">Loading user list...</div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-violet-900/30 bg-[#0e101a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141624] text-gray-400 font-semibold border-b border-violet-900/30">
                  <tr>
                    <th className="p-4">User</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-900/20 text-gray-300">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#141624]/40">
                      <td className="p-4 font-bold text-white">@{u.username}</td>
                      <td className="p-4 font-mono text-gray-400">{u.email}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-950 text-violet-300 border border-violet-800">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            u.is_active
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {u.role !== 'admin' && (
                          u.is_active ? (
                            <button
                              onClick={() => {
                                setSelectedUserForSuspend(u);
                                setSuspensionReason('');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-semibold inline-flex items-center space-x-1"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Suspend</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivateUser(u)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 font-semibold inline-flex items-center space-x-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Reactivate</span>
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DISPUTES & REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#0e101a] border border-violet-900/30 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Dispute & Misconduct Reports
            </h3>
            <select
              value={reportStatusFilter}
              onChange={(e) => setReportStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white"
            >
              <option value="all">All Reports</option>
              <option value="pending">Pending</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>

          {loadingReports ? (
            <div className="p-12 text-center text-xs text-gray-400">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs text-gray-400">No reports submitted.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-violet-900/30 bg-[#0e101a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#141624] text-gray-400 font-semibold border-b border-violet-900/30">
                  <tr>
                    <th className="p-4">Category</th>
                    <th className="p-4">Description</th>
                    <th className="p-4">Evidence</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Submitted At</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-900/20 text-gray-300">
                  {reports.map((r) => (
                    <tr key={r.id} className="hover:bg-[#141624]/40">
                      <td className="p-4 font-bold text-white uppercase text-[10px] tracking-wider text-rose-300">
                        {r.category}
                      </td>
                      <td className="p-4 max-w-xs truncate text-gray-300">{r.description}</td>
                      <td className="p-4">
                        {r.evidence_url ? (
                          <a
                            href={getApiUrl(r.evidence_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 inline-flex items-center space-x-1"
                          >
                            <span>View Evidence</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'resolved'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : r.status === 'dismissed'
                              ? 'bg-gray-800 text-gray-300'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        {r.status === 'pending' || r.status === 'investigating' ? (
                          <button
                            onClick={() => {
                              setSelectedReportForResolve(r);
                              setResolveStatus('resolved');
                              setResolutionNotes('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                          >
                            Resolve
                          </button>
                        ) : (
                          <span className="text-gray-500 text-[11px]">Closed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#0e101a] border border-violet-900/30 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              System & Administrative Audit Trail
            </h3>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="Filter by action (e.g. user_suspended)..."
              className="px-3 py-1.5 rounded-xl bg-[#141624] border border-violet-900/40 text-xs text-white w-64"
            />
          </div>

          {loadingLogs ? (
            <div className="p-12 text-center text-xs text-gray-400">Loading audit trail...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0e101a] border border-violet-900/30 text-center space-y-2">
              <Activity className="w-8 h-8 text-gray-500 mx-auto" />
              <p className="text-xs text-gray-400">No audit logs matching query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-violet-900/30 bg-[#0e101a]">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#141624] text-gray-400 font-semibold border-b border-violet-900/30 font-sans">
                  <tr>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Action</th>
                    <th className="p-4">Resource</th>
                    <th className="p-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-900/20 text-gray-300">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#141624]/40">
                      <td className="p-4 text-gray-400 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-950 text-cyan-300 border border-violet-800">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        {log.resource_type ? `${log.resource_type}:${log.resource_id?.slice(0, 8) || ''}` : '—'}
                      </td>
                      <td className="p-4 text-gray-300 max-w-sm truncate">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUSPENSION MODAL */}
      {selectedUserForSuspend && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0e101a] border border-rose-900/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2 text-rose-400">
                <Ban className="w-5 h-5" />
                <span>Suspend User Account</span>
              </h3>
              <button onClick={() => setSelectedUserForSuspend(null)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300">
              Are you sure you want to suspend <span className="font-bold text-white">@{selectedUserForSuspend.username}</span>? This will immediately revoke their access tokens and block them from all platform operations.
            </p>

            <form onSubmit={handleSuspendUser} className="space-y-3 text-xs">
              <div>
                <label htmlFor="admin_suspension_reason" className="block text-gray-300 font-semibold mb-1">
                  Violation Reason *
                </label>
                <textarea
                  id="admin_suspension_reason"
                  rows={3}
                  required
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="State the policy violation (e.g. cheating, abusive behavior)..."
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-violet-900/20">
                <button
                  type="button"
                  onClick={() => setSelectedUserForSuspend(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141624] text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                >
                  {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESOLVE REPORT MODAL */}
      {selectedReportForResolve && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0e101a] border border-violet-900/60 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-violet-900/30">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <span>Resolve Dispute Report</span>
              </h3>
              <button onClick={() => setSelectedReportForResolve(null)} className="text-gray-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#141624] border border-violet-900/20 text-xs space-y-1">
              <span className="text-[10px] font-bold text-rose-400 uppercase">{selectedReportForResolve.category}</span>
              <p className="text-gray-300">{selectedReportForResolve.description}</p>
            </div>

            <form onSubmit={handleResolveReport} className="space-y-3 text-xs">
              <div>
                <label htmlFor="admin_resolve_outcome" className="block text-gray-300 font-semibold mb-1">
                  Resolution Outcome *
                </label>
                <select
                  id="admin_resolve_outcome"
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value as 'resolved' | 'dismissed')}
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                >
                  <option value="resolved">Resolved (Action Taken)</option>
                  <option value="dismissed">Dismissed (No Violation Found)</option>
                </select>
              </div>

              <div>
                <label htmlFor="admin_resolution_notes" className="block text-gray-300 font-semibold mb-1">
                  Resolution Notes
                </label>
                <textarea
                  id="admin_resolution_notes"
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Detail the outcome for user notification and audit log..."
                  className="w-full px-3 py-2 rounded-xl bg-[#141624] border border-violet-900/40 text-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-violet-900/20">
                <button
                  type="button"
                  onClick={() => setSelectedReportForResolve(null)}
                  className="px-3 py-1.5 rounded-lg bg-[#141624] text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold"
                >
                  {actionLoading ? 'Saving...' : 'Submit Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
