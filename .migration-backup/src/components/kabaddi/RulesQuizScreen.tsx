'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Trophy,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Star,
  Target,
  Brain,
  Swords,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useKabaddiStore } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────

interface RulesQuizScreenProps {
  onBack: () => void;
}

type QuizCategory = 'rules' | 'technique' | 'strategy';
type QuizPhase = 'select' | 'playing' | 'results';

interface QuizQuestion {
  id: string;
  category: string;
  question: string;
  options: string[];
  explanation?: string;
}

interface QuizResult {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string;
}

// ─── Category Config ──────────────────────────────────────────────

const CATEGORIES: { id: QuizCategory; label: string; description: string; icon: typeof BookOpen; color: string; bgColor: string; borderColor: string }[] = [
  {
    id: 'rules',
    label: 'Rules',
    description: 'Test your knowledge of kabaddi rules and regulations',
    icon: BookOpen,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  {
    id: 'technique',
    label: 'Technique',
    description: 'Learn about kabaddi techniques and skills',
    icon: Target,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
  },
  {
    id: 'strategy',
    label: 'Strategy',
    description: 'Master kabaddi strategies and game plans',
    icon: Brain,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
];

// ─── Animation Variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 180 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function RulesQuizScreen({ onBack }: RulesQuizScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const language = useKabaddiStore((s) => s.language);
  const [phase, setPhase] = useState<QuizPhase>('select');
  const [category, setCategory] = useState<QuizCategory>('rules');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ questionId: string; selectedIndex: number }[]>([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{
    score: number;
    totalQuestions: number;
    xpEarned: number;
    results: QuizResult[];
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Fetch Questions ──────────────────────────────────────────

  const fetchQuestions = useCallback(async (cat: QuizCategory) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quiz?category=${cat}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch (err) {
      console.error('Quiz fetch error:', err);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Timer ────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') return;
    if (selectedAnswer !== null) return;

    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-submit when time runs out
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentQuestion, selectedAnswer]);

  const handleTimeUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (selectedAnswer === null) {
      // Time's up, move to next with no answer
      setSelectedAnswer(-1); // mark as timed out
      setTimeout(() => {
        moveToNext(-1);
      }, 1500);
    }
  };

  // ─── Start Quiz ───────────────────────────────────────────────

  const startQuiz = async (cat: QuizCategory) => {
    setCategory(cat);
    await fetchQuestions(cat);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setResults(null);
    setPhase('playing');
  };

  // ─── Handle Answer ────────────────────────────────────────────

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedAnswer(index);
  };

  const moveToNext = (answerIndex: number) => {
    const newAnswers = [
      ...answers,
      { questionId: questions[currentQuestion].id, selectedIndex: answerIndex },
    ];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setTimeLeft(15);
    } else {
      submitQuiz(newAnswers);
    }
  };

  // ─── Submit Quiz ──────────────────────────────────────────────

  const submitQuiz = async (finalAnswers: { questionId: string; selectedIndex: number }[]) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          category,
          answers: finalAnswers,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      const data = await res.json();
      setResults(data);
      setPhase('results');
    } catch (err) {
      console.error('Quiz submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Play Again ──────────────────────────────────────────────

  const playAgain = () => {
    setPhase('select');
    setQuestions([]);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setResults(null);
  };

  // ─── Render: Category Select ──────────────────────────────────

  const renderSelect = () => (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4 p-4"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-brand-red to-brand-gold flex items-center justify-center">
          <GraduationCap className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Kabaddi Quiz</h2>
        <p className="text-muted-foreground mt-1">Test your knowledge and earn XP!</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
            <Zap className="w-3 h-3 mr-1" /> 10 XP per correct answer
          </Badge>
        </div>
      </motion.div>

      {/* Categories */}
      {CATEGORIES.map((cat) => (
        <motion.div key={cat.id} variants={itemVariants}>
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] border-2 ${cat.borderColor} ${cat.bgColor}`}
            onClick={() => startQuiz(cat.id)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${cat.bgColor} flex items-center justify-center flex-shrink-0`}>
                <cat.icon className={`w-6 h-6 ${cat.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{cat.label}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{cat.description}</p>
              </div>
              <ArrowLeft className="w-5 h-5 text-muted-foreground rotate-180 flex-shrink-0" />
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Info */}
      <motion.div variants={itemVariants}>
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Swords className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works</p>
                <ul className="space-y-1">
                  <li>• 10 questions per quiz</li>
                  <li>• 15 seconds per question</li>
                  <li>• Earn 10 XP for each correct answer</li>
                  <li>• Review answers after completing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );

  // ─── Render: Loading ──────────────────────────────────────────

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-12 h-12 rounded-full border-4 border-brand-red border-t-transparent"
      />
      <p className="mt-4 text-muted-foreground">Loading questions...</p>
    </div>
  );

  // ─── Render: Playing ──────────────────────────────────────────

  const renderPlaying = () => {
    if (questions.length === 0) return renderLoading();
    const question = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;
    const isAnswered = selectedAnswer !== null;
    const timerColor =
      timeLeft > 10 ? 'text-green-500' : timeLeft > 5 ? 'text-amber-500' : 'text-red-500';
    const timerBg =
      timeLeft > 10 ? 'bg-green-500' : timeLeft > 5 ? 'bg-amber-500' : 'bg-red-500';

    return (
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -50 }}
        className="p-4 space-y-4"
      >
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <Badge variant="outline" className={timerColor}>
              <Clock className="w-3 h-3 mr-1" />
              {timeLeft}s
            </Badge>
          </div>
          <div className="relative h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${timerBg}`}
              initial={{ width: `${(timeLeft / 15) * 100}%` }}
              animate={{ width: `${(timeLeft / 15) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
            <Progress value={progress} className="absolute inset-0 opacity-30" />
          </div>
        </div>

        {/* Category badge */}
        <Badge className={`${CATEGORIES.find(c => c.id === category)?.bgColor} ${CATEGORIES.find(c => c.id === category)?.color} border-0`}>
          {CATEGORIES.find(c => c.id === category)?.label}
        </Badge>

        {/* Question */}
        <motion.div
          key={currentQuestion}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20 }}
        >
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground leading-relaxed">
                {question.question}
              </h3>
            </CardContent>
          </Card>
        </motion.div>

        {/* Options */}
        <div className="space-y-3">
          {question.options.map((option, index) => {
            let optionStyle = 'border-2 border-border hover:border-brand-red/50 hover:bg-brand-red/5';
            if (isAnswered && selectedAnswer === index) {
              optionStyle = 'border-2 border-brand-gold bg-brand-gold/10';
            }

            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`w-full text-left p-4 rounded-xl transition-all ${optionStyle} ${
                  isAnswered ? 'pointer-events-none' : 'cursor-pointer active:scale-[0.98]'
                }`}
                onClick={() => handleAnswer(index)}
                disabled={isAnswered}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isAnswered && selectedAnswer === index
                        ? 'bg-brand-gold text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {String.fromCharCode(65 + index)}
                  </div>
                  <span className="text-foreground font-medium">{option}</span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Next button */}
        <AnimatePresence>
          {isAnswered && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Button
                className="w-full bg-brand-red hover:bg-brand-red/90 text-white"
                onClick={() => moveToNext(selectedAnswer!)}
              >
                {currentQuestion < questions.length - 1 ? 'Next Question' : 'See Results'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ─── Render: Results ──────────────────────────────────────────

  const renderResults = () => {
    if (!results) return null;

    const percentage = Math.round((results.score / results.totalQuestions) * 100);
    const getGrade = () => {
      if (percentage >= 90) return { label: 'Outstanding! 🏆', color: 'text-yellow-500', icon: Trophy };
      if (percentage >= 70) return { label: 'Great Job! ⭐', color: 'text-green-500', icon: Star };
      if (percentage >= 50) return { label: 'Good Effort! 💪', color: 'text-blue-500', icon: Zap };
      return { label: 'Keep Learning! 📚', color: 'text-orange-500', icon: BookOpen };
    };
    const grade = getGrade();

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 space-y-4"
      >
        {/* Score card */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-red to-brand-gold p-6 text-center text-white">
              <grade.icon className="w-12 h-12 mx-auto mb-2" />
              <h2 className={`text-2xl font-bold ${grade.color}`}>{grade.label}</h2>
              <div className="mt-3 flex items-center justify-center gap-6">
                <div>
                  <p className="text-3xl font-bold">{results.score}/{results.totalQuestions}</p>
                  <p className="text-sm opacity-80">Correct</p>
                </div>
                <div className="w-px h-10 bg-white/30" />
                <div>
                  <p className="text-3xl font-bold">{percentage}%</p>
                  <p className="text-sm opacity-80">Score</p>
                </div>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-5 h-5 text-brand-gold" />
                <span className="text-lg font-bold text-brand-gold">+{results.xpEarned} XP Earned</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Answer review */}
        <motion.div variants={itemVariants}>
          <h3 className="font-semibold text-foreground mb-3">Answer Review</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.results.map((result, index) => {
              const question = questions.find(q => q.id === result.questionId);
              return (
                <Card key={result.questionId} className={result.correct ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      {result.correct ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {index + 1}. {question?.question}
                        </p>
                        {!result.correct && question && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Correct: {question.options[result.correctIndex]}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{result.explanation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* Action buttons */}
        <motion.div variants={itemVariants} className="space-y-3">
          <Button
            className="w-full bg-brand-red hover:bg-brand-red/90 text-white"
            onClick={() => startQuiz(category)}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Play Again
          </Button>
          <Button variant="outline" className="w-full" onClick={playAgain}>
            Choose Another Category
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={phase === 'select' ? onBack : () => {
            if (timerRef.current) clearInterval(timerRef.current);
            setPhase('select');
          }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground">
              {phase === 'select' ? 'Kabaddi Quiz' : phase === 'playing' ? `${CATEGORIES.find(c => c.id === category)?.label} Quiz` : 'Quiz Results'}
            </h1>
          </div>
          {phase === 'playing' && (
            <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
              <Zap className="w-3 h-3 mr-1" />
              {answers.reduce((acc, a) => acc, 0) + (selectedAnswer !== null ? 1 : 0)}/{questions.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          renderLoading()
        ) : phase === 'select' ? (
          renderSelect()
        ) : phase === 'playing' ? (
          renderPlaying()
        ) : (
          renderResults()
        )}
      </AnimatePresence>

      {/* Submitting overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-12 h-12 rounded-full border-4 border-brand-red border-t-transparent mx-auto"
              />
              <p className="mt-4 text-foreground font-medium">Submitting quiz...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
