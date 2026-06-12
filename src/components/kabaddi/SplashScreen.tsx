'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-900 flex flex-col items-center justify-center relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        setTimeout(onComplete, 2000);
      }}
    >
      {/* Background decorative elements */}
      <motion.div
        className="absolute top-[-80px] right-[-80px] w-64 h-64 rounded-full bg-white/5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      />
      <motion.div
        className="absolute bottom-[-60px] left-[-60px] w-48 h-48 rounded-full bg-white/5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      />
      <motion.div
        className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-white/5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.7, duration: 0.8 }}
      />
      {/* New decorative kabaddi mat lines */}
      <motion.div
        className="absolute bottom-1/3 right-1/4 w-24 h-24 rounded-full border border-white/10"
        initial={{ scale: 0, rotate: 0 }}
        animate={{ scale: 1, rotate: 180 }}
        transition={{ delay: 1, duration: 2, ease: 'linear' }}
      />
      <motion.div
        className="absolute top-1/3 right-1/6 w-16 h-16 rounded-full border border-yellow-400/10"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      />

      {/* App Logo */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
        className="relative z-10"
      >
        <div className="w-32 h-32 rounded-[2rem] bg-white shadow-2xl shadow-black/30 flex items-center justify-center overflow-hidden border-4 border-white/50">
          <Image
            src="/app-icon.png"
            alt="Kabaddi Pro"
            width={112}
            height={112}
            className="rounded-2xl"
            priority
          />
        </div>
        {/* Glow ring */}
        <motion.div
          className="absolute inset-[-8px] rounded-[2.5rem] border-2 border-yellow-400/40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0, 0.6, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
        {/* Second glow ring */}
        <motion.div
          className="absolute inset-[-16px] rounded-[3rem] border border-yellow-400/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [0.8, 1.15, 0.8], opacity: [0, 0.3, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1.5 }}
        />
      </motion.div>

      {/* App Name */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="mt-8 text-center relative z-10"
      >
        <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
          Kabaddi <span className="text-yellow-300">Pro</span>
        </h1>
        <motion.p
          className="text-red-200/80 mt-2 text-sm font-medium tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          Score · Compete · Dominate
        </motion.p>
      </motion.div>

      {/* Loading indicator */}
      <motion.div
        className="mt-14 flex flex-col items-center gap-3 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {/* Animated progress bar */}
        <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-yellow-300 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, delay: 0.5, ease: 'easeInOut' }}
          />
        </div>
        {/* Bouncing dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-yellow-300"
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
