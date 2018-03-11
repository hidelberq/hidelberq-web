package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"html/template"

	"os"

	"errors"

	"github.com/gorilla/mux"
	"github.com/hidelbreq/hidelberq-web/wiki/handler"
)

func main() {
	var addr = flag.String("addr", ":8080", "Webサーバーのポート番号")
	var src = flag.String("src", "wiki-item", "wiki項目の保存先のパス")
	flag.Parse()

	if err := initDir(*src); err != nil {
		log.Fatalln("wiki項目の保存先の初期化に失敗しました:", err)
	}

	fmt.Println("wiki項目の保存先:", *src)
	if err := handler.LoadWikiItems(*src); err != nil {
		log.Fatalln("wikiの項目の読み込みに失敗しました:", err)
	}

	masterTmpl := template.Must(template.ParseGlob("template/*.tmpl"))
	handler.Templates = masterTmpl

	handler.Dir = *src

	r := mux.NewRouter()
	r.Handle("/wiki", &handler.WikiHandler{Tmpl: masterTmpl, Dir: *src})
	r.HandleFunc("/wiki-new-item", handler.WikiNewItem)
	r.Handle("/wiki/{item}", &handler.ItemHandler{Tmpl: masterTmpl, Dir: *src})
	r.HandleFunc("/wiki/{item}/edit", handler.EditItem)

	r.PathPrefix("/static/").
		Handler(
			http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	fmt.Println("Webサーバーを起動します...", *addr)
	if err := http.ListenAndServe(*addr, r); err != nil {
		log.Fatalln("Webサーバーの起動に失敗しました:", err)
	}
}

func initDir(dir string) error {
	file, err := os.Stat(dir)
	if err != nil {
		return os.MkdirAll(dir, 0777)
	}

	if !file.IsDir() {
		return errors.New("wiki項目の保存先がディレクトリではありません")
	}

	return nil
}
