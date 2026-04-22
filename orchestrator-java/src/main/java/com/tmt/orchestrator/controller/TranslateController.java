package com.tmt.orchestrator.controller;

import com.tmt.orchestrator.model.Language;
import com.tmt.orchestrator.model.LanguagePair;
import com.tmt.orchestrator.model.TranslationStats;
import com.tmt.orchestrator.service.OrchestrationService;
import com.tmt.orchestrator.service.OrchestrationService.TranslationResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * REST controller for the translation API.
 */
@RestController
@RequestMapping("/api/v1")
@CrossOrigin(origins = "*")
public class TranslateController {

    private static final Logger log = LoggerFactory.getLogger(TranslateController.class);

    private final OrchestrationService orchestrationService;

    // Supported file extensions
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(
        ".pdf", ".docx", ".csv", ".tsv"
    );

    // Max file size: 1MB
    private static final long MAX_FILE_SIZE = 1024 * 1024;

    // Content type mapping
    private static final Map<String, String> CONTENT_TYPES = Map.of(
        ".pdf", "application/pdf",
        ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".csv", "text/csv",
        ".tsv", "text/tab-separated-values"
    );

    public TranslateController(OrchestrationService orchestrationService) {
        this.orchestrationService = orchestrationService;
    }

    /**
     * POST /api/v1/translate
     * 
     * Translates a document file from source to target language.
     * Returns the translated file with statistics in response headers.
     */
    @PostMapping(value = "/translate", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<byte[]> translate(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "sourceLang", defaultValue = "en") String sourceLang,
        @RequestParam("targetLang") String targetLang
    ) {
        log.info("Translation request: {} ({} bytes), {} → {}",
            file.getOriginalFilename(), file.getSize(), sourceLang, targetLang);

        // ── Validate file ──
        String filename = file.getOriginalFilename();
        if (filename == null || filename.isEmpty()) {
            return ResponseEntity.badRequest().body("No filename provided".getBytes());
        }

        String ext = getExtension(filename);
        if (!SUPPORTED_EXTENSIONS.contains(ext)) {
            return ResponseEntity.badRequest()
                .body(("Unsupported file type: " + ext + ". Supported: " + SUPPORTED_EXTENSIONS).getBytes());
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            return ResponseEntity.badRequest()
                .body(("File too large: " + file.getSize() + " bytes. Max: 1MB").getBytes());
        }

        // ── Validate language pair ──
        try {
            Language.fromCode(sourceLang);
            Language.fromCode(targetLang);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                .body(("Invalid language code: " + e.getMessage()).getBytes());
        }

        if (sourceLang.equals(targetLang)) {
            return ResponseEntity.badRequest()
                .body("Source and target language must be different".getBytes());
        }

        // ── Execute translation ──
        try {
            TranslationResult result = orchestrationService.translate(file, sourceLang, targetLang);
            TranslationStats stats = result.stats();

            // Build output filename
            String nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
            String outputFilename = nameWithoutExt + "_translated" + ext;

            // Build response with stats headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                CONTENT_TYPES.getOrDefault(ext, "application/octet-stream")
            ));
            headers.set("Content-Disposition", "attachment; filename=\"" + outputFilename + "\"");
            headers.set("X-Segments-Count", String.valueOf(stats.segmentCount()));
            headers.set("X-Cache-Hits", String.valueOf(stats.cacheHits()));
            headers.set("X-Api-Calls", String.valueOf(stats.apiCalls()));
            headers.set("X-Processing-Time-Ms", String.valueOf(stats.processingTimeMs()));

            // Expose custom headers to frontend
            headers.setAccessControlExposeHeaders(List.of(
                "X-Segments-Count", "X-Cache-Hits", "X-Api-Calls",
                "X-Processing-Time-Ms", "Content-Disposition"
            ));

            return new ResponseEntity<>(result.fileBytes(), headers, HttpStatus.OK);

        } catch (Exception e) {
            log.error("Translation failed for {}: {}", filename, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(("Translation failed: " + e.getMessage()).getBytes());
        }
    }

    /**
     * GET /api/v1/translate/languages
     * 
     * Returns all supported translation directions.
     */
    @GetMapping("/translate/languages")
    public ResponseEntity<List<LanguagePair>> getLanguages() {
        List<LanguagePair> pairs = new ArrayList<>();

        Language[] langs = Language.values();
        for (Language source : langs) {
            for (Language target : langs) {
                if (source != target) {
                    pairs.add(new LanguagePair(
                        source.getCode(), source.getDisplayName(),
                        target.getCode(), target.getDisplayName()
                    ));
                }
            }
        }

        return ResponseEntity.ok(pairs);
    }

    /**
     * GET /api/v1/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "healthy",
            "service", "orchestrator"
        ));
    }

    private String getExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        if (lastDot >= 0) {
            return filename.substring(lastDot).toLowerCase();
        }
        return "";
    }
}
