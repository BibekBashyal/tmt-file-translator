package com.tmt.orchestrator.model;

import java.util.Map;

/**
 * Represents a single text segment extracted from a document.
 * Mirrors the Python Segment model for cross-service compatibility.
 */
public record Segment(
    int id,
    String text,
    Map<String, Object> meta
) {
    /**
     * Create a copy with translated text, preserving id and meta.
     */
    public Segment withText(String translatedText) {
        return new Segment(this.id, translatedText, this.meta);
    }
}
