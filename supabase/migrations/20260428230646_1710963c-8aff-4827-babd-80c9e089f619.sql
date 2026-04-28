DELETE FROM public.strategy_blueprints
WHERE raw_input IS NULL
  AND locked = false
  AND status = 'draft'
  AND name = 'Untitled Strategy'
  AND id NOT IN (
    SELECT DISTINCT ON (user_id) id
      FROM public.strategy_blueprints
     WHERE raw_input IS NULL
       AND locked = false
       AND status = 'draft'
       AND name = 'Untitled Strategy'
     ORDER BY user_id, created_at DESC
  );