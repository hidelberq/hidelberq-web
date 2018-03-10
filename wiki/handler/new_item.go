package handler

import (
	"net/http"
	"strings"

	"io/ioutil"
	"path/filepath"

	"time"
)

func WikiNewItem(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "GET":
		getNewItem(w, r)
	case "POST":
		createNewItem(w, r)
	default:
		respondErr(w, http.StatusMethodNotAllowed, Templates, http.StatusText(http.StatusMethodNotAllowed))
	}
}

func getNewItem(w http.ResponseWriter, r *http.Request) {
	respond(w, r, http.StatusOK, Templates, "new-item", nil)
}

func extractTitle(markdown string) string {
	title := strings.TrimPrefix(markdown, "# ")
	split := strings.Split(title, "\r\n")
	if len(split) == 0 || split[0] == "" {
		return ""
	}

	title = split[0]
	title = strings.Replace(title, " ", "-", -1)
	return title
}

func createNewItem(w http.ResponseWriter, r *http.Request) {
	md := r.FormValue("markdown")

	title := extractTitle(md)
	if title == "" {
		respondErr(w, http.StatusInternalServerError, Templates, "タイトルがありません")
		return
	}

	_, ok := itemMap[title]
	if ok {
		respondErr(w, http.StatusBadRequest, Templates, "既に存在している項目です。"+title)
		return
	}

	data := []byte(md)
	if err := ioutil.WriteFile(filepath.Join(Dir, title+".md"), data, 775); err != nil {
		respondErr(w, http.StatusInternalServerError, Templates, "記事の保存に失敗しました。")
		return
	}

	itemMap[title] = &item{
		Title:   title,
		ModTime: time.Now(),
		Text:    data,
	}
	respond(w, r, http.StatusOK, Templates, "redirect", struct {
		Path string
	}{
		"/wiki",
	})
}
