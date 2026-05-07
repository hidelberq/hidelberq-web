-- 社会リズム療法の気分スコアの範囲を -10~+10 から -5~+5 に変更
-- 既存データを半分にスケーリング（四捨五入）
UPDATE rhythm_entries SET mood = ROUND(CAST(mood AS REAL) / 2);