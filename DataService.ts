import { supabase } from './supabaseClient';

// ── Types ──────────────────────────────────────────────────

export type Profile = {
  id: string;
  name: string | null;
  age: number | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingData = {
  user_id: string;
  quiz_answers: Record<string, string | number>;
  affirmation: string | null;
  savings_goal: string | null;
  notification_prefs: Record<string, unknown>;
  completed_at: string | null;
};

export type Budget = {
  id: string;
  user_id: string;
  weekly_limit: number;
  reset_day: number;
};

export type Order = {
  id: string;
  user_id: string;
  vendor: string;
  amount: number;
  ordered_at: string;
  notes: string | null;
  source: 'manual' | 'import';
};

export type BlockingSettingsRow = {
  user_id: string;
  enabled: boolean;
  mode: 'gentle' | 'moderate' | 'precautionary';
  super_strict: boolean;
  cooldown_gentle: number;
  cooldown_moderate: number;
  cooldown_precautionary: number;
  penalty_enabled: boolean;
  penalty_amount: number;
  selected_app_count: number;
  schedule_enabled: boolean;
  schedule_start_hour: number;
  schedule_start_min: number;
  schedule_end_hour: number;
  schedule_end_min: number;
};

export type BlockEvent = {
  id: string;
  user_id: string;
  event_type: string;
  block_mode: string | null;
  penalty_amount: number | null;
  metadata: Record<string, any>;
  created_at: string;
};

export type WeeklyStat = {
  id: string;
  user_id: string;
  week_start: string;
  total_spend: number;
  order_count: number;
  budget_limit: number | null;
  overrides_used: number;
  penalty_total: number;
  streak_days: number;
};

export type ChatHistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ChatHistoryRow = {
  user_id: string;
  messages: ChatHistoryMessage[];
  updated_at: string;
};

// ── Helpers ────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// ── Profile ────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data ?? null;
}

// ── Chat history ────────────────────────────────────────────

export async function getChatHistory(): Promise<ChatHistoryRow | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('chat_history')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function upsertChatHistory(messages: ChatHistoryMessage[]): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase
    .from('chat_history')
    .upsert(
      {
        user_id: userId,
        messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
}

export async function updateProfile(updates: Partial<Pick<Profile, 'name' | 'avatar_url' | 'age'>>): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('profiles').update(updates).eq('id', userId);
}

// ── Onboarding ─────────────────────────────────────────────

export async function saveOnboardingData(payload: {
  quiz_answers: Record<string, string | number>;
  name: string;
  age: number | null;
  savings_goal: string | null;
  weekly_budget: number;
  affirmation: string;
  selected_app_count: number;
  blocking_mode: 'gentle' | 'moderate' | 'precautionary';
}): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  // 1. Upsert profile name
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        name: payload.name.trim() || null,
        age: payload.age,
      },
      { onConflict: 'id' },
    );
  if (profileError) console.warn('Profile save error:', profileError.message);

  // 2. Upsert onboarding data
  const { error: onboardingError } = await supabase
    .from('onboarding')
    .upsert(
      {
        user_id: userId,
        quiz_answers: payload.quiz_answers,
        affirmation: payload.affirmation.trim() || null,
        savings_goal: payload.savings_goal?.trim() || null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (onboardingError) console.warn('Onboarding save error:', onboardingError.message);

  // 3. Upsert budget
  const { error: budgetError } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        weekly_limit: payload.weekly_budget,
      },
      { onConflict: 'user_id' },
    );
  if (budgetError) console.warn('Budget save error:', budgetError.message);

  // 4. Upsert blocking settings
  const { error: blockingError } = await supabase
    .from('blocking_settings')
    .upsert(
      {
        user_id: userId,
        enabled: payload.selected_app_count > 0,
        selected_app_count: payload.selected_app_count,
        mode: payload.blocking_mode,
      },
      { onConflict: 'user_id' },
    );
  if (blockingError) console.warn('Blocking settings save error:', blockingError.message);

  return !profileError && !onboardingError && !budgetError && !blockingError;
}

