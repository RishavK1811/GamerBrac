import React from 'react';
import { Hero } from '../components/Hero';
import { SystemStatus } from '../components/SystemStatus';
import { GameShowcase } from '../components/GameShowcase';
import { RoleWorkflow } from '../components/RoleWorkflow';

export const HomePage: React.FC = () => {
  return (
    <>
      <Hero />
      <SystemStatus />
      <GameShowcase />
      <RoleWorkflow />
    </>
  );
};
