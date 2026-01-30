export interface TerminalConfig {
  typeSpeed?: number;
  commandSpeed?: number;
  fadeInDelay?: number;
  shortDelay?: number;
  mediumDelay?: number;
}

export interface TerminalStep {
  type: "command" | "text" | "ascii-art" | "element";
  elementId?: string;
  command?: string;
  text?: string;
  delay?: number;
}

export interface TerminalSequence {
  steps: TerminalStep[];
}

const DEFAULT_CONFIG: Required<TerminalConfig> = {
  typeSpeed: 50,
  commandSpeed: 100,
  fadeInDelay: 300,
  shortDelay: 400,
  mediumDelay: 800,
};

/**
 * TerminalTyperクラスは、ターミナル風のアニメーションを制御します。
 * 汎用的な設計により、任意のコンテンツとアニメーションシーケンスを実行できます。
 */
export class TerminalTyper {
  private readonly config: Required<TerminalConfig>;
  private shouldStop = false;
  private timeoutIds: number[] = [];
  private sequence: TerminalSequence;

  constructor(sequence: TerminalSequence, config: TerminalConfig = {}) {
    this.sequence = sequence;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  init() {
    this.runSequence();
  }

  destroy() {
    this.shouldStop = true;
    // すべてのタイムアウトをクリア
    for (const id of this.timeoutIds) {
      clearTimeout(id);
    }
    this.timeoutIds = [];
  }

  private async runSequence() {
    for (const step of this.sequence.steps) {
      if (this.shouldStop) return;
      await this.executeStep(step);
    }
  }

  private async executeStep(step: TerminalStep) {
    if (this.shouldStop) return;

    const element = step.elementId
      ? document.getElementById(step.elementId)
      : null;

    switch (step.type) {
      case "element":
        await this.showElement(element);
        break;
      case "command":
        if (step.command) {
          await this.typeCommand(element, step.command);
        }
        break;
      case "text":
        if (step.text) {
          await this.typeText(element, step.text);
        }
        break;
      case "ascii-art":
        if (step.text) {
          await this.showAsciiArt(element, step.text);
        }
        break;
    }

    if (step.delay) {
      await this.delay(step.delay);
    }
  }

  private async showElement(element: HTMLElement | null) {
    if (this.shouldStop) return;
    if (element) {
      element.style.opacity = "1";
      element.style.animation = "fadeIn 0.3s ease-in-out";
    }
    await this.delay(this.config.fadeInDelay);
  }

  private async typeCommand(element: HTMLElement | null, text: string) {
    if (this.shouldStop) return;
    if (!element) return;

    element.textContent = "";
    for (let i = 0; i < text.length; i++) {
      if (this.shouldStop) return;
      element.textContent += text[i];
      await this.delay(this.config.commandSpeed);
    }
    await this.delay(this.config.fadeInDelay);
  }

  private async typeText(element: HTMLElement | null, text: string) {
    if (this.shouldStop) return;
    if (!element) return;

    element.style.opacity = "1";

    if (text.includes("\n")) {
      const lines = text.split("\n");
      element.innerHTML = "";
      for (let i = 0; i < lines.length; i++) {
        if (this.shouldStop) return;
        if (i > 0) element.innerHTML += "<br>";
        await this.typeTextLine(element, lines[i]);
      }
    } else {
      await this.typeTextLine(element, text);
    }
  }

  private async typeTextLine(element: HTMLElement, text: string) {
    if (this.shouldStop) return;
    const currentContent = element.innerHTML;
    for (let i = 0; i < text.length; i++) {
      if (this.shouldStop) return;
      element.innerHTML = currentContent + text.substring(0, i + 1);
      await this.delay(this.config.typeSpeed);
    }
  }

  private async showAsciiArt(element: HTMLElement | null, text: string) {
    if (this.shouldStop) return;
    if (!element) return;

    element.textContent = text;
    element.style.opacity = "0";
    element.style.transition = "opacity 1.0s ease-in-out";

    // 次のフレームでopacityを変更することでtransitionを適用
    await this.delay(50);
    if (this.shouldStop) return;
    element.style.opacity = "1";
    await this.delay(1000); // transition完了を待つ
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const id = window.setTimeout(() => {
        const index = this.timeoutIds.indexOf(id);
        if (index > -1) {
          this.timeoutIds.splice(index, 1);
        }
        resolve();
      }, ms);
      this.timeoutIds.push(id);
    });
  }
}
