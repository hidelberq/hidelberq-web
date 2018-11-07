package controller

import (
	"log"
	"net/http"
	"time"

	"github.com/sirupsen/logrus"

	"github.com/stretchr/objx"

	"github.com/hidelbreq/hidelberq-web/wiki/application"
)

func LoginHandle(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		respond(w, r, http.StatusOK, "login", nil)
	case http.MethodPost:
		err := r.ParseForm()
		if err != nil {
			respondErrStatus(w, http.StatusBadRequest)
			return
		}

		username := r.PostFormValue("username")
		if username == "" {
			respondErr(w, http.StatusBadRequest, "username must be set")
			return
		}

		password := r.PostFormValue("password")
		if password == "" {
			respondErr(w, http.StatusBadRequest, "username must be set")
			return
		}

		log.Print(username, password)
		u, err := application.Login(username, password)
		if err != nil {
			respondErrStatus(w, http.StatusInternalServerError)
			return
		}

		authCookieValue := objx.New(map[string]interface{}{
			"name":  u.Username,
			"email": u.Email,
		}).MustBase64()
		afterOneWeek := time.Now().AddDate(0, 0, 7)
		http.SetCookie(w, &http.Cookie{
			Name:    "auth",
			Value:   authCookieValue,
			Path:    "/",
			Expires: afterOneWeek,
		})

		respond(w, r, http.StatusOK, "login-success", struct {
			Path string
		}{
			"/wiki",
		})
	default:
		respondErr(w, http.StatusMethodNotAllowed, http.StatusText(http.StatusMethodNotAllowed))
	}
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name: "auth",
	})
	w.Header()["Location"] = []string{"/login"}
	w.WriteHeader(http.StatusTemporaryRedirect)
}

type authHandler struct {
	next http.Handler
}

func (h *authHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if cooke, err := r.Cookie("auth"); err == http.ErrNoCookie || cooke.Value == "" {
		redirect := "/login"
		w.Header()["Location"] = []string{redirect}
		w.WriteHeader(http.StatusTemporaryRedirect)
		return
	} else if err != nil {
		logrus.Warn(err)
		respondErrStatus(w, http.StatusTemporaryRedirect)
		return
	} else {
		logrus.Debug(cooke)
		h.next.ServeHTTP(w, r)
	}
}

func MustAuth(handler http.Handler) http.Handler {
	return &authHandler{next: handler}
}
