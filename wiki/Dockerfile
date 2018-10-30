FROM golang:1.9.1

ADD . /go/src/github.com/hidelbreq/hidelberq-web/wiki
WORKDIR /go/src/github.com/hidelbreq/hidelberq-web/wiki/

RUN go-wrapper download gopkg.in/russross/blackfriday.v2 github.com/gorilla/mux github.com/sirupsen/logrus gopkg.in/src-d/go-git.v4/... github.com/joho/godotenv
RUN go-wrapper install github.com/hidelbreq/hidelberq-web/wiki/...

CMD ["go", "run", "main.go", "-src", "/usr/share/hidel-wiki/item"]
