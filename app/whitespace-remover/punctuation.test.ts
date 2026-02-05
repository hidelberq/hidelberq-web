import { describe, it, expect, beforeAll } from "bun:test";
import { addPunctuation, debugSegments, createParser } from "./punctuation";
import type { Parser } from "budoux";

let parser: Parser;

beforeAll(() => {
	parser = createParser();
});

describe("debugSegments - budouxの分割結果確認", () => {
	it("ユーザー提供のテキストの分割結果を確認", () => {
		const input =
			"自分自身のを守ったまま自分の世界観を守ったままに良くなることはないんですねはいどうもアメンタルの委長マスターです本日は頭が悪いとぐるぐる思考は止められないというテーマでお話ししようかなと思います";
		const segments = debugSegments(input, parser);
		console.log("Segments:", segments);
		// 分割結果を確認するためのテスト
		expect(segments.length).toBeGreaterThan(0);
	});

	it("シンプルなケースの分割結果", () => {
		const input = "これはテストです";
		const segments = debugSegments(input, parser);
		console.log("Simple segments:", segments);
		expect(segments.length).toBeGreaterThan(0);
	});

	it("複数文の分割結果", () => {
		const input = "これはテストですこれもテストです";
		const segments = debugSegments(input, parser);
		console.log("Multiple sentences segments:", segments);
		expect(segments.length).toBeGreaterThan(0);
	});
});

describe("addPunctuation - 句読点追加", () => {
	it("「ですね」の後に句点を追加", () => {
		const input = "ないんですねはいどうも";
		const expected = "ないんですね。はいどうも";
		const result = addPunctuation(input, parser);
		console.log("Input:", input);
		console.log("Segments:", debugSegments(input, parser));
		console.log("Result:", result);
		expect(result).toBe(expected);
	});

	it("「です」の後に句点を追加", () => {
		const input = "マスターです本日は";
		const expected = "マスターです。本日は";
		const result = addPunctuation(input, parser);
		console.log("Input:", input);
		console.log("Segments:", debugSegments(input, parser));
		console.log("Result:", result);
		expect(result).toBe(expected);
	});

	it("「ます」の後に句点を追加", () => {
		const input = "お話ししようかなと思いますま";
		const expected = "お話ししようかなと思います。ま";
		const result = addPunctuation(input, parser);
		console.log("Input:", input);
		console.log("Segments:", debugSegments(input, parser));
		console.log("Result:", result);
		expect(result).toBe(expected);
	});

	it("ユーザー提供の完全なテキスト", () => {
		const input =
			"自分自身のを守ったまま自分の世界観を守ったままに良くなることはないんですねはいどうもアメンタルの委長マスターです本日は頭が悪いとぐるぐる思考は止められないというテーマでお話ししようかなと思います";
		const expected =
			"自分自身のを守ったまま自分の世界観を守ったままに良くなることはないんですね。はいどうもアメンタルの委長マスターです。本日は頭が悪いとぐるぐる思考は止められないというテーマでお話ししようかなと思います。";
		const result = addPunctuation(input, parser);
		console.log("Full Input:", input);
		console.log("Full Segments:", debugSegments(input, parser));
		console.log("Full Result:", result);
		expect(result).toBe(expected);
	});

	it("既に句読点がある場合はスキップ", () => {
		const input = "これはテストです。";
		const result = addPunctuation(input, parser);
		expect(result).toBe(input);
	});
});
