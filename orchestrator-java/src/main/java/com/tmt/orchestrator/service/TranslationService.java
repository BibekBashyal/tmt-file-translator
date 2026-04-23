package com.tmt.orchestrator.service;

import com.tmt.orchestrator.client.TmtApiClient;
import com.tmt.orchestrator.model.Segment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

/**
 * Translation service handling batching, retries, and error resilience.
 */
@Service
public class TranslationService {

    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);

    private final TmtApiClient tmtApiClient;

    @Value("${app.tmt-api.batch-size:25}")
    private int batchSize;

    @Value("${app.tmt-api.max-chars-per-batch:5000}")
    private int maxCharsPerBatch;

    @Value("${app.tmt-api.retry.max-attempts:3}")
    private int maxRetryAttempts;

    @Value("${app.tmt-api.retry.initial-delay-ms:200}")
    private long initialDelayMs;

    public TranslationService(TmtApiClient tmtApiClient) {
        this.tmtApiClient = tmtApiClient;
    }

    /**
     * Translate a list of segments in optimized batches.
     * Uses adaptive batching by both count and character length.
     * Retries failed batches with exponential backoff.
     *
     * @return List of segments with translated text (same IDs, same meta)
     */
    public List<Segment> translateSegments(
        List<Segment> segments, String sourceLang, String targetLang
    ) {
        List<List<Segment>> batches = createBatches(segments);
        log.info("Translating {} batches ({} segments) in parallel", batches.size(), segments.size());

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<CompletableFuture<List<Segment>>> futures = batches.stream()
                .map(batch -> CompletableFuture.supplyAsync(
                    () -> translateBatch(batch, sourceLang, targetLang), executor
                ))
                .toList();

            List<Segment> allTranslated = new ArrayList<>();
            for (var future : futures) {
                allTranslated.addAll(future.join());
            }
            log.info("Parallel translation complete: {} segments", allTranslated.size());
            return allTranslated;
        }
    }

    public int estimateApiCalls(List<Segment> segments) {
        return createBatches(segments).size();
    }

    private List<Segment> translateBatch(List<Segment> batch, String sourceLang, String targetLang) {
        List<String> texts = batch.stream().map(Segment::text).toList();
        List<String> translatedTexts = translateWithRetry(texts, sourceLang, targetLang);

        List<Segment> result = new ArrayList<>();
        for (int j = 0; j < batch.size(); j++) {
            result.add(batch.get(j).withText(
                j < translatedTexts.size() ? translatedTexts.get(j) : "[translation failed]"
            ));
        }
        return result;
    }

    /**
     * Create adaptive batches based on both count and character limits.
     */
    private List<List<Segment>> createBatches(List<Segment> segments) {
        List<List<Segment>> batches = new ArrayList<>();
        List<Segment> currentBatch = new ArrayList<>();
        int currentChars = 0;

        for (Segment seg : segments) {
            int segChars = seg.text().length();

            // Start new batch if limits exceeded
            if (!currentBatch.isEmpty() &&
                (currentBatch.size() >= batchSize || currentChars + segChars > maxCharsPerBatch)) {
                batches.add(new ArrayList<>(currentBatch));
                currentBatch.clear();
                currentChars = 0;
            }

            currentBatch.add(seg);
            currentChars += segChars;
        }

        // Don't forget the last batch
        if (!currentBatch.isEmpty()) {
            batches.add(currentBatch);
        }

        return batches;
    }

    /**
     * Translate with exponential backoff retry.
     * On permanent failure, returns "[translation failed]" for each text.
     */
    private List<String> translateWithRetry(
        List<String> texts, String sourceLang, String targetLang
    ) {
        long delay = initialDelayMs;

        for (int attempt = 1; attempt <= maxRetryAttempts; attempt++) {
            try {
                return tmtApiClient.translate(texts, sourceLang, targetLang);
            } catch (Exception e) {
                log.warn("Translation attempt {}/{} failed: {}", attempt, maxRetryAttempts, e.getMessage());

                if (attempt < maxRetryAttempts) {
                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                    delay *= 2; // exponential backoff
                }
            }
        }

        // All retries exhausted — return fallback
        log.error("All {} retry attempts exhausted for batch of {} texts", maxRetryAttempts, texts.size());
        return texts.stream()
            .map(t -> "[translation failed]")
            .collect(Collectors.toList());
    }
}
