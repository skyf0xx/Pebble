// Pebble launcher — single self-contained binary.
//
// The built `dist/` static app is embedded at compile time, so this binary
// has zero runtime dependencies. It auto-discovers the Hermes API key and
// gateway URL from ~/.hermes/.env, serves the app over HTTP, prints a
// ready-to-use launch URL, and (optionally) opens it in the browser.
//
// The Hermes plugin in hermes-plugin/ is also embedded. On each launch,
// installHermesPlugin() compares the embedded plugin.yaml version against
// what's already installed in ~/.hermes/plugins/pebble/ and extracts if
// newer (or missing). Hermes picks up the plugin on its next gateway restart.
//
// The agent's whole flow becomes: ./pebble → open the printed URL.
//
// Build: npm run build (produces dist/) then go build -o pebble .
// Or use npm run build:binary for all platforms.
package main

import (
	"bufio"
	"embed"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"
)

//go:embed all:dist
var distFS embed.FS

//go:embed all:hermes-plugin
var pluginFS embed.FS

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

	// Install or update the Hermes plugin before starting the server.
	pluginInstalled, pluginUpdated, pluginErr := installHermesPlugin()

	// The web manifest isn't in Go's default mime table.
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")

	// Reverse proxy: /api/* and /v1/* → Hermes API (same-origin, no CORS).
	hermesTarget, err := url.Parse(*hermes)
	if err != nil {
		fmt.Fprintln(os.Stderr, "invalid hermes URL:", err)
		os.Exit(1)
	}

	proxy := httputil.NewSingleHostReverseProxy(hermesTarget)

	// Flush immediately — critical for SSE streaming to reach the browser.
	proxy.FlushInterval = -1 * time.Nanosecond

	origDirector := proxy.Director
	capturedToken := *token
	proxy.Director = func(req *http.Request) {
		origDirector(req)
		req.Host = hermesTarget.Host
		if capturedToken != "" && req.Header.Get("Authorization") == "" {
			req.Header.Set("Authorization", "Bearer "+capturedToken)
		}
	}

	http.Handle("/api/", proxy)
	http.Handle("/v1/", proxy)
	http.Handle("/health", proxy)

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
			r.URL.Path = "/"
		}
		fileServer.ServeHTTP(w, r)
	})

	// Launch URL. Pebble connects through its first-run setup wizard, not URL
	// params — so this is the bare origin. The wizard asks only for an "Agent
	// URL" (this same origin, since the launcher reverse-proxies /api/* to
	// Hermes and injects the API token itself — Pebble never sends one).
	pebbleBase := fmt.Sprintf("http://localhost:%s", *port)
	addr := ":" + *port
	launchURL := pebbleBase

	line := strings.Repeat("━", 56)
	fmt.Printf("\n%s\n", line)
	fmt.Println(" Pebble — Hermes PWA Chat Interface")
	fmt.Println(line)
	fmt.Printf("\n Serving on http://localhost:%s\n", *port)
	fmt.Printf(" Hermes API %s\n", *hermes)

	if *token == "" {
		fmt.Println("\n ⚠ No API key found. Pass --token <key> or set API_SERVER_KEY")
		fmt.Println("   in ~/.hermes/.env, then restart this launcher.")
	}

	// Plugin install status line. When the plugin was just installed or
	// updated, the gateway must be restarted before the agent can talk to
	// Pebble — so we lead with that and frame the URL as a second step.
	needsRestart := pluginErr == nil && (pluginInstalled || pluginUpdated)

	switch {
	case pluginErr != nil:
		fmt.Printf("\n ⚠ Hermes plugin: could not install (%v)\n", pluginErr)
	case pluginUpdated:
		fmt.Println("\n ✓ Hermes plugin updated.")
	case pluginInstalled:
		fmt.Println("\n ✓ Hermes plugin installed.")
	default:
		fmt.Println("\n ✓ Hermes plugin up to date")
	}

	if needsRestart {
		fmt.Println("\n ⚠ Restart the Hermes gateway FIRST — the agent can't reach")
		fmt.Println("   Pebble until the plugin is loaded:")
		fmt.Println("\n     hermes gateway restart")
		fmt.Printf("\n Then open this URL in your browser:\n\n")
	} else {
		fmt.Printf("\n Open this URL in your browser:\n\n")
	}
	fmt.Printf("   %s\n", launchURL)

	// First run shows a setup wizard that asks only for the Agent URL (this same
	// origin — the launcher proxies /api/* to Hermes and adds the token itself).
	// After that Pebble reconnects on its own. To reach it from a phone, expose
	// this launcher over Tailscale: `tailscale serve --bg PORT`, then use the
	// resulting https://<host>.ts.net URL as the Agent URL.
	fmt.Printf("\n On first run, the setup wizard asks for:\n")
	fmt.Printf("   Agent URL:   %s\n", pebbleBase)
	fmt.Printf("   (over Tailscale, use your https://<host>.ts.net URL instead)\n")
	fmt.Printf("\n%s\n\n", line)

	if *open {
		openBrowser(launchURL)
	}

	if err := http.ListenAndServe(addr, nil); err != nil {
		if errors.Is(err, syscall.EADDRINUSE) {
			fmt.Fprintf(os.Stderr, "\n ✗ Port %s is already in use — Pebble may already be running.\n", *port)
			fmt.Fprintf(os.Stderr, "   Stop the existing process first: lsof -ti:%s | xargs kill\n", *port)
			fmt.Fprintf(os.Stderr, "   Or start on a different port: --port <other>\n\n")
			os.Exit(1)
		}
		fmt.Fprintln(os.Stderr, "server error:", err)
		os.Exit(1)
	}
}

