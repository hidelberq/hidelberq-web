package main

import (
	"flag"
	"fmt"
	"net/http"

	"html/template"

	"os"

	log "github.com/sirupsen/logrus"

	"github.com/hidelbreq/hidelberq-web/wiki/config"
	"github.com/hidelbreq/hidelberq-web/wiki/infrastructure"
	"github.com/hidelbreq/hidelberq-web/wiki/interfaces/controller"
)

var cnfg config.Config

func init() {
	flag.StringVar(&cnfg.Addr, "addr", ":8081", "Webサーバーのアドレス")
	flag.StringVar(&cnfg.ItemPath, "src", "/usr/share/hidel-wiki/item", "項目の保存先のリポジトリのパス")
	log.SetOutput(os.Stdout)

}

func main() {
	fmt.Println("wiki項目の保存先:", cnfg.ItemPath)

	masterTmpl := template.Must(template.ParseGlob("template/*.tmpl"))
	controller.Templates = masterTmpl
	controller.Dir = cnfg.ItemPath

	r := infrastructure.NewRouter(&cnfg)

	fmt.Println("Webサーバーを起動します...", cnfg.Addr)
	if err := http.ListenAndServe(cnfg.Addr, r); err != nil {
		log.Fatalln("Webサーバーの起動に失敗しました:", err)
	}
}
