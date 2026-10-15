import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ShieldCheck, KeyRound, Zap, ExternalLink } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#05060d] border-t border-violet-900/25 pt-16 pb-10 text-gray-400 text-xs relative overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(109,40,217,0.08) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

          {/* ── Brand ──────────────────────────────────────────────── */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-cyan-400 p-[1.5px]">
                <div className="w-full h-full bg-[#08090f] rounded-[10px] flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <span className="text-base font-black tracking-[0.12em] text-white uppercase">GamerBrac</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40 uppercase tracking-widest">
                INDIA
              </span>
            </div>
            <p className="text-gray-400 text-xs max-w-md leading-relaxed mb-5">
              Modern esports tournament engine crafted for Indian competitive communities.
              Supporting Free Fire MAX, BGMI, and VALORANT with automated brackets,
              encrypted room access, and instant leaderboards.
            </p>
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Strictly Free-to-Enter MVP · Fair Play Guaranteed</span>
            </div>
          </div>

          {/* ── Supported Titles ────────────────────────────────────── */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-[0.12em] mb-4 text-[11px]">
              Supported Titles
            </h4>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2 hover:text-violet-300 transition-colors cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                <span>Free Fire MAX <span className="text-gray-600">(Garena)</span></span>
              </li>
              <li className="flex items-center space-x-2 hover:text-cyan-300 transition-colors cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span>BGMI <span className="text-gray-600">(KRAFTON)</span></span>
              </li>
              <li className="flex items-center space-x-2 hover:text-rose-300 transition-colors cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>VALORANT <span className="text-gray-600">(Riot Games)</span></span>
              </li>
            </ul>
          </div>

          {/* ── Platform Features ────────────────────────────────────── */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-[0.12em] mb-4 text-[11px]">
              Platform Features
            </h4>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2 text-gray-400">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Encrypted Room Credentials</span>
              </li>
              <li className="flex items-center space-x-2 text-gray-400">
                <Trophy className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span>Automated Bracket Engine</span>
              </li>
              <li className="flex items-center space-x-2 text-gray-400">
                <Zap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Live Leaderboards</span>
              </li>
              <li className="flex items-center space-x-2 text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Evidence Upload &amp; Review</span>
              </li>
            </ul>

            {/* Quick links */}
            <div className="mt-6 space-y-2">
              <Link to="/tournaments" className="flex items-center space-x-1.5 hover:text-cyan-300 transition-colors group">
                <ExternalLink className="w-3 h-3 group-hover:text-cyan-400 transition-colors" />
                <span>Browse Tournaments</span>
              </Link>
              <Link to="/register" className="flex items-center space-x-1.5 hover:text-violet-300 transition-colors group">
                <ExternalLink className="w-3 h-3 group-hover:text-violet-400 transition-colors" />
                <span>Join the Platform</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Legal Disclaimer ─────────────────────────────────────────── */}
        <div className="p-4 rounded-2xl bg-[#0a0b16]/80 border border-violet-950/60 text-gray-500 text-[10px] leading-relaxed mb-8">
          <p className="font-bold text-gray-400 mb-1 text-[11px]">LEGAL &amp; PUBLISHER NOTICE:</p>
          <p>
            GamerBrac is an independent tournament management platform. Free Fire MAX is a trademark of Garena.
            BATTLEGROUNDS MOBILE INDIA (BGMI) is a trademark of KRAFTON, Inc. VALORANT is a trademark of Riot Games, Inc.
            GamerBrac is not affiliated with, associated with, sponsored by, or endorsed by any of these publishers.
            All trademarks and registered trademarks remain the property of their respective owners.
            GamerBrac strictly prohibits real-money gambling, cash entry fees, and unapproved prize pools during this MVP release.
          </p>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-violet-900/20 pt-6 gap-3 text-[11px] text-gray-600">
          <p>&copy; {CURRENT_YEAR} GamerBrac India. All rights reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Engineered with passion for Indian esports</span>
            <span className="text-violet-500">✦</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
