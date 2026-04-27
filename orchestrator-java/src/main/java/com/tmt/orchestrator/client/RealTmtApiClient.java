package com.tmt.orchestrator.client;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.reactive.function.client.ExchangeStrategies;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicLong;

@Component
@ConditionalOnProperty(name = "app.tmt-api.mock", havingValue = "false")
public class RealTmtApiClient implements TmtApiClient {

    private static final Logger log = LoggerFactory.getLogger(RealTmtApiClient.class);

    private static final int  MAX_CONCURRENT      = 1;
    private static final long GLOBAL_BACKOFF_MS   = 65_000;
    private static final long RETRY_BASE_DELAY_MS = 2_000;
    private static final int  MAX_RETRIES         = 5;

    // Calibrated at startup; falls back to 1000 ms if calibration is skipped
    private volatile long cooldownMs = 1_000;

    private static final Path CALIBRATION_FILE = Path.of(".tmt-cooldown");

    private static final Map<String, String> LANG_CODE_MAP = Map.of(
        "tam", "tmg"
    );

    private final WebClient webClient;
    private final Semaphore semaphore = new Semaphore(MAX_CONCURRENT);
    private final AtomicLong globalResumeAt = new AtomicLong(0);

    public RealTmtApiClient(
        @Value("${app.tmt-api.url}") String tmtApiUrl,
        @Value("${app.tmt-api.key}") String apiKey
    ) {
        ExchangeStrategies strategies = ExchangeStrategies.builder()
            .codecs(c -> c.defaultCodecs().maxInMemorySize(10 * 1024 * 1024))
            .build();

        this.webClient = WebClient.builder()
            .baseUrl(tmtApiUrl)
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .defaultHeader("Content-Type", "application/json")
            .exchangeStrategies(strategies)
            .build();

        log.info("RealTmtApiClient initialized: url={} concurrent={}", tmtApiUrl, MAX_CONCURRENT);
    }

    // ── Calibration ──────────────────────────────────────────────────────────

    @PostConstruct
    private void calibrate() {
        if (Files.exists(CALIBRATION_FILE)) {
            try {
                long stored = Long.parseLong(Files.readString(CALIBRATION_FILE).trim());
                if (stored > 0) {
                    cooldownMs = stored;
                    log.info("Loaded calibrated cooldown: {}ms", cooldownMs);
                    return;
                }
            } catch (Exception ignored) {}
        }

        log.info("Calibrating request cooldown — probing safe intervals (runs once, then persisted)");

        // Probe from conservative → aggressive. Stop as soon as a level fails.
        long[] intervals = {500, 300, 200, 150};
        long lastSafe = 1_000;

        for (long interval : intervals) {
            log.info("  Probing {}ms × 5 requests...", interval);
            if (runProbe(interval, 5)) {
                lastSafe = interval;
                log.info("  {}ms: OK", interval);
            } else {
                log.info("  {}ms: 429 — stopping probe, waiting for quota reset", interval);
                sleep(GLOBAL_BACKOFF_MS);
                break;
            }
        }

        cooldownMs = lastSafe * 2;
        log.info("Calibration complete: safe={}ms  cooldown={}ms (2× margin)", lastSafe, cooldownMs);

        try {
            Files.writeString(CALIBRATION_FILE, String.valueOf(cooldownMs));
        } catch (IOException e) {
            log.warn("Could not persist cooldown: {}", e.getMessage());
        }
    }

    private boolean runProbe(long intervalMs, int count) {
        Map<String, String> body = Map.of("text", "Hello", "src_lang", "en", "tgt_lang", "ne");
        for (int i = 0; i < count; i++) {
            try {
                webClient.post().bodyValue(body).retrieve().bodyToMono(Map.class).block();
                sleep(intervalMs);
            } catch (WebClientResponseException ex) {
                if (ex.getStatusCode().value() == 429) return false;
            } catch (Exception ignored) {}
        }
        return true;
    }

    // ── Translation ───────────────────────────────────────────────────────────