// installHermesPlugin extracts the embedded hermes-plugin/ to
// ~/.hermes/plugins/pebble/, skipping if the installed version is already
// current. Returns (installed, updated, err).
//
//   - installed=true, updated=false  → fresh install (wasn't there before)
//   - installed=false, updated=true  → version bumped, files overwritten
//   - installed=false, updated=false → already up to date, nothing done
func installHermesPlugin() (installed bool, updated bool, err error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return false, false, fmt.Errorf("home dir: %w", err)
	}

	destDir := filepath.Join(home, ".hermes", "plugins", "pebble")

	// Read the embedded plugin.yaml to get the bundled version.
	embeddedVersion, err := readVersionFromEmbedded()
	if err != nil {
		return false, false, fmt.Errorf("read embedded version: %w", err)
	}

	// Check what's already installed.
	installedVersion := readInstalledVersion(destDir)

	freshInstall := installedVersion == ""
	alreadyCurrent := !freshInstall && installedVersion == embeddedVersion

	if alreadyCurrent {
		return false, false, nil
	}

	// Extract all files from hermes-plugin/ into destDir.
	if err := extractPlugin(destDir); err != nil {
		return false, false, fmt.Errorf("extract plugin: %w", err)
	}

	if freshInstall {
		return true, false, nil
	}
	return false, true, nil
}

// readVersionFromEmbedded parses the version field from the embedded plugin.yaml.
func readVersionFromEmbedded() (string, error) {
	data, err := pluginFS.ReadFile("hermes-plugin/plugin.yaml")
	if err != nil {
		return "", err
	}
	return parseVersionFromYAML(string(data)), nil
}

// readInstalledVersion reads the version from an already-installed plugin.yaml.
// Returns "" if the file doesn't exist or has no version field.
func readInstalledVersion(destDir string) string {
	data, err := os.ReadFile(filepath.Join(destDir, "plugin.yaml"))
	if err != nil {
		return ""
	}
	return parseVersionFromYAML(string(data))
}

// parseVersionFromYAML extracts the value of a top-level "version:" key.
// Handles both quoted and unquoted values. No external YAML parser needed.
func parseVersionFromYAML(content string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "version:") {
			continue
		}
		val := strings.TrimSpace(strings.TrimPrefix(line, "version:"))
		val = strings.Trim(val, `"'`)
		return val
	}
	return ""
}

// extractPlugin walks the embedded hermes-plugin/ FS and writes every file
// into destDir, creating subdirectories as needed.
func extractPlugin(destDir string) error {
	return fs.WalkDir(pluginFS, "hermes-plugin", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Compute destination path by stripping the "hermes-plugin/" prefix.
		rel := strings.TrimPrefix(path, "hermes-plugin")
		rel = strings.TrimPrefix(rel, string(os.PathSeparator))
		rel = strings.TrimPrefix(rel, "/")
		dest := filepath.Join(destDir, rel)

		if d.IsDir() {
			return os.MkdirAll(dest, 0755)
		}

		// Read from embedded FS.
		src, err := pluginFS.Open(path)
		if err != nil {
			return fmt.Errorf("open embedded %s: %w", path, err)
		}
		defer src.Close()

		// Write to destination (creates or overwrites).
		if err := os.MkdirAll(filepath.Dir(dest), 0755); err != nil {
			return err
		}
		dst, err := os.Create(dest)
		if err != nil {
			return fmt.Errorf("create %s: %w", dest, err)
		}
		defer dst.Close()

		if _, err := io.Copy(dst, src); err != nil {
			return fmt.Errorf("write %s: %w", dest, err)
		}
		return nil
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// readHermesEnv parses ~/.hermes/.env into a key→value map.
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
