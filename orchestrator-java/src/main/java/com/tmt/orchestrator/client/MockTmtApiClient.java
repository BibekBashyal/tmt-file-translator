package com.tmt.orchestrator.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Mock TMT API client for development and testing.
 * Simulates translation by adding language markers and slight delay.
 * 
 * Activated when app.tmt-api.mock=true (default).
 */
@Component
@ConditionalOnProperty(name = "app.tmt-api.mock", havingValue = "true", matchIfMissing = true)
public class MockTmtApiClient implements TmtApiClient {

    private static final Logger log = LoggerFactory.getLogger(MockTmtApiClient.class);
    private final Random random = new Random();

    // Sample translations for demo purposes
    private static final Map<String, Map<String, String>> SAMPLE_TRANSLATIONS = Map.of(
        "en", Map.of(
            "Hello", "नमस्ते",
            "Thank you", "धन्यवाद",
            "Good morning", "शुभ प्रभात",
            "Welcome", "स्वागतम्",
            "Name", "नाम",
            "Address", "ठेगाना",
            "Date", "मिति",
            "Phone", "फोन",
            "Email", "इमेल",
            "Country", "देश"
        )
    );

    private static final Map<String, String> LANG_LABELS = Map.of(
        "en", "EN",
        "ne", "NE",
        "tam", "TAM"
    );

    @Override
    public List<String> translate(List<String> texts, String sourceLang, String targetLang) {
        log.info("Mock translating {} texts: {} → {}", texts.size(), sourceLang, targetLang);

        // Simulate API latency (50-200ms per batch)
        try {
            Thread.sleep(50 + random.nextInt(150));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        List<String> results = new ArrayList<>();
        String targetLabel = LANG_LABELS.getOrDefault(targetLang, targetLang.toUpperCase());

        for (String text : texts) {
            // Check if we have a sample translation
            String translated = lookupSample(text, sourceLang, targetLang);
            if (translated != null) {
                results.add(translated);
            } else {
                // Mock: wrap with target language marker
                results.add("[" + targetLabel + "] " + text);
            }
        }

        return results;
    }

    private String lookupSample(String text, String sourceLang, String targetLang) {
        // Only have en→ne samples for now
        if ("en".equals(sourceLang) && "ne".equals(targetLang)) {
            Map<String, String> enSamples = SAMPLE_TRANSLATIONS.get("en");
            if (enSamples != null) {
                return enSamples.get(text);
            }
        }
        return null;
    }
}
