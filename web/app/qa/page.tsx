"use client";

import { useCallback, useEffect, useState } from "react";

const COMPONENT_TYPES = [
  "none",
  "hero",
  "promo_section",
  "media_text_split",
  "cards_section",
  "image_carousel",
  "card_carousel",
  "icon_grid",
  "info_specs",
  "next_action_panel",
  "anchor_nav",
  "tabs",
  "accordion",
  "other",
];

const DECISIONS = [
  "correct",
  "wrong_type",
  "false_positive",
  "missing",
  "unclear",
];

const MEDIA_TYPES = ["image", "video", "carousel", "unknown"];
const CARD_TYPES = ["product", "offer", "editorial", "unknown"];

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Detection {
  detection_id: string;
  slug: string;
  page_url: string;
  component_key: string;
  bbox: BoundingBox;
}

export default function QAPage() {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState("none");
  const [decision, setDecision] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("unknown");
  const [cardType, setCardType] = useState("unknown");
  const [note, setNote] = useState("");
  const [correctedComponent, setCorrectedComponent] = useState("none");
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);

  // Load detections from API on mount
  useEffect(() => {
    async function loadDetections() {
      try {
        setLoading(true);
        const response = await fetch("/api/qa/detections");
        const result = await response.json();

        if (!result.ok) {
          setError(result.error || "Failed to load detections");
          return;
        }

        if (result.items.length === 0) {
          setError("No detection instances found in proof pack");
          return;
        }

        setDetections(result.items);
        setError(null);
      } catch (err) {
        setError(`Failed to load detections: ${String(err)}`);
      } finally {
        setLoading(false);
      }
    }

    loadDetections();
  }, []);

  const currentDetection = detections[currentDetectionIndex];

  // Preselect component based on detected component_key when detection changes
  useEffect(() => {
    if (!currentDetection) return;

    setSelectedComponent(currentDetection.component_key);
    setDecision(null);
    setMediaType("unknown");
    setCardType("unknown");
    setCorrectedComponent("none");
    setNote("");
  }, [currentDetectionIndex, currentDetection]);

  // Reset variant state when component changes
  useEffect(() => {
    if (selectedComponent === "media_text_split") {
      if (!MEDIA_TYPES.includes(mediaType)) {
        setMediaType("unknown");
      }
    } else if (
      selectedComponent === "cards_section" ||
      selectedComponent === "card_carousel"
    ) {
      if (!CARD_TYPES.includes(cardType)) {
        setCardType("unknown");
      }
    }
  }, [selectedComponent, mediaType, cardType]);

  const handleSave = useCallback(async () => {
    if (!decision) {
      setLastAction("Save failed: No decision selected");
      return;
    }

    if (!currentDetection) {
      setLastAction("Save failed: No detection loaded");
      return;
    }

    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      detection_id: currentDetection.detection_id,
      page_url: currentDetection.page_url,
      component_key: selectedComponent,
      decision,
    };

    // Add corrected component key if wrong_type
    if (decision === "wrong_type") {
      payload.corrected_component_key = correctedComponent;
    }

    // Add media_type for media_text_split
    if (selectedComponent === "media_text_split") {
      payload.media_type = mediaType;
    }

    // Add card_type for cards_section / card_carousel
    if (
      selectedComponent === "cards_section" ||
      selectedComponent === "card_carousel"
    ) {
      payload.card_type = cardType;
    }

    // Add note if provided
    if (note.trim()) {
      payload.note = note.trim();
    }

    try {
      const response = await fetch("/api/qa/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.ok) {
        const timestamp = new Date().toLocaleTimeString();

        // Auto-advance to next detection
        const nextIndex = (currentDetectionIndex + 1) % detections.length;
        setCurrentDetectionIndex(nextIndex);
        const nextId = detections[nextIndex]?.detection_id || "end";

        setLastAction(`Saved at ${timestamp} — Advanced to ${nextId}`);
      } else {
        setLastAction(`Save failed: ${result.error || "Unknown error"}`);
      }
    } catch (error) {
      setLastAction(`Save failed: ${String(error)}`);
    }
  }, [
    selectedComponent,
    decision,
    mediaType,
    cardType,
    note,
    correctedComponent,
    currentDetectionIndex,
    currentDetection,
    detections,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle number keys 1-5 for decisions
      if (e.key >= "1" && e.key <= "5") {
        const index = parseInt(e.key, 10) - 1;
        setDecision(DECISIONS[index]);
        return;
      }

      // Handle Ctrl+Enter or Cmd+Enter for save
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* LEFT COLUMN: QA Form */}
      <div
        style={{
          width: "440px",
          flexShrink: 0,
          overflow: "hidden",
          padding: "1rem",
          borderRight: "1px solid #ccc",
        }}
      >
        {loading && (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <p>Loading detection queue...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8d7da",
              borderRadius: "4px",
              border: "1px solid #f5c2c7",
              color: "#842029",
              fontSize: "0.9rem",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && detections.length > 0 && currentDetection && (
          <>
            <p
              style={{
                margin: "0 0 0.75rem 0",
                fontSize: "0.85rem",
                opacity: 0.7,
              }}
            >
              1=correct, 2=wrong_type, 3=false_positive, 4=missing, 5=unclear,
              Cmd+Enter=save
            </p>

            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem",
                backgroundColor: "#fff3cd",
                borderRadius: "4px",
                border: "1px solid #ffc107",
                color: "#111",
                fontSize: "0.9rem",
              }}
            >
              <div>
                <strong>Detection:</strong> {currentDetectionIndex + 1}/
                {detections.length} — {currentDetection.detection_id}
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                <strong>Page:</strong>{" "}
                {currentDetection.page_url
                  .replace(/^https?:\/\//, "")
                  .replace(/\/$/, "")}
              </div>
              <div style={{ marginTop: "0.25rem" }}>
                <strong>Detected:</strong> {currentDetection.component_key}
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="component-select"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                }}
              >
                Component Type:
              </label>
              <select
                id="component-select"
                value={selectedComponent}
                onChange={(e) => setSelectedComponent(e.target.value)}
                style={{
                  padding: "0.5rem",
                  fontSize: "1rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  minWidth: "200px",
                }}
              >
                {COMPONENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {selectedComponent === "media_text_split" && (
              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="media-type-select"
                  style={{
                    display: "block",
                    marginBottom: "0.35rem",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                  }}
                >
                  Media type:
                </label>
                <select
                  id="media-type-select"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  style={{
                    padding: "0.5rem",
                    fontSize: "1rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    minWidth: "200px",
                  }}
                >
                  {MEDIA_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(selectedComponent === "cards_section" ||
              selectedComponent === "card_carousel") && (
              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="card-type-select"
                  style={{
                    display: "block",
                    marginBottom: "0.35rem",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                  }}
                >
                  Card type:
                </label>
                <select
                  id="card-type-select"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                  style={{
                    padding: "0.5rem",
                    fontSize: "1rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    minWidth: "200px",
                  }}
                >
                  {CARD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {decision === "wrong_type" && (
              <div style={{ marginBottom: "1rem" }}>
                <label
                  htmlFor="corrected-component-select"
                  style={{
                    display: "block",
                    marginBottom: "0.35rem",
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                  }}
                >
                  Corrected component type:
                </label>
                <select
                  id="corrected-component-select"
                  value={correctedComponent}
                  onChange={(e) => setCorrectedComponent(e.target.value)}
                  style={{
                    padding: "0.5rem",
                    fontSize: "1rem",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                    minWidth: "200px",
                  }}
                >
                  {COMPONENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="note-textarea"
                style={{
                  display: "block",
                  marginBottom: "0.35rem",
                  fontWeight: "bold",
                  fontSize: "0.9rem",
                }}
              >
                Note (optional):
              </label>
              <textarea
                id="note-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{
                  padding: "0.5rem",
                  fontSize: "1rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  width: "100%",
                  fontFamily: "inherit",
                }}
                placeholder="Optional note about this detection..."
              />
            </div>

            <div
              style={{
                border: "1px solid #ccc",
                padding: "0.75rem",
                borderRadius: "4px",
                backgroundColor: "rgba(255,255,255,0.06)",
                color: "inherit",
                marginBottom: "0.5rem",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: "0.5rem",
                  fontSize: "1rem",
                }}
              >
                Current State
              </h2>
              <div style={{ fontSize: "0.9rem" }}>
                <p>
                  <strong>Selected component:</strong> {selectedComponent}
                </p>
                <p>
                  <strong>Decision:</strong> {decision || "(none)"}
                </p>
                <p>
                  <strong>Variant:</strong>{" "}
                  {selectedComponent === "media_text_split"
                    ? `media_type=${mediaType}`
                    : selectedComponent === "cards_section" ||
                        selectedComponent === "card_carousel"
                      ? `card_type=${cardType}`
                      : "(n/a)"}
                </p>
                <p>
                  <strong>Last action:</strong> {lastAction || "(none)"}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: Preview Panel */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>
          Preview
        </h2>

        {loading && (
          <div
            style={{
              border: "2px dashed #666",
              borderRadius: "4px",
              padding: "2rem",
              textAlign: "center",
              color: "inherit",
              opacity: 0.6,
            }}
          >
            <p>Loading preview...</p>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              border: "2px dashed #666",
              borderRadius: "4px",
              padding: "2rem",
              textAlign: "center",
              color: "inherit",
              opacity: 0.6,
            }}
          >
            <p>Preview unavailable</p>
          </div>
        )}

        {!loading && !error && !currentDetection && (
          <div
            style={{
              border: "2px dashed #666",
              borderRadius: "4px",
              padding: "2rem",
              textAlign: "center",
              color: "inherit",
              opacity: 0.6,
            }}
          >
            <p>No detection selected</p>
          </div>
        )}

        {!loading && !error && currentDetection && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qa/screenshot?slug=${currentDetection.slug}`}
              alt={`Annotated screenshot for ${currentDetection.slug}`}
              style={{
                maxWidth: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
