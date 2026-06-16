'use client';

import { useState, useCallback, useMemo } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import type { Area, Point } from 'react-easy-crop';

interface ImageCropDialogProps {
  imageSrc: string;
  onCropComplete: (croppedImageDataUrl: string) => void;
  onCancel: () => void;
  circularCrop?: boolean;
  aspectRatio?: number;
  title?: string;
}

// ─── Helper: Create cropped image from canvas ────────────────────
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = imageSrc;

  await new Promise((resolve) => {
    image.onload = resolve;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Set canvas size to the cropped area
  const outputSize = Math.min(pixelCrop.width, pixelCrop.height);
  // For profile pictures, output at 512x512 max for good quality
  const maxOutput = 512;
  const scale = outputSize > maxOutput ? maxOutput / outputSize : 1;

  canvas.width = Math.round(pixelCrop.width * scale);
  canvas.height = Math.round(pixelCrop.height * scale);

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  // Convert to data URL (JPEG for smaller file size)
  return canvas.toDataURL('image/jpeg', 0.92);
}

export default function ImageCropDialog({
  imageSrc,
  onCropComplete,
  onCancel,
  circularCrop = true,
  aspectRatio = 1,
  title = 'Crop Photo',
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropChange = useCallback((newCrop: Point) => {
    setCrop(newCrop);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const croppedDataUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedDataUrl);
    } catch (err) {
      console.error('Crop failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [croppedAreaPixels, imageSrc, onCropComplete]);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="relative w-full max-w-md mx-4 bg-warm-50 dark:bg-warm-900 rounded-2xl overflow-hidden shadow-2xl"
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-red to-brand-red-dark">
            <div className="flex items-center gap-2">
              <Move className="w-4 h-4 text-white/70" />
              <h3 className="text-white font-bold text-sm">{title}</h3>
            </div>
            <button
              onClick={onCancel}
              className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Crop Area */}
          <div className="relative w-full h-[350px] bg-warm-900">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              circularCrop={circularCrop}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={handleCropComplete}
              cropShape={circularCrop ? 'round' : 'rect'}
              showGrid={false}
              style={{
                containerStyle: { height: '100%', width: '100%' },
              }}
            />
          </div>

          {/* Zoom Control */}
          <div className="px-4 py-3 bg-warm-100 dark:bg-warm-800/50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setZoom(Math.max(1, zoom - 0.1))}
                className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand-red
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-brand-red
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-webkit-slider-thumb]:shadow-brand-red/30
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-brand-red
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:shadow-lg
                    [&::-moz-range-thumb]:cursor-pointer"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-warm-400 font-medium">1x</span>
                  <span className="text-[10px] text-brand-red font-bold">{zoomPercent}%</span>
                  <span className="text-[9px] text-warm-400 font-medium">3x</span>
                </div>
              </div>
              <button
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Tip */}
          <div className="px-4 py-2 bg-warm-50 dark:bg-warm-900">
            <p className="text-[10px] text-warm-400 text-center">Drag to reposition • Pinch or use slider to zoom</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 px-4 py-3 bg-warm-50 dark:bg-warm-900 border-t border-warm-200 dark:border-warm-700">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 text-sm font-semibold hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 text-sm font-semibold hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-brand-red to-brand-red-dark text-white text-sm font-bold shadow-lg shadow-brand-red/25 hover:shadow-brand-red/40 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Apply
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
