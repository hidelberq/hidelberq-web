package controller

import (
	"net/http"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	"github.com/hidelbreq/hidelberq-web/wiki/interfaces/database"
	"github.com/hidelbreq/hidelberq-web/wiki/usecase"
)

type WikiController struct {
	Interactor usecase.ItemInteractor
}

func NewWikiController(handler database.GitHandler) *WikiController {
	return &WikiController{
		Interactor: usecase.ItemInteractor{
			ItemRepository: &database.ItemRepository{
				GitHandler: handler,
			},
		},
	}
}

func (h *WikiController) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		h.Get(w, r)
	}
}

func (h *WikiController) Get(w http.ResponseWriter, r *http.Request) {
	items := h.Interactor.FindAll()
	respond(w, r, http.StatusOK, "wiki", struct {
		Items []*domain.Item
	}{
		Items: items,
	})
}
