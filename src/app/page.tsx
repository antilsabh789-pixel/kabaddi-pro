'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { useKabaddiStore } from '@/lib/store';
import Image from 'next/image';

// Dynamic imports with SSR disabled to reduce server memory usage
const SplashScreen = dynamic(() => import('@/components/kabaddi/SplashScreen'), { ssr: false });
const AuthScreen = dynamic(() => import('@/components/kabaddi/AuthScreen'), { ssr: false });
const HomeTab = dynamic(() => import('@/components/kabaddi/HomeTab'), { ssr: false });
const TournamentsTab = dynamic(() => import('@/components/kabaddi/TournamentsTab'), { ssr: false });
const QuickScoreTab = dynamic(() => import('@/components/kabaddi/QuickScoreTab'), { ssr: false });
const ProfileTab = dynamic(() => import('@/components/kabaddi/ProfileTab'), { ssr: false });
const LiveScoringScreen = dynamic(() => import('@/components/kabaddi/LiveScoringScreen'), { ssr: false });
const TossScreen = dynamic(() => import('@/components/kabaddi/TossScreen'), { ssr: false });

const BottomNav = dynamic(() => import('@/components/kabaddi/BottomNav'), { ssr: false });
const OfflineIndicator = dynamic(() => import('@/components/kabaddi/OfflineIndicator'), { ssr: false });

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const { isAuthenticated, isOnboarded, activeTab, setActiveTab, activeMatch, hasSeenSplash, setHasSeenSplash, showToss, tossMatchConfig, startMatch, cancelToss } =
    useKabaddiStore();

  // Wait for Zustand persist to hydrate from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      setHydrated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Show branded loading screen while hydrating from localStorage
  if (!hydrated) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-red-700 via-red-800 to-red-950 flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Subtle geometric pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)`,
          }}
        />

        <div className="flex flex-col items-center gap-5 relative z-10">
          {/* Logo with pulse animation */}
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-white shadow-2xl shadow-black/40 flex items-center justify-center overflow-hidden border-3 border-white/60">
              <Image
                src="/app-icon.png"
                alt="Kabaddi Pro"
                width={80}
                height={80}
                className="rounded-xl"
                priority
              />
            </div>
            {/* Animated glow ring */}
            <div
              className="absolute inset-[-6px] rounded-[1.75rem] border-2 border-brand-gold/30"
              style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
            />
          </div>

          {/* App name */}
          <div className="text-center">
            <h1 className="text-2xl font-black text-white tracking-[0.15em]">
              KABADDI
              <span className="text-brand-gold"> PRO</span>
            </h1>
          </div>

          {/* Loading indicator bar */}
          <div className="w-28 h-1 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
              style={{
                animation: 'load-progress 1.5s ease-in-out infinite',
              }}
            />
          </div>

          {/* Animated dots */}
          <div className="flex gap-2 mt-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-brand-gold"
                style={{
                  animation: 'pulse 1s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show splash screen on every app launch with app logo
  if (showSplash) {
    return <SplashScreen onComplete={() => {
      setShowSplash(false);
      if (!hasSeenSplash) {
        setHasSeenSplash(true);
      }
    }} />;
  }

  // Show auth/onboarding if not authenticated
  if (!isAuthenticated || !isOnboarded) {
    return <AuthScreen />;
  }

  // Show toss screen if a toss is in progress
  if (showToss && tossMatchConfig) {
    return (
      <TossScreen
        homeTeam={tossMatchConfig.homeTeam}
        awayTeam={tossMatchConfig.awayTeam}
        homeTeamColor={tossMatchConfig.homeTeamColor}
        awayTeamColor={tossMatchConfig.awayTeamColor}
        onTossComplete={(firstRaidTeam) => {
          startMatch(tossMatchConfig, firstRaidTeam);
        }}
        onBack={() => cancelToss()}
      />
    );
  }

  // If there's an active live match, show the scoring screen
  if (activeMatch?.isLive && activeTab === 'quick-score') {
    return (
      <div className="min-h-screen bg-warm-50 flex flex-col">
        <LiveScoringScreen />
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          hasLiveMatch={!!activeMatch?.isLive}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      <OfflineIndicator />
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'home' && <HomeTab />}
        {activeTab === 'tournaments' && <TournamentsTab />}
        {activeTab === 'quick-score' && <QuickScoreTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasLiveMatch={!!activeMatch?.isLive}
      />
    </div>
  );
}
