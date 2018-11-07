package controller

import (
	"net/http"

	"github.com/gorilla/mux"
)

func NewRouter() *mux.Router {
	r := mux.NewRouter()
	r.Handle("/wiki", MustAuth(NewWikiController()))
	r.Handle("/wiki-new-item", MustAuth(NewCreateItemController()))
	r.Handle("/wiki/{item}", MustAuth(NewItemController()))
	r.Handle("/wiki/{item}/edit", MustAuth(NewEditController()))
	r.HandleFunc("/login", LoginHandle)
	r.HandleFunc("/logout", LogoutHandler)

	r.PathPrefix("/static/").
		Handler(
			http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	return r
}
