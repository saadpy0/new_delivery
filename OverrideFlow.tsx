import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { blockingService, type BlockMode, type BlockType } from './BlockingService';

// ── Types ──

type OverrideStep =
  | 'opportunity'
  | 'intent'
  | 'alternativePrimary'
  | 'confirm'
  | 'cooldown'
  | 'missout'
  | 'unlock';

type OverrideFlowProps = {
  /** Current runtime block type */
  blockType: BlockType;
  /** User's blocking mode */
  mode: BlockMode;
  /** Cooldown duration in minutes */
  cooldownMinutes: number;
  /** Penalty amount if enabled, null if disabled */
  penaltyAmount: number | null;
  /** Current total spend */
  totalSpend: number;
  /** Weekly budget */
  weeklyBudget: number;
  /** Saved onboarding financial goals */
  savingsGoals: string[];
  /** Called when user accepts the healthier alternative */
  onChooseHealthyOption: (alternativeTitle: string) => void;
  /** Called when override is complete — apps are unblocked */
  onComplete: () => void;
  /** Called when user cancels the override */
  onCancel: () => void;
};

type OverrideTheme = {
  pageBg: string;
  headerText: string;
  headerSubText: string;
  progressTrack: string;
  progressFill: string;
  cardBg: string;
  cardBorder: string;
  softCardBg: string;
  softCardBorder: string;
  titleText: string;
  bodyText: string;
  mutedText: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  primaryButtonBg: string;
  primaryButtonText: string;
  dangerButtonBg: string;
  dangerButtonText: string;
  secondaryButtonBg: string;
  secondaryButtonBorder: string;
  secondaryButtonText: string;
  unlockButtonBg: string;
  unlockButtonText: string;
};

const OVERRIDE_THEMES: Record<BlockMode, OverrideTheme> = {
  gentle: {
    pageBg: '#120605',
    headerText: '#FFEDEA',
    headerSubText: '#D38E82',
    progressTrack: '#3E1A14',
    progressFill: '#E85A39',
    cardBg: '#2B120E',
    cardBorder: '#6A2D21',
    softCardBg: '#351710',
    softCardBorder: '#7D3428',
    titleText: '#FFF2EE',
    bodyText: '#E9B6A9',
    mutedText: '#C9897C',
    inputBg: '#1F0E0A',
    inputBorder: '#5B281E',
    inputText: '#FFF5F2',
    primaryButtonBg: '#E85A39',
    primaryButtonText: '#FFFFFF',
    dangerButtonBg: '#B83C28',
    dangerButtonText: '#FFFFFF',
    secondaryButtonBg: '#21100D',
    secondaryButtonBorder: '#5B281E',
    secondaryButtonText: '#F9B9A9',
    unlockButtonBg: '#F06947',
    unlockButtonText: '#FFFFFF',
  },
  moderate: {
    pageBg: '#060B1A',
    headerText: '#EEF2FF',
    headerSubText: '#8DA7DD',
    progressTrack: '#1A2A56',
    progressFill: '#4A6EFF',
    cardBg: '#142346',
    cardBorder: '#2A478E',
    softCardBg: '#1A2E5A',
    softCardBorder: '#3556A8',
    titleText: '#F2F6FF',
    bodyText: '#B9C9EE',
    mutedText: '#8FA5D6',
    inputBg: '#111E3E',
    inputBorder: '#34539D',
    inputText: '#EEF2FF',
    primaryButtonBg: '#3A5EFF',
    primaryButtonText: '#FFFFFF',
    dangerButtonBg: '#2448E5',
    dangerButtonText: '#FFFFFF',
    secondaryButtonBg: '#0F1D3C',
    secondaryButtonBorder: '#34539D',
    secondaryButtonText: '#AFC4FF',
    unlockButtonBg: '#5A7BFF',
    unlockButtonText: '#FFFFFF',
  },
  precautionary: {
    pageBg: '#051114',
    headerText: '#E8FEFF',
    headerSubText: '#6AB8C3',
    progressTrack: '#12404A',
    progressFill: '#1FA9B6',
    cardBg: '#103038',
    cardBorder: '#1F5F6E',
    softCardBg: '#143944',
    softCardBorder: '#287988',
    titleText: '#E8FEFF',
    bodyText: '#A8DDE3',
    mutedText: '#74B8C2',
    inputBg: '#0D2A32',
    inputBorder: '#226472',
    inputText: '#E8FEFF',
    primaryButtonBg: '#1A8A94',
    primaryButtonText: '#FFFFFF',
    dangerButtonBg: '#157680',
    dangerButtonText: '#FFFFFF',
    secondaryButtonBg: '#0E2A31',
    secondaryButtonBorder: '#226472',
    secondaryButtonText: '#8BD2DA',
    unlockButtonBg: '#22A3AF',
    unlockButtonText: '#FFFFFF',
  },
};

const HEALTHY_FALLBACKS = [
  {
    title: 'Egg + veggie scramble wrap',
    cost: 6,
    note: 'High protein, under 15 minutes, and usually half the delivery price.',
  },
  {
    title: 'Greek yogurt bowl + fruit + nuts',
    cost: 5,
    note: 'Fast, satisfying, and way cheaper than a single delivery meal.',
  },
  {
    title: 'One-pan chicken and rice bowl',
    cost: 7,
    note: 'Balanced and filling with leftovers for tomorrow.',
  },
];

