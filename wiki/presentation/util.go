package presentation

import (
	"html/template"
	"strings"
)

var FuncMap = map[string]interface{}{
	"nl2br": func(text string) template.HTML {
		return template.HTML(strings.Replace(template.HTMLEscapeString(text), "\n", "<br>", -1))
	},
	"truncate": func(text string, length int) template.HTML {
		replaced := strings.Replace(text, "\n", "", -1)
		r := []rune(replaced)
		return template.HTML(r[0:length])
	},
	//"format4datetime": func(t time.Time) string {
	//	return t.Format(FormatDateTimeLocalPCChrome)
	//},
}
