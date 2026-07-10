SELECT collection, COUNT(*) AS total
FROM app_documents
GROUP BY collection
ORDER BY collection;