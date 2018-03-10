package handler

import (
	"net/http"

	"time"

	"io/ioutil"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
)

func EditItem(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		getEditItem(w, r)
	case "POST":
		updateItem(w, r)
	}

}

func getEditItem(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	item := v["item"]

	i, ok := itemMap[item]
	if !ok {
		respondErr(w, http.StatusNotFound, Templates, http.StatusText(http.StatusNotFound))
		return
	}

	respond(w, r, http.StatusOK, Templates, "edit-item", struct {
		Title string
		Body  string
	}{
		Title: i.Title,
		Body:  string(i.Text),
	})
}

func updateItem(w http.ResponseWriter, r *http.Request) {
	v := mux.Vars(r)
	oldTitle := v["item"]

	markdown := r.FormValue("markdown")
	newTitle := extractTitle(markdown)
	if newTitle == "" {
		respondErr(w, http.StatusInternalServerError, Templates, "タイトルがありません")
		return
	}

	_, ok := itemMap[oldTitle]
	if !ok {
		respondErr(w, http.StatusNotFound, Templates, http.StatusText(http.StatusNotFound))
		return
	}

	data := []byte(markdown)
	oldFilePath := filepath.Join(Dir, oldTitle+".md")
	if err := os.Remove(oldFilePath); err != nil {
		respondErr(w, http.StatusInternalServerError, Templates, http.StatusText(http.StatusInternalServerError))
		return
	}

	newFilePath := filepath.Join(Dir, newTitle+".md")
	if err := ioutil.WriteFile(newFilePath, data, 775); err != nil {
		respondErr(w, http.StatusInternalServerError, Templates, http.StatusText(http.StatusInternalServerError))
		return
	}

	delete(itemMap, oldTitle)
	itemMap[newTitle] = &item{
		Title:   newTitle,
		ModTime: time.Now(),
		Text:    data,
	}

	respond(w, r, http.StatusTemporaryRedirect, Templates, "redirect", struct {
		Path string
	}{
		Path: "/wiki/" + newTitle,
	})
}
