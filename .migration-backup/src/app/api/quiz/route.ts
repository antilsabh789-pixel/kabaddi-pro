import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── Quiz Questions Bank ──────────────────────────────────────────

interface QuizQuestion {
  id: string;
  category: 'rules' | 'technique' | 'strategy';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const QUESTIONS: QuizQuestion[] = [
  // ─── Rules Questions ──────────────────────────────────────────
  { id: 'r1', category: 'rules', question: 'How many players per side are on the court in a standard kabaddi match?', options: ['5', '6', '7', '8'], correctIndex: 2, explanation: 'A standard kabaddi match has 7 players per side on the court.' },
  { id: 'r2', category: 'rules', question: 'What is the duration of each half in a standard kabaddi match?', options: ['15 minutes', '20 minutes', '25 minutes', '30 minutes'], correctIndex: 1, explanation: 'Each half in a standard kabaddi match is 20 minutes.' },
  { id: 'r3', category: 'rules', question: 'How many points does a team get for an All Out?', options: ['1', '2', '3', '4'], correctIndex: 1, explanation: 'An All Out awards 2 bonus points to the attacking team.' },
  { id: 'r4', category: 'rules', question: 'What is a Super Tackle?', options: ['A tackle by 5+ defenders', 'A tackle by 3 or fewer defenders', 'A tackle that earns 3 points', 'A tackle in the bonus area'], correctIndex: 1, explanation: 'When 3 or fewer defenders tackle a raider, it is called a Super Tackle and earns 2 points.' },
  { id: 'r5', category: 'rules', question: 'How many points does a Super Tackle earn?', options: ['1', '2', '3', '4'], correctIndex: 1, explanation: 'A Super Tackle earns 2 points for the defending team.' },
  { id: 'r6', category: 'rules', question: 'What is a Do-or-Die Raid?', options: ['The first raid of the match', 'The third consecutive empty raid', 'A raid in the last minute', 'A raid with no defenders'], correctIndex: 1, explanation: 'The third consecutive empty raid by a team is a Do-or-Die Raid — the raider must score or the team loses a point.' },
  { id: 'r7', category: 'rules', question: 'What is the minimum number of defenders required on the mat for a bonus point to be awarded?', options: ['5', '6', '7', '4'], correctIndex: 1, explanation: 'A bonus point is awarded only when 6 or more defenders are on the court.' },
  { id: 'r8', category: 'rules', question: 'What happens when a raider steps into the lobby?', options: ['Play continues', 'The raider is out', 'A point is awarded to the defense', 'The raid is replayed'], correctIndex: 1, explanation: 'If a raider steps into the lobby, the raider is declared out.' },
  { id: 'r9', category: 'rules', question: 'Can a raider be held by more than one defender simultaneously?', options: ['No, only one defender can hold', 'Yes, multiple defenders can hold', 'Only if the raider consents', 'Only in the second half'], correctIndex: 1, explanation: 'Multiple defenders can simultaneously hold and attempt to tackle a raider.' },
  { id: 'r10', category: 'rules', question: 'What is the maximum time a raider can spend in the opponent\'s half?', options: ['20 seconds', '30 seconds', 'No limit', '60 seconds'], correctIndex: 1, explanation: 'A raider has a maximum of 30 seconds to complete a raid in the opponent\'s half.' },
  { id: 'r11', category: 'rules', question: 'How is a match decided if scores are level at full time?', options: ['Golden raid', 'Extra time of 5 minutes', 'The match is a draw', 'Penalty shootouts'], correctIndex: 0, explanation: 'If scores are level, a Golden Raid is used to determine the winner.' },
  { id: 'r12', category: 'rules', question: 'What does the baulk line indicate?', options: ['The center of the court', 'The line raider must cross to score', 'The boundary of the playing area', 'The substitution zone'], correctIndex: 1, explanation: 'The baulk line is the line the raider must cross with a foot on the ground to be eligible to score points.' },
  { id: 'r13', category: 'rules', question: 'How many timeouts is each team allowed per half?', options: ['1', '2', '3', 'Unlimited'], correctIndex: 0, explanation: 'Each team is allowed 1 timeout per half in a standard kabaddi match.' },
  { id: 'r14', category: 'rules', question: 'What is the size of a standard kabaddi court?', options: ['10m × 8m', '13m × 10m', '15m × 12m', '20m × 15m'], correctIndex: 1, explanation: 'A standard kabaddi court is 13 meters × 10 meters.' },
  { id: 'r15', category: 'rules', question: 'When are defenders revived during a match?', options: ['After every raid', 'When their team scores a point', 'Only at halftime', 'After an All Out'], correctIndex: 1, explanation: 'Defenders are revived when their team scores a point through a raid.' },
  { id: 'r16', category: 'rules', question: 'What card is shown for a technical foul in kabaddi?', options: ['Yellow card', 'Green card', 'Red card', 'Blue card'], correctIndex: 1, explanation: 'A green card is shown for a technical foul in kabaddi.' },
  { id: 'r17', category: 'rules', question: 'What is the midline in kabaddi called?', options: ['Center line', 'Baulk line', 'Bonus line', 'End line'], correctIndex: 0, explanation: 'The midline that divides the court into two halves is called the center line.' },
  { id: 'r18', category: 'rules', question: 'How many substitutes are allowed in a kabaddi match?', options: ['3', '5', '7', 'No limit'], correctIndex: 1, explanation: 'Up to 5 substitutes are allowed in addition to the 7 starting players.' },

  // ─── Technique Questions ──────────────────────────────────────
  { id: 't1', category: 'technique', question: 'Which technique involves the raider touching the defender with their foot?', options: ['Hand touch', 'Toe touch', 'Back hold', 'Lob'], correctIndex: 1, explanation: 'A toe touch involves the raider extending their leg to touch a defender and quickly retreating.' },
  { id: 't2', category: 'technique', question: 'What is a "scorpion kick" in kabaddi?', options: ['A defensive hold', 'A backward kick to touch a defender', 'A type of tackle', 'A warm-up exercise'], correctIndex: 1, explanation: 'A scorpion kick is a technique where the raider kicks backward like a scorpion to touch a defender.' },
  { id: 't3', category: 'technique', question: 'What is the "ankle hold" technique used for?', options: ['Raiding', 'Defending — grabbing the raider\'s ankle', 'Warming up', 'Celebrating'], correctIndex: 1, explanation: 'An ankle hold is a defensive technique where the defender grabs the raider\'s ankle to stop them.' },
  { id: 't4', category: 'technique', question: 'What is a "frog jump" in kabaddi?', options: ['A defensive formation', 'A raider jumping over defenders with spread legs', 'A warm-up drill', 'A type of celebration'], correctIndex: 1, explanation: 'A frog jump is a technique where the raider jumps over crouching defenders with legs spread wide.' },
  { id: 't5', category: 'technique', question: 'What is a "dash" in kabaddi?', options: ['A quick raid', 'A defensive push to force the raider out', 'A running technique', 'A type of substitution'], correctIndex: 1, explanation: 'A dash is a defensive technique where the defender pushes the raider out of bounds.' },
  { id: 't6', category: 'technique', question: 'What does the "back hold" technique involve?', options: ['The raider holding a defender from behind', 'A defender holding the raider from behind', 'A type of warm-up', 'A referee signal'], correctIndex: 1, explanation: 'A back hold is a defensive technique where the defender grabs the raider from behind to prevent escape.' },
  { id: 't7', category: 'technique', question: 'What is a "running hand touch"?', options: ['A slow walk to touch', 'A raider touches a defender while running at speed', 'A type of pass', 'A defensive move'], correctIndex: 1, explanation: 'A running hand touch involves the raider sprinting and quickly touching a defender with their hand.' },
  { id: 't8', category: 'technique', question: 'What is a "chain tackle"?', options: ['One defender tackling', 'Multiple defenders forming a chain to tackle', 'A type of raid', 'A warm-up exercise'], correctIndex: 1, explanation: 'A chain tackle involves multiple defenders linking together to form a chain to tackle the raider.' },
  { id: 't9', category: 'technique', question: 'What is the "crocodile hold" in kabaddi defense?', options: ['A type of raid', 'Locking both legs of the raider', 'A referee call', 'A substitution signal'], correctIndex: 1, explanation: 'The crocodile hold involves the defender locking both legs of the raider to prevent any movement.' },
  { id: 't10', category: 'technique', question: 'What is a "lob" in kabaddi?', options: ['A defensive move', 'A raider jumping over a defender to escape', 'A type of throw', 'A scoring technique'], correctIndex: 1, explanation: 'A lob is when the raider jumps over a defender who is trying to tackle them, escaping to their side.' },
  { id: 't11', category: 'technique', question: 'What is the "thigh hold" in kabaddi?', options: ['A raider technique', 'A defender grabs the raider\'s thigh to stop them', 'A warm-up stretch', 'A type of celebration'], correctIndex: 1, explanation: 'A thigh hold involves the defender grabbing the raider\'s thigh to immobilize them.' },
  { id: 't12', category: 'technique', question: 'What is a "squat thrust" in kabaddi?', options: ['A defensive stance', 'A raider ducking low and thrusting forward to escape', 'A penalty move', 'A referee signal'], correctIndex: 1, explanation: 'A squat thrust involves the raider ducking low and thrusting forward to escape a tackle.' },
  { id: 't13', category: 'technique', question: 'What is a "kick touch" in kabaddi?', options: ['A type of tackle', 'A raider kicks to touch a defender and retreats', 'A foul', 'A warm-up drill'], correctIndex: 1, explanation: 'A kick touch involves the raider using their foot to touch a defender and quickly retreating.' },
  { id: 't14', category: 'technique', question: 'What is an "arm bar" in kabaddi defense?', options: ['A raider technique', 'A defender using their arm to lock the raider', 'A type of foul', 'A referee signal'], correctIndex: 1, explanation: 'An arm bar involves the defender using their arm to lock and control the raider\'s arm.' },
  { id: 't15', category: 'technique', question: 'What is a "hip throw" in kabaddi?', options: ['A raider throwing the ball', 'A defender using hip leverage to throw the raider', 'A type of pass', 'A warm-up exercise'], correctIndex: 1, explanation: 'A hip throw uses the defender\'s hip as leverage to throw the raider off balance.' },
  { id: 't16', category: 'technique', question: 'What is the "brace" technique in kabaddi defense?', options: ['A type of raid', 'Two defenders bracing together to stop the raider', 'A foul', 'A substitution method'], correctIndex: 1, explanation: 'The brace involves two defenders bracing together to form a wall to stop the raider.' },
  { id: 't17', category: 'technique', question: 'What is a "reverse toe touch"?', options: ['A defensive move', 'Touching a defender behind you with your toe while retreating', 'A type of tackle', 'A warm-up exercise'], correctIndex: 1, explanation: 'A reverse toe touch involves the raider touching a defender behind them with their toe while moving backward.' },
  { id: 't18', category: 'technique', question: 'What is a "diving ankle hold"?', options: ['A raider dive', 'A defender diving to grab the raider\'s ankle', 'A type of celebration', 'A foul'], correctIndex: 1, explanation: 'A diving ankle hold involves the defender diving low to grab the raider\'s ankle and prevent escape.' },

  // ─── Strategy Questions ───────────────────────────────────────
  { id: 's1', category: 'strategy', question: 'When is the best time to send your star raider?', options: ['Always first', 'When the opponent has fewer defenders on court', 'Only in the second half', 'When losing by 5+ points'], correctIndex: 1, explanation: 'Sending a star raider when the opponent has fewer defenders increases the chance of a multi-point raid or All Out.' },
  { id: 's2', category: 'strategy', question: 'What is the "left-right" raiding strategy?', options: ['Alternating raids from left and right sides', 'Using both hands to touch defenders', 'A defensive formation', 'A substitution pattern'], correctIndex: 0, explanation: 'The left-right strategy involves alternating raid approaches from both sides to keep defenders guessing.' },
  { id: 's3', category: 'strategy', question: 'Why do teams prefer to defend with 3 or fewer players sometimes?', options: ['To conserve energy', 'Super Tackle opportunity for 2 points', 'Because they have no choice', 'It\'s a rule requirement'], correctIndex: 1, explanation: 'With 3 or fewer defenders, a successful tackle becomes a Super Tackle worth 2 points — a strategic risk-reward play.' },
  { id: 's4', category: 'strategy', question: 'What is "empty raid" strategy?', options: ['Always avoid empty raids', 'Use empty raids to run down the clock when leading', 'Empty raids score extra points', 'Empty raids are not allowed'], correctIndex: 1, explanation: 'Teams leading may use empty raids strategically to consume time, though 3 consecutive empty raids trigger Do-or-Die.' },
  { id: 's5', category: 'strategy', question: 'What formation do defenders typically use against a strong raider?', options: ['Spread formation', 'Chain formation', 'Single defender', 'No formation'], correctIndex: 1, explanation: 'A chain formation allows multiple defenders to coordinate and tackle a strong raider effectively.' },
  { id: 's6', category: 'strategy', question: 'When should a team call a timeout?', options: ['Only when losing', 'To break opponent momentum or plan strategy', 'Only in the first half', 'Never, it wastes time'], correctIndex: 1, explanation: 'Timeouts are best used to break the opponent\'s momentum or to plan strategy during critical moments.' },
  { id: 's7', category: 'strategy', question: 'What is the "Do-or-Die" management strategy?', options: ['Avoid reaching Do-or-Die raids', 'Send a reliable raider in Do-or-Die situations', 'Always go for bonus in Do-or-Die', 'Ignore the Do-or-Die rule'], correctIndex: 1, explanation: 'In Do-or-Die situations, teams send their most reliable raider to ensure at least one point is scored.' },
  { id: 's8', category: 'strategy', question: 'What is the advantage of raiding from the corners?', options: ['More space to escape', 'Fewer defenders to face at once', 'Bonus points are doubled', 'No advantage'], correctIndex: 1, explanation: 'Raiding from corners typically means facing fewer defenders at once, making it easier to score.' },
  { id: 's9', category: 'strategy', question: 'What is "catching the raider" strategy?', options: ['Let the raider escape', 'Surround and hold the raider to prevent escape', 'Only block the bonus line', 'Focus on individual tackles'], correctIndex: 1, explanation: 'Catching involves surrounding the raider and using coordinated holds to prevent any escape route.' },
  { id: 's10', category: 'strategy', question: 'When is an All Out most likely to happen?', options: ['At the start of the match', 'When 6-7 defenders are out', 'Only in the second half', 'During a timeout'], correctIndex: 1, explanation: 'An All Out is most likely when most defenders are already out, leaving very few on the court.' },
  { id: 's11', category: 'strategy', question: 'What is "rotation" strategy in kabaddi?', options: ['Rotating the court', 'Rotating raiders to keep defenders fresh', 'Rotating the ball', 'A type of warm-up'], correctIndex: 1, explanation: 'Rotation involves using different raiders to keep the team fresh and the opponents guessing.' },
  { id: 's12', category: 'strategy', question: 'How should a team approach the last 5 minutes of a close match?', options: ['Attack aggressively regardless of score', 'Adjust strategy based on score — defend lead or attack deficit', 'Always go for All Out', 'Substitute all players'], correctIndex: 1, explanation: 'In the final minutes, strategy depends on the score — defending a lead or attacking to overcome a deficit.' },
  { id: 's13', category: 'strategy', question: 'What is "zone defense" in kabaddi?', options: ['Each defender covers a specific area', 'All defenders in one area', 'Only defending the bonus line', 'A type of raid'], correctIndex: 0, explanation: 'Zone defense assigns each defender a specific area of the court to cover, ensuring no gaps for the raider.' },
  { id: 's14', category: 'strategy', question: 'Why is the bonus line important strategically?', options: ['It looks nice on the court', 'It provides an easy 1-point scoring opportunity', 'It marks the substitution zone', 'It has no strategic importance'], correctIndex: 1, explanation: 'The bonus line offers a guaranteed 1 point when 6+ defenders are on court — an easy scoring opportunity.' },
];

// ─── GET: Fetch questions by category ─────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'rules';

