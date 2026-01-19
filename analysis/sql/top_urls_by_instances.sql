-- Top URLs by instance count for a given component
--
-- USAGE: Edit the WHERE clause to specify the component_key you want to analyze
--        Edit LIMIT to control how many results to return

SELECT 
  ui.url,
  dcu.instance_count,
  dcu.evidence
FROM david_component_usage dcu
JOIN url_inventory ui ON dcu.url_id = ui.id
WHERE dcu.component_key = 'cards_section'  -- EDIT THIS LINE to change component
ORDER BY dcu.instance_count DESC
LIMIT 10;  -- EDIT THIS LINE to change result count
