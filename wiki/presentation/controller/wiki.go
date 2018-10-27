package controller

import (
	"github.com/hidelbreq/hidelberq-web/wiki/application"
	"net/http"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
)

type WikiController struct {
}

func NewWikiController() *WikiController {
	return &WikiController{}
}

func (c *WikiController) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		c.Get(w, r)
	}
}

func (c *WikiController) Get(w http.ResponseWriter, r *http.Request) {
	items := application.ItemFindAll()
	respond(w, r, http.StatusOK, "wiki", struct {
		Items []*domain.Item
	}{
		Items: items,
	})
}
