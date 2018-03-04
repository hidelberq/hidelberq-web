package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

func main() {
	var addr = flag.String("addr", ":8083", "Webサーバーのポート番号")
	flag.Parse()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Hello world"))
	})
	fmt.Println("Webサーバーを起動します...", *addr)

	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Fatalln("Webサーバーの起動に失敗しました:", err)
	}
}
