'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Users,
  Calendar,
  Settings,
  Trash2,
  Check,
  X,
  Clock,
  Crown,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useKabaddiStore, type CoachAcademy } from '@/lib/store';
import { t } from '@/lib/i18n';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

// ─── Types ────────────────────────────────────────────────────────

interface CoachesCornerScreenProps {
  onClose: () => void;
}

interface AcademyPlayer {
  id: string;
  name: string;
  phone?: string;
  isPresent?: boolean;
}

type SubView = 'main' | 'academy-detail' | 'create-academy';

// ─── Mock Players ─────────────────────────────────────────────────

const MOCK_PLAYERS: AcademyPlayer[] = [
  { id: 'p1', name: 'Rahul Kumar', phone: '9876543210', isPresent: false },
  { id: 'p2', name: 'Vikram Singh', phone: '9876543211', isPresent: false },
  { id: 'p3', name: 'Amit Sharma', phone: '9876543212', isPresent: false },
  { id: 'p4', name: 'Deepak Hooda', phone: '9876543213', isPresent: false },
  { id: 'p5', name: 'Manjeet Chillar', phone: '9876543214', isPresent: false },
  { id: 'p6', name: 'Pardeep Narwal', phone: '9876543215', isPresent: false },
  { id: 'p7', name: 'Ajay Thakur', phone: '9876543216', isPresent: false },
  { id: 'p8', name: 'Rishank Devadiga', phone: '9876543217', isPresent: false },
];

// ─── Component ────────────────────────────────────────────────────

