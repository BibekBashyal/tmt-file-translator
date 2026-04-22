package com.tmt.orchestrator.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tmt.orchestrator.model.ExtractResponse;
import com.tmt.orchestrator.model.Segment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.IOException;
import java.util.List;

/**
 * HTTP client for the Python document service.
 * Handles file upload/download and JSON serialization.
 */
@Service
public class DocumentServiceClient {

    private static final Logger log = LoggerFactory.getLogger(DocumentServiceClient.class);

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public DocumentServiceClient(WebClient docServiceWebClient, ObjectMapper objectMapper) {
        this.webClient = docServiceWebClient;
        this.objectMapper = objectMapper;
    }

    /**
     * Call doc-service /extract to parse a document into segments.
     */
    public ExtractResponse extract(MultipartFile file) throws IOException {
        log.info("Calling doc-service /extract for: {}", file.getOriginalFilename());

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", new ByteArrayResource(file.getBytes()) {
            @Override
            public String getFilename() {
                return file.getOriginalFilename();
            }
        }).contentType(MediaType.APPLICATION_OCTET_STREAM);

        ExtractResponse response = webClient.post()
            .uri("/extract")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(BodyInserters.fromMultipartData(builder.build()))
            .retrieve()
            .bodyToMono(ExtractResponse.class)
            .block();

        if (response == null) {
            throw new RuntimeException("Doc-service /extract returned null");
        }

        log.info("Extracted {} segments from {}", response.segment_count(), file.getOriginalFilename());
        return response;
    }

    /**
     * Call doc-service /reconstruct to rebuild a document with translated segments.
     */
    public byte[] reconstruct(MultipartFile originalFile, List<Segment> translatedSegments) throws IOException {
        log.info("Calling doc-service /reconstruct with {} segments", translatedSegments.size());

        String segmentsJson = objectMapper.writeValueAsString(translatedSegments);

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", new ByteArrayResource(originalFile.getBytes()) {
            @Override
            public String getFilename() {
                return originalFile.getOriginalFilename();
            }
        }).contentType(MediaType.APPLICATION_OCTET_STREAM);
        builder.part("segments", segmentsJson);

        byte[] result = webClient.post()
            .uri("/reconstruct")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(BodyInserters.fromMultipartData(builder.build()))
            .retrieve()
            .bodyToMono(byte[].class)
            .block();

        if (result == null) {
            throw new RuntimeException("Doc-service /reconstruct returned null");
        }

        log.info("Reconstructed document: {} bytes", result.length);
        return result;
    }
}
