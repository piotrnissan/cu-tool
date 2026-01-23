"use client";

import { useEffect, useState } from "react";

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

export default function QAPage() {
  const [selectedComponent, setSelectedComponent] = useState("none");
  const [decision, setDecision] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

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
        const timestamp = new Date().toLocaleTimeString();
        setLastAction(`Saved at ${timestamp}`);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Human QA</h1>
      <p style={{ marginTop: "1rem", marginBottom: "2rem" }}>
        Use keyboard shortcuts: 1=correct, 2=wrong_type, 3=false_positive,
        4=missing, 5=unclear, Ctrl/Cmd+Enter=save
      </p>

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
            <strong>Last action:</strong> {lastAction || "(none)"}
          </p>
        </div>
      </div>
    </div>
  );
}
