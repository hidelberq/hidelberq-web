package handler

import (
	"html/template"
	"net/http"

	"github.com/gorilla/mux"
	"gopkg.in/russross/blackfriday.v2"
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

	md := blackfriday.Run(i.Text)
	respond(w, r, http.StatusOK, h.Tmpl, "item", struct {
		Title string
		Body  template.HTML
	}{
		Title: item,
		Body:  template.HTML(string(md)),
	})
}
