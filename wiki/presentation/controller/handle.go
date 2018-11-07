package controller

import (
	"html/template"
	"log"
	"net/http"
)

var templates = template.Must(template.ParseGlob("presentation/view/template/*.tmpl"))

func respond(
	w http.ResponseWriter,
	r *http.Request,
	status int,
	name string,
	data interface{},
) {
	w.WriteHeader(status)
	if err := templates.ExecuteTemplate(w, name, data); err != nil {
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

	if err := templates.ExecuteTemplate(w, "error", data); err != nil {
		log.Println(err)
	}
}

func respondErrStatus(w http.ResponseWriter, status int) {
	respondErr(w, status, http.StatusText(status))
}
