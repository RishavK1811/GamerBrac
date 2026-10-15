import React from 'react';
import { Link } from 'react-router-dom';
import { Flame, ShieldCheck, KeyRound, Zap, Trophy, ChevronRight, Sparkles } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden min-h-[88vh] flex flex-col items-center justify-center pt-10 pb-16">

      {/* ── Mesh grid background ─────────────────────────────────────── */}
      <div className="absolute inset-0 hero-mesh pointer-events-none opacity-60" />

      {/* ── Ambient glow orbs ────────────────────────────────────────── */}
      <div
        className="absolute top-[-8%] left-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none orb-animate"
        style={{
          background: 'radial-gradient(circle, rgba(109,40,217,0.22) 0%, transparent 70%)',
          filter: 'blur(0px)',
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none orb-animate-slow"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 70%)',
          filter: 'blur(0px)',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center">

        {/* ── Pill badge ───────────────────────────────────────────────── */}
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 px-3.5 py-1.5 sm:px-5 sm:py-2 rounded-full border border-violet-500/30 bg-gradient-to-r from-violet-950/60 via-slate-900/60 to-cyan-950/60 backdrop-blur-sm text-[11px] sm:text-sm text-cyan-300 font-semibold mb-6 sm:mb-8 shadow-[0_0_24px_rgba(139,92,246,0.20)] animate-entrance max-w-full">
          <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400 animate-pulse shrink-0" />
          <span>India's Community Esports Tournament Engine</span>
          <span className="hidden xs:inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="hidden xs:inline text-emerald-300 font-medium">Free to Compete</span>
        </div>

        {/* ── Main headline ────────────────────────────────────────────── */}
        <h1 className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-0.03em] text-white uppercase max-w-5xl mx-auto leading-[0.96] sm:leading-[0.92] animate-entrance break-words" style={{ animationDelay: '80ms' }}>
          COMPETE.{' '}
          <span className="inline-block">CONQUER.</span>
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent glow-text-violet">
            RULE THE BRACKET.
          </span>
        </h1>

        {/* ── Subtitle ─────────────────────────────────────────────────── */}
        <p className="mt-5 sm:mt-7 text-sm sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed animate-entrance px-2" style={{ animationDelay: '160ms' }}>
          The next-generation tournament platform built for Indian competitors.
          Automated brackets, encrypted room credentials, and verifiable leaderboards
          for{' '}
          <span className="text-violet-300 font-semibold">Free Fire MAX</span>,{' '}
          <span className="text-cyan-300 font-semibold">BGMI</span>, and{' '}
          <span className="text-indigo-300 font-semibold">VALORANT</span>.
        </p>

        {/* ── CTA Buttons ──────────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-entrance" style={{ animationDelay: '240ms' }}>
          <Link
            to="/tournaments"
            className="group w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-9 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider text-white btn-neon-shimmer shadow-[0_0_30px_rgba(139,92,246,0.45)] hover:shadow-[0_0_45px_rgba(139,92,246,0.65)] transition-shadow duration-300"
          >
            <Trophy className="w-4 h-4 text-cyan-200 group-hover:rotate-12 transition-transform duration-300" />
            <span>Browse Tournaments</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            to="/register"
            className="group w-full sm:w-auto inline-flex items-center justify-center space-x-2.5 px-9 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider text-gray-200 bg-[#0f1120] hover:bg-[#181c35] border border-violet-700/40 hover:border-cyan-500/50 hover:text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(6,182,212,0.20)]"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Create Account — Free</span>
          </Link>
        </div>

        {/* ── Platform guarantees ribbon ───────────────────────────────── */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-4xl mx-auto text-left animate-entrance" style={{ animationDelay: '320ms' }}>

          {/* Free Entry */}
          <div className="group relative p-5 rounded-2xl bg-[#0e1020]/80 border border-violet-900/35 hover:border-violet-500/50 backdrop-blur-sm hover:shadow-[0_0_24px_rgba(139,92,246,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/8 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-700/40 text-violet-400 group-hover:shadow-[0_0_12px_rgba(139,92,246,0.4)] transition-shadow">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-sm tracking-wide">100% Free Entry MVP</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Community tournaments with zero entry-fee collection, strictly compliant with publisher policies.
            </p>
          </div>

          {/* Encrypted Room ID */}
          <div className="group relative p-5 rounded-2xl bg-[#0e1020]/80 border border-cyan-900/35 hover:border-cyan-500/50 backdrop-blur-sm hover:shadow-[0_0_24px_rgba(6,182,212,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-600/8 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-700/40 text-cyan-400 group-hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] transition-shadow">
                <KeyRound className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-sm tracking-wide">Encrypted Room ID Dispatch</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Custom match Room IDs and passwords encrypted and revealed only to checked-in players at match time.
            </p>
          </div>

          {/* Instant Schedules */}
          <div className="group relative p-5 rounded-2xl bg-[#0e1020]/80 border border-indigo-900/35 hover:border-indigo-500/50 backdrop-blur-sm hover:shadow-[0_0_24px_rgba(99,102,241,0.18)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-600/8 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center space-x-3 mb-3">
              <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-700/40 text-indigo-400 group-hover:shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-shadow">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-white font-bold text-sm tracking-wide">Instant Brackets</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Automated bracket progression with screenshot evidence submission and audit logs for fair play.
            </p>
          </div>
        </div>

        {/* ── Scroll indicator ─────────────────────────────────────────── */}
        <div className="mt-16 flex flex-col items-center space-y-2 text-gray-600 animate-entrance" style={{ animationDelay: '400ms' }}>
          <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Scroll to explore</span>
          <div className="w-px h-8 bg-gradient-to-b from-violet-500/50 to-transparent" />
        </div>
      </div>
    </section>
  );
};
