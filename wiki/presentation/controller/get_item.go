package controller

import (
	"net/http"

	"github.com/hidelbreq/hidelberq-web/wiki/application"

	log "github.com/sirupsen/logrus"

	"github.com/gorilla/mux"
)

type ItemController struct {
}

func NewItemController() *ItemController {
	return &ItemController{}
}

func (h *ItemController) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		h.Get(w, r)
	}
}

func (h *ItemController) Get(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	item := v["item"]

	log.Infoln(item)
	i := application.ItemFindByPath(item)

	if i == nil {
		respondErr(w, http.StatusNotFound, http.StatusText(http.StatusNotFound))
		return
	}

	respond(w, r, http.StatusOK, "item", struct {
		Title string
		Body  string
	}{
		Title: item,
		Body:  string(i.Text),
	})
}
