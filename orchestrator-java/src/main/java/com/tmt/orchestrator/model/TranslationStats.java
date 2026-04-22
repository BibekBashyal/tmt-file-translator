package com.tmt.orchestrator.model;

/**
 * Statistics about a translation operation.
 */
public record TranslationStats(
    int segmentCount,
    int cacheHits,
    int apiCalls,
    long processingTimeMs
) {}
