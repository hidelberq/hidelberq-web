-- 気分スコアの範囲を -10~+10 から -5~+5 に変更
-- 既存データを半分にスケーリング（四捨五入）
UPDATE rhythm_entries SET mood = ROUND(CAST(mood AS REAL) / 2);
UPDATE life_chart_events SET score = ROUND(CAST(score AS REAL) / 2);