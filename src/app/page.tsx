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
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-900 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-2xl shadow-black/30 flex items-center justify-center overflow-hidden border-3 border-white/50">
            <Image
              src="/app-icon.png"
              alt="Kabaddi Pro"
              width={72}
              height={72}
              className="rounded-xl"
              priority
            />
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse"
                style={{ animationDelay: `${i * 0.15}s` }}
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
