package controller

import (
	"net/http"

	"github.com/hidelbreq/hidelberq-web/wiki/application"

	"github.com/hidelbreq/hidelberq-web/wiki/domain"
	"github.com/hidelbreq/hidelberq-web/wiki/util"
	log "github.com/sirupsen/logrus"
)

type CreateItemController struct {
}

func NewCreateItemController() *CreateItemController {
	return &CreateItemController{}
}

func (controller *CreateItemController) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		controller.getNewItem(w, r)
	case "POST":
		controller.createNewItem(w, r)
	default:
		respondErr(w, http.StatusMethodNotAllowed, http.StatusText(http.StatusMethodNotAllowed))
	}
}

func (controller *CreateItemController) getNewItem(w http.ResponseWriter, r *http.Request) {
	respond(w, r, http.StatusOK, "new-item", nil)
}

// FIXME
var user = &domain.User{
	Name:  "hidelberq",
	Email: "hide.seaweed@gmail.com",
}

func (controller *CreateItemController) createNewItem(w http.ResponseWriter, r *http.Request) {
	md := r.FormValue("markdown")
	item, err := domain.NewItem(md)
	if err == util.ErrNoTitle {
		respondErr(w, http.StatusBadRequest, "タイトルがありません")
		return
	}

	if err := application.ItemAdd(item, user); err != nil {
		log.Warnln(err)
		respondErr(w, http.StatusInternalServerError, "記事の保存に失敗しました。")
		return
	}

	respond(w, r, http.StatusOK, "redirect", struct {
		Path string
	}{
		"/wiki",
	})
}
