-- Delete duplicate admin blocks (keep lowest id per date+period)
DELETE FROM work_blocks
WHERE block_type = 'ADMIN'
  AND id_block NOT IN (
    SELECT MIN(id_block)
    FROM work_blocks
    WHERE block_type = 'ADMIN'
    GROUP BY date, period
  );
