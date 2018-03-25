package controller

import (
	"net/http"

	log "github.com/sirupsen/logrus"

	"github.com/gorilla/mux"
	"github.com/hidelbreq/hidelberq-web/wiki/interfaces/database"
	"github.com/hidelbreq/hidelberq-web/wiki/usecase"
)

type ItemController struct {
	Interactor usecase.ItemInteractor
}

func NewItemController(handler database.GitHandler) *ItemController {
	return &ItemController{
		Interactor: usecase.ItemInteractor{
			ItemRepository: &database.ItemRepository{
				GitHandler: handler,
			},
		},
	}
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
	i := h.Interactor.FundByPath(item)

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
