package com.tmt.orchestrator.model;

import java.util.List;

/**
 * Response from the doc-service /extract endpoint.
 */
public record ExtractResponse(
    List<Segment> segments,
    String file_type,
    int segment_count
) {}
