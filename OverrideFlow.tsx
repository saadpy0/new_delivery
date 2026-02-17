import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
  | 'alternativeSecondary'
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
  /** Called when override is complete — apps are unblocked */
  onComplete: () => void;
  /** Called when user cancels the override */
  onCancel: () => void;
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

function pickHealthyAlternative(orderText: string, variant: 'primary' | 'secondary') {
  const t = orderText.toLowerCase();

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

export default function OverrideFlow({
  blockType,
  mode,
  cooldownMinutes,
  penaltyAmount,
  totalSpend,
  weeklyBudget,
  onComplete,
  onCancel,
}: OverrideFlowProps) {
  const [step, setStep] = useState<OverrideStep>('opportunity');
  const [plannedOrder, setPlannedOrder] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(cooldownMinutes * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const overBudget = totalSpend - weeklyBudget;
  const isBudgetBlock = blockType === 'budget';
  const normalizedOrder = plannedOrder.trim();

  const primaryAlt = useMemo(
    () => pickHealthyAlternative(normalizedOrder || 'delivery food', 'primary'),
    [normalizedOrder],
  );
  const secondaryAlt = useMemo(
    () => pickHealthyAlternative(normalizedOrder || 'delivery food', 'secondary'),
    [normalizedOrder],
  );

  // ── Determine steps for this flow ──
  const getSteps = useCallback((): OverrideStep[] => {
    if (blockType === 'precau') {
      return ['opportunity', 'unlock'];
    }
    if (mode === 'gentle') {
      // Requested flow:
      // opportunity → intent → alternative → confirm → cooldown → missout → alternative2 → unlock
      return [
        'opportunity',
        'intent',
        'alternativePrimary',
        'confirm',
        'cooldown',
        'missout',
        'alternativeSecondary',
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
        setSecondsLeft(cooldownMinutes * 60);
      }
    }
  }, [step, steps, cooldownMinutes]);

  // ── Cooldown timer ──
  useEffect(() => {
    if (step === 'cooldown' && secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
    return undefined;
  }, [step, secondsLeft]);

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
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>💸</Text>
      <Text style={styles.stepTitle}>Before you override...</Text>
      <Text style={styles.stepSubtitle}>Consider what this costs you</Text>

      <View style={styles.costCard}>
        <Text style={styles.costLabel}>You've spent this week</Text>
        <Text style={styles.costValue}>${totalSpend.toFixed(2)}</Text>
        <View style={styles.costDivider} />
        <Text style={styles.costLabel}>Your weekly budget</Text>
        <Text style={styles.costValue}>${weeklyBudget.toFixed(2)}</Text>
        {isBudgetBlock && overBudget > 0 && (
          <>
            <View style={styles.costDivider} />
            <Text style={styles.costLabelRed}>Over budget by</Text>
            <Text style={styles.costValueRed}>${overBudget.toFixed(2)}</Text>
          </>
        )}
      </View>

      <View style={styles.impactCard}>
        <Text style={styles.impactTitle}>Goal impact</Text>
        <Text style={styles.impactItem}>
          🎯 Weekend trip fund delayed by ~{Math.ceil(overBudget > 0 ? overBudget / 10 : 1)} day(s)
        </Text>
        <Text style={styles.impactItem}>📉 Your consistency streak takes a hit</Text>
        {penaltyAmount && <Text style={styles.impactItem}>🫙 ${penaltyAmount} goes to your guilt jar</Text>}
      </View>

      <Pressable style={styles.continueButton} onPress={goNext}>
        <Text style={styles.continueButtonText}>Continue →</Text>
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Keep apps blocked</Text>
      </Pressable>
    </View>
  );

  const renderIntent = () => {
    const canContinue = normalizedOrder.length > 1;
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>🧾</Text>
        <Text style={styles.stepTitle}>What are you planning to order?</Text>
        <Text style={styles.stepSubtitle}>
          Tell us your craving so we can suggest a healthier, cheaper option.
        </Text>

        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>Planned order</Text>
          <TextInput
            style={styles.phraseInput}
            value={plannedOrder}
            onChangeText={setPlannedOrder}
            placeholder="e.g. burger combo, biryani, pizza"
            placeholderTextColor="#999"
          />
        </View>

        <Pressable
          style={[styles.continueButton, !canContinue && styles.buttonDisabled]}
          onPress={goNext}
          disabled={!canContinue}
        >
          <Text style={styles.continueButtonText}>Continue →</Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Keep apps blocked</Text>
        </Pressable>
      </View>
    );
  };

  const renderAlternative = (variant: 'primary' | 'secondary') => {
    const alternative = variant === 'primary' ? primaryAlt : secondaryAlt;
    const orderLabel = normalizedOrder || 'your planned delivery';

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>🥗</Text>
        <Text style={styles.stepTitle}>Try this instead</Text>
        <Text style={styles.stepSubtitle}>Instead of {orderLabel}, consider this:</Text>

        <View style={styles.altCard}>
          <Text style={styles.altTitle}>{alternative.title}</Text>
          <Text style={styles.altCost}>~${alternative.cost.toFixed(2)}</Text>
          <Text style={styles.altBody}>{alternative.note}</Text>
        </View>

        <Pressable style={styles.continueButton} onPress={goNext}>
          <Text style={styles.continueButtonText}>Continue →</Text>
        </Pressable>

        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>I will choose this healthier option</Text>
        </Pressable>
      </View>
    );
  };

  const renderConfirm = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>⚠️</Text>
      <Text style={styles.stepTitle}>Still sure?</Text>
      <Text style={styles.stepSubtitle}>
        Ordering now costs more and moves you away from your weekly goals.
      </Text>

      <View style={styles.impactCard}>
        <Text style={styles.impactTitle}>Quick reality check</Text>
        <Text style={styles.impactItem}>• This order is likely 2-3x the home option cost.</Text>
        <Text style={styles.impactItem}>• It slows your budget progress this week.</Text>
        <Text style={styles.impactItem}>• You can still pivot and win today.</Text>
      </View>

      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>I will skip delivery and stay on track</Text>
      </Pressable>

      <Pressable style={styles.continueButton} onPress={goNext}>
        <Text style={styles.continueButtonText}>I still want to continue →</Text>
      </Pressable>
    </View>
  );

  const renderCooldown = () => {
    const isComplete = secondsLeft === 0;

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepIcon}>{isComplete ? '✅' : '⏳'}</Text>
        <Text style={styles.stepTitle}>{isComplete ? 'Cooldown complete' : 'Cooldown period'}</Text>
        <Text style={styles.stepSubtitle}>
          {isComplete ? 'You can continue now.' : 'Wait before the next step.'}
        </Text>

        <View style={styles.timerCard}>
          <Text style={styles.timerValue}>{formatTime(secondsLeft)}</Text>
          <Text style={styles.timerLabel}>{isComplete ? 'Ready' : 'remaining'}</Text>
        </View>

        {!isComplete && (
          <Text style={styles.cooldownHint}>Use this pause to reconsider and choose a better option.</Text>
        )}

        {isComplete ? (
          <Pressable style={styles.continueButton} onPress={goNext}>
            <Text style={styles.continueButtonText}>Continue →</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Keep apps blocked</Text>
        </Pressable>
      </View>
    );
  };

  const renderMissout = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>🎯</Text>
      <Text style={styles.stepTitle}>What this order costs long term</Text>
      <Text style={styles.stepSubtitle}>Small choices today compound into bigger outcomes.</Text>

      <View style={styles.impactCard}>
        <Text style={styles.impactItem}>• One $20 order can equal 3 simple home meals.</Text>
        <Text style={styles.impactItem}>• Repeat this weekly and it becomes hundreds per quarter.</Text>
        <Text style={styles.impactItem}>• Your future self benefits more from consistency than convenience.</Text>
      </View>

      <Pressable style={styles.continueButton} onPress={goNext}>
        <Text style={styles.continueButtonText}>Continue →</Text>
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Stop here and keep apps blocked</Text>
      </Pressable>
    </View>
  );

  const renderUnlock = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepIcon}>🔓</Text>
      <Text style={styles.stepTitle}>Final decision</Text>
      <Text style={styles.stepSubtitle}>You are about to unlock delivery apps.</Text>

      <View style={styles.impactCard}>
        <Text style={styles.impactTitle}>Final reminder</Text>
        <Text style={styles.impactItem}>• You can still back out and choose the healthier option.</Text>
        {penaltyAmount ? <Text style={styles.impactItem}>• ${penaltyAmount} will be added to your guilt jar.</Text> : null}
      </View>

      <Pressable style={styles.overrideButton} onPress={handleComplete}>
        <Text style={styles.overrideButtonText}>Unlock apps now</Text>
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={onCancel}>
        <Text style={styles.cancelButtonText}>Keep apps blocked</Text>
      </Pressable>
    </View>
  );

  // ── Step indicator ──
  const currentStepIndex = steps.indexOf(step);
  const totalSteps = steps.length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onCancel}>
          <Text style={styles.headerBack}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {isBudgetBlock ? '🔴 Over-Budget Override' : '❄️ Precautionary Override'}
        </Text>
        <Text style={styles.headerStep}>
          {currentStepIndex + 1}/{totalSteps}
        </Text>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${((currentStepIndex + 1) / totalSteps) * 100}%` },
          ]}
        />
      </View>

      {step === 'opportunity' && renderOpportunity()}
      {step === 'intent' && renderIntent()}
      {step === 'alternativePrimary' && renderAlternative('primary')}
      {step === 'confirm' && renderConfirm()}
      {step === 'cooldown' && renderCooldown()}
      {step === 'missout' && renderMissout()}
      {step === 'alternativeSecondary' && renderAlternative('secondary')}
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
  stepIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
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

  // Opportunity cost
  costCard: {
    backgroundColor: '#F8F8FC',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
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
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
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
