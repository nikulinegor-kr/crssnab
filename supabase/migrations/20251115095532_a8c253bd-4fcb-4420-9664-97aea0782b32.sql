-- Create subscription plans table
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL, -- в копейках
  price_yearly INTEGER, -- в копейках, со скидкой
  features JSONB NOT NULL DEFAULT '[]',
  max_users INTEGER,
  max_requests_per_month INTEGER,
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'expired')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 days'),
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscription_plans (public read)
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans
  FOR SELECT
  USING (is_active = true);

-- RLS policies for subscriptions
CREATE POLICY "Users can view their org subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (user_has_org_access(auth.uid(), organization_id));

CREATE POLICY "Org admins can manage subscriptions"
  ON public.subscriptions
  FOR ALL
  USING (user_is_org_admin(auth.uid(), organization_id))
  WITH CHECK (user_is_org_admin(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check subscription status
CREATE OR REPLACE FUNCTION public.has_active_subscription(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions
    WHERE organization_id = _org_id
      AND (
        (status = 'trial' AND trial_ends_at > now())
        OR
        (status = 'active' AND current_period_end > now())
      )
  )
$$;

-- Function to get subscription limits
CREATE OR REPLACE FUNCTION public.get_org_subscription_limits(_org_id UUID)
RETURNS TABLE (
  max_users INTEGER,
  max_requests_per_month INTEGER,
  plan_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sp.max_users,
    sp.max_requests_per_month,
    sp.name as plan_name
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organization_id = _org_id
    AND (
      (s.status = 'trial' AND s.trial_ends_at > now())
      OR
      (s.status = 'active' AND s.current_period_end > now())
    )
  LIMIT 1
$$;

-- Insert default plans
INSERT INTO public.subscription_plans (name, slug, description, price_monthly, price_yearly, features, max_users, max_requests_per_month) VALUES
(
  'Стартовый',
  'starter',
  'Идеально для малого бизнеса',
  149000, -- 1490 рублей
  1490000, -- 14900 рублей в год
  '["До 3 пользователей", "До 50 заявок в месяц", "Базовая аналитика", "Email поддержка", "Экспорт в Excel"]'::jsonb,
  3,
  50
),
(
  'Профессиональный',
  'professional',
  'Для растущих команд',
  399000, -- 3990 рублей
  3990000, -- 39900 рублей в год
  '["До 15 пользователей", "Неограниченное количество заявок", "Расширенная аналитика", "Telegram уведомления", "Приоритетная поддержка", "Экспорт в Excel и PDF"]'::jsonb,
  15,
  NULL
),
(
  'Корпоративный',
  'enterprise',
  'Для крупных организаций',
  799000, -- 7990 рублей
  7990000, -- 79900 рублей в год
  '["Неограниченное количество пользователей", "Неограниченное количество заявок", "Все функции", "Персональный менеджер", "SLA 99.9%", "Кастомизация под ваши нужды", "API доступ"]'::jsonb,
  NULL,
  NULL
);