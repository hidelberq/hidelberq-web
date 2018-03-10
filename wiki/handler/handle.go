package handler

import (
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type item struct {
	Title   string
	ModTime time.Time
	Text    []byte
}

var itemMap = make(map[string]*item)
var mutex sync.RWMutex

var Templates *template.Template
var Dir string

func LoadWikiItems(dir string) error {
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}

		s := strings.Split(file.Name(), ".md")
		if len(s) != 2 {
			continue
		}

		bytes, err := ioutil.ReadFile(filepath.Join(dir, file.Name()))
		if err != nil {
			return err
		}

		itemMap[s[0]] = &item{
			Title:   s[0],
			ModTime: file.ModTime(),
			Text:    bytes,
		}
	}

	return nil
}

func respond(
	w http.ResponseWriter,
	r *http.Request,
	status int,
	tmpl *template.Template,
	name string,
	data interface{},
) {
	w.WriteHeader(status)
	if err := tmpl.ExecuteTemplate(w, name, data); err != nil {
		log.Println(err)
	}
}

type errorMessage struct {
	Status  int
	Message string
}

func respondErr(w http.ResponseWriter, status int, tmpl *template.Template, message string) {
	w.WriteHeader(status)
	data := struct {
		Status  int
		Message string
	}{
		Status:  status,
		Message: message,
	}

	if err := tmpl.ExecuteTemplate(w, "error", data); err != nil {
		log.Println(err)
	}
}
