package controller

import (
	"net/http"

	"github.com/gorilla/mux"
)

func NewRouter() *mux.Router {
	r := mux.NewRouter()
	r.Handle("/wiki", NewWikiController())
	r.Handle("/wiki-new-item", NewCreateItemController())
	r.Handle("/wiki/{item}", NewItemController())
	r.Handle("/wiki/{item}/edit", NewEditController())

	r.PathPrefix("/static/").
		Handler(
			http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	return r
}
