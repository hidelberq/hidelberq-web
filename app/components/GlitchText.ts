/**
 * GlitchTextクラスは、文字化けアニメーションを制御します。
 */
export class GlitchText {
  private originalText: string;
  private element: HTMLElement | null = null;
  private intervalId: number | null = null;
  private shouldStop = false;

  // 不気味な文字化けに使う文字セット
  private readonly glitchChars =
    "!<>-_\\/[]{}—=+*^?#________░▒▓█▄▀▌▐┤┘┴└├┬┼╬═╗╚║╠╦╬¤•°·÷×≈≠≤≥∞∑√∫∂∆∇∏∐∩∪⊂⊃⊆⊇∈∉∅∀∃∄∧∨⊕⊗⊙⊥∥∦⌐¬∟∠∡∢∴∵∶∷∼∽≃≅≆≇≈≉≊≋≌≍≎≏";

  constructor(text: string) {
    this.originalText = text;
  }

  init(element: HTMLElement | null) {
    this.element = element;
    if (!this.element) return;

    // ランダムな間隔で文字化けを発生させる（最低3秒以上）
    const startGlitch = () => {
      if (this.shouldStop) return;

      this.glitch();

      const nextInterval = Math.random() * 20000 + 10000; // 10-30秒
      setTimeout(startGlitch, nextInterval);
    };

    // 最初の文字化けを開始
    setTimeout(startGlitch, Math.random() * 3000 + 3000);
  }

  glitch() {
    if (!this.element || this.shouldStop) return;

    const duration = Math.random() * 1000 + 500; // 0.5-1.5秒
    const startTime = Date.now();
    let lastUpdateTime = 0;
    const updateInterval = 80; // 80msごとに更新（よりゆっくり）

    // 文字化けアニメーション
    const animate = () => {
      if (!this.element || this.shouldStop) return;

      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        // 更新頻度を制限
        if (currentTime - lastUpdateTime >= updateInterval) {
          // 文字化け中
          const glitchedText = this.originalText
            .split("")
            .map((char) => {
              // 各文字をランダムな確率で文字化けさせる
              // 進行度が高いほど文字化けの確率を下げる（徐々に元に戻る）
              const glitchProbability = Math.sin(progress * Math.PI) * 0.6; // 0〜0.6の間で変動

              if (char === " ") return " "; // スペースはそのまま

              if (Math.random() < glitchProbability) {
                return this.glitchChars[
                  Math.floor(Math.random() * this.glitchChars.length)
                ];
              }
              return char;
            })
            .join("");

          this.element.textContent = glitchedText;
          lastUpdateTime = currentTime;
        }

        requestAnimationFrame(animate);
      } else {
        // 元に戻す
        this.element.textContent = this.originalText;
      }
    };

    requestAnimationFrame(animate);
  }

  destroy() {
    this.shouldStop = true;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
  }
}