const COMMON_ORDER_ALTERNATIVES: Array<{ order: string; healthy: string; cost: number }> = [
  { order: 'pizza', healthy: 'Whole-wheat pita pizza with veggie toppings', cost: 8 },
  { order: 'pepperoni pizza', healthy: 'Turkey pepperoni thin-crust flatbread + side salad', cost: 9 },
  { order: 'sausage pizza', healthy: 'Chicken sausage flatbread with peppers', cost: 9 },
  { order: 'burger', healthy: 'Lean turkey burger bowl with roasted potatoes', cost: 8 },
  { order: 'chicken sandwich', healthy: 'Grilled chicken sandwich on whole grain bread', cost: 7 },
  { order: 'fries', healthy: 'Air-fried potato wedges + yogurt dip', cost: 6 },
  { order: 'loaded fries', healthy: 'Baked potato wedges with salsa + Greek yogurt', cost: 7 },
  { order: 'fried chicken', healthy: 'Oven-baked crispy chicken tenders + slaw', cost: 8 },
  { order: 'chicken nuggets', healthy: 'Baked chicken bites + hummus dip', cost: 7 },
  { order: 'wings', healthy: 'Air-fried wings + crunchy cucumber salad', cost: 8 },
  { order: 'biryani', healthy: 'Spiced brown rice bowl with chicken and raita', cost: 8 },
  { order: 'pasta', healthy: 'High-protein pasta with tomato basil sauce', cost: 7 },
  { order: 'alfredo', healthy: 'Whole-wheat penne with light cauliflower Alfredo', cost: 8 },
  { order: 'carbonara', healthy: 'Whole-wheat spaghetti with egg + mushroom sauce', cost: 8 },
  { order: 'spaghetti bolognese', healthy: 'Lean turkey bolognese over whole-wheat spaghetti', cost: 8 },
  { order: 'lasagna', healthy: 'Zucchini lasagna bake with lean mince', cost: 9 },
  { order: 'mac and cheese', healthy: 'Protein mac with light cheddar and broccoli', cost: 7 },
  { order: 'gnocchi', healthy: 'Potato gnocchi with spinach tomato sauce', cost: 8 },
  { order: 'ramen', healthy: 'Miso noodle soup with eggs and greens', cost: 7 },
  { order: 'noodles', healthy: 'Stir-fried soba noodles with vegetables', cost: 7 },
  { order: 'udon', healthy: 'Veggie udon broth bowl with tofu', cost: 8 },
  { order: 'soba', healthy: 'Cold soba salad with edamame and sesame', cost: 7 },
  { order: 'yakisoba', healthy: 'Light yakisoba with chicken and mixed vegetables', cost: 8 },
  { order: 'pad thai', healthy: 'Lighter tamarind rice noodles with tofu', cost: 8 },
  { order: 'fried rice', healthy: 'Brown rice stir-fry with eggs and veggies', cost: 7 },
  { order: 'kimchi fried rice', healthy: 'Kimchi quinoa fried rice with egg', cost: 8 },
  { order: 'sushi', healthy: 'Salmon cucumber sushi bowl', cost: 9 },
  { order: 'poke', healthy: 'Tuna poke bowl with mixed greens and brown rice', cost: 9 },
  { order: 'tempura', healthy: 'Grilled fish rice bowl with crunchy veggie slaw', cost: 9 },
  { order: 'teriyaki', healthy: 'Chicken teriyaki bowl with extra greens', cost: 8 },
  { order: 'donburi', healthy: 'Chicken donburi with steamed vegetables', cost: 8 },
  { order: 'tacos', healthy: 'Grilled fish tacos on corn tortillas', cost: 8 },
  { order: 'burrito', healthy: 'Burrito bowl with beans, salsa, and lettuce', cost: 8 },
  { order: 'quesadilla', healthy: 'Whole-wheat quesadilla with black beans and peppers', cost: 7 },
  { order: 'nachos', healthy: 'Baked nacho tray with beans and pico de gallo', cost: 7 },
  { order: 'shawarma', healthy: 'Chicken shawarma salad bowl with tahini', cost: 8 },
  { order: 'kebab', healthy: 'Grilled kebab plate with tabbouleh', cost: 9 },
  { order: 'gyro', healthy: 'Chicken gyro wrap with yogurt sauce', cost: 8 },
  { order: 'falafel', healthy: 'Baked falafel bowl with cucumber salad', cost: 7 },
  { order: 'hummus', healthy: 'Hummus plate with grilled veggies and pita', cost: 6 },
  { order: 'steak', healthy: 'Sirloin steak plate with roasted vegetables', cost: 10 },
  { order: 'bbq', healthy: 'Grilled BBQ chicken with corn and salad', cost: 9 },
  { order: 'ribs', healthy: 'BBQ chicken drumsticks with slaw', cost: 9 },
  { order: 'hot dog', healthy: 'Chicken sausage in whole-wheat bun + side salad', cost: 7 },
  { order: 'sandwich', healthy: 'Turkey avocado sandwich + carrot sticks', cost: 7 },
  { order: 'sub', healthy: 'Whole-grain sub with lean chicken and extra veggies', cost: 8 },
  { order: 'wrap', healthy: 'Grilled chicken wrap with greens and hummus', cost: 7 },
  { order: 'club sandwich', healthy: 'Turkey club on whole grain + fruit', cost: 8 },
  { order: 'meatballs', healthy: 'Turkey meatballs over zucchini noodles', cost: 8 },
  { order: 'meatloaf', healthy: 'Lean meatloaf with mashed cauliflower', cost: 8 },
  { order: 'sloppy joe', healthy: 'Lean turkey sloppy joe on whole-grain bun', cost: 7 },
  { order: 'fish and chips', healthy: 'Baked fish with roasted potato wedges', cost: 9 },
  { order: 'fried shrimp', healthy: 'Grilled shrimp rice bowl with vegetables', cost: 9 },
  { order: 'calzone', healthy: 'Stuffed whole-wheat pita with ricotta and spinach', cost: 8 },
  { order: 'stromboli', healthy: 'Veggie and chicken flatbread roll-up', cost: 8 },
  { order: 'pho', healthy: 'Lean beef pho-style broth with extra herbs', cost: 8 },
  { order: 'curry', healthy: 'Light coconut curry with tofu and vegetables', cost: 8 },
  { order: 'butter chicken', healthy: 'Yogurt-marinated chicken in light tomato gravy', cost: 9 },
  { order: 'tikka masala', healthy: 'Grilled tikka chicken with tomato masala', cost: 9 },
  { order: 'chow mein', healthy: 'Stir-fried whole-wheat noodles with veggies', cost: 8 },
  { order: 'manchurian', healthy: 'Baked veggie balls in garlic-soy sauce', cost: 7 },
  { order: 'paneer tikka', healthy: 'Grilled paneer tikka with cucumber salad', cost: 8 },
  { order: 'chole bhature', healthy: 'Chickpea curry with whole-wheat roti', cost: 7 },
  { order: 'samosa', healthy: 'Baked samosa pockets + mint yogurt dip', cost: 6 },
  { order: 'dosa', healthy: 'Masala dosa with extra sambar and less oil', cost: 7 },
  { order: 'idli', healthy: 'Idli + protein-rich sambar bowl', cost: 6 },
  { order: 'poha', healthy: 'Veggie poha with peanuts and boiled egg', cost: 6 },
  { order: 'paratha', healthy: 'Whole-wheat stuffed paratha + yogurt', cost: 7 },
  { order: 'aloo paratha', healthy: 'Mixed-veg paratha with curd', cost: 7 },
  { order: 'chaat', healthy: 'Protein chaat with chickpeas and sprouts', cost: 6 },
  { order: 'pav bhaji', healthy: 'Lighter bhaji with whole-wheat pav', cost: 7 },
  { order: 'vada pav', healthy: 'Baked potato patty slider + salad', cost: 6 },
  { order: 'dumplings', healthy: 'Steamed chicken dumplings + veggie broth', cost: 8 },
  { order: 'momo', healthy: 'Steamed momo with clear soup', cost: 8 },
  { order: 'spring rolls', healthy: 'Fresh rice-paper rolls with peanut dip', cost: 7 },
  { order: 'egg roll', healthy: 'Baked egg roll wrap with cabbage filling', cost: 7 },
  { order: 'katsu curry', healthy: 'Baked chicken cutlet with light curry sauce', cost: 9 },
  { order: 'satay', healthy: 'Grilled satay skewers + cucumber salad', cost: 8 },
  { order: 'laksa', healthy: 'Lighter laksa soup with tofu and greens', cost: 8 },
  { order: 'banh mi', healthy: 'Whole-grain banh mi with grilled chicken', cost: 8 },
  { order: 'paella', healthy: 'Seafood rice skillet with olive oil control', cost: 10 },
  { order: 'risotto', healthy: 'Mushroom barley risotto', cost: 8 },
  { order: 'pot pie', healthy: 'Chicken veggie stew with baked whole-grain topper', cost: 8 },
  { order: 'chicken tikka roll', healthy: 'Whole-wheat chicken tikka roll + salad', cost: 8 },
  { order: 'bagel', healthy: 'Whole-grain bagel with eggs and avocado', cost: 7 },
  { order: 'pancakes', healthy: 'Oat-banana pancakes with berries', cost: 6 },
  { order: 'waffles', healthy: 'Whole-wheat waffles with Greek yogurt', cost: 6 },
  { order: 'french toast', healthy: 'Protein French toast with fruit', cost: 6 },
  { order: 'milkshake', healthy: 'Protein smoothie with banana and peanut butter', cost: 5 },
  { order: 'ice cream', healthy: 'Greek yogurt parfait with berries', cost: 5 },
  { order: 'brownie', healthy: 'Dark chocolate oat mug cake', cost: 4 },
  { order: 'cookie dough', healthy: 'Peanut butter oat energy bites', cost: 4 },
  { order: 'donut', healthy: 'Baked banana oat donut', cost: 4 },
  { order: 'croissant', healthy: 'Whole-grain toast with eggs and fruit', cost: 5 },
  { order: 'muffin', healthy: 'Homemade oat muffin + yogurt', cost: 4 },
  { order: 'cheesecake', healthy: 'No-bake yogurt cheesecake cup', cost: 5 },
  { order: 'chili cheese fries', healthy: 'Bean chili over baked potato wedges', cost: 7 },
  { order: 'chicken parm', healthy: 'Baked chicken parm over zucchini noodles', cost: 9 },
  { order: 'bibimbap', healthy: 'Bibimbap bowl with lean protein and brown rice', cost: 9 },
  { order: 'hotpot', healthy: 'Broth hotpot with tofu and mushrooms', cost: 9 },
  { order: 'bao', healthy: 'Steamed bao with lean filling and veggie side', cost: 8 },
  { order: 'lobster roll', healthy: 'Shrimp-avocado roll on whole-grain bun', cost: 10 },
  { order: 'churros', healthy: 'Baked cinnamon tortilla chips with yogurt dip', cost: 5 },
  { order: 'fried calamari', healthy: 'Grilled calamari with lemon salad', cost: 9 },
  { order: 'saag', healthy: 'Saag paneer with low-oil prep + roti', cost: 8 },
  { order: 'kulcha', healthy: 'Whole-wheat kulcha with chickpea curry', cost: 7 },
  { order: 'tandoori', healthy: 'Tandoori chicken with salad and mint dip', cost: 9 },
  { order: 'pulao', healthy: 'Veg pulao with added lentils and yogurt', cost: 7 },
];

