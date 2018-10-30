package main

import (
	"flag"
	"fmt"
	"net/http"
	"os"

	"github.com/hidelbreq/hidelberq-web/wiki/infrastructure"

	"github.com/hidelbreq/hidelberq-web/wiki/core"

	"github.com/hidelbreq/hidelberq-web/wiki/presentation/controller"
	log "github.com/sirupsen/logrus"
)

func init() {
	var configPath string
	flag.StringVar(&configPath, "config", "config.json", "config file")
	log.SetOutput(os.Stdout)

	core.InitConfig()
	core.InitGit()

	ir := infrastructure.NewItemRepository(core.GetGitRepository())
	ir.Init()
}

func main() {
	r := controller.NewRouter()
	fmt.Println("Webサーバーを起動します...", core.GetConfig())
	if err := http.ListenAndServe(core.GetConfig().Addr, r); err != nil {
		log.Fatalln("Webサーバーの起動に失敗しました:", err)
	}
}
