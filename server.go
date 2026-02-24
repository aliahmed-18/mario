// ============================================================
//  Mario JS — Game Server  (static files + Scoreboard API)
//  Usage:  go run server.go
//
//  Put this file in the SAME folder as index.html, app.js,
//  styles.css and the images/ directory, then run:
//
//    go run server.go
//
//  Open your browser at:  http://localhost:8080
//
//  API Endpoints:
//    GET  /scores  — return all scores sorted desc by score
//    POST /scores  — save a new score entry (JSON body)
// ============================================================

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"sync"
)

// ── Data model ───────────────────────────────────────────────

type ScoreEntry struct {
	Name  string `json:"name"`
	Score int    `json:"score"`
	Time  string `json:"time"` // "MM:SS"
}

// ── In-memory store + file persistence ──────────────────────

const dataFile = "scores.json"

var (
	mu     sync.RWMutex
	scores []ScoreEntry
)

func loadScores() {
	data, err := os.ReadFile(dataFile)
	if err != nil {
		// File doesn't exist yet — start fresh, that's fine
		scores = []ScoreEntry{}
		return
	}
	if err := json.Unmarshal(data, &scores); err != nil {
		log.Printf("warn: could not parse %s: %v — starting fresh", dataFile, err)
		scores = []ScoreEntry{}
	}
}

func saveScores() error {
	data, err := json.MarshalIndent(scores, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(dataFile, data, 0644)
}

func sortedScores() []ScoreEntry {
	cp := make([]ScoreEntry, len(scores))
	copy(cp, scores)
	sort.Slice(cp, func(i, j int) bool {
		return cp[i].Score > cp[j].Score
	})
	return cp
}

// ── CORS helper ──────────────────────────────────────────────

func setCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// ── /scores  GET ─────────────────────────────────────────────

func handleGetScores(w http.ResponseWriter, r *http.Request) {
	setCORS(w)
	w.Header().Set("Content-Type", "application/json")

	mu.RLock()
	result := sortedScores()
	mu.RUnlock()

	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("error encoding scores: %v", err)
	}
}

// ── /scores  POST ────────────────────────────────────────────

func handlePostScore(w http.ResponseWriter, r *http.Request) {
	setCORS(w)
	w.Header().Set("Content-Type", "application/json")

	var entry ScoreEntry
	if err := json.NewDecoder(r.Body).Decode(&entry); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, `{"error":"invalid JSON: %s"}`, err.Error())
		return
	}
	if entry.Name == "" {
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprint(w, `{"error":"name is required"}`)
		return
	}

	mu.Lock()
	scores = append(scores, entry)
	result := sortedScores()
	if err := saveScores(); err != nil {
		log.Printf("warn: could not persist scores: %v", err)
	}
	mu.Unlock()

	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Printf("error encoding response: %v", err)
	}
}

// ── /scores  OPTIONS preflight ───────────────────────────────

func handleOptions(w http.ResponseWriter, r *http.Request) {
	setCORS(w)
	w.WriteHeader(http.StatusNoContent)
}

// ── /scores  router ──────────────────────────────────────────

func scoresHandler(w http.ResponseWriter, r *http.Request) {
	setCORS(w)
	switch r.Method {
	case http.MethodGet:
		handleGetScores(w, r)
	case http.MethodPost:
		handlePostScore(w, r)
	case http.MethodOptions:
		handleOptions(w, r)
	default:
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		fmt.Fprint(w, `{"error":"method not allowed"}`)
	}
}

// ── Main ─────────────────────────────────────────────────────

func main() {
	loadScores()

	// ── API route: /scores ───────────────────────────────────
	// Must be registered BEFORE the catch-all file server so
	// Go's ServeMux routes /scores here, not to the filesystem.
	http.HandleFunc("/scores", scoresHandler)

	// ── Static file server ───────────────────────────────────
	// Serves everything in the current directory:
	//   /           →  index.html
	//   /styles.css →  styles.css
	//   /app.js     →  app.js
	//   /images/... →  images/...
	fs := http.FileServer(http.Dir("."))
	http.Handle("/", fs)

	port := "8080"
	fmt.Println("╔══════════════════════════════════════════════╗")
	fmt.Println("║       🍄  Mario JS  Game Server  🍄           ║")
	fmt.Println("╠══════════════════════════════════════════════╣")
	fmt.Printf( "║  Open game   →  http://localhost:%s           ║\n", port)
	fmt.Printf( "║  GET scores  →  http://localhost:%s/scores    ║\n", port)
	fmt.Printf( "║  POST score  →  http://localhost:%s/scores    ║\n", port)
	fmt.Println("╚══════════════════════════════════════════════╝")

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("server error: %v", err)
	}
}