function pickHealthyAlternative(orderText: string, variant: 'primary' | 'secondary') {
  const t = orderText.toLowerCase();

  const mapped = COMMON_ORDER_ALTERNATIVES.find((item) => t.includes(item.order));
  if (mapped) {
    if (variant === 'primary') {
      return {
        title: mapped.healthy,
        cost: mapped.cost,
        note: `Similar craving profile to ${mapped.order}, but lighter and much healthier.`,
      };
    }
    return {
      title: `${mapped.healthy} + side salad`,
      cost: Math.max(4, mapped.cost - 1),
      note: `Second healthy route if you still want the ${mapped.order} vibe.`,
    };
  }

  if (t.includes('pizza')) {
    return variant === 'primary'
      ? { title: 'Pita pizza with veggies + mozzarella', cost: 8, note: 'Pizza vibes, less grease, about 40–60% cheaper.' }
      : { title: 'Tomato basil grilled sandwich + side salad', cost: 6, note: 'Crunch + comfort, much lighter than takeout pizza.' };
  }
  if (t.includes('burger')) {
    return variant === 'primary'
      ? { title: 'Lean turkey burger bowl', cost: 7, note: 'Same flavor profile, less sodium and less spend.' }
      : { title: 'Chicken avocado sandwich at home', cost: 6, note: 'Protein-rich and still gives that handheld comfort meal feel.' };
  }
  if (t.includes('fried') || t.includes('fries')) {
    return variant === 'primary'
      ? { title: 'Air-fried potato wedges + grilled protein', cost: 6, note: 'You keep the crunch without deep-fried calories.' }
      : { title: 'Oven-roasted sweet potato bowl', cost: 6, note: 'Lower cost, more fiber, and keeps you full longer.' };
  }
  if (t.includes('biryani') || t.includes('rice')) {
    return variant === 'primary'
      ? { title: 'Quick spiced rice + eggs + cucumber raita', cost: 7, note: 'Very similar comfort profile with better portion control.' }
      : { title: 'Brown rice bowl with chickpeas and yogurt', cost: 6, note: 'Budget-friendly and more nutrient dense.' };
  }

  return variant === 'primary' ? HEALTHY_FALLBACKS[0] : HEALTHY_FALLBACKS[1];
}