export async function getOnboardingData(): Promise<OnboardingData | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('onboarding')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? null;
}

// ── Budget ─────────────────────────────────────────────────

export async function getBudget(): Promise<Budget | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function updateBudget(updates: Partial<Pick<Budget, 'weekly_limit' | 'reset_day'>>): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('budgets').update(updates).eq('user_id', userId);
}

// ── Orders ─────────────────────────────────────────────────

export async function getOrders(limit = 50): Promise<Order[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('ordered_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getOrdersForWeek(weekStart: Date): Promise<Order[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .gte('ordered_at', weekStart.toISOString())
    .lt('ordered_at', weekEnd.toISOString())
    .order('ordered_at', { ascending: false });
  return data ?? [];
}

export async function addOrder(order: { vendor: string; amount: number; ordered_at?: string; notes?: string; source?: 'manual' | 'import' }): Promise<Order | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      vendor: order.vendor,
      amount: order.amount,
      ordered_at: order.ordered_at ?? new Date().toISOString(),
      notes: order.notes ?? null,
      source: order.source ?? 'manual',
    })
    .select()
    .single();
  return data ?? null;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('orders').delete().eq('id', orderId).eq('user_id', userId);
}

// ── Blocking Settings ──────────────────────────────────────

export async function getBlockingSettings(): Promise<BlockingSettingsRow | null> {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('blocking_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

export async function updateBlockingSettings(updates: Partial<Omit<BlockingSettingsRow, 'user_id'>>): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('blocking_settings').update(updates).eq('user_id', userId);
}

// ── Block Events ───────────────────────────────────────────

export async function logBlockEvent(event: {
  event_type: string;
  block_mode?: string;
  penalty_amount?: number;
  metadata?: Record<string, any>;
}): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('block_events').insert({
    user_id: userId,
    event_type: event.event_type,
    block_mode: event.block_mode ?? null,
    penalty_amount: event.penalty_amount ?? null,
    metadata: event.metadata ?? {},
  });
}

export async function getBlockEvents(limit = 50): Promise<BlockEvent[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('block_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

// ── Weekly Stats ───────────────────────────────────────────

export async function getWeeklyStats(limit = 12): Promise<WeeklyStat[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('weekly_stats')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function upsertWeeklyStat(stat: {
  week_start: string;
  total_spend: number;
  order_count: number;
  budget_limit?: number;
  overrides_used?: number;
  penalty_total?: number;
  streak_days?: number;
}): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;
  await supabase.from('weekly_stats').upsert(
    {
      user_id: userId,
      week_start: stat.week_start,
      total_spend: stat.total_spend,
      order_count: stat.order_count,
      budget_limit: stat.budget_limit ?? null,
      overrides_used: stat.overrides_used ?? 0,
      penalty_total: stat.penalty_total ?? 0,
      streak_days: stat.streak_days ?? 0,
    },
    { onConflict: 'user_id,week_start' },
  );
}

// ── Subscriptions ──────────────────────────────────────────

export async function getSubscription() {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data ?? null;
}

// ── Dashboard bootstrap ────────────────────────────────────
// Load everything the dashboard needs in one call.

export type DashboardData = {
  profile: Profile | null;
  onboarding: OnboardingData | null;
  budget: Budget | null;
  orders: Order[];
  blockingSettings: BlockingSettingsRow | null;
  weeklyStats: WeeklyStat[];
};

export async function loadDashboardData(): Promise<DashboardData> {
  const [profile, onboarding, budget, orders, blockingSettings, weeklyStats] = await Promise.all([
    getProfile(),
    getOnboardingData(),
    getBudget(),
    getOrders(100),
    getBlockingSettings(),
    getWeeklyStats(12),
  ]);
  return { profile, onboarding, budget, orders, blockingSettings, weeklyStats };
}
