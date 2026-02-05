import { loadDefaultJapaneseParser, type Parser } from "budoux";

// 文末表現パターン（句点を追加）- 明確な文末のみ
// 順序が重要: 長いパターンを先に（「んですよね」→「んですよ」→「んです」→「です」の順）
const sentenceEndPatterns = [
	// 「んです」系（最も優先）- よね付きを先に
	"んですよね",
	"んですね",
	"んですよ",
	"んですか",
	"んです",
	"のですよね",
	"のですね",
	"のですよ",
	"のですか",
	"のです",
	// 丁寧語・敬語の文末 - よね付きを先に
	"ですよね",
	"ですね",
	"ですよ",
	"ですか",
	"でした",
	"ません",
	"ました",
	"ますよね",
	"ますね",
	"ますよ",
	"ますか",
	"ございます",
	"いたします",
	"です",
	"ます",
];

// 句読点追加ロジック - 正規表現で直接置換
export function addPunctuation(text: string, _parser?: Parser): string {
	// 既に句読点がある場合はスキップ
	if (/[。、！？!?]/.test(text)) {
		return text;
	}

	let result = text;

	// 各文末パターンの後に句点を追加（既に句点がない場合）
	for (const pattern of sentenceEndPatterns) {
		// パターンの後に句点がなく、日本語文字または行末が続く場合に句点を追加
		// ただし、後ろに特定の文字が続く場合はスキップ（より長いパターンとして別途処理）
		let negLookahead = "";
		if (pattern === "です" || pattern === "ます" || pattern === "んです" || pattern === "のです") {
			// 「です」「ます」の後に「ね」「よ」「か」が続く場合はスキップ
			negLookahead = "(?![ねよか])";
		} else if (pattern === "ですよ" || pattern === "ますよ" || pattern === "んですよ" || pattern === "のですよ") {
			// 「ですよ」「ますよ」の後に「ね」が続く場合はスキップ
			negLookahead = "(?!ね)";
		}

		const regex = new RegExp(
			`(${pattern})${negLookahead}(?!。)([\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]|$)`,
			"g",
		);
		result = result.replace(regex, "$1。$2");
	}

	return result;
}

// デバッグ用: budouxの分割結果を確認
export function debugSegments(text: string, parser: Parser): string[] {
	return parser.parse(text);
}

// parserのファクトリ
export function createParser(): Parser {
	return loadDefaultJapaneseParser();
}
