import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { GlitchText } from "../components/GlitchText";
import {
  DiscordIcon,
  GitHubIcon,
  NoteIcon,
  ShopIcon,
  SignInIcon,
  YouTubeIcon,
} from "../components/Icons";
import { createMetaTags } from "../util";
import type { Route } from "./+types/home";

const ASCII_ART = ` ███╗   ██╗ ██╗    ██╗ ██╗   ██╗
 ████╗  ██║ ██║    ██║ ██║   ██║
 ██╔██╗ ██║ ██║ █╗ ██║ ██║   ██║
 ██║╚██╗██║ ██║███╗██║ ██║   ██║
 ██║ ╚████║ ╚███╔███╔╝ ╚██████╔╝
 ╚═╝  ╚═══╝  ╚══╝╚══╝   ╚═════╝`;

const ABOUT_TEXT = "Hangout crew. Lovers of Culture, Art and Tech!";
const SIGNIN_NOTE_TEXT =
  "※ NWUメンバーは、ここからサインインできます\n※ メンバーでない方は、まずは気軽に Discord に入ってください。一緒に遊びましょう!";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { log, auth } = context;

  log.info(`🔄 ホーム Loader`);

  // 認証チェック
  return (await auth.auth(request)).isOk();
}

export const meta = (_: Route.MetaArgs) =>
  createMetaTags({
    title: "NWU",
    description: "We are Hangout crew. Lovers of Culture, Art and Tech!",
  });

