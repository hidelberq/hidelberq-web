package controller

import (
	"net/http"

	"github.com/gorilla/mux"
	"github.com/hidelbreq/hidelberq-web/wiki/config"
	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	"github.com/hidelbreq/hidelberq-web/wiki/interfaces/database"
	"github.com/hidelbreq/hidelberq-web/wiki/usecase"
	log "github.com/sirupsen/logrus"
)

type EditController struct {
	Interactor usecase.ItemInteractor
}

func NewEditController(cnf *config.Config, handler database.GitHandler) *EditController {
	return &EditController{
		Interactor: usecase.ItemInteractor{
			ItemRepository: &database.ItemRepository{
				GitHandler: handler,
				Cnf:        cnf,
			},
		},
	}
}

func (c *EditController) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		c.getEditItem(w, r)
	case "POST":
		c.updateItem(w, r)
	}

}

func (c *EditController) getEditItem(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	item := v["item"]

	i := c.Interactor.FundByPath(item)
	if i == nil {
		log.Infoln("edit path not found", item)
	}

	respond(w, r, http.StatusOK, "edit-item", struct {
		Title string
		Body  string
	}{
		Title: i.Title,
		Body:  string(i.Text),
	})
}

func (c *EditController) updateItem(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	oldTitle := v["item"]

	markdown := r.FormValue("markdown")
	newItem, _ := domain.NewItem(markdown)

	err := c.Interactor.Update(newItem, oldTitle, user)
	if err == database.ErrNoTitle {
		respondErr(w, http.StatusInternalServerError, "タイトルがありません")
		return
	} else if err == database.ErrInvalidTitle {
		respondErr(w, http.StatusNotFound, http.StatusText(http.StatusNotFound))
		return
	} else if err != nil {
		log.Println(err)
		respondErr(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}

	respond(w, r, http.StatusTemporaryRedirect, "redirect", struct {
		Path string
	}{
		Path: "/wiki/" + newItem.Path,
	})
}
