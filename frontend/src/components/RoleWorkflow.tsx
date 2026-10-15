import React from 'react';
import { UserCheck, ShieldAlert, Award, Lock, ChevronRight } from 'lucide-react';

const ROLES = [
  {
    number: '01',
    title: 'Competitor / Player',
    tagline: 'Register free. Compete hard.',
    description:
      'Register free profiles, link in-game UIDs (Free Fire MAX, BGMI, Riot ID), join or create squads, and access encrypted room keys at match time.',
    icon: UserCheck,
    accentColor: 'violet',
    borderClass: 'border-violet-900/35 hover:border-violet-500/55',
    glowClass: 'hover:shadow-[0_0_30px_rgba(139,92,246,0.20)]',
    orbClass: 'bg-violet-600/10',
    iconBg: 'bg-violet-950/80 border-violet-600/40',
    iconColor: 'text-violet-400',
    tagColor: 'text-violet-400',
    dotColor: 'bg-violet-400',
    bullets: [
      'Squad & Duo roster assembly with UID verification.',
      'Time-restricted Room ID & Password reveal upon check-in.',
      'Match result proof upload (screenshots & kill tallies).',
    ],
  },
  {
    number: '02',
    title: 'Tournament Organizer',
    tagline: 'Host. Schedule. Broadcast.',
    description:
      'Host free-entry tournaments, generate single/double elimination brackets, manage check-in windows, set encrypted room credentials, and review submitted proof.',
    icon: Award,
    accentColor: 'cyan',
    borderClass: 'border-cyan-900/35 hover:border-cyan-500/55',
    glowClass: 'hover:shadow-[0_0_30px_rgba(6,182,212,0.20)]',
    orbClass: 'bg-cyan-600/10',
    iconBg: 'bg-cyan-950/80 border-cyan-600/40',
    iconColor: 'text-cyan-400',
    tagColor: 'text-cyan-400',
    dotColor: 'bg-cyan-400',
    bullets: [
      'Instant bracket generator & round scheduling.',
      'Secure custom room credential management & timer dispatch.',
      'Score validation & automated leaderboard calculation.',
    ],
  },
  {
    number: '03',
    title: 'Platform Admin',
    tagline: 'Govern. Audit. Enforce.',
    description:
      'Supervise platform integrity, inspect immutable audit logs, handle match disputes, approve organizers, and enforce community anti-cheat standards.',
    icon: ShieldAlert,
    accentColor: 'indigo',
    borderClass: 'border-indigo-900/35 hover:border-indigo-500/55',
    glowClass: 'hover:shadow-[0_0_30px_rgba(99,102,241,0.20)]',
    orbClass: 'bg-indigo-600/10',
    iconBg: 'bg-indigo-950/80 border-indigo-600/40',
    iconColor: 'text-indigo-400',
    tagColor: 'text-indigo-400',
    dotColor: 'bg-indigo-400',
    bullets: [
      'Audit logging for all credential reveals and score edits.',
      'Dispute arbitration interface with evidence timeline.',
      'Organizer approval and compliance enforcement.',
    ],
  },
];

export const RoleWorkflow: React.FC = () => {
  return (
    <section id="roles" className="py-24 relative overflow-hidden">
      {/* Subtle diagonal stripe background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(139,92,246,0.5) 0px, rgba(139,92,246,0.5) 1px, transparent 1px, transparent 40px)',
        }}
      />

      {/* Section ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.07) 0%, transparent 70%)' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section heading */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 text-xs font-semibold mb-4">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Role-Based Access Control Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight uppercase leading-tight sm:leading-none">
            BUILT FOR PLAYERS,{' '}
            <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">
              ORGANIZERS &amp; ADMINS
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            A secure three-tiered ecosystem designed to ensure competitive integrity,
            encrypted credential distribution, and automated bracket management.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-7">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.number}
                className={`group relative p-5 sm:p-8 rounded-2xl bg-[#0e1020]/80 border ${role.borderClass} ${role.glowClass} backdrop-blur-sm hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col`}
              >
                {/* Corner glow orb */}
                <div className={`absolute top-0 right-0 w-40 h-40 ${role.orbClass} rounded-full blur-3xl pointer-events-none`} />

                {/* Icon with animated border ring */}
                <div className="relative mb-6 w-fit">
                  <div className={`w-14 h-14 rounded-xl ${role.iconBg} border ${role.iconColor} flex items-center justify-center group-hover:shadow-[0_0_18px_rgba(139,92,246,0.3)] transition-shadow duration-300`}>
                    <Icon className={`w-7 h-7 ${role.iconColor}`} />
                  </div>
                </div>

                <span className={`text-xs font-black ${role.tagColor} uppercase tracking-[0.15em] mb-1`}>
                  Role {role.number}
                </span>
                <h3 className="text-xl font-black text-white mb-1">{role.title}</h3>
                <p className={`text-xs font-bold ${role.tagColor} mb-4`}>{role.tagline}</p>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed flex-1">{role.description}</p>

                <ul className="space-y-2.5">
                  {role.bullets.map((b, i) => (
                    <li key={i} className="flex items-start space-x-2.5 text-xs text-gray-300">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${role.dotColor} shrink-0`} />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className={`mt-6 pt-5 border-t border-gray-800/60 flex items-center space-x-1.5 text-xs font-semibold ${role.tagColor} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
                  <span>Learn more</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
