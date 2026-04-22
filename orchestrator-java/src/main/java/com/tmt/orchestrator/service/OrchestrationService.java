package com.tmt.orchestrator.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.tmt.orchestrator.model.ExtractResponse;
import com.tmt.orchestrator.model.Segment;
import com.tmt.orchestrator.model.TranslationStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/**
 * Core orchestration service implementing the full translation pipeline:
 * 
 * 1. Extract segments from document (via doc-service)
 * 2. Check cache for existing translations
 * 3. Translate uncached segments (via TMT API, with batching)
 * 4. Cache new translations
 * 5. Reconstruct document (via doc-service)
 * 
 * Returns the translated file bytes and statistics.
 */
@Service
public class OrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(OrchestrationService.class);

    private final DocumentServiceClient docServiceClient;
    private final TranslationService translationService;
    private final Cache<String, String> translationCache;

    public OrchestrationService(
        DocumentServiceClient docServiceClient,
        TranslationService translationService,
        Cache<String, String> translationCache
    ) {
        this.docServiceClient = docServiceClient;
        this.translationService = translationService;
        this.translationCache = translationCache;
    }

    /**
     * Execute the full translation pipeline.
     *
     * @return TranslationResult containing file bytes and stats
     */
    public TranslationResult translate(
        MultipartFile file, String sourceLang, String targetLang
    ) throws Exception {
        long startTime = System.currentTimeMillis();

        // ── Step 1: Extract segments ──
        log.info("Step 1: Extracting segments from {}", file.getOriginalFilename());
        ExtractResponse extractResponse = docServiceClient.extract(file);
        List<Segment> segments = extractResponse.segments();
        log.info("Extracted {} segments", segments.size());

        if (segments.isEmpty()) {
            // No text to translate — return original file
            byte[] reconstructed = docServiceClient.reconstruct(file, segments);
            long elapsed = System.currentTimeMillis() - startTime;
            return new TranslationResult(
                reconstructed,
                new TranslationStats(0, 0, 0, elapsed)
            );
        }

        // ── Step 2: Check cache ──
        log.info("Step 2: Checking cache for {} segments", segments.size());
        List<Segment> cachedSegments = new ArrayList<>();
        List<Segment> uncachedSegments = new ArrayList<>();

        for (Segment seg : segments) {
            String cacheKey = buildCacheKey(seg.text(), sourceLang, targetLang);
            String cached = translationCache.getIfPresent(cacheKey);

            if (cached != null) {
                cachedSegments.add(seg.withText(cached));
            } else {
                uncachedSegments.add(seg);
            }
        }

        int cacheHits = cachedSegments.size();
        log.info("Cache: {} hits, {} misses", cacheHits, uncachedSegments.size());

        // ── Step 3: Translate uncached segments ──
        List<Segment> newlyTranslated = new ArrayList<>();
        int apiCalls = 0;

        if (!uncachedSegments.isEmpty()) {
            log.info("Step 3: Translating {} uncached segments", uncachedSegments.size());
            apiCalls = translationService.estimateApiCalls(uncachedSegments);
            newlyTranslated = translationService.translateSegments(
                uncachedSegments, sourceLang, targetLang
            );

            // ── Step 4: Cache new translations ──
            log.info("Step 4: Caching {} new translations", newlyTranslated.size());
            for (int i = 0; i < uncachedSegments.size(); i++) {
                String originalText = uncachedSegments.get(i).text();
                String translatedText = newlyTranslated.get(i).text();
                if (!translatedText.equals("[translation failed]")) {
                    String cacheKey = buildCacheKey(originalText, sourceLang, targetLang);
                    translationCache.put(cacheKey, translatedText);
                }
            }
        }

        // ── Merge all translated segments (sorted by ID) ──
        List<Segment> allTranslated = new ArrayList<>();
        allTranslated.addAll(cachedSegments);
        allTranslated.addAll(newlyTranslated);
        allTranslated.sort((a, b) -> Integer.compare(a.id(), b.id()));

        // ── Step 5: Reconstruct document ──
        log.info("Step 5: Reconstructing document with {} translated segments", allTranslated.size());
        byte[] reconstructedFile = docServiceClient.reconstruct(file, allTranslated);

        long elapsed = System.currentTimeMillis() - startTime;
        TranslationStats stats = new TranslationStats(
            segments.size(), cacheHits, apiCalls, elapsed
        );

        log.info("Translation complete in {}ms: {} segments, {} cache hits, {} API calls",
            elapsed, segments.size(), cacheHits, apiCalls);

        return new TranslationResult(reconstructedFile, stats);
    }

    /**
     * Build a cache key from text + language pair using SHA-256.
     */
    private String buildCacheKey(String text, String sourceLang, String targetLang) {
        try {
            String input = text + "|" + sourceLang + "|" + targetLang;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is always available in JDK
            throw new RuntimeException(e);
        }
    }

    /**
     * Result of a translation operation.
     */
    public record TranslationResult(
        byte[] fileBytes,
        TranslationStats stats
    ) {}
}
