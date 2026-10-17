package main

import (
	"encoding/base64"
	"io"
	"log"
	"net/http"

	"github.com/miekg/dns"
)

func handler(w http.ResponseWriter, r *http.Request) {
	var buf []byte
	var err error
	if r.Method == http.MethodGet {
		buf, err = base64.RawURLEncoding.DecodeString(r.URL.Query().Get("dns"))
	} else {
		buf, err = io.ReadAll(r.Body)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var req dns.Msg
	if err := req.Unpack(buf); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	c := &dns.Client{Net: "tcp"}
	resp, _, err := c.Exchange(&req, "127.0.0.1:5353")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	out, _ := resp.Pack()
	w.Header().Set("Content-Type", "application/dns-message")
	w.Write(out)
}

func main() {
	http.HandleFunc("/dns-query", handler)
	log.Fatal(http.ListenAndServe("127.0.0.1:8053", nil))
}
