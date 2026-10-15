import React from 'react';
import { UserCheck, ShieldAlert, Award, Lock } from 'lucide-react';

export const RoleWorkflow: React.FC = () => {
  return (
    <section id="roles" className="py-20 bg-[#0a0b12] border-t border-violet-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-800/40 text-cyan-300 text-xs font-semibold mb-3">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Role-Based Access Control Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
            BUILT FOR PLAYERS, ORGANIZERS & ADMINS
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-400">
            A secure three-tiered ecosystem designed to ensure competitive integrity, encrypted credential distribution, and automated bracket management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 1. Player Role */}
          <div className="p-8 rounded-2xl bg-[#111322] border border-violet-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-12 h-12 rounded-xl bg-violet-950/80 border border-violet-600/40 flex items-center justify-center text-violet-400 mb-6">
              <UserCheck className="w-6 h-6" />
            </div>

            <span className="text-xs font-bold text-violet-400 uppercase tracking-widest">
              Role 01
            </span>
            <h3 className="text-2xl font-black text-white mt-1 mb-4">Competitor / Player</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed">
              Register free profiles, link in-game UIDs (Free Fire MAX, BGMI, Riot ID), join or create squads, and access encrypted room keys.
            </p>

            <ul className="space-y-3 text-xs text-gray-300">
              <li className="flex items-start space-x-2">
                <span className="text-violet-400 font-bold">•</span>
                <span>Squad & Duo roster assembly with UID verification.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-violet-400 font-bold">•</span>
                <span>Time-restricted Room ID & Password reveal upon check-in.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-violet-400 font-bold">•</span>
                <span>Match result proof upload (screenshots & kill tallies).</span>
              </li>
            </ul>
          </div>

          {/* 2. Organizer Role */}
          <div className="p-8 rounded-2xl bg-[#111322] border border-cyan-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-600/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-600/40 flex items-center justify-center text-cyan-400 mb-6">
              <Award className="w-6 h-6" />
            </div>

            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Role 02
            </span>
            <h3 className="text-2xl font-black text-white mt-1 mb-4">Tournament Organizer</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed">
              Host free-entry tournaments, generate single/double elimination brackets, manage check-in windows, and review submitted proof.
            </p>

            <ul className="space-y-3 text-xs text-gray-300">
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Instant bracket generator & round scheduling.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Secure custom room credential management & timer dispatch.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-cyan-400 font-bold">•</span>
                <span>Score validation & automated leaderboard calculation.</span>
              </li>
            </ul>
          </div>

          {/* 3. Admin Role */}
          <div className="p-8 rounded-2xl bg-[#111322] border border-indigo-900/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-2xl pointer-events-none" />
            <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-600/40 flex items-center justify-center text-indigo-400 mb-6">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              Role 03
            </span>
            <h3 className="text-2xl font-black text-white mt-1 mb-4">Platform Admin</h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-6 leading-relaxed">
              Supervise platform integrity, inspect immutable audit logs, handle match disputes, and enforce community anti-cheat standards.
            </p>

            <ul className="space-y-3 text-xs text-gray-300">
              <li className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>Audit logging for all credential reveals and score edits.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>Dispute arbitration interface with evidence timeline.</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-indigo-400 font-bold">•</span>
                <span>Organizer approval and compliance enforcement.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
