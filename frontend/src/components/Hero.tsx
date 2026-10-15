import React from 'react';
import { Flame, ShieldCheck, Zap, KeyRound, Trophy } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      {/* Background ambient glow shapes */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-900/40 via-slate-900/60 to-cyan-900/40 border border-violet-500/30 text-xs sm:text-sm text-cyan-300 font-semibold mb-6 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
          <Flame className="w-4 h-4 text-violet-400 animate-pulse" />
          <span>India's Community Esports Tournament Engine</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span className="text-cyan-300 font-medium">Production Ready</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white uppercase max-w-5xl mx-auto leading-none">
          COMPETE. CONQUER. <br />
          <span className="bg-gradient-to-r from-violet-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            RULE THE BRACKET.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-xl text-gray-300 max-w-3xl mx-auto font-normal leading-relaxed">
          The next-generation tournament platform tailored for Indian competitors.
          Experience automated brackets, secure time-restricted Room credentials, and verifiable
          leaderboards for <span className="text-violet-300 font-semibold">Free Fire MAX</span>,{' '}
          <span className="text-cyan-300 font-semibold">BGMI</span>, and{' '}
          <span className="text-indigo-300 font-semibold">VALORANT</span>.
        </p>

        {/* Call to action buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#tournaments"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider text-white bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all flex items-center justify-center space-x-2"
          >
            <Trophy className="w-4 h-4 text-white" />
            <span>View Tournaments</span>
          </a>

          <a
            href="#status"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm uppercase tracking-wider text-gray-200 bg-[#121422] hover:bg-[#1a1e32] border border-violet-800/50 hover:border-cyan-500/50 transition-all flex items-center justify-center space-x-2"
          >
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>Inspect System Status</span>
          </a>
        </div>

        {/* Platform Core Guarantees Ribbon */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-xl bg-[#111320]/80 border border-violet-900/30 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-lg bg-violet-950/70 border border-violet-700/40 text-violet-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-sm tracking-wide">100% Free Entry MVP</h3>
            </div>
            <p className="text-xs text-gray-400">
              Community tournaments with zero entry-fee collection, strictly compliant with publisher policies.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#111320]/80 border border-violet-900/30 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-lg bg-cyan-950/70 border border-cyan-700/40 text-cyan-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-sm tracking-wide">Encrypted Room ID Dispatch</h3>
            </div>
            <p className="text-xs text-gray-400">
              Custom match Room IDs and passwords are kept encrypted and revealed only to checked-in players at match time.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#111320]/80 border border-violet-900/30 backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 rounded-lg bg-indigo-950/70 border border-indigo-700/40 text-indigo-400">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-sm tracking-wide">Instant Schedule & Proofs</h3>
            </div>
            <p className="text-xs text-gray-400">
              Automated bracket progression with screenshot evidence submission and audit logs for fair play.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
