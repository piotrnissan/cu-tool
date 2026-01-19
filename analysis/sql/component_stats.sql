-- Component usage statistics
-- 
-- USAGE: Edit the WHERE clause to specify the component_key you want to analyze
-- 
-- This query computes percentage dynamically based on the actual analyzed dataset
-- (denominator = total distinct URLs in david_component_usage, not hardcoded sample size)

WITH analyzed_urls AS (
  SELECT COUNT(DISTINCT url_id) as total
  FROM david_component_usage
)
SELECT 
  component_key,
  COUNT(DISTINCT url_id) as pages,
  ROUND(COUNT(DISTINCT url_id) * 100.0 / (SELECT total FROM analyzed_urls), 1) as pct,
  MIN(instance_count) as min,
  MAX(instance_count) as max,
  ROUND(AVG(instance_count), 1) as avg,
  SUM(instance_count) as total
FROM david_component_usage
WHERE component_key = 'cards_section'  -- EDIT THIS LINE to change component
GROUP BY component_key;
