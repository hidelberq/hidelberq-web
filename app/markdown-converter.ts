/**
 * TipTap (ProseMirror) JSON形式からMarkdownへの変換
 */

import type { AppError } from "@nw-union/nw-utils";
import { SystemError } from "@nw-union/nw-utils";
import { err, ok, type Result } from "neverthrow";
import { match } from "ts-pattern";

type JSONContent = {
  type: string;
  content?: JSONContent[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  text?: string;
};

/**
 * TipTapのProseMirror JSON形式をMarkdownに変換する
 */
export const convertToMarkdown = (
  jsonBody: string,
): Result<string, AppError> => {
  try {
    const docJson = JSON.parse(jsonBody) as JSONContent;

    if (docJson.type !== "doc") {
      return err(new SystemError("Invalid document format"));
    }

    const markdown = serializeNode(docJson, 0);
    return ok(markdown);
  } catch (error) {
    return err(
      new SystemError(
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
};

/**
 * ノードをMarkdownテキストにシリアライズ
 */
const serializeNode = (node: JSONContent, level = 0): string =>
  match(node.type)
    .with("doc", () => serializeChildren(node, level))
    .with("paragraph", () => `${serializeChildren(node, level)}\n\n`)
    .with("heading", () => {
      const headingLevel = (node.attrs?.level as number) || 1;
      const prefix = "#".repeat(headingLevel);
      return `${prefix} ${serializeChildren(node, level)}\n\n`;
    })
    .with("bulletList", () => `${serializeChildren(node, level)}\n`)
    .with("orderedList", () => `${serializeChildren(node, level)}\n`)
    .with("listItem", () => {
      const indent = "  ".repeat(level);
      const bullet = "-";
      const content = serializeChildren(node, level + 1).trim();
      return `${indent}${bullet} ${content}\n`;
    })
    .with("codeBlock", () => {
      const language = (node.attrs?.language as string) || "";
      const code = serializeChildren(node, level);
      return `\`\`\`${language}\n${code}\`\`\`\n\n`;
    })
    .with("blockquote", () => {
      const content = serializeChildren(node, level)
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => `> ${line}`)
        .join("\n");
      return `${content}\n\n`;
    })
    .with("horizontalRule", () => "---\n\n")
    .with("hardBreak", () => "\n")
    .with("image", () => {
      const src = (node.attrs?.src as string) || "";
      const alt = (node.attrs?.alt as string) || "";
      const title = node.attrs?.title as string | undefined;

      // base64画像はコメントとして出力
      if (src.startsWith("data:image")) {
        return "<!-- Base64 Image (not exported) -->";
      }

      // 通常のURL画像は標準Markdown記法
      const titlePart = title ? ` "${title.replace(/"/g, '\\"')}"` : "";
      return `![${alt}](${src.replace(/[()]/g, "\\$&")}${titlePart})`;
    })
    .with("youtube", () => {
      const src = (node.attrs?.src as string) || "";
      const videoId = extractYouTubeId(src);
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      return `[YouTube](${url})\n\n`;
    })
    .with("text", () => {
      const text = node.text || "";

      // マークを適用
      return (
        node.marks?.reduce(
          (acc, mark) =>
            match(mark.type)
              .with("bold", () => `**${acc}**`)
              .with("italic", () => `*${acc}*`)
              .with("code", () => `\`${acc}\``)
              .with("strike", () => `~~${acc}~~`)
              .with("link", () => {
                const href = (mark.attrs?.href as string) || "";
                return `[${acc}](${href})`;
              })
              .otherwise(() => acc),
          text,
        ) ?? text
      );
    })
    .otherwise(() => serializeChildren(node, level));

/**
 * 子ノードを順番にシリアライズ
 */
const serializeChildren = (node: JSONContent, level: number): string =>
  node.content?.map((child) => serializeNode(child, level)).join("") ?? "";

/**
 * YouTube URLからビデオIDを抽出
 */
const extractYouTubeId = (src: string): string =>
  src.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([^?&]+)/)?.[1] ?? "";
