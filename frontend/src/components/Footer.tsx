import React from 'react';
import { Trophy, ShieldCheck } from 'lucide-react';

const CURRENT_YEAR = new Date().getFullYear();

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#07080e] border-t border-violet-900/30 pt-16 pb-12 text-gray-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-cyan-400 p-0.5">
                <div className="w-full h-full bg-[#0a0b12] rounded-[7px] flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <span className="text-lg font-black tracking-wider text-white">GAMERBRAC</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800/40">
                INDIA
              </span>
            </div>
            <p className="text-gray-400 text-xs max-w-md leading-relaxed mb-4">
              Modern esports tournament engine crafted for Indian competitive communities.
              Supporting Free Fire MAX, BGMI, and VALORANT with automated brackets, encrypted room access, and instant leaderboards.
            </p>
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
              <ShieldCheck className="w-4 h-4" />
              <span>Strictly Free-to-Enter MVP • Fair Play Guaranteed</span>
            </div>
          </div>

          {/* Supported Titles */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-3 text-xs">
              Supported Titles
            </h4>
            <ul className="space-y-2">
              <li className="hover:text-cyan-400 transition-colors">Free Fire MAX (Garena)</li>
              <li className="hover:text-cyan-400 transition-colors">BGMI (KRAFTON)</li>
              <li className="hover:text-cyan-400 transition-colors">VALORANT (Riot Games)</li>
            </ul>
          </div>

          {/* Architecture & Tech Stack */}
          <div>
            <h4 className="text-white font-bold uppercase tracking-wider mb-3 text-xs">
              Architecture (Phase 0)
            </h4>
            <ul className="space-y-2">
              <li className="text-gray-400">Frontend: React 19 + TypeScript + Vite</li>
              <li className="text-gray-400">Styling: Tailwind CSS (v4)</li>
              <li className="text-gray-400">Backend: FastAPI + Pydantic v2</li>
              <li className="text-gray-400">ORM & Migrations: SQLAlchemy + Alembic</li>
              <li className="text-gray-400">Database: SQLite (Dev) / PostgreSQL</li>
            </ul>
          </div>
        </div>

        {/* Legal Disclaimer Box */}
        <div className="p-4 rounded-xl bg-[#0d0e18] border border-violet-950 text-gray-500 text-[11px] leading-relaxed mb-8">
          <p className="font-semibold text-gray-400 mb-1">LEGAL & PUBLISHER NOTICE:</p>
          <p>
            GamerBrac is an independent tournament management platform. Free Fire MAX is a trademark of Garena. BATTLEGROUNDS MOBILE INDIA (BGMI) is a trademark of KRAFTON, Inc. VALORANT is a trademark of Riot Games, Inc. GamerBrac is not affiliated with, associated with, sponsored by, or endorsed by any of these publishers. All trademarks and registered trademarks remain the property of their respective owners. GamerBrac strictly prohibits real-money gambling, cash entry fees, and unapproved prize pools during this MVP release.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-violet-900/20 pt-6 text-[11px] text-gray-500">
          <p>&copy; {CURRENT_YEAR} GamerBrac India. All rights reserved.</p>
          <p className="flex items-center space-x-1 mt-2 sm:mt-0">
            <span>Engineered with passion for Indian esports</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