    @Override
    public List<String> translate(List<String> texts, String sourceLang, String targetLang) {
        if (texts.isEmpty()) return texts;

        String srcCode = LANG_CODE_MAP.getOrDefault(sourceLang, sourceLang);
        String tgtCode = LANG_CODE_MAP.getOrDefault(targetLang, targetLang);

        log.info("TMT BATCH START segments={} concurrent={} cooldownMs={} src={} tgt={}",
            texts.size(), MAX_CONCURRENT, cooldownMs, srcCode, tgtCode);

        List<String> results = new ArrayList<>(texts.size());
        for (String text : texts) {
            results.add(translateOne(text, srcCode, tgtCode));
        }

        log.info("TMT BATCH DONE  segments={} src={} tgt={}", texts.size(), srcCode, tgtCode);
        return results;
    }

    private String translateOne(String text, String srcLang, String tgtLang) {
        long retryDelay = RETRY_BASE_DELAY_MS;

        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            while (true) {
                awaitGlobalResume();
                semaphore.acquireUninterruptibly();
                if (System.currentTimeMillis() >= globalResumeAt.get()) break;
                semaphore.release();
            }

            boolean shouldRetry = false;
            try {
                Map<String, String> body = Map.of(
                    "text", text,
                    "src_lang", srcLang,
                    "tgt_lang", tgtLang
                );

                log.info("TMT API REQUEST [attempt={}/{}] src={} tgt={} chars={}",
                    attempt, MAX_RETRIES, srcLang, tgtLang, text.length());
                log.debug("TMT API REQUEST body: {}", body);

                long requestStart = System.currentTimeMillis();

                @SuppressWarnings("unchecked")
                Map<String, Object> response = webClient.post()
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

                long elapsedMs = System.currentTimeMillis() - requestStart;

                if (response == null) {
                    log.warn("TMT API RESPONSE [{}ms] null body", elapsedMs);
                    return text;
                }

                String messageType = String.valueOf(response.get("message_type"));
                Object output = response.get("output");
                String outputStr = output != null ? String.valueOf(output) : null;

                log.info("TMT API RESPONSE [{}ms] message_type={} output_chars={}",
                    elapsedMs, messageType, outputStr != null ? outputStr.length() : 0);
                log.debug("TMT API RESPONSE body: {}", response);

                if ("SUCCESS".equals(messageType)) {
                    return outputStr != null ? outputStr : text;
                }

                log.warn("TMT API non-success: message_type={}", messageType);
                return text;

            } catch (WebClientResponseException ex) {
                log.error("TMT API HTTP {} [attempt={}/{}] src={} tgt={}: {}",
                    ex.getStatusCode().value(), attempt, MAX_RETRIES, srcLang, tgtLang, ex.getMessage());
                if (ex.getStatusCode().value() == 429 && attempt < MAX_RETRIES) {
                    triggerGlobalBackoff();
                    shouldRetry = true;
                } else {
                    return text;
                }
            } catch (Exception ex) {
                log.error("TMT API call failed [attempt={}/{}] src={} tgt={}: {}",
                    attempt, MAX_RETRIES, srcLang, tgtLang, ex.getMessage());
                return text;
            } finally {
                sleep(cooldownMs);
                semaphore.release();
            }

            if (shouldRetry) {
                sleep(retryDelay);
                retryDelay = Math.min(retryDelay * 2, 16_000);
            }
        }

        log.error("All {} retries exhausted for src={} tgt={}", MAX_RETRIES, srcLang, tgtLang);
        return text;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void awaitGlobalResume() {
        long resumeAt = globalResumeAt.get();
        long now = System.currentTimeMillis();
        if (now >= resumeAt) return;
        long waitMs = resumeAt - now;
        log.info("Global quota backoff active — waiting {}s", waitMs / 1_000);
        sleep(waitMs);
    }

    private void triggerGlobalBackoff() {
        long resumeAt = System.currentTimeMillis() + GLOBAL_BACKOFF_MS;
        globalResumeAt.updateAndGet(current -> Math.max(current, resumeAt));
        log.warn("429 received — global backoff triggered, all threads pause for {}s",
            GLOBAL_BACKOFF_MS / 1_000);
    }

    private static void sleep(long ms) {
        if (ms <= 0) return;
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }
}