export default function Home({ loaderData }: Route.ComponentProps) {
  const isLogin = loaderData;
  const aboutTextRef = useRef<HTMLDivElement>(null);
  const signinNoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // prefers-reduced-motionをチェック
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      // アニメーションなしで即座にすべて表示
      const elementIds = [
        "terminal-output-1",
        "terminal-name",
        "terminal-about",
        "terminal-output-3",
        "terminal-links",
        "terminal-signin-note",
      ];

      elementIds.forEach((id) => {
        const element = document.getElementById(id);
        if (element) {
          element.style.opacity = "1";
        }
      });

      // テキストコンテンツも即座に設定
      const name = document.getElementById("terminal-name");
      const about = document.getElementById("terminal-about");
      const signinNote = document.getElementById("terminal-signin-note");

      if (name) {
        name.textContent = ASCII_ART;
      }
      if (about) {
        about.textContent = ABOUT_TEXT;
      }
      if (signinNote) {
        signinNote.textContent = SIGNIN_NOTE_TEXT;
      }

      return; // クリーンアップ不要
    }

    // コンテナ要素を即座に表示
    const containerIds = ["terminal-output-1", "terminal-output-3"];

    containerIds.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.opacity = "1";
      }
    });

    let shouldStop = false;
    const timeouts: number[] = [];
    let glitchSigninNote: GlitchText | null = null;

    // 全ての要素にフェードインアニメーションを適用
    const fadeElements = ["terminal-name", "terminal-links"];

    fadeElements.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.transition = "opacity 1.0s ease-in-out";
        element.style.opacity = "0";

        const timeout = window.setTimeout(() => {
          if (!shouldStop && element) {
            element.style.opacity = "1";
          }
        }, 50);
        timeouts.push(timeout);
      }
    });

    // ASCIIアートのテキストを設定
    const nameElement = document.getElementById("terminal-name");
    if (nameElement) {
      nameElement.textContent = ASCII_ART;
    }

    // テキストのタイプライティングアニメーション
    const aboutElement = document.getElementById("terminal-about");
    if (aboutElement) {
      aboutElement.style.opacity = "1";
      aboutElement.textContent = "";

      let charIndex = 0;
      const typeSpeed = 50;

      const typeInterval = window.setInterval(() => {
        if (shouldStop) {
          clearInterval(typeInterval);
          return;
        }

        if (charIndex < ABOUT_TEXT.length) {
          aboutElement.textContent = ABOUT_TEXT.substring(0, charIndex + 1);
          charIndex++;
        } else {
          clearInterval(typeInterval);
        }
      }, typeSpeed);

      timeouts.push(typeInterval);
    }

    // 文字化けアニメーション
    const glitchAbout = new GlitchText(ABOUT_TEXT);
    const glitchTimeout = window.setTimeout(() => {
      if (!shouldStop) {
        glitchAbout.init(aboutTextRef.current);
      }
    }, 3000);
    timeouts.push(glitchTimeout);

    // 注意書きのタイプライティングアニメーション（ログインしていない場合のみ）
    if (!isLogin) {
      const signinNoteElement = document.getElementById("terminal-signin-note");
      if (signinNoteElement) {
        signinNoteElement.style.opacity = "1";
        signinNoteElement.textContent = "";

        let charIndex = 0;
        const typeSpeed = 50;
        const startDelay = 1000; // ABOUT_TEXTの後に開始

        const typeTimeout = window.setTimeout(() => {
          const typeInterval = window.setInterval(() => {
            if (shouldStop) {
              clearInterval(typeInterval);
              return;
            }

            if (charIndex < SIGNIN_NOTE_TEXT.length) {
              signinNoteElement.textContent = SIGNIN_NOTE_TEXT.substring(
                0,
                charIndex + 1,
              );
              charIndex++;
            } else {
              clearInterval(typeInterval);
            }
          }, typeSpeed);

          timeouts.push(typeInterval);
        }, startDelay);

        timeouts.push(typeTimeout);

        // 注意書きの文字化けアニメーション
        glitchSigninNote = new GlitchText(SIGNIN_NOTE_TEXT);
        const glitchSigninTimeout = window.setTimeout(
          () => {
            if (!shouldStop && glitchSigninNote) {
              glitchSigninNote.init(signinNoteRef.current);
            }
          },
          startDelay + SIGNIN_NOTE_TEXT.length * 50 + 3000,
        );
        timeouts.push(glitchSigninTimeout);
      }
    }

    // クリーンアップ関数
    return () => {
      shouldStop = true;
      glitchAbout.destroy();
      if (glitchSigninNote) {
        glitchSigninNote.destroy();
      }
      for (const id of timeouts) {
        clearTimeout(id);
        clearInterval(id);
      }
    };
  }, [isLogin]);

  return (
    <div className="min-h-screen pb-20 bg-white dark:bg-gray-900">
      <main className="font-vt323 text-xl md:text-2xl md:w-[700px] w-full p-8 mx-auto leading-relaxed">
        <div>
          <div className="mt-10 mb-6 opacity-0" id="terminal-output-1">
            <div
              className="text-green-600 dark:text-green-400 opacity-0 whitespace-pre font-mono text-xs md:text-sm"
              id="terminal-name"
            ></div>
            <div
              className="text-green-600 dark:text-green-400 opacity-0 mt-4 overflow-hidden whitespace-nowrap"
              id="terminal-about"
              ref={aboutTextRef}
            ></div>
          </div>

          <div className="my-4 mb-6 opacity-0" id="terminal-output-3">
            <div
              className="text-green-600 dark:text-green-400 opacity-0"
              id="terminal-links"
            >
              <div className="flex flex-wrap gap-4 md:gap-8">
                <a
                  href="/discord"
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-600 dark:text-green-400 no-underline flex flex-col items-center gap-1 p-1 md:p-3 transition-all duration-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 w-18 md:w-24"
                >
                  <DiscordIcon className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                  <span className="text-lg md:text-xl">Discord</span>
                </a>
                <a
                  href="/youtube"
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-600 dark:text-green-400 no-underline flex flex-col items-center gap-1 p-1 md:p-3 transition-all duration-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 w-18 md:w-24"
                >
                  <YouTubeIcon className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                  <span className="text-lg md:text-xl">YouTube</span>
                </a>
                <a
                  href="/note"
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-600 dark:text-green-400 no-underline flex flex-col items-center gap-1 p-1 md:p-3 transition-all duration-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 w-18 md:w-24"
                >
                  <NoteIcon className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                  <span className="text-lg md:text-xl">note</span>
                </a>
                <a
                  href="/shop"
                  className="text-green-600 dark:text-green-400 no-underline flex flex-col items-center gap-1 p-1 md:p-3 transition-all duration-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 w-18 md:w-24"
                >
                  <ShopIcon className="w-8 h-8 md:w-10 md:h-10 stroke-current" />
                  <span className="text-lg md:text-xl">Shop</span>
                </a>
                <a
                  href="/github"
                  target="_blank"
                  rel="noreferrer"
                  className="text-green-600 dark:text-green-400 no-underline flex flex-col items-center gap-1 p-1 md:p-3 transition-all duration-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 w-18 md:w-24"
                >
                  <GitHubIcon className="w-8 h-8 md:w-10 md:h-10 fill-current" />
                  <span className="text-lg md:text-xl">GitHub</span>
                </a>
              </div>
              {isLogin && (
                <div className="mt-12 flex justify-start">
                  <a href="https://lin.ee/P7c9lgo">
                    <img
                      src="https://scdn.line-apps.com/n/line_add_friends/btn/ja.png"
                      alt="友だち追加"
                      height="18"
                      className="border-0"
                    />
                  </a>
                </div>
              )}
              {!isLogin && (
                <>
                  <Link
                    to="/signin"
                    reloadDocument
                    className="mt-12 text-green-600 dark:text-green-400 no-underline flex flex-col items-center gap-1 p-1 md:p-3 transition-all duration-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:scale-105 w-18 md:w-24"
                  >
                    <SignInIcon className="w-8 h-8 md:w-10 md:h-10 stroke-current" />
                    <span className="text-lg md:text-xl">SignIn</span>
                  </Link>
                  <div
                    className="text-green-600 dark:text-green-400 font-dot-gothic text-xs whitespace-pre-line opacity-0 overflow-hidden"
                    id="terminal-signin-note"
                    ref={signinNoteRef}
                  ></div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
