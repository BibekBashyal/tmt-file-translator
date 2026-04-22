package com.tmt.orchestrator.model;

/**
 * A supported translation direction.
 */
public record LanguagePair(
    String sourceCode,
    String sourceName,
    String targetCode,
    String targetName
) {}
