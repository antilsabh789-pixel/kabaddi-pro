'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Download, Users, Swords, Trophy, Calendar,
  FileSpreadsheet, Loader2, CheckCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────

interface DataExportScreenProps {
  onClose: () => void;
}

type ExportType = 'players' | 'matches' | 'tournament' | 'season';

interface ExportOption {
  type: ExportType;
  label: string;
  icon: typeof Users;
  color: string;
  bgColor: string;
  description: string;
  needsSelector: boolean;
}

// ─── Config ───────────────────────────────────────────────────────

const EXPORT_OPTIONS: ExportOption[] = [
  {
    type: 'players',
    label: 'Players',
    icon: Users,
    color: 'text-brand-teal',
    bgColor: 'bg-brand-teal/10',
    description: 'Name, team, position, stats, rating',
    needsSelector: false,
  },
  {
    type: 'matches',
    label: 'Matches',
    icon: Swords,
    color: 'text-brand-red',
    bgColor: 'bg-brand-red/10',
    description: 'Teams, scores, events, date, ground',
    needsSelector: false,
  },
  {
    type: 'tournament',
    label: 'Tournament',
    icon: Trophy,
    color: 'text-brand-gold',
    bgColor: 'bg-brand-gold/10',
    description: 'Standings, matches, teams, bracket',
    needsSelector: true,
  },
  {
    type: 'season',
    label: 'Season',
    icon: Calendar,
    color: 'text-brand-navy',
    bgColor: 'bg-brand-navy/10',
    description: 'Season summary, stats, team standings',
    needsSelector: true,
  },
];

// ─── Animation ────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function DataExportScreen({ onClose }: DataExportScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState<ExportType | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Mock data for selectors (in production these would be fetched)
  const [tournaments] = useState<{ id: string; name: string }[]>([]);
  const [seasons] = useState<{ id: string; name: string }[]>([]);

  const selectedOption = EXPORT_OPTIONS.find((o) => o.type === selectedType);

  // ─── Handle Export ────────────────────────────────────────────

  const handleExport = async () => {
    if (!selectedType) return;

    if (!isPremium) {
      toast({
        title: 'Premium Feature',
        description: 'Upgrade to Pro to export data',
        variant: 'destructive',
      });
      return;
    }

    if (selectedOption?.needsSelector && !selectedId) {
      toast({
        title: 'Selection Required',
        description: `Please select a ${selectedType}`,
        variant: 'destructive',
      });
      return;
    }

    setExporting(true);
    setExportSuccess(false);

    try {
      const params = new URLSearchParams({
        type: selectedType,
        format: 'csv',
      });
      if (selectedId) params.set('id', selectedId);

      const res = await fetch(`/api/export?${params.toString()}`);

      if (res.ok) {
        // Trigger browser download of CSV blob
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedType}_export_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setExportSuccess(true);
        toast({ title: 'Export Complete!', description: `${selectedType} data downloaded as CSV` });

        setTimeout(() => setExportSuccess(false), 3000);
      } else {
        const data = await res.json();
        toast({
          title: 'Export Failed',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Export Failed',
        description: 'Could not download the file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-teal to-brand-teal-dark">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">EXPORT DATA</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4">
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Export Type Selector */}
          <motion.div variants={itemVariants}>
            <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-100 mb-3">
              SELECT DATA TYPE
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {EXPORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = selectedType === option.type;

                return (
                  <button
                    key={option.type}
                    onClick={() => {
                      setSelectedType(option.type);
                      setSelectedId('');
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-brand-teal bg-brand-teal/5 shadow-md'
                        : 'border-warm-200 bg-white hover:border-warm-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg ${option.bgColor} flex items-center justify-center mb-2`}>
                      <Icon className={`w-5 h-5 ${option.color}`} />
                    </div>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{option.label}</p>
                    <p className="text-[10px] text-warm-500 mt-0.5 leading-tight">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Selector Dropdown for Tournament/Season */}
          {selectedOption?.needsSelector && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-warm-200/60">
                <CardContent className="p-4">
                  <h3 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-100 mb-2">
                    SELECT {(selectedType ?? '').toUpperCase()}
                  </h3>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full h-10 rounded-lg border border-warm-300 bg-white px-3 text-sm text-warm-800 focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:border-brand-teal"
                  >
                    <option value="">Choose a {selectedType}...</option>
                    {(selectedType === 'tournament' ? tournaments : seasons).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {(selectedType === 'tournament' ? tournaments : seasons).length === 0 && (
                    <p className="text-[10px] text-warm-400 mt-1.5">
                      No {selectedType}s found. Create one first!
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Export Format Info */}
          {selectedType && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-warm-200/60">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-warm-800 dark:text-warm-100">CSV Format</p>
                      <p className="text-[10px] text-warm-500 mt-0.5">
                        Compatible with Excel, Google Sheets, and all data tools
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700 text-[9px] font-bold border-0">
                      CSV
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Export Button */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Data Export">
              <Button
                onClick={handleExport}
                disabled={!selectedType || exporting || (selectedOption?.needsSelector && !selectedId)}
                className="w-full h-12 bg-gradient-to-r from-brand-teal to-brand-teal-dark hover:opacity-90 text-white font-bold text-sm rounded-xl shadow-lg"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : exportSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Downloaded!
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export &amp; Download
                  </>
                )}
              </Button>
            </PremiumLock>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
