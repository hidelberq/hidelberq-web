package controller

import (
	"net/http"

	"github.com/hidelbreq/hidelberq-web/wiki/application"

	"github.com/gorilla/mux"
	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	log "github.com/sirupsen/logrus"
)

type EditController struct {
}

func NewEditController() *EditController {
	return &EditController{}
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

	i := application.ItemFindByPath(item)
	if i == nil {
		log.Infoln("edit path not found", item)
	}

	respond(w, r, http.StatusOK, "edit-item", i)
}

func (c *EditController) updateItem(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	oldTitle := v["item"]

	markdown := r.FormValue("markdown")
	newItem, _ := domain.NewItem(markdown)

	err := application.ItemUpdate(newItem, oldTitle, user)
	if err == domain.ErrNoTitle {
		respondErr(w, http.StatusInternalServerError, "タイトルがありません")
		return
	} else if err == domain.ErrInvalidTitle {
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
