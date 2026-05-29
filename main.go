// Pebble launcher — single self-contained binary.
//
// The built `dist/` static app is embedded at compile time, so this binary
// has zero runtime dependencies. It auto-discovers the Hermes API key and
// gateway URL from ~/.hermes/.env, serves the app over HTTP, prints a
// ready-to-use launch URL, and (optionally) opens it in the browser.
//
// The agent's whole flow becomes:  ./pebble  →  open the printed URL.
//
// Build:  npm run build  (produces dist/)  then  go build -o pebble .
// Or use  npm run build:binary  for all platforms.
package main

import (
	"bufio"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

//go:embed all:dist
var distFS embed.FS

const (
	defaultPort   = "5173"
	defaultHermes = "http://localhost:8642"
)

func main() {
	port := flag.String("port", envOr("PEBBLE_PORT", defaultPort), "port to serve Pebble on")
	hermes := flag.String("hermes", os.Getenv("PEBBLE_HERMES"), "Hermes API base URL")
	token := flag.String("token", os.Getenv("PEBBLE_TOKEN"), "Hermes API key")
	open := flag.Bool("open", os.Getenv("PEBBLE_OPEN") == "1", "open the launch URL in a browser")
	noDiscover := flag.Bool("no-discover", false, "don't read ~/.hermes/.env")
	flag.Parse()

	env := map[string]string{}
	if !*noDiscover {
		env = readHermesEnv()
	}

	// Hermes base URL: explicit flag/env, else build from discovered host/port.
	if *hermes == "" {
		host := "localhost"
		if h := env["API_SERVER_HOST"]; h != "" && h != "0.0.0.0" {
			host = h
		}
		apiPort := "8642"
		if p := env["API_SERVER_PORT"]; p != "" {
			apiPort = p
		}
		*hermes = fmt.Sprintf("http://%s:%s", host, apiPort)
	}

	if *token == "" {
		*token = env["API_SERVER_KEY"]
	}

	// The web manifest isn't in Go's default mime table.
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")

	// Serve the embedded dist/ with an SPA fallback to index.html.
	staticFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		fmt.Fprintln(os.Stderr, "embed error:", err)
		os.Exit(1)
	}
	fileServer := http.FileServer(http.FS(staticFS))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		clean := strings.TrimPrefix(filepath.Clean(r.URL.Path), "/")
		if clean == "" {
			clean = "index.html"
		}
		if _, err := fs.Stat(staticFS, clean); err != nil {
			// Unknown path — serve index.html so client-side routing works.
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})

	addr := ":" + *port
	launchURL := fmt.Sprintf("http://localhost:%s/?hermes=%s", *port, url.QueryEscape(*hermes))
	if *token != "" {
		launchURL += "&token=" + url.QueryEscape(*token)
	}

	line := strings.Repeat("━", 56)
	fmt.Printf("\n%s\n", line)
	fmt.Println("  Pebble — Hermes PWA Chat Interface")
	fmt.Println(line)
	fmt.Printf("\n  Serving on  http://localhost:%s\n", *port)
	fmt.Printf("  Hermes API  %s\n", *hermes)
	if *token == "" {
		fmt.Println("\n  ⚠  No API key found. Pass --token <key> or set API_SERVER_KEY")
		fmt.Println("     in ~/.hermes/.env, then restart this launcher.")
	}
	fmt.Printf("\n  Open this URL in your browser:\n\n")
	fmt.Printf("  %s\n", launchURL)
	fmt.Printf("\n%s\n\n", line)

	if *open {
		openBrowser(launchURL)
	}

	if err := http.ListenAndServe(addr, nil); err != nil {
		fmt.Fprintln(os.Stderr, "server error:", err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// readHermesEnv parses ~/.hermes/.env into a key→value map. Missing file is
// not an error — it just yields an empty map.
func readHermesEnv() map[string]string {
	out := map[string]string{}
	home, err := os.UserHomeDir()
	if err != nil {
		return out
	}
	f, err := os.Open(filepath.Join(home, ".hermes", ".env"))
	if err != nil {
		return out
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, val, found := strings.Cut(line, "=")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		val = strings.TrimSpace(val)
		val = strings.Trim(val, `"'`)
		out[key] = val
	}
	return out
}

func openBrowser(target string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
	case "windows":
		cmd, args = "cmd", []string{"/c", "start"}
	default:
		cmd = "xdg-open"
	}
	args = append(args, target)
	_ = exec.Command(cmd, args...).Start()
}
