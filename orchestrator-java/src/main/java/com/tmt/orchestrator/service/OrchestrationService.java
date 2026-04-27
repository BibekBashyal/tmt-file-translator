package com.tmt.orchestrator.service;

import com.github.benmanes.caffeine.cache.Cache;
import com.tmt.orchestrator.model.ExtractResponse;
import com.tmt.orchestrator.model.Segment;
import com.tmt.orchestrator.model.TranslationStats;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
            byte[] reconstructed = docServiceClient.reconstruct(file, segments);
            long elapsed = System.currentTimeMillis() - startTime;
            return new TranslationResult(reconstructed, new TranslationStats(0, 0, 0, elapsed));
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
        log.info("Cache: {} hits, {} misses", cachedSegments.size(), uncachedSegments.size());

        // ── Step 3: Deduplicate, translate, fan out ──
        List<Segment> newlyTranslated = new ArrayList<>();
        int apiCalls = 0;

        if (!uncachedSegments.isEmpty()) {
            // Group by exact text — LinkedHashMap preserves insertion order for fan-out alignment
            Map<String, List<Segment>> byText = new LinkedHashMap<>();
            for (Segment seg : uncachedSegments) {
                byText.computeIfAbsent(seg.text(), k -> new ArrayList<>()).add(seg);
            }

            int uniqueCount = byText.size();
            int deduped = uncachedSegments.size() - uniqueCount;
            if (deduped > 0) {
                log.info("Deduplication: {} segments → {} unique texts ({} duplicates eliminated)",
                    uncachedSegments.size(), uniqueCount, deduped);
            }

            // One representative segment per unique text
            List<Segment> uniqueReps = byText.values().stream()
                .map(list -> list.get(0))
                .collect(Collectors.toList());

            apiCalls = uniqueReps.size();
            log.info("Step 3: Translating {} unique texts", apiCalls);
            List<Segment> uniqueTranslated = translationService.translateSegments(
                uniqueReps, sourceLang, targetLang);

            // Fan translated text back to every segment that shared the same original text
            Iterator<Map.Entry<String, List<Segment>>> iter = byText.entrySet().iterator();
            for (int i = 0; i < uniqueTranslated.size(); i++) {
                String translatedText = uniqueTranslated.get(i).text();
                List<Segment> group = iter.next().getValue();
                for (Segment seg : group) {
                    newlyTranslated.add(seg.withText(translatedText));
                }
            }

            // ── Step 4: Cache new translations ──
            log.info("Step 4: Caching {} new translations", uniqueTranslated.size());
            for (int i = 0; i < uniqueReps.size(); i++) {
                String translatedText = uniqueTranslated.get(i).text();
                if (!translatedText.equals("[translation failed]")) {
                    translationCache.put(
                        buildCacheKey(uniqueReps.get(i).text(), sourceLang, targetLang),
                        translatedText
                    );
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
            segments.size(), cachedSegments.size(), apiCalls, elapsed);

        log.info("Translation complete in {}ms: {} segments, {} cache hits, {} API calls",
            elapsed, segments.size(), cachedSegments.size(), apiCalls);

        return new TranslationResult(reconstructedFile, stats);
    }

    private String buildCacheKey(String text, String sourceLang, String targetLang) {
        return sourceLang + "\0" + targetLang + "\0" + text;
    }

    public record TranslationResult(byte[] fileBytes, TranslationStats stats) {}
}
