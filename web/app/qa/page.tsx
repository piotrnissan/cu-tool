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

// Demo detections list for auto-advance (placeholder until TH-31+)
const DEMO_DETECTIONS = ["d1", "d2", "d3", "d4", "d5"];

export default function QAPage() {
  const [selectedComponent, setSelectedComponent] = useState("none");
  const [decision, setDecision] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState("unknown");
  const [cardType, setCardType] = useState("unknown");
  const [note, setNote] = useState("");
  const [correctedComponent, setCorrectedComponent] = useState("none");
  const [currentDetectionIndex, setCurrentDetectionIndex] = useState(0);

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

    const payload: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      page_url: "unknown",
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
        const nextIndex = (currentDetectionIndex + 1) % DEMO_DETECTIONS.length;
        setCurrentDetectionIndex(nextIndex);
        const nextId = DEMO_DETECTIONS[nextIndex];

        // Reset form fields for next review
        setDecision(null);
        setSelectedComponent("none");
        setMediaType("unknown");
        setCardType("unknown");
        setCorrectedComponent("none");
        setNote("");

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
    <div style={{ padding: "2rem" }}>
      <h1>Human QA</h1>
      <p style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        Use keyboard shortcuts: 1=correct, 2=wrong_type, 3=false_positive,
        4=missing, 5=unclear, Ctrl/Cmd+Enter=save
      </p>

      <div
        style={{
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: "#fff3cd",
          borderRadius: "4px",
          border: "1px solid #ffc107",
        }}
      >
        <strong>Detection (demo list):</strong>{" "}
        {DEMO_DETECTIONS[currentDetectionIndex]} ({currentDetectionIndex + 1}/
        {DEMO_DETECTIONS.length})
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <label
          htmlFor="component-select"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
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
        <div style={{ marginBottom: "2rem" }}>
          <label
            htmlFor="media-type-select"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "bold",
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
        <div style={{ marginBottom: "2rem" }}>
          <label
            htmlFor="card-type-select"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "bold",
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
        <div style={{ marginBottom: "2rem" }}>
          <label
            htmlFor="corrected-component-select"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: "bold",
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

      <div style={{ marginBottom: "2rem" }}>
        <label
          htmlFor="note-textarea"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          Note (optional):
        </label>
        <textarea
          id="note-textarea"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            width: "100%",
            maxWidth: "600px",
            fontFamily: "inherit",
          }}
          placeholder="Optional note about this detection..."
        />
      </div>

      <div
        style={{
          border: "2px solid #ccc",
          padding: "1.5rem",
          borderRadius: "4px",
          backgroundColor: "#f9f9f9",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.2rem" }}>Current State</h2>
        <div style={{ marginTop: "1rem" }}>
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
    </div>
  );
}
