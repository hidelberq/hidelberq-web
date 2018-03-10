package handler

import (
	"html/template"
	"net/http"

	"sort"
)

type WikiHandler struct {
	Tmpl *template.Template
	Dir  string
}

func (h *WikiHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		h.Get(w, r)
	}
}

func (h *WikiHandler) Get(w http.ResponseWriter, r *http.Request) {
	var items []*item
	for _, i := range itemMap {
		items = append(items, i)
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.Unix() > items[j].ModTime.Unix()
	})

	respond(w, r, http.StatusOK, h.Tmpl, "wiki", struct {
		Items []*item
	}{
		Items: items,
	})
}
