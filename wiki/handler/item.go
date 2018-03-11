package handler

import (
	"html/template"
	"net/http"

	"github.com/gorilla/mux"
)

type ItemHandler struct {
	Tmpl *template.Template
	Dir  string
}

func (h *ItemHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		h.Get(w, r)
	}
}

func (h *ItemHandler) Get(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	item := v["item"]

	i, ok := itemMap[item]
	if !ok {
		respondErr(w, http.StatusNotFound, h.Tmpl, http.StatusText(http.StatusNotFound))
		return
	}

	respond(w, r, http.StatusOK, h.Tmpl, "item", struct {
		Title string
		Body  string
	}{
		Title: item,
		Body:  string(i.Text),
	})
}