type GoalProfile = {
  key: 'emergency' | 'debt' | 'travel' | 'purchase' | 'invest' | 'custom';
  title: string;
  icon: string;
};

const GOAL_PROFILES: GoalProfile[] = [
  { key: 'emergency', title: 'Build emergency savings', icon: '🛟' },
  { key: 'debt', title: 'Pay off debt', icon: '💳' },
  { key: 'travel', title: 'Travel fund', icon: '✈️' },
  { key: 'purchase', title: 'Buy something meaningful', icon: '🎁' },
  { key: 'invest', title: 'Invest for the future', icon: '📈' },
];

const DEFAULT_GOAL_PROFILE: GoalProfile = {
  key: 'custom',
  title: 'Your financial goals',
  icon: '🎯',
};

function normalizeGoalToProfile(goal: string): GoalProfile {
  const normalized = goal.trim().toLowerCase();
  if (normalized.includes('emergency') || normalized.includes('emergen') || normalized.includes('safety fund')) return GOAL_PROFILES[0];
  if (normalized.includes('debt')) return GOAL_PROFILES[1];
  if (normalized.includes('travel') || normalized.includes('trip') || normalized.includes('vacation')) return GOAL_PROFILES[2];
  if (normalized.includes('buy') || normalized.includes('meaningful')) return GOAL_PROFILES[3];
  if (normalized.includes('invest') || normalized.includes('future') || normalized.includes('wealth')) return GOAL_PROFILES[4];
  return { ...DEFAULT_GOAL_PROFILE, title: goal.trim() || DEFAULT_GOAL_PROFILE.title };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function pluralize(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildGoalLossLine(
  profile: GoalProfile,
  impactAmount: number,
  mode: BlockMode,
): string {
  const roundedImpact = Math.max(1, Math.round(impactAmount));
  const modeLead = mode === 'gentle' ? 'This order will' : mode === 'moderate' ? 'This order can' : 'This order may';

  if (profile.key === 'travel') {
    const weeksDelayed = Math.max(1, Math.ceil(impactAmount / 40));
    if (weeksDelayed >= 8) {
      const monthsDelayed = Math.max(1, Math.ceil(weeksDelayed / 4));
      return `${profile.icon} ${modeLead} delay your trip goal by about ${pluralize(monthsDelayed, 'month', 'months')}.`;
    }
    return `${profile.icon} ${modeLead} delay your trip goal by about ${pluralize(weeksDelayed, 'week', 'weeks')}.`;
  }

  if (profile.key === 'emergency') {
    const daysOfSafetyLost = Math.max(1, Math.ceil(impactAmount / 10));
    return `${profile.icon} ${modeLead} wipe out about ${pluralize(daysOfSafetyLost, 'day', 'days')} of emergency cushion.`;
  }

  if (profile.key === 'debt') {
    const monthsDelayed = Math.max(1, Math.ceil(impactAmount / 55));
    return `${profile.icon} ${modeLead} keep about $${roundedImpact} on your debt and delay payoff by around ${pluralize(monthsDelayed, 'month', 'months')}.`;
  }

  if (profile.key === 'purchase') {
    const weeksDelayed = Math.max(1, Math.ceil(impactAmount / 35));
    return `${profile.icon} ${modeLead} push back that important purchase by around ${pluralize(weeksDelayed, 'week', 'weeks')}.`;
  }

  if (profile.key === 'invest') {
    const monthsDelayed = Math.max(1, Math.ceil(impactAmount / 60));
    return `${profile.icon} ${modeLead} take about $${roundedImpact} away from wealth-building and set your investing goal back by about ${pluralize(monthsDelayed, 'month', 'months')}.`;
  }

  return `${profile.icon} ${modeLead} pull about $${roundedImpact} away from ${profile.title.toLowerCase()} right now.`;
}

export default function OverrideFlow({
  blockType,
  mode,
  cooldownMinutes,
  penaltyAmount,
  totalSpend,
  weeklyBudget,
  savingsGoals,
  onChooseHealthyOption,
  onComplete,
  onCancel,
}: OverrideFlowProps) {
  const theme = OVERRIDE_THEMES[mode];
  const overrideSeedRef = useRef(Math.random());
  const [step, setStep] = useState<OverrideStep>('opportunity');
  const [plannedOrder, setPlannedOrder] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(cooldownMinutes * 60);
  const [cooldownEndsAt, setCooldownEndsAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const overBudgetAmount = Math.max(totalSpend - weeklyBudget, 0);
  const isBudgetBlock = blockType === 'budget';
  const normalizedOrder = plannedOrder.trim();

  const opportunityInsight = useMemo(() => {
    const seed = overrideSeedRef.current;
    const modeImpactMultiplier = mode === 'gentle' ? 1.2 : mode === 'moderate' ? 1 : 0.72;

    const variabilityRange = mode === 'gentle' ? 0.35 : mode === 'moderate' ? 0.22 : 0.14;
    const variabilityFactor = 1 + (seed - 0.5) * 2 * variabilityRange;
    const baseEstimate = clamp(weeklyBudget * (0.12 + seed * 0.14), 11, 42);
    const pressureAmount = overBudgetAmount > 0 ? clamp(overBudgetAmount * 0.2, 2, 12) : 0;
    const projectedOrderCost = Number((baseEstimate * variabilityFactor + pressureAmount).toFixed(2));
    const projectedOverBudget = Math.max(totalSpend + projectedOrderCost - weeklyBudget, 0);
    const remainingAfterOrder = Math.max(weeklyBudget - (totalSpend + projectedOrderCost), 0);
    const budgetUsagePercent = Math.round((projectedOrderCost / Math.max(weeklyBudget, 1)) * 100);

    const profiles = (savingsGoals.length > 0 ? savingsGoals : [DEFAULT_GOAL_PROFILE.title]).map(normalizeGoalToProfile);
    const primaryProfile = profiles[Math.floor(seed * profiles.length)] ?? DEFAULT_GOAL_PROFILE;
    const secondaryProfile = profiles.length > 1
      ? profiles[(Math.floor(seed * profiles.length) + 1) % profiles.length]
      : null;

    const primaryImpactAmount = Number((projectedOrderCost * modeImpactMultiplier).toFixed(2));
    const secondaryImpactAmount = secondaryProfile
      ? Number((projectedOrderCost * (modeImpactMultiplier * 0.8)).toFixed(2))
      : 0;
    const primaryImpactLine = buildGoalLossLine(primaryProfile, primaryImpactAmount, mode);
    const secondaryImpactLine = secondaryProfile
      ? buildGoalLossLine(secondaryProfile, secondaryImpactAmount, mode)
      : null;

    const intros = mode === 'precautionary'
      ? [
        'Even in Preventive mode, this still takes money away from your goals.',
        'This one order still slows down what you said matters to you.',
      ]
      : [
        'This order directly takes money from the goals you picked.',
        'If you override now, your goal timeline gets pushed back.',
        'This is the tradeoff: short-term craving vs long-term goals.',
      ];
    const intro = intros[Math.floor(seed * intros.length)] ?? intros[0];
    const likelyRepeatsThisWeek = mode === 'gentle' ? 3 : mode === 'moderate' ? 2 : 1;
    const repeatLeakWeekly = Number((projectedOrderCost * likelyRepeatsThisWeek).toFixed(2));
    const repeatLeakMonthly = Number((repeatLeakWeekly * 4.3).toFixed(2));
    const spendingImpactLine = likelyRepeatsThisWeek > 1
      ? `💸 One override is about $${projectedOrderCost.toFixed(2)}. If this happens ${likelyRepeatsThisWeek} times this week, that's about $${repeatLeakWeekly.toFixed(2)} this week (~$${repeatLeakMonthly.toFixed(2)}/month) pulled away from your goals.`
      : `💸 This one override is about $${projectedOrderCost.toFixed(2)} — still money directly taken from your goals this week.`;

    return {
      projectedOrderCost,
      projectedOverBudget,
      remainingAfterOrder,
      budgetUsagePercent,
      intro,
      primaryImpactLine,
      secondaryImpactLine,
      spendingImpactLine,
    };
  }, [mode, overBudgetAmount, savingsGoals, totalSpend, weeklyBudget]);

  const primaryAlt = useMemo(
    () => pickHealthyAlternative(normalizedOrder || 'delivery food', 'primary'),
    [normalizedOrder],
  );

  // ── Determine steps for this flow ──
  const getSteps = useCallback((): OverrideStep[] => {
    if (blockType === 'precau') {
      return ['opportunity', 'intent', 'alternativePrimary', 'unlock'];
    }
    if (mode === 'gentle') {
      // Requested flow:
      // opportunity → intent → alternative → confirm → cooldown → missout → unlock
      return [
        'opportunity',
        'intent',
        'alternativePrimary',
        'confirm',
        'cooldown',
        'missout',
        'unlock',
      ];
    }
    // Requested moderate flow:
    // opportunity → cooldown → intent → alternative → confirm → unlock
    return ['opportunity', 'cooldown', 'intent', 'alternativePrimary', 'confirm', 'unlock'];
  }, [blockType, mode]);

  const steps = getSteps();

  const goNext = useCallback(() => {
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      setStep(nextStep);
      if (nextStep === 'cooldown') {
        const endAt = Date.now() + cooldownMinutes * 60 * 1000;
        setCooldownEndsAt(endAt);
        setSecondsLeft(cooldownMinutes * 60);
      }
    }
  }, [step, steps, cooldownMinutes]);

  // ── Cooldown timer ──
  useEffect(() => {
    if (step !== 'cooldown') {
      return undefined;
    }

    if (!cooldownEndsAt) {
      const endAt = Date.now() + cooldownMinutes * 60 * 1000;
      setCooldownEndsAt(endAt);
      setSecondsLeft(cooldownMinutes * 60);
      return undefined;
    }

    const syncRemaining = () => {
      const remaining = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    syncRemaining();
    timerRef.current = setInterval(syncRemaining, 1000);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncRemaining();
      }
    });

    return () => {
      appStateSub.remove();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [step, cooldownEndsAt, cooldownMinutes]);

  useEffect(() => {
    if (step !== 'cooldown') {
      setCooldownEndsAt(null);
    }
    return undefined;
  }, [step]);

  // ── Complete override ──
  const handleComplete = useCallback(async () => {
    await blockingService.completeOverride();
    onComplete();
  }, [onComplete]);

  // ── Format time ──
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Render steps ──

  const renderOpportunity = () => (
    <View style={[styles.stepContainer, styles.opportunityStepContainer]}>
      <Text style={[styles.stepTitle, { color: theme.titleText }]}>Before you override...</Text>
      <Text style={[styles.stepSubtitle, styles.opportunityStepSubtitle, { color: theme.mutedText }]}>Consider what this costs you</Text>

      <View style={[styles.goalImpactCard, { backgroundColor: theme.softCardBg, borderColor: theme.softCardBorder }]}> 
        <Text style={[styles.impactTitle, { color: theme.titleText }]}>How this order hurts your goals</Text>
        <Text style={[styles.goalImpactIntro, { color: theme.bodyText }]}>{opportunityInsight.intro}</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>{opportunityInsight.primaryImpactLine}</Text>
        {opportunityInsight.secondaryImpactLine ? (
          <Text style={[styles.impactItem, { color: theme.bodyText }]}> 
            {opportunityInsight.secondaryImpactLine}
          </Text>
        ) : null}
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>{opportunityInsight.spendingImpactLine}</Text>
        {penaltyAmount ? <Text style={[styles.impactItem, { color: theme.bodyText }]}>🫙 ${penaltyAmount} also gets added to your guilt jar.</Text> : null}
      </View>

      <View style={[styles.costCardCompact, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}> 
        <Text style={[styles.costLabel, { color: theme.mutedText }]}>You've spent this week</Text>
        <Text style={[styles.costValueCompact, { color: theme.titleText }]}>${totalSpend.toFixed(2)}</Text>
        <Text style={[styles.costLabel, { color: theme.mutedText }]}>Weekly budget</Text>
        <Text style={[styles.costValueCompact, { color: theme.titleText }]}>${weeklyBudget.toFixed(2)}</Text>
        {isBudgetBlock && overBudgetAmount > 0 ? (
          <Text style={styles.costValueRedCompact}>If you place this order, you'll be over budget by ${opportunityInsight.projectedOverBudget.toFixed(2)}.</Text>
        ) : (
          <Text style={[styles.costLabelCompact, { color: theme.mutedText }]}>Remaining after this order: ${opportunityInsight.remainingAfterOrder.toFixed(2)}</Text>
        )}
      </View>

      <Pressable style={[styles.continueButton, { backgroundColor: theme.primaryButtonBg }]} onPress={goNext}>
        <Text style={[styles.continueButtonText, { color: theme.primaryButtonText }]}>Continue →</Text>
      </Pressable>

      <Pressable style={[styles.cancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={onCancel}>
        <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>Keep apps blocked</Text>
      </Pressable>
    </View>
  );

  const renderIntent = () => {
    const canContinue = normalizedOrder.length > 1;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>🧾</Text>
        <Text style={[styles.stepTitle, { color: theme.titleText }]}>What are you planning to order?</Text>
        <Text style={[styles.stepSubtitle, { color: theme.mutedText }]}>
          Tell us your craving so we can suggest a healthier, cheaper option.
        </Text>

        <View style={[styles.inputCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.inputLabel, { color: theme.mutedText }]}>Planned order</Text>
          <TextInput
            style={[styles.phraseInput, { borderColor: theme.inputBorder, backgroundColor: theme.inputBg, color: theme.inputText }]}
            value={plannedOrder}
            onChangeText={setPlannedOrder}
            placeholder="e.g. burger combo, pasta, pizza"
            placeholderTextColor={theme.mutedText}
          />
        </View>

        <Pressable
          style={[styles.continueButton, { backgroundColor: theme.primaryButtonBg }, !canContinue && styles.buttonDisabled]}
          onPress={goNext}
          disabled={!canContinue}
        >
          <Text style={[styles.continueButtonText, { color: theme.primaryButtonText }]}>Continue →</Text>
        </Pressable>

        <Pressable style={[styles.cancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>Keep apps blocked</Text>
        </Pressable>
      </View>
    );
  };

  const renderAlternative = () => {
    const alternative = primaryAlt;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>🥗</Text>
        <Text style={[styles.stepTitle, { color: theme.titleText }]}>Cook this instead</Text>
        <Text style={[styles.stepSubtitle, { color: theme.mutedText }]}>Instead of ordering unhealthy food, consider this:</Text>

        <View style={[styles.altCard, { backgroundColor: theme.softCardBg, borderColor: theme.softCardBorder }]}>
          <Text style={[styles.altTitle, { color: theme.titleText }]}>{alternative.title}</Text>
          <Text style={[styles.altCost, { color: theme.primaryButtonBg }]}>~${alternative.cost.toFixed(2)}</Text>
          <Text style={[styles.altBody, { color: theme.bodyText }]}>{alternative.note}</Text>
        </View>

        <Pressable style={[styles.continueButton, styles.dangerContinueButton, { backgroundColor: theme.dangerButtonBg }]} onPress={goNext}>
          <Text style={[styles.continueButtonText, styles.dangerContinueButtonText, { color: theme.dangerButtonText }]}>Ignore this and order anyway</Text>
        </Pressable>

        <Pressable style={[styles.cancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={() => onChooseHealthyOption(alternative.title)}>
          <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>I will choose this healthier option</Text>
        </Pressable>
      </View>
    );
  };

  const renderConfirm = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>⚠️</Text>
      <Text style={[styles.stepTitle, { color: theme.titleText }]}>Still sure?</Text>
      <Text style={[styles.stepSubtitle, { color: theme.mutedText }]}>
        This one decision can lock you in to another week of the same loop.
      </Text>

      <View style={[styles.impactCard, { backgroundColor: theme.softCardBg, borderColor: theme.softCardBorder }]}>
        <Text style={[styles.impactTitle, { color: theme.titleText }]}>Quick reality check</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• This keeps your bad eating habit going.</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• One "just this time" often turns into multiple deliveries this week.</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• If you stop now, you prove to yourself you are in control.</Text>
      </View>

      <Pressable style={[styles.cancelButton, styles.confirmCancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={onCancel}>
        <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>I will skip delivery and stay on track</Text>
      </Pressable>

      <Pressable style={[styles.continueButton, styles.dangerContinueButton, { backgroundColor: theme.dangerButtonBg }]} onPress={goNext}>
        <Text style={[styles.continueButtonText, styles.dangerContinueButtonText, { color: theme.dangerButtonText }]}>Break my streak and continue</Text>
      </Pressable>
    </View>
  );

  const renderCooldown = () => {
    const isComplete = secondsLeft === 0;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>{isComplete ? '✅' : '⏳'}</Text>
        <Text style={[styles.stepTitle, { color: theme.titleText }]}>{isComplete ? 'Cooldown complete' : 'Cooldown period'}</Text>
        <Text style={[styles.stepSubtitle, { color: theme.mutedText }]}>
          {isComplete ? 'You can continue now.' : 'Wait before the next step.'}
        </Text>

        <View style={[styles.timerCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, borderRadius: 18 }]}>
          <Text style={[styles.timerValue, { color: theme.titleText }]}>{formatTime(secondsLeft)}</Text>
          <Text style={[styles.timerLabel, { color: theme.mutedText }]}>{isComplete ? 'Ready' : 'remaining'}</Text>
        </View>

        {!isComplete && (
          <Text style={[styles.cooldownHint, { color: theme.mutedText }]}>Use this pause to reconsider and choose a better option.</Text>
        )}

        {isComplete ? (
          <Pressable style={[styles.continueButton, styles.dangerContinueButton, { backgroundColor: theme.dangerButtonBg }]} onPress={goNext}>
            <Text style={[styles.continueButtonText, styles.dangerContinueButtonText, { color: theme.dangerButtonText }]}>I waited, but I still want to order</Text>
          </Pressable>
        ) : null}

        <Pressable style={[styles.cancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>Keep apps blocked</Text>
        </Pressable>
      </View>
    );
  };

  const renderMissout = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>🎯</Text>
      <Text style={[styles.stepTitle, { color: theme.titleText }]}>What this order costs long term</Text>
      <Text style={[styles.stepSubtitle, { color: theme.mutedText }]}>Small choices today compound into bigger outcomes.</Text>

      <View style={[styles.impactCard, { backgroundColor: theme.softCardBg, borderColor: theme.softCardBorder }]}>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• One $20 order can equal 3 simple home meals.</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• Repeat this weekly and it becomes hundreds of dollars every year.</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• Every time you give in now, saying no next time gets harder.</Text>
      </View>

      <Pressable style={[styles.continueButton, styles.dangerContinueButton, { backgroundColor: theme.dangerButtonBg }]} onPress={goNext}>
        <Text style={[styles.continueButtonText, styles.dangerContinueButtonText, { color: theme.dangerButtonText }]}>I accept the cost, let me continue</Text>
      </Pressable>

      <Pressable style={[styles.cancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={onCancel}>
        <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>Stop here and keep apps blocked</Text>
      </Pressable>
    </View>
  );

  const renderUnlock = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>🔓</Text>
      <Text style={[styles.stepTitle, { color: theme.titleText }]}>{isBudgetBlock ? 'FINAL CHANCE' : 'PAUSE BEFORE YOU UNLOCK'}</Text>
      <Text style={[styles.stepSubtitle, { color: theme.mutedText }]}>
        {isBudgetBlock
          ? 'You are about to break your promise and go over budget again.'
          : 'The more you save, the faster you reach your goals. You can still choose better right now.'}
      </Text>

      <View style={[styles.impactCard, { backgroundColor: theme.softCardBg, borderColor: theme.softCardBorder }]}>
        <Text style={[styles.impactTitle, { color: theme.titleText }]}>{isBudgetBlock ? 'Last chance' : 'Before you unlock'}</Text>
        <Text style={[styles.impactItem, { color: theme.bodyText }]}>• You can still back out and choose the healthier option.</Text>
        {isBudgetBlock && penaltyAmount ? <Text style={[styles.impactItem, { color: theme.bodyText }]}>• ${penaltyAmount} will be added to your guilt jar.</Text> : null}
      </View>

      <Pressable style={[styles.overrideButton, { backgroundColor: theme.unlockButtonBg }]} onPress={handleComplete}>
        <Text style={[styles.overrideButtonText, { color: theme.unlockButtonText }]}>Unlock apps now</Text>
      </Pressable>

      <Pressable style={[styles.cancelButton, { backgroundColor: theme.secondaryButtonBg, borderColor: theme.secondaryButtonBorder }]} onPress={onCancel}>
        <Text style={[styles.cancelButtonText, { color: theme.secondaryButtonText }]}>Keep apps blocked</Text>
      </Pressable>
    </View>
  );

  // ── Step indicator ──
  const currentStepIndex = steps.indexOf(step);
  const totalSteps = steps.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.pageBg }]}>
      <View style={[styles.header, { borderBottomColor: theme.cardBorder, borderBottomWidth: 1 }] }>
        <Pressable onPress={onCancel}>
          <Text style={[styles.headerBack, { color: theme.headerSubText }]}>✕</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.headerText }]}> 
          {isBudgetBlock ? '🔴 Over-Budget Override' : '❄️ Preventive Override'}
        </Text>
        <Text style={[styles.headerStep, { color: theme.headerSubText }]}>
          {currentStepIndex + 1}/{totalSteps}
        </Text>
      </View>

      <View style={[styles.progressBar, { backgroundColor: theme.progressTrack }] }>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentStepIndex + 1) / totalSteps) * 100}%`, backgroundColor: theme.progressFill },
          ]}
        />
      </View>

      {step === 'opportunity' && renderOpportunity()}
      {step === 'intent' && renderIntent()}
      {step === 'alternativePrimary' && renderAlternative()}
      {step === 'confirm' && renderConfirm()}
      {step === 'cooldown' && renderCooldown()}
      {step === 'missout' && renderMissout()}
      {step === 'unlock' && renderUnlock()}
    </SafeAreaView>
  );
}

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerBack: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  headerStep: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F0F0F5',
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#4A6CF7',
    borderRadius: 2,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  opportunityStepContainer: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  stepIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  costValueCompact: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 28,
  },
  opportunityStepSubtitle: {
    marginBottom: 16,
  },

  // Opportunity cost
  goalImpactCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0E8D0',
  },
  goalImpactIntro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    fontWeight: '600',
  },
  costCard: {
    backgroundColor: '#F8F8FC',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E8F0',
  },
  costCardCompact: {
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E8E8F0',
  },
  costLabel: {
    fontSize: 13,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  costLabelCompact: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  costValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  costDivider: {
    height: 1,
    backgroundColor: '#E8E8F0',
    marginVertical: 12,
  },
  costLabelRed: {
    fontSize: 13,
    color: '#D32F2F',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  costValueRed: {
    fontSize: 28,
    fontWeight: '800',
    color: '#D32F2F',
  },
  costValueRedCompact: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#D32F2F',
    lineHeight: 18,
  },
  impactCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#F0E8D0',
  },
  impactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  impactItem: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 4,
  },

  // Intent + alternatives
  inputCard: {
    backgroundColor: '#F8F8FC',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8F0',
  },
  inputLabel: {
    fontSize: 13,
    color: '#6B6B72',
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  phraseInput: {
    borderWidth: 2,
    borderColor: '#E0E0E8',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#FAFAFA',
    marginBottom: 0,
  },
  altCard: {
    backgroundColor: '#EEF7EE',
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#CFE6CF',
  },
  altTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#144A22',
  },
  altCost: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  altBody: {
    marginTop: 8,
    fontSize: 14,
    color: '#2F4F2F',
    lineHeight: 21,
  },

  // Cooldown timer
  timerCard: {
    alignItems: 'center',
    marginBottom: 28,
    paddingVertical: 32,
  },
  timerValue: {
    fontSize: 64,
    fontWeight: '800',
    color: '#1A1A2E',
    fontVariant: ['tabular-nums'],
  },
  timerLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
    marginTop: 4,
  },
  cooldownHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 20,
  },

  // Buttons
  overrideButton: {
    backgroundColor: '#D32F2F',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  overrideButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  continueButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  dangerContinueButton: {
    backgroundColor: '#CF2F2F',
  },
  dangerContinueButtonText: {
    color: '#FFFFFF',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  confirmCancelButton: {
    marginBottom: 14,
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#F0FFF0',
    borderWidth: 1,
    borderColor: '#D0F0D0',
  },
  cancelButtonText: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 16,
  },
});