    if (!['rules', 'technique', 'strategy'].includes(category)) {
      return NextResponse.json({ error: 'Invalid category. Use: rules, technique, strategy' }, { status: 400 });
    }

    // Filter questions by category and randomly select 10
    const categoryQuestions = QUESTIONS.filter(q => q.category === category);

    // Shuffle and take 10
    const shuffled = [...categoryQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 10);

    // Don't send correctIndex to client
    const safeQuestions = selected.map(({ correctIndex: _, ...rest }) => rest);

    return NextResponse.json({
      questions: safeQuestions,
      totalAvailable: categoryQuestions.length,
      category,
    });
  } catch (error) {
    console.error('Quiz GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Submit quiz answers ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, category, answers } = body as {
      userId: string;
      category: string;
      answers: { questionId: string; selectedIndex: number }[];
    };

    if (!userId || !category || !answers) {
      return NextResponse.json({ error: 'userId, category, and answers are required' }, { status: 400 });
    }

    // Calculate score
    let correct = 0;
    const results: { questionId: string; correct: boolean; correctIndex: number; explanation: string }[] = [];

    for (const answer of answers) {
      const question = QUESTIONS.find(q => q.id === answer.questionId);
      if (question) {
        const isCorrect = answer.selectedIndex === question.correctIndex;
        if (isCorrect) correct++;
        results.push({
          questionId: answer.questionId,
          correct: isCorrect,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
        });
      }
    }

    const xpEarned = correct * 10;

    // Store quiz attempt
    await db.quizAttempt.create({
      data: {
        userId,
        category,
        score: correct,
        totalQuestions: answers.length,
        xpEarned,
      },
    });

    return NextResponse.json({
      score: correct,
      totalQuestions: answers.length,
      xpEarned,
      results,
    });
  } catch (error) {
    console.error('Quiz POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
