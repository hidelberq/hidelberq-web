package infrastructure

import (
	"net/http"

	log "github.com/sirupsen/logrus"

	"github.com/gorilla/mux"
	"github.com/hidelbreq/hidelberq-web/wiki/config"
	"github.com/hidelbreq/hidelberq-web/wiki/interfaces/controller"
	"github.com/hidelbreq/hidelberq-web/wiki/interfaces/database"
)

func NewRouter(cnf *config.Config) *mux.Router {
	r := mux.NewRouter()
	gitHandler := NewGitHandler(cnf.ItemPath)
	repo := database.ItemRepository{
		GitHandler: gitHandler,
		Cnf:        cnf,
	}
	if err := repo.Init(); err != nil {
		log.Warnln("repository init error")
	}

	r.Handle("/wiki", controller.NewWikiController(gitHandler))
	r.Handle("/wiki-new-item", controller.NewCreateItemController(cnf, gitHandler))
	r.Handle("/wiki/{item}", controller.NewItemController(gitHandler))
	r.Handle("/wiki/{item}/edit", controller.NewEditController(cnf, gitHandler))

	r.PathPrefix("/static/").
		Handler(
			http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	return r
}
