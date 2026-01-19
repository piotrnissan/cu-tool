SELECT COUNT(DISTINCT ui.id)
FROM david_component_usage dcu
JOIN url_inventory ui ON ui.id=dcu.url_id
WHERE dcu.component_key='image_carousel'
  AND ui.url LIKE '%/vehicles/new-vehicles/%';