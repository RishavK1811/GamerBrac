import React, { useState, useEffect } from 'react';
import { Activity, Database, CheckCircle2, AlertCircle, RefreshCw, Server, Cpu, Radio } from 'lucide-react';
import type { HealthCheckData } from '../types';
import { getApiUrl } from '../api/client';

export const SystemStatus: React.FC = () => {
  const [health, setHealth] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const performFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl('/api/v1/health'));
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      const data: HealthCheckData = await response.json();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to backend';
      setError(message);
      setHealth({
        status: 'standby',
        app_name: 'GamerBrac Esports Platform',
        version: '0.1.0',
        environment: 'development',
        database: 'awaiting connection',
        timestamp: new Date().toISOString(),
        supported_games: ['Free Fire MAX', 'BGMI', 'VALORANT'],
      });
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    fetch(getApiUrl('/api/v1/health'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data: HealthCheckData) => {
        if (isMounted) {
          setHealth(data);
          setLoading(false);
          setLastChecked(new Date().toLocaleTimeString());
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Unable to connect to backend';
          setError(message);
          setHealth({
            status: 'standby',
            app_name: 'GamerBrac Esports Platform',
            version: '0.1.0',
            environment: 'development',
            database: 'awaiting connection',
            timestamp: new Date().toISOString(),
            supported_games: ['Free Fire MAX', 'BGMI', 'VALORANT'],
          });
          setLoading(false);
          setLastChecked(new Date().toLocaleTimeString());
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isConnected = health && health.status === 'healthy';

  return (
    <section id="status" className="py-12 bg-[#0c0d16] border-y border-violet-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Radio className="w-4 h-4 animate-pulse text-cyan-400" />
              <span>System Verification</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Backend & Architecture Health
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Live observability of FastAPI services, SQLite database connection, and configuration state.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs text-gray-400">
              {lastChecked ? `Last ping: ${lastChecked}` : 'Checking...'}
            </span>
            <button
              type="button"
              onClick={performFetch}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-violet-900/40 hover:bg-violet-800/50 border border-violet-700/50 text-violet-200 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Ping Backend</span>
            </button>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* API Health */}
          <div className="p-5 rounded-xl bg-[#121424] border border-violet-900/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                FastAPI Health
              </span>
              <Server className="w-4 h-4 text-violet-400" />
            </div>
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400" />
              )}
              <span className="text-lg font-bold text-white capitalize">
                {health?.status || 'Checking...'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Route:{' '}
              <code className="text-violet-300 bg-violet-950/60 px-1 py-0.5 rounded text-[11px]">
                /api/v1/health
              </code>
            </p>
          </div>

          {/* Database */}
          <div className="p-5 rounded-xl bg-[#121424] border border-violet-900/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Database Engine
              </span>
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span className="text-lg font-bold text-white capitalize">
                {health?.database || 'SQLite Local'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              SQLAlchemy & Alembic migrations ready
            </p>
          </div>

          {/* Environment */}
          <div className="p-5 rounded-xl bg-[#121424] border border-violet-900/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Environment
              </span>
              <Cpu className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold text-white uppercase tracking-wider">
                {health?.environment || 'Development'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              API Version: <span className="text-cyan-300 font-mono">{health?.version || '0.1.0'}</span>
            </p>
          </div>

          {/* Supported Titles */}
          <div className="p-5 rounded-xl bg-[#121424] border border-violet-900/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Configured Games
              </span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {health?.supported_games?.map((game) => (
                <span
                  key={game}
                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-violet-950/70 border border-violet-800/40 text-violet-300"
                >
                  {game}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Validated on backend schema
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Backend connection notice: ({error}). Start the FastAPI server with{' '}
              <code className="text-amber-200 bg-amber-900/40 px-1 py-0.5 rounded">
                uvicorn app.main:app --reload
              </code>{' '}
              on port 8000.
            </span>
          </div>
        )}
      </div>
    </section>
  );
};