export default function CoachesCornerScreen({ onClose }: CoachesCornerScreenProps) {
  const { language, coachAcademies, addCoachAcademy, removeCoachAcademy, updateCoachAcademy, currentUser } = useKabaddiStore();
  const isPremium = currentUser?.isPremium || currentUser?.isAdmin || false;
  const lang = language;

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [subView, setSubView] = useState<SubView>('main');
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'players' | 'attendance' | 'rules'>('players');

  // Create academy form
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newGroundName, setNewGroundName] = useState('');

  // Players state (local per academy)
  const [academyPlayers, setAcademyPlayers] = useState<Record<string, AcademyPlayer[]>>({});
  const [addPlayerSearch, setAddPlayerSearch] = useState('');

  // Custom rules
  const [newRule, setNewRule] = useState('');

  const selectedAcademy = coachAcademies.find((a) => a.id === selectedAcademyId);

  const getPlayers = useCallback(
    (academyId: string): AcademyPlayer[] => {
      return academyPlayers[academyId] || [];
    },
    [academyPlayers]
  );

  const addPlayerToAcademy = useCallback(
    (academyId: string, player: AcademyPlayer) => {
      setAcademyPlayers((prev) => {
        const current = prev[academyId] || [];
        if (current.find((p) => p.id === player.id)) return prev;
        const updated = [...current, player];
        return { ...prev, [academyId]: updated };
      });
      // Update totalPlayers count
      const academy = coachAcademies.find((a) => a.id === academyId);
      if (academy) {
        const currentCount = academyPlayers[academyId]?.length || 0;
        updateCoachAcademy(academyId, { totalPlayers: currentCount + 1 });
      }
    },
    [coachAcademies, academyPlayers, updateCoachAcademy]
  );

  const removePlayerFromAcademy = useCallback(
    (academyId: string, playerId: string) => {
      setAcademyPlayers((prev) => {
        const current = prev[academyId] || [];
        return { ...prev, [academyId]: current.filter((p) => p.id !== playerId) };
      });
      // Update totalPlayers count
      const academy = coachAcademies.find((a) => a.id === academyId);
      if (academy) {
        const currentCount = academyPlayers[academyId]?.length || 0;
        updateCoachAcademy(academyId, { totalPlayers: Math.max(0, currentCount - 1) });
      }
    },
    [coachAcademies, academyPlayers, updateCoachAcademy]
  );

  const toggleAttendance = useCallback(
    (academyId: string, playerId: string) => {
      setAcademyPlayers((prev) => {
        const current = prev[academyId] || [];
        return {
          ...prev,
          [academyId]: current.map((p) =>
            p.id === playerId ? { ...p, isPresent: !p.isPresent } : p
          ),
        };
      });
    },
    []
  );

  const handleCreateAcademy = () => {
    if (!newName.trim()) return;
    addCoachAcademy({
      name: newName.trim(),
      location: newLocation.trim(),
      groundName: newGroundName.trim(),
      totalPlayers: 0,
      rules: {
        sundayHoliday: false,
        practiceSchedule: 'one-time',
        customRules: [],
      },
    });
    setNewName('');
    setNewLocation('');
    setNewGroundName('');
    setSubView('main');
  };

  const handleDeleteAcademy = (id: string) => {
    removeCoachAcademy(id);
    setAcademyPlayers((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (selectedAcademyId === id) {
      setSelectedAcademyId(null);
      setSubView('main');
    }
  };

  // ─── Sub-views ──────────────────────────────────────────────────

  const renderCreateAcademy = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 space-y-4"
    >
      <Card className="border-0 shadow-md bg-white dark:bg-warm-800">
        <CardContent className="p-6 space-y-4">
          <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100">
            {t('coach.createAcademy', lang)}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-warm-600 dark:text-warm-400 mb-1 block">
                {t('coach.academyName', lang)}
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('coach.academyName', lang)}
                className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-warm-600 dark:text-warm-400 mb-1 block">
                {t('coach.groundLocation', lang)}
              </label>
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder={t('coach.groundLocation', lang)}
                className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-warm-600 dark:text-warm-400 mb-1 block">
                {t('coach.manageGround', lang)}
              </label>
              <Input
                value={newGroundName}
                onChange={(e) => setNewGroundName(e.target.value)}
                placeholder={t('coach.manageGround', lang)}
                className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setSubView('main')}
              className="flex-1"
            >
              {t('common.cancel', lang)}
            </Button>
            <Button
              onClick={handleCreateAcademy}
              disabled={!newName.trim()}
              className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white"
            >
              {t('coach.createAcademy', lang)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderAcademyDetail = () => {
    if (!selectedAcademy) return null;
    const players = getPlayers(selectedAcademy.id);
    const presentCount = players.filter((p) => p.isPresent).length;

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex flex-col h-full"
      >
        {/* Academy header */}
        <div className="p-4 bg-gradient-to-r from-brand-red to-brand-red-dark text-white">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSubView('main');
                setSelectedAcademyId(null);
              }}
              className="text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h2 className="text-lg font-bold">{selectedAcademy.name}</h2>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <MapPin className="w-3 h-3" />
                <span>{selectedAcademy.location || 'No location'}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteAcademy(selectedAcademy.id)}
              className="text-white hover:bg-white/20"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{players.length} {t('coach.totalPlayers', lang)}</span>
            </div>
            {selectedAcademy.groundName && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{selectedAcademy.groundName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-warm-200 dark:border-warm-700">
          {(['players', 'attendance', 'rules'] as const).map((tab) => {
            const icons = { players: Users, attendance: Calendar, rules: Settings };
            const labels = {
              players: t('coach.manageTeam', lang),
              attendance: t('coach.attendance', lang),
              rules: t('coach.rules', lang),
            };
            const Icon = icons[tab];
            return (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                  detailTab === tab
                    ? 'text-brand-red border-b-2 border-brand-red'
                    : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          <AnimatePresence mode="wait">
            {detailTab === 'players' && (
              <motion.div
                key="players"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Add player */}
                <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2">
                      {t('coach.addPlayer', lang)}
                    </h4>
                    <div className="flex gap-2">
                      <Input
                        value={addPlayerSearch}
                        onChange={(e) => setAddPlayerSearch(e.target.value)}
                        placeholder={t('coach.registerPlayer', lang)}
                        className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600 text-sm"
                      />
                      <Button
                        size="sm"
                        className="bg-brand-teal hover:bg-brand-teal-dark text-white shrink-0"
                        onClick={() => {
                          if (addPlayerSearch.trim()) {
                            addPlayerToAcademy(selectedAcademy.id, {
                              id: `player_${Date.now()}`,
                              name: addPlayerSearch.trim(),
                              isPresent: false,
                            });
                            setAddPlayerSearch('');
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick add from mock */}
                {(() => {
                  const existingIds = players.map((p) => p.id);
                  const available = MOCK_PLAYERS.filter(
                    (p) => !existingIds.includes(p.id)
                  );
                  if (available.length === 0) return null;
                  return (
                    <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                      <CardContent className="p-4">
                        <h4 className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2">
                          {t('social.suggestedPlayers', lang)}
                        </h4>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {available.slice(0, 5).map((player) => (
                            <div
                              key={player.id}
                              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-warm-50 dark:hover:bg-warm-700 transition-colors"
                            >
                              <span className="text-sm text-warm-700 dark:text-warm-300">
                                {player.name}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-brand-teal"
                                onClick={() =>
                                  addPlayerToAcademy(selectedAcademy.id, {
                                    ...player,
                                    isPresent: false,
                                  })
                                }
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Player list */}
                {players.length === 0 ? (
                  <div className="text-center py-8 text-warm-500 dark:text-warm-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('coach.noAcademy', lang)}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {players.map((player, idx) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal font-bold text-sm">
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-warm-800 dark:text-warm-200">
                                  {player.name}
                                </p>
                                {player.phone && (
                                  <p className="text-xs text-warm-500 dark:text-warm-400">
                                    {player.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() =>
                                removePlayerFromAcademy(selectedAcademy.id, player.id)
                              }
                              title={t('coach.removePlayer', lang)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {detailTab === 'attendance' && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                {/* Date header */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-warm-700 dark:text-warm-300">
                    {new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h4>
                  <Badge
                    variant="secondary"
                    className="bg-brand-teal/10 text-brand-teal border-0"
                  >
                    {presentCount}/{players.length} {t('coach.attendance', lang)}
                  </Badge>
                </div>

                {players.length === 0 ? (
                  <div className="text-center py-8 text-warm-500 dark:text-warm-400">
                    <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {t('coach.addPlayer', lang)} {t('coach.attendance', lang).toLowerCase()}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {players.map((player) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                  player.isPresent
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                                }`}
                              >
                                {player.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-warm-800 dark:text-warm-200">
                                {player.name}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                toggleAttendance(selectedAcademy.id, player.id)
                              }
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                                player.isPresent
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                  : 'bg-warm-100 dark:bg-warm-700 text-warm-500 dark:text-warm-400'
                              }`}
                            >
                              {player.isPresent ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  {t('common.save', lang)}
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3" />
                                  Absent
                                </>
                              )}
                            </button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}

                    {/* Mark all present */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 border-brand-teal/30 text-brand-teal hover:bg-brand-teal/10"
                      onClick={() => {
                        setAcademyPlayers((prev) => ({
                          ...prev,
                          [selectedAcademy.id]: (prev[selectedAcademy.id] || []).map(
                            (p) => ({ ...p, isPresent: true })
                          ),
                        }));
                      }}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Mark All Present
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {detailTab === 'rules' && (
              <motion.div
                key="rules"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Sunday Holiday toggle */}
                <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-warm-800 dark:text-warm-200">
                            {t('coach.sundayHoliday', lang)}
                          </p>
                          <p className="text-xs text-warm-500 dark:text-warm-400">
                            No practice on Sundays
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          updateCoachAcademy(selectedAcademy.id, {
                            rules: {
                              ...selectedAcademy.rules,
                              sundayHoliday: !selectedAcademy.rules.sundayHoliday,
                            },
                          })
                        }
                        className={`relative w-12 h-7 rounded-full transition-colors ${
                          selectedAcademy.rules.sundayHoliday
                            ? 'bg-brand-teal'
                            : 'bg-warm-300 dark:bg-warm-600'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                            selectedAcademy.rules.sundayHoliday
                              ? 'translate-x-5'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Practice Schedule */}
                <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-brand-teal" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-warm-800 dark:text-warm-200">
                          {t('coach.practiceSchedule', lang)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['one-time', 'both-time'] as const).map((schedule) => (
                        <button
                          key={schedule}
                          onClick={() =>
                            updateCoachAcademy(selectedAcademy.id, {
                              rules: {
                                ...selectedAcademy.rules,
                                practiceSchedule: schedule,
                              },
                            })
                          }
                          className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                            selectedAcademy.rules.practiceSchedule === schedule
                              ? 'bg-brand-teal text-white shadow-sm'
                              : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400'
                          }`}
                        >
                          {schedule === 'one-time'
                            ? t('coach.oneTimePractice', lang)
                            : t('coach.bothTimePractice', lang)}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Custom Rules */}
                <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center">
                        <Settings className="w-5 h-5 text-brand-red" />
                      </div>
                      <h4 className="text-sm font-semibold text-warm-800 dark:text-warm-200">
                        Custom Rules
                      </h4>
                    </div>
                    <div className="flex gap-2 mb-3">
                      <Input
                        value={newRule}
                        onChange={(e) => setNewRule(e.target.value)}
                        placeholder="Add a custom rule..."
                        className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newRule.trim()) {
                            updateCoachAcademy(selectedAcademy.id, {
                              rules: {
                                ...selectedAcademy.rules,
                                customRules: [
                                  ...selectedAcademy.rules.customRules,
                                  newRule.trim(),
                                ],
                              },
                            });
                            setNewRule('');
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => {
                          if (newRule.trim()) {
                            updateCoachAcademy(selectedAcademy.id, {
                              rules: {
                                ...selectedAcademy.rules,
                                customRules: [
                                  ...selectedAcademy.rules.customRules,
                                  newRule.trim(),
                                ],
                              },
                            });
                            setNewRule('');
                          }
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {selectedAcademy.rules.customRules.length > 0 ? (
                      <div className="space-y-1.5">
                        {selectedAcademy.rules.customRules.map((rule, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-warm-50 dark:bg-warm-700"
                          >
                            <span className="text-sm text-warm-700 dark:text-warm-300">
                              {rule}
                            </span>
                            <button
                              onClick={() =>
                                updateCoachAcademy(selectedAcademy.id, {
                                  rules: {
                                    ...selectedAcademy.rules,
                                    customRules:
                                      selectedAcademy.rules.customRules.filter(
                                        (_, i) => i !== idx
                                      ),
                                  },
                                })
                              }
                              className="text-warm-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-warm-500 dark:text-warm-400 text-center py-2">
                        No custom rules added yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  const renderMainView = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-navy to-brand-navy-dark text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold tracking-wide">
            {t('coach.title', lang)}
          </h1>
        </div>
        <p className="text-sm text-warm-300 mt-1 ml-11">
          {t('coach.myAcademy', lang)}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-brand-red" />
              </div>
              <p className="text-2xl font-bold text-warm-800 dark:text-warm-200">
                {coachAcademies.length}
              </p>
              <p className="text-xs text-warm-500 dark:text-warm-400">
                {t('coach.myAcademy', lang)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white dark:bg-warm-800">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center mx-auto mb-2">
                <MapPin className="w-5 h-5 text-brand-teal" />
              </div>
              <p className="text-2xl font-bold text-warm-800 dark:text-warm-200">
                {coachAcademies.reduce((sum, a) => sum + a.totalPlayers, 0)}
              </p>
              <p className="text-xs text-warm-500 dark:text-warm-400">
                {t('coach.totalPlayers', lang)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Academy list */}
        {coachAcademies.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-warm-400" />
            </div>
            <p className="text-warm-600 dark:text-warm-400 mb-4">
              {t('coach.noAcademy', lang)}
            </p>
            <Button
              onClick={() => setSubView('create-academy')}
              className="bg-brand-red hover:bg-brand-red-dark text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('coach.createAcademy', lang)}
            </Button>
          </motion.div>
        ) : (
          <>
            {coachAcademies.map((academy, idx) => {
              const players = getPlayers(academy.id);
              return (
                <motion.div
                  key={academy.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card
                    className="border-0 shadow-md bg-white dark:bg-warm-800 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => {
                      setSelectedAcademyId(academy.id);
                      setSubView('academy-detail');
                      setDetailTab('players');
                    }}
                  >
                    <div className="h-1.5 bg-gradient-to-r from-brand-red to-brand-gold" />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-warm-800 dark:text-warm-200">
                            {academy.name}
                          </h3>
                          {academy.location && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-warm-500 dark:text-warm-400">
                              <MapPin className="w-3 h-3" />
                              {academy.location}
                            </div>
                          )}
                          {academy.groundName && (
                            <div className="flex items-center gap-1 mt-0.5 text-xs text-warm-500 dark:text-warm-400">
                              <Clock className="w-3 h-3" />
                              {academy.groundName}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-brand-teal/10 text-brand-teal border-0 text-xs"
                          >
                            <Users className="w-3 h-3 mr-1" />
                            {players.length}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-warm-400 hover:text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAcademy(academy.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Rules preview */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {academy.rules.sundayHoliday && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-0 text-[10px]"
                          >
                            {t('coach.sundayHoliday', lang)}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className="bg-brand-teal/10 text-brand-teal border-0 text-[10px]"
                        >
                          {academy.rules.practiceSchedule === 'one-time'
                            ? t('coach.oneTimePractice', lang)
                            : t('coach.bothTimePractice', lang)}
                        </Badge>
                        {academy.rules.customRules.slice(0, 2).map((rule, i) => (
                          <Badge
                            key={i}
                            variant="secondary"
                            className="bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400 border-0 text-[10px]"
                          >
                            {rule}
                          </Badge>
                        ))}
                        {academy.rules.customRules.length > 2 && (
                          <Badge
                            variant="secondary"
                            className="bg-warm-100 dark:bg-warm-700 text-warm-500 border-0 text-[10px]"
                          >
                            +{academy.rules.customRules.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}

            {/* Add academy button */}
            <Button
              onClick={() => setSubView('create-academy')}
              variant="outline"
              className="w-full border-dashed border-warm-300 dark:border-warm-600 text-warm-500 dark:text-warm-400 hover:bg-warm-50 dark:hover:bg-warm-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t('coach.createAcademy', lang)}
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col overflow-hidden"
    >
      {/* Premium gate - show locked screen if not premium */}
      {!isPremium && !showUpgrade && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-gold to-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/25 mb-6"
          >
            <Crown className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-xl font-black text-warm-800 dark:text-warm-100 text-center mb-2">
            Coach's Corner
          </h2>
          <div className="flex items-center gap-1.5 mb-3">
            <Lock className="w-3.5 h-3.5 text-brand-gold" />
            <span className="text-sm font-bold text-brand-gold">Premium Feature</span>
          </div>
          <p className="text-sm text-warm-500 dark:text-warm-400 text-center max-w-xs mb-6">
            Manage your academies, track attendance, organize training sessions & more — exclusively for Pro users
          </p>
          <div className="space-y-3 w-full max-w-xs">
            {['Manage multiple academies', 'Track player attendance', 'Custom training rules', 'Player roster management'].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm text-warm-700 dark:text-warm-300">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={() => setShowUpgrade(true)}
            className="mt-6 bg-gradient-to-r from-brand-gold to-amber-500 hover:opacity-90 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-amber-500/25"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
          <button
            onClick={onClose}
            className="mt-4 text-sm text-warm-400 hover:text-warm-600 dark:hover:text-warm-300 transition-colors"
          >
            Go back
          </button>
        </div>
      )}

      {!isPremium && showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature="Coach's Corner"
        />
      )}

      {isPremium && (
      <>
      <AnimatePresence mode="wait">
        {subView === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full"
          >
            {renderMainView()}
          </motion.div>
        )}
        {subView === 'create-academy' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full"
          >
            {/* Header for create */}
            <div className="bg-gradient-to-r from-brand-navy to-brand-navy-dark text-white px-4 py-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSubView('main')}
                  className="text-white hover:bg-white/20"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-bold">
                  {t('coach.createAcademy', lang)}
                </h1>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {renderCreateAcademy()}
            </div>
          </motion.div>
        )}
        {subView === 'academy-detail' && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full"
          >
            {renderAcademyDetail()}
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </motion.div>
  );
}
