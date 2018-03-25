package controller

import (
	"html/template"
	"log"
	"net/http"
)

var Templates *template.Template
var Dir string

func respond(
	w http.ResponseWriter,
	r *http.Request,
	status int,
	name string,
	data interface{},
) {
	w.WriteHeader(status)
	if err := Templates.ExecuteTemplate(w, name, data); err != nil {
		log.Println(err)
	}
}

type errorMessage struct {
	Status  int
	Message string
}

func respondErr(w http.ResponseWriter, status int, message string) {
	w.WriteHeader(status)
	data := struct {
		Status  int
		Message string
	}{
		Status:  status,
		Message: message,
	}

	if err := Templates.ExecuteTemplate(w, "error", data); err != nil {
		log.Println(err)
	}
}
