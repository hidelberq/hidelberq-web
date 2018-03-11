FROM golang:1.9.1

ADD . /go/src/github.com/hidelbreq/hidelberq-web/wiki
WORKDIR /go/src/github.com/hidelbreq/hidelberq-web/wiki/

RUN go-wrapper download gopkg.in/russross/blackfriday.v2 github.com/gorilla/mux
RUN go-wrapper install github.com/hidelbreq/hidelberq-web/wiki/...

CMD ["go", "run", "main.go", "-src", "/usr/share/hidel-wiki/item"]
