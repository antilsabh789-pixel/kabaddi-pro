'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Camera, Upload, ZoomIn, ChevronLeft, ChevronRight,
  Image as ImageIcon, Captions,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Photo {
  id: string;
  matchId: string;
  userId: string;
  url: string;
  caption: string | null;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

interface MatchPhotoGalleryScreenProps {
  matchId: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchPhotoGalleryScreen({ matchId, onBack }: MatchPhotoGalleryScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [captionInput, setCaptionInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-photos?matchId=${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch (err) {
      console.error('Photos fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === 'ArrowRight' && lightboxIndex < photos.length - 1) setLightboxIndex(lightboxIndex + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxIndex, photos.length]);

  const handleUpload = async (file: File) => {
    if (!currentUser) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'match-photo');

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();
      const photoUrl = uploadData.url || uploadData.path;

      // Save photo record
      const saveRes = await fetch('/api/match-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          userId: currentUser.id,
          url: photoUrl,
          caption: captionInput.trim() || null,
        }),
      });

      if (!saveRes.ok) throw new Error('Failed to save photo');
      const saveData = await saveRes.json();

      setPhotos((prev) => [saveData.photo, ...prev]);
      setCaptionInput('');
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
      >
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                {t('photos.title', language)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-warm-500">
                {photos.length}
              </Badge>
              {currentUser && (
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  className="bg-brand-gold hover:bg-brand-gold-dark text-white text-xs rounded-lg"
                  disabled={uploading}
                >
                  {uploading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full mr-1"
                    />
                  ) : (
                    <Upload className="w-3 h-3 mr-1" />
                  )}
                  {uploading ? t('photos.uploading', language) : t('photos.upload', language)}
                </Button>
              )}
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Caption input for upload */}
          {currentUser && (
            <div className="px-4 pb-3">
              <input
                type="text"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                placeholder={t('photos.captionPlaceholder', language)}
                className="w-full px-3 py-2 text-xs bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-gold/30 text-warm-800 dark:text-warm-100 placeholder:text-warm-400"
              />
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </header>

        {/* ─── Photo grid ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-warm-100 dark:bg-warm-800 animate-pulse"
                />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-warm-500">
              <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('photos.noPhotos', language)}</p>
              {currentUser && (
                <p className="text-xs text-warm-400 mt-1">{t('photos.uploadFirst', language)}</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo, idx) => (
                <motion.div
                  key={photo.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer"
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || t('photos.matchPhoto', language)}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  {/* Caption overlay */}
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-[10px] text-white font-medium line-clamp-2">
                        {photo.caption}
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Lightbox ─── */}
        <AnimatePresence>
          {lightboxIndex !== null && photos[lightboxIndex] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center"
              onClick={() => setLightboxIndex(null)}
            >
              {/* Close button */}
              <button
                onClick={() => setLightboxIndex(null)}
                className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Photo */}
              <motion.div
                key={lightboxIndex}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 25 }}
                className="max-w-[90vw] max-h-[70vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={photos[lightboxIndex].url}
                  alt={photos[lightboxIndex].caption || ''}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </motion.div>

              {/* Caption */}
              {photos[lightboxIndex].caption && (
                <div className="mt-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                  <p className="text-white/90 text-sm font-medium">
                    {photos[lightboxIndex].caption}
                  </p>
                </div>
              )}

              {/* Navigation arrows */}
              <div
                className="absolute bottom-8 flex items-center gap-4"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))}
                  disabled={lightboxIndex === 0}
                  className="text-white hover:bg-white/10 rounded-full"
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
                <span className="text-white/60 text-sm">
                  {lightboxIndex + 1} / {photos.length}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLightboxIndex(Math.min(photos.length - 1, lightboxIndex + 1))}
                  disabled={lightboxIndex === photos.length - 1}
                  className="text-white hover:bg-white/10 rounded-full"
                >
                  <ChevronRight className="w-6 h-6" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
