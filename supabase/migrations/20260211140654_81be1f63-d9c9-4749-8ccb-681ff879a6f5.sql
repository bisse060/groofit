
-- Function to sync food_logs calorie total to daily_logs
CREATE OR REPLACE FUNCTION public.sync_food_calories_to_daily_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
  target_date date;
  total_cal numeric;
BEGIN
  -- Determine user_id and date from the affected row
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
    target_date := OLD.log_date;
  ELSE
    target_user_id := NEW.user_id;
    target_date := NEW.log_date;
  END IF;

  -- Calculate total calories for that user/date
  SELECT COALESCE(SUM(calories * quantity), 0)
  INTO total_cal
  FROM public.food_logs
  WHERE user_id = target_user_id AND log_date = target_date;

  -- Upsert into daily_logs
  INSERT INTO public.daily_logs (user_id, log_date, calorie_intake)
  VALUES (target_user_id, target_date, total_cal::integer)
  ON CONFLICT (user_id, log_date)
  DO UPDATE SET calorie_intake = total_cal::integer, updated_at = now();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on insert/update/delete
CREATE TRIGGER sync_food_calories_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.food_logs
FOR EACH ROW
EXECUTE FUNCTION public.sync_food_calories_to_daily_log();
